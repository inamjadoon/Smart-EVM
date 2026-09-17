import { ReactNode, createContext, useContext, useEffect, useMemo, useState } from "react";
import { Auth0Provider, useAuth0 } from "@auth0/auth0-react";
import { setAccessTokenGetter } from "@/api/axiosInstance";

export type Role = "Admin" | "Manager" | "Developer" | "Viewer";

export type AuthUser = {
  name?: string;
  email?: string;
  picture?: string;
  role?: Role;
  organization?: string;
};

type AuthShape = {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser | null;
  role: Role;
  setRole: (r: Role) => void;
  login: () => void;
  loginWithRole: (role: Role, user?: AuthUser) => void;
  logout: () => void;
  authMode: "auth0" | "mock";
};

const AuthCtx = createContext<AuthShape | null>(null);
export const useAuth = () => {
  const v = useContext(AuthCtx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
};

const DOMAIN     = import.meta.env.VITE_AUTH0_DOMAIN as string | undefined;
const CLIENT_ID  = import.meta.env.VITE_AUTH0_CLIENT_ID as string | undefined;
const AUDIENCE   = import.meta.env.VITE_AUTH0_AUDIENCE as string | undefined;
const ROLES_CLAIM = (import.meta.env.VITE_AUTH0_ROLES_CLAIM as string) || "https://smartevm/roles";

const Auth0Bridge = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, isLoading, user, loginWithRedirect, logout, getAccessTokenSilently, getIdTokenClaims } = useAuth0();
  const [role, setRole] = useState<Role>("Viewer");

  useEffect(() => {
    setAccessTokenGetter(async () => {
      try {
        if (!isAuthenticated) return null;
        return await getAccessTokenSilently({ authorizationParams: AUDIENCE ? { audience: AUDIENCE } : undefined });
      } catch { return null; }
    });
  }, [isAuthenticated, getAccessTokenSilently]);

  useEffect(() => {
    (async () => {
      if (!isAuthenticated) return;
      try {
        const claims: any = await getIdTokenClaims();
        const roles: string[] = (claims && claims[ROLES_CLAIM]) || (user && (user as any)[ROLES_CLAIM]) || [];
        const r = roles.find((x) => ["Admin", "Manager", "Developer", "Viewer"].includes(x)) as Role | undefined;
        setRole(r ?? "Viewer");
      } catch { setRole("Viewer"); }
    })();
  }, [isAuthenticated, user, getIdTokenClaims]);

  const value: AuthShape = {
    isAuthenticated,
    isLoading,
    user: user ? { name: user.name, email: user.email, picture: user.picture } : null,
    role,
    setRole,
    login: () => loginWithRedirect(),
    loginWithRole: (newRole: Role) => setRole(newRole),
    logout: () => logout({ logoutParams: { returnTo: window.location.origin } }),
    authMode: "auth0",
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
};

const DEFAULT_USERS_BY_ROLE: Record<Role, AuthUser> = {
  Admin: { name: "Sarah Connor (Admin)", email: "admin@smartevm.io", role: "Admin", organization: "SmartEVM Enterprise" },
  Manager: { name: "Marcus Vance (PM)", email: "manager@smartevm.io", role: "Manager", organization: "DevOps & Core Delivery" },
  Developer: { name: "Alex Mercer (Dev)", email: "alex.dev@smartevm.io", role: "Developer", organization: "Backend & ML Engineering" },
  Viewer: { name: "David Stakeholder", email: "viewer@smartevm.io", role: "Viewer", organization: "Executive Board" },
};

const MockBridge = ({ children }: { children: ReactNode }) => {
  const [role, setRoleState] = useState<Role>(() => {
    return (localStorage.getItem("smartevm.role") as Role) || "Admin";
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const stored = localStorage.getItem("smartevm.auth");
    return stored === "true";
  });

  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const stored = localStorage.getItem("smartevm.user");
      if (stored) return JSON.parse(stored);
    } catch {}
    const initialRole = (localStorage.getItem("smartevm.role") as Role) || "Admin";
    return DEFAULT_USERS_BY_ROLE[initialRole] || DEFAULT_USERS_BY_ROLE.Admin;
  });

  useEffect(() => {
    localStorage.setItem("smartevm.role", role);
  }, [role]);

  useEffect(() => {
    localStorage.setItem("smartevm.auth", isAuthenticated ? "true" : "false");
  }, [isAuthenticated]);

  useEffect(() => {
    if (user) {
      localStorage.setItem("smartevm.user", JSON.stringify(user));
    } else {
      localStorage.removeItem("smartevm.user");
    }
  }, [user]);

  useEffect(() => {
    setAccessTokenGetter(async () => null);
  }, []);

  const setRole = (newRole: Role) => {
    setRoleState(newRole);
    setUser((prev) => ({
      ...(prev || DEFAULT_USERS_BY_ROLE[newRole]),
      role: newRole,
    }));
  };

  const loginWithRole = (newRole: Role, customUser?: AuthUser) => {
    const selectedUser = customUser || DEFAULT_USERS_BY_ROLE[newRole];
    setRoleState(newRole);
    setUser({ ...selectedUser, role: newRole });
    setIsAuthenticated(true);
  };

  const login = () => {
    loginWithRole(role);
  };

  const logout = () => {
    setIsAuthenticated(false);
    localStorage.setItem("smartevm.auth", "false");
  };

  const value: AuthShape = useMemo(() => ({
    isAuthenticated,
    isLoading: false,
    user,
    role,
    setRole,
    login,
    loginWithRole,
    logout,
    authMode: "mock",
  }), [isAuthenticated, user, role]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  if (DOMAIN && CLIENT_ID) {
    return (
      <Auth0Provider
        domain={DOMAIN}
        clientId={CLIENT_ID}
        authorizationParams={{
          redirect_uri: window.location.origin,
          ...(AUDIENCE ? { audience: AUDIENCE } : {}),
        }}
        cacheLocation="localstorage"
      >
        <Auth0Bridge>{children}</Auth0Bridge>
      </Auth0Provider>
    );
  }
  return <MockBridge>{children}</MockBridge>;
};

export const RoleGate = ({ allow, children, fallback = null }: {
  allow: Role[]; children: ReactNode; fallback?: ReactNode;
}) => {
  const { role } = useAuth();
  return allow.includes(role) ? <>{children}</> : <>{fallback}</>;
};
