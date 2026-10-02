import { useCallback, useEffect, useState } from "react";
import { History, Loader2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { adminApi, errorMessage, type ActivityEntry } from "@/api/auth";
import { cn } from "@/lib/utils";

const LABELS: Record<string, string> = {
  "auth.login": "signed in",
  "auth.login_failed": "failed sign-in",
  "auth.login_blocked": "blocked sign-in (deactivated)",
  "auth.register": "registered",
  "user.create": "created user",
  "user.update": "updated user",
  "user.password_reset": "reset password for",
  "project.create": "created project",
  "project.update": "updated project",
  "project.delete": "deleted project",
  "project.jira_import": "imported Jira issues into project",
  "project.complete": "marked project completed",
  "project.reopen": "reopened project",
  "sprint.create": "created sprint",
  "sprint.update": "updated sprint",
  "sprint.delete": "deleted sprint",
  "task.create": "created task",
  "task.update": "edited task",
  "task.status": "changed status of task",
  "task.delete": "deleted task",
  "metric.create": "added quality metric to task",
  "metric.delete": "deleted quality metric of task",
};

const isWarning = (a: string) => a === "auth.login_failed" || a === "auth.login_blocked" || a.endsWith(".delete");

function describe(e: ActivityEntry): string {
  const d = e.details || {};
  const target = e.entity_id != null ? ` #${e.entity_id}` : "";
  let extra = "";
  if (e.action === "task.status") extra = ` ${d.old} → ${d.new}`;
  else if (e.action === "user.update") {
    const parts = Object.entries(d).filter(([k]) => k !== "email" && k !== "previous_role")
      .map(([k, v]) => `${k}: ${String(v)}`);
    extra = ` ${String(d.email ?? "")}${parts.length ? ` (${parts.join(", ")})` : ""}`;
  } else if (d.email && e.action.startsWith("user.")) extra = ` ${String(d.email)}`;
  else if (d.name) extra = ` "${String(d.name)}"`;
  else if (d.title) extra = ` "${String(d.title)}"`;
  else if (e.action === "auth.login_failed" && d.email) extra = ` for ${String(d.email)}`;
  return `${LABELS[e.action] ?? e.action}${e.action.startsWith("auth.") ? "" : target}${extra}`;
}

/** Admin-only audit trail: who did what and when. */
export function ActivityLog() {
  const [items, setItems] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await adminApi.activity(60));
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2"><History className="h-4 w-4" /> Recent activity</CardTitle>
        <Button size="sm" variant="ghost" onClick={load} disabled={loading} className="gap-1.5">
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {loading && !items.length ? (
          <p className="text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Loading…</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : !items.length ? (
          <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
        ) : (
          <ul className="divide-y max-h-[420px] overflow-y-auto pr-1">
            {items.map((e) => (
              <li key={e.id} className="py-2 flex items-start justify-between gap-4 text-sm">
                <span className={cn(isWarning(e.action) && "text-destructive")}>
                  <span className="font-medium">{e.actor || "Unknown user"}</span> {describe(e)}
                </span>
                <time className="text-xs text-muted-foreground whitespace-nowrap" dateTime={e.at ?? undefined}>
                  {e.at ? new Date(e.at + (e.at.endsWith("Z") ? "" : "Z")).toLocaleString() : ""}
                </time>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
