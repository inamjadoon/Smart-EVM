"""Central config + paths. Everything else imports from here so the module is
portable when your teammate drops `ai/` into the backend repo."""
from __future__ import annotations

import os
from pathlib import Path

try:
    from dotenv import load_dotenv
    # backend/.env is the single source of truth when present; ai/.env only fills gaps
    # (load_dotenv never overrides a value that is already set).
    load_dotenv(Path(__file__).resolve().parent.parent / "backend" / ".env")
    load_dotenv(Path(__file__).resolve().parent / ".env")
except Exception:  # dotenv is optional
    pass

AI_DIR = Path(__file__).resolve().parent
DATA_DIR = AI_DIR / "data" / "generated"
MODEL_DIR = AI_DIR / "models"
for _d in (DATA_DIR, MODEL_DIR):
    try:
        _d.mkdir(parents=True, exist_ok=True)
    except OSError:  # read-only filesystem (e.g. serverless hosting) — only training scripts write here
        pass

# Generated dataset files
SPRINTS_CSV = DATA_DIR / "sprints.csv"        # one row per (project, sprint)
PROJECTS_CSV = DATA_DIR / "projects.csv"      # one row per project (final outcomes)

# ---- LLM (Groq by default; OpenAI-compatible endpoint so it's swappable) ----
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "groq")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://api.groq.com/openai/v1")
LLM_MODEL = os.getenv("LLM_MODEL", "openai/gpt-oss-20b")
LLM_TIMEOUT = float(os.getenv("LLM_TIMEOUT", "30"))
# Model used only to route questions to agents (a small/fast one with its own rate limit).
LLM_ROUTER_MODEL = os.getenv("LLM_ROUTER_MODEL", "") or LLM_MODEL
# Comma-separated models to fail over to when the main one is rate-limited/unavailable.
# Groq rate limits are per model, so this multiplies free-tier capacity.
LLM_FALLBACK_MODELS = [m.strip() for m in os.getenv("LLM_FALLBACK_MODELS", "").split(",") if m.strip()]
