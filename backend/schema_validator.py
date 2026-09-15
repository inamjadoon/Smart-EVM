from db_connection import get_connection

def validate_database_schema():
    """
    Checks if all 7 required tables exist in the PostgreSQL schema.
    This fulfills the 'Read' part of CRUD by inspecting the system metadata.
    """
    required_tables = {
        'ROLES', 'USERS', 'PROJECTS', 'SPRINTS', 
        'TASKS', 'METRICS', 'EVM_HISTORY'
    }
    
    conn = get_connection()
    if not conn:
        print(" Failed to connect to PostgreSQL.")
        return

    try:
        cursor = conn.cursor()
       
        cursor.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
        
        existing_tables = {row[0].upper() for row in cursor.fetchall()}
        
        found = required_tables.intersection(existing_tables)
        missing = required_tables - existing_tables

        print("--- Database Health Report ---")
        if not missing:
            print(f" Status: Healthy! All {len(found)} tables are present.")
        else:
            print(f" Status: Incomplete. Found {len(found)}/7 tables.")
            print(f" Missing: {missing}")
            
        
        print("\nTables ready for CRUD operations:")
        for table in sorted(found):
            print(f" - {table}")

    except Exception as e:
        print(f" Error during validation: {e}")
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    validate_database_schema()