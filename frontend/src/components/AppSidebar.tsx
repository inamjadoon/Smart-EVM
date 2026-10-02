import { LayoutDashboard, FolderKanban, CalendarRange, ListChecks, LineChart, Brain, BookOpen, Sparkles, Shield, Home, LogOut, Users, UserCircle, type LucideIcon } from "lucide-react";
import { NavLink, useLocation, Link, useNavigate } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/auth/AuthProvider";
import { canAccess } from "@/auth/permissions";

type Item = { title: string; url: string; icon: LucideIcon };

// Visibility per role comes from auth/permissions.ts (same rules as the route guards).
const items: Item[] = [
  { title: "Dashboard",       url: "/dashboard",    icon: LayoutDashboard },
  { title: "Projects",        url: "/projects",     icon: FolderKanban },
  { title: "Sprints",         url: "/sprints",      icon: CalendarRange },
  { title: "Tasks",           url: "/tasks",        icon: ListChecks },
  { title: "Project Ledger",  url: "/ledger",       icon: BookOpen },
  { title: "EVM Dashboard",   url: "/evm",          icon: LineChart },
  { title: "Intelligence",    url: "/intelligence", icon: Brain },
  { title: "ML Predictions",  url: "/ml",           icon: Sparkles },
  { title: "Team",            url: "/team",         icon: Users },
  { title: "Account",         url: "/account",      icon: UserCircle },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const { role, logout } = useAuth();
  const navigate = useNavigate();

  const isActive = (path: string) => (path === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(path));

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link to="/dashboard" className={cn("flex items-center gap-2 px-2 py-3 hover:opacity-90 transition-opacity", collapsed && "justify-center px-0")}>
          <div className="h-9 w-9 rounded-md bg-primary flex items-center justify-center shadow-elevated shrink-0">
            <Shield className="h-4 w-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-bold text-sidebar-foreground tracking-tight">SmartEVM</span>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="scrollbar-none">
        <SidebarGroup>
          {!collapsed && (
            <div className="flex items-center justify-between px-3 py-1">
              <span className="text-sidebar-foreground/40 text-[10px] uppercase tracking-widest font-semibold">Workspace</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sidebar-accent text-sidebar-foreground/80 font-medium">
                {role}
              </span>
            </div>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {items.filter((i) => canAccess(role, i.url)).map((item) => {
                const active = isActive(item.url);
                const title =
                  item.url === "/team" && role === "Admin" ? "Users & Access" :
                  item.url === "/tasks" && role === "Developer" ? "My Tasks" : item.title;
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active} tooltip={title}>
                      <NavLink
                        to={item.url}
                        className={cn(
                          "group flex items-center gap-3 rounded-md px-3 py-2 transition-all",
                          "text-sidebar-foreground/75 hover:text-sidebar-foreground hover:bg-sidebar-accent",
                          active && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground shadow-soft"
                        )}
                      >
                        <item.icon className={cn("h-4 w-4 shrink-0", active && "text-primary-foreground")} />
                        {!collapsed && <span className="text-sm font-medium">{title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2 space-y-1">
        <Link
          to="/"
          className={cn(
            "flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors",
            collapsed && "justify-center px-0"
          )}
          title="Landing Page"
        >
          <Home className="h-4 w-4 shrink-0 text-primary" />
          {!collapsed && <span>Landing Page</span>}
        </Link>

        <button
          onClick={handleLogout}
          className={cn(
            "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium text-red-400 hover:text-red-300 hover:bg-sidebar-accent transition-colors text-left",
            collapsed && "justify-center px-0"
          )}
          title="Sign Out"
        >
          <LogOut className="h-4 w-4 shrink-0 text-red-400" />
          {!collapsed && <span>Sign Out</span>}
        </button>

        {!collapsed && (
          <div className="px-3 py-1 text-[10px] text-sidebar-foreground/40 uppercase tracking-widest text-center">
            v2.0 · Slate &amp; Steel
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
