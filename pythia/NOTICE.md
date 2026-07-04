# Provenance & Attribution

This directory is a **private working copy** of the PYTHIA engine, imported for
local modification (adding a pluggable Claude/Anthropic LLM backend).

- **Upstream project:** PYTHIA — https://github.com/jangles-byte/Pythia
- **License:** MIT (see `LICENSE`), Copyright (c) 2026 jangles-byte
- **Imported at:** upstream `main`, fetched 2026-07-04

The MIT license permits private modification and redistribution provided the
copyright notice is retained (kept in `LICENSE`). Any files we add or change in
this copy are our own work layered on top of the upstream MIT base.

Imported verbatim from upstream `engine/`:
- `engine/oracle.py`, `engine/models.py`, `engine/pipeline.py`,
  `engine/osiris_intake.py`, `engine/state.py`

Modified from upstream (our changes on top of the MIT base):
- `engine/config.py` — added `api_token` + `cors_origins` (security)
- `engine/server.py` — CORS lockdown, auth on mutating endpoints, cache lock
  (see `docs/security-hardening.md`)

New/added files in this copy (not from upstream):
- `engine/llm_backend.py` — pluggable LLM backend (Ollama/OpenAI + Anthropic)
- `docs/claude-integration-plan.md` — the Claude integration plan
- `docs/security-hardening.md` — the security changes
