from db_connection import get_connection

def create_role(role_name):
    conn = get_connection()
    if not conn:
        return

    try:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO Roles (role_name) VALUES (%s)",
            [role_name]
        )
        conn.commit()
        print("Role created successfully")
    except Exception as e:
        print("Error creating role:", e)
        conn.rollback()
    finally:
        cursor.close()
        conn.close()

def get_roles():
    conn = get_connection()
    if not conn:
        return []

    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM Roles")
        roles = cursor.fetchall()
        return roles
    except Exception as e:
        print("Error fetching roles:", e)
        return []
    finally:
        cursor.close()
        conn.close()

def update_role(role_id, role_name):
    conn = get_connection()
    if not conn:
        return

    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            UPDATE Roles
            SET role_name = %s
            WHERE role_id = %s
            """,
            [role_name, role_id]
        )
        if cursor.rowcount == 0:
            print("Role not found")
        conn.commit()
    except Exception as e:
        print("Error updating role:", e)
        conn.rollback()
    finally:
        cursor.close()
        conn.close()

def delete_role(role_id):
    conn = get_connection()
    if not conn:
        return

    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT COUNT(*) FROM Users WHERE role_id = %s",
            [role_id]
        )
        user_count = cursor.fetchone()[0]
        if user_count > 0:
            print("Cannot delete role. Users are assigned to this role.")
            return

        cursor.execute(
            "DELETE FROM Roles WHERE role_id = %s",
            [role_id]
        )
        if cursor.rowcount == 0:
            print("Role not found")
        conn.commit()
        print("Role deleted successfully")
    except Exception as e:
        print("Error deleting role:", e)
        conn.rollback()
    finally:
        cursor.close()
        conn.close()