import api from "./axiosInstance";

/**
 * Backend uses `sprint_no`. Frontend pages use `sprint_number`.
 * Adapt in both directions.
 */

const fromApi = (s) =>
  s && {
    ...s,
    id: s.sprint_id,
    sprint_number: s.sprint_no,
  };

const toApi = (payload) => {
  const {
    id,
    sprint_id,
    sprint_number,
    sprint_no,
    project_id,
    sprint_name,
    start_date,
    end_date,
    planned_value,
  } = payload || {};
  return {
    project_id: Number(project_id),
    sprint_no: Number(sprint_no ?? sprint_number),
    sprint_name: sprint_name || null,
    start_date: start_date || null,
    end_date: end_date || null,
    planned_value:
      planned_value === "" || planned_value == null
        ? null
        : Number(planned_value),
  };
};

export const getSprints = (projectId) =>
  api
    .get("/sprints", { params: projectId ? { project_id: projectId } : {} })
    .then((r) => (r.data || []).map(fromApi));

export const createSprint = (payload) =>
  api.post("/sprints", toApi(payload)).then((r) => r.data);

export const updateSprint = (id, payload) =>
  api.put(`/sprints/${id}`, toApi(payload)).then((r) => r.data);

export const deleteSprint = (id) =>
  api.delete(`/sprints/${id}`).then((r) => r.data);
