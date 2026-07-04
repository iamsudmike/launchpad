# Provenance & Attribution

This directory is a **private working copy** of the PYTHIA engine, imported for
local modification (adding a pluggable Claude/Anthropic LLM backend).

- **Upstream project:** PYTHIA — https://github.com/jangles-byte/Pythia
- **License:** MIT (see `LICENSE`), Copyright (c) 2026 jangles-byte
- **Imported at:** upstream `main`, fetched 2026-07-04

The MIT license permits private modification and redistribution provided the
copyright notice is retained (kept in `LICENSE`). Any files we add or change in
this copy are our own work layered on top of the upstream MIT base.

Imported verbatim from upstream `engine/` (unmodified):
- `engine/__init__.py`, `engine/models.py`, `engine/pipeline.py`,
  `engine/osiris_intake.py`, `engine/state.py`, `engine/loop.py`,
  `engine/runtime.py`, `engine/world_state.py`

Modified from upstream (our changes on top of the MIT base):
- `engine/config.py` — security knobs (`api_token`, `cors_origins`) + pluggable
  LLM provider config (Claude models, effort, thinking, caching)
- `engine/server.py` — CORS lockdown, auth on mutating endpoints, cache lock
  (see `docs/security-hardening.md`)
- `engine/oracle.py` — LLM calls delegated to the pluggable backend; structured
  outputs fast path; cacheable snapshot prefix
- `engine/swarm.py` — personas route to the cheap swarm model on the Claude backend

New/added files in this copy (not from upstream):
- `engine/llm_backend.py` — pluggable LLM backend (Ollama/OpenAI + Anthropic)
- `tests/test_engine.py` — parse paths, backend helpers, auth policy matrix
- `.env.example` — backend/security/cadence configuration
- `docs/claude-integration-plan.md` — the Claude integration plan (applied)
- `docs/security-hardening.md` — the security changes
