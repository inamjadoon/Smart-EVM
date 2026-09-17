import api from "./axiosInstance";

/**
 * Project Ledger — task-level PV/EV/AC pulled from the backend.
 * Backend route (FastAPI): GET /ledger/{project_id}
 *   -> [{ task_id, sprint_no, sprint_name, task_description, status,
 *         story_points, planned_value, earned_value, actual_cost }]
 *
 * SV/CV/SPI/CPI are derived client-side via src/lib/evm.ts so the
 * formulas live in ONE place.
 */
export const getLedger = (projectId) =>
  api.get(`/ledger/${projectId}`).then((r) => r.data || []);
