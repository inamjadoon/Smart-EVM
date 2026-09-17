import api from "./axiosInstance";

export interface ProjectInsightResponse {
  summary: string;
  risks: string[];
  recommendations: string[];
  source: "llm" | "rule_based" | string;
}

export interface ChatResponse {
  reply: string;
  source: "llm" | "rule_based" | string;
}

export interface GenAiHealthResponse {
  status: string;
  llm_configured: boolean;
}

/**
 * Fetch GenAI health & availability status
 */
export async function getGenAiHealth(): Promise<GenAiHealthResponse> {
  const res = await api.get("/genai/health");
  return res.data;
}

/**
 * Fetch plain-language insights (EVM numbers -> plain English summary, risks, recommendations)
 */
export async function getProjectInsights(projectId: number | string): Promise<ProjectInsightResponse> {
  const res = await api.get(`/genai/insights/${projectId}`);
  return res.data;
}

/**
 * Send interactive query to GenAI LLM Assistant
 */
export async function sendGenAiChat(message: string, projectId?: number | string | null): Promise<ChatResponse> {
  const payload: { message: string; project_id?: number } = { message };
  if (projectId !== undefined && projectId !== null && projectId !== "") {
    payload.project_id = Number(projectId);
  }
  const res = await api.post("/genai/chat", payload);
  return res.data;
}
