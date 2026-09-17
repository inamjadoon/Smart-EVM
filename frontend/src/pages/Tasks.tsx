import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getProjects, getUsers } from "@/api/projects";
import { getSprints } from "@/api/sprints";
import { getTasks, createTask, updateTask, deleteTask, recalculateQpi } from "@/api/tasks";
import { getMetrics, createMetric, deleteMetric } from "@/api/metrics";
import { toast } from "sonner";

const STATUSES = ["To Do", "In Progress", "Done"];
const empty = { sprint_id: "", assigned_user: "", description: "", status: "To Do", story_points: "" };
const emptyMetric = { critical_bugs: "0", major_bugs: "0", minor_bugs: "0", bug_count: "0", code_coverage: "85", tech_debt_hours: "2", calculated_qpi: "100" };

export default function Tasks() {
  const [projects, setProjects] = useState<any[]>([]);
  const [projectId, setProjectId] = useState("");
  const [sprints, setSprints] = useState<any[]>([]);
  const [sprintId, setSprintId] = useState("");
  const [tasks, setTasks] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [metricOpen, setMetricOpen] = useState(false);
  const [metricForm, setMetricForm] = useState<any>(emptyMetric);

  useEffect(() => {
    getProjects()
      .then((p) => {
        setProjects(p);
        if (p.length > 0) setProjectId(String(p[0].id));
      })
      .catch((e) => toast.error(e.message));
    getUsers()
      .then(setUsers)
      .catch((e) => toast.error(e.message));
  }, []);

  useEffect(() => {
    setSprints([]);
    setSprintId("");
    setTasks([]);
    if (projectId) {
      getSprints(projectId)
        .then((s) => {
          setSprints(s);
          if (s.length > 0) setSprintId(String(s[0].id));
        })
        .catch((e) => toast.error(e.message));
    }
  }, [projectId]);

  const load = () => sprintId && getTasks(sprintId).then(setTasks).catch((e) => toast.error(e.message));
  useEffect(() => { setTasks([]); load(); }, [sprintId]);

  const submit = async () => {
    try {
      const payload = { ...form, sprint_id: sprintId, story_points: Number(form.story_points) };
      if (editingId) await updateTask(editingId, payload);
      else await createTask(payload);
      toast.success(editingId ? "Task updated" : "Task created");
      setOpen(false); setForm(empty); setEditingId(null); load();
    } catch (e: any) { toast.error(e.message); }
  };

  const onEdit = (t: any) => {
    setEditingId(t.id);
    setForm({
      ...empty,
      ...t,
      assigned_user: t.assigned_user != null && t.assigned_user !== "" ? String(t.assigned_user) : "",
    });
    setOpen(true);
  };
  const onDelete = async (id: string) => {
    if (!confirm("Delete?")) return;
    try { await deleteTask(id); toast.success("Deleted"); load(); } catch (e: any) { toast.error(e.message); }
  };
  const onStatusChange = async (t: any, status: string) => {
    try { await updateTask(t.id, { ...t, status }); load(); } catch (e: any) { toast.error(e.message); }
  };
  const onQpi = async (id: string) => {
    try { await recalculateQpi(id); toast.success("QPI recalculated"); load(); } catch (e: any) { toast.error(e.message); }
  };

  const loadMetrics = (taskId: string) => {
    setSelectedTaskId(taskId);
    getMetrics(taskId).then(setMetrics).catch((e: any) => toast.error(e.message));
  };
  const submitMetric = async () => {
    if (!selectedTaskId) return;
    try {
      await createMetric({ ...metricForm, task_id: Number(selectedTaskId), critical_bugs: Number(metricForm.critical_bugs), major_bugs: Number(metricForm.major_bugs), minor_bugs: Number(metricForm.minor_bugs), bug_count: Number(metricForm.bug_count), code_coverage: Number(metricForm.code_coverage), tech_debt_hours: Number(metricForm.tech_debt_hours), calculated_qpi: Number(metricForm.calculated_qpi) });
      toast.success("Metric saved");
      setMetricOpen(false);
      setMetricForm(emptyMetric);
      loadMetrics(selectedTaskId);
    } catch (e: any) { toast.error(e.message); }
  };
  const deleteMetricRow = async (id: string) => {
    if (!confirm("Delete metric?")) return;
    try { await deleteMetric(id); toast.success("Deleted"); if (selectedTaskId) loadMetrics(selectedTaskId); } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Tasks</h2>
          <p className="text-muted-foreground mt-1">Manage tasks per sprint.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditingId(null); setForm(empty); } }}>
          <DialogTrigger asChild><Button disabled={!sprintId} className="bg-gradient-primary hover:opacity-90 shadow-soft">New Task</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingId ? "Edit Task" : "New Task"}</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div>
                <Label>Assigned User</Label>
                <Select
                  value={form.assigned_user ? String(form.assigned_user) : "unassigned"}
                  onValueChange={(v) => setForm({ ...form, assigned_user: v === "unassigned" ? "" : v })}
                >
                  <SelectTrigger className="w-full bg-card"><SelectValue placeholder="Select user (optional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.user_id} value={String(u.user_id)}>
                        {u.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div><Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Story Points</Label><Input type="number" value={form.story_points} onChange={(e) => setForm({ ...form, story_points: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={submit}>{editingId ? "Save" : "Create"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="card-elevated border-0">
        <CardHeader><CardTitle className="text-base">Filters</CardTitle></CardHeader>
        <CardContent className="flex gap-3 flex-wrap">
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="w-[280px] h-10 bg-card"><SelectValue placeholder="Project" /></SelectTrigger>
            <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={sprintId} onValueChange={setSprintId} disabled={!sprints.length}>
            <SelectTrigger className="w-[280px] h-10 bg-card"><SelectValue placeholder="Sprint" /></SelectTrigger>
            <SelectContent>{sprints.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.sprint_name ?? `Sprint ${s.sprint_number}`}</SelectItem>)}</SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="card-elevated border-0">
        <CardHeader><CardTitle>Tasks</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Description</TableHead><TableHead>Assignee</TableHead>
                <TableHead>Status</TableHead><TableHead>SP</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{t.description}</TableCell>
                  <TableCell>
                    {users.find((u) => String(u.user_id) === String(t.assigned_user))?.username ??
                      (t.assigned_user ? `User #${t.assigned_user}` : "—")}
                  </TableCell>
                  <TableCell>
                    <Select value={t.status} onValueChange={(v) => onStatusChange(t, v)}>
                      <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>{t.story_points}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button size="sm" variant="outline" onClick={() => onQpi(t.id)}>Recalc QPI</Button>
                    <Button size="sm" variant="outline" onClick={() => onEdit(t)}>Edit</Button>
                    <Button size="sm" variant="secondary" onClick={() => loadMetrics(t.id)}>Metrics</Button>
                    <Button size="sm" variant="destructive" onClick={() => onDelete(t.id)}>Delete</Button>
                  </TableCell>
                </TableRow>
              ))}
              {!tasks.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">{sprintId ? "No tasks." : "Pick a sprint."}</TableCell></TableRow>}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      {selectedTaskId && (
        <Card className="card-elevated border-0">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Quality Metrics — Task #{selectedTaskId}</CardTitle>
            <Dialog open={metricOpen} onOpenChange={(o) => { setMetricOpen(o); if (!o) setMetricForm(emptyMetric); }}>
              <DialogTrigger asChild><Button size="sm" className="bg-primary hover:bg-primary/90">Add Metric</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Quality Metric</DialogTitle></DialogHeader>
                <div className="grid gap-3">
                  {(["critical_bugs","major_bugs","minor_bugs","bug_count","code_coverage","tech_debt_hours","calculated_qpi"] as const).map((field) => (
                    <div key={field}><Label className="capitalize">{field.replace(/_/g," ")}</Label><Input type="number" value={metricForm[field]} onChange={(e) => setMetricForm({...metricForm,[field]:e.target.value})} /></div>
                  ))}
                </div>
                <DialogFooter><Button onClick={submitMetric}>Save</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Critical Bugs</TableHead><TableHead>Major Bugs</TableHead><TableHead>Minor Bugs</TableHead>
                  <TableHead>Total Bugs</TableHead><TableHead>Coverage %</TableHead><TableHead>Tech Debt (h)</TableHead>
                  <TableHead>QPI</TableHead><TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.map((m) => (
                  <TableRow key={m.id ?? m.metric_id}>
                    <TableCell>{m.critical_bugs}</TableCell>
                    <TableCell>{m.major_bugs}</TableCell>
                    <TableCell>{m.minor_bugs}</TableCell>
                    <TableCell>{m.bug_count}</TableCell>
                    <TableCell>{m.code_coverage}%</TableCell>
                    <TableCell>{m.tech_debt_hours}h</TableCell>
                    <TableCell className="font-mono font-semibold">{Number(m.calculated_qpi).toFixed(1)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="destructive" onClick={() => deleteMetricRow(String(m.id ?? m.metric_id))}>Delete</Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!metrics.length && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">No metrics for this task. Click "Add Metric" to record one.</TableCell></TableRow>}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
