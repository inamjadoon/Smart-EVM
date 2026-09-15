

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, validator
from typing import Optional, List

from evm_service import (
    calculate_and_save_evm,
    get_evm_history,
    recalculate_task_qpi,
)

router = APIRouter(
    prefix="/evm",
    tags=["EVM Calculator"],
)




class EVMCalculateRequest(BaseModel):
    """Optional body when triggering EVM calculation."""
    budget_per_point: float = Field(
        default=100.0,
        gt=0,
        description="Monetary value of one story point. Default = 100.",
    )
    save_snapshot: bool = Field(
        default=True,
        description="If true, saves result to EVM_History table.",
    )


class QPIRequest(BaseModel):
    """Body for QPI recalculation endpoint."""
    critical_bugs   : int   = Field(default=0, ge=0)
    major_bugs      : int   = Field(default=0, ge=0)
    minor_bugs      : int   = Field(default=0, ge=0)
    code_coverage   : float = Field(default=0.0, ge=0.0, le=100.0)
    tech_debt_hours : float = Field(default=0.0, ge=0.0)


class SprintSummary(BaseModel):
    sprint_id     : int
    sprint_no     : int
    sprint_name   : Optional[str]
    planned_value : float
    earned_value  : float
    spi           : float
    total_tasks   : int
    done_tasks    : int
    total_points  : int
    done_points   : int


class EVMResponse(BaseModel):
    project_id                : int
    project_name              : Optional[str]
    total_budget              : float
    total_pv                  : float
    total_ev                  : float
    total_ac                  : float
    cpi                       : float
    spi                       : float
    qpi                       : Optional[float]
    ai_prediction_eac         : float
    ai_variance_at_completion : float
    done_story_points         : int
    budget_per_point          : float
    sprint_count              : int
    task_count                : int
    health                    : str
    snapshot_saved            : bool
    sprint_breakdown          : List[SprintSummary]


class EVMHistoryItem(BaseModel):
    history_id                : int
    project_id                : int
    snapshot_date             : Optional[str]
    total_pv                  : Optional[float]
    total_ev                  : Optional[float]
    total_ac                  : Optional[float]
    cpi                       : Optional[float]
    spi                       : Optional[float]
    qpi                       : Optional[float]
    ai_prediction_eac         : Optional[float]
    ai_variance_at_completion : Optional[float]


class QPIResponse(BaseModel):
    task_id    : int
    new_qpi    : float
    message    : str




@router.post(
    "/calculate/{project_id}",
    response_model=EVMResponse,
    summary="Calculate EVM for a project",
    description=(
        "Fetches all sprints, tasks, and metrics for the given project, "
        "computes PV, EV, AC, CPI, SPI, QPI, EAC, VAC, and optionally "
        "saves a snapshot to EVM_History. "
        "Uses Agile/Scrum story-point based EVM."
    ),
)
def calculate_evm(project_id: int, body: EVMCalculateRequest = EVMCalculateRequest()):
    """
    Run EVM calculation for a project.

    - **project_id**: ID from the Projects table.
    - **budget_per_point**: How much 1 story point costs (default 100).
    - **save_snapshot**: Whether to persist result to EVM_History.
    """
    result = calculate_and_save_evm(
        project_id       = project_id,
        budget_per_point = body.budget_per_point,
        save_snapshot    = body.save_snapshot,
    )

    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])

    return result


@router.get(
    "/calculate/{project_id}",
    response_model=EVMResponse,
    summary="Quick EVM summary (GET, no save)",
    description="Same as POST but uses default settings and does NOT save a snapshot.",
)
def get_evm_summary(
    project_id: int,
    budget_per_point: float = Query(default=100.0, gt=0),
):
    """
    Quick EVM read without saving a snapshot.
    Useful for dashboards that refresh frequently.
    """
    result = calculate_and_save_evm(
        project_id       = project_id,
        budget_per_point = budget_per_point,
        save_snapshot    = False,
    )

    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])

    return result


@router.get(
    "/history/{project_id}",
    response_model=List[EVMHistoryItem],
    summary="Get EVM history snapshots for a project",
    description="Returns all saved EVM snapshots ordered newest-first.",
)
def evm_history(project_id: int):
    """
    Retrieve all historical EVM snapshots for a project.
    Ordered by snapshot_date descending (most recent first).
    """
    history = get_evm_history(project_id)
    if history is None:
        raise HTTPException(status_code=500, detail="Database error retrieving history")
    return history


@router.post(
    "/qpi/{task_id}",
    response_model=QPIResponse,
    summary="Recalculate QPI for a task",
    description=(
        "Re-runs the QPI formula for a single task based on updated bug counts "
        "and coverage, then updates the Metrics row in the database."
    ),
)
def recalculate_qpi(task_id: int, body: QPIRequest):
    """
    Recalculate Quality Performance Index (QPI) for one task.

    - Penalties: critical bug = -10, major = -5, minor = -2
    - Bonus: code coverage contributes up to +20 points
    - Penalty: tech debt hours / 5 subtracted
    - Result clamped between 0 and 100
    """
    new_qpi = recalculate_task_qpi(
        task_id         = task_id,
        critical_bugs   = body.critical_bugs,
        major_bugs      = body.major_bugs,
        minor_bugs      = body.minor_bugs,
        code_coverage   = body.code_coverage,
        tech_debt_hours = body.tech_debt_hours,
    )
    return QPIResponse(
        task_id = task_id,
        new_qpi = new_qpi,
        message = f"QPI updated to {new_qpi} for task {task_id}",
    )
