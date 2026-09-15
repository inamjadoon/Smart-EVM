
SELECT
    p.project_id,
    p.project_name,
    u.username                       AS manager,
    p.total_budget,
    TO_CHAR(p.start_date, 'DD-MON-YYYY') AS start_date,
    TO_CHAR(p.end_date,   'DD-MON-YYYY') AS end_date
FROM Projects p
LEFT JOIN Users u ON p.manager_id = u.user_id
ORDER BY p.start_date;


SELECT
    t.task_id,
    t.external_id                    AS jira_ticket,
    t.task_description,
    t.status,
    t.story_points,
    s.sprint_name,
    p.project_name,
    u.username                       AS assigned_to
FROM Tasks t
JOIN Sprints  s ON t.sprint_id    = s.sprint_id
JOIN Projects p ON s.project_id   = p.project_id
LEFT JOIN Users u ON t.assigned_to = u.user_id
ORDER BY p.project_id, s.sprint_no, t.task_id;


SELECT
    t.external_id,
    t.task_description,
    m.critical_bugs,
    m.major_bugs,
    m.minor_bugs,
    m.bug_count,              -- auto-computed by trigger
    m.code_coverage           || '%' AS code_coverage,
    m.tech_debt_hours         AS debt_hours,
    m.calculated_qpi          AS qpi_score
FROM Tasks t
JOIN Metrics m ON t.task_id = m.task_id
WHERE t.status = 'Done'
ORDER BY m.calculated_qpi DESC;

SELECT
    u.user_id,
    u.username,
    r.role_name
FROM Users u
JOIN Roles r ON u.role_id = r.role_id
ORDER BY r.role_name, u.username;

SELECT
    s.sprint_id,
    s.sprint_name,
    p.project_name,
    s.planned_value,
    s.end_date               AS deadline
FROM Sprints s
JOIN Projects p ON s.project_id = p.project_id
WHERE s.start_date IS NULL
ORDER BY p.project_id;


Select
    p.project_name,
    COUNT(t.task_id)                                              AS total_tasks,
    SUM(t.story_points)                                           AS total_story_points,
    SUM(CASE WHEN t.status = 'Done'        THEN t.story_points ELSE 0 END) AS done_points,
    SUM(CASE WHEN t.status = 'In Progress' THEN t.story_points ELSE 0 END) AS in_progress_points,
    SUM(CASE WHEN t.status = 'To Do'       THEN t.story_points ELSE 0 END) AS todo_points,
    ROUND(
        SUM(CASE WHEN t.status = 'Done' THEN t.story_points ELSE 0 END) * 100.0 /
        NULLIF(SUM(t.story_points), 0), 1
    )                                                             AS completion_pct
FROM Projects p
LEFT JOIN Sprints s ON p.project_id = s.project_id
LEFT JOIN Tasks   t ON s.sprint_id  = t.sprint_id
GROUP BY p.project_id, p.project_name
ORDER BY completion_pct DESC;

SELECT
    u.username,
    COUNT(t.task_id)                                              AS total_tasks,
    SUM(t.story_points)                                           AS total_points,
    COUNT(CASE WHEN t.status = 'In Progress' THEN 1 END)          AS active_tasks,
    ROUND(AVG(m.calculated_qpi), 1)                               AS avg_quality_score
FROM Users u
JOIN Tasks   t ON u.user_id = t.assigned_to
LEFT JOIN Metrics m ON t.task_id = m.task_id
GROUP BY u.user_id, u.username
ORDER BY total_points DESC;


SELECT
    p.project_name,
    s.sprint_no,
    s.sprint_name,
    s.planned_value                                               AS pv,
    SUM(CASE WHEN t.status = 'Done' THEN t.story_points * 100 ELSE 0 END) AS ev,
    ROUND(
        SUM(CASE WHEN t.status = 'Done' THEN t.story_points * 100 ELSE 0 END) /
        NULLIF(s.planned_value, 0), 2
    )                                                             AS sprint_spi,
    COUNT(t.task_id)                                              AS tasks,
    COUNT(CASE WHEN t.status='Done' THEN 1 END)                   AS done
FROM Projects p
JOIN Sprints s ON p.project_id = s.project_id
LEFT JOIN Tasks t ON s.sprint_id = t.sprint_id
GROUP BY p.project_id, p.project_name, s.sprint_id, s.sprint_no, s.sprint_name, s.planned_value
ORDER BY p.project_id, s.sprint_no;


SELECT
    p.project_name,
    SUM(m.critical_bugs)    AS total_critical,
    SUM(m.major_bugs)       AS total_major,
    SUM(m.minor_bugs)       AS total_minor,
    SUM(m.bug_count)        AS total_bugs,
    ROUND(AVG(m.code_coverage), 1) AS avg_coverage_pct,
    ROUND(AVG(m.calculated_qpi), 1) AS avg_qpi
FROM Projects p
JOIN Sprints  s ON p.project_id = s.project_id
JOIN Tasks    t ON s.sprint_id  = t.sprint_id
JOIN Metrics  m ON t.task_id    = m.task_id
GROUP BY p.project_id, p.project_name
ORDER BY total_critical DESC, total_bugs DESC;

SELECT
    p.project_name,
    ROUND(AVG(m.calculated_qpi), 1) AS avg_qpi
FROM Projects p
JOIN Sprints s ON p.project_id = s.project_id
JOIN Tasks   t ON s.sprint_id  = t.sprint_id
JOIN Metrics m ON t.task_id    = m.task_id
GROUP BY p.project_id, p.project_name
HAVING AVG(m.calculated_qpi) < 80
ORDER BY avg_qpi;


SELECT
    p.project_id,
    p.project_name,
    u.username                                                    AS manager,
    p.total_budget,
    SUM(s.planned_value)                                          AS total_pv,
    SUM(CASE WHEN t.status='Done' THEN t.story_points*100 ELSE 0 END) AS total_ev,
    SUM(CASE WHEN s.start_date IS NOT NULL THEN s.planned_value ELSE 0 END) AS total_ac,
   
    ROUND(
        SUM(CASE WHEN t.status='Done' THEN t.story_points*100 ELSE 0 END) /
        NULLIF(SUM(CASE WHEN s.start_date IS NOT NULL THEN s.planned_value ELSE 0 END), 0)
    , 2)                                                          AS cpi,
    
    ROUND(
        SUM(CASE WHEN t.status='Done' THEN t.story_points*100 ELSE 0 END) /
        NULLIF(SUM(s.planned_value), 0)
    , 2)                                                          AS spi,
   
    ROUND(
        p.total_budget /
        NULLIF(
            SUM(CASE WHEN t.status='Done' THEN t.story_points*100 ELSE 0 END) /
            NULLIF(SUM(CASE WHEN s.start_date IS NOT NULL THEN s.planned_value ELSE 0 END), 0)
        , 0)
    , 2)                                                          AS eac,
    ROUND(AVG(m.calculated_qpi), 2)                               AS avg_qpi,
    
    CASE
        WHEN ROUND(SUM(CASE WHEN t.status='Done' THEN t.story_points*100 ELSE 0 END) /
             NULLIF(SUM(CASE WHEN s.start_date IS NOT NULL THEN s.planned_value ELSE 0 END),0),2) >= 1.0
         AND ROUND(SUM(CASE WHEN t.status='Done' THEN t.story_points*100 ELSE 0 END) /
             NULLIF(SUM(s.planned_value),0),2) >= 1.0
        THEN 'Green  ✓'
        WHEN ROUND(SUM(CASE WHEN t.status='Done' THEN t.story_points*100 ELSE 0 END) /
             NULLIF(SUM(CASE WHEN s.start_date IS NOT NULL THEN s.planned_value ELSE 0 END),0),2) >= 0.8
        THEN 'Yellow ⚠'
        ELSE 'Red    ✗'
    END                                                           AS health
FROM Projects p
LEFT JOIN Users   u ON p.manager_id = u.user_id
LEFT JOIN Sprints s ON p.project_id = s.project_id
LEFT JOIN Tasks   t ON s.sprint_id  = t.sprint_id
LEFT JOIN Metrics m ON t.task_id    = m.task_id
GROUP BY p.project_id, p.project_name, u.username, p.total_budget
ORDER BY p.project_id;


SELECT
    p.project_name,
    p.total_budget,
    ROUND(
        SUM(CASE WHEN t.status='Done' THEN t.story_points*100 ELSE 0 END) /
        NULLIF(SUM(CASE WHEN s.start_date IS NOT NULL THEN s.planned_value ELSE 0 END),0)
    ,2)                                                           AS cpi,
    ROUND(
        p.total_budget /
        NULLIF(
            SUM(CASE WHEN t.status='Done' THEN t.story_points*100 ELSE 0 END) /
            NULLIF(SUM(CASE WHEN s.start_date IS NOT NULL THEN s.planned_value ELSE 0 END),0)
        ,0)
    ,2)                                                           AS predicted_final_cost,
    ROUND(
        p.total_budget /
        NULLIF(
            SUM(CASE WHEN t.status='Done' THEN t.story_points*100 ELSE 0 END) /
            NULLIF(SUM(CASE WHEN s.start_date IS NOT NULL THEN s.planned_value ELSE 0 END),0)
        ,0) - p.total_budget
    ,2)                                                           AS cost_overrun
FROM Projects p
LEFT JOIN Sprints s ON p.project_id = s.project_id
LEFT JOIN Tasks   t ON s.sprint_id  = t.sprint_id
GROUP BY p.project_id, p.project_name, p.total_budget
HAVING
    SUM(CASE WHEN t.status='Done' THEN t.story_points*100 ELSE 0 END) /
    NULLIF(SUM(CASE WHEN s.start_date IS NOT NULL THEN s.planned_value ELSE 0 END),0) < 1.0
ORDER BY cost_overrun DESC;

SELECT
    p.project_name,
    TO_CHAR(h.snapshot_date, 'DD-MON-YYYY HH24:MI') AS snapshot,
    h.total_pv,
    h.total_ev,
    h.total_ac,
    h.cpi,
    h.spi,
    h.qpi,
    h.ai_prediction_eac                              AS forecast_cost,
    -- Compare to previous snapshot using LAG
    LAG(h.cpi) OVER (PARTITION BY h.project_id ORDER BY h.snapshot_date) AS prev_cpi,
    ROUND(
        h.cpi - LAG(h.cpi) OVER (PARTITION BY h.project_id ORDER BY h.snapshot_date),
    2)                                               AS cpi_trend
FROM EVM_History h
JOIN Projects    p ON h.project_id = p.project_id
ORDER BY h.project_id, h.snapshot_date;

-- Q14: Top performer: developer with highest average QPI
-- "Who is our best-quality developer?"
SELECT
    u.username,
    COUNT(DISTINCT t.task_id)          AS tasks_completed,
    ROUND(AVG(m.calculated_qpi), 2)   AS avg_qpi,
    SUM(m.critical_bugs)               AS critical_bugs,
    ROUND(AVG(m.code_coverage), 1)    AS avg_coverage,
    RANK() OVER (ORDER BY AVG(m.calculated_qpi) DESC) AS quality_rank
FROM Users   u
JOIN Tasks   t ON u.user_id = t.assigned_to
JOIN Metrics m ON t.task_id = m.task_id
WHERE t.status = 'Done'
GROUP BY u.user_id, u.username
ORDER BY avg_qpi DESC;

SELECT
    p.project_name,
    t.external_id,
    t.task_description,
    m.calculated_qpi                                 AS task_qpi,
    (
        SELECT ROUND(AVG(m2.calculated_qpi), 2)
        FROM Metrics m2
        JOIN Tasks   t2 ON m2.task_id   = t2.task_id
        JOIN Sprints s2 ON t2.sprint_id = s2.sprint_id
        WHERE s2.project_id = s.project_id
    )                                                AS project_avg_qpi,
    m.critical_bugs,
    m.tech_debt_hours
FROM Tasks    t
JOIN Sprints  s ON t.sprint_id  = s.sprint_id
JOIN Projects p ON s.project_id = p.project_id
JOIN Metrics  m ON t.task_id    = m.task_id
WHERE m.calculated_qpi < (
    SELECT AVG(m2.calculated_qpi)
    FROM Metrics m2
    JOIN Tasks   t2 ON m2.task_id   = t2.task_id
    JOIN Sprints s2 ON t2.sprint_id = s2.sprint_id
    WHERE s2.project_id = s.project_id
)
ORDER BY p.project_id, m.calculated_qpi;

SELECT
    COUNT(DISTINCT p.project_id)                    AS total_projects,
    COUNT(DISTINCT s.sprint_id)                     AS total_sprints,
    COUNT(DISTINCT t.task_id)                       AS total_tasks,
    COUNT(DISTINCT CASE WHEN t.status='Done' THEN t.task_id END) AS completed_tasks,
    SUM(p.total_budget)                             AS total_portfolio_budget,
    SUM(s.planned_value)                            AS total_pv,
    SUM(CASE WHEN t.status='Done' THEN t.story_points*100 ELSE 0 END) AS total_ev,
    ROUND(AVG(m.calculated_qpi), 2)                AS avg_qpi,
    ROUND(
        SUM(CASE WHEN t.status='Done' THEN t.story_points*100 ELSE 0 END) * 100.0 /
        NULLIF(SUM(t.story_points * 100), 0)
    , 1)                                            AS overall_completion_pct
FROM Projects p
LEFT JOIN Sprints s ON p.project_id = s.project_id
LEFT JOIN Tasks   t ON s.sprint_id  = t.sprint_id
LEFT JOIN Metrics m ON t.task_id    = m.task_id;

SELECT
    p.project_name,
    h.snapshot_date,
    h.total_ev,
    SUM(h.total_ev) OVER (
        PARTITION BY h.project_id
        ORDER BY h.snapshot_date
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    )                                               AS cumulative_ev_trend,
    h.cpi,
    AVG(h.cpi) OVER (
        PARTITION BY h.project_id
        ORDER BY h.snapshot_date
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    )                                               AS rolling_avg_cpi
FROM EVM_History h
JOIN Projects    p ON h.project_id = p.project_id
ORDER BY h.project_id, h.snapshot_date;


SELECT
    p.project_name,
    TO_CHAR(p.end_date, 'DD-MON-YYYY')             AS deadline,
    h.spi,
    h.snapshot_date,
    CASE
        WHEN h.spi < 0.5 THEN 'CRITICAL - Severe Delay'
        WHEN h.spi < 0.8 THEN 'HIGH RISK - Behind Schedule'
        ELSE 'MODERATE'
    END                                             AS schedule_risk,
    h.ai_prediction_eac                            AS forecast_final_cost
FROM EVM_History h
JOIN Projects    p ON h.project_id = p.project_id
-- Most recent snapshot per project
WHERE h.snapshot_date = (
    SELECT MAX(h2.snapshot_date)
    FROM EVM_History h2
    WHERE h2.project_id = h.project_id
)
AND h.spi < 0.8
ORDER BY h.spi;


SELECT
    p.project_name,
    s.sprint_no,
    s.sprint_name,
    COUNT(t.task_id)                                              AS total_tasks,
    COUNT(CASE WHEN t.status = 'Done' THEN 1 END)                 AS done_tasks,
    SUM(CASE WHEN t.status = 'Done' THEN t.story_points ELSE 0 END) AS velocity_points,
    ROUND(
        COUNT(CASE WHEN t.status = 'Done' THEN 1 END) * 100.0 /
        NULLIF(COUNT(t.task_id), 0), 1
    )                                                             AS completion_rate_pct
FROM Sprints  s
JOIN Projects p ON s.project_id = p.project_id
LEFT JOIN Tasks t ON s.sprint_id = t.sprint_id
GROUP BY p.project_id, p.project_name, s.sprint_id, s.sprint_no, s.sprint_name
ORDER BY p.project_id, s.sprint_no;

SELECT
    p.project_name,
    t.external_id,
    t.task_description,
    u.username                  AS assigned_developer,
    t.status,
    m.critical_bugs,
    m.tech_debt_hours,
    m.calculated_qpi,
    'ALERT: Critical bugs on active task' AS alert_type
FROM Tasks    t
JOIN Sprints  s ON t.sprint_id  = s.sprint_id
JOIN Projects p ON s.project_id = p.project_id
JOIN Metrics  m ON t.task_id    = m.task_id
LEFT JOIN Users u ON t.assigned_to = u.user_id
WHERE t.status IN ('In Progress', 'To Do')
  AND m.critical_bugs > 0
ORDER BY m.critical_bugs DESC, m.calculated_qpi;
