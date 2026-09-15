
from pydantic import BaseModel, Field, ConfigDict, validator
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional

from jira_importer import import_from_jira, AVAILABLE_PUBLIC_PROJECTS

from crud_service import (
    create_role, get_roles, update_role, delete_role,
    create_user, get_users, update_user, delete_user,
    create_project, get_projects, update_project, delete_project,
    create_sprint, get_sprints, update_sprint, delete_sprint,
    create_task, get_tasks, update_task, delete_task,
    create_metric, get_metrics, delete_metric,
    create_history, get_history, delete_history,
)
from projects_crud import get_project_by_id
from evm_router import router as evm_router
from ml_rout import router as ml_router


app = FastAPI(
    title       = "SmartEVM API",
    description = (
        "Automated Project Governance System using Earned Value Management.\n\n"
        "**Quick Start:**\n"
        "1. `POST /projects` — create a project, get project_id\n"
        "2. `POST /import/jira/{project_id}` — pull 50 live JIRA issues into PostgreSQL\n"
        "3. `POST /evm/calculate/{project_id}` — compute EVM metrics\n"
        "4. `GET  /evm/history/{project_id}` — view data for ML predictions"
    ),
    version     = "2.0.0",
)
# AI CONNECTION
from genai_rout import router as genai_router
app.include_router(genai_router)


app.add_middleware(
    CORSMiddleware,
    allow_origins     = [
        "http://localhost:8080",
        "http://localhost:8080/",
        "http://127.0.0.1:8080",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ],
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)

app.include_router(evm_router)
app.include_router(ml_router)



class RoleCreate(BaseModel):
    model_config = ConfigDict(json_schema_extra={"example": {"role_name": "Project Manager"}})
    role_name: str = Field(..., min_length=1, max_length=60)

class RoleUpdate(BaseModel):
    model_config = ConfigDict(json_schema_extra={"example": {"role_name": "Team Lead"}})
    role_name: str = Field(..., min_length=1, max_length=60)

class UserCreate(BaseModel):
    model_config = ConfigDict(json_schema_extra={
        "example": {"username": "dev_hamza", "password_hash": "hashed_password_here", "role_id": 1}
    })
    username     : str           = Field(..., min_length=1, max_length=100)
    password_hash: str           = Field(..., min_length=8, max_length=255)
    role_id      : Optional[int] = None

class UserUpdate(UserCreate):
    model_config = ConfigDict(json_schema_extra={
        "example": {"username": "dev_hamza_updated", "password_hash": "new_hash_here", "role_id": 2}
    })

from datetime import date, datetime

class ProjectCreate(BaseModel):
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "project_name": "My EVM Project",
            "total_budget": 150000,
            "start_date"  : "2025-01-01",
            "end_date"    : "2025-06-30",
            "manager_id"  : 1
        }
    })
    project_name: str             = Field(..., min_length=1, max_length=150)
    total_budget: Optional[float] = None
    start_date  : Optional[str]   = None
    end_date    : Optional[str]   = None
    manager_id  : Optional[int]   = None

    @validator("end_date")
    def end_date_must_be_valid(cls, end_date_str, values):
        if end_date_str is None:
            return end_date_str

        end_dt = datetime.strptime(end_date_str, "%Y-%m-%d").date()

        if end_dt < date.today():
            raise ValueError("end_date cannot be in the past")

        start_date_str = values.get("start_date")
        if start_date_str:
            start_dt = datetime.strptime(start_date_str, "%Y-%m-%d").date()
            if end_dt < start_dt:
                raise ValueError("end_date cannot be before start_date")

        return end_date_str

class ProjectUpdate(ProjectCreate):
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "project_name": "My EVM Project Updated",
            "total_budget": 200000,
            "start_date"  : "2025-01-01",
            "end_date"    : "2025-12-31",
            "manager_id"  : 1
        }
    })

class SprintCreate(BaseModel):
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "project_id"   : 1,
            "sprint_no"    : 1,
            "sprint_name"  : "Sprint 1 - Foundation",
            "start_date"   : "2025-01-01",
            "end_date"     : "2025-01-14",
            "planned_value": 50000
        }
    })
    project_id   : int             = Field(..., ge=1)
    sprint_no    : int             = Field(..., ge=1)
    sprint_name  : Optional[str]   = None
    start_date   : Optional[str]   = None
    end_date     : Optional[str]   = None
    planned_value: Optional[float] = None

class SprintUpdate(SprintCreate):
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "project_id"   : 1,
            "sprint_no"    : 1,
            "sprint_name"  : "Sprint 1 - Updated",
            "start_date"   : "2025-01-01",
            "end_date"     : "2025-01-21",
            "planned_value": 60000
        }
    })

class TaskCreate(BaseModel):
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "sprint_id"       : 1,
            "assigned_to"     : 1,
            "external_id"     : "JRASERVER-42",
            "task_description": "Fix login page bug",
            "status"          : "To Do",
            "story_points"    : 5
        }
    })
    sprint_id       : int           = Field(..., ge=1)
    assigned_to     : Optional[int] = None
    external_id     : Optional[str] = None
    task_description: Optional[str] = None
    status          : str           = Field(default="To Do")
    story_points    : int           = Field(default=0, ge=0)

class TaskUpdate(TaskCreate):
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "sprint_id"       : 1,
            "assigned_to"     : 2,
            "external_id"     : "JRASERVER-42",
            "task_description": "Fix login page bug - updated",
            "status"          : "In Progress",
            "story_points"    : 8
        }
    })

class MetricCreate(BaseModel):
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "task_id"        : 1,
            "tester_id"      : 2,
            "critical_bugs"  : 0,
            "major_bugs"     : 1,
            "minor_bugs"     : 2,
            "bug_count"      : 3,
            "code_coverage"  : 85.0,
            "tech_debt_hours": 2.0,
            "calculated_qpi" : 95.0
        }
    })
    task_id        : int            = Field(..., ge=1)
    tester_id      : Optional[int]  = None
    critical_bugs  : int            = Field(default=0, ge=0)
    major_bugs     : int            = Field(default=0, ge=0)
    minor_bugs     : int            = Field(default=0, ge=0)
    bug_count      : int            = Field(default=0, ge=0)
    code_coverage  : Optional[float]= Field(default=85.0, ge=0, le=100)
    tech_debt_hours: Optional[float]= Field(default=2.0,  ge=0)
    calculated_qpi : Optional[float]= Field(default=100.0, ge=0, le=100)

class HistoryCreate(BaseModel):
    model_config = ConfigDict(json_schema_extra={
        "example": {
            "project_id": 1,
            "total_pv"  : 100000,
            "total_ev"  :  85000,
            "total_ac"  :  90000,
            "cpi": 0.94, "spi": 0.85, "qpi": 92.0,
            "ai_prediction_eac": 212765,
            "ai_variance_at_completion": -62765
        }
    })
    project_id                : int
    total_pv                  : Optional[float] = None
    total_ev                  : Optional[float] = None
    total_ac                  : Optional[float] = None
    cpi                       : Optional[float] = None
    spi                       : Optional[float] = None
    qpi                       : Optional[float] = None
    ai_prediction_eac         : Optional[float] = None
    ai_variance_at_completion : Optional[float] = None

class JiraImportBody(BaseModel):
    model_config = ConfigDict(json_schema_extra={
        "example": {"jira_project_key": "JRASERVER"}
    })
    jira_project_key: str = Field(
        default="JRASERVER",
        description="Public JIRA project key. Options: JRASERVER, CONFSERVER, BSERV, BAM"
    )

def _d(val) -> Optional[str]:
    """Convert PostgreSQL date/datetime to ISO string, or return None."""
    return str(val)[:10] if val else None



@app.get("/", tags=["Health"])
def root():
    return {"message": "SmartEVM API is running", "version": "2.0.0",
            "docs": "/docs", "status": "ok"}

@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}


@app.post("/roles", tags=["Roles"], status_code=201)
def api_create_role(body: RoleCreate):
    create_role(body.role_name)
    return {"message": f"Role '{body.role_name}' created"}

@app.get("/roles", tags=["Roles"])
def api_get_roles():
    return [{"role_id": r[0], "role_name": r[1]} for r in (get_roles() or [])]

@app.put("/roles/{role_id}", tags=["Roles"])
def api_update_role(role_id: int, body: RoleUpdate):
    update_role(role_id, body.role_name)
    return {"message": f"Role {role_id} updated"}

@app.delete("/roles/{role_id}", tags=["Roles"])
def api_delete_role(role_id: int):
    delete_role(role_id)
    return {"message": f"Role {role_id} deleted"}


# ─────────────────────────────────────────────
#  USERS
# ─────────────────────────────────────────────

@app.post("/users", tags=["Users"], status_code=201)
def api_create_user(body: UserCreate):
    create_user(body.username, body.password_hash, body.role_id)
    return {"message": f"User '{body.username}' created"}

@app.get("/users", tags=["Users"])
def api_get_users():
    return [{"user_id": r[0], "username": r[1], "role_id": r[3]}
            for r in (get_users() or [])]

@app.put("/users/{user_id}", tags=["Users"])
def api_update_user(user_id: int, body: UserUpdate):
    update_user(user_id, body.username, body.password_hash, body.role_id)
    return {"message": f"User {user_id} updated"}

@app.delete("/users/{user_id}", tags=["Users"])
def api_delete_user(user_id: int):
    delete_user(user_id)
    return {"message": f"User {user_id} deleted"}


@app.post("/projects", tags=["Projects"], status_code=201)
def api_create_project(body: ProjectCreate):
    """
    Create a project. PostgreSQL IDENTITY assigns a unique project_id automatically.
    Use the returned project_id for all subsequent operations.
    """
    try:
        project_id = create_project(
            body.project_name, body.total_budget,
            body.start_date, body.end_date, body.manager_id
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error creating project: {e}")

    if project_id is None:
        raise HTTPException(status_code=500, detail="Failed to create project — check DB connection and logs.")

    return {
        "message"     : "Project created successfully",
        "project_id"  : project_id,
        "project_name": body.project_name,
        "next_step"   : f"POST /import/jira/{project_id} to load JIRA data",
    }

@app.get("/projects", tags=["Projects"])
def api_get_projects():
    """Returns every project stored in PostgreSQL — not hardcoded, real DB rows."""
    rows = get_projects() or []
    return [
        {
            "project_id"  : r[0],
            "project_name": r[1],
            "total_budget": float(r[2]) if r[2] is not None else None,
            "start_date"  : _d(r[3]),
            "end_date"    : _d(r[4]),
            "manager_id"  : r[5],
        }
        for r in rows
    ]

@app.get("/projects/{project_id}", tags=["Projects"])
def api_get_project(project_id: int):
    row = get_project_by_id(project_id)
    if not row:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    return {
        "project_id"  : row[0],
        "project_name": row[1],
        "total_budget": float(row[2]) if row[2] is not None else None,
        "start_date"  : _d(row[3]),
        "end_date"    : _d(row[4]),
        "manager_id"  : row[5],
    }

@app.put("/projects/{project_id}", tags=["Projects"])
def api_update_project(project_id: int, body: ProjectUpdate):
    ok = update_project(project_id, body.project_name, body.total_budget,
                        body.start_date, body.end_date, body.manager_id)
    if not ok:
        raise HTTPException(status_code=500, detail="Update failed — check logs")
    return {"message": f"Project {project_id} updated"}

@app.delete("/projects/{project_id}", tags=["Projects"])
def api_delete_project(project_id: int):
    delete_project(project_id)
    return {"message": f"Project {project_id} and all child data deleted"}




@app.post("/sprints", tags=["Sprints"], status_code=201)
def api_create_sprint(body: SprintCreate):
    sprint_id = create_sprint(body.project_id, body.sprint_no, body.sprint_name,
                               body.start_date, body.end_date, body.planned_value)
    if sprint_id is None:
        raise HTTPException(status_code=500, detail="Failed to create sprint")
    return {"message": "Sprint created", "sprint_id": sprint_id}

@app.get("/sprints", tags=["Sprints"])
def api_get_sprints(project_id: Optional[int] = Query(None)):
    rows = get_sprints(project_id) or []
    return [
        {
            "sprint_id"    : r[0], "project_id"   : r[1],
            "sprint_no"    : r[2], "sprint_name"  : r[3],
            "start_date"   : _d(r[4]),
            "end_date"     : _d(r[5]),
            "planned_value": float(r[6]) if r[6] is not None else None,
        }
        for r in rows
    ]

@app.put("/sprints/{sprint_id}", tags=["Sprints"])
def api_update_sprint(sprint_id: int, body: SprintUpdate):
    update_sprint(sprint_id, body.project_id, body.sprint_no, body.sprint_name,
                  body.start_date, body.end_date, body.planned_value)
    return {"message": f"Sprint {sprint_id} updated"}

@app.delete("/sprints/{sprint_id}", tags=["Sprints"])
def api_delete_sprint(sprint_id: int):
    delete_sprint(sprint_id)
    return {"message": f"Sprint {sprint_id} deleted"}


@app.post("/tasks", tags=["Tasks"], status_code=201)
def api_create_task(body: TaskCreate):
    task_id = create_task(body.sprint_id, body.assigned_to, body.external_id,
                           body.task_description, body.status, body.story_points)
    if task_id is None:
        raise HTTPException(status_code=500, detail="Failed to create task")
    return {"message": "Task created", "task_id": task_id}

@app.get("/tasks", tags=["Tasks"])
def api_get_tasks(sprint_id: Optional[int] = Query(None)):
    rows = get_tasks(sprint_id) or []
    return [
        {
            "task_id"         : r[0], "sprint_id"       : r[1],
            "assigned_to"     : r[2], "external_id"     : r[3],
            "task_description": r[4], "status"          : r[5],
            "story_points"    : r[6],
        }
        for r in rows
    ]

@app.put("/tasks/{task_id}", tags=["Tasks"])
def api_update_task(task_id: int, body: TaskUpdate):
    update_task(task_id, body.sprint_id, body.assigned_to, body.external_id,
                body.task_description, body.status, body.story_points)
    return {"message": f"Task {task_id} updated"}

@app.delete("/tasks/{task_id}", tags=["Tasks"])
def api_delete_task(task_id: int):
    delete_task(task_id)
    return {"message": f"Task {task_id} deleted"}



@app.post("/metrics", tags=["Metrics"], status_code=201)
def api_create_metric(body: MetricCreate):
    metric_id = create_metric(
        body.task_id, body.tester_id,
        body.critical_bugs, body.major_bugs, body.minor_bugs,
        body.bug_count, body.code_coverage,
        body.tech_debt_hours, body.calculated_qpi
    )
    if metric_id is None:
        raise HTTPException(status_code=500, detail="Failed to create metric")
    return {"message": "Metric created", "metric_id": metric_id}

@app.get("/metrics", tags=["Metrics"])
def api_get_metrics(task_id: Optional[int] = Query(None)):
    rows = get_metrics(task_id) or []
    return [
        {
            "metric_id"      : r[0], "task_id"         : r[1],
            "tester_id"      : r[2], "critical_bugs"   : r[3],
            "major_bugs"     : r[4], "minor_bugs"      : r[5],
            "bug_count"      : r[6], "code_coverage"   : r[7],
            "tech_debt_hours": r[8], "calculated_qpi"  : r[9],
        }
        for r in rows
    ]

@app.delete("/metrics/{metric_id}", tags=["Metrics"])
def api_delete_metric(metric_id: int):
    delete_metric(metric_id)
    return {"message": f"Metric {metric_id} deleted"}




@app.post("/history", tags=["EVM History"], status_code=201)
def api_create_history(body: HistoryCreate):
    create_history(body.project_id, body.total_pv, body.total_ev, body.total_ac,
                   body.cpi, body.spi, body.qpi,
                   body.ai_prediction_eac, body.ai_variance_at_completion)
    return {"message": "EVM history row created"}

@app.get("/history", tags=["EVM History"])
def api_get_history():
    rows = get_history() or []
    return [
        {
            "history_id"               : r[0], "project_id"  : r[1],
            "snapshot_date"            : str(r[2]) if r[2] else None,
            "total_pv"                 : r[3],  "total_ev"    : r[4],
            "total_ac"                 : r[5],  "cpi"         : r[6],
            "spi"                      : r[7],  "qpi"         : r[8],
            "ai_prediction_eac"        : r[9],
            "ai_variance_at_completion": r[10],
        }
        for r in rows
    ]

@app.delete("/history/{history_id}", tags=["EVM History"])
def api_delete_history(history_id: int):
    delete_history(history_id)
    return {"message": f"EVM history {history_id} deleted"}



@app.post("/import/jira/{project_id}", tags=["JIRA Import"])
def import_jira(project_id: int, body: JiraImportBody = JiraImportBody()):
    """
    ## Pull live JIRA data into PostgreSQL DB (no account needed)

    Uses Atlassian's public REST API — fetches up to **50 real issues**.

    **Flow:**
    - Tasks found in PostgreSQL → **updated** with fresh JIRA status/points (upsert)
    - Tasks not yet in PostgreSQL → **inserted** as new rows
    - Metrics → created for new tasks, **updated** for existing ones
    - After sync, `GET /tasks` and `GET /metrics` immediately reflect changes

    **Available project keys:** JRASERVER · CONFSERVER · BSERV · BAM

    **Steps:**
    1. `POST /projects` → get project_id
    2. Call this endpoint → data flows into PostgreSQL
    3. `GET /tasks` → confirm data is there
    4. `POST /evm/calculate/{project_id}` → compute EVM
    5. `GET /evm/history/{project_id}` → ML-ready snapshots
    """
    result = import_from_jira(project_id, body.jira_project_key)
    if "error" in result and not result.get("success"):
        raise HTTPException(status_code=400, detail=result["error"])
    return result


class SyncJiraBody(BaseModel):
    project_id: int
    jira_project_key: Optional[str] = "JRASERVER"


@app.post("/sync-jira", tags=["JIRA Import"])
def api_sync_jira(body: SyncJiraBody):
    """
    Sync live Jira issues into PostgreSQL for the given project.
    Matches the frontend call from Project Ledger & Intelligence.
    """
    result = import_from_jira(body.project_id, body.jira_project_key)
    if "error" in result and not result.get("success"):
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@app.get("/ledger/{project_id}", tags=["Project Ledger"])
def get_project_ledger(project_id: int):
    """
    Returns task-level EVM ledger:
    task_id, sprint_no, sprint_name, task_description, status,
    story_points, planned_value, earned_value, actual_cost
    """
    from db_connection import get_connection
    conn = get_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
    try:
        cur = conn.cursor()
        cur.execute("SELECT project_id, project_name FROM Projects WHERE project_id = %s", [project_id])
        proj = cur.fetchone()
        if not proj:
            raise HTTPException(status_code=404, detail=f"Project {project_id} not found")

        cur.execute("""
            SELECT
                t.task_id,
                t.external_id,
                t.task_description,
                t.status,
                t.story_points,
                s.sprint_id,
                s.sprint_no,
                s.sprint_name,
                s.planned_value AS sprint_pv
            FROM Tasks t
            JOIN Sprints s ON t.sprint_id = s.sprint_id
            WHERE s.project_id = %s
            ORDER BY s.sprint_no ASC, t.task_id ASC
        """, [project_id])
        rows = cur.fetchall()

        ledger_items = []
        for r in rows:
            task_id = r[0]
            ext_id = r[1]
            desc = r[2] or "No description"
            if ext_id and not desc.startswith(ext_id):
                desc = f"[{ext_id}] {desc}"
            status = r[3] or "To Do"
            sp = int(r[4] or 0)
            sprint_id = r[5]
            sprint_no = r[6]
            sprint_name = r[7] or f"Sprint {sprint_no}"

            # Baseline monetary valuation ($100 / SP)
            pv = max(50.0, float(sp * 100.0) if sp > 0 else 100.0)

            st_lower = status.strip().lower()
            if st_lower == "done":
                ev = pv
                ac = round(pv * 0.95, 2)
            elif st_lower == "in progress":
                ev = round(pv * 0.5, 2)
                ac = round(pv * 0.65, 2)
            else:
                ev = 0.0
                ac = 0.0

            ledger_items.append({
                "task_id": task_id,
                "task_description": desc,
                "sprint_no": sprint_no,
                "sprint_name": sprint_name,
                "status": status,
                "story_points": sp,
                "planned_value": pv,
                "earned_value": ev,
                "actual_cost": ac,
            })
        return ledger_items
    finally:
        conn.close()

@app.get("/import/status/{project_id}", tags=["JIRA Import"])
def import_status(project_id: int):
    """
    Check how much data is in PostgreSQL for this project.
    Run after importing to confirm everything arrived.
    """
    from db_connection import get_connection
    conn = get_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="DB connection failed")
    try:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM Sprints WHERE project_id=%s", [project_id])
        sprints = cur.fetchone()[0]
        cur.execute("""
            SELECT COUNT(*) FROM Tasks t
            JOIN Sprints s ON t.sprint_id=s.sprint_id
            WHERE s.project_id=%s
        """, [project_id])
        tasks = cur.fetchone()[0]
        cur.execute("""
            SELECT COUNT(*) FROM Metrics m
            JOIN Tasks t ON m.task_id=t.task_id
            JOIN Sprints s ON t.sprint_id=s.sprint_id
            WHERE s.project_id=%s
        """, [project_id])
        metrics = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM EVM_History WHERE project_id=%s", [project_id])
        history = cur.fetchone()[0]
        return {
            "project_id"   : project_id,
            "sprints_in_db": sprints,
            "tasks_in_db"  : tasks,
            "metrics_in_db": metrics,
            "evm_snapshots": history,
            "ready_for_evm": tasks > 0,
            "ready_for_ml" : history > 0,
            "message"      : (
                "Data ready for ML predictions"
                if history > 0
                else "Import JIRA data then call /evm/calculate to generate ML data"
            ),
        }
    finally:
        cur.close()
        conn.close()

@app.get("/import/available-projects", tags=["JIRA Import"])
def available_projects():
    """List all public JIRA project keys you can import from."""
    return {
        "available_projects": AVAILABLE_PUBLIC_PROJECTS,
        "default"           : "JRASERVER",
        "how_to_use"        : 'POST /import/jira/{project_id}  body: {"jira_project_key": "JRASERVER"}',
    }
