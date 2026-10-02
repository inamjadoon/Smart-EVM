/**
 * SmartEVM auth API + session token storage.
 *
 * Auth always talks to the real FastAPI backend (even when the data layer is in
 * mock mode), because sign-in must be verified server-side.
 *   "Remember me" -> token in localStorage (survives browser restarts)
 *   otherwise     -> token in sessionStorage (cleared when the tab closes)
 */
import axios from "axios";

export type Role = "Admin" | "Manager" | "Developer" | "Viewer";

export type ApiUser = {
  user_id: number;
  email: string;
  username: string;
  full_name: string;
  organization: string | null;
  is_active: boolean;
  role: Role;
  created_at: string | null;
  last_login_at: string | null;
  reports_to: number | null;
  manager_name: string | null;
};

export type TokenResponse = {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
  user: ApiUser;
};

export type UserProgress = ApiUser & {
  progress: {
    total_tasks: number;
    done_tasks: number;
    in_progress_tasks: number;
    todo_tasks: number;
    total_points: number;
    done_points: number;
    completion_pct: number;
    active_projects: number;
    managed_projects: number;
  };
};

const TOKEN_KEY = "smartevm.token";
export const AUTH_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export const tokenStore = {
  get: (): string | null => localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY),
  set: (token: string, remember: boolean) => {
    tokenStore.clear();
    (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  },
};

const http = axios.create({ baseURL: AUTH_BASE_URL, timeout: 30000, headers: { "Content-Type": "application/json" } });

http.interceptors.request.use((config) => {
  const t = tokenStore.get();
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

http.interceptors.response.use(
  (r) => r,
  (err) => {
    const detail = err?.response?.data?.detail;
    const msg =
      (typeof detail === "string" && detail) ||
      (Array.isArray(detail) && String(detail[0]?.msg ?? "").replace(/^Value error, /, "")) ||
      (err?.code === "ERR_NETWORK" ? "Cannot reach the SmartEVM server. Is the backend running?" : err?.message) ||
      "Request failed";
    return Promise.reject(Object.assign(new Error(msg), { status: err?.response?.status }));
  }
);

export const authApi = {
  login: (email: string, password: string) =>
    http.post<TokenResponse>("/auth/login", { email, password }).then((r) => r.data),
  register: (body: { full_name: string; email: string; password: string; organization?: string }) =>
    http.post<TokenResponse>("/auth/register", body).then((r) => r.data),
  me: () => http.get<ApiUser>("/auth/me").then((r) => r.data),
  updateMe: (body: { full_name?: string; organization?: string }) =>
    http.patch<ApiUser>("/auth/me", body).then((r) => r.data),
  changePassword: (current_password: string, new_password: string) =>
    http.post<TokenResponse>("/auth/change-password", { current_password, new_password }).then((r) => r.data),
  logout: () => http.post("/auth/logout").catch(() => undefined),
  logoutAll: () => http.post("/auth/logout-all"),
};

export const adminApi = {
  overview: () => http.get("/admin/overview").then((r) => r.data),
  users: () => http.get<UserProgress[]>("/admin/users").then((r) => r.data),
  createUser: (body: { full_name: string; email: string; password: string; role: Role; organization?: string }) =>
    http.post<ApiUser>("/admin/users", body).then((r) => r.data),
  updateUser: (id: number, body: Partial<{ role: Role; is_active: boolean; full_name: string; reports_to: number | null }>) =>
    http.patch<ApiUser>(`/admin/users/${id}`, body).then((r) => r.data),
  resetPassword: (id: number, new_password: string) =>
    http.post(`/admin/users/${id}/reset-password`, { new_password }).then((r) => r.data),
  activity: (limit = 50) => http.get<ActivityEntry[]>("/admin/activity", { params: { limit } }).then((r) => r.data),
};

export type ActivityEntry = {
  id: number;
  at: string | null;
  user_id: number | null;
  actor: string | null;
  action: string;
  entity: string | null;
  entity_id: number | null;
  details: Record<string, unknown>;
};

export const teamApi = {
  progress: () => http.get<UserProgress[]>("/team/progress").then((r) => r.data),
};

export const errorMessage = (e: unknown, fallback = "Something went wrong") =>
  e instanceof Error && e.message ? e.message : fallback;

/** Mirrors the backend password policy so users get instant feedback. */
export const passwordProblem = (pwd: string): string | null => {
  if (pwd.length < 8) return "At least 8 characters";
  if (!/[A-Za-z]/.test(pwd) || !/\d/.test(pwd)) return "Include at least one letter and one number";
  return null;
};
