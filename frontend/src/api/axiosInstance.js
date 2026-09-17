/**
 * SmartEVM axios client.
 *
 * - When VITE_API_BASE_URL is set → real axios call against the FastAPI
 *   backend (PostgreSQL), with an Auth0 JWT attached as Bearer token.
 * - Otherwise → falls back to the mock layer below so the Lovable preview
 *   keeps rendering with realistic data.
 *
 * Env vars (frontend .env):
 *   VITE_API_BASE_URL=http://localhost:8000
 *   VITE_AUTH0_DOMAIN=...
 *   VITE_AUTH0_CLIENT_ID=...
 *   VITE_AUTH0_AUDIENCE=https://api.smartevm.io   (optional)
 */
import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

// ---- Auth bridge -----------------------------------------------------------
let _tokenGetter = async () => null;
export const setAccessTokenGetter = (fn) => { _tokenGetter = fn || (async () => null); };

// ---- Real axios instance ---------------------------------------------------
const real = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

real.interceptors.request.use(async (config) => {
  try {
    const t = await _tokenGetter();
    if (t) config.headers.Authorization = `Bearer ${t}`;
  } catch {}
  return config;
});

real.interceptors.response.use(
  (r) => r,
  (err) => {
    const msg =
      err?.response?.data?.detail ||
      err?.response?.data?.message ||
      err?.message ||
      "Network error";
    return Promise.reject(new Error(msg));
  }
);

// ---- Mock fallback (used when VITE_API_BASE_URL is not set) ---------------
let _nextProjectId = 7;
let _nextSprintId = 10000;
let _nextTaskId = 900000;
let _nextMetricId = 1;
let projects = [
  { project_id: 1, project_name: "Atlas Payments Platform", total_budget: 850000, start_date: "2025-01-15", end_date: "2026-03-30", manager_id: 12 },
  { project_id: 2, project_name: "Helios Mobile Banking",   total_budget: 620000, start_date: "2025-03-01", end_date: "2026-01-20", manager_id: 7  },
  { project_id: 3, project_name: "Orion Fraud Detection",   total_budget: 410000, start_date: "2025-04-10", end_date: "2025-12-15", manager_id: 14 },
  { project_id: 4, project_name: "Vertex Analytics Suite",  total_budget: 295000, start_date: "2025-05-22", end_date: "2026-02-28", manager_id: 9  },
  { project_id: 5, project_name: "Nimbus Cloud Migration",  total_budget: 1100000,start_date: "2024-11-05", end_date: "2026-05-30", manager_id: 12 },
  { project_id: 6, project_name: "Quanta Risk Engine",      total_budget: 540000, start_date: "2025-02-18", end_date: "2025-11-30", manager_id: 5  },
];
const metrics = [];
const evmByProject = {
  1: { cpi: 1.04, spi: 0.97, qpi: 0.93, health: "Green",  sprint_count: 8,  task_count: 142, total_pv: 520000, total_ev: 504400, total_ac: 485000, ai_prediction_eac: 821000,  ai_variance_at_completion: 29000  },
  2: { cpi: 0.91, spi: 0.88, qpi: 0.86, health: "Yellow", sprint_count: 6,  task_count: 96,  total_pv: 360000, total_ev: 316800, total_ac: 348000, ai_prediction_eac: 681000,  ai_variance_at_completion: -61000 },
  3: { cpi: 1.12, spi: 1.05, qpi: 0.95, health: "Green",  sprint_count: 5,  task_count: 78,  total_pv: 245000, total_ev: 257250, total_ac: 229000, ai_prediction_eac: 366000,  ai_variance_at_completion: 44000  },
  4: { cpi: 0.78, spi: 0.74, qpi: 0.81, health: "Red",    sprint_count: 4,  task_count: 54,  total_pv: 180000, total_ev: 133200, total_ac: 170000, ai_prediction_eac: 378000,  ai_variance_at_completion: -83000 },
  5: { cpi: 1.01, spi: 0.99, qpi: 0.92, health: "Green",  sprint_count: 11, task_count: 218, total_pv: 720000, total_ev: 712800, total_ac: 705000, ai_prediction_eac: 1089000, ai_variance_at_completion: 11000  },
  6: { cpi: 0.88, spi: 0.92, qpi: 0.87, health: "Yellow", sprint_count: 7,  task_count: 110, total_pv: 320000, total_ev: 294400, total_ac: 334000, ai_prediction_eac: 613000,  ai_variance_at_completion: -73000 },
};
const sprintNames = ["Foundation","Authentication","Core API","Payments","Notifications","Reporting","Hardening","Launch Prep","Beta Rollout","Performance","Post-Launch"];
const sprintsByProject = {};
Object.keys(evmByProject).forEach((pid) => {
  const meta = evmByProject[pid];
  sprintsByProject[pid] = Array.from({ length: meta.sprint_count }, (_, i) => {
    const planned = 60000 + i * 8000;
    const earned  = Math.round(planned * (0.85 + ((i * 7) % 25) / 100));
    return {
      sprint_id: Number(pid) * 100 + i + 1, project_id: Number(pid), sprint_no: i + 1,
      sprint_name: sprintNames[i % sprintNames.length],
      start_date: `2025-0${(i % 9) + 1}-01`, end_date: `2025-0${(i % 9) + 1}-14`,
      planned_value: planned, earned_value: earned,
    };
  });
});
const sprintBreakdownByProject = {};
Object.keys(evmByProject).forEach((pid) => {
  sprintBreakdownByProject[pid] = sprintsByProject[pid].map((s, i) => ({
    sprint_id: s.sprint_id, sprint_no: s.sprint_no, sprint_name: s.sprint_name,
    planned_value: s.planned_value, earned_value: s.earned_value,
    spi: +(s.earned_value / s.planned_value).toFixed(2),
    total_tasks: 14 + i, done_tasks: 10 + i, total_points: 42 + i * 3, done_points: 30 + i * 3,
  }));
});
const taskDescs = [
  "Implement OAuth2 login flow","Refactor payments microservice","Add Prometheus metrics",
  "Migrate user table to UUID","Build admin audit log UI","Optimize fraud-scoring SQL",
  "Patch CVE-2025-1142 in deps","Write E2E checkout tests","Localize transactional emails",
  "Roll out feature flags v2","Cache hot dashboard queries","Add Stripe webhook retries",
  "Wire Sentry to mobile build","Index ledger by tenant_id","Implement SCIM provisioning",
];
const assignees = ["A. Patel","M. Chen","S. Johnson","R. Garcia","K. Yamada","E. Müller","P. Singh","L. Dupont"];
const statuses  = ["Done","In Progress","To Do"];
const tasksBySprint = {};
Object.values(sprintsByProject).flat().forEach((s) => {
  tasksBySprint[s.sprint_id] = Array.from({ length: 8 }, (_, i) => {
    const points = [3, 5, 8, 13, 5, 3, 8, 5][i];
    const status = statuses[i % 3];
    const pv = points * 1200;
    const ev = status === "Done" ? pv : status === "In Progress" ? Math.round(pv * 0.5) : 0;
    const ac = Math.round(ev * (0.85 + ((i * 11) % 30) / 100)) + (status === "In Progress" ? 800 : 0);
    return {
      task_id: s.sprint_id * 100 + i + 1, sprint_id: s.sprint_id,
      assigned_to: assignees[(s.sprint_id + i) % assignees.length],
      task_description: taskDescs[(s.sprint_id + i) % taskDescs.length],
      status, story_points: points,
      planned_value: pv, earned_value: ev, actual_cost: ac,
    };
  });
});
const evmHistoryByProject = {};
Object.keys(evmByProject).forEach((pid) => {
  const meta = evmByProject[pid];
  evmHistoryByProject[pid] = Array.from({ length: 8 }, (_, i) => {
    const t = (i + 1) / 8;
    return {
      history_id: i + 1, project_id: Number(pid),
      snapshot_date: `2025-${String(i + 2).padStart(2, "0")}-01`,
      total_pv: Math.round(meta.total_pv * t),
      total_ev: Math.round(meta.total_ev * t * (0.92 + ((i * 13) % 10) / 100)),
      total_ac: Math.round(meta.total_ac * t * (0.95 + ((i * 17) % 8) / 100)),
      cpi: meta.cpi, spi: meta.spi, qpi: meta.qpi,
      ai_prediction_eac: meta.ai_prediction_eac,
      ai_variance_at_completion: meta.ai_variance_at_completion,
    };
  });
});
const buildEvm = (pid) => {
  const meta = evmByProject[pid] || evmByProject[1];
  const proj = projects.find((p) => String(p.project_id) === String(pid)) || projects[0];
  return { project_id: Number(pid), project_name: proj.project_name, total_budget: proj.total_budget,
    ...meta, done_story_points: 240, budget_per_point: 100, snapshot_saved: true,
    sprint_breakdown: sprintBreakdownByProject[pid] || [] };
};
// ── ML mock compute functions — driven by actual input values ────────────────
// These mirror the RandomForest logic in ml_router.py so that different
// inputs produce meaningfully different outputs even in mock/preview mode.

function _clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function _round(v, d = 2) { return Math.round(v * 10 ** d) / 10 ** d; }

function _mockCostOverrun(b) {
  const budget     = Number(b.budget)      || 100000;
  const ac         = Number(b.ac)          || 0;
  const cpi        = Number(b.cpi)         || 1;
  const spi        = Number(b.spi)         || 1;
  const complexity = Number(b.complexity)  || 3;
  const duration   = Number(b.duration)    || 12;
  const team_size  = Number(b.team_size)   || 6;

  // Estimate at Completion using CPI-based formula + complexity/team adjustments
  const eac_cpi     = budget / cpi;
  const complexity_premium = (complexity - 3) * 0.04 * budget; // ±4% per complexity step
  const team_discount      = (team_size  - 6) * 0.01 * budget; // -1% per extra person
  const predicted_eac = Math.round(eac_cpi + complexity_premium - team_discount);
  const predicted_variance = budget - predicted_eac; // positive = under budget

  // Overrun probability: CPI & SPI below 1 increase risk, complexity adds risk
  const cpi_risk = _clamp((1.2 - cpi) / 0.8, 0, 1);
  const spi_risk = _clamp((1.1 - spi) / 0.6, 0, 1);
  const cx_risk  = (complexity - 1) / 4;
  const prob_raw = cpi_risk * 0.55 + spi_risk * 0.25 + cx_risk * 0.20;
  const prob     = _round(_clamp(prob_raw, 0.03, 0.97), 3);

  const risk_level = prob >= 0.65 ? "High" : prob >= 0.35 ? "Medium" : "Low";

  // Confidence rises with more data (ac > 0) and closer-to-1 CPI
  const confidence = _round(_clamp(0.75 + (ac > 0 ? 0.08 : 0) + (1 - Math.abs(1 - cpi)) * 0.10, 0.55, 0.97), 3);

  return {
    prediction: predicted_eac > budget ? "Overrun" : "On Budget",
    probability_of_overrun: prob,
    risk_level,
    predicted_eac,
    predicted_variance,
    confidence,
    model: "SmartEVM Mock GBR v1.3",
    overrun_amount: predicted_eac - budget,
    overrun_percent: _round(((predicted_eac - budget) / budget) * 100, 1),
    current_cpi: cpi,
    current_spi: spi,
  };
}

function _mockScheduleSlip(b) {
  const planned      = Number(b.planned_duration_days) || 120;
  const elapsed      = Number(b.elapsed_days)          || 0;
  const spi          = Number(b.spi)                   || 1;
  const completed    = Number(b.completed_pct)         || 0;
  const bugs         = Number(b.bugs)                  || 5;
  const pending      = Number(b.pending_tasks)         || 10;
  const complexity   = Number(b.complexity)            || 3;
  const team_size    = Number(b.team_size)             || 6;

  // Remaining work and expected finish
  const remaining_pct  = Math.max(0, 100 - completed) / 100;
  const remaining_days = planned * remaining_pct;
  const expected_finish = spi > 0 ? remaining_days / spi : remaining_days * 2;
  const delay_days = Math.max(0, Math.round(expected_finish - remaining_days));

  // Slip probability: SPI < 1, many bugs/pending tasks, high complexity → higher
  const spi_risk      = _clamp((1.15 - spi) / 0.65, 0, 1);
  const bug_risk      = _clamp(bugs / 40, 0, 1);
  const pending_risk  = _clamp(pending / 35, 0, 1);
  const cx_risk       = (complexity - 1) / 4;
  const team_mitigation = _clamp((team_size - 2) / 13, 0, 1) * 0.10;
  const prob_raw = spi_risk * 0.50 + bug_risk * 0.20 + pending_risk * 0.15 + cx_risk * 0.15 - team_mitigation;
  const prob     = _round(_clamp(prob_raw, 0.03, 0.97), 3);

  const pred_label = prob >= 0.60 ? "Delay" : prob >= 0.35 ? "Risk" : "OnTime";
  const risk_level = prob >= 0.60 ? "High"  : prob >= 0.35 ? "Medium" : "Low";

  const delay_p   = pred_label === "Delay" ? prob : pred_label === "Risk" ? prob * 0.5 : prob * 0.1;
  const risk_p    = pred_label === "Risk"  ? prob : _clamp(0.3 - Math.abs(prob - 0.35), 0, 1);
  const ontime_p  = _round(Math.max(0, 1 - delay_p - risk_p), 3);

  const confidence = _round(_clamp(0.70 + (elapsed > 0 ? 0.08 : 0) + (1 - Math.abs(1 - spi)) * 0.12, 0.55, 0.97), 3);

  return {
    prediction: pred_label,
    probability_of_slip: prob,
    risk_level,
    predicted_finish_delay_days: delay_days,
    confidence,
    model: "SmartEVM Mock RandomForest v1.1",
    probabilities: { Delay: _round(delay_p, 3), Risk: _round(risk_p, 3), OnTime: _round(ontime_p, 3) },
    spi,
    completed_pct: completed,
  };
}

function _mockDefects(b) {
  const sp          = Number(b.story_points)  || 40;
  const team_size   = Number(b.team_size)     || 6;
  const past        = Number(b.past_defects)  || 5;
  const qpi         = Number(b.qpi)           || 0.9;

  // Defect forecast: high past defects, low QPI, many story points → more defects
  const base_defects = past * (1.5 - _clamp(qpi, 0, 1)) + (sp / Math.max(team_size, 1)) * 0.25;
  const predicted    = Math.max(0, _round(base_defects, 1));

  // Critical share rises as QPI falls
  const critical_share = _round(_clamp((1 - _clamp(qpi, 0, 1)) * 0.45, 0, 0.5), 3);
  const critical_count = critical_share * predicted;
  const recommended_qa_hours = _round(predicted * 2.0 + critical_count * 3.0, 1);

  // Confidence: more past data and stable team → higher confidence
  const confidence = _round(_clamp(0.68 + (past > 0 ? 0.10 : 0) + _clamp(qpi * 0.12, 0, 0.12), 0.50, 0.97), 3);

  return {
    prediction: predicted,
    predicted_defects_next_sprint: predicted,
    expected_defects_next_sprint: predicted,
    critical_share,
    recommended_qa_hours,
    confidence,
    model: "SmartEVM Mock XGBoost v0.9",
    inputs: b,
  };
}

function _mockHealth(b) {
  const cpi          = Number(b.cpi)           || 1;
  const spi          = Number(b.spi)           || 1;
  const qpi          = Number(b.qpi)           || 0.9;
  const velocity     = Number(b.team_velocity) || 30;

  // Score: all metrics above 1 (or high) → Healthy
  const score = cpi * 0.35 + spi * 0.30 + _clamp(qpi, 0, 1.5) * 0.20 + _clamp(velocity / 50, 0, 1) * 0.15;

  let predicted_health, green_p, yellow_p, red_p;
  if (cpi >= 1 && spi >= 1 && qpi >= 0.85) {
    predicted_health = "Green";
    green_p  = _round(_clamp(0.50 + score * 0.30, 0.40, 0.95), 3);
    yellow_p = _round(_clamp((1 - green_p) * 0.65, 0.04, 0.50), 3);
    red_p    = _round(Math.max(0, 1 - green_p - yellow_p), 3);
  } else if (cpi >= 0.80 && spi >= 0.80) {
    predicted_health = "Yellow";
    yellow_p = _round(_clamp(0.45 + (1 - Math.min(cpi, spi)) * 0.30, 0.35, 0.75), 3);
    green_p  = _round(_clamp((1 - yellow_p) * 0.45, 0.05, 0.45), 3);
    red_p    = _round(Math.max(0, 1 - green_p - yellow_p), 3);
  } else {
    predicted_health = "Red";
    red_p    = _round(_clamp(0.50 + (1 - Math.min(cpi, spi)) * 0.40, 0.40, 0.90), 3);
    yellow_p = _round(_clamp((1 - red_p) * 0.55, 0.05, 0.45), 3);
    green_p  = _round(Math.max(0, 1 - red_p - yellow_p), 3);
  }

  const confidence = _round(_clamp(0.72 + Math.abs(score - 0.5) * 0.25, 0.55, 0.97), 3);

  return {
    prediction: predicted_health === "Green" ? "Healthy" : predicted_health === "Yellow" ? "At Risk" : "Critical",
    predicted_health,
    health_color: predicted_health,
    probability: { Green: green_p, Yellow: yellow_p, Red: red_p },
    probabilities: { Healthy: green_p, "At Risk": yellow_p, Critical: red_p },
    confidence,
    model: "SmartEVM Mock LogReg v2.0",
    qpi,
    team_velocity: velocity,
  };
}
const ok = (data) => Promise.resolve({ data });
const err = (msg, status = 400) => Promise.reject(Object.assign(new Error(msg), { response: { status, data: { detail: msg } } }));

const handle = async (method, url, body) => {
  const u = url.split("?")[0];

  // ── Projects ──────────────────────────────────────────────────────────────
  if (method === "GET" && u === "/projects") return ok(projects);
  if (method === "GET" && u.startsWith("/projects/")) {
    const id = u.split("/")[2];
    return ok(projects.find((p) => String(p.project_id) === id));
  }
  if (method === "POST" && u === "/projects") {
    const newP = { project_id: _nextProjectId++, ...body };
    projects.push(newP);
    sprintsByProject[newP.project_id] = [];
    sprintBreakdownByProject[newP.project_id] = [];
    return ok(newP);
  }
  if (method === "PUT" && u.startsWith("/projects/")) {
    const id = Number(u.split("/")[2]);
    const idx = projects.findIndex((p) => p.project_id === id);
    if (idx === -1) return err("Project not found", 404);
    projects[idx] = { ...projects[idx], ...body, project_id: id };
    return ok(projects[idx]);
  }
  if (method === "DELETE" && u.startsWith("/projects/")) {
    const id = Number(u.split("/")[2]);
    const idx = projects.findIndex((p) => p.project_id === id);
    if (idx === -1) return err("Project not found", 404);
    projects.splice(idx, 1);
    delete sprintsByProject[id];
    delete sprintBreakdownByProject[id];
    return ok({ deleted: id });
  }

  // ── Sprints ───────────────────────────────────────────────────────────────
  if (method === "GET" && u === "/sprints") {
    const pid = (url.match(/project_id=(\d+)/) || [])[1];
    return ok(sprintsByProject[pid] || []);
  }
  if (method === "POST" && u === "/sprints") {
    const pid = String(body.project_id);
    const newS = {
      sprint_id: _nextSprintId++,
      project_id: Number(pid),
      sprint_no: body.sprint_no,
      sprint_name: body.sprint_name || null,
      start_date: body.start_date || null,
      end_date: body.end_date || null,
      planned_value: body.planned_value ?? 0,
      earned_value: 0,
    };
    if (!sprintsByProject[pid]) sprintsByProject[pid] = [];
    sprintsByProject[pid].push(newS);
    if (!sprintBreakdownByProject[pid]) sprintBreakdownByProject[pid] = [];
    sprintBreakdownByProject[pid].push({ ...newS, spi: 0, total_tasks: 0, done_tasks: 0, total_points: 0, done_points: 0 });
    tasksBySprint[newS.sprint_id] = [];
    return ok(newS);
  }
  if (method === "PUT" && u.startsWith("/sprints/")) {
    const sid = Number(u.split("/")[2]);
    for (const pid of Object.keys(sprintsByProject)) {
      const arr = sprintsByProject[pid];
      const idx = arr.findIndex((s) => s.sprint_id === sid);
      if (idx !== -1) {
        arr[idx] = { ...arr[idx], ...body, sprint_id: sid };
        return ok(arr[idx]);
      }
    }
    return err("Sprint not found", 404);
  }
  if (method === "DELETE" && u.startsWith("/sprints/")) {
    const sid = Number(u.split("/")[2]);
    for (const pid of Object.keys(sprintsByProject)) {
      const arr = sprintsByProject[pid];
      const idx = arr.findIndex((s) => s.sprint_id === sid);
      if (idx !== -1) {
        arr.splice(idx, 1);
        delete tasksBySprint[sid];
        const bdArr = sprintBreakdownByProject[pid];
        if (bdArr) {
          const bi = bdArr.findIndex((s) => s.sprint_id === sid);
          if (bi !== -1) bdArr.splice(bi, 1);
        }
        return ok({ deleted: sid });
      }
    }
    return err("Sprint not found", 404);
  }

  // ── Tasks ─────────────────────────────────────────────────────────────────
  if (method === "GET" && u === "/tasks") {
    const sid = (url.match(/sprint_id=(\d+)/) || [])[1];
    return ok(tasksBySprint[sid] || []);
  }
  if (method === "POST" && u === "/tasks") {
    const sid = body.sprint_id;
    if (!tasksBySprint[sid]) tasksBySprint[sid] = [];
    const pv = (body.story_points || 0) * 1200;
    const newT = {
      task_id: _nextTaskId++,
      sprint_id: sid,
      assigned_to: body.assigned_to ?? null,
      external_id: body.external_id ?? null,
      task_description: body.task_description ?? null,
      status: body.status || "To Do",
      story_points: body.story_points || 0,
      planned_value: pv,
      earned_value: body.status === "Done" ? pv : body.status === "In Progress" ? Math.round(pv * 0.5) : 0,
      actual_cost: 0,
    };
    tasksBySprint[sid].push(newT);
    return ok(newT);
  }
  if (method === "PUT" && u.startsWith("/tasks/")) {
    const tid = Number(u.split("/")[2]);
    for (const sid of Object.keys(tasksBySprint)) {
      const arr = tasksBySprint[sid];
      const idx = arr.findIndex((t) => t.task_id === tid);
      if (idx !== -1) {
        arr[idx] = { ...arr[idx], ...body, task_id: tid };
        return ok(arr[idx]);
      }
    }
    return err("Task not found", 404);
  }
  if (method === "DELETE" && u.startsWith("/tasks/")) {
    const tid = Number(u.split("/")[2]);
    for (const sid of Object.keys(tasksBySprint)) {
      const arr = tasksBySprint[sid];
      const idx = arr.findIndex((t) => t.task_id === tid);
      if (idx !== -1) {
        arr.splice(idx, 1);
        return ok({ deleted: tid });
      }
    }
    return err("Task not found", 404);
  }

  // ── Metrics ───────────────────────────────────────────────────────────────
  if (method === "GET" && u === "/metrics") {
    const tid = (url.match(/task_id=(\d+)/) || [])[1];
    return ok(tid ? metrics.filter((m) => String(m.task_id) === tid) : metrics);
  }
  if (method === "POST" && u === "/metrics") {
    const newM = { metric_id: _nextMetricId++, ...body };
    metrics.push(newM);
    return ok(newM);
  }
  if (method === "DELETE" && u.startsWith("/metrics/")) {
    const mid = Number(u.split("/")[2]);
    const idx = metrics.findIndex((m) => m.metric_id === mid);
    if (idx !== -1) metrics.splice(idx, 1);
    return ok({ deleted: mid });
  }

  // ── QPI ───────────────────────────────────────────────────────────────────
  if (method === "POST" && u.startsWith("/evm/qpi/")) {
    return ok({ qpi: 92.5, message: "QPI recalculated (mock)" });
  }

  // ── Ledger ────────────────────────────────────────────────────────────────
  if (method === "GET" && u.startsWith("/ledger/")) {
    const pid = u.split("/")[2];
    const sprints = sprintsByProject[pid] || [];
    const rows = [];
    sprints.forEach((s) => (tasksBySprint[s.sprint_id] || []).forEach((t) => rows.push({
      task_id: t.task_id, sprint_name: s.sprint_name, sprint_no: s.sprint_no,
      task_description: t.task_description, status: t.status, story_points: t.story_points,
      planned_value: t.planned_value, earned_value: t.earned_value, actual_cost: t.actual_cost,
    })));
    return ok(rows);
  }

  // ── EVM ───────────────────────────────────────────────────────────────────
  if (u.startsWith("/evm/calculate/")) return ok(buildEvm(u.split("/")[3]));
  if (u.startsWith("/evm/history/"))   return ok(evmHistoryByProject[u.split("/")[3]] || []);

  // ── ML ────────────────────────────────────────────────────────────────────
  if (u.startsWith("/ml/whatif")) {
    const cap = Number((body && body.capacity_pct) ?? 0);
    const base = (body && body.base_eac) || 900000;
    const adj  = base * (1 - cap / 200);
    return ok({ baseline_eac: base, adjusted_eac: Math.round(adj),
      delta: Math.round(adj - base), capacity_pct: cap,
      curve: Array.from({ length: 11 }, (_, i) => {
        const c = -50 + i * 10;
        return { capacity_pct: c, eac: Math.round(base * (1 - c / 200)) };
      }),
      model: "In-Memory Monte Carlo v1" });
  }
  // ML endpoints — compute from actual input body so different inputs → different outputs
  if (u === "/ml/cost-overrun")  return ok(_mockCostOverrun(body  || {}));
  if (u === "/ml/schedule-slip") return ok(_mockScheduleSlip(body || {}));
  if (u === "/ml/defects")       return ok(_mockDefects(body      || {}));
  if (u === "/ml/health")        return ok(_mockHealth(body       || {}));
  if (u === "/ml/risk-index") {
    const cpi = Number((body && body.cpi) || 0.9);
    const spi = Number((body && body.spi) || 0.9);
    return ok({ high_risk: cpi < 0.85 && spi < 0.85, breaches: 1, snapshots_evaluated: 8,
      threshold: { cpi: 0.85, spi: 0.85 }, model: "SmartEVM Risk Rule v1" });
  }
  if (u === "/ml/anomalies") return ok({ anomalies: [
    { task_id: 412, type: "status_regression", from: "Done", to: "In Progress", date: "2025-08-12", impact_ev: -3200, severity: "High" },
    { task_id: 318, type: "cost_spike", date: "2025-09-04", impact_ac: 4100, severity: "Medium" },
  ], model: "ML Anomaly Detection" });
  if (u.startsWith("/ml/")) return ok({ result: "ok" });

  // ── JIRA sync — fetch real open-source Atlassian public data ─────────────
  if (u === "/sync-jira" || u.startsWith("/import/jira/")) {
    const pidMatch = u.match(/\/import\/jira\/(\d+)/);
    const pid = pidMatch ? pidMatch[1] : (body && String(body.project_id)) || null;

    // Determine which Jira project key to use (rotate through available keys)
    const jiraKeys = ["JRASERVER", "CONFSERVER", "BSERV", "BAM"];
    const jiraKey = (body && body.jira_project_key) || jiraKeys[Number(pid || 1) % jiraKeys.length];

    // Fetch issues from the Atlassian public JIRA REST API
    const jiraBase = "https://jira.atlassian.com/rest/api/2";
    const fetchJiraIssues = async (projectKey) => {
      try {
        const res = await fetch(
          `${jiraBase}/search?jql=project=${projectKey}+AND+issuetype=Story+ORDER+BY+created+DESC&maxResults=20&fields=summary,status,story_points,customfield_10016,assignee,created,updated,priority`,
          { headers: { "Accept": "application/json" } }
        );
        if (!res.ok) throw new Error("Jira fetch failed");
        const data = await res.json();
        return data.issues || [];
      } catch {
        return [];
      }
    };

    const jiraIssues = await fetchJiraIssues(jiraKey);

    if (pid) {
      if (!sprintsByProject[pid]) sprintsByProject[pid] = [];
      const existingNos = new Set(sprintsByProject[pid].map((s) => s.sprint_no));

      // Group issues into "sprints" of up to 8 issues each (simulating Jira board sprints)
      const chunkSize = 8;
      const chunks = [];
      if (jiraIssues.length > 0) {
        for (let i = 0; i < Math.min(jiraIssues.length, 24); i += chunkSize) {
          chunks.push(jiraIssues.slice(i, i + chunkSize));
        }
      } else {
        // Fallback if Jira API is unreachable — use realistic Jira-style data
        const fallbackIssues = [
          { key: `${jiraKey}-101`, fields: { summary: "Implement OAuth2 login flow", status: { name: "Done" }, customfield_10016: 8, assignee: { displayName: "Alice Chen" }, priority: { name: "High" } } },
          { key: `${jiraKey}-102`, fields: { summary: "Add Prometheus metrics endpoint", status: { name: "In Progress" }, customfield_10016: 5, assignee: { displayName: "Bob Singh" }, priority: { name: "Medium" } } },
          { key: `${jiraKey}-103`, fields: { summary: "Migrate user table to UUID keys", status: { name: "Done" }, customfield_10016: 13, assignee: { displayName: "Carol Wu" }, priority: { name: "High" } } },
          { key: `${jiraKey}-104`, fields: { summary: "Optimize fraud-scoring SQL query", status: { name: "Done" }, customfield_10016: 5, assignee: { displayName: "Dan Okafor" }, priority: { name: "High" } } },
          { key: `${jiraKey}-105`, fields: { summary: "Build admin audit log UI", status: { name: "To Do" }, customfield_10016: 3, assignee: null, priority: { name: "Low" } } },
          { key: `${jiraKey}-106`, fields: { summary: "Patch CVE-2025-1142 in dependencies", status: { name: "Done" }, customfield_10016: 3, assignee: { displayName: "Alice Chen" }, priority: { name: "Critical" } } },
          { key: `${jiraKey}-107`, fields: { summary: "Write E2E checkout tests", status: { name: "In Progress" }, customfield_10016: 8, assignee: { displayName: "Eve Müller" }, priority: { name: "Medium" } } },
          { key: `${jiraKey}-108`, fields: { summary: "Localize transactional emails", status: { name: "To Do" }, customfield_10016: 5, assignee: { displayName: "Frank Li" }, priority: { name: "Low" } } },
          { key: `${jiraKey}-109`, fields: { summary: "Cache hot dashboard queries", status: { name: "Done" }, customfield_10016: 8, assignee: { displayName: "Bob Singh" }, priority: { name: "High" } } },
          { key: `${jiraKey}-110`, fields: { summary: "Add Stripe webhook retries", status: { name: "In Progress" }, customfield_10016: 5, assignee: { displayName: "Carol Wu" }, priority: { name: "Medium" } } },
          { key: `${jiraKey}-111`, fields: { summary: "Roll out feature flags v2", status: { name: "Done" }, customfield_10016: 13, assignee: { displayName: "Dan Okafor" }, priority: { name: "High" } } },
          { key: `${jiraKey}-112`, fields: { summary: "Index ledger by tenant_id", status: { name: "To Do" }, customfield_10016: 3, assignee: null, priority: { name: "Medium" } } },
          { key: `${jiraKey}-113`, fields: { summary: "Implement SCIM provisioning", status: { name: "In Progress" }, customfield_10016: 21, assignee: { displayName: "Alice Chen" }, priority: { name: "High" } } },
          { key: `${jiraKey}-114`, fields: { summary: "Wire Sentry to mobile build", status: { name: "Done" }, customfield_10016: 3, assignee: { displayName: "Eve Müller" }, priority: { name: "Medium" } } },
          { key: `${jiraKey}-115`, fields: { summary: "Refactor payments microservice", status: { name: "In Progress" }, customfield_10016: 13, assignee: { displayName: "Frank Li" }, priority: { name: "High" } } },
          { key: `${jiraKey}-116`, fields: { summary: "Performance-test the API gateway", status: { name: "To Do" }, customfield_10016: 8, assignee: null, priority: { name: "Medium" } } },
        ];
        for (let i = 0; i < fallbackIssues.length; i += chunkSize) {
          chunks.push(fallbackIssues.slice(i, i + chunkSize));
        }
      }

      let totalImported = 0;
      const sprintNames = [`${jiraKey} Sprint 1`, `${jiraKey} Sprint 2`, `${jiraKey} Sprint 3`];

      chunks.forEach((issueChunk, chunkIdx) => {
        const sprintNo = 800 + chunkIdx;
        if (existingNos.has(sprintNo)) return; // already imported this sprint

        const sid = _nextSprintId++;
        const sprintName = sprintNames[chunkIdx] || `${jiraKey} Sprint ${chunkIdx + 1}`;

        // Calculate planned_value from story points
        const totalPoints = issueChunk.reduce((sum, issue) => sum + (issue.fields.customfield_10016 || issue.fields.story_points || 5), 0);
        const plannedValue = totalPoints * 1200;

        const newSprint = {
          sprint_id: sid,
          project_id: Number(pid),
          sprint_no: sprintNo,
          sprint_name: sprintName,
          start_date: `2025-0${(chunkIdx + 6) % 9 + 1}-01`,
          end_date: `2025-0${(chunkIdx + 6) % 9 + 1}-14`,
          planned_value: plannedValue,
          earned_value: Math.round(plannedValue * 0.78),
        };
        sprintsByProject[pid].push(newSprint);
        if (!sprintBreakdownByProject[pid]) sprintBreakdownByProject[pid] = [];
        sprintBreakdownByProject[pid].push({
          ...newSprint,
          spi: 0.78,
          total_tasks: issueChunk.length,
          done_tasks: issueChunk.filter((i) => i.fields.status?.name === "Done").length,
          total_points: totalPoints,
          done_points: issueChunk.filter((i) => i.fields.status?.name === "Done").reduce((s, i) => s + (i.fields.customfield_10016 || 5), 0),
        });

        // Create tasks from issues
        tasksBySprint[sid] = issueChunk.map((issue) => {
          const sp = issue.fields.customfield_10016 || issue.fields.story_points || 5;
          const pv = sp * 1200;
          const status = issue.fields.status?.name === "Done" ? "Done"
            : issue.fields.status?.name === "In Progress" ? "In Progress" : "To Do";
          const ev = status === "Done" ? pv : status === "In Progress" ? Math.round(pv * 0.5) : 0;
          return {
            task_id: _nextTaskId++,
            sprint_id: sid,
            external_id: issue.key,
            assigned_to: null,
            task_description: `[${issue.key}] ${issue.fields.summary || "Imported from Jira"}`,
            status,
            story_points: sp,
            planned_value: pv,
            earned_value: ev,
            actual_cost: Math.round(ev * 0.92),
          };
        });
        totalImported += issueChunk.length;
      });

      return ok({ status: "ok", imported: totalImported, jira_project: jiraKey, last_synced: new Date().toISOString() });
    }
    return ok({ status: "ok", imported: 0, last_synced: new Date().toISOString() });
  }

  return ok({ ok: true });
};

const mockClient = {
  get:    (url, cfg) => {
    const params = cfg && cfg.params;
    if (params && Object.keys(params).length) {
      const qs = Object.entries(params).map(([k, v]) => `${k}=${v}`).join("&");
      url = url + (url.includes("?") ? "&" : "?") + qs;
    }
    return handle("GET", url);
  },
  post:   (url, body) => handle("POST", url, body),
  put:    (url, body) => handle("PUT", url, body),
  delete: (url)       => handle("DELETE", url),
};

const client = BASE_URL ? real : mockClient;
export const isMockMode = !BASE_URL;
export default client;
