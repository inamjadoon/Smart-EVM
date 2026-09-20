"""Tiny load/save layer so training and serving agree on artifact format."""
from __future__ import annotations

from typing import Optional
import joblib

from .config import MODEL_DIR
from .features import FEATURE_NAMES


def save_model(name: str, model, **extra) -> None:
    payload = {"model": model, "features": FEATURE_NAMES, **extra}
    path = MODEL_DIR / f"{name}.joblib"
    joblib.dump(payload, path)
    print(f"  saved -> {path.name}")


def load_model(name: str) -> Optional[dict]:
    path = MODEL_DIR / f"{name}.joblib"
    if not path.exists():
        return None
    return joblib.load(path)
