

-- 1. Roles
INSERT INTO Roles (role_name) VALUES ('Admin');
INSERT INTO Roles (role_name) VALUES ('Project Manager');
INSERT INTO Roles (role_name) VALUES ('Team Member');
INSERT INTO Roles (role_name) VALUES ('Finance');
INSERT INTO Roles (role_name) VALUES ('QA Tester');

-- 2. Users
INSERT INTO Users (username, password_hash, role_id)
VALUES ('admin1', '$2b$12$adminHashPlaceholder001xxxx', (SELECT role_id FROM Roles WHERE role_name='Admin'));

INSERT INTO Users (username, password_hash, role_id)
VALUES ('pm_sarah', '$2b$12$pmHashPlaceholder001xxxxxx', (SELECT role_id FROM Roles WHERE role_name='Project Manager'));

INSERT INTO Users (username, password_hash, role_id)
VALUES ('pm_ali', '$2b$12$pmHashPlaceholder002xxxxxx', (SELECT role_id FROM Roles WHERE role_name='Project Manager'));

INSERT INTO Users (username, password_hash, role_id)
VALUES ('dev_hamza', '$2b$12$devHashPlaceholder001xxxxx', (SELECT role_id FROM Roles WHERE role_name='Team Member'));

INSERT INTO Users (username, password_hash, role_id)
VALUES ('dev_zara', '$2b$12$devHashPlaceholder002xxxxx', (SELECT role_id FROM Roles WHERE role_name='Team Member'));

INSERT INTO Users (username, password_hash, role_id)
VALUES ('dev_usman', '$2b$12$devHashPlaceholder003xxxxx', (SELECT role_id FROM Roles WHERE role_name='Team Member'));

INSERT INTO Users (username, password_hash, role_id)
VALUES ('qa_fatima', '$2b$12$qaHashPlaceholder001xxxxxx', (SELECT role_id FROM Roles WHERE role_name='QA Tester'));

INSERT INTO Users (username, password_hash, role_id)
VALUES ('finance_omar', '$2b$12$finHashPlaceholder001xxxxx', (SELECT role_id FROM Roles WHERE role_name='Finance'));

-- 3. Projects
INSERT INTO Projects (project_name, total_budget, start_date, end_date, manager_id)
VALUES ('SmartEVM Platform v2.0', 250000,
        '2025-01-01', 
        '2025-06-30',
        (SELECT user_id FROM Users WHERE username = 'pm_sarah'));

INSERT INTO Projects (project_name, total_budget, start_date, end_date, manager_id)
VALUES ('E-Commerce Portal Revamp', 180000,
        '2025-02-01', 
        '2025-07-31',
        (SELECT user_id FROM Users WHERE username = 'pm_ali'));

INSERT INTO Projects (project_name, total_budget, start_date, end_date, manager_id)
VALUES ('Legacy System Migration', 95000,
        '2025-01-15', 
        '2025-05-15',
        (SELECT user_id FROM Users WHERE username = 'pm_sarah'));

-- 4. Sprints
INSERT INTO Sprints (project_id, sprint_no, sprint_name, start_date, end_date, planned_value)
VALUES ((SELECT project_id FROM Projects WHERE project_name='SmartEVM Platform v2.0'),
        1, 'Sprint 1 - Foundation & Auth',
        '2025-01-01', '2025-01-14', 35000);

INSERT INTO Sprints (project_id, sprint_no, sprint_name, start_date, end_date, planned_value)
VALUES ((SELECT project_id FROM Projects WHERE project_name='SmartEVM Platform v2.0'),
        2, 'Sprint 2 - EVM Core Engine',
        '2025-01-15', '2025-01-28', 55000);

INSERT INTO Sprints (project_id, sprint_no, sprint_name, start_date, end_date, planned_value)
VALUES ((SELECT project_id FROM Projects WHERE project_name='SmartEVM Platform v2.0'),
        3, 'Sprint 3 - Dashboard & Reports',
        NULL, NULL, 60000);

INSERT INTO Sprints (project_id, sprint_no, sprint_name, start_date, end_date, planned_value)
VALUES ((SELECT project_id FROM Projects WHERE project_name='E-Commerce Portal Revamp'),
        1, 'Sprint 1 - Product Catalog',
        '2025-02-01', '2025-02-14', 40000);

INSERT INTO Sprints (project_id, sprint_no, sprint_name, start_date, end_date, planned_value)
VALUES ((SELECT project_id FROM Projects WHERE project_name='E-Commerce Portal Revamp'),
        2, 'Sprint 2 - Cart & Checkout',
        '2025-02-15', '2025-02-28', 50000);

INSERT INTO Sprints (project_id, sprint_no, sprint_name, start_date, end_date, planned_value)
VALUES ((SELECT project_id FROM Projects WHERE project_name='E-Commerce Portal Revamp'),
        3, 'Sprint 3 - Payment Gateway',
        NULL, NULL, 45000);

INSERT INTO Sprints (project_id, sprint_no, sprint_name, start_date, end_date, planned_value)
VALUES ((SELECT project_id FROM Projects WHERE project_name='Legacy System Migration'),
        1, 'Sprint 1 - Database Extraction',
        '2025-01-15', '2025-01-31', 28000);

INSERT INTO Sprints (project_id, sprint_no, sprint_name, start_date, end_date, planned_value)
VALUES ((SELECT project_id FROM Projects WHERE project_name='Legacy System Migration'),
        2, 'Sprint 2 - API Refactoring',
        '2025-02-01', '2025-02-28', 35000);

INSERT INTO Sprints (project_id, sprint_no, sprint_name, start_date, end_date, planned_value)
VALUES ((SELECT project_id FROM Projects WHERE project_name='Legacy System Migration'),
        3, 'Sprint 3 - UAT & Deployment',
        '2025-03-01', '2025-03-31', 32000);

-- 5. Tasks
INSERT INTO Tasks (sprint_id, assigned_to, external_id, task_description, status, story_points)
VALUES (
  (SELECT sprint_id FROM Sprints WHERE sprint_name='Sprint 1 - Foundation & Auth'),
  (SELECT user_id FROM Users WHERE username='dev_hamza'),
  'SEVM-101', 'Implement JWT-based user authentication', 'Done', 8);

INSERT INTO Tasks (sprint_id, assigned_to, external_id, task_description, status, story_points)
VALUES (
  (SELECT sprint_id FROM Sprints WHERE sprint_name='Sprint 1 - Foundation & Auth'),
  (SELECT user_id FROM Users WHERE username='dev_zara'),
  'SEVM-102', 'Setup PostgreSQL DB connection pool with psycopg2 driver', 'Done', 5);

INSERT INTO Tasks (sprint_id, assigned_to, external_id, task_description, status, story_points)
VALUES (
  (SELECT sprint_id FROM Sprints WHERE sprint_name='Sprint 1 - Foundation & Auth'),
  (SELECT user_id FROM Users WHERE username='dev_usman'),
  'SEVM-103', 'Build role-based access control middleware', 'Done', 8);

INSERT INTO Tasks (sprint_id, assigned_to, external_id, task_description, status, story_points)
VALUES (
  (SELECT sprint_id FROM Sprints WHERE sprint_name='Sprint 2 - EVM Core Engine'),
  (SELECT user_id FROM Users WHERE username='dev_hamza'),
  'SEVM-201', 'Develop EVM calculator module (CPI/SPI/EAC)', 'Done', 13);

INSERT INTO Tasks (sprint_id, assigned_to, external_id, task_description, status, story_points)
VALUES (
  (SELECT sprint_id FROM Sprints WHERE sprint_name='Sprint 2 - EVM Core Engine'),
  (SELECT user_id FROM Users WHERE username='dev_zara'),
  'SEVM-202', 'Build QPI scoring engine with bug weighting', 'Done', 8);

INSERT INTO Tasks (sprint_id, assigned_to, external_id, task_description, status, story_points)
VALUES (
  (SELECT sprint_id FROM Sprints WHERE sprint_name='Sprint 2 - EVM Core Engine'),
  (SELECT user_id FROM Users WHERE username='dev_usman'),
  'SEVM-203', 'Implement EVM history snapshot API endpoint', 'In Progress', 8);

INSERT INTO Tasks (sprint_id, assigned_to, external_id, task_description, status, story_points)
VALUES (
  (SELECT sprint_id FROM Sprints WHERE sprint_name='Sprint 3 - Dashboard & Reports'),
  (SELECT user_id FROM Users WHERE username='dev_hamza'),
  'SEVM-301', 'Build Vue.js EVM dashboard components', 'To Do', 13);

INSERT INTO Tasks (sprint_id, assigned_to, external_id, task_description, status, story_points)
VALUES (
  (SELECT sprint_id FROM Sprints WHERE sprint_name='Sprint 3 - Dashboard & Reports'),
  (SELECT user_id FROM Users WHERE username='dev_zara'),
  'SEVM-302', 'Implement AI forecast chart (EAC trend)', 'To Do', 8);

-- E-Commerce tasks
INSERT INTO Tasks (sprint_id, assigned_to, external_id, task_description, status, story_points)
VALUES (
  (SELECT sprint_id FROM Sprints WHERE sprint_name='Sprint 1 - Product Catalog'),
  (SELECT user_id FROM Users WHERE username='dev_hamza'),
  'EC-101', 'Product listing with filters and pagination', 'Done', 13);

INSERT INTO Tasks (sprint_id, assigned_to, external_id, task_description, status, story_points)
VALUES (
  (SELECT sprint_id FROM Sprints WHERE sprint_name='Sprint 1 - Product Catalog'),
  (SELECT user_id FROM Users WHERE username='dev_usman'),
  'EC-102', 'Product detail page and image gallery', 'Done', 8);

INSERT INTO Tasks (sprint_id, assigned_to, external_id, task_description, status, story_points)
VALUES (
  (SELECT sprint_id FROM Sprints WHERE sprint_name='Sprint 2 - Cart & Checkout'),
  (SELECT user_id FROM Users WHERE username='dev_zara'),
  'EC-201', 'Shopping cart with real-time total calculation', 'In Progress', 8);

INSERT INTO Tasks (sprint_id, assigned_to, external_id, task_description, status, story_points)
VALUES (
  (SELECT sprint_id FROM Sprints WHERE sprint_name='Sprint 2 - Cart & Checkout'),
  (SELECT user_id FROM Users WHERE username='dev_hamza'),
  'EC-202', 'Multi-step checkout form with address validation', 'To Do', 13);

-- Legacy Migration tasks
INSERT INTO Tasks (sprint_id, assigned_to, external_id, task_description, status, story_points)
VALUES (
  (SELECT sprint_id FROM Sprints WHERE sprint_name='Sprint 1 - Database Extraction'),
  (SELECT user_id FROM Users WHERE username='dev_usman'),
  'LM-101', 'Extract and map legacy tables to PostgreSQL schema', 'Done', 21);

INSERT INTO Tasks (sprint_id, assigned_to, external_id, task_description, status, story_points)
VALUES (
  (SELECT sprint_id FROM Sprints WHERE sprint_name='Sprint 2 - API Refactoring'),
  (SELECT user_id FROM Users WHERE username='dev_hamza'),
  'LM-201', 'Refactor 47 SOAP endpoints to REST/FastAPI', 'In Progress', 21);

INSERT INTO Tasks (sprint_id, assigned_to, external_id, task_description, status, story_points)
VALUES (
  (SELECT sprint_id FROM Sprints WHERE sprint_name='Sprint 3 - UAT & Deployment'),
  (SELECT user_id FROM Users WHERE username='dev_zara'),
  'LM-301', 'Deploy to Cloud + run UAT test suite', 'In Progress', 13);

-- 6. Metrics
INSERT INTO Metrics (task_id, tester_id, critical_bugs, major_bugs, minor_bugs, code_coverage, tech_debt_hours, calculated_qpi)
VALUES ((SELECT task_id FROM Tasks WHERE external_id='SEVM-101'),
        (SELECT user_id FROM Users WHERE username='qa_fatima'),
        0, 1, 2, 92.50, 3.0, 96.50);

INSERT INTO Metrics (task_id, tester_id, critical_bugs, major_bugs, minor_bugs, code_coverage, tech_debt_hours, calculated_qpi)
VALUES ((SELECT task_id FROM Tasks WHERE external_id='SEVM-102'),
        (SELECT user_id FROM Users WHERE username='qa_fatima'),
        0, 0, 1, 95.00, 1.0, 99.00);

INSERT INTO Metrics (task_id, tester_id, critical_bugs, major_bugs, minor_bugs, code_coverage, tech_debt_hours, calculated_qpi)
VALUES ((SELECT task_id FROM Tasks WHERE external_id='SEVM-103'),
        (SELECT user_id FROM Users WHERE username='qa_fatima'),
        0, 1, 1, 88.00, 4.0, 93.60);

INSERT INTO Metrics (task_id, tester_id, critical_bugs, major_bugs, minor_bugs, code_coverage, tech_debt_hours, calculated_qpi)
VALUES ((SELECT task_id FROM Tasks WHERE external_id='SEVM-201'),
        (SELECT user_id FROM Users WHERE username='qa_fatima'),
        0, 2, 3, 85.00, 6.0, 89.00);

INSERT INTO Metrics (task_id, tester_id, critical_bugs, major_bugs, minor_bugs, code_coverage, tech_debt_hours, calculated_qpi)
VALUES ((SELECT task_id FROM Tasks WHERE external_id='SEVM-202'),
        (SELECT user_id FROM Users WHERE username='qa_fatima'),
        0, 0, 2, 90.00, 2.0, 96.00);

-- E-Commerce tasks
INSERT INTO Metrics (task_id, tester_id, critical_bugs, major_bugs, minor_bugs, code_coverage, tech_debt_hours, calculated_qpi)
VALUES ((SELECT task_id FROM Tasks WHERE external_id='EC-101'),
        (SELECT user_id FROM Users WHERE username='qa_fatima'),
        1, 2, 4, 75.00, 8.0, 76.00);

INSERT INTO Metrics (task_id, tester_id, critical_bugs, major_bugs, minor_bugs, code_coverage, tech_debt_hours, calculated_qpi)
VALUES ((SELECT task_id FROM Tasks WHERE external_id='EC-102'),
        (SELECT user_id FROM Users WHERE username='qa_fatima'),
        0, 3, 2, 70.00, 10.0, 77.00);

-- Legacy Migration tasks (high bug counts — that's why it's Red)
INSERT INTO Metrics (task_id, tester_id, critical_bugs, major_bugs, minor_bugs, code_coverage, tech_debt_hours, calculated_qpi)
VALUES ((SELECT task_id FROM Tasks WHERE external_id='LM-101'),
        (SELECT user_id FROM Users WHERE username='qa_fatima'),
        2, 5, 8, 55.00, 22.0, 46.40);

INSERT INTO Metrics (task_id, tester_id, critical_bugs, major_bugs, minor_bugs, code_coverage, tech_debt_hours, calculated_qpi)
VALUES ((SELECT task_id FROM Tasks WHERE external_id='LM-201'),
        (SELECT user_id FROM Users WHERE username='qa_fatima'),
        3, 4, 6, 48.00, 35.0, 36.60);

INSERT INTO Metrics (task_id, tester_id, critical_bugs, major_bugs, minor_bugs, code_coverage, tech_debt_hours, calculated_qpi)
VALUES ((SELECT task_id FROM Tasks WHERE external_id='LM-301'),
        (SELECT user_id FROM Users WHERE username='qa_fatima'),
        1, 3, 5, 60.00, 18.0, 58.40);

-- 7. EVM History Snapshots
INSERT INTO EVM_History (project_id, snapshot_date, total_pv, total_ev, total_ac, cpi, spi, qpi, ai_prediction_eac, ai_variance_at_completion)
VALUES (
  (SELECT project_id FROM Projects WHERE project_name='SmartEVM Platform v2.0'),
  TIMESTAMP '2025-01-14 18:00:00',
  150000, 42000, 35000, 1.20, 0.28, 95.03, 208333, 41667);

INSERT INTO EVM_History (project_id, snapshot_date, total_pv, total_ev, total_ac, cpi, spi, qpi, ai_prediction_eac, ai_variance_at_completion)
VALUES (
  (SELECT project_id FROM Projects WHERE project_name='SmartEVM Platform v2.0'),
  TIMESTAMP '2025-01-28 18:00:00',
  150000, 85000, 90000, 0.94, 0.57, 94.82, 265957, -15957);

INSERT INTO EVM_History (project_id, snapshot_date, total_pv, total_ev, total_ac, cpi, spi, qpi, ai_prediction_eac, ai_variance_at_completion)
VALUES (
  (SELECT project_id FROM Projects WHERE project_name='E-Commerce Portal Revamp'),
  TIMESTAMP '2025-02-14 18:00:00',
  135000, 35000, 40000, 0.88, 0.26, 76.50, 204545, -24545);

INSERT INTO EVM_History (project_id, snapshot_date, total_pv, total_ev, total_ac, cpi, spi, qpi, ai_prediction_eac, ai_variance_at_completion)
VALUES (
  (SELECT project_id FROM Projects WHERE project_name='E-Commerce Portal Revamp'),
  TIMESTAMP '2025-02-28 18:00:00',
  135000, 56000, 90000, 0.62, 0.41, 76.50, 290322, -110322);

INSERT INTO EVM_History (project_id, snapshot_date, total_pv, total_ev, total_ac, cpi, spi, qpi, ai_prediction_eac, ai_variance_at_completion)
VALUES (
  (SELECT project_id FROM Projects WHERE project_name='Legacy System Migration'),
  TIMESTAMP '2025-01-31 18:00:00',
  95000, 21000, 28000, 0.75, 0.22, 46.40, 126666, -31666);

INSERT INTO EVM_History (project_id, snapshot_date, total_pv, total_ev, total_ac, cpi, spi, qpi, ai_prediction_eac, ai_variance_at_completion)
VALUES (
  (SELECT project_id FROM Projects WHERE project_name='Legacy System Migration'),
  TIMESTAMP '2025-02-28 18:00:00',
  95000, 38000, 63000, 0.60, 0.40, 47.13, 158333, -63333);

COMMIT;
