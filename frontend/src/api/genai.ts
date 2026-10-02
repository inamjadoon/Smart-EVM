import api from "./axiosInstance";

export interface ProjectInsightResponse {
  summary: string;
  risks: string[];
  recommendations: string[];
  source: "llm" | "rule_based" | string;
}

export interface AgentRun {
  name: string;
  label: string;
  source: "llm" | "rule_based" | string;
  tools: string[];
  ms: number;
  error?: string;
}

export interface ChatResponse {
  reply: string;
  source: "llm" | "rule_based" | string;
  agents?: AgentRun[];
  route?: { agents: string[]; project_ids: number[]; by: string; reason?: string };
  llm?: { available: boolean; model?: string; reason?: string; warning?: string };
  elapsed_ms?: number;
}

/** Snapshot of the page the user is on, so the assistant can "read this page". */
export interface PageContext {
  path: string;
  title: string;
  text: string;
  project_id?: number | null;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface GenAiHealthResponse {
  status: string;
  llm_configured: boolean;
  llm_available?: boolean;
  available?: boolean;
  model?: string;
  reason?: string;
  latency_ms?: number;
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
export async function sendGenAiChat(
  message: string,
  projectId?: number | string | null,
  history: ChatTurn[] = [],
  page?: PageContext | null
): Promise<ChatResponse> {
  const payload: { message: string; project_id?: number; history: ChatTurn[]; page?: PageContext } = { message, history };
  if (page) payload.page = page;
  if (projectId !== undefined && projectId !== null && projectId !== "") {
    payload.project_id = Number(projectId);
  }
  const res = await api.post("/genai/chat", payload, { timeout: 90000 });
  return res.data;
}
