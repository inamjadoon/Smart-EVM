import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, Search, Download, GitMerge } from "lucide-react";
import { getProjects } from "@/api/projects";
import { getLedger } from "@/api/ledger";
import { syncJiraNow } from "@/api/ml";
import { sv, cv, spi, cpi, fmtUsd, fmtIdx, idxTone } from "@/lib/evm";
import { useAuth, RoleGate } from "@/auth/AuthProvider";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const statusTone = (s: string) =>
  s === "Done" ? "bg-success/10 text-success border-success/30"
  : s === "In Progress" ? "bg-primary-soft text-primary border-primary/30"
  : "bg-muted text-muted-foreground border-border";

export default function ProjectLedger() {
  const [params, setParams] = useSearchParams();
  const [projects, setProjects] = useState<any[]>([]);
  const [projectId, setProjectId] = useState(params.get("project_id") ?? "");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const { role } = useAuth();

  useEffect(() => { getProjects().then((p) => { setProjects(p); if (!projectId && p[0]) onProj(String(p[0].id)); }).catch((e) => toast.error(e.message)); }, []);

  const load = async (id: string) => {
    setLoading(true);
    try { setRows(await getLedger(id)); } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { if (projectId) load(projectId); }, [projectId]);

  const onProj = (id: string) => { setProjectId(id); setParams({ project_id: id }); };
  const onSync = async () => {
    if (!projectId) return;
    try { await syncJiraNow(projectId); toast.success("Jira sync started — refreshing ledger…"); await load(projectId); }
    catch (e: any) { toast.error(e.message); }
  };
  const onExport = () => {
    const headers = ["Task","Sprint","Status","SP","PV","EV","AC","SV","CV","SPI","CPI"];
    const lines = rows.filter(filterFn).map((r) => [
      JSON.stringify(r.task_description), r.sprint_name, r.status, r.story_points,
      r.planned_value, r.earned_value, r.actual_cost,
      sv(r.earned_value, r.planned_value), cv(r.earned_value, r.actual_cost),
      spi(r.earned_value, r.planned_value).toFixed(3), cpi(r.earned_value, r.actual_cost).toFixed(3),
    ].join(","));
    const csv = [headers.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `ledger-${projectId}.csv`; a.click();
  };

  const filterFn = (r: any) => !q || (r.task_description?.toLowerCase().includes(q.toLowerCase()) || r.sprint_name?.toLowerCase().includes(q.toLowerCase()));
  const filtered = useMemo(() => rows.filter(filterFn), [rows, q]);

  const totals = useMemo(() => {
    const t = filtered.reduce((a, r) => ({ pv: a.pv + (r.planned_value || 0), ev: a.ev + (r.earned_value || 0), ac: a.ac + (r.actual_cost || 0) }), { pv: 0, ev: 0, ac: 0 });
    return { ...t, sv: sv(t.ev, t.pv), cv: cv(t.ev, t.pv), spi: spi(t.ev, t.pv), cpi: cpi(t.ev, t.ac) };
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Project Ledger</h2>
          <p className="text-muted-foreground mt-1">Granular task-level Earned Value — every row reconciles to PV, EV, AC.</p>
        </div>
        <div className="flex gap-2">
          <Select value={projectId} onValueChange={onProj}>
            <SelectTrigger className="w-[260px] h-10 bg-card"><SelectValue placeholder="Choose project" /></SelectTrigger>
            <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" onClick={() => projectId && load(projectId)} disabled={!projectId || loading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} /> Refresh
          </Button>
          <RoleGate allow={["Admin","Manager"]}>
            <Button onClick={onSync} disabled={!projectId} className="bg-primary hover:bg-primary/90">
              <GitMerge className="h-4 w-4 mr-2" /> Sync Jira
            </Button>
          </RoleGate>
          <Button variant="outline" onClick={onExport} disabled={!filtered.length}><Download className="h-4 w-4 mr-2" /> CSV</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Σ PV", value: fmtUsd(totals.pv), tone: "text-foreground" },
          { label: "Σ EV", value: fmtUsd(totals.ev), tone: "text-primary" },
          { label: "Σ AC", value: fmtUsd(totals.ac), tone: "text-foreground" },
          { label: "SPI",  value: fmtIdx(totals.spi), tone: idxTone(totals.spi) },
          { label: "CPI",  value: fmtIdx(totals.cpi), tone: idxTone(totals.cpi) },
        ].map((s) => (
          <Card key={s.label} className="card-elevated border-0">
            <CardContent className="p-4">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{s.label}</div>
              <div className={cn("text-2xl font-bold num-mono mt-1", s.tone)}>{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="card-elevated border-0">
        <CardHeader className="flex-row items-center justify-between space-y-0 gap-4">
          <CardTitle className="text-base">Task Ledger {filtered.length ? <span className="text-muted-foreground font-normal text-sm">· {filtered.length} rows</span> : null}</CardTitle>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…" className="pl-8 h-9 w-64" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="text-[11px] uppercase tracking-wider">Task</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Sprint</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Status</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider text-right">SP</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider text-right">PV</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider text-right">EV</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider text-right">AC</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider text-right">SV</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider text-right">CV</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider text-right">SPI</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider text-right">CPI</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const _sv = sv(r.earned_value, r.planned_value);
                  const _cv = cv(r.earned_value, r.actual_cost);
                  const _spi = spi(r.earned_value, r.planned_value);
                  const _cpi = cpi(r.earned_value, r.actual_cost);
                  return (
                    <TableRow key={r.task_id} className="hover:bg-muted/30">
                      <TableCell className="font-medium max-w-[280px] truncate">{r.task_description}</TableCell>
                      <TableCell className="text-muted-foreground">{r.sprint_name}</TableCell>
                      <TableCell><Badge variant="outline" className={cn("text-[10px]", statusTone(r.status))}>{r.status}</Badge></TableCell>
                      <TableCell className="text-right num-mono">{r.story_points}</TableCell>
                      <TableCell className="text-right num-mono">{fmtUsd(r.planned_value)}</TableCell>
                      <TableCell className="text-right num-mono text-primary font-semibold">{fmtUsd(r.earned_value)}</TableCell>
                      <TableCell className="text-right num-mono">{fmtUsd(r.actual_cost)}</TableCell>
                      <TableCell className={cn("text-right num-mono", _sv >= 0 ? "text-success" : "text-destructive")}>{fmtUsd(_sv)}</TableCell>
                      <TableCell className={cn("text-right num-mono", _cv >= 0 ? "text-success" : "text-destructive")}>{fmtUsd(_cv)}</TableCell>
                      <TableCell className={cn("text-right num-mono font-semibold", idxTone(_spi))}>{fmtIdx(_spi)}</TableCell>
                      <TableCell className={cn("text-right num-mono font-semibold", idxTone(_cpi))}>{fmtIdx(_cpi)}</TableCell>
                    </TableRow>
                  );
                })}
                {!filtered.length && (
                  <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-12">{loading ? "Loading…" : projectId ? "No tasks." : "Pick a project."}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {role === "Viewer" && (
        <p className="text-xs text-muted-foreground">Read-only view. Sync controls are restricted to Manager and Admin roles.</p>
      )}
    </div>
  );
}
