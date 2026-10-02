from db_connection import get_connection
from evm_calculator import calculate_project_evm, calculate_qpi, CALC_VERSION

from typing import Optional, List, Dict


def _fetch_project(project_id: int) -> Optional[Dict]:
    """Fetch one project row as a dict. Returns None if not found."""
    conn = get_connection()
    if not conn:
        return None
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT project_id, project_name, total_budget,
                   start_date, end_date, manager_id
            FROM   Projects
            WHERE  project_id = %s
            """,
            [project_id]
        )
        row = cursor.fetchone()
        if not row:
            return None
        return {
            "project_id"  : row[0],
            "project_name": row[1],
            "total_budget": row[2],
            "start_date"  : row[3],
            "end_date"    : row[4],
            "manager_id"  : row[5],
        }
    except Exception as e:
        print(f"[evm_service] _fetch_project error: {e}")
        return None
    finally:
        cursor.close()
        conn.close()


def _fetch_sprints_for_project(project_id: int) -> List[Dict]:
    """Fetch all sprints belonging to a project as a list of dicts."""
    conn = get_connection()
    if not conn:
        return []
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT sprint_id, project_id, sprint_no, sprint_name,
                   start_date, end_date, planned_value, actual_cost
            FROM   Sprints
            WHERE  project_id = %s
            ORDER BY sprint_no
            """,
            [project_id]
        )
        rows = cursor.fetchall()
        return [
            {
                "sprint_id"    : r[0],
                "project_id"   : r[1],
                "sprint_no"    : r[2],
                "sprint_name"  : r[3],
                "start_date"   : r[4],
                "end_date"     : r[5],
                "planned_value": r[6],
                "actual_cost"  : r[7],
            }
            for r in rows
        ]
    except Exception as e:
        print(f"[evm_service] _fetch_sprints error: {e}")
        return []
    finally:
        cursor.close()
        conn.close()


def _fetch_tasks_for_sprints(sprint_ids: List[int]) -> List[Dict]:
    """Fetch all tasks for a list of sprint IDs."""
    if not sprint_ids:
        return []
    conn = get_connection()
    if not conn:
        return []
    try:
        cursor = conn.cursor()
        placeholders = ",".join(["%s"] * len(sprint_ids))
        cursor.execute(
            f"""
            SELECT task_id, sprint_id, assigned_to, external_id,
                   task_description, status, story_points
            FROM   Tasks
            WHERE  sprint_id IN ({placeholders})
            """,
            sprint_ids
        )
        rows = cursor.fetchall()
        return [
            {
                "task_id"         : r[0],
                "sprint_id"       : r[1],
                "assigned_to"     : r[2],
                "external_id"     : r[3],
                "task_description": r[4],
                "status"          : r[5],
                "story_points"    : r[6],
            }
            for r in rows
        ]
    except Exception as e:
        print(f"[evm_service] _fetch_tasks error: {e}")
        return []
    finally:
        cursor.close()
        conn.close()


def _fetch_metrics_for_tasks(task_ids: List[int]) -> List[Dict]:
    """Fetch all metrics for a list of task IDs."""
    if not task_ids:
        return []
    conn = get_connection()
    if not conn:
        return []
    try:
        cursor = conn.cursor()
        placeholders = ",".join(["%s"] * len(task_ids))
        cursor.execute(
            f"""
            SELECT metric_id, task_id, tester_id,
                   critical_bugs, major_bugs, minor_bugs,
                   bug_count, code_coverage, tech_debt_hours, calculated_qpi
            FROM   Metrics
            WHERE  task_id IN ({placeholders})
            """,
            task_ids
        )
        rows = cursor.fetchall()
        return [
            {
                "metric_id"      : r[0],
                "task_id"        : r[1],
                "tester_id"      : r[2],
                "critical_bugs"  : r[3],
                "major_bugs"     : r[4],
                "minor_bugs"     : r[5],
                "bug_count"      : r[6],
                "code_coverage"  : r[7],
                "tech_debt_hours": r[8],
                "calculated_qpi" : r[9],
            }
            for r in rows
        ]
    except Exception as e:
        print(f"[evm_service] _fetch_metrics error: {e}")
        return []
    finally:
        cursor.close()
        conn.close()


def _save_evm_snapshot(evm_result: Dict) -> bool:
    """
    Insert one row into EVM_History using the calculated EVM result dict.
    Returns True on success, False on failure.
    """
    conn = get_connection()
    if not conn:
        return False
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO EVM_History
                (project_id, total_pv, total_ev, total_ac,
                 cpi, spi, qpi,
                 ai_prediction_eac, ai_variance_at_completion, calc_version)
            VALUES
                (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            [
                evm_result["project_id"],
                evm_result["total_pv"],
                evm_result["total_ev"],
                evm_result["total_ac"],
                evm_result["cpi"],
                evm_result["spi"],
                evm_result["qpi"],                       # can be None → stored as NULL
                evm_result["ai_prediction_eac"],
                evm_result["ai_variance_at_completion"],
                CALC_VERSION,
            ]
        )
        conn.commit()
        return True
    except Exception as e:
        print(f"[evm_service] _save_evm_snapshot error: {e}")
        conn.rollback()
        return False
    finally:
        cursor.close()
        conn.close()




def calculate_and_save_evm(
    project_id: int,
    budget_per_point: float = 100.0,
    save_snapshot: bool = True,
) -> Dict:
    """
    Full pipeline:
        1. Fetch project, sprints, tasks, metrics from PostgreSQL.
        2. Run EVM calculator.
        3. Save result snapshot to EVM_History (if save_snapshot=True).
        4. Return the result dict.

    Parameters
    ----------
    project_id       : ID of the project to calculate EVM for.
    budget_per_point : Monetary value of one story point (default 100).
    save_snapshot    : If True, saves result to EVM_History table.

    Returns
    -------
    dict with all EVM fields + sprint_breakdown list.
    """

    # 1-5. Fetch project, sprints, tasks, metrics in ONE pooled connection and calculate.
    results = calculate_portfolio_evm([project_id], keep_task_values=True)
    if not results:
        return {"error": f"Project {project_id} not found"}
    evm_result = results[0]
    evm_result["budget_per_point"] = budget_per_point

    # 6. Save snapshot to DB
    nothing_to_record = not evm_result.get("sprint_count") or (
        evm_result.get("total_pv") == 0 and evm_result.get("total_ev") == 0 and not evm_result.get("ac_entered"))
    if save_snapshot and "error" not in evm_result and nothing_to_record:
        evm_result["snapshot_saved"] = False
        evm_result["snapshot_skipped_reason"] = "Nothing to record yet: add sprints with dates, tasks or actual cost first."
    elif save_snapshot and "error" not in evm_result:
        saved = _save_evm_snapshot(evm_result)
        evm_result["snapshot_saved"] = saved
    else:
        evm_result["snapshot_saved"] = False

    return evm_result


def get_evm_history(project_id: int) -> List[Dict]:
    """
    Retrieve all historical EVM snapshots for a project,
    ordered by most recent first.
    """
    conn = get_connection()
    if not conn:
        return []
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT history_id, project_id, snapshot_date,
                   total_pv, total_ev, total_ac,
                   cpi, spi, qpi,
                   ai_prediction_eac, ai_variance_at_completion
            FROM   EVM_History
            WHERE  project_id = %s AND calc_version >= %s
            ORDER BY snapshot_date DESC, history_id DESC
            """,
            [project_id, CALC_VERSION]
        )
        rows = cursor.fetchall()
        return [
            {
                "history_id"               : r[0],
                "project_id"               : r[1],
                "snapshot_date"            : str(r[2]) if r[2] else None,
                "total_pv"                 : r[3],
                "total_ev"                 : r[4],
                "total_ac"                 : r[5],
                "cpi"                      : r[6],
                "spi"                      : r[7],
                "qpi"                      : r[8],
                "ai_prediction_eac"        : r[9],
                "ai_variance_at_completion": r[10],
            }
            for r in rows
        ]
    except Exception as e:
        print(f"[evm_service] get_evm_history error: {e}")
        return []
    finally:
        cursor.close()
        conn.close()


def recalculate_task_qpi(
    task_id     : int,
    critical_bugs: int,
    major_bugs   : int,
    minor_bugs   : int,
    code_coverage: float,
    tech_debt_hours: float,
) -> float:
    """
    Recalculate QPI for a single task using the formula in evm_calculator.py,
    then update the Metrics row in the database.
    Returns the new QPI value.
    """
    new_qpi = calculate_qpi(
        critical_bugs   = critical_bugs,
        major_bugs      = major_bugs,
        minor_bugs      = minor_bugs,
        code_coverage   = code_coverage,
        tech_debt_hours = tech_debt_hours,
    )

    conn = get_connection()
    if not conn:
        return new_qpi

    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            UPDATE Metrics
            SET    calculated_qpi  = %s,
                   critical_bugs   = %s,
                   major_bugs      = %s,
                   minor_bugs      = %s,
                   bug_count       = %s,
                   code_coverage   = %s,
                   tech_debt_hours = %s
            WHERE  task_id = %s
            """,
            [
                new_qpi,
                critical_bugs,
                major_bugs,
                minor_bugs,
                critical_bugs + major_bugs + minor_bugs,
                code_coverage,
                tech_debt_hours,
                task_id,
            ]
        )
        conn.commit()
    except Exception as e:
        print(f"[evm_service] recalculate_task_qpi error: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()

    return new_qpi


# ─────────────────────────────────────────────────────────────────────────────
#  Schema + portfolio (batch) calculation
# ─────────────────────────────────────────────────────────────────────────────

def ensure_evm_schema() -> None:
    """Additive, idempotent migration for the corrected EVM model.
    * Sprints.actual_cost      — money actually spent on the sprint (entered by the manager).
    * EVM_History.calc_version — 1 = legacy rows from the old, broken formula (kept, but ignored
                                 by charts/ML/AI); new snapshots are written with CALC_VERSION."""
    conn = get_connection()
    if not conn:
        return
    try:
        cur = conn.cursor()
        cur.execute("ALTER TABLE Sprints ADD COLUMN IF NOT EXISTS actual_cost NUMERIC(15, 2)")
        cur.execute("ALTER TABLE EVM_History ADD COLUMN IF NOT EXISTS calc_version INT NOT NULL DEFAULT 1")
        conn.commit()
    except Exception as e:
        conn.rollback()
        print(f"[evm_service] schema migration failed: {e}")
    finally:
        conn.close()


def calculate_portfolio_evm(project_ids=None, keep_task_values: bool = False) -> List[Dict]:
    """Live EVM for many projects with 3 queries total (instead of 4 per project)."""
    conn = get_connection()
    if not conn:
        return []
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT project_id, project_name, total_budget, start_date, end_date, manager_id
            FROM Projects WHERE (%s::int[] IS NULL OR project_id = ANY(%s::int[]))
        """, [project_ids, project_ids])
        projects = {r[0]: {"project_id": r[0], "project_name": r[1], "total_budget": r[2],
                           "start_date": r[3], "end_date": r[4], "manager_id": r[5]} for r in cur.fetchall()}
        if not projects:
            return []
        ids = list(projects)
        cur.execute("""
            SELECT sprint_id, project_id, sprint_no, sprint_name, start_date, end_date, planned_value, actual_cost
            FROM Sprints WHERE project_id = ANY(%s)
        """, [ids])
        sprints: Dict[int, List[Dict]] = {}
        for r in cur.fetchall():
            sprints.setdefault(r[1], []).append({
                "sprint_id": r[0], "project_id": r[1], "sprint_no": r[2], "sprint_name": r[3],
                "start_date": r[4], "end_date": r[5], "planned_value": r[6], "actual_cost": r[7]})
        cur.execute("""
            SELECT t.task_id, t.sprint_id, t.status, t.story_points, s.project_id
            FROM Tasks t JOIN Sprints s ON s.sprint_id = t.sprint_id WHERE s.project_id = ANY(%s)
        """, [ids])
        tasks: Dict[int, List[Dict]] = {}
        for r in cur.fetchall():
            tasks.setdefault(r[4], []).append({"task_id": r[0], "sprint_id": r[1], "status": r[2],
                                                "story_points": r[3]})
        cur.execute("""
            SELECT m.task_id, m.calculated_qpi FROM Metrics m
            JOIN Tasks t ON t.task_id = m.task_id JOIN Sprints s ON s.sprint_id = t.sprint_id
            WHERE s.project_id = ANY(%s)
        """, [ids])
        metrics = [{"task_id": r[0], "calculated_qpi": r[1]} for r in cur.fetchall()]
    finally:
        conn.close()
    out = []
    for pid, project in projects.items():
        res = calculate_project_evm(project, sprints.get(pid, []), tasks.get(pid, []), metrics)
        res["project_name"] = project["project_name"]
        res["sprint_count"] = len(sprints.get(pid, []))
        res["task_count"] = len(tasks.get(pid, []))
        if not keep_task_values:
            res.pop("task_values", None)
        out.append(res)
    return out
