# Security hardening

Fixes for the vulnerability flagged in the initial review: the API shipped with
`CORS allow_origins=["*"]` and **no auth** on endpoints that change state and
drive the LLM. With Claude wired in, those unauthenticated endpoints also spend
money — so this went in before the Claude integration.

## What changed (this commit)

### 1. CORS locked down — `server.py`
`allow_origins=["*"]` → `CONFIG.cors_origins`, default
`http://localhost:3000, http://127.0.0.1:3000` (the local Osiris UI only),
overridable via `CORS_ORIGINS`. Methods narrowed to `GET`/`POST`; headers to
`Authorization`, `X-API-Key`, `Content-Type`. This blocks a malicious site open
in the same browser from issuing cross-origin requests to the engine.

### 2. Auth on mutating endpoints — `server.py`
A `require_auth` dependency now guards **`/model`, `/swarm/model`, `/predict`,
`/chat`, `/loop`** (read-only endpoints are unchanged). Policy:

| `PYTHIA_API_TOKEN` | Engine bind host | Mutating request |
|---|---|---|
| set | any | require token (`X-API-Key` or `Authorization: Bearer`), constant-time compare |
| unset | loopback (`127.0.0.1`/`localhost`) | allowed — local dev |
| unset | non-loopback (e.g. `0.0.0.0`) | **refused (503)** for remote clients — fail-closed once exposed |

So local development keeps working with zero config, but the moment the engine
is reachable on the network without a token, remote control is refused with a
message telling you to set `PYTHIA_API_TOKEN`. A startup `WARNING` fires in that
exposed-and-tokenless state.

Token comparison uses `hmac.compare_digest` (constant-time; no early-exit timing
leak).

### 3. `_links_cache` race — `server.py`
The `/links` read-modify-write is now wrapped in an `asyncio.Lock`, so
concurrent callers don't fire duplicate health probes or interleave on the
shared cache dict.

## How to use

Local, single user — nothing to do (loopback + no token = allowed).

Exposed on a network / behind a tunnel:
```dotenv
PYTHIA_API_TOKEN=<a long random string>
# optionally widen the UI origin:
# CORS_ORIGINS=https://your-ui.example
```
Then send it from the caller:
```
curl -X POST http://host:8088/predict -H "X-API-Key: <token>"
```
The Osiris UI (separate repo) needs to attach the same header on its POST calls.

## Important caveat

**CORS is a browser protection only** — it does not stop `curl` or any
non-browser client. The **token is the real access control**; CORS just closes
the cross-origin drive-by vector. Treat the token as required whenever the engine
is reachable beyond `localhost`. Consider also setting `ENGINE_HOST=127.0.0.1`
if you don't actually need LAN access (it currently defaults to `0.0.0.0`).

## Still open (not in this commit — reliability, follow-ups)

- **Silent failures.** `pipeline.py` / `oracle.py` swallow feed and LLM errors
  (`except Exception → []`/degrade), so outages look like "quiet." Make `/health`
  report feed + LLM status and per-feed success counts.
- **No feed caching / backoff** in `osiris_intake.py` — hammers the free feeds
  every cycle; add per-feed TTL caching + exponential backoff.
- **No tests** — start with the `oracle._parse` path and `require_auth`.
