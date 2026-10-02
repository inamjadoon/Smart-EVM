import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, RotateCcw, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  getProjects, createProject, updateProject, deleteProject, syncJira, getUsers, completeProject, reopenProject,
} from "@/api/projects";
import { errorMessage } from "@/api/auth";
import { toast } from "sonner";
import { RoleGate, useAuth } from "@/auth/AuthProvider";

type ProjectForm = { name: string; total_budget: string | number; start_date: string; end_date: string; manager_id: string | number };
type PickerUser = { user_id: number; username: string; full_name?: string; role?: string };
const empty: ProjectForm = { name: "", total_budget: "", start_date: "", end_date: "", manager_id: "" };

type Project = {
  id: number;
  name: string;
  total_budget: number | null;
  start_date: string | null;
  end_date: string | null;
  manager_id: number | null;
  manager_name: string | null;
  is_completed: boolean;
  completed_at: string | null;
  tasks_total: number;
  tasks_done: number;
  progress_pct: number;
};

export default function Projects() {
  const { role, user } = useAuth();
  const canManage = (p: Project) => role === "Admin" || (role === "Manager" && p.manager_id === user?.id);
  const [params, setParams] = useSearchParams();

  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<PickerUser[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ProjectForm>(empty);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const q = params.get("q") ?? "";

  const load = () => getProjects().then(setProjects).catch((e) => toast.error(errorMessage(e)));

  useEffect(() => {
    load();
    if (role === "Admin") getUsers().then(setUsers).catch(() => {});
  }, [role]);

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return projects.filter((p) =>
      (statusFilter === "all" || (statusFilter === "completed") === p.is_completed) &&
      (!term || p.name.toLowerCase().includes(term) || (p.manager_name ?? "").toLowerCase().includes(term)));
  }, [projects, q, statusFilter]);

  const submit = async () => {
    if (!form.name || !form.name.trim()) return toast.error("Project name is required");
    if (form.start_date && form.end_date && form.end_date < form.start_date) {
      return toast.error("End date cannot be before the start date");
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        total_budget: form.total_budget !== "" && form.total_budget != null ? Number(form.total_budget) : 0,
        manager_id: form.manager_id ? Number(form.manager_id) : null,
      };
      if (editingId) await updateProject(editingId, payload);
      else await createProject(payload);
      toast.success(editingId ? "Project updated" : "Project created");
      setOpen(false); setForm(empty); setEditingId(null); load();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const onEdit = (p: Project) => {
    setEditingId(p.id);
    setForm({
      name: p.name, total_budget: p.total_budget ?? "", start_date: p.start_date ?? "",
      end_date: p.end_date ?? "", manager_id: p.manager_id ?? "",
    });
    setOpen(true);
  };
  const onDelete = async (p: Project) => {
    if (!confirm(`Delete "${p.name}" and all of its sprints and tasks? This cannot be undone.`)) return;
    try { await deleteProject(p.id); toast.success("Project deleted"); load(); } catch (e) { toast.error(errorMessage(e)); }
  };
  const onSyncJira = async (p: Project) => {
    try { await syncJira(p.id); toast.success("Jira issues imported"); load(); } catch (e) { toast.error(errorMessage(e)); }
  };
  const onComplete = async (p: Project) => {
    const open = p.tasks_total - p.tasks_done;
    const warn = open > 0 ? `\n\n${open} task(s) are still not done.` : "";
    if (!confirm(`Mark "${p.name}" as completed?${warn}\n\nThe project becomes read-only until it is reopened.`)) return;
    try { await completeProject(p.id); toast.success(`${p.name} marked completed`); load(); } catch (e) { toast.error(errorMessage(e)); }
  };
  const onReopen = async (p: Project) => {
    try { await reopenProject(p.id); toast.success(`${p.name} reopened`); load(); } catch (e) { toast.error(errorMessage(e)); }
  };

  const managers = users.filter((u) => u.role === "Manager" || u.role === "Admin");
  const activeCount = projects.filter((p) => !p.is_completed).length;

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Projects</h2>
          <p className="text-muted-foreground mt-1">
            {role === "Manager" ? "Projects you manage." : "Create and manage projects."}{" "}
            {projects.length > 0 && `${activeCount} active · ${projects.length - activeCount} completed`}
          </p>
        </div>
        <RoleGate allow={["Admin", "Manager"]}>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditingId(null); setForm(empty); } }}>
            <DialogTrigger asChild><Button className="bg-primary hover:bg-primary/90 shadow-soft">New Project</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editingId ? "Edit Project" : "New Project"}</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div><Label htmlFor="pj-name">Name *</Label><Input id="pj-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Website UI Redesign" /></div>
                <div><Label htmlFor="pj-budget">Total Budget ($)</Label><Input id="pj-budget" type="number" min={0} value={form.total_budget} onChange={(e) => setForm({ ...form, total_budget: e.target.value })} placeholder="e.g. 500000" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label htmlFor="pj-start">Start Date</Label><Input id="pj-start" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
                  <div><Label htmlFor="pj-end">End Date</Label><Input id="pj-end" type="date" min={form.start_date || undefined} value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
                </div>
                <RoleGate allow={["Admin"]} fallback={
                  <p className="text-xs text-muted-foreground">You will be the manager of this project.</p>
                }>
                  <div>
                    <Label>Project Manager</Label>
                    <Select value={form.manager_id ? String(form.manager_id) : "none"}
                      onValueChange={(v) => setForm({ ...form, manager_id: v === "none" ? "" : v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None (assign later)</SelectItem>
                        {managers.map((u) => (
                          <SelectItem key={u.user_id} value={String(u.user_id)}>{u.full_name ?? u.username} ({u.role})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </RoleGate>
              </div>
              <DialogFooter><Button onClick={submit} disabled={saving}>{saving ? "Saving…" : editingId ? "Save" : "Create"}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </RoleGate>
      </div>

      <Card className="card-elevated border-0">
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap space-y-0">
          <CardTitle>{role === "Manager" ? "My Projects" : "All Projects"}</CardTitle>
          <div className="flex gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search projects" value={q} className="pl-8 h-9 w-56"
                onChange={(e) => setParams(e.target.value ? { q: e.target.value } : {}, { replace: true })} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Name</TableHead><TableHead>Status</TableHead><TableHead className="min-w-[130px]">Progress</TableHead>
                  <TableHead>Budget</TableHead><TableHead>Dates</TableHead>
                  <TableHead>Manager</TableHead><TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((p) => (
                  <TableRow key={p.id} className={p.is_completed ? "bg-muted/30" : ""}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>
                      {p.is_completed ? (
                        <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 gap-1"
                          title={p.completed_at ? `Completed ${new Date(p.completed_at).toLocaleDateString()}` : undefined}>
                          <CheckCircle2 className="h-3 w-3" /> Completed
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={p.progress_pct} className="h-2 flex-1" />
                        <span className="text-xs tabular-nums w-9 text-right">{Math.round(p.progress_pct)}%</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">{p.tasks_done}/{p.tasks_total} tasks done</div>
                    </TableCell>
                    <TableCell>${Number(p.total_budget ?? 0).toLocaleString()}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      <div>{p.start_date || "—"}</div>
                      <div className="text-muted-foreground">→ {p.end_date || "—"}</div>
                    </TableCell>
                    <TableCell>
                      {p.manager_name ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground">{p.manager_name}</span>
                      ) : (
                        <span className="text-muted-foreground text-xs">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap space-x-2">
                      {canManage(p) && !p.is_completed && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => onSyncJira(p)}>Sync Jira</Button>
                          <Button size="sm" variant="outline" onClick={() => onEdit(p)}>Edit</Button>
                          <Button size="sm" variant="outline" className="gap-1 text-emerald-600" onClick={() => onComplete(p)}>
                            <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                          </Button>
                        </>
                      )}
                      {canManage(p) && p.is_completed && (
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => onReopen(p)}>
                          <RotateCcw className="h-3.5 w-3.5" /> Reopen
                        </Button>
                      )}
                      <RoleGate allow={["Admin"]}>
                        <Button size="sm" variant="destructive" onClick={() => onDelete(p)}>Delete</Button>
                      </RoleGate>
                      {!canManage(p) && role !== "Admin" && <span className="text-xs text-muted-foreground">View only</span>}
                    </TableCell>
                  </TableRow>
                ))}
                {!visible.length && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    {projects.length ? "No projects match your filters." :
                      role === "Manager" ? "You don't manage any projects yet. Create one, or ask an admin to assign you." : "No projects yet."}
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
