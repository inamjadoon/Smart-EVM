import api from "./axiosInstance";

/**
 * Metrics CRUD. Backend supports POST / GET (?task_id=) / DELETE.
 * No PUT endpoint exists on the backend — re-create the row to "update".
 */

const fromApi = (m) => m && { ...m, id: m.metric_id };

const toApi = (payload) => ({
  task_id: Number(payload.task_id),
  tester_id:
    payload.tester_id === "" || payload.tester_id == null
      ? null
      : Number(payload.tester_id),
  critical_bugs: Number(payload.critical_bugs ?? 0),
  major_bugs: Number(payload.major_bugs ?? 0),
  minor_bugs: Number(payload.minor_bugs ?? 0),
  bug_count: Number(payload.bug_count ?? 0),
  code_coverage: Number(payload.code_coverage ?? 85),
  tech_debt_hours: Number(payload.tech_debt_hours ?? 2),
  calculated_qpi: Number(payload.calculated_qpi ?? 100),
});

export const getMetrics = (taskId) =>
  api
    .get("/metrics", { params: taskId ? { task_id: taskId } : {} })
    .then((r) => (r.data || []).map(fromApi));

export const createMetric = (payload) =>
  api.post("/metrics", toApi(payload)).then((r) => r.data);

export const deleteMetric = (id) =>
  api.delete(`/metrics/${id}`).then((r) => r.data);
