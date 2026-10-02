import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { getProjects } from "@/api/projects";
import { getSprints, createSprint, updateSprint, deleteSprint } from "@/api/sprints";
import { toast } from "sonner";
import { RoleGate } from "@/auth/AuthProvider";

const empty = { project_id: "", sprint_number: "", sprint_name: "", start_date: "", end_date: "", planned_value: "" };

export default function Sprints() {
  const [projects, setProjects] = useState<any[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [sprints, setSprints] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    getProjects()
      .then((p) => {
        setProjects(p);
        if (p.length > 0 && !projectId) {
          setProjectId(String(p[0].id));
        }
      })
      .catch((e) => toast.error(e.message));
  }, []);
  const load = () => projectId && getSprints(projectId).then(setSprints).catch((e) => toast.error(e.message));
  useEffect(() => { setSprints([]); load(); }, [projectId]);

  const submit = async () => {
    try {
      const payload = {
        ...form,
        project_id: projectId,
        sprint_number: Number(form.sprint_number),
        planned_value: Number(form.planned_value),
      };
      if (editingId) await updateSprint(editingId, payload);
      else await createSprint(payload);
      toast.success(editingId ? "Sprint updated" : "Sprint created");
      setOpen(false); setForm(empty); setEditingId(null); load();
    } catch (e: any) { toast.error(e.message); }
  };

  const onEdit = (s: any) => { setEditingId(s.id); setForm({ ...empty, ...s }); setOpen(true); };
  const onDelete = async (id: string) => {
    if (!confirm("Delete?")) return;
    try { await deleteSprint(id); toast.success("Deleted"); load(); } catch (e: any) { toast.error(e.message); }
  };

  const chartData = useMemo(
    () => sprints.map((s) => ({ name: s.sprint_name ?? `Sprint ${s.sprint_number}`, PV: s.planned_value ?? 0, EV: s.earned_value ?? 0 })),
    [sprints]
  );

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Sprints</h2>
          <p className="text-muted-foreground mt-1">Manage sprints per project.</p>
        </div>
        <RoleGate allow={["Admin", "Manager"]}>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditingId(null); setForm(empty); } }}>
          <DialogTrigger asChild><Button disabled={!projectId} className="bg-gradient-primary hover:opacity-90 shadow-soft">New Sprint</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingId ? "Edit Sprint" : "New Sprint"}</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div><Label>Sprint Number</Label><Input type="number" value={form.sprint_number} onChange={(e) => setForm({ ...form, sprint_number: e.target.value })} /></div>
              <div><Label>Sprint Name</Label><Input value={form.sprint_name} onChange={(e) => setForm({ ...form, sprint_name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Start Date</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
                <div><Label>End Date</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
              </div>
              <div><Label>Planned Value</Label><Input type="number" value={form.planned_value} onChange={(e) => setForm({ ...form, planned_value: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={submit}>{editingId ? "Save" : "Create"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
        </RoleGate>
      </div>

      <Card className="card-elevated border-0">
        <CardHeader><CardTitle className="text-base">Filter by Project</CardTitle></CardHeader>
        <CardContent>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="w-full md:w-[320px] h-10 bg-card"><SelectValue placeholder="Choose a project" /></SelectTrigger>
            <SelectContent>
              {projects.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {!!sprints.length && (
        <Card className="card-elevated border-0">
          <CardHeader><CardTitle>EV vs PV per Sprint</CardTitle></CardHeader>
          <CardContent style={{ height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Legend />
                <Bar dataKey="PV" fill="hsl(var(--muted-foreground))" radius={[6,6,0,0]} />
                <Bar dataKey="EV" fill="hsl(var(--primary))" radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card className="card-elevated border-0">
        <CardHeader><CardTitle>Sprints</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>#</TableHead><TableHead>Name</TableHead><TableHead>Start</TableHead>
                <TableHead>End</TableHead><TableHead>PV</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sprints.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.sprint_number}</TableCell>
                  <TableCell>{s.sprint_name}</TableCell>
                  <TableCell>{s.start_date}</TableCell>
                  <TableCell>{s.end_date}</TableCell>
                  <TableCell>${Number(s.planned_value ?? 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <RoleGate allow={["Admin", "Manager"]} fallback={<span className="text-xs text-muted-foreground">View only</span>}>
                      <Button size="sm" variant="outline" onClick={() => onEdit(s)}>Edit</Button>
                      <Button size="sm" variant="destructive" onClick={() => onDelete(s.id)}>Delete</Button>
                    </RoleGate>
                  </TableCell>
                </TableRow>
              ))}
              {!sprints.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{projectId ? "No sprints." : "Pick a project."}</TableCell></TableRow>}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
