# Claude integration plan — concrete changes

Goal: make the Oracle's LLM a **pluggable backend** — keep Ollama as the free/
offline default, add **Claude** (Opus 4.8 forecast / Haiku swarm / optional Fable
deep pass) as an opt-in boost — and pick up two wins that come free with the swap:
**native structured outputs** (delete the brittle JSON scanner) and **prompt
caching** (share the world-snapshot prefix across the swarm).

The whole integration hangs off **one seam**: `Oracle._complete()` in `oracle.py`
(line ~97). Everything — `predict`, `chat`, and the swarm — calls through it.

Status: `engine/llm_backend.py` is written (new module). The edits below to the
two **existing** files are staged as diffs for us to apply together.

---

## Change 1 — `engine/config.py`: provider switch + Claude knobs

Add near the other env helpers (top of file) so `oracle.py` can read
`cfg.httpx_verify` without importing the module-level constant:

```python
# expose the module-level verify context on the config object
# (llm_backend reads cfg.httpx_verify)
```

Then add these fields to the `Config` dataclass (after the existing
`# ── Oracle LLM ──` block):

```python
    # ── Backend selection ──
    # "openai"  = Ollama / LM Studio / OpenAI-compatible /chat/completions (default, offline)
    # "anthropic" = Claude via the Messages API
    llm_provider: str = field(default_factory=lambda: (os.environ.get("LLM_PROVIDER") or "openai").lower())
    httpx_verify: object = field(default_factory=lambda: HTTPX_VERIFY)

    # ── Claude (only used when llm_provider == "anthropic") ──
    anthropic_api_key: str = field(default_factory=lambda: os.environ.get("ANTHROPIC_API_KEY", ""))
    oracle_model: str = field(default_factory=lambda: os.environ.get("ORACLE_MODEL", "claude-opus-4-8"))
    swarm_model:  str = field(default_factory=lambda: os.environ.get("SWARM_MODEL",  "claude-haiku-4-5"))
    chat_model:   str = field(default_factory=lambda: os.environ.get("CHAT_MODEL",   "claude-haiku-4-5"))
    # optional daily "deep reading" — OFF by default (Fable 5 requires 30-day data
    # retention, which conflicts with Pythia's offline/private ethos).
    deep_model:   str = field(default_factory=lambda: os.environ.get("DEEP_MODEL",   ""))  # e.g. "claude-fable-5"

    effort: str = field(default_factory=lambda: os.environ.get("ORACLE_EFFORT", "high"))
    use_thinking: bool = field(default_factory=lambda: _b("ORACLE_THINKING", True))
    use_prompt_caching: bool = field(default_factory=lambda: _b("ORACLE_CACHE", True))
    min_output_tokens: int = field(default_factory=lambda: _i("ORACLE_MIN_OUTPUT_TOKENS", 4000))
```

Also add `llm_provider` and `oracle_model` to `summary()` so the `/config`
endpoint reports what's actually running.

> **Temperature:** leave `CONFIG.temperature` as-is — it's only sent by the
> OpenAI-compatible backend. The Anthropic backend never sends it (Claude 4.x
> returns a 400 on any sampling param).

---

## Change 2 — `engine/oracle.py`: use the backend + structured outputs

### 2a. `__init__` — build a backend instead of hardcoding HTTP

```diff
-    def __init__(self) -> None:
-        self.base = CONFIG.llm_base_url.rstrip("/")
-        self.key = CONFIG.llm_api_key
-        self.model = CONFIG.llm_model
+    def __init__(self) -> None:
+        from .llm_backend import make_backend
+        self.backend = make_backend(CONFIG)
+        self.model = CONFIG.oracle_model if CONFIG.llm_provider == "anthropic" else CONFIG.llm_model
```

### 2b. `health` / `list_models` — delegate

```diff
-    async def health(self) -> bool:
-        try:
-            async with httpx.AsyncClient(...) as c:
-                ...
-        except Exception:
-            return False
+    async def health(self) -> bool:
+        return await self.backend.health()

-    async def list_models(self) -> list[str]:
-        ...
+    async def list_models(self) -> list[str]:
+        return await self.backend.list_models()
```

### 2c. `_complete` — one line, delegate to the backend

```diff
-    async def _complete(self, messages, max_tokens=900, model=None) -> str:
-        body = {"model": model or self.model, "messages": messages,
-                "temperature": CONFIG.temperature, "max_tokens": max_tokens}
-        async with httpx.AsyncClient(verify=HTTPX_VERIFY, timeout=CONFIG.request_timeout) as c:
-            r = await c.post(f"{self.base}/chat/completions", json=body,
-                             headers={"Authorization": f"Bearer {self.key}"})
-            r.raise_for_status()
-            return r.json()["choices"][0]["message"]["content"]
+    async def _complete(self, messages, max_tokens=900, model=None,
+                        schema=None, cache=False) -> str:
+        return await self.backend.complete(messages, max_tokens=max_tokens,
+                                           model=model, schema=schema, cache=cache)
```

### 2d. `predict` — request the schema (guaranteed JSON) and cache the prefix

```diff
     async def predict(self, brief, on_stage=None):
         if on_stage:
             await on_stage("thinking", f"asking {self.model}")
-        text = await self._chat(self._prompt(brief))
+        schema = PREDICTIONS_SCHEMA if self.backend.supports_schema else None
+        text = await self._chat(self._prompt(brief), schema=schema)
         preds = self._parse(text, brief.id)
         log.info("oracle produced %d predictions", len(preds))
         return preds

-    async def _chat(self, user: str) -> str:
-        return await self._complete(
-            [{"role": "system", "content": SYSTEM}, {"role": "user", "content": user}], 1400)
+    async def _chat(self, user: str, schema=None) -> str:
+        # cache=True: the world-snapshot prefix is reused by the swarm within a cycle
+        return await self._complete(
+            [{"role": "system", "content": SYSTEM}, {"role": "user", "content": user}],
+            max_tokens=1400, schema=schema, cache=True)
```

### 2e. `chat` — route to the cheap chat model

```diff
-        return await self._complete(messages, 800)
+        model = CONFIG.chat_model if CONFIG.llm_provider == "anthropic" else None
+        return await self._complete(messages, 800, model=model, cache=True)
```

### 2f. `_parse` — try the structured object first, keep the scanner as fallback

Prepend a fast path; the existing brace-scanner (`_extract_objects`) stays as the
fallback for the Ollama/OpenAI path (which has no schema guarantee):

```python
    @classmethod
    def _parse(cls, text: str, brief_id: str) -> list[Prediction]:
        # Fast path: structured outputs return {"predictions": [ ... ]}
        try:
            obj = json.loads(text)
            items = obj["predictions"] if isinstance(obj, dict) and "predictions" in obj else None
        except (ValueError, TypeError):
            items = None
        chunks = ([json.dumps(i) for i in items]
                  if isinstance(items, list) else cls._extract_objects(text))
        preds: list[Prediction] = []
        for chunk in chunks:
            ...  # (existing per-object normalization unchanged)
```

### 2g. Add the schema constant (module level, near `SYSTEM`)

```python
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
                    "horizon":     {"type": "string", "enum": CONFIG.horizons},
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
```

> Structured outputs don't support `minLength`/`maximum` etc. — that's fine, we
> already clamp/truncate in `_parse`. Use `anyOf` for nullable lat/lng (a
> `["number","null"]` type array is not accepted).

### 2h. Prompt tweak (`_prompt`) — ask for the object form

Change the last lines of `_prompt` from "Return ONLY a JSON array" to a single
object so both backends agree and `_parse`'s fast path fires:

```
Return ONLY a JSON object: {"predictions": [ <one element per prediction> ]}.
Each element exactly: { ... same fields ... }
```

(The Ollama path still works: `_extract_objects` pulls the inner objects out of
the wrapper if a local model ignores the envelope.)

---

## Change 3 — `engine/swarm.py` (follow-up, file not yet imported)

The swarm re-scores predictions and is ~80% of per-cycle tokens. Point it at the
same backend and the cheap model:

- Give `Swarm` an `Oracle`/backend handle (or its own `make_backend(CONFIG)`).
- Each persona call: `backend.complete(msgs, model=CONFIG.swarm_model, cache=True)`.
- **For caching to actually hit across the main forecast + 4 personas, they must
  share an identical leading prefix.** Easiest: put the world-snapshot text in the
  `system` block for both oracle and swarm (same bytes, same position) and keep
  per-persona instructions in the user turn after it.

I can pull `swarm.py` in and write this diff when you're ready.

---

## Change 4 — deps & env

`requirements.txt` / `pyproject.toml`: add `anthropic>=0.40`.

`.env.example` additions:

```dotenv
# --- LLM backend ---
LLM_PROVIDER=openai            # "openai" (Ollama, default) | "anthropic"
# ANTHROPIC_API_KEY=sk-ant-...
# ORACLE_MODEL=claude-opus-4-8
# SWARM_MODEL=claude-haiku-4-5
# CHAT_MODEL=claude-haiku-4-5
# DEEP_MODEL=                  # e.g. claude-fable-5 (OFF by default; see privacy note)
# ORACLE_EFFORT=high
# ORACLE_THINKING=true
# ORACLE_CACHE=true

# --- cadence (cost lever) ---
LOOP_INTERVAL_SEC=3600         # hourly forecasts (default is 900 = every 15 min)
```

---

## Cadence & cost (why the config defaults matter)

`config.py` currently defaults `loop_interval_sec=900` — **every 15 minutes**.
On all-Opus that's ~$2,000/month; hourly (`3600`) with the Opus+Haiku split and
caching lands **~$150–250/month**. **Raise the interval before enabling Claude.**

| Tier          | Model            | Runs           |
|---------------|------------------|----------------|
| Main forecast | `oracle_model`   | every cycle    |
| Swarm         | `swarm_model`    | every cycle    |
| Chat endpoint | `chat_model`     | on demand      |
| Deep reading  | `deep_model`     | daily (opt-in) |

## Privacy note — Fable 5 is off by default on purpose

`deep_model` is empty by default. Fable 5 requires **30-day data retention** (no
zero-retention option), which conflicts with Pythia's "runs entirely offline /
private" identity. Enable it only if you accept that tradeoff; when set, wire it
as a once-daily synthesis over the full snapshot for the month/year horizons —
not into the per-cycle loop.

---

## Apply order

1. `config.py` (Change 1) — provider + knobs.
2. `oracle.py` (Change 2) — backend seam + structured outputs. **← the core.**
3. Add `anthropic` dep, `.env` (Change 4).
4. Smoke test with `LLM_PROVIDER=anthropic` on one forecast.
5. `swarm.py` (Change 3) — route the swarm to Haiku + shared cache prefix.
