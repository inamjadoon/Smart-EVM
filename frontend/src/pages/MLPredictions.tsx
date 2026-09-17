import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Brain, DollarSign, Clock, Bug, HeartPulse, Sparkles, Loader2, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { predictCostOverrun, predictScheduleSlip, predictDefects, predictHealth } from "@/api/ml";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Field = { key: string; label: string; type?: string; placeholder?: string };
type Model = {
  id: string;
  title: string;
  description: string;
  icon: any;
  accent: string;
  fields: Field[];
  call: (p: any) => Promise<any>;
};

const models: Model[] = [
  {
    id: "cost",
    title: "Cost Overrun",
    description: "Estimates likelihood the project exceeds budget.",
    icon: DollarSign,
    accent: "from-rose-400 to-orange-400",
    fields: [
      { key: "budget", label: "Total Budget", type: "number", placeholder: "100000" },
      { key: "ac", label: "Actual Cost so far", type: "number", placeholder: "45000" },
      { key: "cpi", label: "Current CPI", type: "number", placeholder: "0.95" },
      { key: "spi", label: "Current SPI", type: "number", placeholder: "1.02" },
    ],
    call: predictCostOverrun,
  },
  {
    id: "schedule",
    title: "Schedule Slip",
    description: "Predicts whether the project will finish late.",
    icon: Clock,
    accent: "from-sky-400 to-indigo-400",
    fields: [
      { key: "planned_duration_days", label: "Planned Duration (days)", type: "number", placeholder: "120" },
      { key: "elapsed_days", label: "Elapsed Days", type: "number", placeholder: "60" },
      { key: "spi", label: "Current SPI", type: "number", placeholder: "0.9" },
      { key: "completed_pct", label: "Completion %", type: "number", placeholder: "55" },
    ],
    call: predictScheduleSlip,
  },
  {
    id: "defects",
    title: "Defect Forecast",
    description: "Forecasts defects in the next sprint.",
    icon: Bug,
    accent: "from-amber-400 to-rose-400",
    fields: [
      { key: "story_points", label: "Sprint Story Points", type: "number", placeholder: "40" },
      { key: "team_size", label: "Team Size", type: "number", placeholder: "6" },
      { key: "past_defects", label: "Past Defects (avg)", type: "number", placeholder: "5" },
      { key: "qpi", label: "Current QPI", type: "number", placeholder: "0.92" },
    ],
    call: predictDefects,
  },
  {
    id: "health",
    title: "Project Health",
    description: "Classifies overall project health (Green / Yellow / Red).",
    icon: HeartPulse,
    accent: "from-emerald-400 to-teal-400",
    fields: [
      { key: "cpi", label: "CPI", type: "number", placeholder: "1.0" },
      { key: "spi", label: "SPI", type: "number", placeholder: "1.0" },
      { key: "qpi", label: "QPI", type: "number", placeholder: "0.9" },
      { key: "team_velocity", label: "Team Velocity", type: "number", placeholder: "30" },
    ],
    call: predictHealth,
  },
];

// ── Per-model result renderers ────────────────────────────────────────────────

function RiskBadge({ level }: { level: string }) {
  const map: Record<string, string> = {
    Low: "bg-emerald-100 text-emerald-800 border-emerald-200",
    Medium: "bg-amber-100 text-amber-800 border-amber-200",
    High: "bg-rose-100 text-rose-800 border-rose-200",
  };
  return <Badge variant="outline" className={cn("text-sm font-semibold px-3 py-1", map[level] ?? map.Medium)}>{level ?? "—"}</Badge>;
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round((value ?? 0) * 100);
  const color = pct >= 85 ? "bg-emerald-500" : pct >= 70 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Model Confidence</span><span className="font-semibold">{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function StatTile({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold tracking-tight">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function CostResult({ r }: { r: any }) {
  const pct = Math.round((r.probability_of_overrun ?? 0) * 100);
  const isHigh = pct >= 50;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {isHigh ? <TrendingUp className="h-6 w-6 text-rose-500" /> : <TrendingDown className="h-6 w-6 text-emerald-500" />}
        <div>
          <p className="text-sm text-muted-foreground">Overrun Probability</p>
          <p className={cn("text-4xl font-bold", isHigh ? "text-rose-500" : "text-emerald-500")}>{pct}%</p>
        </div>
        <div className="ml-auto"><RiskBadge level={r.risk_level} /></div>
      </div>
      <div className="h-3 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", isHigh ? "bg-rose-500" : "bg-emerald-500")} style={{ width: `${pct}%` }} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <StatTile label="Predicted EAC" value={`$${Number(r.predicted_eac ?? 0).toLocaleString()}`} />
        <StatTile label="Variance at Completion" value={`$${Number(r.predicted_variance ?? 0).toLocaleString()}`} sub={r.predicted_variance >= 0 ? "Under budget" : "Over budget"} />
      </div>
      <ConfidenceBar value={r.confidence} />
      <p className="text-xs text-muted-foreground text-right">Model: {r.model}</p>
    </div>
  );
}

function ScheduleResult({ r }: { r: any }) {
  const pct = Math.round((r.probability_of_slip ?? 0) * 100);
  const isLate = pct >= 50;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {isLate ? <AlertTriangle className="h-6 w-6 text-amber-500" /> : <CheckCircle className="h-6 w-6 text-emerald-500" />}
        <div>
          <p className="text-sm text-muted-foreground">Schedule Slip Probability</p>
          <p className={cn("text-4xl font-bold", isLate ? "text-amber-500" : "text-emerald-500")}>{pct}%</p>
        </div>
        <div className="ml-auto"><RiskBadge level={r.risk_level} /></div>
      </div>
      <div className="h-3 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full", isLate ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${pct}%` }} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <StatTile label="Predicted Delay" value={`${r.predicted_finish_delay_days ?? 0} days`} sub={r.predicted_finish_delay_days > 0 ? "Behind schedule" : "On track"} />
        <StatTile label="Risk Level" value={<RiskBadge level={r.risk_level} />} />
      </div>
      <ConfidenceBar value={r.confidence} />
      <p className="text-xs text-muted-foreground text-right">Model: {r.model}</p>
    </div>
  );
}

function DefectsResult({ r }: { r: any }) {
  const defects = r.predicted_defects_next_sprint ?? 0;
  const critical = Math.round((r.critical_share ?? 0) * defects);
  const severity = defects >= 10 ? "High" : defects >= 5 ? "Medium" : "Low";
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Bug className="h-6 w-6 text-amber-500" />
        <div>
          <p className="text-sm text-muted-foreground">Predicted Defects (next sprint)</p>
          <p className="text-4xl font-bold text-amber-500">{defects}</p>
        </div>
        <div className="ml-auto"><RiskBadge level={severity} /></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Total Defects" value={defects} />
        <StatTile label="Critical" value={critical} sub={`${Math.round((r.critical_share ?? 0) * 100)}% of total`} />
        <StatTile label="Recommended QA Hours" value={`${r.recommended_qa_hours ?? 0}h`} />
      </div>
      <ConfidenceBar value={r.confidence} />
      <p className="text-xs text-muted-foreground text-right">Model: {r.model}</p>
    </div>
  );
}

function HealthResult({ r }: { r: any }) {
  const health = r.predicted_health ?? "Unknown";
  const prob = r.probability ?? {};
  const colorMap: Record<string, string> = { Green: "text-emerald-500", Yellow: "text-amber-500", Red: "text-rose-500" };
  const barMap: Record<string, string> = { Green: "bg-emerald-500", Yellow: "bg-amber-500", Red: "bg-rose-500" };
  const iconMap: Record<string, any> = { Green: CheckCircle, Yellow: AlertTriangle, Red: XCircle };
  const Icon = iconMap[health] ?? CheckCircle;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Icon className={cn("h-8 w-8", colorMap[health])} />
        <div>
          <p className="text-sm text-muted-foreground">Predicted Health</p>
          <p className={cn("text-4xl font-bold", colorMap[health])}>{health}</p>
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Probability Breakdown</p>
        {Object.entries(prob).map(([label, val]: [string, any]) => (
          <div key={label} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className={cn("font-medium", colorMap[label])}>{label}</span>
              <span>{Math.round(val * 100)}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className={cn("h-full rounded-full", barMap[label])} style={{ width: `${Math.round(val * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
      <ConfidenceBar value={r.confidence} />
      <p className="text-xs text-muted-foreground text-right">Model: {r.model}</p>
    </div>
  );
}

function ResultPanel({ modelId, result }: { modelId: string; result: any }) {
  if (!result) return null;
  return (
    <div className="rounded-xl border bg-gradient-soft p-5 animate-fade-in space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
        <span className="text-sm font-semibold">Prediction Result</span>
      </div>
      {modelId === "cost"     && <CostResult r={result} />}
      {modelId === "schedule" && <ScheduleResult r={result} />}
      {modelId === "defects"  && <DefectsResult r={result} />}
      {modelId === "health"   && <HealthResult r={result} />}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MLPredictions() {
  const [selectedId, setSelectedId] = useState<string>(models[0].id);
  const [values, setValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const model = models.find((m) => m.id === selectedId)!;
  const Icon = model.icon;

  const onSelect = (id: string) => {
    setSelectedId(id);
    setValues({});
    setResult(null);
  };

  const onPredict = async () => {
    setLoading(true);
    try {
      const payload: any = {};
      for (const f of model.fields) payload[f.key] = f.type === "number" ? Number(values[f.key]) : values[f.key];
      const r = await model.call(payload);
      setResult(r);
      toast.success("Prediction complete");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">ML Predictions</h2>
          <p className="text-muted-foreground mt-1">Choose a model, enter inputs, and let the model do the work.</p>
        </div>
      </div>

      {/* Model selector */}
      <Card className="card-elevated border-0">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" /> Choose a Model
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedId} onValueChange={onSelect}>
            <SelectTrigger className="w-full md:w-[420px] h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {models.map((m) => {
                const I = m.icon;
                return (
                  <SelectItem key={m.id} value={m.id}>
                    <div className="flex items-center gap-2">
                      <I className="h-4 w-4 text-primary" />
                      <span>{m.title}</span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Model panel */}
      <Card className="card-elevated border-0 overflow-hidden">
        <div className={`h-1.5 w-full bg-gradient-to-r ${model.accent}`} />
        <CardHeader>
          <div className="flex items-start gap-4">
            <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${model.accent} flex items-center justify-center shadow-soft`}>
              <Icon className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-xl">{model.title}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">{model.description}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {model.fields.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label className="text-sm">{f.label}</Label>
                <Input
                  type={f.type ?? "text"}
                  placeholder={f.placeholder}
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                  className="h-10"
                />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2">
            <Badge variant="outline" className="bg-primary-soft text-primary border-primary/20">
              <Sparkles className="h-3 w-3 mr-1" /> Powered by ML
            </Badge>
            <Button onClick={onPredict} disabled={loading} className="bg-gradient-primary hover:opacity-90 shadow-soft min-w-[140px]">
              {loading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Predicting…</>
              ) : (
                <>Run Prediction</>
              )}
            </Button>
          </div>

          <ResultPanel modelId={selectedId} result={result} />
        </CardContent>
      </Card>
    </div>
  );
}
