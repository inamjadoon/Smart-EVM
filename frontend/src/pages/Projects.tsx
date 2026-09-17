import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getProjects, createProject, updateProject, deleteProject, syncJira, getUsers } from "@/api/projects";
import { toast } from "sonner";
import { RoleGate } from "@/auth/AuthProvider";

const empty = { name: "", total_budget: "", start_date: "", end_date: "", manager_id: "" };

export default function Projects() {
  const [projects, setProjects] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = () => getProjects().then(setProjects).catch((e) => toast.error(e.message));
  
  useEffect(() => { 
    load(); 
    getUsers().then(setUsers).catch(() => {});
  }, []);

  const submit = async () => {
    try {
      if (!form.name || !form.name.trim()) {
        toast.error("Project name is required");
        return;
      }
      const payload = { 
        ...form, 
        total_budget: form.total_budget !== "" ? Number(form.total_budget) : 0,
        manager_id: form.manager_id ? Number(form.manager_id) : null,
      };
      if (editingId) await updateProject(editingId, payload);
      else await createProject(payload);
      toast.success(editingId ? "Project updated" : "Project created");
      setOpen(false); setForm(empty); setEditingId(null); load();
    } catch (e: any) { toast.error(e.message); }
  };

  const onEdit = (p: any) => { setEditingId(p.id); setForm({ ...empty, ...p }); setOpen(true); };
  const onDelete = async (id: string) => {
    if (!confirm("Delete this project?")) return;
    try { await deleteProject(id); toast.success("Deleted"); load(); } catch (e: any) { toast.error(e.message); }
  };
  const onSyncJira = async (id: string) => {
    try { await syncJira(id); toast.success("JIRA sync started"); } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Projects</h2>
          <p className="text-muted-foreground mt-1">Create and manage projects.</p>
        </div>
        <RoleGate allow={["Admin","Manager"]}>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditingId(null); setForm(empty); } }}>
          <DialogTrigger asChild><Button className="bg-primary hover:bg-primary/90 shadow-soft">New Project</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingId ? "Edit Project" : "New Project"}</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Website UI Redesign" /></div>
              <div><Label>Total Budget ($)</Label><Input type="number" value={form.total_budget} onChange={(e) => setForm({ ...form, total_budget: e.target.value })} placeholder="e.g. 500000" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Start Date</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
                <div><Label>End Date</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
              </div>
              <div>
                <Label>Project Manager</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={form.manager_id || ""}
                  onChange={(e) => setForm({ ...form, manager_id: e.target.value })}
                >
                  <option value="">None (Assign Later)</option>
                  {users.map((u) => (
                    <option key={u.user_id} value={u.user_id}>
                      {u.username} (#{u.user_id})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <DialogFooter><Button onClick={submit}>{editingId ? "Save" : "Create"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
        </RoleGate>
      </div>

      <Card className="card-elevated border-0">
        <CardHeader><CardTitle>All Projects</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Name</TableHead><TableHead>Budget</TableHead><TableHead>Start</TableHead>
                <TableHead>End</TableHead><TableHead>Manager</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((p) => {
                const manager = users.find((u) => String(u.user_id) === String(p.manager_id));
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>${Number(p.total_budget ?? 0).toLocaleString()}</TableCell>
                    <TableCell>{p.start_date || "—"}</TableCell>
                    <TableCell>{p.end_date || "—"}</TableCell>
                    <TableCell>
                      {manager ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground">
                          {manager.username}
                        </span>
                      ) : p.manager_id ? (
                        `#${p.manager_id}`
                      ) : (
                        <span className="text-muted-foreground text-xs">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <RoleGate allow={["Admin","Manager"]}>
                        <Button size="sm" variant="outline" onClick={() => onSyncJira(p.id)}>Sync Jira</Button>
                        <Button size="sm" variant="outline" onClick={() => onEdit(p)}>Edit</Button>
                      </RoleGate>
                      <RoleGate allow={["Admin"]}>
                        <Button size="sm" variant="destructive" onClick={() => onDelete(p.id)}>Delete</Button>
                      </RoleGate>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!projects.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No projects.</TableCell></TableRow>}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

