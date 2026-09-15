from db_connection import get_connection


def create_history(project_id, pv, ev, ac, cpi, spi, qpi, eac, vac):
    conn = get_connection()
    if not conn:
        return

    try:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO EVM_History
                (project_id, total_pv, total_ev, total_ac, cpi, spi, qpi,
                 ai_prediction_eac, ai_variance_at_completion)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, [project_id, pv, ev, ac, cpi, spi, qpi, eac, vac])
        conn.commit()

    except Exception as e:
        print("Error creating EVM history:", e)
        conn.rollback()

    finally:
        cursor.close()
        conn.close()


def get_history():
    conn = get_connection()
    if not conn:
        return []

    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM EVM_History")
        return cursor.fetchall()

    except Exception as e:
        print("Error fetching EVM history:", e)
        return []

    finally:
        cursor.close()
        conn.close()


def delete_history(history_id):
    conn = get_connection()
    if not conn:
        return

    try:
        cursor = conn.cursor()
        cursor.execute(
            "DELETE FROM EVM_History WHERE history_id = %s",
            [history_id]
        )
        conn.commit()

    except Exception as e:
        print("Error deleting EVM history:", e)
        conn.rollback()

    finally:
        cursor.close()
        conn.close()
