
import os
import logging
from contextlib import asynccontextmanager

from pydantic import BaseModel, Field, ConfigDict, validator, field_validator, model_validator
from fastapi import FastAPI, HTTPException, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import date

from db_connection import get_connection, warm_pool
from auth import (
    router as auth_router, admin_router, team_router,
    get_current_user, require_roles, ensure_auth_schema, ensure_bootstrap_admin, to_app_role,
    ADMIN, MANAGER, DEVELOPER, EDITORS, CONTRIBUTORS,
)
from access import (
    project_ids_for, require_read, require_manage, can_manage_project, project_of_sprint,
    require_task_read, require_task_manage, guard_project_params, invalidate_scope,
    audit, ensure_audit_schema, require_open_project, require_assignable, team_member_ids,
)
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

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(_app):
    # Additive auth migration + bootstrap admin + warm DB pool, before serving traffic.
    ensure_auth_schema()
    ensure_audit_schema()
    ensure_bootstrap_admin()
    warm_pool()
    yield


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
    lifespan    = lifespan,
)

# Any signed-in user; per-endpoint role checks below narrow this further.
AUTHED = [Depends(get_current_user)]
def roles(*allowed):
    return [Depends(require_roles(*allowed))]

# AI CONNECTION
from genai_rout import router as genai_router
app.include_router(genai_router, dependencies=[Depends(guard_project_params)])

# Comma-separated list in CORS_ORIGINS overrides the local dev defaults.
_DEFAULT_ORIGINS = [
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://localhost:4173",      # `vite preview` (production build served locally)
    "http://127.0.0.1:4173",
]
_cors_env = [o.strip().rstrip("/") for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]

app.add_middleware(GZipMiddleware, minimum_size=1024)
app.add_middleware(
    CORSMiddleware,
    allow_origins     = _cors_env or _DEFAULT_ORIGINS,
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)

app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(team_router)
app.include_router(evm_router, dependencies=[Depends(guard_project_params)])
app.include_router(ml_router, dependencies=[Depends(guard_project_params)])



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

def _iso_date(value):
    """'' -> None; otherwise must be a real YYYY-MM-DD date (returned unchanged)."""
    if value is None or (isinstance(value, str) and not value.strip()):
        return None
    try:
        datetime.strptime(str(value).strip(), "%Y-%m-%d")
    except ValueError:
        raise ValueError("dates must be valid and in YYYY-MM-DD format")
    return str(value).strip()


class _DateRange(BaseModel):
    start_date: Optional[str] = None
    end_date  : Optional[str] = None

    _clean_dates = field_validator("start_date", "end_date", mode="before")(lambda cls, v: _iso_date(v))

    @model_validator(mode="after")
    def _end_after_start(self):
        # Past dates are allowed on purpose (historical / imported projects).
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("End date cannot be before the start date.")
        return self


class ProjectCreate(_DateRange):
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
    total_budget: Optional[float] = Field(default=0, ge=0, description="Budget at completion (BAC); 0 if unknown")
    manager_id  : Optional[int]   = None

    @field_validator("project_name")
    @classmethod
    def _name_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Project name is required.")
        return v.strip()

    @field_validator("total_budget", mode="before")
    @classmethod
    def _budget_default(cls, v):
        return 0 if v in (None, "") else v

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

class SprintCreate(_DateRange):
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
    planned_value: Optional[float] = Field(default=0, ge=0)

    @field_validator("planned_value", mode="before")
    @classmethod
    def _pv_default(cls, v):
        return 0 if v in (None, "") else v

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


@app.post("/roles", tags=["Roles"], status_code=201, dependencies=roles(ADMIN))
def api_create_role(body: RoleCreate):
    create_role(body.role_name)
    return {"message": f"Role '{body.role_name}' created"}

@app.get("/roles", tags=["Roles"], dependencies=AUTHED)
def api_get_roles():
    return [{"role_id": r[0], "role_name": r[1]} for r in (get_roles() or [])]

@app.put("/roles/{role_id}", tags=["Roles"], dependencies=roles(ADMIN))
def api_update_role(role_id: int, body: RoleUpdate):
    update_role(role_id, body.role_name)
    return {"message": f"Role {role_id} updated"}

@app.delete("/roles/{role_id}", tags=["Roles"], dependencies=roles(ADMIN))
def api_delete_role(role_id: int):
    delete_role(role_id)
    return {"message": f"Role {role_id} deleted"}


# ─────────────────────────────────────────────
#  USERS
# ─────────────────────────────────────────────

@app.post("/users", tags=["Users"], status_code=201, dependencies=roles(ADMIN))
def api_create_user(body: UserCreate):
    create_user(body.username, body.password_hash, body.role_id)
    return {"message": f"User '{body.username}' created"}

@app.get("/users", tags=["Users"])
def api_get_users(user: dict = Depends(get_current_user)):
    """People for assignee / manager pickers.
    Admin: everyone. Manager: themselves + their team. Developer/Viewer: only themselves."""
    conn = get_connection()
    if not conn:
        raise HTTPException(status_code=503, detail="Database unavailable")
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT u.user_id, u.username, u.role_id, COALESCE(u.full_name, u.username), r.role_name
            FROM Users u LEFT JOIN Roles r ON r.role_id = u.role_id
            WHERE u.is_active AND (%s OR u.user_id = %s OR u.reports_to = %s)
            ORDER BY COALESCE(u.full_name, u.username)
        """, [user["role"] == ADMIN, user["user_id"],
              user["user_id"] if user["role"] == MANAGER else -1])
        rows = cur.fetchall()
    finally:
        conn.close()
    return [{"user_id": r[0], "username": r[1], "role_id": r[2], "full_name": r[3], "role": to_app_role(r[4])}
            for r in rows]

@app.put("/users/{user_id}", tags=["Users"], dependencies=roles(ADMIN))
def api_update_user(user_id: int, body: UserUpdate):
    update_user(user_id, body.username, body.password_hash, body.role_id)
    return {"message": f"User {user_id} updated"}

@app.delete("/users/{user_id}", tags=["Users"], dependencies=roles(ADMIN))
def api_delete_user(user_id: int):
    delete_user(user_id)
    return {"message": f"User {user_id} deleted"}


# ─────────────────────────────────────────────
#  PROJECTS  (Manager: only projects they manage; Admin: all)
# ─────────────────────────────────────────────

def _check_manager_id(user: dict, manager_id: Optional[int]) -> Optional[int]:
    """Managers own what they create; only an Admin can hand a project to someone else."""
    if user["role"] == MANAGER:
        return user["user_id"]
    if manager_id is not None:
        conn = get_connection()
        try:
            cur = conn.cursor()
            cur.execute("SELECT r.role_name FROM Users u LEFT JOIN Roles r ON r.role_id = u.role_id "
                        "WHERE u.user_id = %s AND u.is_active", [manager_id])
            row = cur.fetchone()
        finally:
            conn.close()
        if not row or to_app_role(row[0]) not in EDITORS:
            raise HTTPException(status_code=422, detail="manager_id must be an active Manager or Admin.")
    return manager_id


_PROJECT_SQL = """
    SELECT p.project_id, p.project_name, p.total_budget, p.start_date, p.end_date, p.manager_id,
           COALESCE(p.is_completed, FALSE), p.completed_at,
           (SELECT COALESCE(m.full_name, m.username) FROM Users m WHERE m.user_id = p.manager_id),
           COUNT(t.task_id), COUNT(t.task_id) FILTER (WHERE t.status = 'Done'),
           COALESCE(SUM(t.story_points), 0), COALESCE(SUM(t.story_points) FILTER (WHERE t.status = 'Done'), 0)
    FROM Projects p
    LEFT JOIN Sprints s ON s.project_id = p.project_id
    LEFT JOIN Tasks   t ON t.sprint_id  = s.sprint_id
    WHERE (%s::int IS NULL OR p.project_id = %s::int)
    GROUP BY p.project_id
    ORDER BY COALESCE(p.is_completed, FALSE), p.project_id
"""


def _fetch_projects(project_id: Optional[int] = None) -> list:
    conn = get_connection()
    if not conn:
        raise HTTPException(status_code=503, detail="Database unavailable")
    try:
        cur = conn.cursor()
        cur.execute(_PROJECT_SQL, [project_id, project_id])
        return cur.fetchall()
    finally:
        conn.close()


def _project_json(r) -> dict:
    pts, done_pts = int(r[11] or 0), int(r[12] or 0)
    return {
        "project_id"   : r[0],
        "project_name" : r[1],
        "total_budget" : float(r[2]) if r[2] is not None else None,
        "start_date"   : _d(r[3]),
        "end_date"     : _d(r[4]),
        "manager_id"   : r[5],
        "is_completed" : bool(r[6]),
        "status"       : "Completed" if r[6] else "Active",
        "completed_at" : r[7].isoformat() if r[7] else None,
        "manager_name" : r[8],
        "tasks_total"  : r[9],
        "tasks_done"   : r[10],
        "progress_pct" : round(100 * done_pts / pts, 1) if pts else (100.0 if r[6] else 0.0),
    }


@app.post("/projects", tags=["Projects"], status_code=201)
def api_create_project(body: ProjectCreate, user: dict = Depends(require_roles(*EDITORS))):
    """
    Create a project. PostgreSQL IDENTITY assigns a unique project_id automatically.
    A Manager automatically becomes the project's manager.
    """
    manager_id = _check_manager_id(user, body.manager_id)
    try:
        project_id = create_project(
            body.project_name, body.total_budget,
            body.start_date, body.end_date, manager_id
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error creating project: {e}")

    if project_id is None:
        raise HTTPException(status_code=500, detail="Failed to create project — check DB connection and logs.")
    invalidate_scope()
    audit(user, "project.create", "project", project_id, name=body.project_name, manager_id=manager_id)
    return {
        "message"     : "Project created successfully",
        "project_id"  : project_id,
        "project_name": body.project_name,
        "next_step"   : f"POST /import/jira/{project_id} to load JIRA data",
    }

@app.get("/projects", tags=["Projects"])
def api_get_projects(user: dict = Depends(get_current_user)):
    """Projects the caller may see (Admin/Viewer: all, Manager: managed, Developer: has tasks in)."""
    scope = project_ids_for(user)
    return [_project_json(r) for r in _fetch_projects() if scope is None or r[0] in scope]

@app.get("/projects/{project_id}", tags=["Projects"])
def api_get_project(project_id: int, user: dict = Depends(get_current_user)):
    require_read(user, project_id)
    rows = _fetch_projects(project_id)
    if not rows:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    return _project_json(rows[0])

@app.put("/projects/{project_id}", tags=["Projects"])
def api_update_project(project_id: int, body: ProjectUpdate, user: dict = Depends(require_roles(*EDITORS))):
    require_manage(user, project_id)
    require_open_project(project_id)
    manager_id = _check_manager_id(user, body.manager_id)
    if user["role"] == MANAGER:
        manager_id = user["user_id"]
    try:
        ok = update_project(project_id, body.project_name, body.total_budget,
                            body.start_date, body.end_date, manager_id)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    if not ok:
        raise HTTPException(status_code=500, detail="Update failed — check logs")
    invalidate_scope()
    audit(user, "project.update", "project", project_id, name=body.project_name, manager_id=manager_id)
    return {"message": f"Project {project_id} updated"}

def _set_completed(project_id: int, user: dict, completed: bool) -> dict:
    require_manage(user, project_id)
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT COUNT(t.task_id) FILTER (WHERE t.status <> 'Done')
            FROM Sprints s JOIN Tasks t ON t.sprint_id = s.sprint_id WHERE s.project_id = %s
        """, [project_id])
        open_tasks = cur.fetchone()[0] or 0
        cur.execute("UPDATE Projects SET is_completed = %s, completed_at = CASE WHEN %s THEN CURRENT_TIMESTAMP END "
                    "WHERE project_id = %s", [completed, completed, project_id])
        conn.commit()
    finally:
        conn.close()
    audit(user, "project.complete" if completed else "project.reopen", "project", project_id,
          open_tasks=open_tasks)
    return {**_project_json(_fetch_projects(project_id)[0]), "open_tasks_at_change": open_tasks}


@app.post("/projects/{project_id}/complete", tags=["Projects"])
def api_complete_project(project_id: int, user: dict = Depends(require_roles(*EDITORS))):
    """Mark a project completed. It becomes read-only (no task/sprint changes) until reopened."""
    return _set_completed(project_id, user, True)


@app.post("/projects/{project_id}/reopen", tags=["Projects"])
def api_reopen_project(project_id: int, user: dict = Depends(require_roles(*EDITORS))):
    return _set_completed(project_id, user, False)


@app.delete("/projects/{project_id}", tags=["Projects"])
def api_delete_project(project_id: int, user: dict = Depends(require_roles(ADMIN))):
    delete_project(project_id)
    invalidate_scope()
    audit(user, "project.delete", "project", project_id)
    return {"message": f"Project {project_id} and all child data deleted"}


# ─────────────────────────────────────────────
#  SPRINTS
# ─────────────────────────────────────────────

@app.post("/sprints", tags=["Sprints"], status_code=201)
def api_create_sprint(body: SprintCreate, user: dict = Depends(require_roles(*EDITORS))):
    require_manage(user, body.project_id)
    require_open_project(body.project_id)
    sprint_id = create_sprint(body.project_id, body.sprint_no, body.sprint_name,
                               body.start_date, body.end_date, body.planned_value)
    if sprint_id is None:
        raise HTTPException(status_code=500, detail="Failed to create sprint")
    audit(user, "sprint.create", "sprint", sprint_id, project_id=body.project_id, name=body.sprint_name)
    return {"message": "Sprint created", "sprint_id": sprint_id}

@app.get("/sprints", tags=["Sprints"])
def api_get_sprints(project_id: Optional[int] = Query(None), user: dict = Depends(get_current_user)):
    if project_id is not None:
        require_read(user, project_id)
    scope = project_ids_for(user)
    rows = [r for r in (get_sprints(project_id) or []) if scope is None or r[1] in scope]
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
def api_update_sprint(sprint_id: int, body: SprintUpdate, user: dict = Depends(require_roles(*EDITORS))):
    require_manage(user, project_of_sprint(sprint_id))
    require_manage(user, body.project_id)            # can't move a sprint into someone else's project
    require_open_project(body.project_id)
    update_sprint(sprint_id, body.project_id, body.sprint_no, body.sprint_name,
                  body.start_date, body.end_date, body.planned_value)
    audit(user, "sprint.update", "sprint", sprint_id, project_id=body.project_id)
    return {"message": f"Sprint {sprint_id} updated"}

@app.delete("/sprints/{sprint_id}", tags=["Sprints"])
def api_delete_sprint(sprint_id: int, user: dict = Depends(require_roles(*EDITORS))):
    pid = project_of_sprint(sprint_id)
    require_manage(user, pid)
    require_open_project(pid)
    delete_sprint(sprint_id)
    invalidate_scope()
    audit(user, "sprint.delete", "sprint", sprint_id, project_id=pid)
    return {"message": f"Sprint {sprint_id} deleted"}


# ─────────────────────────────────────────────
#  TASKS  (Developer: own tasks only, status changes only)
# ─────────────────────────────────────────────

class TaskStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(To Do|In Progress|Done)$")


def _task_json(r) -> dict:
    return {
        "task_id"         : r[0], "sprint_id"       : r[1],
        "assigned_to"     : r[2], "external_id"     : r[3],
        "task_description": r[4], "status"          : r[5],
        "story_points"    : r[6],
    }




@app.post("/tasks", tags=["Tasks"], status_code=201)
def api_create_task(body: TaskCreate, user: dict = Depends(require_roles(*EDITORS))):
    pid = project_of_sprint(body.sprint_id)
    require_manage(user, pid)
    require_open_project(pid)
    require_assignable(user, body.assigned_to)
    task_id = create_task(body.sprint_id, body.assigned_to, body.external_id,
                           body.task_description, body.status, body.story_points)
    if task_id is None:
        raise HTTPException(status_code=500, detail="Failed to create task")
    invalidate_scope()
    audit(user, "task.create", "task", task_id, sprint_id=body.sprint_id, assigned_to=body.assigned_to,
          title=(body.task_description or "")[:80])
    return {"message": "Task created", "task_id": task_id}

@app.get("/tasks/mine", tags=["Tasks"])
def api_my_tasks(user: dict = Depends(get_current_user)):
    """The caller's own tasks across all projects, with project/sprint context and due date."""
    conn = get_connection()
    if not conn:
        raise HTTPException(status_code=503, detail="Database unavailable")
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT t.task_id, t.sprint_id, t.assigned_to, t.external_id, t.task_description, t.status,
                   t.story_points, s.sprint_name, s.sprint_no, s.end_date, p.project_id, p.project_name,
                   COALESCE(p.is_completed, FALSE)
            FROM Tasks t
            JOIN Sprints s  ON s.sprint_id  = t.sprint_id
            JOIN Projects p ON p.project_id = s.project_id
            WHERE t.assigned_to = %s
            ORDER BY (t.status = 'Done'), s.end_date NULLS LAST, t.task_id
        """, [user["user_id"]])
        rows = cur.fetchall()
    finally:
        conn.close()
    today = date.today()
    return [{
        **_task_json(r),
        "sprint_name": r[7] or f"Sprint {r[8]}", "due_date": _d(r[9]),
        "project_id": r[10], "project_name": r[11], "project_completed": bool(r[12]),
        "overdue": bool(r[9] and r[5] != "Done" and r[9] < today and not r[12]),
    } for r in rows]

@app.get("/tasks", tags=["Tasks"])
def api_get_tasks(sprint_id: Optional[int] = Query(None), user: dict = Depends(get_current_user)):
    if sprint_id is not None:
        require_read(user, project_of_sprint(sprint_id))
    scope = project_ids_for(user)
    conn = get_connection()
    if not conn:
        raise HTTPException(status_code=503, detail="Database unavailable")
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT t.task_id, t.sprint_id, t.assigned_to, t.external_id, t.task_description, t.status,
                   t.story_points, s.project_id,
                   (SELECT COALESCE(u.full_name, u.username) FROM Users u WHERE u.user_id = t.assigned_to)
            FROM Tasks t JOIN Sprints s ON s.sprint_id = t.sprint_id
            WHERE (%s::int IS NULL OR t.sprint_id = %s::int)
              AND (%s::int IS NULL OR t.assigned_to = %s::int)
            ORDER BY t.task_id
        """, [sprint_id, sprint_id, *(([user["user_id"]] * 2) if user["role"] == DEVELOPER else [None, None])])
        rows = cur.fetchall()
    finally:
        conn.close()
    return [{**_task_json(r), "assignee_name": r[8]} for r in rows if scope is None or r[7] in scope]

@app.put("/tasks/{task_id}", tags=["Tasks"])
def api_update_task(task_id: int, body: TaskUpdate, user: dict = Depends(require_roles(*EDITORS))):
    """Full edit (description, points, assignee, sprint). Developers use PATCH /tasks/{id}/status."""
    before = require_task_manage(user, task_id)
    target_pid = project_of_sprint(body.sprint_id)
    require_manage(user, target_pid)                            # target sprint must be manageable too
    require_open_project(before["project_id"])
    require_open_project(target_pid)
    if body.assigned_to != before["assigned_to"]:
        require_assignable(user, body.assigned_to)
    update_task(task_id, body.sprint_id, body.assigned_to, body.external_id,
                body.task_description, body.status, body.story_points)
    invalidate_scope()
    audit(user, "task.update", "task", task_id, status=body.status, assigned_to=body.assigned_to,
          previous_status=before["status"], previous_assignee=before["assigned_to"])
    return {"message": f"Task {task_id} updated"}

@app.patch("/tasks/{task_id}/status", tags=["Tasks"])
def api_update_task_status(task_id: int, body: TaskStatusUpdate,
                           user: dict = Depends(require_roles(*CONTRIBUTORS))):
    """Move a task between To Do / In Progress / Done.
    Developers: only tasks assigned to them. Managers: tasks in their projects. Admin: any."""
    task = require_task_read(user, task_id)
    if user["role"] != DEVELOPER and not can_manage_project(user, task["project_id"]):
        raise HTTPException(status_code=403, detail="Only the project's manager or an admin can change this task.")
    require_open_project(task["project_id"])
    if task["status"] != body.status:
        conn = get_connection()
        try:
            cur = conn.cursor()
            cur.execute("UPDATE Tasks SET status = %s WHERE task_id = %s", [body.status, task_id])
            conn.commit()
        finally:
            conn.close()
        audit(user, "task.status", "task", task_id, project_id=task["project_id"],
              old=task["status"], new=body.status)
    return {"message": f"Task {task_id} is now {body.status}", "task_id": task_id, "status": body.status}

@app.delete("/tasks/{task_id}", tags=["Tasks"])
def api_delete_task(task_id: int, user: dict = Depends(require_roles(*EDITORS))):
    task = require_task_manage(user, task_id)
    require_open_project(task["project_id"])
    delete_task(task_id)
    invalidate_scope()
    audit(user, "task.delete", "task", task_id, project_id=task["project_id"])
    return {"message": f"Task {task_id} deleted"}


# ─────────────────────────────────────────────
#  METRICS (quality data: managed by Managers/Admins, readable within scope)
# ─────────────────────────────────────────────

@app.post("/metrics", tags=["Metrics"], status_code=201)
def api_create_metric(body: MetricCreate, user: dict = Depends(require_roles(*EDITORS))):
    require_open_project(require_task_manage(user, body.task_id)["project_id"])
    metric_id = create_metric(
        body.task_id, body.tester_id,
        body.critical_bugs, body.major_bugs, body.minor_bugs,
        body.bug_count, body.code_coverage,
        body.tech_debt_hours, body.calculated_qpi
    )
    if metric_id is None:
        raise HTTPException(status_code=500, detail="Failed to create metric")
    audit(user, "metric.create", "task", body.task_id, metric_id=metric_id)
    return {"message": "Metric created", "metric_id": metric_id}

@app.get("/metrics", tags=["Metrics"])
def api_get_metrics(task_id: Optional[int] = Query(None), user: dict = Depends(get_current_user)):
    if task_id is not None:
        require_task_read(user, task_id)
        rows = get_metrics(task_id) or []
    else:
        rows = get_metrics(None) or []
        if user["role"] in (DEVELOPER, MANAGER):
            visible = {t["task_id"] for t in api_get_tasks(None, user)}
            rows = [r for r in rows if r[1] in visible]
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
def api_delete_metric(metric_id: int, user: dict = Depends(require_roles(*EDITORS))):
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT task_id FROM Metrics WHERE metric_id = %s", [metric_id])
        row = cur.fetchone()
    finally:
        conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Metric not found")
    require_open_project(require_task_manage(user, row[0])["project_id"])
    delete_metric(metric_id)
    audit(user, "metric.delete", "task", row[0], metric_id=metric_id)
    return {"message": f"Metric {metric_id} deleted"}


# ─────────────────────────────────────────────
#  EVM HISTORY
# ─────────────────────────────────────────────

@app.post("/history", tags=["EVM History"], status_code=201)
def api_create_history(body: HistoryCreate, user: dict = Depends(require_roles(*EDITORS))):
    require_manage(user, body.project_id)
    create_history(body.project_id, body.total_pv, body.total_ev, body.total_ac,
                   body.cpi, body.spi, body.qpi,
                   body.ai_prediction_eac, body.ai_variance_at_completion)
    return {"message": "EVM history row created"}

@app.get("/history", tags=["EVM History"])
def api_get_history(user: dict = Depends(get_current_user)):
    scope = project_ids_for(user)
    rows = [r for r in (get_history() or []) if scope is None or r[1] in scope]
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

@app.delete("/history/{history_id}", tags=["EVM History"], dependencies=roles(ADMIN))
def api_delete_history(history_id: int):
    delete_history(history_id)
    return {"message": f"EVM history {history_id} deleted"}



@app.post("/import/jira/{project_id}", tags=["JIRA Import"])
def import_jira(project_id: int, body: JiraImportBody = JiraImportBody(),
                user: dict = Depends(require_roles(*EDITORS))):
    """
    ## Pull live JIRA data into PostgreSQL DB (no account needed)

    Uses Atlassian's public REST API — fetches up to **50 real issues**.
    Managers can import only into projects they manage.

    **Available project keys:** JRASERVER · CONFSERVER · BSERV · BAM
    """
    require_manage(user, project_id)
    require_open_project(project_id)
    result = import_from_jira(project_id, body.jira_project_key)
    if "error" in result and not result.get("success"):
        raise HTTPException(status_code=400, detail=result["error"])
    audit(user, "project.jira_import", "project", project_id, key=body.jira_project_key)
    return result


class SyncJiraBody(BaseModel):
    project_id: int
    jira_project_key: Optional[str] = "JRASERVER"


@app.post("/sync-jira", tags=["JIRA Import"])
def api_sync_jira(body: SyncJiraBody, user: dict = Depends(require_roles(*EDITORS))):
    """
    Sync live Jira issues into PostgreSQL for the given project.
    Matches the frontend call from Project Ledger & Intelligence.
    """
    require_manage(user, body.project_id)
    require_open_project(body.project_id)
    result = import_from_jira(body.project_id, body.jira_project_key)
    if "error" in result and not result.get("success"):
        raise HTTPException(status_code=400, detail=result["error"])
    audit(user, "project.jira_import", "project", body.project_id, key=body.jira_project_key)
    return result


@app.get("/ledger/{project_id}", tags=["Project Ledger"])
def get_project_ledger(project_id: int, user: dict = Depends(get_current_user)):
    """
    Returns task-level EVM ledger:
    task_id, sprint_no, sprint_name, task_description, status,
    story_points, planned_value, earned_value, actual_cost
    Developers only see the rows for tasks assigned to them.
    """
    require_read(user, project_id)
    only_user = user["user_id"] if user["role"] == DEVELOPER else None
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
              AND (%s::int IS NULL OR t.assigned_to = %s::int)
            ORDER BY s.sprint_no ASC, t.task_id ASC
        """, [project_id, only_user, only_user])
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
def import_status(project_id: int, user: dict = Depends(get_current_user)):
    """
    Check how much data is in PostgreSQL for this project.
    Run after importing to confirm everything arrived.
    """
    require_read(user, project_id)
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

@app.get("/import/available-projects", tags=["JIRA Import"], dependencies=AUTHED)
def available_projects():
    """List all public JIRA project keys you can import from."""
    return {
        "available_projects": AVAILABLE_PUBLIC_PROJECTS,
        "default"           : "JRASERVER",
        "how_to_use"        : 'POST /import/jira/{project_id}  body: {"jira_project_key": "JRASERVER"}',
    }
