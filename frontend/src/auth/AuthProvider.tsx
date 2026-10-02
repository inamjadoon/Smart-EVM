import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authApi, tokenStore, type ApiUser, type Role, type TokenResponse } from "@/api/auth";
import { UNAUTHORIZED_EVENT } from "@/api/axiosInstance";

export type { Role };

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: Role;
  organization?: string | null;
  createdAt?: string | null;
  lastLoginAt?: string | null;
  managerName?: string | null;
  picture?: string;
};

type RegisterData = { full_name: string; email: string; password: string; organization?: string };

type AuthShape = {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser | null;
  role: Role;
  login: (email: string, password: string, remember?: boolean) => Promise<AuthUser>;
  register: (data: RegisterData) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  /** Store a fresh token (e.g. after a password change) without signing out. */
  acceptToken: (res: TokenResponse) => void;
};

const AuthCtx = createContext<AuthShape | null>(null);
export const useAuth = () => {
  const v = useContext(AuthCtx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
};

const toAuthUser = (u: ApiUser): AuthUser => ({
  id: u.user_id,
  name: u.full_name || u.email,
  email: u.email,
  role: u.role,
  organization: u.organization,
  createdAt: u.created_at,
  lastLoginAt: u.last_login_at,
  managerName: u.manager_name,
});

// Keys written by the old client-side "mock login"; removed so they can't grant anything.
const LEGACY_KEYS = ["smartevm.auth", "smartevm.role", "smartevm.user"];

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(() => !!tokenStore.get());

  const clearSession = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  // Restore the session on page load by validating the stored token with the backend.
  useEffect(() => {
    LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
    if (!tokenStore.get()) return;
    authApi
      .me()
      .then((u) => setUser(toAuthUser(u)))
      .catch(() => clearSession())
      .finally(() => setIsLoading(false));
  }, [clearSession]);

  // Any data call answered with 401 means the session is gone (expired / revoked).
  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, clearSession);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, clearSession);
  }, [clearSession]);

  const storeSession = useCallback((res: TokenResponse, remember: boolean) => {
    tokenStore.set(res.access_token, remember);
    const u = toAuthUser(res.user);
    setUser(u);
    return u;
  }, []);

  const login = useCallback(
    async (email: string, password: string, remember = true) =>
      storeSession(await authApi.login(email, password), remember),
    [storeSession]
  );

  const register = useCallback(
    async (data: RegisterData) => storeSession(await authApi.register(data), true),
    [storeSession]
  );

  const logout = useCallback(async () => {
    await authApi.logout();
    clearSession();
  }, [clearSession]);

  const refreshUser = useCallback(async () => {
    setUser(toAuthUser(await authApi.me()));
  }, []);

  const acceptToken = useCallback(
    (res: TokenResponse) => { storeSession(res, !!localStorage.getItem("smartevm.token")); },
    [storeSession]
  );

  const value: AuthShape = useMemo(
    () => ({
      isAuthenticated: !!user,
      isLoading,
      user,
      role: user?.role ?? "Viewer",
      login,
      register,
      logout,
      refreshUser,
      acceptToken,
    }),
    [user, isLoading, login, register, logout, refreshUser, acceptToken]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
};

export const RoleGate = ({ allow, children, fallback = null }: {
  allow: Role[]; children: ReactNode; fallback?: ReactNode;
}) => {
  const { role, isAuthenticated } = useAuth();
  return isAuthenticated && allow.includes(role) ? <>{children}</> : <>{fallback}</>;
};
