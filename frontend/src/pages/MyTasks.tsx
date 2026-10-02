import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleDashed, Clock, AlertTriangle, ListChecks, Loader2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getMyTasks, updateTaskStatus } from "@/api/tasks";
import { errorMessage } from "@/api/auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STATUSES = ["To Do", "In Progress", "Done"] as const;
type Status = (typeof STATUSES)[number];

type MyTask = {
  id: number;
  description: string | null;
  status: Status;
  story_points: number;
  project_id: number;
  project_name: string;
  sprint_name: string;
  due_date: string | null;
  overdue: boolean;
  project_completed?: boolean;
  external_id?: string | null;
};

const statusStyle: Record<Status, string> = {
  "To Do": "border-slate-400/40 bg-slate-500/10 text-slate-600 dark:text-slate-300",
  "In Progress": "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  Done: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

/** Developer view: only the tasks assigned to me; the one action is moving their status. */
export default function MyTasks() {
  const [tasks, setTasks] = useState<MyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [filter, setFilter] = useState<string>("open");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTasks(await getMyTasks());
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const changeStatus = async (task: MyTask, status: Status) => {
    if (status === task.status) return;
    setSavingId(task.id);
    const previous = task.status;
    setTasks((list) => list.map((t) => (t.id === task.id ? { ...t, status, overdue: status === "Done" ? false : t.overdue } : t)));
    try {
      await updateTaskStatus(task.id, status);
      toast.success(`Moved to ${status}`);
    } catch (e) {
      setTasks((list) => list.map((t) => (t.id === task.id ? { ...t, status: previous } : t)));
      toast.error(errorMessage(e));
    } finally {
      setSavingId(null);
    }
  };

  const stats = useMemo(() => {
    const done = tasks.filter((t) => t.status === "Done");
    const pts = tasks.reduce((s, t) => s + (t.story_points || 0), 0);
    const donePts = done.reduce((s, t) => s + (t.story_points || 0), 0);
    return {
      todo: tasks.filter((t) => t.status === "To Do").length,
      inProgress: tasks.filter((t) => t.status === "In Progress").length,
      done: done.length,
      overdue: tasks.filter((t) => t.overdue).length,
      pct: pts ? Math.round((100 * donePts) / pts) : 0,
      donePts,
      pts,
    };
  }, [tasks]);

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return tasks.filter((t) => {
      const byStatus =
        filter === "all" ? true :
        filter === "open" ? t.status !== "Done" :
        filter === "overdue" ? t.overdue : t.status === filter;
      const byText = !term || (t.description || "").toLowerCase().includes(term) || t.project_name.toLowerCase().includes(term);
      return byStatus && byText;
    });
  }, [tasks, filter, q]);

  const cards = [
    { label: "To do", value: stats.todo, icon: CircleDashed, tone: "" },
    { label: "In progress", value: stats.inProgress, icon: Clock, tone: "text-blue-600 dark:text-blue-400" },
    { label: "Done", value: stats.done, icon: CheckCircle2, tone: "text-emerald-600 dark:text-emerald-400" },
    { label: "Overdue", value: stats.overdue, icon: AlertTriangle, tone: stats.overdue ? "text-destructive" : "" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">My Tasks</h2>
          <p className="text-muted-foreground mt-1">Work assigned to you. Update the status as you go — your manager sees it instantly.</p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading} className="gap-2">
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Refresh
        </Button>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-5 flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">{c.label}</p>
                <p className={cn("text-2xl font-bold mt-1", c.tone)}>{loading ? "—" : c.value}</p>
              </div>
              <c.icon className={cn("h-5 w-5 text-muted-foreground", c.tone)} />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-medium">Your completion</span>
            <span className="text-muted-foreground tabular-nums">{stats.donePts}/{stats.pts} story points · {stats.pct}%</span>
          </div>
          <Progress value={stats.pct} className="h-2" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap space-y-0">
          <CardTitle className="text-base flex items-center gap-2"><ListChecks className="h-4 w-4" /> Tasks</CardTitle>
          <div className="flex gap-2 flex-wrap">
            <Input placeholder="Search task or project" value={q} onChange={(e) => setQ(e.target.value)} className="h-9 w-56" />
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open (not done)</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Project / Sprint</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" />Loading your tasks…
                  </TableCell></TableRow>
                ) : visible.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                    {tasks.length ? "No tasks match this filter." : "No tasks are assigned to you yet. Your manager will assign work here."}
                  </TableCell></TableRow>
                ) : (
                  visible.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="max-w-[360px]">
                        <div className="font-medium">{t.description || `Task #${t.id}`}</div>
                        {t.external_id && <div className="text-[11px] text-muted-foreground font-mono">{t.external_id}</div>}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>{t.project_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {t.sprint_name}{t.project_completed && <span className="text-emerald-600"> · project completed</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{t.story_points}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {t.due_date || "—"}
                        {t.overdue && <Badge variant="destructive" className="ml-2 text-[10px]">Overdue</Badge>}
                      </TableCell>
                      <TableCell>
                        <Select value={t.status} disabled={savingId === t.id || t.project_completed} onValueChange={(v) => changeStatus(t, v as Status)}>
                          <SelectTrigger className={cn("h-8 w-[140px] text-xs border", statusStyle[t.status])}><SelectValue /></SelectTrigger>
                          <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
