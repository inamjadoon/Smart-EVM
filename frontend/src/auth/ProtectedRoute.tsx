import { ReactNode } from "react";
import { Navigate, Outlet, useLocation, Link } from "react-router-dom";
import { Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "./AuthProvider";
import { canAccess } from "./permissions";

/** Blocks the workspace until the session is verified; sends guests to /login. */
export function RequireAuth({ children }: { children?: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Verifying your session…
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return children ? <>{children}</> : <Outlet />;
}

/** Renders the page only if the user's role may access this path (see permissions.ts). */
export function RequireRole({ path, children }: { path: string; children: ReactNode }) {
  const { role } = useAuth();
  if (canAccess(role, path)) return <>{children}</>;
  return (
    <div className="max-w-md mx-auto mt-24 text-center space-y-4">
      <div className="inline-flex h-12 w-12 rounded-xl bg-destructive/10 items-center justify-center">
        <ShieldAlert className="h-6 w-6 text-destructive" />
      </div>
      <h2 className="text-2xl font-bold tracking-tight">Access restricted</h2>
      <p className="text-sm text-muted-foreground">
        Your role (<span className="font-semibold text-foreground">{role}</span>) doesn't have access to this page.
        Ask an administrator if you need it.
      </p>
      <Button asChild><Link to="/dashboard">Back to dashboard</Link></Button>
    </div>
  );
}

/** For /login and /register: signed-in users go straight to the workspace. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const from = (useLocation().state as { from?: string } | null)?.from;
  if (!isLoading && isAuthenticated) return <Navigate to={from || "/dashboard"} replace />;
  return <>{children}</>;
}
