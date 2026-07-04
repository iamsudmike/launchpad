"""Central configuration for the PYTHIA oracle (Osiris world data -> LLM -> predictions)."""
from __future__ import annotations

import os
import ssl
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(_ROOT / ".env", override=False)

# httpx defaults its CA bundle to certifi, which fails to load under some OpenSSL 3
# setups (X509: NO_CERTIFICATE_OR_CRL_FOUND) and 500s every request. The system
# trust store loads fine, so use it — this keeps full TLS verification on.
try:
    HTTPX_VERIFY: "ssl.SSLContext | bool" = ssl.create_default_context()
except Exception:  # noqa: BLE001 — fall back to httpx's default if the system store is unavailable
    HTTPX_VERIFY = True

# Reuse MiroFish's local LLM as the oracle's brain unless overridden in pythia/.env.
_MIROFISH_DIR = Path(os.environ.get("MIROFISH_DIR", str(Path.home() / "MiroFish")))


def _mirofish_env() -> dict:
    out: dict[str, str] = {}
    p = _MIROFISH_DIR / ".env"
    if p.exists():
        for line in p.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                out[k.strip()] = v.strip()
    return out


_MF = _mirofish_env()


def _i(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


def _f(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


def _b(name: str, default: bool) -> bool:
    return os.environ.get(name, str(default)).strip().lower() in ("1", "true", "yes", "on")


@dataclass
class Config:
    root: Path = _ROOT
    runs_dir: Path = _ROOT / "runs"

    osiris_url: str = field(default_factory=lambda: os.environ.get("OSIRIS_URL", "http://localhost:3000"))
    engine_host: str = field(default_factory=lambda: os.environ.get("ENGINE_HOST", "0.0.0.0"))
    engine_port: int = field(default_factory=lambda: _i("ENGINE_PORT", 8088))

    # ── API security ──
    # Shared secret required on mutating endpoints (/model, /swarm/model, /predict,
    # /chat, /loop). Empty = none. When empty AND the engine is bound to a
    # non-loopback host, remote mutating requests are refused (fail-closed once
    # exposed). Set this whenever the engine is reachable beyond localhost.
    api_token: str = field(default_factory=lambda: os.environ.get("PYTHIA_API_TOKEN", ""))
    # Browser origins allowed to call the API (CSRF / drive-by protection).
    # Defaults to the local Osiris UI only — NOT wide open.
    cors_origins: list[str] = field(default_factory=lambda: [
        o.strip() for o in os.environ.get(
            "CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
        ).split(",") if o.strip()
    ])

    # ── Oracle LLM (defaults to MiroFish's configured local model) ──
    llm_base_url: str = field(default_factory=lambda: os.environ.get("LLM_BASE_URL") or _MF.get("LLM_BASE_URL") or "http://localhost:11434/v1")
    llm_api_key: str = field(default_factory=lambda: os.environ.get("LLM_API_KEY") or _MF.get("LLM_API_KEY") or "ollama")
    llm_model: str = field(default_factory=lambda: os.environ.get("LLM_MODEL") or _MF.get("LLM_MODEL_NAME") or "llama3.1")
    temperature: float = field(default_factory=lambda: _f("ORACLE_TEMPERATURE", 0.5))
    request_timeout: int = field(default_factory=lambda: _i("ORACLE_TIMEOUT_SEC", 180))

    # ── Backend selection ──
    # "openai"    = Ollama / LM Studio / OpenAI-compatible /chat/completions (default, offline)
    # "anthropic" = Claude via the Messages API (opt-in quality boost)
    llm_provider: str = field(default_factory=lambda: (os.environ.get("LLM_PROVIDER") or "openai").lower())
    httpx_verify: object = field(default_factory=lambda: HTTPX_VERIFY)

    # ── Claude (only used when llm_provider == "anthropic") ──
    anthropic_api_key: str = field(default_factory=lambda: os.environ.get("ANTHROPIC_API_KEY", ""))
    oracle_model: str = field(default_factory=lambda: os.environ.get("ORACLE_MODEL", "claude-opus-4-8"))
    swarm_model: str = field(default_factory=lambda: os.environ.get("SWARM_MODEL", "claude-haiku-4-5"))
    chat_model: str = field(default_factory=lambda: os.environ.get("CHAT_MODEL", "claude-haiku-4-5"))
    # Optional daily "deep reading" — OFF by default: Fable 5 requires 30-day data
    # retention, which conflicts with Pythia's offline/private ethos. Opt in knowingly.
    deep_model: str = field(default_factory=lambda: os.environ.get("DEEP_MODEL", ""))
    effort: str = field(default_factory=lambda: os.environ.get("ORACLE_EFFORT", "high"))
    use_thinking: bool = field(default_factory=lambda: _b("ORACLE_THINKING", True))
    use_prompt_caching: bool = field(default_factory=lambda: _b("ORACLE_CACHE", True))
    # Floor for max output tokens when thinking is on (thinking bills as output).
    min_output_tokens: int = field(default_factory=lambda: _i("ORACLE_MIN_OUTPUT_TOKENS", 8000))

    # ── Prediction behaviour ──
    horizons: list[str] = field(default_factory=lambda: [h.strip() for h in os.environ.get("HORIZONS", "24h,week,month,year").split(",") if h.strip()])
    predictions_per_horizon: int = field(default_factory=lambda: _i("PREDICTIONS_PER_HORIZON", 3))
    loop_interval_sec: int = field(default_factory=lambda: _i("LOOP_INTERVAL_SEC", 900))
    sense_interval_sec: int = field(default_factory=lambda: _i("SENSE_INTERVAL_SEC", 180))

    # ── Swarm (a council of LLM personas deliberates each forecast) ──
    swarm_enabled: bool = field(default_factory=lambda: _b("SWARM_ENABLED", True))

    def summary(self) -> dict:
        out = {
            "osiris_url": self.osiris_url,
            "llm_provider": self.llm_provider,
            "llm_base_url": self.llm_base_url,
            "llm_model": self.llm_model,
            "horizons": self.horizons,
            "loop_interval_sec": self.loop_interval_sec,
        }
        if self.llm_provider == "anthropic":
            out.update(oracle_model=self.oracle_model, swarm_model=self.swarm_model,
                       chat_model=self.chat_model, effort=self.effort)
        return out


CONFIG = Config()
CONFIG.runs_dir.mkdir(exist_ok=True)
