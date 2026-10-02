import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, AlertTriangle, CalendarClock, UserPlus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getMyTasks } from "@/api/tasks";
import { getProjects } from "@/api/projects";
import { adminApi } from "@/api/auth";
import { useAuth } from "@/auth/AuthProvider";

type Alert = { id: string; icon: typeof Bell; text: string; to: string };

/** Lightweight, role-aware alerts computed from live data when the bell is opened. */
export function NotificationsBell() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<Alert[] | null>(null);

  const refresh = useCallback(async () => {
    const next: Alert[] = [];
    const today = new Date().toISOString().slice(0, 10);
    try {
      const mine = await getMyTasks();
      const overdue = mine.filter((t: { overdue?: boolean }) => t.overdue).length;
      if (overdue) next.push({ id: "my-overdue", icon: AlertTriangle, to: "/tasks",
        text: `${overdue} of your task${overdue > 1 ? "s are" : " is"} overdue` });
    } catch { /* ignore */ }
    if (role === "Admin" || role === "Manager") {
      try {
        const projects = await getProjects();
        const late = projects.filter((p: { is_completed?: boolean; end_date?: string | null }) =>
          !p.is_completed && p.end_date && p.end_date < today);
        if (late.length) next.push({ id: "late-projects", icon: CalendarClock, to: "/projects",
          text: `${late.length} active project${late.length > 1 ? "s are" : " is"} past the end date` });
      } catch { /* ignore */ }
    }
    if (role === "Admin") {
      try {
        const users = await adminApi.users();
        const noTeam = users.filter((u) => u.is_active && u.role === "Developer" && !u.reports_to).length;
        if (noTeam) next.push({ id: "no-team", icon: UserPlus, to: "/team",
          text: `${noTeam} developer${noTeam > 1 ? "s are" : " is"} not on a team yet` });
      } catch { /* ignore */ }
    }
    setAlerts(next);
  }, [role]);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <Popover onOpenChange={(open) => open && refresh()}>
      <PopoverTrigger asChild>
        <button className="relative h-9 w-9 rounded-md hover:bg-muted flex items-center justify-center transition-colors"
          aria-label="Notifications">
          <Bell className="h-4 w-4 text-muted-foreground" />
          {!!alerts?.length && (
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive" aria-hidden="true" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="px-4 py-3 border-b text-sm font-semibold">Notifications</div>
        {alerts === null ? (
          <p className="px-4 py-4 text-sm text-muted-foreground">Checking…</p>
        ) : alerts.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted-foreground">You're all caught up.</p>
        ) : (
          <ul className="divide-y">
            {alerts.map((a) => (
              <li key={a.id}>
                <button onClick={() => navigate(a.to)}
                  className="w-full text-left px-4 py-3 text-sm flex items-start gap-2.5 hover:bg-muted transition-colors">
                  <a.icon className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
                  {a.text}
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
