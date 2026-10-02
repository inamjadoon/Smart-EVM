"""Vercel entrypoint for the SmartEVM API.

The app lives in backend/fastapi_app.py and uses flat imports (`from db_connection import ...`),
so backend/ is put on the import path first. Locally keep using:  cd backend && uvicorn fastapi_app:app --reload
"""
import os
import sys

_BACKEND = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend")
if _BACKEND not in sys.path:
    sys.path.insert(0, _BACKEND)

from fastapi_app import app  # noqa: E402,F401
