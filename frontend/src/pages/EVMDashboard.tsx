import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";
import { RefreshCw, TrendingUp, Target, Award, Activity, History, Info } from "lucide-react";
import { getProjects } from "@/api/projects";
import { calculateEvm, getEvmHistory, getEvmSummary } from "@/api/evm";
import { RoleGate } from "@/auth/AuthProvider";
import { InsightsAgentCard } from "@/components/InsightsAgentCard";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Backend health looks like "Green - On track", so match on the colour prefix.
const healthStyle = (h?: string) =>
  h?.startsWith("Green")
    ? "bg-success/10 text-success border-success/20"
    : h?.startsWith("Yellow")
    ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
    : h?.startsWith("Red")
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

const fmtWhen = (d?: string | null) => {
  if (!d) return "—";
  // The database stores UTC without a zone marker; mark it as UTC so it shows in the user's local time.
  const iso = d.replace(" ", "T");
  const dt = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  return isNaN(dt.getTime()) ? d : dt.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
};
const fmtMoney = (v?: number | null) => (v == null ? "—" : `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`);

export default function EVMDashboard() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [projects, setProjects] = useState<any[]>([]);
  const [projectId, setProjectId] = useState(params.get("project_id") ?? "");
  const [evm, setEvm] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [justSavedId, setJustSavedId] = useState<number | null>(null);

  // API returns newest first; the chart must run oldest -> newest (left to right).
  const chartData = useMemo(
    () => [...history].reverse().map((h) => ({ ...h, label: fmtWhen(h.snapshot_date) })),
    [history]
  );
  const latest = history[0];
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
      // read-only on page load (GET); saving a snapshot is an explicit Manager/Admin action
      const [e, h] = await Promise.all([getEvmSummary(id), getEvmHistory(id)]);
      setEvm(e); setHistory(h);
    } catch (err: any) { toast.error(err.message); }
  };
  useEffect(() => { setJustSavedId(null); if (projectId) loadAll(projectId); }, [projectId]);

  const onProjectChange = (id: string) => { setProjectId(id); setParams({ project_id: id }); };
  const recalc = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const e = await calculateEvm(projectId); setEvm(e);
      if (!e.snapshot_saved) {
        toast.warning("Snapshot not saved", { description: e.snapshot_skipped_reason || "There is no EVM data to record yet." });
        return;
      }
      const h = await getEvmHistory(projectId); setHistory(h);
      setJustSavedId(h[0]?.history_id ?? null);
      toast.success("Snapshot saved to EVM history", {
        description: `Added as the newest point on the "PV / EV / AC over time" chart (${h.length} snapshots). `
          + "It also feeds the ML forecasts and the AI assistant.",
      });
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
          <RoleGate allow={["Admin", "Manager"]}>
            <Button onClick={recalc} disabled={!projectId || loading} className="bg-gradient-primary hover:opacity-90 shadow-soft"
              title="Recalculate EVM and save a snapshot to the history">
              <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} /> Save snapshot
            </Button>
          </RoleGate>
        </div>
      </div>

      {evm && !evm.ac_entered && (evm.sprint_count ?? 0) > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300 flex items-start gap-2">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            <strong>Actual cost hasn't been entered</strong> for this project's sprints, so CPI, EAC and VAC can't be
            calculated yet. SPI and earned value are still accurate. A manager can add each sprint's
            <em> Actual Cost to date</em> on the <a href={`/sprints?project_id=${projectId}`} className="underline font-medium">Sprints page</a>.
          </span>
        </div>
      )}

      {evm?.ac_entered && evm.ac_sprints_entered < (evm.sprint_count ?? 0) && (
        <div className="rounded-lg border bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground flex items-start gap-2">
          <Info className="h-3.5 w-3.5 mt-px shrink-0" />
          <span>
            Actual cost is entered for {evm.ac_sprints_entered} of {evm.sprint_count} sprints. CPI and EAC use only those
            sprints; add the rest on the <a href={`/sprints?project_id=${projectId}`} className="underline">Sprints page</a> for a complete picture.
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="CPI" value={evm?.cpi?.toFixed?.(2) ?? "—"} icon={TrendingUp} accent="bg-primary" />
        <StatCard title="SPI" value={evm?.spi?.toFixed?.(2) ?? "—"} icon={Target} accent="bg-success" />
        <StatCard title="QPI" value={evm?.qpi?.toFixed?.(2) ?? "—"} icon={Award} accent="bg-warning" />
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
        <CardHeader className="pb-2">
          <CardTitle>PV / EV / AC over time</CardTitle>
          <p className="text-xs text-muted-foreground flex items-start gap-1.5">
            <Info className="h-3.5 w-3.5 mt-px shrink-0" />
            {history.length
              ? `${history.length} saved snapshot${history.length > 1 ? "s" : ""} · last saved ${fmtWhen(latest?.snapshot_date)}. `
              : "No snapshots saved yet. "}
            Each “Save snapshot” stores the current PV, EV, AC, CPI and SPI in the project's EVM history and adds a point here (newest on the right).
          </p>
        </CardHeader>
        <CardContent style={{ height: 340 }}>
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} minTickGap={24} />
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

      <Card className="card-elevated border-0">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2"><History className="h-4 w-4" /> Saved snapshots</CardTitle>
          <p className="text-xs text-muted-foreground">Stored in the EVM history and used by the ML forecasts and the AI assistant. Newest first.</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border max-h-[300px] overflow-y-auto">
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0">
                <TableRow>
                  <TableHead>Saved</TableHead><TableHead className="text-right">PV</TableHead>
                  <TableHead className="text-right">EV</TableHead><TableHead className="text-right">AC</TableHead>
                  <TableHead className="text-right">CPI</TableHead><TableHead className="text-right">SPI</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.slice(0, 20).map((h) => (
                  <TableRow key={h.history_id} className={h.history_id === justSavedId ? "bg-primary/10" : ""}>
                    <TableCell className="whitespace-nowrap">
                      {fmtWhen(h.snapshot_date)}
                      {h.history_id === justSavedId && <Badge className="ml-2 text-[10px]">New</Badge>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fmtMoney(h.pv)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtMoney(h.ev)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtMoney(h.ac)}</TableCell>
                    <TableCell className="text-right tabular-nums">{h.cpi != null ? Number(h.cpi).toFixed(2) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{h.spi != null ? Number(h.spi).toFixed(2) : "—"}</TableCell>
                  </TableRow>
                ))}
                {!history.length && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                    No snapshots yet. A manager or admin can click “Save snapshot” to record the current EVM figures.
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {history.length > 20 && <p className="text-xs text-muted-foreground mt-2">Showing the latest 20 of {history.length}.</p>}
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
                  <TableHead>Sprint</TableHead><TableHead>Budget</TableHead><TableHead>PV to date</TableHead>
                  <TableHead>EV</TableHead><TableHead>AC</TableHead><TableHead>SPI</TableHead><TableHead>CPI</TableHead>
                  <TableHead>Tasks done</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(evm?.sprint_breakdown ?? []).map((s: any, i: number) => (
                  <TableRow key={i} className="hover:bg-muted/30">
                    <TableCell className="font-medium">{s.sprint_name ?? `Sprint ${s.sprint_number}`}</TableCell>
                    <TableCell>{fmtMoney(s.planned_value)}</TableCell>
                    <TableCell>{fmtMoney(s.pv_to_date)}</TableCell>
                    <TableCell>{fmtMoney(s.ev)}</TableCell>
                    <TableCell>{s.actual_cost != null ? fmtMoney(s.actual_cost) : <span className="text-muted-foreground text-xs">not entered</span>}</TableCell>
                    <TableCell className="font-mono">{s.spi?.toFixed?.(2) ?? "—"}</TableCell>
                    <TableCell className="font-mono">{s.cpi?.toFixed?.(2) ?? "—"}</TableCell>
                    <TableCell>{s.done_tasks}/{s.total_tasks}</TableCell>
                  </TableRow>
                ))}
                {!evm?.sprint_breakdown?.length && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No data.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
