"""Shared feature engineering. BOTH training and serving call this, so the
model never sees a different feature layout than it was trained on
(prevents train/serve skew — a classic silent bug)."""
from __future__ import annotations

import numpy as np

from .evm import compute_evm

# Canonical feature order. Persisted with each model; do not reorder casually.
FEATURE_NAMES = [
    "cpi_now",
    "spi_now",
    "qpi_now",
    "percent_complete",
    "planned_pct",
    "schedule_ratio",   # actual_pct / planned_pct
    "cpi_slope",        # trend of CPI across sprints so far
    "spi_slope",
    "sprint_ratio",     # sprint_number / total_sprints
    "cpi_times_spi",    # critical-ratio, correlates with EAC method
]


def _slope(values: list[float]) -> float:
    """Least-squares slope of a short series; 0 if <2 points."""
    n = len(values)
    if n < 2:
        return 0.0
    x = np.arange(n, dtype=float)
    y = np.asarray(values, dtype=float)
    return float(np.polyfit(x, y, 1)[0])


def build_features(history: list[dict]) -> dict:
    """history: list of snapshot dicts (oldest -> newest), each with keys
    sprint_number, total_sprints, bac, planned_pct, actual_pct, ac,
    code_coverage, bug_severity_score, tech_debt.
    Returns a dict keyed by FEATURE_NAMES computed at the latest snapshot."""
    cpis, spis = [], []
    latest_evm = None
    for snap in history:
        evm = compute_evm(
            bac=snap["bac"],
            planned_pct=snap["planned_pct"],
            actual_pct=snap["actual_pct"],
            ac=snap["ac"],
            code_coverage=snap.get("code_coverage", 0.8),
            bug_severity_score=snap.get("bug_severity_score", 0.2),
            tech_debt=snap.get("tech_debt", 0.2),
        )
        cpis.append(evm.cpi)
        spis.append(evm.spi)
        latest_evm = evm

    last = history[-1]
    schedule_ratio = last["actual_pct"] / last["planned_pct"] if last["planned_pct"] else 1.0
    return {
        "cpi_now": latest_evm.cpi,
        "spi_now": latest_evm.spi,
        "qpi_now": latest_evm.qpi,
        "percent_complete": last["actual_pct"],
        "planned_pct": last["planned_pct"],
        "schedule_ratio": schedule_ratio,
        "cpi_slope": _slope(cpis),
        "spi_slope": _slope(spis),
        "sprint_ratio": last["sprint_number"] / last["total_sprints"],
        "cpi_times_spi": latest_evm.cpi * latest_evm.spi,
    }


def features_to_vector(feat: dict) -> list[float]:
    return [feat[name] for name in FEATURE_NAMES]
