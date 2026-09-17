import api from "./axiosInstance";

/**
 * Backend (FastAPI) returns:
 *   { project_id, project_name, total_budget, start_date, end_date, manager_id }
 * Frontend pages were written against:
 *   { id, name, total_budget, start_date, end_date, manager_id }
 *
 * We adapt in BOTH directions here so the UI code does not have to change.
 */

const fromApi = (p) =>
  p && {
    ...p,
    id: p.project_id,
    name: p.project_name,
  };

const toApi = (payload) => {
  const { id, name, project_name, project_id, ...rest } = payload || {};
  return {
    project_name: project_name ?? name ?? "",
    total_budget:
      rest.total_budget === "" || rest.total_budget == null
        ? null
        : Number(rest.total_budget),
    start_date: rest.start_date || null,
    end_date: rest.end_date || null,
    manager_id:
      rest.manager_id === "" || rest.manager_id == null
        ? null
        : Number(rest.manager_id),
  };
};

export const getProjects = () =>
  api.get("/projects").then((r) => (r.data || []).map(fromApi));

export const getProject = (id) =>
  api.get(`/projects/${id}`).then((r) => fromApi(r.data));

export const createProject = (payload) =>
  api.post("/projects", toApi(payload)).then((r) => r.data);

export const updateProject = (id, payload) =>
  api.put(`/projects/${id}`, toApi(payload)).then((r) => r.data);

export const deleteProject = (id) =>
  api.delete(`/projects/${id}`).then((r) => r.data);

/**
 * JIRA sync. Backend accepts an optional body { jira_project_key }.
 * Defaults to "JRASERVER" so the existing UI button works without changes.
 */
export const syncJira = (projectId, jiraProjectKey = "JRASERVER") =>
  api
    .post(`/import/jira/${projectId}`, { jira_project_key: jiraProjectKey })
    .then((r) => r.data);

export const getJiraImportStatus = (projectId) =>
  api.get(`/import/status/${projectId}`).then((r) => r.data);

export const getAvailableJiraProjects = () =>
  api.get("/import/available-projects").then((r) => r.data);

export const getUsers = () =>
  api.get("/users").then((r) => r.data || []);
