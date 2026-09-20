"""THE CONTRACT between the AI module and the rest of the app (Pydantic v2).

Agree these shapes with your backend teammate early. The backend maps its SQL
rows into `SprintSnapshot` / `ProjectState`; the frontend consumes the *Result
models. As long as these hold, you can build against synthetic data without
waiting for the real database.
"""
from __future__ import annotations

from typing import Literal, Optional
from pydantic import BaseModel, Field


# --------------------------- inputs ---------------------------
class SprintSnapshot(BaseModel):
    """One project's EVM state at the end of one sprint."""
    sprint_number: int = Field(..., ge=1)
    total_sprints: int = Field(..., ge=1)
    bac: float = Field(..., gt=0, description="Budget At Completion")
    planned_pct: float = Field(..., ge=0, le=1.2)
    actual_pct: float = Field(..., ge=0, le=1.2)
    ac: float = Field(..., ge=0, description="Actual Cost incurred so far")
    # quality inputs (Jira-derived per the project spec)
    code_coverage: float = Field(0.8, ge=0, le=1)
    bug_severity_score: float = Field(0.2, ge=0, le=1)
    tech_debt: float = Field(0.2, ge=0, le=1)


class ProjectState(BaseModel):
    """A project plus its sprint history (oldest -> newest)."""
    project_id: str = "demo"
    name: str = "Demo Project"
    history: list[SprintSnapshot]


# --------------------------- outputs ---------------------------
class ForecastResult(BaseModel):
    predicted_final_cpi: float
    predicted_final_spi: float
    projected_cpi_series: list[float]   # forward projection for charts
    projected_spi_series: list[float]
    source: Literal["model", "heuristic"]


class CostPrediction(BaseModel):
    predicted_eac: float                # Estimate At Completion ($)
    overrun_ratio: float                # EAC / BAC ; >1 = over budget
    overrun_pct: float                  # (overrun_ratio - 1) * 100
    source: Literal["model", "heuristic"]


class DelayPrediction(BaseModel):
    predicted_delay_sprints: float
    predicted_delay_pct: float
    source: Literal["model", "heuristic"]


class SuccessPrediction(BaseModel):
    label: Literal["on_track", "at_risk", "critical"]
    probabilities: dict[str, float]
    source: Literal["model", "heuristic"]


class PredictionBundle(BaseModel):
    """Everything the ML layer knows, fed straight into the GenAI layer."""
    current_evm: dict
    forecast: ForecastResult
    cost: CostPrediction
    delay: DelayPrediction
    success: SuccessPrediction


# --------------------------- GenAI ---------------------------
class InsightResponse(BaseModel):
    summary: str
    risks: list[str]
    recommendations: list[str]
    source: Literal["llm", "rule_based"]


class ChatRequest(BaseModel):
    question: str
    project: ProjectState


class ChatResponse(BaseModel):
    answer: str
    source: Literal["llm", "rule_based"]
