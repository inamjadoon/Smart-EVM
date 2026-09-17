import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Brain, TrendingUp, ShieldAlert, Sparkles, AlertTriangle, GitMerge, Activity } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, AreaChart, Area } from "recharts";
import { getProjects } from "@/api/projects";
import { calculateEvm, getEvmHistory } from "@/api/evm";
import { getRiskIndex, getAnomalies, runWhatIf, syncJiraNow } from "@/api/ml";
import { fmtUsd, fmtIdx } from "@/lib/evm";
import { useAuth, RoleGate } from "@/auth/AuthProvider";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/** Linear regression on EVM history → projected snapshot when EV hits BAC. */
function regressEacForecast(history: any[], bac: number) {
  const pts = history.map((h, i) => ({ x: i, y: h.ev ?? h.total_ev ?? 0, date: h.snapshot_date }));
  if (pts.length < 2) return { forecast: [], etaIndex: null as number | null, slope: 0 };
  const n = pts.length;
  const sx = pts.reduce((a, p) => a + p.x, 0);
  const sy = pts.reduce((a, p) => a + p.y, 0);
  const sxy = pts.reduce((a, p) => a + p.x * p.y, 0);
  const sxx = pts.reduce((a, p) => a + p.x * p.x, 0);
  const slope = (n * sxy - sx * sy) / Math.max(1, n * sxx - sx * sx);
  const intercept = (sy - slope * sx) / n;
  const etaIndex = slope > 0 ? (bac - intercept) / slope : null;
  const horizon = Math.max(pts.length + 4, Math.ceil(etaIndex ?? pts.length + 4) + 1);
  const forecast = Array.from({ length: horizon }, (_, i) => ({
    idx: i,
    label: pts[i]?.date ?? `t+${i - pts.length + 1}`,
    actual: pts[i]?.y ?? null,
    projected: Math.max(0, intercept + slope * i),
    bac,
  }));
  return { forecast, etaIndex, slope };
}

export default function Intelligence() {
  const [params, setParams] = useSearchParams();
  const [projects, setProjects] = useState<any[]>([]);
  const [projectId, setProjectId] = useState(params.get("project_id") ?? "");
  const [evm, setEvm] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [risk, setRisk] = useState<any>(null);
  const [anom, setAnom] = useState<any>(null);
  const [capacity, setCapacity] = useState<number>(0);
  const [whatif, setWhatif] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { role } = useAuth();

  useEffect(() => {
    getProjects().then((p) => { setProjects(p); if (!projectId && p[0]) onProj(String(p[0].id)); }).catch((e) => toast.error(e.message));
  }, []);

  const onProj = (id: string) => { setProjectId(id); setParams({ project_id: id }); };

  const loadAll = async (id: string) => {
    setLoading(true);
    try {
      const [e, h, r, a] = await Promise.all([
        calculateEvm(id),
        getEvmHistory(id),
        getRiskIndex(id).catch(() => null),
        getAnomalies(id).catch(() => null),
      ]);
      setEvm(e); setHistory(h); setRisk(r); setAnom(a);
      setCapacity(0); setWhatif(null);
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { if (projectId) loadAll(projectId); }, [projectId]);

  const bac = evm?.total_budget ?? 0;
  const { forecast, etaIndex, slope } = useMemo(() => regressEacForecast(history, bac), [history, bac]);

  const onWhatIf = async (cap: number) => {
    setCapacity(cap);
    if (!projectId) return;
    try { setWhatif(await runWhatIf(projectId, cap, evm?.eac ?? bac)); } catch (e: any) { toast.error(e.message); }
  };

  const breachCount = (history || []).filter((h) => (h.cpi ?? 1) < 0.85 && (h.spi ?? 1) < 0.85).length;
  const isHighRisk = (risk?.high_risk ?? breachCount >= 2);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="h-7 w-7 text-primary" /> Intelligence
          </h2>
          <p className="text-muted-foreground mt-1">Predictive analytics powered by ML — EAC regression, risk classification, anomaly detection, and Monte Carlo simulation.</p>
        </div>
        <div className="flex gap-2">
          <Select value={projectId} onValueChange={onProj}>
            <SelectTrigger className="w-[260px] h-10 bg-card"><SelectValue placeholder="Choose project" /></SelectTrigger>
            <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
          <RoleGate allow={["Admin","Manager"]}>
            <Button variant="outline" onClick={async () => { try { await syncJiraNow(projectId); toast.success("Jira sync queued"); loadAll(projectId); } catch (e: any) { toast.error(e.message); } }} disabled={!projectId}>
              <GitMerge className="h-4 w-4 mr-2" /> Sync Jira
            </Button>
          </RoleGate>
        </div>
      </div>

      {/* 1. Predictive EAC — Linear Regression on EVM_History */}
      <Card className="card-elevated border-0 overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-primary to-primary/40" />
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Predictive EAC — Linear Regression</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Trend of Earned Value extrapolated against the Budget at Completion (BAC). Powered by ML <code className="text-[10px] bg-muted px-1 py-0.5 rounded">Linear Regression</code> model.</p>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Projected EAC</div>
            <div className="text-2xl font-bold num-mono">{fmtUsd(evm?.eac)}</div>
            <div className="text-xs text-muted-foreground">BAC {fmtUsd(bac)} · slope {slope.toFixed(0)}/snap</div>
          </div>
        </CardHeader>
        <CardContent style={{ height: 320 }}>
          <ResponsiveContainer>
            <LineChart data={forecast} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="evGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }} formatter={(v: any) => fmtUsd(v as number)} />
              <ReferenceLine y={bac} stroke="hsl(var(--warning))" strokeDasharray="4 4" label={{ value: "BAC", position: "right", fontSize: 10, fill: "hsl(var(--warning))" }} />
              {etaIndex != null && etaIndex >= 0 && etaIndex < forecast.length && (
                <ReferenceLine x={forecast[Math.round(etaIndex)]?.label} stroke="hsl(var(--success))" strokeDasharray="4 4" label={{ value: "ETA", position: "top", fontSize: 10, fill: "hsl(var(--success))" }} />
              )}
              <Line type="monotone" dataKey="actual" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3 }} name="EV (actual)" />
              <Line type="monotone" dataKey="projected" stroke="hsl(var(--slate))" strokeWidth={2} strokeDasharray="5 4" dot={false} name="Projected" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 2. Risk Probability Index */}
        <Card className="card-elevated border-0 overflow-hidden">
          <div className={cn("h-1", isHighRisk ? "bg-destructive" : "bg-success")} />
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-primary" /> Risk Probability Index</CardTitle>
            <p className="text-xs text-muted-foreground">High Risk when CPI &lt; 0.85 AND SPI &lt; 0.85 across more than 2 snapshots.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge className={cn("text-base px-3 py-1.5", isHighRisk ? "bg-destructive text-destructive-foreground" : "bg-success text-success-foreground")}>
                {isHighRisk ? "High Risk" : "Within Tolerance"}
              </Badge>
              <span className="text-sm text-muted-foreground">{breachCount} breach snapshot{breachCount === 1 ? "" : "s"} of {history.length}</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-md border p-3">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">CPI</div>
                <div className="text-xl font-bold num-mono">{fmtIdx(evm?.cpi)}</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">SPI</div>
                <div className="text-xl font-bold num-mono">{fmtIdx(evm?.spi)}</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">QPI</div>
                <div className="text-xl font-bold num-mono">{fmtIdx(evm?.qpi)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. Anomalous Data Normalizer */}
        <Card className="card-elevated border-0 overflow-hidden">
          <div className="h-1 bg-warning" />
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-warning" /> Anomalous Data Normalizer</CardTitle>
            <p className="text-xs text-muted-foreground">Flags Jira regressions (Done → In Progress) and EV spikes that skew the ledger. Uses ML-based Anomaly Detection.</p>
          </CardHeader>
          <CardContent>
            {anom?.anomalies?.length ? (
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="text-[11px] uppercase">Task</TableHead>
                  <TableHead className="text-[11px] uppercase">Type</TableHead>
                  <TableHead className="text-[11px] uppercase">Date</TableHead>
                  <TableHead className="text-[11px] uppercase text-right">Impact</TableHead>
                  <TableHead className="text-[11px] uppercase">Severity</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {anom.anomalies.map((a: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono">#{a.task_id}</TableCell>
                      <TableCell className="text-xs">{a.type}{a.from && a.to ? ` (${a.from} → ${a.to})` : ""}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{a.date}</TableCell>
                      <TableCell className={cn("text-right num-mono", (a.impact_ev ?? a.impact_ac ?? 0) < 0 ? "text-destructive" : "text-warning")}>
                        {fmtUsd(a.impact_ev ?? a.impact_ac ?? 0)}
                      </TableCell>
                      <TableCell><Badge variant="outline" className={cn("text-[10px]", a.severity === "High" ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-warning/40 bg-warning/10 text-warning")}>{a.severity}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground py-6 text-center">No anomalies detected for this project.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 4. Monte Carlo What-If — Manager / Admin only */}
      <RoleGate allow={["Admin","Manager"]} fallback={
        <Card className="card-elevated border-0">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            What-If simulation is restricted to Manager and Admin roles.
          </CardContent>
        </Card>
      }>
        <Card className="card-elevated border-0 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-primary via-accent to-success" />
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Monte Carlo "What-If" Simulator</CardTitle>
            <p className="text-xs text-muted-foreground">Adjust resource capacity and see the projected change in EAC. Computed via Monte Carlo simulation.</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              <div className="md:col-span-2 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Resource Capacity</span>
                  <span className={cn("num-mono font-bold", capacity > 0 ? "text-success" : capacity < 0 ? "text-destructive" : "text-foreground")}>
                    {capacity > 0 ? "+" : ""}{capacity}%
                  </span>
                </div>
                <Slider value={[capacity]} min={-50} max={50} step={5} onValueChange={(v) => onWhatIf(v[0])} />
                <div className="flex justify-between text-[10px] text-muted-foreground"><span>−50%</span><span>0</span><span>+50%</span></div>
              </div>
              <div className="rounded-md border p-4 bg-gradient-soft">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Adjusted EAC</div>
                <div className="text-2xl font-bold num-mono">{fmtUsd(whatif?.adjusted_eac ?? evm?.eac)}</div>
                {whatif && (
                  <div className={cn("text-xs num-mono mt-1", (whatif.delta ?? 0) <= 0 ? "text-success" : "text-destructive")}>
                    Δ {whatif.delta > 0 ? "+" : ""}{fmtUsd(whatif.delta)}
                  </div>
                )}
              </div>
            </div>
            <div style={{ height: 200 }}>
              <ResponsiveContainer>
                <AreaChart data={whatif?.curve ?? []}>
                  <defs>
                    <linearGradient id="wfg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="capacity_pct" stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `${v > 0 ? "+" : ""}${v}%`} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }} formatter={(v: any) => fmtUsd(v as number)} />
                  <Area type="monotone" dataKey="eac" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#wfg)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </RoleGate>

      <p className="text-xs text-muted-foreground flex items-center gap-2"><Activity className="h-3 w-3" /> Signed in as <span className="font-semibold text-foreground">{role}</span> · UI is gated by JWT role claims.</p>
    </div>
  );
}
