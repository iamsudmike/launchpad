"""Pluggable LLM backend for the Oracle.

Keeps Ollama/OpenAI-compatible HTTP as the default (offline, free) and adds a
native Anthropic (Claude) backend behind the same `complete()` interface.

Design goal: `Oracle` and the swarm should not know which provider they're
talking to. They build OpenAI-style message lists and call
`backend.complete(...)`; each backend adapts.

Message content may be a plain string OR a list of blocks:
    {"type": "text", "text": "...", "cache": True}
The neutral `cache: True` hint marks a large, stable prefix (e.g. the world
snapshot). The Anthropic backend translates it to `cache_control` (prompt
caching); the OpenAI backend flattens blocks back into one string.

Provider is chosen by CONFIG.llm_provider:
  - "openai"    -> OpenAICompatBackend (Ollama, LM Studio, OpenAI, any /chat/completions)
  - "anthropic" -> AnthropicBackend    (Claude via the Messages API)

Claude specifics handled here so callers don't care:
  * NO temperature/top_p/top_k — Claude 4.x models (Opus 4.8, Sonnet 5,
    Haiku 4.5, Fable 5) reject sampling params with a 400. Never sent.
  * Adaptive thinking + effort drive forecast-reasoning quality; on by default.
    Thinking tokens bill as output, so max_tokens gets a floor.
  * Structured outputs (output_config.format) guarantee schema-valid JSON,
    letting the Oracle's brace-scanning parser become a fallback path.
  * First message must be role "user" — history that starts with an assistant
    turn is guarded.
"""
from __future__ import annotations

import logging
from typing import Any

import httpx

log = logging.getLogger("pythia.llm")

Content = "str | list[dict]"


def _flatten(content) -> str:
    """Blocks -> single string (for OpenAI-compatible backends)."""
    if isinstance(content, str):
        return content
    return "\n\n".join(str(b.get("text", "")) for b in content)


# --------------------------------------------------------------------------- #
# OpenAI-compatible (Ollama / LM Studio / OpenAI) — the existing, default path #
# --------------------------------------------------------------------------- #
class OpenAICompatBackend:
    supports_schema = False  # generic /chat/completions has no strict schema guarantee

    def __init__(self, cfg) -> None:
        self.base = cfg.llm_base_url.rstrip("/")
        self.key = cfg.llm_api_key
        self.default_model = cfg.llm_model
        self.temperature = cfg.temperature
        self.timeout = cfg.request_timeout
        self.verify = cfg.httpx_verify

    async def complete(self, messages: list[dict], max_tokens: int = 900,
                       model: str | None = None, schema: dict | None = None) -> str:
        # schema is a Claude-only guarantee; the prompt still asks for JSON here.
        body: dict[str, Any] = {
            "model": model or self.default_model,
            "messages": [{"role": m["role"], "content": _flatten(m.get("content", ""))}
                         for m in messages],
            "temperature": self.temperature,
            "max_tokens": max_tokens,
        }
        async with httpx.AsyncClient(verify=self.verify, timeout=self.timeout) as c:
            r = await c.post(f"{self.base}/chat/completions", json=body,
                             headers={"Authorization": f"Bearer {self.key}"})
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"]

    async def health(self) -> bool:
        try:
            async with httpx.AsyncClient(verify=self.verify, timeout=5) as c:
                r = await c.get(f"{self.base}/models",
                                headers={"Authorization": f"Bearer {self.key}"})
                return r.status_code < 500
        except Exception:  # noqa: BLE001 — health is a status dot; never raise
            return False

    async def list_models(self) -> list[str]:
        try:
            async with httpx.AsyncClient(verify=self.verify, timeout=8) as c:
                r = await c.get(f"{self.base}/models",
                                headers={"Authorization": f"Bearer {self.key}"})
                r.raise_for_status()
                data = r.json().get("data", [])
                names = sorted({m.get("id", "") for m in data if m.get("id")})
                return [n for n in names if n and "embed" not in n.lower()]
        except Exception:  # noqa: BLE001
            return []


# --------------------------------------------------------------------------- #
# Anthropic (Claude) — native Messages API                                     #
# --------------------------------------------------------------------------- #
def _to_anthropic_content(content):
    """Neutral blocks -> Anthropic content; `cache: True` -> cache_control."""
    if isinstance(content, str):
        return content
    out = []
    for b in content:
        blk: dict[str, Any] = {"type": "text", "text": str(b.get("text", ""))}
        if b.get("cache"):
            blk["cache_control"] = {"type": "ephemeral"}
        out.append(blk)
    return out


def _split_system(messages: list[dict]) -> tuple[str, list[dict]]:
    """OpenAI keeps `system` in the message list; Anthropic wants it top-level.
    Pull system turns into one string; map the rest to user/assistant."""
    system_parts: list[str] = []
    convo: list[dict] = []
    for m in messages:
        role = m.get("role")
        content = m.get("content", "")
        if role == "system":
            system_parts.append(_flatten(content))
        else:
            convo.append({"role": "assistant" if role == "assistant" else "user",
                          "content": _to_anthropic_content(content)})
    # Anthropic requires the conversation to open with a user turn.
    if not convo:
        convo = [{"role": "user", "content": "(no input)"}]
    elif convo[0]["role"] == "assistant":
        convo.insert(0, {"role": "user", "content": "(conversation history follows)"})
    return "\n\n".join(system_parts), convo


class AnthropicBackend:
    supports_schema = True

    def __init__(self, cfg) -> None:
        from anthropic import AsyncAnthropic  # lazy: only needed when provider=anthropic
        self._api_key = cfg.anthropic_api_key
        self._client = AsyncAnthropic(api_key=self._api_key or None)
        self.default_model = cfg.oracle_model
        self.effort = cfg.effort
        self.use_thinking = cfg.use_thinking
        self.use_caching = cfg.use_prompt_caching
        self.min_output_tokens = cfg.min_output_tokens  # thinking bills as output
        self._roster = sorted({m for m in (cfg.oracle_model, cfg.swarm_model,
                                           cfg.chat_model, cfg.deep_model) if m})

    async def complete(self, messages: list[dict], max_tokens: int = 900,
                       model: str | None = None, schema: dict | None = None) -> str:
        system, convo = _split_system(messages)
        if not self.use_caching:  # strip cache markers when caching is disabled
            for m in convo:
                if isinstance(m["content"], list):
                    for b in m["content"]:
                        b.pop("cache_control", None)
        # Give adaptive thinking room: it shares the output budget.
        out_tokens = max(max_tokens, self.min_output_tokens) if self.use_thinking else max_tokens

        kwargs: dict[str, Any] = {
            "model": model or self.default_model,
            "max_tokens": out_tokens,
            "messages": convo,
        }
        if system:
            kwargs["system"] = system

        output_config: dict[str, Any] = {}
        if self.use_thinking:
            kwargs["thinking"] = {"type": "adaptive"}
            output_config["effort"] = self.effort
        if schema is not None:
            output_config["format"] = {"type": "json_schema", "schema": schema}
        if output_config:
            kwargs["output_config"] = output_config
        # Deliberately no `temperature` — Claude 4.x returns 400 if sent.

        resp = await self._client.messages.create(**kwargs)
        if getattr(resp, "stop_reason", None) == "refusal":
            log.warning("anthropic: request refused (stop_details=%s)",
                        getattr(resp, "stop_details", None))
            return ""
        return "".join(b.text for b in resp.content
                       if getattr(b, "type", None) == "text")

    async def health(self) -> bool:
        # Cheap local check — /links polls this; don't burn an API request.
        return bool(self._api_key)

    async def list_models(self) -> list[str]:
        # The configured role roster; avoids a Models API round-trip.
        return self._roster


def make_backend(cfg):
    """Factory: pick the backend from CONFIG.llm_provider."""
    provider = (getattr(cfg, "llm_provider", "openai") or "openai").lower()
    if provider == "anthropic":
        log.info("LLM backend: anthropic (oracle=%s swarm=%s chat=%s)",
                 cfg.oracle_model, cfg.swarm_model, cfg.chat_model)
        return AnthropicBackend(cfg)
    log.info("LLM backend: openai-compatible (model=%s @ %s)", cfg.llm_model, cfg.llm_base_url)
    return OpenAICompatBackend(cfg)
