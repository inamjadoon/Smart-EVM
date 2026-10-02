from datetime import datetime, date
from db_connection import get_connection


def _parse_date(d):
    """Convert date string to Python date object."""
    if d is None or (isinstance(d, str) and d.strip() == ""):
        return None
    if isinstance(d, (date, datetime)):
        return d
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%Y/%m/%d",
                "%d-%b-%Y", "%d-%B-%Y"):
        try:
            return datetime.strptime(str(d), fmt).date()
        except ValueError:
            continue
    raise ValueError(f"Cannot parse date: '{d}'. Use YYYY-MM-DD e.g. '2025-01-01'")


def create_sprint(project_id, sprint_no, name, start_date, end_date, planned_value, actual_cost=None):
    """Insert sprint and return the new sprint_id."""
    conn = get_connection()
    if not conn:
        return None
    try:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO Sprints
                (project_id, sprint_no, sprint_name, start_date, end_date, planned_value, actual_cost)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING sprint_id
        """, [project_id, sprint_no, name,
              _parse_date(start_date), _parse_date(end_date),
              planned_value, actual_cost])
        row = cursor.fetchone()
        conn.commit()
        return int(row[0]) if row else None
    except ValueError as ve:
        print("Date format error:", ve)
        return None
    except Exception as e:
        print("Error creating sprint:", e)
        conn.rollback()
        return None
    finally:
        cursor.close()
        conn.close()


def get_sprints(project_id=None):
    conn = get_connection()
    if not conn:
        return []
    try:
        cursor = conn.cursor()
        if project_id:
            cursor.execute(
                "SELECT * FROM Sprints WHERE project_id=%s ORDER BY sprint_no",
                [project_id]
            )
        else:
            cursor.execute("SELECT * FROM Sprints ORDER BY project_id, sprint_no")
        return cursor.fetchall()
    except Exception as e:
        print("Error fetching sprints:", e)
        return []
    finally:
        cursor.close()
        conn.close()


def update_sprint(sprint_id, project_id, sprint_no, name, start_date, end_date, planned_value, actual_cost=None):
    conn = get_connection()
    if not conn:
        return False
    try:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE Sprints
            SET project_id=%s, sprint_no=%s, sprint_name=%s,
                start_date=%s, end_date=%s, planned_value=%s, actual_cost=%s
            WHERE sprint_id=%s
        """, [project_id, sprint_no, name,
              _parse_date(start_date), _parse_date(end_date),
              planned_value, actual_cost, sprint_id])
        conn.commit()
        return True
    except Exception as e:
        print("Error updating sprint:", e)
        conn.rollback()
        return False
    finally:
        cursor.close()
        conn.close()


def delete_sprint(sprint_id):
    conn = get_connection()
    if not conn:
        return False
    try:
        cursor = conn.cursor()
        cursor.execute(
            "DELETE FROM Metrics WHERE task_id IN "
            "(SELECT task_id FROM Tasks WHERE sprint_id=%s)",
            [sprint_id]
        )
        cursor.execute("DELETE FROM Tasks WHERE sprint_id=%s", [sprint_id])
        cursor.execute("DELETE FROM Sprints WHERE sprint_id=%s", [sprint_id])
        conn.commit()
        return True
    except Exception as e:
        print("Error deleting sprint:", e)
        conn.rollback()
        return False
    finally:
        cursor.close()
        conn.close()
