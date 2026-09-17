import api from "./axiosInstance";

/**
 * EVM endpoints.
 *
 * Backend response from POST /evm/calculate/{project_id}:
 *   {
 *     project_id, project_name, total_budget,
 *     total_pv, total_ev, total_ac,
 *     cpi, spi, qpi,
 *     ai_prediction_eac, ai_variance_at_completion,
 *     done_story_points, budget_per_point,
 *     sprint_count, task_count, health, snapshot_saved,
 *     sprint_breakdown: [
 *       { sprint_id, sprint_no, sprint_name, planned_value, earned_value,
 *         spi, total_tasks, done_tasks, total_points, done_points }
 *     ]
 *   }
 *
 * Frontend EVMDashboard uses: cpi, spi, qpi, health, eac, vac,
 *   sprint_breakdown[].{ sprint_name, sprint_number, pv, ev, spi, total_tasks, done_tasks }
 *
 * Backend response from GET /evm/history/{project_id}:
 *   [{ history_id, project_id, snapshot_date, total_pv, total_ev, total_ac, cpi, spi, qpi,
 *      ai_prediction_eac, ai_variance_at_completion }]
 * Frontend chart expects: { snapshot_date, pv, ev, ac }
 *
 * We normalize both shapes here so the pages render unchanged.
 */

const adaptSprintBreakdown = (s) =>
  s && {
    ...s,
    sprint_number: s.sprint_no,
    pv: s.planned_value,
    ev: s.earned_value,
  };

const adaptEvmResult = (e) =>
  e && {
    ...e,
    eac: e.ai_prediction_eac,
    vac: e.ai_variance_at_completion,
    pv: e.total_pv,
    ev: e.total_ev,
    ac: e.total_ac,
    sprint_breakdown: (e.sprint_breakdown || []).map(adaptSprintBreakdown),
  };

const adaptHistoryRow = (h) =>
  h && {
    ...h,
    pv: h.total_pv,
    ev: h.total_ev,
    ac: h.total_ac,
    eac: h.ai_prediction_eac,
    vac: h.ai_variance_at_completion,
  };

/**
 * POST /evm/calculate/{id} — runs calculation AND saves a snapshot.
 * Optional body: { budget_per_point?: number, save_snapshot?: boolean }
 */
export const calculateEvm = (projectId, body = {}) =>
  api
    .post(`/evm/calculate/${projectId}`, {
      budget_per_point: Number(body.budget_per_point ?? 100),
      save_snapshot: body.save_snapshot ?? true,
    })
    .then((r) => adaptEvmResult(r.data));

/** GET /evm/calculate/{id} — quick read, does NOT save a snapshot. */
export const getEvmSummary = (projectId, budgetPerPoint = 100) =>
  api
    .get(`/evm/calculate/${projectId}`, {
      params: { budget_per_point: budgetPerPoint },
    })
    .then((r) => adaptEvmResult(r.data));

export const getEvmHistory = (projectId) =>
  api
    .get(`/evm/history/${projectId}`)
    .then((r) => (r.data || []).map(adaptHistoryRow));
