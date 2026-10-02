from datetime import datetime, date
from db_connection import get_connection


def _parse_date(d):
    """
    Convert a date string (any common format) to a Python date object.
    Accepts: '2025-01-01', '01-JAN-2025', '2025/01/01', None
    """
    if d is None:
        return None
    if isinstance(d, (date, datetime)):
        return d
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%Y/%m/%d",
                "%d-%b-%Y", "%d-%B-%Y"):
        try:
            return datetime.strptime(str(d), fmt).date()
        except ValueError:
            continue
    raise ValueError(f"Cannot parse date: '{d}'. Use format YYYY-MM-DD e.g. '2025-01-01'")


def _validate_dates(start_date, end_date):
    """
    Validate a parsed (start_date, end_date) pair.
    Raises ValueError with a user-facing message if invalid.
    Past dates are allowed on purpose: historical and Jira-imported projects
    legitimately ended before today.
    """
    if start_date is not None and end_date is not None and end_date < start_date:
        raise ValueError("End date cannot be before start date")


def create_project(name, budget, start_date, end_date, manager_id):
    """Insert project and return the new project_id."""
    try:
        parsed_start = _parse_date(start_date)
        parsed_end = _parse_date(end_date)
        _validate_dates(parsed_start, parsed_end)
    except ValueError as ve:
        print("Date validation error:", ve)
        raise ve

    conn = get_connection()
    if not conn:
        raise RuntimeError("Database connection failed")
    try:
        cursor = conn.cursor()

        # Safely resolve manager_id: verify user exists in DB or set to None
        valid_manager_id = None
        if manager_id is not None and str(manager_id).strip() != "":
            try:
                mid = int(manager_id)
                cursor.execute("SELECT user_id FROM Users WHERE user_id = %s", [mid])
                if cursor.fetchone():
                    valid_manager_id = mid
                else:
                    print(f"[projects_crud] Manager ID {mid} not in Users table; falling back to NULL.")
                    valid_manager_id = None
            except (ValueError, TypeError):
                valid_manager_id = None

        cursor.execute("""
            INSERT INTO Projects (project_name, total_budget, start_date, end_date, manager_id)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING project_id
        """, [name, budget, parsed_start, parsed_end, valid_manager_id])
        row = cursor.fetchone()
        conn.commit()
        return int(row[0]) if row else None
    except Exception as e:
        print("Error creating project:", e)
        conn.rollback()
        raise e
    finally:
        cursor.close()
        conn.close()


def get_projects():
    conn = get_connection()
    if not conn:
        return []
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM Projects ORDER BY project_id")
        return cursor.fetchall()
    except Exception as e:
        print("Error fetching projects:", e)
        return []
    finally:
        cursor.close()
        conn.close()


def get_project_by_id(project_id):
    conn = get_connection()
    if not conn:
        return None
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM Projects WHERE project_id=%s", [project_id])
        return cursor.fetchone()
    except Exception as e:
        print("Error fetching project:", e)
        return None
    finally:
        cursor.close()
        conn.close()


def update_project(project_id, name, budget, start_date, end_date, manager_id):
    try:
        parsed_start = _parse_date(start_date)
        parsed_end = _parse_date(end_date)
        _validate_dates(parsed_start, parsed_end)
    except ValueError as ve:
        print("Date validation error:", ve)
        raise ve

    conn = get_connection()
    if not conn:
        raise RuntimeError("Database connection failed")
    try:
        cursor = conn.cursor()

        valid_manager_id = None
        if manager_id is not None and str(manager_id).strip() != "":
            try:
                mid = int(manager_id)
                cursor.execute("SELECT user_id FROM Users WHERE user_id = %s", [mid])
                if cursor.fetchone():
                    valid_manager_id = mid
                else:
                    valid_manager_id = None
            except (ValueError, TypeError):
                valid_manager_id = None

        cursor.execute("""
            UPDATE Projects
            SET project_name=%s, total_budget=%s, start_date=%s,
                end_date=%s, manager_id=%s
            WHERE project_id=%s
        """, [name, budget, parsed_start, parsed_end,
              valid_manager_id, project_id])
        conn.commit()
        return True
    except Exception as e:
        print("Error updating project:", e)
        conn.rollback()
        raise e
    finally:
        cursor.close()
        conn.close()


def delete_project(project_id):
    conn = get_connection()
    if not conn:
        return False
    try:
        cursor = conn.cursor()
        cursor.execute("""
            DELETE FROM Metrics WHERE task_id IN (
                SELECT task_id FROM Tasks WHERE sprint_id IN (
                    SELECT sprint_id FROM Sprints WHERE project_id=%s))
        """, [project_id])
        cursor.execute("""
            DELETE FROM Tasks WHERE sprint_id IN (
                SELECT sprint_id FROM Sprints WHERE project_id=%s)
        """, [project_id])
        cursor.execute("DELETE FROM Sprints WHERE project_id=%s", [project_id])
        cursor.execute("DELETE FROM EVM_History WHERE project_id=%s", [project_id])
        cursor.execute("DELETE FROM Projects WHERE project_id=%s", [project_id])
        conn.commit()
        return True
    except Exception as e:
        print("Error deleting project:", e)
        conn.rollback()
        return False
    finally:
        cursor.close()
        conn.close()
