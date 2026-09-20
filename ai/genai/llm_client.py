"""Provider-agnostic LLM client. Defaults to Groq's OpenAI-compatible endpoint
(free, fast). Swap providers with env vars only — no code change:

    LLM_BASE_URL=https://api.groq.com/openai/v1   LLM_MODEL=llama-3.3-70b-versatile
    (or OpenAI: https://api.openai.com/v1 ; or any OpenAI-compatible gateway)

Uses `requests` so there's no vendor SDK dependency.
"""
from __future__ import annotations

import json
import requests

from ..config import GROQ_API_KEY, LLM_BASE_URL, LLM_MODEL, LLM_TIMEOUT


class LLMUnavailable(RuntimeError):
    """Raised when no key is set or the API call fails; callers fall back."""


def is_configured() -> bool:
    return bool(GROQ_API_KEY)


def chat(messages: list[dict], *, temperature: float = 0.3, max_tokens: int = 700,
         response_json: bool = False) -> str:
    if not GROQ_API_KEY:
        raise LLMUnavailable("No GROQ_API_KEY set")
    payload = {
        "model": LLM_MODEL,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if response_json:
        payload["response_format"] = {"type": "json_object"}
    try:
        r = requests.post(
            f"{LLM_BASE_URL}/chat/completions",
            headers={"Authorization": f"Bearer {GROQ_API_KEY}",
                     "Content-Type": "application/json"},
            data=json.dumps(payload),
            timeout=LLM_TIMEOUT,
        )
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"]
    except Exception as e:  # network, auth, rate-limit, malformed
        raise LLMUnavailable(str(e)) from e
