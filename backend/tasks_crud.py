from db_connection import get_connection


def _validate_assigned_to(cursor, assigned_to):
    """Verify assigned_to user exists in DB; return valid ID or None."""
    if assigned_to is None or str(assigned_to).strip() == "":
        return None
    try:
        uid = int(assigned_to)
        cursor.execute("SELECT user_id FROM Users WHERE user_id = %s", [uid])
        if cursor.fetchone():
            return uid
        else:
            print(f"[tasks_crud] assigned_to={uid} not in Users table; falling back to NULL.")
            return None
    except (ValueError, TypeError):
        return None


def create_task(sprint_id, assigned_to, external_id, description, status, story_points):
    """Insert task and return the new task_id."""
    conn = get_connection()
    if not conn:
        return None
    try:
        cursor = conn.cursor()
        valid_assigned = _validate_assigned_to(cursor, assigned_to)
        cursor.execute("""
            INSERT INTO Tasks
                (sprint_id, assigned_to, external_id, task_description, status, story_points)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING task_id
        """, [sprint_id, valid_assigned, external_id, description, status, story_points])
        row = cursor.fetchone()
        conn.commit()
        return int(row[0]) if row else None
    except Exception as e:
        print("Error creating task:", e)
        conn.rollback()
        return None
    finally:
        cursor.close()
        conn.close()



def get_tasks(sprint_id=None):
    conn = get_connection()
    if not conn:
        return []
    try:
        cursor = conn.cursor()
        if sprint_id:
            cursor.execute(
                "SELECT * FROM Tasks WHERE sprint_id=%s ORDER BY task_id",
                [sprint_id]
            )
        else:
            cursor.execute("SELECT * FROM Tasks ORDER BY task_id")
        return cursor.fetchall()
    except Exception as e:
        print("Error fetching tasks:", e)
        return []
    finally:
        cursor.close()
        conn.close()


def update_task(task_id, sprint_id, assigned_to, external_id, description, status, story_points):
    conn = get_connection()
    if not conn:
        return False
    try:
        cursor = conn.cursor()
        valid_assigned = _validate_assigned_to(cursor, assigned_to)
        cursor.execute("""
            UPDATE Tasks
            SET sprint_id=%s, assigned_to=%s, external_id=%s,
                task_description=%s, status=%s, story_points=%s
            WHERE task_id=%s
        """, [sprint_id, valid_assigned, external_id, description, status, story_points, task_id])
        conn.commit()
        return True
    except Exception as e:
        print("Error updating task:", e)
        conn.rollback()
        return False
    finally:
        cursor.close()
        conn.close()


def delete_task(task_id):
    conn = get_connection()
    if not conn:
        return False
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM Metrics WHERE task_id=%s", [task_id])
        cursor.execute("DELETE FROM Tasks WHERE task_id=%s", [task_id])
        conn.commit()
        return True
    except Exception as e:
        print("Error deleting task:", e)
        conn.rollback()
        return False
    finally:
        cursor.close()
        conn.close()
