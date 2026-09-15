import requests
from typing import Optional
from db_connection import get_connection

PUBLIC_JIRA_BASE = "https://jira.atlassian.com/rest/api/2"

AVAILABLE_PUBLIC_PROJECTS = {
    "JRASERVER" : "JIRA Server (Atlassian's own bug tracker — thousands of issues)",
    "CONFSERVER": "Confluence Server",
    "BSERV"     : "Bitbucket Server",
    "BAM"       : "Bamboo CI",
}

DEFAULT_PROJECT = "JRASERVER"
MAX_ISSUES      = 50   # total cap across all pages
PAGE_SIZE       = 50   # items per API request (Jira max is 100)


def _map_status(jira_status: str) -> str:
    """Normalise any JIRA status to one of the 3 values allowed by the DB CHECK."""
    s = jira_status.strip().lower()
    if s in ("done", "closed", "resolved", "complete", "completed",
             "won't fix", "wont fix", "duplicate", "verified",
             "released", "fix released"):
        return "Done"
    if s in ("in progress", "in review", "in development", "under review",
             "code review", "testing", "qa", "review", "building",
             "open", "reopened"):
        return "In Progress"
    return "To Do"


def _derive_metrics(fields: dict) -> dict:
    """Derive quality metrics from JIRA issue fields."""
    priority   = str((fields.get("priority")  or {}).get("name", "") or "").lower()
    issue_type = str((fields.get("issuetype") or {}).get("name", "") or "").lower()
    status_raw = str((fields.get("status")    or {}).get("name", "") or "").lower()

    critical_bugs = major_bugs = minor_bugs = 0

    if "bug" in issue_type or "defect" in issue_type:
        if priority in ("blocker", "critical"):
            critical_bugs = 1
        elif priority in ("major", "high"):
            major_bugs = 1
        else:
            minor_bugs = 1

    if status_raw in ("done", "closed", "resolved", "fix released"):
        code_coverage = 85.0
    elif status_raw in ("in progress", "in review", "testing"):
        code_coverage = 60.0
    else:
        code_coverage = 30.0

    if "technical debt" in issue_type or "improvement" in issue_type:
        tech_debt_hours = 8.0
    elif "bug" in issue_type:
        tech_debt_hours = 4.0
    else:
        tech_debt_hours = 1.0

    bug_count = critical_bugs + major_bugs + minor_bugs

    qpi = 100.0
    qpi -= critical_bugs    * 10
    qpi -= major_bugs       * 5
    qpi -= minor_bugs       * 2
    qpi += (code_coverage / 100.0) * 20
    qpi -= tech_debt_hours  / 5.0
    qpi  = round(max(0.0, min(100.0, qpi)), 2)

    return {
        "critical_bugs"  : critical_bugs,
        "major_bugs"     : major_bugs,
        "minor_bugs"     : minor_bugs,
        "bug_count"      : bug_count,
        "code_coverage"  : code_coverage,
        "tech_debt_hours": tech_debt_hours,
        "calculated_qpi" : qpi,
    }


def _fetch_jira_issues(project_key: str, max_issues: int) -> tuple[list, int]:
    """
    Paginate through Jira REST API until we have `max_issues` records or
    we've exhausted all available results.

    Returns (issues_list, total_available_in_jira).
    Raises requests.exceptions.* on network errors.
    Raises ValueError on non-200 HTTP responses.
    """
    all_issues   = []
    start_at     = 0
    total_remote = None   # filled after first response

    while len(all_issues) < max_issues:
        want = min(PAGE_SIZE, max_issues - len(all_issues))

        resp = requests.get(
            f"{PUBLIC_JIRA_BASE}/search",
            params={
                "jql"        : f"project = {project_key} ORDER BY updated DESC",
                "maxResults" : want,
                "startAt"    : start_at,
                "fields"     : "summary,status,issuetype,priority,"
                               "customfield_10002,assignee,components,labels",
            },
            headers={"Accept": "application/json"},
            timeout=20,
        )

        if resp.status_code == 401:
            raise ValueError(
                f"Project '{project_key}' requires auth. "
                f"Try: {list(AVAILABLE_PUBLIC_PROJECTS.keys())}"
            )
        if resp.status_code not in (200,):
            raise ValueError(f"JIRA API returned HTTP {resp.status_code}.")

        data = resp.json()

        if total_remote is None:
            total_remote = data.get("total", 0)
            print(f"  JIRA reports {total_remote} total issues for '{project_key}'")

        page_issues = data.get("issues", [])
        if not page_issues:
            break   # no more results

        all_issues.extend(page_issues)
        start_at += len(page_issues)

        print(f"  Fetched page ending at startAt={start_at} "
              f"({len(all_issues)}/{min(max_issues, total_remote)} collected)")

        # Stop if Jira has no more issues beyond this page
        if start_at >= (total_remote or 0):
            break

    return all_issues, (total_remote or 0)


def _upsert_task(cursor, sprint_id: int, external_id: str,
                 description: str, status: str, story_points: int) -> Optional[int]:

    try:
        cursor.execute(
            "SELECT task_id FROM Tasks WHERE external_id = %s",
            [external_id]
        )
        row = cursor.fetchone()

        if row:
            # UPDATE — bring task in line with current JIRA state
            task_id = row[0]
            cursor.execute("""
                UPDATE Tasks
                SET    task_description = %s,
                       status          = %s,
                       story_points    = %s,
                       sprint_id       = %s
                WHERE  task_id         = %s
            """, [description, status, story_points, sprint_id, task_id])
            return task_id
        else:
            # INSERT — new issue never seen before
            cursor.execute("""
                INSERT INTO Tasks
                    (sprint_id, assigned_to, external_id,
                     task_description, status, story_points)
                VALUES (%s, NULL, %s, %s, %s, %s)
                RETURNING task_id
            """, [sprint_id, external_id, description, status, story_points])
            new_row = cursor.fetchone()
            return int(new_row[0]) if new_row else None

    except Exception as e:
        print(f"  [upsert_task] {external_id}: {e}")
        return None


def _upsert_metric(cursor, task_id: int, m: dict) -> None:
    """
    MERGE metric data for a task.
    UPDATE if metric row exists, INSERT if not.
    Uses same cursor/connection as the task upsert — no separate commit needed.
    """
    try:
        cursor.execute(
            "SELECT metric_id FROM Metrics WHERE task_id = %s",
            [task_id]
        )
        row = cursor.fetchone()

        if row:
            cursor.execute("""
                UPDATE Metrics
                SET    critical_bugs   = %s,
                       major_bugs      = %s,
                       minor_bugs      = %s,
                       bug_count       = %s,
                       code_coverage   = %s,
                       tech_debt_hours = %s,
                       calculated_qpi  = %s
                WHERE  task_id         = %s
            """, [
                m["critical_bugs"], m["major_bugs"], m["minor_bugs"],
                m["bug_count"], m["code_coverage"],
                m["tech_debt_hours"], m["calculated_qpi"],
                task_id
            ])
        else:
            cursor.execute("""
                INSERT INTO Metrics
                    (task_id, tester_id, critical_bugs, major_bugs, minor_bugs,
                     bug_count, code_coverage, tech_debt_hours, calculated_qpi)
                VALUES (%s, NULL, %s, %s, %s, %s, %s, %s, %s)
            """, [
                task_id,
                m["critical_bugs"], m["major_bugs"], m["minor_bugs"],
                m["bug_count"], m["code_coverage"],
                m["tech_debt_hours"], m["calculated_qpi"]
            ])

    except Exception as e:
        print(f"  [upsert_metric] task_id={task_id}: {e}")


def import_from_jira(project_id: int, jira_project_key: str = None) -> dict:
    """
    Pull live issues from Atlassian's public JIRA and upsert into PostgreSQL.

    Single-connection design: every read and write in this function
    shares the same database connection and transaction. One commit at the
    end makes all changes visible atomically — this is why GET /tasks
    immediately reflects the sync after this call returns.

    Pagination: iterates through ALL Jira pages until MAX_ISSUES records
    are collected, so the full 50 issues are reliably synced.
    """
    project_key = (jira_project_key or DEFAULT_PROJECT).strip().upper()

    conn = get_connection()
    if not conn:
        return {"error": "Database connection failed — check db_connection.py"}

    cursor = conn.cursor()

    try:
        cursor.execute(
            "SELECT project_id, project_name FROM Projects WHERE project_id = %s",
            [project_id]
        )
        proj_row = cursor.fetchone()
        if not proj_row:
            return {
                "error": (
                    f"Project ID {project_id} not found. "
                    f"Create it first with POST /projects."
                )
            }
        print(f"Project found: {proj_row[1]} (ID: {proj_row[0]})")

        cursor.execute(
            "SELECT sprint_id FROM Sprints WHERE project_id = %s ORDER BY sprint_no",
            [project_id]
        )
        sprint_row = cursor.fetchone()

        if sprint_row:
            sprint_id = sprint_row[0]
            print(f"Using sprint ID: {sprint_id}")
        else:
            cursor.execute("""
                INSERT INTO Sprints
                    (project_id, sprint_no, sprint_name, start_date, end_date, planned_value)
                VALUES (%s, 1, 'Sprint 1 - JIRA Import', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '30 days', 100000)
                RETURNING sprint_id
            """, [project_id])
            sprint_id = int(cursor.fetchone()[0])
            print(f"Auto-created sprint ID: {sprint_id}")

        print(f"Fetching from JIRA project: {project_key} (up to {MAX_ISSUES} issues) ...")
        try:
            issues, total_found = _fetch_jira_issues(project_key, MAX_ISSUES)
        except requests.exceptions.Timeout:
            return {"error": "JIRA API timed out. Check internet and try again."}
        except requests.exceptions.ConnectionError:
            return {"error": "Cannot reach jira.atlassian.com. Check internet connection."}
        except ValueError as e:
            return {"error": str(e)}

        print(f"Collected {len(issues)} issues to process (total in JIRA: {total_found})")

        if not issues:
            return {
                "success": False,
                "message": f"No issues in project '{project_key}'. Try JRASERVER.",
            }

        imported = updated = skipped = 0
        warnings = []

        for issue in issues:
            try:
                external_id  = issue["key"]
                fields       = issue["fields"]
                description  = (fields.get("summary") or "No summary")[:499]
                db_status    = _map_status(
                    str((fields.get("status") or {}).get("name", "To Do"))
                )
                story_points = int(fields.get("customfield_10002") or 0)

                # Determine if this is insert or update BEFORE calling upsert
                cursor.execute(
                    "SELECT COUNT(*) FROM Tasks WHERE external_id = %s",
                    [external_id]
                )
                is_new = cursor.fetchone()[0] == 0

                task_id = _upsert_task(
                    cursor, sprint_id, external_id,
                    description, db_status, story_points
                )

                if task_id is None:
                    warnings.append(f"{external_id}: upsert returned None")
                    skipped += 1
                    continue

                if is_new:
                    imported += 1
                else:
                    updated += 1

                # Upsert metric on same cursor
                _upsert_metric(cursor, task_id, _derive_metrics(fields))

            except Exception as e:
                warnings.append(f"{issue.get('key', '?')}: {e}")
                skipped += 1

        conn.commit()
        print(f"Committed: {imported} inserted, {updated} updated, {skipped} skipped")

    except Exception as e:
        conn.rollback()
        return {"error": f"Import failed: {e}"}
    finally:
        cursor.close()
        conn.close()

    result = {
        "success"         : True,
        "project_id"      : project_id,
        "jira_project"    : project_key,
        "sprint_id_used"  : sprint_id,
        "total_from_jira" : total_found,
        "issues_collected": len(issues),
        "imported_new"    : imported,
        "updated"         : updated,
        "skipped"         : skipped,
        "message"         : (
            f"{imported} new tasks inserted, {updated} updated from "
            f"JIRA project '{project_key}'. "
            f"GET /tasks now reflects the latest JIRA state. "
            f"Call POST /evm/calculate/{project_id} to compute EVM."
        ),
        "next_steps": [
            f"GET  /tasks?sprint_id={sprint_id}",
            f"GET  /metrics",
            f"POST /evm/calculate/{project_id}",
            f"GET  /evm/history/{project_id}",
        ],
    }
    if warnings:
        result["warnings"] = warnings[:10]
    return result
