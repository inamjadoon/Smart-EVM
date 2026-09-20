"""Serving layer: load models once, expose clean functions the FastAPI router
and the GenAI layer call. Every function degrades to a transparent heuristic if
its model file is missing, so a live demo never hard-fails."""
from __future__ import annotations

from functools import lru_cache
import numpy as np

from ..schemas import (
    ProjectState, ForecastResult, CostPrediction, DelayPrediction,
    SuccessPrediction, PredictionBundle,
)
from ..evm import compute_evm
from ..features import build_features, features_to_vector
from ..model_io import load_model


@lru_cache(maxsize=None)
def _model(name: str):
    return load_model(name)


def _history_dicts(project: ProjectState) -> list[dict]:
    return [s.model_dump() for s in project.history]


def _latest_evm(history: list[dict]):
    last = history[-1]
    return compute_evm(last["bac"], last["planned_pct"], last["actual_pct"], last["ac"],
                       code_coverage=last["code_coverage"],
                       bug_severity_score=last["bug_severity_score"],
                       tech_debt=last["tech_debt"])


def forecast(project: ProjectState) -> ForecastResult:
    history = _history_dicts(project)
    feat = build_features(history)
    x = np.array([features_to_vector(feat)])
    art = _model("cpi_spi_forecasting")
    if art:
        cpi_f, spi_f = art["model"].predict(x)[0]
        source = "model"
    else:  # heuristic: assume current efficiency holds
        cpi_f, spi_f = feat["cpi_now"], feat["spi_now"]
        source = "heuristic"

    last = project.history[-1]
    remaining = max(1, last.total_sprints - last.sprint_number)
    cpi_series = list(np.linspace(feat["cpi_now"], cpi_f, remaining + 1)[1:])
    spi_series = list(np.linspace(feat["spi_now"], spi_f, remaining + 1)[1:])
    return ForecastResult(
        predicted_final_cpi=round(float(cpi_f), 4),
        predicted_final_spi=round(float(spi_f), 4),
        projected_cpi_series=[round(float(v), 4) for v in cpi_series],
        projected_spi_series=[round(float(v), 4) for v in spi_series],
        source=source,
    )


def predict_cost(project: ProjectState) -> CostPrediction:
    history = _history_dicts(project)
    feat = build_features(history)
    x = np.array([features_to_vector(feat)])
    bac = project.history[-1].bac
    art = _model("cost_prediction")
    if art:
        overrun = float(art["model"].predict(x)[0]); source = "model"
    else:
        overrun = 1.0 / max(feat["cpi_now"], 0.3); source = "heuristic"  # EAC=BAC/CPI
    return CostPrediction(
        predicted_eac=round(overrun * bac, 2),
        overrun_ratio=round(overrun, 4),
        overrun_pct=round((overrun - 1) * 100, 2),
        source=source,
    )


def predict_delay(project: ProjectState) -> DelayPrediction:
    history = _history_dicts(project)
    feat = build_features(history)
    x = np.array([features_to_vector(feat)])
    total = project.history[-1].total_sprints
    art = _model("delay_prediction")
    if art:
        delay = max(0.0, float(art["model"].predict(x)[0])); source = "model"
    else:
        delay = max(0.0, total * (1.0 / max(feat["spi_now"], 0.3) - 1.0)); source = "heuristic"
    return DelayPrediction(
        predicted_delay_sprints=round(delay, 2),
        predicted_delay_pct=round(delay / total * 100, 2),
        source=source,
    )


def classify_success(project: ProjectState) -> SuccessPrediction:
    history = _history_dicts(project)
    feat = build_features(history)
    x = np.array([features_to_vector(feat)])
    art = _model("success_classification")
    if art:
        model = art["model"]
        proba = model.predict_proba(x)[0]
        probs = {c: round(float(p), 4) for c, p in zip(model.classes_, proba)}
        label = max(probs, key=probs.get)
        return SuccessPrediction(label=label, probabilities=probs, source="model")
    # heuristic
    cpi, spi = feat["cpi_now"], feat["spi_now"]
    if cpi >= 0.95 and spi >= 0.95:
        label = "on_track"
    elif cpi >= 0.85 and spi >= 0.85:
        label = "at_risk"
    else:
        label = "critical"
    return SuccessPrediction(label=label, probabilities={label: 1.0}, source="heuristic")


def predict_all(project: ProjectState) -> PredictionBundle:
    history = _history_dicts(project)
    return PredictionBundle(
        current_evm=_latest_evm(history).as_dict(),
        forecast=forecast(project),
        cost=predict_cost(project),
        delay=predict_delay(project),
        success=classify_success(project),
    )
