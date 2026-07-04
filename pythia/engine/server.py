"""PYTHIA oracle API — Osiris world data in, future predictions out."""
from __future__ import annotations

import asyncio
import hmac
import logging
from contextlib import asynccontextmanager

from fastapi import Body, Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .config import CONFIG
from .state import STATE

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
log = logging.getLogger("pythia.server")

_LOOPBACK = {"127.0.0.1", "::1", "localhost"}


def _provided_token(request: Request) -> str:
    """Read the caller's token from X-API-Key or `Authorization: Bearer <token>`."""
    tok = request.headers.get("x-api-key", "")
    if not tok:
        auth = request.headers.get("authorization", "")
        if auth.lower().startswith("bearer "):
            tok = auth[7:].strip()
    return tok


async def require_auth(request: Request) -> None:
    """Guard for mutating endpoints.

    - PYTHIA_API_TOKEN set  -> require it (constant-time compare).
    - Unset AND engine bound to a non-loopback host -> refuse remote mutating
      requests (fail-closed once exposed to the network).
    - Unset AND bound to loopback -> allow (local dev; warned at startup).
    """
    token = CONFIG.api_token
    if token:
        if not hmac.compare_digest(_provided_token(request), token):
            raise HTTPException(401, "invalid or missing API token")
        return
    exposed = CONFIG.engine_host not in _LOOPBACK
    client_host = request.client.host if request.client else ""
    if exposed and client_host not in _LOOPBACK:
        raise HTTPException(
            503,
            "engine is exposed on a non-loopback host with no PYTHIA_API_TOKEN set; "
            "refusing mutating request. Set PYTHIA_API_TOKEN to enable remote control.",
        )


@asynccontextmanager
async def lifespan(app: FastAPI):
    from .loop import LOOP, SENSE
    from .pipeline import run_prediction
    LOOP.start()
    SENSE.start()   # keep live events fresh between forecasts
    log.info("PYTHIA oracle up | %s", CONFIG.summary())
    if not CONFIG.api_token and CONFIG.engine_host not in _LOOPBACK:
        log.warning(
            "SECURITY: mutating endpoints are UNAUTHENTICATED and the engine is bound "
            "to %s (non-loopback). Remote mutating requests will be refused; set "
            "PYTHIA_API_TOKEN to enable controlled remote access.", CONFIG.engine_host)

    async def _boot():
        from .runtime import intake
        from .pipeline import refresh_world
        # wait for Osiris to be reachable, then give its routes a moment to compile
        for _ in range(20):
            if await intake.health():
                break
            await asyncio.sleep(2)
        await asyncio.sleep(4)
        await refresh_world()              # populate live events immediately (for agents/chat)
        await run_prediction(trigger="boot")

    asyncio.create_task(_boot())
    yield


app = FastAPI(title="PYTHIA Oracle", version="0.2.0", lifespan=lifespan)
# Locked to the local Osiris UI by default (was allow_origins=["*"]). Override
# with CORS_ORIGINS. This blocks cross-origin drive-by requests from other sites
# open in the same browser; the API token guards non-browser clients.
app.add_middleware(
    CORSMiddleware,
    allow_origins=CONFIG.cors_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "X-API-Key", "Content-Type"],
    allow_credentials=False,
)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "pythia-oracle", "config": CONFIG.summary()}


@app.get("/config")
async def config():
    return CONFIG.summary()


_links_cache: dict = {"ts": 0.0, "data": None}
_links_lock = asyncio.Lock()


@app.get("/links")
async def links():
    import time as _t
    # Serialize the read-modify-write so concurrent callers don't fire N health
    # probes at once or interleave on the shared cache dict.
    async with _links_lock:
        now = _t.monotonic()
        if _links_cache["data"] and now - _links_cache["ts"] < 8:
            data = dict(_links_cache["data"])
        else:
            from .runtime import intake, oracle
            osiris_up, oracle_up = await asyncio.gather(intake.health(), oracle.health())
            data = {"engine": True, "osiris": bool(osiris_up), "oracle": bool(oracle_up)}
            _links_cache.update(ts=now, data=dict(data))
    from .runtime import oracle as _oracle
    data.update(model=_oracle.model, generating=STATE.generating,
                loop=STATE.loop_enabled, last_run_ms=STATE.last_run_ms,
                prediction_count=len(STATE.predictions))
    return data


@app.get("/models")
async def models():
    """Installed local models + the one currently in use."""
    from .runtime import oracle
    return {"models": await oracle.list_models(), "current": oracle.model}


@app.post("/model", dependencies=[Depends(require_auth)])
async def set_model(payload: dict = Body(...)):
    """Switch the oracle's model at runtime."""
    from .runtime import oracle
    name = (payload or {}).get("model", "").strip()
    if not name:
        raise HTTPException(400, "provide `model`")
    oracle.model = name
    STATE.publish("model", {"model": name})
    log.info("oracle model switched -> %s", name)
    return {"model": oracle.model}


@app.get("/swarm/models")
async def swarm_models_get():
    """Per-persona model overrides for the swarm council + the models available to pick from."""
    from .runtime import oracle
    from .swarm import PERSONAS
    return {
        "personas": [name for name, _ in PERSONAS],
        "overrides": STATE.swarm_models,          # persona -> model (only those overridden)
        "default_model": oracle.model,            # what a persona uses when not overridden
        "available": await oracle.list_models(),
    }


@app.post("/swarm/model", dependencies=[Depends(require_auth)])
async def swarm_model_set(payload: dict = Body(...)):
    """Set (or clear) the model for one swarm persona. Empty/blank model = use the main model."""
    from .swarm import PERSONAS
    persona = (payload or {}).get("persona", "").strip()
    model = (payload or {}).get("model", "").strip()
    if persona not in {name for name, _ in PERSONAS}:
        raise HTTPException(400, "unknown persona")
    if model:
        STATE.swarm_models[persona] = model
    else:
        STATE.swarm_models.pop(persona, None)
    log.info("swarm persona %s -> %s", persona, model or "(main)")
    return {"overrides": STATE.swarm_models}


@app.get("/predictions")
async def predictions(horizon: str | None = None, min_probability: float = 0.0):
    """Current forecasts, optionally filtered by `horizon` (24h|week|month|year)
    and `min_probability` (0..1)."""
    preds = [p for p in STATE.predictions
             if (not horizon or p.horizon == horizon) and p.probability >= min_probability]
    return {"predictions": [p.model_dump() for p in preds],
            "horizons": CONFIG.horizons,
            "world": STATE.world.model_dump() if STATE.world else None}


@app.post("/predict", dependencies=[Depends(require_auth)])
async def predict():
    """Run an oracle pass now (sense the world -> forecast)."""
    from .pipeline import run_prediction
    if STATE.generating:
        return {"status": "already running"}
    asyncio.create_task(run_prediction(trigger="manual"))
    return {"status": "started"}


@app.get("/agent/view")
async def agent_view():
    """One consolidated, machine-readable view of the world for external agents:
    the assembled brief, every live event (with coords), and current predictions.
    For a live feed, subscribe to GET /state/stream (SSE)."""
    from .runtime import oracle
    by_domain: dict[str, list] = {}
    for e in STATE.events:
        by_domain.setdefault(e.category, []).append({
            "title": e.title, "summary": e.summary, "source": e.source,
            "lat": e.lat, "lng": e.lng, "salience": e.salience, "ts": e.ts,
        })
    return {
        "generated_at": STATE.last_run_ms,
        "model": oracle.model,
        "summary": (STATE.world.text if STATE.world else ""),
        "domains": (STATE.world.domains if STATE.world else {}),
        "events_by_domain": by_domain,
        "event_count": len(STATE.events),
        "predictions": [p.model_dump() for p in STATE.predictions],
        "live_stream": "/state/stream",
    }


@app.get("/agent/events")
async def agent_events(domain: str | None = None, source: str | None = None,
                       min_salience: float = 0.0, since: int = 0, limit: int = 0):
    """Every live world event, with optional filters so an agent gets exactly what it wants:
    `domain` (category), `source`, `min_salience` (0..1), `since` (epoch ms), `limit`.
    Returned most-salient first, with the list of available domains for discovery."""
    out = []
    for e in STATE.events:
        if domain and e.category != domain:
            continue
        if source and e.source != source:
            continue
        if e.salience < min_salience:
            continue
        if since and e.ts < since:
            continue
        out.append(e)
    out.sort(key=lambda e: e.salience, reverse=True)
    if limit > 0:
        out = out[:limit]
    return {"count": len(out), "events": [e.model_dump() for e in out],
            "domains_available": sorted({e.category for e in STATE.events})}


@app.get("/world")
async def world():
    if not STATE.world:
        raise HTTPException(404, "no world brief yet — run /predict")
    return STATE.world.model_dump()


@app.get("/runs")
async def runs():
    return {"runs": [r.model_dump() for r in list(STATE.runs.values())[-20:]]}


@app.get("/state")
async def state():
    return STATE.snapshot()


@app.get("/state/stream")
async def stream():
    async def gen():
        q = STATE.subscribe()
        try:
            yield STATE.sse({"kind": "snapshot", "payload": STATE.snapshot()})
            while True:
                try:
                    msg = await asyncio.wait_for(q.get(), timeout=15)
                    yield STATE.sse(msg)
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
        finally:
            STATE.unsubscribe(q)

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.post("/chat", dependencies=[Depends(require_auth)])
async def chat(payload: dict = Body(...)):
    """Ask the oracle anything — it sees every live source + current predictions."""
    from .runtime import intake, oracle
    from .world_state import build_brief
    msg = (payload or {}).get("message", "").strip()
    if not msg:
        raise HTTPException(400, "provide `message`")
    brief = STATE.world
    if brief is None:
        try:
            brief = build_brief(await intake.fetch(limit=150))
            STATE.set_world(brief)
        except Exception:  # noqa: BLE001
            brief = None
    answer = await oracle.chat(msg, brief, STATE.predictions, payload.get("history", []))
    return {"answer": answer}


@app.post("/loop", dependencies=[Depends(require_auth)])
async def loop(payload: dict = Body(default={})):
    STATE.set_loop(bool(payload.get("enabled", not STATE.loop_enabled)))
    return {"loop_enabled": STATE.loop_enabled}
