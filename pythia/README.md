# pythia/ — private working copy

Private fork of [PYTHIA](https://github.com/jangles-byte/Pythia) (MIT) for adding
a pluggable **Claude/Anthropic** LLM backend. See `NOTICE.md` for provenance.

- `engine/*` — upstream base; `oracle.py`/`config.py`/`server.py`/`swarm.py` carry our changes (see `NOTICE.md`)
- `engine/llm_backend.py` — **new**: pluggable backend (Ollama/OpenAI + Claude)
- `docs/claude-integration-plan.md` — the change plan (**applied** — see its Status section)
- `tests/test_engine.py` — run with `python3 tests/test_engine.py`

The integration hangs off one seam — `Oracle._complete()` — and keeps Ollama as
the offline default with Claude as an opt-in via `LLM_PROVIDER=anthropic`.
