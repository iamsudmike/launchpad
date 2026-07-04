"""The Oracle — feeds a world snapshot to the LLM and gets back predictions.

The LLM is a pluggable backend (see llm_backend.py): local Ollama by default
(no cloud, no cost, unchanged behaviour), or Claude via LLM_PROVIDER=anthropic
(adaptive thinking, guaranteed-schema JSON output, prompt caching).
"""
from __future__ import annotations

import json
import logging
from typing import Awaitable, Callable, Optional

from .config import CONFIG
from .llm_backend import make_backend
from .models import Prediction, WorldBrief

log = logging.getLogger("pythia.oracle")
StageCB = Optional[Callable[[str, str], Awaitable[None]]]

SYSTEM = (
    "You are PYTHIA, a forecasting oracle. You watch a live snapshot of world activity "
    "(conflicts, disasters, seismic events, geopolitics, news) and predict concrete future "
    "events. Be specific, plausible, and grounded in the snapshot. Output strictly JSON."
)

_HORIZON_LABEL = {"24h": "the next 24 hours", "week": "the next week",
                  "month": "the next month", "year": "the next year"}

# Structured-outputs schema (Claude backend): guarantees valid JSON so the
# brace-scanning parser below becomes a fallback for the local-model path.
# Note: structured outputs reject min/max numeric constraints and type arrays —
# probability bounds are clamped in _parse; nullable lat/lng use anyOf.
PREDICTIONS_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["predictions"],
    "properties": {
        "predictions": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["statement", "horizon", "probability",
                             "reasoning", "location", "lat", "lng"],
                "properties": {
                    "statement":   {"type": "string"},
                    "horizon":     {"type": "string", "enum": list(CONFIG.horizons)},
                    "probability": {"type": "integer"},
                    "reasoning":   {"type": "string"},
                    "location":    {"type": "string"},
                    "lat": {"anyOf": [{"type": "number"}, {"type": "null"}]},
                    "lng": {"anyOf": [{"type": "number"}, {"type": "null"}]},
                },
            },
        },
    },
}


def _norm_horizon(h: str) -> str:
    h = (h or "").lower()
    if "24" in h or "day" in h or "tomorrow" in h or "hour" in h:
        return "24h"
    if "week" in h:
        return "week"
    if "month" in h:
        return "month"
    if "year" in h:
        return "year"
    return "week"


class Oracle:
    def __init__(self) -> None:
        self.backend = make_backend(CONFIG)
        # Runtime-switchable via POST /model. Source of truth for the main
        # oracle voice; the backend holds provider wiring, not model choice.
        self.model = (CONFIG.oracle_model if CONFIG.llm_provider == "anthropic"
                      else CONFIG.llm_model)

    async def health(self) -> bool:
        return await self.backend.health()

    async def list_models(self) -> list[str]:
        """Models available to switch to (installed Ollama models, or the
        configured Claude role roster)."""
        return await self.backend.list_models()

    def _prompt(self, brief: WorldBrief) -> tuple[str, str]:
        """(snapshot, instructions) — split so the large snapshot can be marked
        as a cacheable prefix; instructions are the byte-stable tail."""
        horizons = ", ".join(f'"{h}"' for h in CONFIG.horizons)
        spans = "; ".join(f"{h} = {_HORIZON_LABEL.get(h, h)}" for h in CONFIG.horizons)
        snapshot = f"=== LIVE WORLD SNAPSHOT ({brief.event_count} signals) ===\n{brief.text}"
        instructions = (
            f"Note: any [MARKET-ODDS] signals are real-money crowd probabilities from Polymarket — "
            f"treat them as strong anchors; you may sharpen or disagree with them, but stay calibrated.\n"
            f"Give {CONFIG.predictions_per_horizon} concrete predictions for EACH horizon ({spans}).\n"
            f'Return ONLY a JSON object of the form {{"predictions": [ ... ]}}. Each array element exactly:\n'
            f'{{"statement": "<specific predicted event>", "horizon": <one of {horizons}>, '
            f'"probability": <integer 0-100>, "reasoning": "<one sentence grounded in the snapshot>", '
            f'"location": "<the place this is about, e.g. Strait of Hormuz>", '
            f'"lat": <approx latitude or null>, "lng": <approx longitude or null>}}\n'
            f"JSON only — no markdown, no commentary."
        )
        return snapshot, instructions

    async def predict(self, brief: WorldBrief, on_stage: StageCB = None) -> list[Prediction]:
        if on_stage:
            await on_stage("thinking", f"asking {self.model}")
        snapshot, instructions = self._prompt(brief)
        schema = PREDICTIONS_SCHEMA if self.backend.supports_schema else None
        messages = [
            {"role": "system", "content": SYSTEM},
            # cache=True marks the snapshot as a reusable prefix (Claude prompt
            # caching); the swarm's persona calls can share it within a cycle.
            {"role": "user", "content": [
                {"type": "text", "text": snapshot, "cache": True},
                {"type": "text", "text": instructions},
            ]},
        ]
        text = await self._complete(messages, 1400, schema=schema)
        preds = self._parse(text, brief.id)
        log.info("oracle produced %d predictions", len(preds))
        return preds

    async def _complete(self, messages: list[dict], max_tokens: int = 900,
                        model: str | None = None, schema: dict | None = None) -> str:
        return await self.backend.complete(messages, max_tokens=max_tokens,
                                           model=model or self.model, schema=schema)

    async def chat(self, question: str, brief, predictions, history=None) -> str:
        """Answer a free-form question grounded in EVERY live source + current predictions."""
        parts = []
        if brief:
            parts.append(f"=== LIVE WORLD DATA — {brief.event_count} signals across {len(brief.domains)} domains ===\n{brief.text}")
        if predictions:
            parts.append("=== YOUR CURRENT PREDICTIONS ===\n" + "\n".join(
                f"- [{p.horizon}] {int(p.probability * 100)}% {p.statement}" + (f" — {p.reasoning}" if p.reasoning else "")
                for p in predictions[:24]))
        context = "\n\n".join(parts) or "(no live data loaded yet — tell the user to run a forecast)"
        sys = ("You are PYTHIA, an oracle watching the world through live global feeds (news, conflict, "
               "weather/disasters, seismic, cyber, infrastructure, and Polymarket crowd odds). Answer the "
               "user's question using the live data below and sound reasoning. Be specific and concise, cite "
               "concrete signals, and give probabilities when it helps. If the data doesn't cover something, say so.")
        messages: list[dict] = [{"role": "system", "content": sys}]
        for h in (history or [])[-6:]:
            role = "assistant" if h.get("role") == "assistant" else "user"
            messages.append({"role": role, "content": str(h.get("content", ""))[:2000]})
        # Context marked cacheable: repeat questions against the same brief
        # within the cache TTL reuse the prefix instead of re-reading it.
        messages.append({"role": "user", "content": [
            {"type": "text", "text": context, "cache": True},
            {"type": "text", "text": f"— USER QUESTION —\n{question}"},
        ]})
        model = CONFIG.chat_model if CONFIG.llm_provider == "anthropic" else None
        return await self._complete(messages, 800, model=model)

    @staticmethod
    def _extract_objects(text: str) -> list[str]:
        """Pull every balanced top-level {...} object out of arbitrary model output.

        Robust to ```fences```, multiple JSON arrays, trailing prose, etc.
        """
        objs: list[str] = []
        depth, start, in_str, esc = 0, None, False, False
        for i, ch in enumerate(text):
            if in_str:
                if esc:
                    esc = False
                elif ch == "\\":
                    esc = True
                elif ch == '"':
                    in_str = False
                continue
            if ch == '"':
                in_str = True
            elif ch == "{":
                if depth == 0:
                    start = i
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0 and start is not None:
                    objs.append(text[start:i + 1])
                    start = None
        return objs

    @classmethod
    def _parse(cls, text: str, brief_id: str) -> list[Prediction]:
        # Fast path: structured outputs (Claude) return {"predictions": [...]}
        # verbatim; a clean bare array also short-circuits. Anything else falls
        # back to the brace scanner (local models with fences/prose).
        items: list | None = None
        try:
            obj = json.loads(text)
            if isinstance(obj, dict) and isinstance(obj.get("predictions"), list):
                items = obj["predictions"]
            elif isinstance(obj, list):
                items = obj
        except (ValueError, TypeError):
            items = None
        chunks = ([json.dumps(i) for i in items if isinstance(i, dict)]
                  if items is not None else cls._extract_objects(text))

        preds: list[Prediction] = []
        for chunk in chunks:
            try:
                it = json.loads(chunk)
            except (ValueError, TypeError):
                continue
            if not isinstance(it, dict) or not it.get("statement"):
                continue
            p = it.get("probability", 50)
            try:
                p = float(p)
            except (TypeError, ValueError):
                p = 50.0
            p = max(0.0, min(1.0, p / 100.0 if p > 1 else p))

            def _num(v):
                try:
                    return float(v)
                except (TypeError, ValueError):
                    return None
            lat, lng = _num(it.get("lat")), _num(it.get("lng"))
            if lat is not None and not (-90 <= lat <= 90):
                lat = None
            if lng is not None and not (-180 <= lng <= 180):
                lng = None
            preds.append(Prediction(
                statement=str(it["statement"]).strip()[:300],
                horizon=_norm_horizon(str(it.get("horizon", "week"))),
                probability=round(p, 2),
                reasoning=str(it.get("reasoning", "")).strip()[:400],
                location=str(it.get("location", "")).strip()[:80],
                lat=lat, lng=lng,
                brief_id=brief_id,
            ))
        if not preds:
            log.warning("oracle: no predictions parsed from: %s", text[:200])
        return preds
