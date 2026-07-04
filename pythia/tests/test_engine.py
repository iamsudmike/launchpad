import asyncio, json, sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from engine.oracle import Oracle, PREDICTIONS_SCHEMA
from engine.llm_backend import _split_system, _flatten, _to_anthropic_content, make_backend
from engine.config import CONFIG

fails = []
def check(name, cond):
    print(("PASS " if cond else "FAIL ") + name)
    if not cond: fails.append(name)

# ── Oracle() constructs with default (openai) provider — the import-crash bug ──
o = Oracle()
check("Oracle() constructs on default provider", o.backend.__class__.__name__ == "OpenAICompatBackend")
check("oracle.model defaults to local model", o.model == CONFIG.llm_model)

# ── _parse: structured-outputs fast path ──
p1 = {"statement": "X happens", "horizon": "week", "probability": 70,
      "reasoning": "because", "location": "Taiwan Strait", "lat": 24.0, "lng": 119.5}
text_obj = json.dumps({"predictions": [p1]})
r = Oracle._parse(text_obj, "b1")
check("fast path: object envelope", len(r) == 1 and r[0].probability == 0.7 and r[0].horizon == "week")

# bare array also short-circuits
r = Oracle._parse(json.dumps([p1, dict(p1, probability=5)]), "b1")
check("fast path: bare array", len(r) == 2 and r[1].probability == 0.05)

# ── _parse: fallback brace scanner (fenced, prose, trailing junk) ──
messy = "Here you go!\n```json\n[" + json.dumps(p1) + ",\n" + json.dumps(dict(p1, lat=999)) + "]\n```\nHope that helps."
r = Oracle._parse(messy, "b1")
check("fallback: fenced + prose", len(r) == 2)
check("fallback: out-of-range lat nulled", r[1].lat is None)

# probability normalization 0-1 vs 0-100
r = Oracle._parse(json.dumps({"predictions": [dict(p1, probability=0.9)]}), "b1")
check("prob 0-1 passthrough", r[0].probability == 0.9)

# ── _prompt split ──
class FakeBrief:
    event_count = 3; text = "sig1\nsig2"; id = "b9"; domains = {}
snap, instr = o._prompt(FakeBrief())
check("_prompt: snapshot contains brief text", "sig1" in snap and "SNAPSHOT" in snap)
check("_prompt: instructions ask for object envelope", '"predictions"' in instr)

# ── llm_backend helpers ──
msgs = [{"role": "system", "content": "sys A"},
        {"role": "assistant", "content": "prior answer"},
        {"role": "user", "content": [{"type": "text", "text": "big ctx", "cache": True},
                                     {"type": "text", "text": "question"}]}]
system, convo = _split_system(msgs)
check("split: system extracted", system == "sys A")
check("split: leading assistant guarded (first is user)", convo[0]["role"] == "user")
cc = convo[-1]["content"]
check("split: cache hint -> cache_control", cc[0].get("cache_control") == {"type": "ephemeral"})
check("split: plain block has no cache_control", "cache_control" not in cc[1])
check("flatten: blocks join for openai path", _flatten(msgs[2]["content"]) == "big ctx\n\nquestion")

# schema sanity: no unsupported constraints, additionalProperties false everywhere
def walk(s):
    if isinstance(s, dict):
        assert "minimum" not in s and "maxLength" not in s
        if s.get("type") == "object": assert s.get("additionalProperties") is False
        [walk(v) for v in s.values()]
    elif isinstance(s, list): [walk(v) for v in s]
walk(PREDICTIONS_SCHEMA); check("schema: structured-outputs-safe", True)

# ── require_auth policy matrix ──
from engine import server
from fastapi import HTTPException

class FakeReq:
    def __init__(self, host, headers=None):
        self.headers = headers or {}
        self.client = type("C", (), {"host": host})()

async def expect(req, ok):
    try:
        await server.require_auth(req); return ok
    except HTTPException:
        return not ok

async def auth_tests():
    results = []
    # no token, loopback bind -> allowed
    CONFIG.api_token = ""; CONFIG.engine_host = "127.0.0.1"
    results.append(("no token + loopback bind allowed", await expect(FakeReq("10.0.0.5"), True)))
    # no token, exposed bind -> remote refused, local allowed
    CONFIG.engine_host = "0.0.0.0"
    results.append(("no token + exposed: remote refused", await expect(FakeReq("10.0.0.5"), False)))
    results.append(("no token + exposed: localhost allowed", await expect(FakeReq("127.0.0.1"), True)))
    # token set -> required, both header styles work, wrong rejected
    CONFIG.api_token = "s3cret"
    results.append(("token: missing rejected", await expect(FakeReq("127.0.0.1"), False)))
    results.append(("token: x-api-key ok", await expect(FakeReq("10.0.0.5", {"x-api-key": "s3cret"}), True)))
    results.append(("token: bearer ok", await expect(FakeReq("10.0.0.5", {"authorization": "Bearer s3cret"}), True)))
    results.append(("token: wrong rejected", await expect(FakeReq("10.0.0.5", {"x-api-key": "nope"}), False)))
    return results

for name, ok in asyncio.run(auth_tests()):
    check(name, ok)

print("\n%d failures" % len(fails)); sys.exit(1 if fails else 0)
