

-- 1. Query Execution Plan (PostgreSQL EXPLAIN)
EXPLAIN
SELECT
    p.project_id,
    p.project_name,
    SUM(s.planned_value)                                    AS total_pv,
    SUM(CASE WHEN t.status='Done' THEN t.story_points*100 ELSE 0 END) AS total_ev
FROM Projects p
LEFT JOIN Sprints s ON p.project_id = s.project_id
LEFT JOIN Tasks   t ON s.sprint_id  = t.sprint_id
GROUP BY p.project_id, p.project_name;

-- 2. Data Integrity Checks
-- Check for orphaned tasks (tasks with non-existent sprint_id)
SELECT t.task_id, t.sprint_id, 'Orphaned Task - No Sprint' AS issue
FROM Tasks t
LEFT JOIN Sprints s ON t.sprint_id = s.sprint_id
WHERE s.sprint_id IS NULL;

-- Check for duplicate sprint numbers within a project
SELECT project_id, sprint_no, COUNT(*) AS dup_count
FROM Sprints
GROUP BY project_id, sprint_no
HAVING COUNT(*) > 1;

-- Check for bug count calculation consistency in Metrics
SELECT metric_id, task_id,
       critical_bugs + major_bugs + minor_bugs AS expected_bug_count,
       bug_count                               AS stored_bug_count,
       'BUG COUNT MISMATCH' AS issue
FROM Metrics
WHERE bug_count != (critical_bugs + major_bugs + minor_bugs);

-- Check QPI ranges (must be between 0 and 100)
SELECT metric_id, task_id, calculated_qpi, 'QPI OUT OF RANGE' AS issue
FROM Metrics
WHERE calculated_qpi < 0 OR calculated_qpi > 100;

-- Check Task status validity
SELECT task_id, status, 'INVALID STATUS' AS issue
FROM Tasks
WHERE status NOT IN ('To Do', 'In Progress', 'Done');

-- Check Project start/end date logic
SELECT project_id, project_name, start_date, end_date, 'INVALID DATE RANGE' AS issue
FROM Projects
WHERE start_date IS NOT NULL AND end_date IS NOT NULL
  AND end_date < start_date;

-- Check for empty projects (no sprints)
SELECT p.project_id, p.project_name, 'No Sprints Found' AS note
FROM Projects p
LEFT JOIN Sprints s ON p.project_id = s.project_id
WHERE s.sprint_id IS NULL;

-- Check for sprints without tasks
SELECT s.sprint_id, s.sprint_name, p.project_name, 'No Tasks in Sprint' AS note
FROM Sprints s
JOIN Projects p ON s.project_id = p.project_id
LEFT JOIN Tasks t ON s.sprint_id = t.sprint_id
WHERE t.task_id IS NULL;

-- Check EVM History CPI consistency
SELECT
    h.history_id,
    h.project_id,
    h.cpi                                                   AS stored_cpi,
    ROUND((h.total_ev / NULLIF(h.total_ac, 0))::numeric, 2) AS computed_cpi,
    ABS(h.cpi - ROUND((h.total_ev / NULLIF(h.total_ac, 0))::numeric, 2)) AS variance,
    CASE WHEN ABS(h.cpi - ROUND((h.total_ev / NULLIF(h.total_ac, 0))::numeric, 2)) > 0.05
         THEN 'INCONSISTENT' ELSE 'OK' END                  AS status
FROM EVM_History h
WHERE h.total_ac > 0;

-- Check for users with no role assigned
SELECT user_id, username, 'No Role Assigned' AS warning
FROM Users
WHERE role_id IS NULL;

-- Check column normalization (PostgreSQL information_schema)
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name LIKE '%role_name%';  -- expected: 0 rows

-- Normalization note
SELECT 'QPI requires 5 inputs (cannot derive from single table column)' AS normalization_note;

-- Index verification (PostgreSQL pg_indexes)
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename IN ('projects','sprints','tasks','metrics','evm_history','users')
ORDER BY tablename, indexname;

-- Row count verification across all tables
SELECT 'Roles'       AS table_name, COUNT(*) AS row_count FROM Roles       UNION ALL
SELECT 'Users'       AS table_name, COUNT(*) AS row_count FROM Users       UNION ALL
SELECT 'Projects'    AS table_name, COUNT(*) AS row_count FROM Projects    UNION ALL
SELECT 'Sprints'     AS table_name, COUNT(*) AS row_count FROM Sprints     UNION ALL
SELECT 'Tasks'       AS table_name, COUNT(*) AS row_count FROM Tasks       UNION ALL
SELECT 'Metrics'     AS table_name, COUNT(*) AS row_count FROM Metrics     UNION ALL
SELECT 'EVM_History' AS table_name, COUNT(*) AS row_count FROM EVM_History;

-- 3. Stored Procedure (PostgreSQL PL/pgSQL)
CREATE OR REPLACE PROCEDURE sp_generate_evm_snapshot(
    p_project_id INT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_total_pv   NUMERIC(15,2);
    v_total_ev   NUMERIC(15,2);
    v_total_ac   NUMERIC(15,2);
    v_cpi        NUMERIC(5,2);
    v_spi        NUMERIC(5,2);
    v_qpi        NUMERIC(5,2);
    v_budget     NUMERIC(15,2);
    v_eac        NUMERIC(15,2);
    v_vac        NUMERIC(15,2);
BEGIN
    SELECT total_budget INTO v_budget
    FROM Projects WHERE project_id = p_project_id;

    IF NOT FOUND THEN
        RAISE NOTICE 'ERROR: Project % not found.', p_project_id;
        RETURN;
    END IF;

    SELECT
        SUM(s.planned_value),
        SUM(CASE WHEN t.status = 'Done' THEN t.story_points * 100 ELSE 0 END),
        SUM(CASE WHEN s.start_date IS NOT NULL THEN s.planned_value ELSE 0 END)
    INTO v_total_pv, v_total_ev, v_total_ac
    FROM Sprints s
    LEFT JOIN Tasks t ON s.sprint_id = t.sprint_id
    WHERE s.project_id = p_project_id;

    v_cpi := ROUND((v_total_ev / NULLIF(v_total_ac, 0))::numeric, 2);
    v_spi := ROUND((v_total_ev / NULLIF(v_total_pv, 0))::numeric, 2);

    v_eac := ROUND((v_budget / NULLIF(v_cpi, 0))::numeric, 2);
    v_vac := ROUND((v_budget - v_eac)::numeric, 2);

    SELECT ROUND(AVG(m.calculated_qpi)::numeric, 2) INTO v_qpi
    FROM Metrics m
    JOIN Tasks   t ON m.task_id    = t.task_id
    JOIN Sprints s ON t.sprint_id  = s.sprint_id
    WHERE s.project_id = p_project_id;

    INSERT INTO EVM_History (
        project_id, snapshot_date,
        total_pv, total_ev, total_ac,
        cpi, spi, qpi,
        ai_prediction_eac, ai_variance_at_completion
    ) VALUES (
        p_project_id, CURRENT_TIMESTAMP,
        v_total_pv, v_total_ev, v_total_ac,
        v_cpi, v_spi, v_qpi,
        v_eac, v_vac
    );

    RAISE NOTICE 'EVM Snapshot created for project % | CPI=% | SPI=%', p_project_id, v_cpi, v_spi;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'ERROR: %', SQLERRM;
END;
$$;
