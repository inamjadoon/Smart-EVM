import { useCallback, useEffect, useMemo, useState } from "react";
import { Users, UserCheck, ListChecks, Gauge, Plus, KeyRound, Search, Loader2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { adminApi, teamApi, passwordProblem, type Role, type UserProgress, errorMessage } from "@/api/auth";
import { useAuth } from "@/auth/AuthProvider";
import { ActivityLog } from "@/components/ActivityLog";
import { toast } from "sonner";

const ROLES: Role[] = ["Admin", "Manager", "Developer", "Viewer"];

const roleBadge: Record<Role, string> = {
  Admin: "border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400",
  Manager: "border-primary/30 bg-primary/10 text-primary",
  Developer: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  Viewer: "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
};

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "Never";

const emptyNewUser = { full_name: "", email: "", password: "", role: "Developer" as Role, organization: "" };

export default function Team() {
  const { role, user: me } = useAuth();
  const isAdmin = role === "Admin";

  const [members, setMembers] = useState<UserProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [busyId, setBusyId] = useState<number | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [newUser, setNewUser] = useState(emptyNewUser);
  const [saving, setSaving] = useState(false);

  const [resetFor, setResetFor] = useState<UserProgress | null>(null);
  const [resetPwd, setResetPwd] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setMembers(isAdmin ? await adminApi.users() : await teamApi.progress());
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);
  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    const rows = members.filter(
      (m) =>
        (roleFilter === "all" || m.role === roleFilter) &&
        (!term || m.full_name.toLowerCase().includes(term) || m.email.toLowerCase().includes(term))
    );
    // Managers: people working on my projects first, busiest first.
    return isAdmin ? rows : [...rows].sort((a, b) => b.progress.total_tasks - a.progress.total_tasks);
  }, [members, q, roleFilter, isAdmin]);

  const stats = useMemo(() => {
    const active = members.filter((m) => m.is_active);
    const total = active.reduce((s, m) => s + m.progress.total_tasks, 0);
    const done = active.reduce((s, m) => s + m.progress.done_tasks, 0);
    return {
      members: members.length,
      active: active.length,
      inProgress: active.reduce((s, m) => s + m.progress.in_progress_tasks, 0),
      completion: total ? Math.round((100 * done) / total) : 0,
      done,
      total,
    };
  }, [members]);

  const patch = async (m: UserProgress, body: Partial<{ role: Role; is_active: boolean; reports_to: number | null }>, msg: string) => {
    setBusyId(m.user_id);
    try {
      const updated = await adminApi.updateUser(m.user_id, body);
      setMembers((list) => list.map((x) => (x.user_id === m.user_id ? { ...x, ...updated } : x)));
      toast.success(msg);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const createUser = async () => {
    const problem = passwordProblem(newUser.password);
    if (!newUser.full_name.trim() || !newUser.email.trim()) return toast.error("Name and email are required");
    if (problem) return toast.error(`Password: ${problem}`);
    setSaving(true);
    try {
      await adminApi.createUser({ ...newUser, organization: newUser.organization || undefined });
      toast.success(`${newUser.full_name} added as ${newUser.role}`);
      setCreateOpen(false);
      setNewUser(emptyNewUser);
      load();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async () => {
    if (!resetFor) return;
    const problem = passwordProblem(resetPwd);
    if (problem) return toast.error(`Password: ${problem}`);
    setSaving(true);
    try {
      await adminApi.resetPassword(resetFor.user_id, resetPwd);
      toast.success(`Password reset for ${resetFor.full_name}. Share it with them securely.`);
      setResetFor(null);
      setResetPwd("");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  // Managers/Admins who can lead a team (for the Team column).
  const leads = members.filter((m) => m.is_active && (m.role === "Manager" || m.role === "Admin"));
  const unassignedDevs = members.filter((m) => m.is_active && m.role === "Developer" && !m.reports_to).length;

  const statCards = [
    { label: isAdmin ? "Total users" : "Team members", value: stats.members, icon: Users },
    { label: "Active", value: stats.active, icon: UserCheck },
    { label: "Tasks in progress", value: stats.inProgress, icon: ListChecks },
    { label: "Task completion", value: `${stats.completion}%`, sub: `${stats.done} of ${stats.total} done`, icon: Gauge },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{isAdmin ? "Users & Access" : "Team Progress"}</h2>
          <p className="text-muted-foreground mt-1">
            {isAdmin
              ? "Manage accounts and roles, and track everyone's delivery progress."
              : "Developer progress on the projects you manage."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          {isAdmin && (
            <Button onClick={() => setCreateOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Add user
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-5 flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
                <p className="text-2xl font-bold mt-1">{loading ? "—" : s.value}</p>
                {s.sub && !loading && <p className="text-[11px] text-muted-foreground mt-0.5">{s.sub}</p>}
              </div>
              <s.icon className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap space-y-0">
          <div>
            <CardTitle className="text-base">{isAdmin ? "Members" : "My team"}</CardTitle>
            {isAdmin && unassignedDevs > 0 && !loading && (
              <p className="text-xs text-amber-600 mt-1">
                {unassignedDevs} developer(s) aren't on a team yet — pick a manager in the Team column so they can be assigned work.
              </p>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8 h-9 w-56" />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  {isAdmin && <TableHead title="Which manager's team this developer is on">Team</TableHead>}
                  <TableHead className="min-w-[180px]">Task progress</TableHead>
                  <TableHead className="text-right">Story points</TableHead>
                  <TableHead className="text-right">Projects</TableHead>
                  <TableHead className="whitespace-nowrap">Last sign-in</TableHead>
                  {isAdmin && <TableHead>Active</TableHead>}
                  {isAdmin && <TableHead className="text-right">Reset</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" />Loading members…
                  </TableCell></TableRow>
                ) : visible.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                    {members.length || isAdmin ? "No members match." :
                      "No developers are on your team yet. An admin adds developers to your team from Users & Access."}
                  </TableCell></TableRow>
                ) : (
                  visible.map((m) => {
                    const self = m.user_id === me?.id;
                    const p = m.progress;
                    return (
                      <TableRow key={m.user_id} className={m.is_active ? "" : "opacity-55"}>
                        <TableCell>
                          <div className="font-medium">{m.full_name}{self && <span className="text-muted-foreground font-normal"> (you)</span>}</div>
                          <div className="text-xs text-muted-foreground">{m.email}</div>
                        </TableCell>
                        <TableCell>
                          {isAdmin && !self ? (
                            <Select value={m.role} disabled={busyId === m.user_id}
                              onValueChange={(r) => patch(m, { role: r as Role }, `${m.full_name} is now ${r}`)}>
                              <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="outline" className={roleBadge[m.role]}>{m.role}</Badge>
                          )}
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            {m.role === "Developer" ? (
                              <Select value={m.reports_to ? String(m.reports_to) : "none"} disabled={busyId === m.user_id}
                                onValueChange={(v) => {
                                  const to = v === "none" ? null : Number(v);
                                  const name = leads.find((l) => l.user_id === to)?.full_name;
                                  patch(m, { reports_to: to }, to ? `${m.full_name} added to ${name}'s team` : `${m.full_name} removed from team`);
                                }}>
                                <SelectTrigger className={`h-8 w-40 text-xs ${m.reports_to ? "" : "text-amber-600"}`}><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">No team</SelectItem>
                                  {leads.map((l) => <SelectItem key={l.user_id} value={String(l.user_id)}>{l.full_name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                {m.role === "Manager" ? `${members.filter((x) => x.reports_to === m.user_id).length} developer(s)` : "—"}
                              </span>
                            )}
                          </TableCell>
                        )}
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={p.completion_pct} className="h-2 flex-1" />
                            <span className="text-xs tabular-nums w-10 text-right">{Math.round(p.completion_pct)}%</span>
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-1">
                            {p.done_tasks} done · {p.in_progress_tasks} in progress · {p.todo_tasks} to do
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">{p.done_points}/{p.total_points}</TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {p.active_projects}
                          {p.managed_projects > 0 && <div className="text-[11px] text-muted-foreground">manages {p.managed_projects}</div>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{fmtDate(m.last_login_at)}</TableCell>
                        {isAdmin && (
                          <TableCell>
                            <Switch checked={m.is_active} disabled={self || busyId === m.user_id}
                              aria-label={m.is_active ? "Deactivate user" : "Activate user"}
                              onCheckedChange={(v) => patch(m, { is_active: v }, v ? `${m.full_name} activated` : `${m.full_name} deactivated and signed out`)} />
                          </TableCell>
                        )}
                        {isAdmin && (
                          <TableCell className="text-right">
                            <Button size="icon" variant="ghost" className="h-8 w-8" title="Reset password" aria-label={`Reset password for ${m.full_name}`}
                              onClick={() => { setResetFor(m); setResetPwd(""); }}>
                              <KeyRound className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {isAdmin && <ActivityLog />}

      {/* Admin: create user */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a user</DialogTitle>
            <DialogDescription>Create an account and choose its role. Share the temporary password securely.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5"><Label htmlFor="nu-name">Full name</Label>
              <Input id="nu-name" value={newUser.full_name} onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })} /></div>
            <div className="grid gap-1.5"><Label htmlFor="nu-email">Email</Label>
              <Input id="nu-email" type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} /></div>
            <div className="grid gap-1.5"><Label htmlFor="nu-org">Organization (optional)</Label>
              <Input id="nu-org" value={newUser.organization} onChange={(e) => setNewUser({ ...newUser, organization: e.target.value })} /></div>
            <div className="grid gap-1.5"><Label>Role</Label>
              <Select value={newUser.role} onValueChange={(r) => setNewUser({ ...newUser, role: r as Role })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select></div>
            <div className="grid gap-1.5"><Label htmlFor="nu-pwd">Temporary password</Label>
              <Input id="nu-pwd" type="password" autoComplete="new-password" value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} />
              <p className="text-[11px] text-muted-foreground">At least 8 characters with letters and numbers.</p></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={createUser} disabled={saving}>{saving ? "Creating…" : "Create user"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin: reset password */}
      <Dialog open={!!resetFor} onOpenChange={(o) => !o && setResetFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              Set a new password for {resetFor?.full_name}. They will be signed out of every device.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="rp-pwd">New password</Label>
            <Input id="rp-pwd" type="password" autoComplete="new-password" value={resetPwd} onChange={(e) => setResetPwd(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetFor(null)}>Cancel</Button>
            <Button onClick={resetPassword} disabled={saving}>{saving ? "Saving…" : "Reset password"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
