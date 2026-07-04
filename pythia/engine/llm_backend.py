"""Pluggable LLM backend for the Oracle.

Keeps Ollama/OpenAI-compatible HTTP as the default (offline, free) and adds a
native Anthropic (Claude) backend behind the same `complete()` interface.

Design goal: `Oracle` should not know which provider it's talking to. It builds
OpenAI-style message lists (role: system/user/assistant) and calls
`backend.complete(...)`. Each backend adapts as needed.

Provider is chosen by CONFIG.llm_provider:
  - "openai"  -> OpenAICompatBackend  (Ollama, LM Studio, OpenAI, any /chat/completions)
  - "anthropic" -> AnthropicBackend   (Claude via the Messages API)

Claude-specific notes baked in here so callers don't have to care:
  * NO temperature/top_p/top_k — Claude 4.x (Opus 4.8, Sonnet 5, Fable 5) reject
    sampling params with a 400. We simply never send them.
  * Adaptive thinking + effort give the forecast-reasoning quality; on by default.
  * Structured outputs (output_config.format) guarantee schema-valid JSON, which
    lets the Oracle delete its brittle brace-scanning fallback on this path.
  * Prompt caching marks the (large, shared) world-snapshot prefix cacheable so
    the swarm's re-scoring calls reuse it within a cycle (~30% cheaper).
"""
from __future__ import annotations

import logging
from typing import Any, Optional

import httpx

log = logging.getLogger("pythia.llm")


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
                       model: str | None = None, schema: dict | None = None,
                       cache: bool = False) -> str:
        # schema/cache are Claude-only hints; ignored here (best-effort JSON prompt still works).
        body: dict[str, Any] = {
            "model": model or self.default_model,
            "messages": messages,
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
def _split_system(messages: list[dict]) -> tuple[str, list[dict]]:
    """OpenAI puts `system` in the message list; Anthropic wants it as a top-level
    param. Pull all system turns into one string; map the rest to user/assistant."""
    system_parts: list[str] = []
    convo: list[dict] = []
    for m in messages:
        role = m.get("role")
        content = str(m.get("content", ""))
        if role == "system":
            system_parts.append(content)
        else:
            convo.append({"role": "assistant" if role == "assistant" else "user",
                          "content": content})
    if not convo:  # Anthropic requires a first user turn
        convo = [{"role": "user", "content": ""}]
    return "\n\n".join(system_parts), convo


class AnthropicBackend:
    supports_schema = True

    def __init__(self, cfg) -> None:
        from anthropic import AsyncAnthropic  # lazy import: only needed if provider=anthropic
        self._client = AsyncAnthropic(api_key=cfg.anthropic_api_key)
        self.default_model = cfg.oracle_model
        self.effort = cfg.effort
        self.use_thinking = cfg.use_thinking
        self.use_caching = cfg.use_prompt_caching
        self.min_output_tokens = cfg.min_output_tokens  # thinking eats output budget

    async def complete(self, messages: list[dict], max_tokens: int = 900,
                       model: str | None = None, schema: dict | None = None,
                       cache: bool = False) -> str:
        system, convo = _split_system(messages)
        # Give thinking room: adaptive thinking tokens count as output.
        out_tokens = max(max_tokens, self.min_output_tokens) if self.use_thinking else max_tokens

        kwargs: dict[str, Any] = {
            "model": model or self.default_model,
            "max_tokens": out_tokens,
            "messages": convo,
        }
        # System block — cache it when asked so the swarm reuses the prefix in-cycle.
        if system:
            if cache and self.use_caching:
                kwargs["system"] = [{"type": "text", "text": system,
                                     "cache_control": {"type": "ephemeral"}}]
            else:
                kwargs["system"] = system

        output_config: dict[str, Any] = {}
        if self.use_thinking:
            kwargs["thinking"] = {"type": "adaptive"}
            output_config["effort"] = self.effort
        if schema is not None:
            output_config["format"] = {"type": "json_schema", "schema": schema}
        if output_config:
            kwargs["output_config"] = output_config
        # NOTE: deliberately no `temperature` — Claude 4.x returns 400 if sent.

        resp = await self._client.messages.create(**kwargs)
        return "".join(b.text for b in resp.content if getattr(b, "type", None) == "text")

    async def health(self) -> bool:
        return bool(getattr(self._client, "api_key", None) or True)

    async def list_models(self) -> list[str]:
        # Static role roster; avoids a Models API round-trip on the status endpoint.
        return sorted({self.default_model})


def make_backend(cfg):
    """Factory: pick the backend from CONFIG.llm_provider."""
    provider = (getattr(cfg, "llm_provider", "openai") or "openai").lower()
    if provider == "anthropic":
        log.info("LLM backend: anthropic (oracle=%s)", cfg.oracle_model)
        return AnthropicBackend(cfg)
    log.info("LLM backend: openai-compatible (model=%s @ %s)", cfg.llm_model, cfg.llm_base_url)
    return OpenAICompatBackend(cfg)
