import api from "./axiosInstance";

/**
 * Predictive ML — backed by Oracle 26ai (DBMS_DATA_MINING / SQL MODEL clause).
 * FastAPI surfaces them at /ml/*. Frontend just sends/receives JSON.
 */
export const predictCostOverrun  = (p) => api.post("/ml/cost-overrun",  p).then((r) => r.data);
export const predictScheduleSlip = (p) => api.post("/ml/schedule-slip", p).then((r) => r.data);
export const predictDefects      = (p) => api.post("/ml/defects",       p).then((r) => r.data);
export const predictHealth       = (p) => api.post("/ml/health",        p).then((r) => r.data);

/** Risk Probability Index — flag High Risk if CPI<0.85 AND SPI<0.85 across ≥3 snapshots. */
export const getRiskIndex        = (projectId) => api.get(`/ml/risk-index`, { params: { project_id: projectId } }).then((r) => r.data);

/** Anomalous Data Normalizer — Jira regressions / suspicious EV jumps. */
export const getAnomalies        = (projectId) => api.get(`/ml/anomalies`, { params: { project_id: projectId } }).then((r) => r.data);

/** Monte Carlo What-If — recompute EAC at +/- capacity. */
export const runWhatIf           = (projectId, capacity_pct, base_eac) =>
  api.post("/ml/whatif", { project_id: Number(projectId), capacity_pct: Number(capacity_pct), base_eac: Number(base_eac) }).then((r) => r.data);

/** Jira sync (button on Projects + Intelligence). */
export const syncJiraNow         = (projectId) => api.post("/sync-jira", { project_id: Number(projectId) }).then((r) => r.data);
