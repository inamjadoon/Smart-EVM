import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FolderKanban, CalendarRange, ListChecks, TrendingUp, ArrowRight, Sparkles } from "lucide-react";
import { getProjects } from "@/api/projects";
import { getEvmPortfolio } from "@/api/evm";
import { InsightsAgentCard } from "@/components/InsightsAgentCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { RoleGate } from "@/auth/AuthProvider";

// Backend health looks like "Green - On track", so match on the colour prefix.
const healthStyle = (h?: string) =>
  h?.startsWith("Green")
    ? "bg-success/10 text-success border-success/20"
    : h?.startsWith("Yellow")
    ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
    : h?.startsWith("Red")
    ? "bg-destructive/10 text-destructive border-destructive/20"
    : "bg-muted text-muted-foreground";

function StatCard({
  title,
  value,
  icon: Icon,
  accent,
}: {
  title: string;
  value: any;
  icon: any;
  accent: string;
}) {
  return (
    <Card className="card-elevated border-0 overflow-hidden relative">
      <div className={cn("absolute inset-x-0 top-0 h-1", accent)} />
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center", accent.replace("bg-", "bg-").concat("/15"))}>
          <Icon className={cn("h-4 w-4", accent.replace("bg-", "text-"))} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold tracking-tight">{value}</div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    getProjects()
      .then(async (list) => {
        if (list && list.length > 0) {
          setSelectedProjectId(String(list[0].id));
        }
        // One request for live EVM of every visible project (read-only — no snapshots saved).
        const evm = await getEvmPortfolio().catch(() => []);
        const byId = new Map(evm.map((e: any) => [e.project_id, e]));
        setProjects(list.map((p: any) => {
          const e: any = byId.get(p.id);
          return e ? { ...p, cpi: e.cpi, spi: e.spi, qpi: e.qpi, health: e.health,
                       sprint_count: e.sprint_count, task_count: e.task_count } : p;
        }));
      })
      .catch((e) => toast.error("Failed to load projects: " + e.message))
      .finally(() => setLoading(false));
  }, []);

  const totalSprints = projects.reduce((s, p) => s + (p.sprint_count ?? 0), 0);
  const totalTasks = projects.reduce((s, p) => s + (p.task_count ?? 0), 0);
  const healthyCount = projects.filter((p) => p.health?.startsWith("Green")).length;

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Welcome back 👋</h2>
          <p className="text-muted-foreground mt-1">Here's the latest on your portfolio.</p>
        </div>
        <RoleGate allow={["Admin", "Manager"]}>
          <Button onClick={() => navigate("/projects")} className="bg-gradient-primary hover:opacity-90 shadow-soft">
            New Project <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </RoleGate>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Projects" value={projects.length} icon={FolderKanban} accent="bg-primary" />
        <StatCard title="Total Sprints" value={totalSprints} icon={CalendarRange} accent="bg-success" />
        <StatCard title="Total Tasks" value={totalTasks} icon={ListChecks} accent="bg-warning" />
        <StatCard title="Healthy Projects" value={`${healthyCount}/${projects.length || 0}`} icon={TrendingUp} accent="bg-primary" />
      </div>

      {/* AI Insights Agent for selected project */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-bold tracking-tight">Executive AI Insights</h3>
          </div>
          {projects.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Select Project:</span>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger className="w-[220px] h-8 text-xs bg-card">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <InsightsAgentCard
          projectId={selectedProjectId}
          projectName={projects.find((p) => String(p.id) === String(selectedProjectId))?.name}
        />
      </div>

      <Card className="card-elevated border-0">
        <CardHeader>
          <CardTitle>Projects Overview</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground py-6 text-center">Loading projects…</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Budget</TableHead>
                    <TableHead>Health</TableHead>
                    <TableHead>CPI</TableHead>
                    <TableHead>SPI</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((p) => (
                    <TableRow key={p.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>${Number(p.total_budget ?? 0).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("border", healthStyle(p.health))}>
                          {p.health ?? "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{p.cpi?.toFixed?.(2) ?? "—"}</TableCell>
                      <TableCell className="font-mono text-sm">{p.spi?.toFixed?.(2) ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => navigate(`/evm?project_id=${p.id}`)}>
                          View EVM <ArrowRight className="ml-1 h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!projects.length && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                        No projects yet. Create your first one to get started.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
