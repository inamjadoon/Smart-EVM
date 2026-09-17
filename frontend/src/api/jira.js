import api from "./axiosInstance";

/**
 * JIRA import endpoints (backend uses Atlassian's public REST API).
 * Available project keys: JRASERVER, CONFSERVER, BSERV, BAM
 */

export const importJira = (projectId, jiraProjectKey = "JRASERVER") =>
  api
    .post(`/import/jira/${projectId}`, { jira_project_key: jiraProjectKey })
    .then((r) => r.data);

export const getImportStatus = (projectId) =>
  api.get(`/import/status/${projectId}`).then((r) => r.data);

export const getAvailableProjects = () =>
  api.get("/import/available-projects").then((r) => r.data);
