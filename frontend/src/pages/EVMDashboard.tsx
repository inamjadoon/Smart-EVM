import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";
import { RefreshCw, TrendingUp, Target, Award, Activity } from "lucide-react";
import { getProjects } from "@/api/projects";
import { calculateEvm, getEvmHistory } from "@/api/evm";
import { InsightsAgentCard } from "@/components/InsightsAgentCard";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const healthStyle = (h: string) =>
  h === "Green"
    ? "bg-success/10 text-success border-success/20"
    : h === "Yellow"
    ? "bg-warning/15 text-warning-foreground border-warning/30"
    : h === "Red"
    ? "bg-destructive/10 text-destructive border-destructive/20"
    : "bg-muted text-muted-foreground";

function StatCard({ title, value, icon: Icon, accent }: any) {
  return (
    <Card className="card-elevated border-0 overflow-hidden relative">
      <div className={cn("absolute inset-x-0 top-0 h-1", accent)} />
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center", accent.replace("bg-", "bg-") + "/15")}>
          <Icon className={cn("h-4 w-4", accent.replace("bg-", "text-"))} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tracking-tight">{value ?? "—"}</div>
      </CardContent>
    </Card>
  );
}

export default function EVMDashboard() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [projects, setProjects] = useState<any[]>([]);
  const [projectId, setProjectId] = useState(params.get("project_id") ?? "");
  const [evm, setEvm] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getProjects()
      .then((p) => {
        setProjects(p);
        if (!projectId && p.length > 0) {
          const firstId = String(p[0].id);
          setProjectId(firstId);
          setParams({ project_id: firstId });
        }
      })
      .catch((e) => toast.error(e.message));
  }, []);

  const loadAll = async (id: string) => {
    try {
      const [e, h] = await Promise.all([calculateEvm(id), getEvmHistory(id)]);
      setEvm(e); setHistory(h);
    } catch (err: any) { toast.error(err.message); }
  };
  useEffect(() => { if (projectId) loadAll(projectId); }, [projectId]);

  const onProjectChange = (id: string) => { setProjectId(id); setParams({ project_id: id }); };
  const recalc = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const e = await calculateEvm(projectId); setEvm(e);
      const h = await getEvmHistory(projectId); setHistory(h);
      toast.success("Snapshot saved");
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">EVM Dashboard</h2>
          <p className="text-muted-foreground mt-1">Earned Value Management for one project.</p>
        </div>
        <div className="flex gap-3">
          <Select value={projectId} onValueChange={onProjectChange}>
            <SelectTrigger className="w-[260px] h-10 bg-card"><SelectValue placeholder="Choose project" /></SelectTrigger>
            <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={recalc} disabled={!projectId || loading} className="bg-gradient-primary hover:opacity-90 shadow-soft">
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} /> Calculate
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="CPI" value={evm?.cpi?.toFixed?.(2)} icon={TrendingUp} accent="bg-primary" />
        <StatCard title="SPI" value={evm?.spi?.toFixed?.(2)} icon={Target} accent="bg-success" />
        <StatCard title="QPI" value={evm?.qpi?.toFixed?.(2)} icon={Award} accent="bg-warning" />
        <Card className="card-elevated border-0 overflow-hidden relative">
          <div className="absolute inset-x-0 top-0 h-1 bg-destructive" />
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Health</CardTitle>
            <div className="h-9 w-9 rounded-lg bg-destructive/15 flex items-center justify-center">
              <Activity className="h-4 w-4 text-destructive" />
            </div>
          </CardHeader>
          <CardContent>
            {evm?.health ? (
              <Badge variant="outline" className={cn("text-base px-3 py-1", healthStyle(evm.health))}>{evm.health}</Badge>
            ) : "—"}
          </CardContent>
        </Card>
      </div>

      {evm && (evm.sprint_count === 0 || evm.health === "Pending") && (
        <Card className="card-elevated border-0">
          <CardContent className="py-10 text-center space-y-3">
            <p className="text-muted-foreground text-sm">
              This project has no sprints yet. Sync from Jira or create sprints manually to start tracking EVM metrics.
            </p>
            <Button variant="outline" onClick={() => navigate("/sprints")}>
              Go to Sprints &rarr;
            </Button>
          </CardContent>
        </Card>
      )}

      {/* AI Insights Agent: Translates numeric CPI, SPI, QPI and forecast curves into plain text */}
      <InsightsAgentCard
        projectId={projectId}
        projectName={projects.find((p) => String(p.id) === String(projectId))?.name}
      />

      <Card className="card-elevated border-0">
        <CardHeader><CardTitle>PV / EV / AC over time</CardTitle></CardHeader>
        <CardContent style={{ height: 340 }}>
          <ResponsiveContainer>
            <LineChart data={history}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="snapshot_date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Legend />
              <Line type="monotone" dataKey="pv" stroke="hsl(var(--muted-foreground))" name="PV" strokeWidth={2} />
              <Line type="monotone" dataKey="ev" stroke="hsl(var(--primary))" name="EV" strokeWidth={2.5} />
              <Line type="monotone" dataKey="ac" stroke="hsl(var(--destructive))" name="AC" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatCard title="EAC (Estimate at Completion)" value={evm?.eac != null ? `$${Number(evm.eac).toLocaleString()}` : "—"} icon={TrendingUp} accent="bg-primary" />
        <StatCard title="VAC (Variance at Completion)" value={evm?.vac != null ? `$${Number(evm.vac).toLocaleString()}` : "—"} icon={Target} accent="bg-success" />
      </div>

      <Card className="card-elevated border-0">
        <CardHeader><CardTitle>Sprint Breakdown</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Sprint</TableHead><TableHead>PV</TableHead><TableHead>EV</TableHead>
                  <TableHead>SPI</TableHead><TableHead>Total Tasks</TableHead><TableHead>Done</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(evm?.sprint_breakdown ?? []).map((s: any, i: number) => (
                  <TableRow key={i} className="hover:bg-muted/30">
                    <TableCell className="font-medium">{s.sprint_name ?? `Sprint ${s.sprint_number}`}</TableCell>
                    <TableCell>${Number(s.pv ?? 0).toLocaleString()}</TableCell>
                    <TableCell>${Number(s.ev ?? 0).toLocaleString()}</TableCell>
                    <TableCell className="font-mono">{s.spi?.toFixed?.(2) ?? "—"}</TableCell>
                    <TableCell>{s.total_tasks}</TableCell>
                    <TableCell>{s.done_tasks}</TableCell>
                  </TableRow>
                ))}
                {!evm?.sprint_breakdown?.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No data.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
