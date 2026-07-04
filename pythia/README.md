# pythia/ — private working copy

Private fork of [PYTHIA](https://github.com/jangles-byte/Pythia) (MIT) for adding
a pluggable **Claude/Anthropic** LLM backend. See `NOTICE.md` for provenance.

- `engine/oracle.py`, `engine/config.py`, `engine/models.py` — **verbatim upstream** (the base we edit)
- `engine/llm_backend.py` — **new**: pluggable backend (Ollama/OpenAI + Claude)
- `docs/claude-integration-plan.md` — the concrete change plan (start here)

The integration hangs off one seam — `Oracle._complete()` — and keeps Ollama as
the offline default with Claude as an opt-in via `LLM_PROVIDER=anthropic`.
