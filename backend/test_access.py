"""
Unit tests for access.py — project/task scoping per role. DB lookups are faked.

Run:  cd backend && python -m pytest test_access.py -v
"""
import pytest
from fastapi import Depends, FastAPI, HTTPException
from fastapi.testclient import TestClient

import access
import auth

ADMIN = {"user_id": 1, "role": "Admin"}
VIEWER = {"user_id": 2, "role": "Viewer"}
MGR = {"user_id": 3, "role": "Manager"}         # manages project 10
DEV = {"user_id": 4, "role": "Developer"}       # has a task in project 10
OTHER_DEV = {"user_id": 5, "role": "Developer"}

MANAGED = {3: [10]}
DEV_PROJECTS = {4: [10], 5: [20]}
TASKS = {
    100: {"task_id": 100, "project_id": 10, "assigned_to": 4, "status": "To Do"},
    101: {"task_id": 101, "project_id": 10, "assigned_to": 5, "status": "To Do"},
    200: {"task_id": 200, "project_id": 20, "assigned_to": 5, "status": "Done"},
}


@pytest.fixture(autouse=True)
def fake_db(monkeypatch):
    access.invalidate_scope()

    def rows(sql, params=()):
        uid = params[0]
        if "manager_id" in sql:
            return [(p,) for p in MANAGED.get(uid, [])]
        return [(p,) for p in DEV_PROJECTS.get(uid, [])]
    monkeypatch.setattr(access, "_rows", rows)
    monkeypatch.setattr(access, "task_info", lambda tid: TASKS.get(int(tid)))


def test_scope_by_role():
    assert access.project_ids_for(ADMIN) is None
    assert access.project_ids_for(VIEWER) is None
    assert access.project_ids_for(MGR) == {10}
    assert access.project_ids_for(DEV) == {10}


def test_manager_can_manage_only_own_projects():
    access.require_manage(MGR, 10)
    with pytest.raises(HTTPException) as e:
        access.require_manage(MGR, 20)
    assert e.value.status_code == 404          # not even visible -> don't reveal it exists


def test_viewer_and_developer_cannot_manage():
    with pytest.raises(HTTPException) as e:
        access.require_manage(VIEWER, 10)
    assert e.value.status_code == 403
    with pytest.raises(HTTPException) as e:
        access.require_manage(DEV, 10)
    assert e.value.status_code == 403


def test_developer_sees_only_own_tasks():
    assert access.require_task_read(DEV, 100)["task_id"] == 100
    with pytest.raises(HTTPException) as e:
        access.require_task_read(DEV, 101)       # same project, someone else's task
    assert e.value.status_code == 404
    with pytest.raises(HTTPException):
        access.require_task_read(DEV, 200)       # other project


def test_manager_sees_all_tasks_in_own_projects_only():
    access.require_task_manage(MGR, 101)
    with pytest.raises(HTTPException):
        access.require_task_read(MGR, 200)


@pytest.fixture
def client(monkeypatch):
    users = {u["user_id"]: {**u, "is_active": True, "token_version": 0} for u in (ADMIN, MGR, DEV)}
    monkeypatch.setattr(auth, "_cached_user", lambda uid: users.get(uid))
    app = FastAPI()

    @app.get("/ml/risk")
    def risk(project_id: int, _=Depends(access.guard_project_params)):
        return {"ok": project_id}

    @app.post("/evm/calculate/{project_id}")
    def calc(project_id: int, _=Depends(access.guard_project_params)):
        return {"saved": project_id}

    return TestClient(app)


def _h(user):
    return {"Authorization": f"Bearer {auth.create_access_token(user['user_id'], user['role'], 0)}"}


def test_router_guard_scopes_query_and_path_ids(client):
    assert client.get("/ml/risk?project_id=10", headers=_h(DEV)).status_code == 200
    assert client.get("/ml/risk?project_id=20", headers=_h(DEV)).status_code == 404
    assert client.get("/ml/risk?project_id=20", headers=_h(ADMIN)).status_code == 200
    # saving an EVM snapshot is a write: manager of the project yes, developer no
    assert client.post("/evm/calculate/10", headers=_h(MGR)).status_code == 200
    assert client.post("/evm/calculate/10", headers=_h(DEV)).status_code == 403


# ── project lifecycle + teams ────────────────────────────

def test_completed_project_is_read_only(monkeypatch):
    monkeypatch.setattr(access, "_rows", lambda sql, params=(): [(True,)] if "is_completed" in sql else [])
    with pytest.raises(HTTPException) as e:
        access.require_open_project(10)
    assert e.value.status_code == 409
    access.require_open_project(None)          # nothing to check


def test_manager_can_only_assign_own_team(monkeypatch):
    def rows(sql, params=()):
        if "is_active FROM Users WHERE user_id" in sql:
            return [(True,)]
        if "reports_to" in sql:
            return [(4,)]                      # dev 4 is on manager 3's team
        return []
    monkeypatch.setattr(access, "_rows", rows)
    access.require_assignable(MGR, 4)          # team member
    access.require_assignable(MGR, 3)          # themselves
    access.require_assignable(MGR, None)       # unassigned
    with pytest.raises(HTTPException) as e:
        access.require_assignable(MGR, 5)      # someone else's developer
    assert e.value.status_code == 403
    access.require_assignable(ADMIN, 5)        # admins can assign anyone active


def test_cannot_assign_inactive_user(monkeypatch):
    monkeypatch.setattr(access, "_rows", lambda sql, params=(): [(False,)])
    with pytest.raises(HTTPException) as e:
        access.require_assignable(ADMIN, 9)
    assert e.value.status_code == 422
