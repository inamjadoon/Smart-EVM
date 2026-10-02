"""Provider-agnostic LLM client. Defaults to Groq's OpenAI-compatible endpoint
(free, fast). Swap providers with env vars only — no code change:

    LLM_BASE_URL=https://api.groq.com/openai/v1   LLM_MODEL=llama-3.3-70b-versatile
    (or OpenAI: https://api.openai.com/v1 ; or any OpenAI-compatible gateway)

Uses `requests` so there's no vendor SDK dependency.
"""
from __future__ import annotations

import json
import threading
import time
from typing import Any, Dict, List, Optional

import requests

from ..config import GROQ_API_KEY, LLM_BASE_URL, LLM_FALLBACK_MODELS, LLM_MODEL, LLM_TIMEOUT

# One HTTP session = reused TLS connection to the provider (saves a handshake per call).
_session = requests.Session()
_RETRY_STATUS = {429, 500, 502, 503, 504}


class LLMUnavailable(RuntimeError):
    """Raised when no key is set or the API call fails; callers fall back."""

    def __init__(self, message: str, *, status: Optional[int] = None):
        super().__init__(message)
        self.status = status


def is_configured() -> bool:
    return bool(GROQ_API_KEY)


def _is_reasoning_model(model: str) -> bool:
    return "gpt-oss" in model          # supports reasoning_effort=low


def chat_completion(messages: List[Dict[str, Any]], *, model: Optional[str] = None,
                    temperature: float = 0.3, max_tokens: int = 700,
                    tools: Optional[List[Dict[str, Any]]] = None,
                    response_json: bool = False, retries: int = 2,
                    failover: bool = True) -> Dict[str, Any]:
    """Low-level call. Returns the assistant message dict (may contain `tool_calls`);
    `_model` says which model answered. When the model is rate-limited or unavailable,
    the next model in LLM_FALLBACK_MODELS is tried immediately."""
    if not GROQ_API_KEY:
        raise LLMUnavailable("No GROQ_API_KEY set")
    chain = [model or LLM_MODEL] + (LLM_FALLBACK_MODELS if failover else [])
    chain = list(dict.fromkeys(chain))
    err: Optional[LLMUnavailable] = None
    for i, m in enumerate(chain):
        try:
            msg = _call(m, messages, temperature, max_tokens, tools, response_json,
                        retries if i == len(chain) - 1 else 0)   # only wait/retry on the last option
            msg["_model"] = m
            return msg
        except LLMUnavailable as e:
            err = e
            if e.status not in (429, 404, 400, 500, 502, 503, 504, None):
                break                                            # 401/403: key problem, same for every model
    raise err or LLMUnavailable("LLM call failed")


def _call(model: str, messages, temperature, max_tokens, tools, response_json, retries) -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if _is_reasoning_model(model):
        # Reasoning models "think" before answering; keep it short so replies are
        # fast and the token budget isn't spent before the actual answer.
        payload["reasoning_effort"] = "low"
    if tools:
        payload["tools"] = tools
        payload["tool_choice"] = "auto"
    if response_json:
        payload["response_format"] = {"type": "json_object"}

    last_err: Optional[LLMUnavailable] = None
    for attempt in range(retries + 1):
        try:
            r = _session.post(
                f"{LLM_BASE_URL}/chat/completions",
                headers={"Authorization": f"Bearer {GROQ_API_KEY}",
                         "Content-Type": "application/json"},
                data=json.dumps(payload),
                timeout=LLM_TIMEOUT,
            )
        except requests.RequestException as e:          # network / timeout
            last_err = LLMUnavailable(f"LLM request failed: {e}")
        else:
            if r.ok:
                try:
                    return r.json()["choices"][0]["message"]
                except Exception as e:
                    raise LLMUnavailable(f"Malformed LLM response: {e}") from e
            try:
                detail = r.json().get("error", {}).get("message", r.text[:200])
            except Exception:
                detail = r.text[:200]
            last_err = LLMUnavailable(f"LLM API {r.status_code}: {detail}", status=r.status_code)
            if r.status_code not in _RETRY_STATUS:
                break                                     # 400/401/403/404: retrying won't help
            retry_after = r.headers.get("retry-after")
            if retry_after and attempt < retries:
                try:
                    time.sleep(min(float(retry_after), 5.0))
                    continue
                except ValueError:
                    pass
        if attempt < retries:
            time.sleep(0.6 * (2 ** attempt))
    raise last_err or LLMUnavailable("LLM call failed")


def chat(messages: list[dict], *, temperature: float = 0.3, max_tokens: int = 700,
         response_json: bool = False, model: Optional[str] = None) -> str:
    """Simple text completion (kept for existing callers)."""
    msg = chat_completion(messages, temperature=temperature, max_tokens=max_tokens,
                          response_json=response_json, model=model)
    content = (msg.get("content") or "").strip()
    if not content:
        raise LLMUnavailable("LLM returned an empty answer")
    return content


# ---- live health check (cached) -------------------------------------------
_health: Dict[str, Any] = {"ts": 0.0, "value": None}
_health_lock = threading.Lock()


def health(ttl: float = 60.0, failure_ttl: float = 10.0) -> Dict[str, Any]:
    """Really pings the provider (tiny request) so the UI can say *why* AI is offline.
    Successes are cached for `ttl`; failures only for `failure_ttl` so a network blip heals fast."""
    with _health_lock:
        cached = _health["value"]
        if cached and time.time() - _health["ts"] < (ttl if cached.get("available") else min(ttl, failure_ttl)):
            return cached
        if not GROQ_API_KEY:
            value = {"available": False, "model": LLM_MODEL,
                     "reason": "No GROQ_API_KEY is configured on the server."}
        else:
            t = time.time()
            try:
                chat_completion([{"role": "user", "content": "ping"}], max_tokens=16, retries=0)
                value = {"available": True, "model": LLM_MODEL,
                         "latency_ms": int((time.time() - t) * 1000)}
            except LLMUnavailable as e:
                value = {"available": False, "model": LLM_MODEL, "http_status": e.status,
                         "reason": describe_error(e)}
        _health.update(ts=time.time(), value=value)
        return value


def describe_error(e: LLMUnavailable) -> str:
    if e.status == 401:
        return "The GROQ_API_KEY was rejected (invalid or revoked). Create a new key at console.groq.com/keys."
    if e.status == 429:
        return "The LLM rate limit was reached; using the built-in analyst until it resets."
    if e.status == 404:
        return f"The model '{LLM_MODEL}' is not available for this API key. Check LLM_MODEL."
    if e.status is None:
        return "Cannot reach the LLM provider (network/DNS problem on the server). Retrying shortly."
    return str(e)


def invalidate_health() -> None:
    """Force the next health() call to re-check (e.g. after a real call failed)."""
    with _health_lock:
        _health["ts"] = 0.0
