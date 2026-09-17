import { Outlet, useLocation, useNavigate, Link } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Bell, Search, LogOut, ShieldCheck, Home } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/auth/AuthProvider";
import { isMockMode } from "@/api/axiosInstance";
import { AIAssistantWidget } from "@/components/AIAssistantWidget";

const titles: Record<string, { title: string; subtitle: string }> = {
  "/dashboard":    { title: "Executive Dashboard", subtitle: "Portfolio-level Earned Value posture" },
  "/":             { title: "Executive Dashboard", subtitle: "Portfolio-level Earned Value posture" },
  "/projects":     { title: "Projects",            subtitle: "Manage the project portfolio" },
  "/sprints":      { title: "Sprints",             subtitle: "Plan and track sprints per project" },
  "/tasks":        { title: "Tasks",               subtitle: "Granular task management" },
  "/ledger":       { title: "Project Ledger",      subtitle: "Task-level PV / EV / AC with SV, CV, SPI, CPI" },
  "/evm":          { title: "EVM Dashboard",       subtitle: "Earned Value Management insights" },
  "/intelligence": { title: "Intelligence",        subtitle: "Predictive analytics & forecasting" },
  "/ml":           { title: "ML Predictions",      subtitle: "Run individual predictive models" },
};

export default function AppLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const meta =
    titles[pathname] ||
    titles[Object.keys(titles).find((k) => k !== "/" && pathname.startsWith(k)) ?? "/dashboard"] ||
    titles["/dashboard"];

  const { isAuthenticated, user, role, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const initials = (user?.name || user?.email || "U")
    .split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-16 flex items-center gap-3 border-b bg-card/80 backdrop-blur-md px-4 sticky top-0 z-30">
            <SidebarTrigger className="h-9 w-9 rounded-md hover:bg-muted transition-colors" />
            <div className="hidden md:flex flex-col leading-tight">
              <h1 className="text-sm font-semibold text-foreground">{meta.title}</h1>
              <span className="text-xs text-muted-foreground">{meta.subtitle}</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="relative hidden lg:block">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search projects, sprints, tasks…" className="pl-8 w-72 h-9 bg-background text-xs" />
              </div>

              {/* User Role Indicator (Fixed, non-switchable) */}
              <div
                className="h-9 px-3 rounded-md border border-border/70 bg-card flex items-center text-xs font-semibold text-foreground gap-1.5 shadow-sm select-none"
                title={`Logged in as ${role}`}
              >
                <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                <span>{role}</span>
              </div>

              {isMockMode && (
                <Badge variant="outline" className="h-7 hidden xl:inline-flex border-warning/40 bg-warning/10 text-warning text-xs">
                  Connected API
                </Badge>
              )}

              {/* Link back to Landing */}
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="h-9 gap-1 text-xs text-muted-foreground hover:text-foreground hidden sm:inline-flex"
              >
                <Link to="/">
                  <Home className="h-3.5 w-3.5" /> Landing
                </Link>
              </Button>

              <button className="h-9 w-9 rounded-md hover:bg-muted flex items-center justify-center transition-colors">
                <Bell className="h-4 w-4 text-muted-foreground" />
              </button>

              {/* Sign Out Button */}
              <Button
                size="sm"
                variant="ghost"
                onClick={handleLogout}
                className="h-9 gap-1.5 text-xs text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                title="Sign out of workspace"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign out</span>
              </Button>

              {/* User Avatar */}
              <div
                className="h-9 w-9 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground text-xs font-bold shadow-soft"
                title={`${user?.name || "User"} (${role})`}
              >
                {initials}
              </div>
            </div>
          </header>
          <main className="flex-1 p-6 md:p-8 animate-fade-in max-w-[1600px] w-full mx-auto">
            <Outlet />
          </main>
          {/* Global AI Assistant LLM floating widget */}
          <AIAssistantWidget />
        </div>
      </div>
    </SidebarProvider>
  );
}
