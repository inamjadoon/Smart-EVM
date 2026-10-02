import type { Role } from "@/api/auth";

/**
 * Which roles may open each workspace page. Used by both the sidebar and the
 * route guards so the two can never drift apart. (The backend enforces the same
 * rules on every API call — this only controls what the UI offers.)
 */
export const ROUTE_ACCESS: Record<string, Role[]> = {
  "/dashboard":    ["Admin", "Manager", "Developer", "Viewer"],
  "/projects":     ["Admin", "Manager", "Viewer"],
  "/sprints":      ["Admin", "Manager", "Developer", "Viewer"],
  "/tasks":        ["Admin", "Manager", "Developer"],
  "/ledger":       ["Admin", "Manager", "Developer", "Viewer"],
  "/evm":          ["Admin", "Manager", "Developer", "Viewer"],
  "/intelligence": ["Admin"],
  "/ml":           ["Admin", "Manager"],
  "/team":         ["Admin", "Manager"],
  "/account":      ["Admin", "Manager", "Developer", "Viewer"],
};

export const canAccess = (role: Role, path: string) => (ROUTE_ACCESS[path] ?? []).includes(role);
