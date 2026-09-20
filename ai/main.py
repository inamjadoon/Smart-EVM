"""Standalone app so you can develop/demo the AI module WITHOUT the rest of the
backend. Your teammate instead does `app.include_router(ai_router)` in the main
backend app — same router, so behaviour is identical.

Run:  uvicorn ai.main:app --reload --port 8010
Docs: http://127.0.0.1:8010/docs
"""
from __future__ import annotations

from fastapi import FastAPI

from .routers import router as ai_router

app = FastAPI(title="SmartEVM AI Service", version="0.1.0")
app.include_router(ai_router)


@app.get("/")
def root() -> dict:
    return {"service": "smartEVM AI", "docs": "/docs", "health": "/ai/health"}
