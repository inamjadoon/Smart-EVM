import api from "./axiosInstance";

/**
 * Backend Tasks fields:
 *   { task_id, sprint_id, assigned_to (int|null), external_id,
 *     task_description, status, story_points }
 *
 * Frontend pages use:
 *   { id, description, assigned_user, status, story_points, sprint_id }
 *
 * `assigned_user` in the UI is a free-text input. Backend expects an int user_id.
 * We coerce: empty string -> null, numeric string -> Number, else null.
 */

const fromApi = (t) =>
  t && {
    ...t,
    id: t.task_id,
    description: t.task_description,
    assigned_user: t.assigned_to ?? "",
  };

const toAssignedTo = (v) => {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const toApi = (payload) => {
  const {
    sprint_id,
    description,
    task_description,
    assigned_user,
    assigned_to,
    external_id,
    status,
    story_points,
  } = payload || {};
  return {
    sprint_id: Number(sprint_id),
    assigned_to: toAssignedTo(assigned_to ?? assigned_user),
    external_id: external_id || null,
    task_description: task_description ?? description ?? null,
    status: status || "To Do",
    story_points:
      story_points === "" || story_points == null ? 0 : Number(story_points),
  };
};

export const getTasks = (sprintId) =>
  api
    .get("/tasks", { params: sprintId ? { sprint_id: sprintId } : {} })
    .then((r) => (r.data || []).map(fromApi));

export const createTask = (payload) =>
  api.post("/tasks", toApi(payload)).then((r) => r.data);

export const updateTask = (id, payload) =>
  api.put(`/tasks/${id}`, toApi(payload)).then((r) => r.data);

export const deleteTask = (id) =>
  api.delete(`/tasks/${id}`).then((r) => r.data);

/**
 * Backend QPI endpoint REQUIRES a body with bug counts / coverage.
 * The original UI button passed nothing — we send safe defaults so the call
 * succeeds. Pass a real payload from a future detail page if you want
 * accurate recalculation.
 */
export const recalculateQpi = (taskId, payload = {}) => {
  const body = {
    critical_bugs: Number(payload.critical_bugs ?? 0),
    major_bugs: Number(payload.major_bugs ?? 0),
    minor_bugs: Number(payload.minor_bugs ?? 0),
    code_coverage: Number(payload.code_coverage ?? 85),
    tech_debt_hours: Number(payload.tech_debt_hours ?? 2),
  };
  return api.post(`/evm/qpi/${taskId}`, body).then((r) => r.data);
};
