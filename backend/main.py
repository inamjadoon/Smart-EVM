from db_connection import get_connection

def check_system_health():
    """Verifies that the 7 tables created in PostgreSQL are reachable."""
    conn = get_connection()
    if not conn:
        print(" Failed to connect to PostgreSQL.")
        return

    cursor = conn.cursor()
    # List of tables we expect to find
    tables = ["PROJECTS", "SPRINTS", "TASKS", "USERS", "ROLES", "METRICS", "EVM_HISTORY"]
    
    print("---  SMART EVM Backend Health Check ---")
    for table in tables:
        try:
            # check row count to verify table exists
            cursor.execute(f"SELECT COUNT(*) FROM {table}")
            print(f" Table '{table}': ONLINE")
        except Exception as e:
            print(f" Table '{table}': NOT FOUND (Run the SQL script in PostgreSQL)")

    cursor.close()
    conn.close()

if __name__ == "__main__":
    check_system_health()