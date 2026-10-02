"""
Project-level data scoping + audit log.

Who sees / changes what (enforced on every endpoint, not just in the UI):

  Admin     all projects                         — read + write everything
  Viewer    all projects                         — read only
  Manager   projects they manage (manager_id)    — read + write those projects only
  Developer projects where they have tasks       — read, and ONLY their own tasks;
                                                    the only write is changing the
                                                    status of a task assigned to them

Reads of something outside your scope answer 404 (we don't confirm it exists);
writes you aren't allowed to make answer 403.
"""
from __future__ import annotations

import json
import logging
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, List, Optional, Set

from fastapi import Depends, HTTPException, Request

from auth import ADMIN, DEVELOPER, MANAGER, VIEWER, get_current_user
from db_connection import get_connection

log = logging.getLogger("smartevm.access")


def _rows(sql: str, params: tuple = ()) -> List[tuple]:
    conn = get_connection()
    if not conn:
        raise HTTPException(status_code=503, detail="Database unavailable. Please try again.")
    try:
        cur = conn.cursor()
        cur.execute(sql, params)
        return cur.fetchall()
    finally:
        conn.close()


# ─────────────────────────────────────────────
#  SCOPE
# ─────────────────────────────────────────────

_SCOPE_TTL = 20.0
_scope_cache: Dict[int, tuple] = {}
_scope_lock = threading.Lock()


def invalidate_scope() -> None:
    """Call after anything that changes who can see what (project manager, task assignee...)."""
    with _scope_lock:
        _scope_cache.clear()


def project_ids_for(user: Dict[str, Any]) -> Optional[Set[int]]:
    """Projects the user may read. None means 'all projects'."""
    role = user["role"]
    if role in (ADMIN, VIEWER):
        return None
    uid = user["user_id"]
    hit = _scope_cache.get(uid)
    if hit and hit[0] > time.monotonic() and hit[1] == role:
        return hit[2]
    if role == MANAGER:
        rows = _rows("SELECT project_id FROM Projects WHERE manager_id = %s", (uid,))
    else:   # Developer
        rows = _rows("SELECT DISTINCT s.project_id FROM Tasks t JOIN Sprints s ON s.sprint_id = t.sprint_id "
                     "WHERE t.assigned_to = %s", (uid,))
    ids = {r[0] for r in rows}
    with _scope_lock:
        _scope_cache[uid] = (time.monotonic() + _SCOPE_TTL, role, ids)
    return ids


def can_read_project(user: Dict[str, Any], project_id: int) -> bool:
    ids = project_ids_for(user)
    return ids is None or int(project_id) in ids


def can_manage_project(user: Dict[str, Any], project_id: int) -> bool:
    if user["role"] == ADMIN:
        return True
    if user["role"] == MANAGER:
        return int(project_id) in (project_ids_for(user) or set())
    return False


def require_read(user: Dict[str, Any], project_id: Optional[int]) -> None:
    if project_id is None or not can_read_project(user, project_id):
        raise HTTPException(status_code=404, detail="Project not found.")


def require_manage(user: Dict[str, Any], project_id: Optional[int]) -> None:
    require_read(user, project_id)
    if not can_manage_project(user, project_id):
        raise HTTPException(status_code=403, detail="You can only change projects you manage.")


def project_of_sprint(sprint_id: int) -> Optional[int]:
    rows = _rows("SELECT project_id FROM Sprints WHERE sprint_id = %s", (int(sprint_id),))
    return rows[0][0] if rows else None


def task_info(task_id: int) -> Optional[Dict[str, Any]]:
    rows = _rows("SELECT t.task_id, s.project_id, t.assigned_to, t.status FROM Tasks t "
                 "JOIN Sprints s ON s.sprint_id = t.sprint_id WHERE t.task_id = %s", (int(task_id),))
    if not rows:
        return None
    tid, pid, assignee, st = rows[0]
    return {"task_id": tid, "project_id": pid, "assigned_to": assignee, "status": st}


def can_see_task(user: Dict[str, Any], task: Optional[Dict[str, Any]]) -> bool:
    if not task or not can_read_project(user, task["project_id"]):
        return False
    return user["role"] != DEVELOPER or task["assigned_to"] == user["user_id"]


def require_task_read(user: Dict[str, Any], task_id: int) -> Dict[str, Any]:
    task = task_info(task_id)
    if not can_see_task(user, task):
        raise HTTPException(status_code=404, detail="Task not found.")
    return task


def require_task_manage(user: Dict[str, Any], task_id: int) -> Dict[str, Any]:
    task = require_task_read(user, task_id)
    if not can_manage_project(user, task["project_id"]):
        raise HTTPException(status_code=403, detail="Only the project's manager or an admin can change this task.")
    return task


# ─────────────────────────────────────────────
#  PROJECT LIFECYCLE + TEAMS
# ─────────────────────────────────────────────

def project_completed(project_id: Optional[int]) -> bool:
    if project_id is None:
        return False
    rows = _rows("SELECT is_completed FROM Projects WHERE project_id = %s", (int(project_id),))
    return bool(rows and rows[0][0])


def require_open_project(project_id: Optional[int]) -> None:
    """Completed projects are read-only until a manager/admin reopens them."""
    if project_completed(project_id):
        raise HTTPException(status_code=409, detail="This project is completed and read-only. Reopen it to make changes.")


def team_member_ids(manager_id: int) -> Set[int]:
    return {r[0] for r in _rows("SELECT user_id FROM Users WHERE reports_to = %s AND is_active", (manager_id,))}


def require_assignable(user: Dict[str, Any], assigned_to: Optional[int]) -> None:
    """Admins may assign any active user; Managers only themselves or developers on their team."""
    if assigned_to is None:
        return
    rows = _rows("SELECT is_active FROM Users WHERE user_id = %s", (int(assigned_to),))
    if not rows or not rows[0][0]:
        raise HTTPException(status_code=422, detail="Tasks can only be assigned to an active user.")
    if user["role"] == MANAGER and assigned_to != user["user_id"] and assigned_to not in team_member_ids(user["user_id"]):
        raise HTTPException(status_code=403, detail="You can only assign tasks to developers on your team. "
                                                    "Ask an admin to add them to your team.")


def guard_project_params(request: Request, user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """Router-level guard: any `project_id` / `task_id` in the path or query must be in the user's scope.
    Non-GET calls under /evm save EVM snapshots, so they need manage rights."""
    params = {**request.query_params, **request.path_params}
    pid = params.get("project_id")
    tid = params.get("task_id")
    write = request.method != "GET" and request.url.path.startswith("/evm")
    if pid is not None:
        try:
            pid = int(pid)
        except ValueError:
            raise HTTPException(status_code=422, detail="project_id must be an integer")
        (require_manage if write else require_read)(user, pid)
        if write:
            require_open_project(pid)
    if tid is not None:
        try:
            tid = int(tid)
        except ValueError:
            raise HTTPException(status_code=422, detail="task_id must be an integer")
        task = (require_task_manage if write else require_task_read)(user, tid)
        if write:
            require_open_project(task["project_id"])
    return user


# ─────────────────────────────────────────────
#  AUDIT LOG
# ─────────────────────────────────────────────

def ensure_audit_schema() -> None:
    """Audit table + project lifecycle columns (additive, idempotent)."""
    conn = get_connection()
    if not conn:
        return
    try:
        cur = conn.cursor()
        cur.execute("""
            ALTER TABLE Projects
                ADD COLUMN IF NOT EXISTS is_completed BOOLEAN NOT NULL DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS Audit_Log (
                audit_id    BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                created_at  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
                user_id     INT         REFERENCES Users(user_id) ON DELETE SET NULL,
                actor       VARCHAR(150),
                action      VARCHAR(60) NOT NULL,
                entity      VARCHAR(40),
                entity_id   INT,
                details     TEXT
            )
        """)
        cur.execute("CREATE INDEX IF NOT EXISTS idx_audit_created ON Audit_Log (created_at DESC)")
        conn.commit()
    except Exception as e:
        conn.rollback()
        log.error("Audit schema migration failed: %s", e)
    finally:
        conn.close()


# Writes happen off the request thread so auditing never slows a user action down.
_audit_pool = ThreadPoolExecutor(max_workers=2, thread_name_prefix="audit")


def _write_audit(row: tuple) -> None:
    conn = get_connection()
    if not conn:
        return
    try:
        cur = conn.cursor()
        cur.execute("INSERT INTO Audit_Log (user_id, actor, action, entity, entity_id, details) "
                    "VALUES (%s, %s, %s, %s, %s, %s)", row)
        conn.commit()
    except Exception as e:
        conn.rollback()
        log.warning("audit write failed: %s", e)
    finally:
        conn.close()


def audit(user: Optional[Dict[str, Any]], action: str, entity: Optional[str] = None,
          entity_id: Optional[int] = None, **details: Any) -> None:
    actor = (user or {}).get("email") or (user or {}).get("username")
    row = ((user or {}).get("user_id"), actor, action, entity, entity_id,
           json.dumps(details, default=str)[:2000] if details else None)
    _audit_pool.submit(_write_audit, row)


def recent_activity(limit: int = 100, user_id: Optional[int] = None) -> List[Dict[str, Any]]:
    rows = _rows("""
        SELECT a.audit_id, a.created_at, a.user_id, COALESCE(u.full_name, a.actor), a.action, a.entity,
               a.entity_id, a.details
        FROM Audit_Log a LEFT JOIN Users u ON u.user_id = a.user_id
        WHERE (%s::int IS NULL OR a.user_id = %s::int)
        ORDER BY a.created_at DESC, a.audit_id DESC
        LIMIT %s
    """, (user_id, user_id, max(1, min(int(limit), 500))))
    out = []
    for aid, ts, uid, actor, action, entity, eid, details in rows:
        try:
            parsed = json.loads(details) if details else {}
        except ValueError:
            parsed = {"raw": details}
        out.append({"id": aid, "at": ts.isoformat() if ts else None, "user_id": uid, "actor": actor,
                    "action": action, "entity": entity, "entity_id": eid, "details": parsed})
    return out
