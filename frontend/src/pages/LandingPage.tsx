import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Shield,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Brain,
  BarChart3,
  Calendar,
  Layers,
  Database,
  Cpu,
  Mail,
  Send,
  Users,
  ChevronRight,
  Sparkles,
  Lock,
  Compass,
  DollarSign,
  Clock,
  Briefcase,
  Code2,
  FileCheck,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";

export default function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user, role } = useAuth();

  // Interactive Live EVM Simulator state
  const [plannedValue, setPlannedValue] = useState<number>(500000);
  const [earnedValue, setEarnedValue] = useState<number>(520000);
  const [actualCost, setActualCost] = useState<number>(490000);

  // Derived metrics
  const cpi = actualCost > 0 ? Number((earnedValue / actualCost).toFixed(2)) : 1.0;
  const spi = plannedValue > 0 ? Number((earnedValue / plannedValue).toFixed(2)) : 1.0;
  const costVariance = earnedValue - actualCost;
  const scheduleVariance = earnedValue - plannedValue;

  let healthStatus: { label: string; color: string; desc: string; bg: string } = {
    label: "Healthy (Green)",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    desc: "Project is currently ahead of schedule and under budget.",
  };

  if (cpi < 0.9 || spi < 0.9) {
    healthStatus = {
      label: "Critical (Red)",
      color: "text-red-500",
      bg: "bg-red-500/10 border-red-500/20",
      desc: "Project has significant cost overrun or severe schedule delay.",
    };
  } else if (cpi < 1.0 || spi < 1.0) {
    healthStatus = {
      label: "Caution (Yellow)",
      color: "text-amber-500",
      bg: "bg-amber-500/10 border-amber-500/20",
      desc: "Minor variance detected. Corrective sprint adjustments recommended.",
    };
  }

  // Contact Form state
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactRole, setContactRole] = useState("Project Manager");
  const [contactMessage, setContactMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName.trim() || !contactEmail.trim() || !contactMessage.trim()) {
      toast.error("Please fill in all required fields.");
      return;
    }
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      toast.success("Thank you! Your message has been received. Our team will contact you shortly.");
      setContactName("");
      setContactEmail("");
      setContactMessage("");
    }, 800);
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20 selection:text-primary">
      {/* ── TOP NAVIGATION ───────────────────────────────────────── */}
      <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/25 group-hover:scale-105 transition-transform">
              <Shield className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-base font-bold tracking-tight text-foreground flex items-center gap-1.5">
                SmartEVM
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-primary/40 text-primary font-mono">
                  v2.0
                </Badge>
              </span>
              <span className="text-[10px] tracking-wider uppercase text-muted-foreground">Governance &amp; ML</span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <button onClick={() => scrollToSection("features")} className="hover:text-foreground transition-colors">
              Features
            </button>
            <button onClick={() => scrollToSection("evm-principles")} className="hover:text-foreground transition-colors">
              EVM Architecture
            </button>
            <button onClick={() => scrollToSection("simulator")} className="hover:text-foreground transition-colors">
              Live Simulator
            </button>
            <button onClick={() => scrollToSection("roles")} className="hover:text-foreground transition-colors">
              Role Access
            </button>
            <button onClick={() => scrollToSection("contact")} className="hover:text-foreground transition-colors">
              Contact Us
            </button>
          </nav>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="h-9 px-4 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 shadow-md shadow-blue-500/20 transition-all inline-flex items-center gap-1.5"
              >
                Go to Dashboard
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="h-9 px-4 rounded-lg text-sm font-semibold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-slate-700 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 dark:hover:border-blue-500 active:scale-95 transition-all shadow-sm"
                >
                  Go to Login
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/register")}
                  className="h-9 px-4 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 active:scale-95 shadow-md shadow-blue-500/25 transition-all inline-flex items-center gap-1.5"
                >
                  Create Account
                  <ChevronRight className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── HERO SECTION ─────────────────────────────────────────── */}
      <section className="relative pt-20 pb-28 md:pt-28 md:pb-36 overflow-hidden border-b border-border/40">
        {/* Background Ambient Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[350px] bg-primary/10 blur-[130px] rounded-full pointer-events-none" />
        <div className="absolute top-1/3 right-10 w-[300px] h-[300px] bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-semibold tracking-wide animate-fade-in shadow-sm">
              <Sparkles className="h-3.5 w-3.5 animate-pulse" />
              Next-Gen Autonomous Project Governance
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-foreground leading-[1.15]">
              Earned Value Management with{" "}
              <span className="bg-gradient-to-r from-primary via-blue-500 to-indigo-600 bg-clip-text text-transparent">
                Predictive AI Intelligence
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed">
              Stop guessing your sprint budgets and deadlines. <strong className="text-foreground">SmartEVM</strong> connects
              live JIRA issues to mathematical Earned Value formulas and machine learning models to identify cost overruns and
              schedule slips weeks before they happen.
            </p>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => navigate(isAuthenticated ? "/dashboard" : "/login")}
                className="w-full sm:w-auto h-12 px-8 rounded-xl text-base font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] shadow-lg shadow-blue-500/30 transition-all inline-flex items-center justify-center gap-2"
              >
                {isAuthenticated ? "Open Dashboard" : "Go to Login"}
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => navigate("/register")}
                className="w-full sm:w-auto h-12 px-8 rounded-xl text-base font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 hover:border-blue-600 hover:text-blue-600 dark:hover:border-blue-500 dark:hover:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 active:scale-[0.98] shadow-sm transition-all inline-flex items-center justify-center gap-2"
              >
                Create Account
              </button>
              <button
                type="button"
                onClick={() => scrollToSection("simulator")}
                className="w-full sm:w-auto h-12 px-6 rounded-xl text-base font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all inline-flex items-center justify-center gap-1.5"
              >
                Try Live Simulator ↓
              </button>
            </div>

            <div className="pt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Live PostgreSQL Database
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" /> JIRA Public API Integration
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Role-Based Access Control (RBAC)
              </span>
            </div>
          </div>

          {/* Floating Metric Preview Dashboard Card */}
          <div className="mt-16 max-w-5xl mx-auto rounded-2xl border border-border/80 bg-card/60 backdrop-blur-xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border/60">
              <div>
                <span className="text-xs font-semibold text-primary uppercase tracking-wider">Live Portfolio Posture</span>
                <h3 className="text-xl font-bold text-foreground mt-0.5">Atlas Payments Platform (Demo Snapshot)</h3>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Health: Green
                </Badge>
                <Badge variant="outline" className="border-border">8 Sprints Tracked</Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-6">
              <div className="p-4 rounded-xl bg-background/60 border border-border/50">
                <div className="text-xs text-muted-foreground font-medium flex items-center justify-between">
                  CPI (Cost Performance)
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                </div>
                <div className="text-2xl font-black text-foreground mt-1">1.04</div>
                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">+4% Under Budget</div>
              </div>

              <div className="p-4 rounded-xl bg-background/60 border border-border/50">
                <div className="text-xs text-muted-foreground font-medium flex items-center justify-between">
                  SPI (Schedule Index)
                  <Calendar className="h-3.5 w-3.5 text-amber-500" />
                </div>
                <div className="text-2xl font-black text-foreground mt-1">0.97</div>
                <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5 font-medium">97% Velocity Target</div>
              </div>

              <div className="p-4 rounded-xl bg-background/60 border border-border/50">
                <div className="text-xs text-muted-foreground font-medium flex items-center justify-between">
                  AI Predicted EAC
                  <Brain className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="text-2xl font-black text-foreground mt-1">$821,000</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Budget: $850,000</div>
              </div>

              <div className="p-4 rounded-xl bg-background/60 border border-border/50">
                <div className="text-xs text-muted-foreground font-medium flex items-center justify-between">
                  Variance at Completion
                  <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                </div>
                <div className="text-2xl font-black text-foreground mt-1">+$29,000</div>
                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">Favorable Surplus</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── WHAT IS SMARTEVM / EVM ARCHITECTURE ──────────────────── */}
      <section id="evm-principles" className="py-20 lg:py-28 bg-muted/20 border-b border-border/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
            <Badge variant="outline" className="text-xs px-3 py-1 border-primary/30 text-primary">
              Core Principles
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
              Why Traditional Project Management Fails
            </h2>
            <p className="text-muted-foreground text-base sm:text-lg">
              Counting finished tickets in Scrum tells you how much work is closed, but never tells you if you are
              burning money or falling behind schedule financially. SmartEVM applies PMI-standard Earned Value Management
              to Agile software delivery.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="border-border/70 bg-card/80 backdrop-blur shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="h-10 w-10 rounded-lg bg-blue-500/10 text-primary flex items-center justify-center mb-2">
                  <Compass className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg font-bold">Planned Value (PV)</CardTitle>
                <CardDescription>The baseline financial benchmark</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>
                  PV represents the approved budget assigned to scheduled story points up to the evaluation snapshot date.
                </p>
                <div className="p-2.5 rounded bg-muted font-mono text-xs text-foreground font-semibold">
                  PV = Planned Story Points × Budget Per Point
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/80 backdrop-blur shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="h-10 w-10 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-2">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg font-bold">Earned Value (EV)</CardTitle>
                <CardDescription>Actual quantified progress delivered</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>
                  EV reflects the true value of completed work. If a task isn't Done, full credit is withheld until verified.
                </p>
                <div className="p-2.5 rounded bg-muted font-mono text-xs text-foreground font-semibold">
                  EV = Completed Story Points × Value Rate
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/80 backdrop-blur shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="h-10 w-10 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center mb-2">
                  <DollarSign className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg font-bold">Actual Cost (AC)</CardTitle>
                <CardDescription>Total expenditure realized</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>
                  AC documents direct labor, infrastructure, and contractor costs consumed in executing the tasks to date.
                </p>
                <div className="p-2.5 rounded bg-muted font-mono text-xs text-foreground font-semibold">
                  Cost Variance (CV) = EV - AC
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* ── KEY FEATURES ─────────────────────────────────────────── */}
      <section id="features" className="py-20 lg:py-28 border-b border-border/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
            <Badge variant="outline" className="text-xs px-3 py-1 border-primary/30 text-primary">
              Feature Suite
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
              Engineered for Precision Governance
            </h2>
            <p className="text-muted-foreground text-base sm:text-lg">
              Everything modern engineering leadership needs to align engineering execution with financial accountability.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="p-6 rounded-xl border border-border bg-card/50 hover:bg-card transition-colors space-y-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Layers className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Direct JIRA Synchronization</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Connect your Atlassian JIRA boards with one click. SmartEVM automatically ingests live issues, sprint
                allocations, and assignee metadata into clean PostgreSQL records.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-border bg-card/50 hover:bg-card transition-colors space-y-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <BarChart3 className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Automated Index Calculations</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Real-time calculation of CPI (Cost Performance Index), SPI (Schedule Performance Index), Quality
                Performance Index (QPI), and Estimate at Completion (EAC).
              </p>
            </div>

            <div className="p-6 rounded-xl border border-border bg-card/50 hover:bg-card transition-colors space-y-3">
              <div className="h-10 w-10 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center">
                <Brain className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Machine Learning Risk Forecasting</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Pre-trained Scikit-Learn models analyze historical velocity patterns to output cost overrun probability,
                estimated schedule slip in days, and projected defect density.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-border bg-card/50 hover:bg-card transition-colors space-y-3">
              <div className="h-10 w-10 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <Clock className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Project Ledger &amp; Task Audits</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Granular ledger views break down every single sprint task with individual Planned Value, Earned Value,
                and Actual Cost, ensuring transparent audit compliance.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-border bg-card/50 hover:bg-card transition-colors space-y-3">
              <div className="h-10 w-10 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                <Cpu className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Monte Carlo What-If Simulator</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Simulate engineering capacity changes (±20%, ±50%) to predict how adding or reducing staff will impact
                the final completion budget and deadline.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-border bg-card/50 hover:bg-card transition-colors space-y-3">
              <div className="h-10 w-10 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center">
                <Lock className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Strict Role-Based Governance</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Customized dashboard environments tailored specifically for Administrators, Project Managers, and
                Developers, protecting sensitive financial data.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── INTERACTIVE LIVE EVM SIMULATOR ───────────────────────── */}
      <section id="simulator" className="py-20 lg:py-28 bg-muted/20 border-b border-border/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-14">
            <Badge variant="outline" className="text-xs px-3 py-1 border-primary/30 text-primary">
              Interactive Tool
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
              Try the Live EVM Calculator
            </h2>
            <p className="text-muted-foreground text-base sm:text-lg">
              Adjust Planned Value, Earned Value, and Actual Cost below to see how SmartEVM computes cost &amp; schedule
              indices in real time.
            </p>
          </div>

          <div className="max-w-4xl mx-auto bg-card border border-border rounded-2xl p-6 sm:p-10 shadow-xl">
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase">
                  Planned Value (PV)
                </label>
                <Input
                  type="number"
                  step="10000"
                  value={plannedValue}
                  onChange={(e) => setPlannedValue(Math.max(1, Number(e.target.value)))}
                  className="font-mono text-base font-bold"
                />
                <span className="text-[11px] text-muted-foreground">Expected value at this milestone</span>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase">
                  Earned Value (EV)
                </label>
                <Input
                  type="number"
                  step="10000"
                  value={earnedValue}
                  onChange={(e) => setEarnedValue(Math.max(0, Number(e.target.value)))}
                  className="font-mono text-base font-bold text-primary"
                />
                <span className="text-[11px] text-muted-foreground">Worth of completed tasks</span>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase">
                  Actual Cost (AC)
                </label>
                <Input
                  type="number"
                  step="10000"
                  value={actualCost}
                  onChange={(e) => setActualCost(Math.max(1, Number(e.target.value)))}
                  className="font-mono text-base font-bold"
                />
                <span className="text-[11px] text-muted-foreground">Capital spent to date</span>
              </div>
            </div>

            {/* Computed Results Bar */}
            <div className={`p-6 rounded-xl border ${healthStatus.bg} transition-colors space-y-4`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-semibold text-muted-foreground uppercase">Calculated Project Health</span>
                  <div className={`text-2xl font-black ${healthStatus.color}`}>{healthStatus.label}</div>
                </div>
                <p className="text-xs text-muted-foreground max-w-sm">{healthStatus.desc}</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-border/50">
                <div>
                  <div className="text-[11px] text-muted-foreground font-semibold">CPI (EV / AC)</div>
                  <div className={`text-xl font-bold ${cpi >= 1 ? "text-emerald-500" : "text-red-500"}`}>{cpi}</div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground font-semibold">SPI (EV / PV)</div>
                  <div className={`text-xl font-bold ${spi >= 1 ? "text-emerald-500" : "text-amber-500"}`}>{spi}</div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground font-semibold">Cost Variance (CV)</div>
                  <div className={`text-xl font-bold ${costVariance >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                    {costVariance >= 0 ? `+$${costVariance.toLocaleString()}` : `-$${Math.abs(costVariance).toLocaleString()}`}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground font-semibold">Schedule Variance (SV)</div>
                  <div className={`text-xl font-bold ${scheduleVariance >= 0 ? "text-emerald-500" : "text-amber-500"}`}>
                    {scheduleVariance >= 0 ? `+$${scheduleVariance.toLocaleString()}` : `-$${Math.abs(scheduleVariance).toLocaleString()}`}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="h-11 px-8 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] shadow-md shadow-blue-500/25 transition-all inline-flex items-center gap-2"
              >
                Launch Full SmartEVM Dashboard
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── ROLE-BASED ACCESS GOVERNANCE ─────────────────────────── */}
      <section id="roles" className="py-20 lg:py-28 border-b border-border/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
            <Badge variant="outline" className="text-xs px-3 py-1 border-primary/30 text-primary">
              Role-Based Access Control
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
              Designed for Every Engineering Stakeholder
            </h2>
            <p className="text-muted-foreground text-base sm:text-lg">
              SmartEVM enforces granular role-based security. Choose your role to experience the tailored workspace.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Admin Role Card */}
            <Card className="border-border hover:border-primary/50 transition-all flex flex-col justify-between">
              <CardHeader>
                <div className="h-10 w-10 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center mb-3">
                  <Shield className="h-5 w-5" />
                </div>
                <CardTitle className="text-xl font-bold">System Administrator</CardTitle>
                <CardDescription>Enterprise governance &amp; platform configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground flex-1">
                <div className="flex items-center gap-2 text-foreground font-medium">
                  <CheckCircle2 className="h-4 w-4 text-purple-500" /> Full Portfolio &amp; System Access
                </div>
                <div className="flex items-center gap-2 text-foreground font-medium">
                  <CheckCircle2 className="h-4 w-4 text-purple-500" /> PostgreSQL Table Health &amp; Schema
                </div>
                <div className="flex items-center gap-2 text-foreground font-medium">
                  <CheckCircle2 className="h-4 w-4 text-purple-500" /> User Roles &amp; Security Provisioning
                </div>
                <div className="flex items-center gap-2 text-foreground font-medium">
                  <CheckCircle2 className="h-4 w-4 text-purple-500" /> AI Intelligence Controls
                </div>
              </CardContent>
              <div className="p-6 pt-0">
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="w-full h-10 rounded-lg font-semibold text-purple-700 dark:text-purple-300 border-2 border-purple-300 dark:border-purple-800 bg-purple-50/70 dark:bg-purple-950/40 hover:bg-purple-600 hover:text-white hover:border-purple-600 active:scale-[0.98] transition-all inline-flex items-center justify-center"
                >
                  Login as Admin →
                </button>
              </div>
            </Card>

            {/* Manager Role Card */}
            <Card className="border-primary/50 bg-primary/5 relative flex flex-col justify-between shadow-lg">
              <div className="absolute -top-3 right-6">
                <Badge className="bg-primary text-primary-foreground">Most Popular</Badge>
              </div>
              <CardHeader>
                <div className="h-10 w-10 rounded-lg bg-primary/20 text-primary flex items-center justify-center mb-3">
                  <Briefcase className="h-5 w-5" />
                </div>
                <CardTitle className="text-xl font-bold">Project Manager</CardTitle>
                <CardDescription>Sprint governance, budgeting &amp; risk models</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground flex-1">
                <div className="flex items-center gap-2 text-foreground font-medium">
                  <CheckCircle2 className="h-4 w-4 text-primary" /> Live JIRA Import &amp; Sprint Mapping
                </div>
                <div className="flex items-center gap-2 text-foreground font-medium">
                  <CheckCircle2 className="h-4 w-4 text-primary" /> EVM Calculation &amp; Snapshot Creation
                </div>
                <div className="flex items-center gap-2 text-foreground font-medium">
                  <CheckCircle2 className="h-4 w-4 text-primary" /> ML Cost &amp; Delay Prediction Models
                </div>
                <div className="flex items-center gap-2 text-foreground font-medium">
                  <CheckCircle2 className="h-4 w-4 text-primary" /> Monte Carlo What-If Simulator
                </div>
              </CardContent>
              <div className="p-6 pt-0">
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="w-full h-10 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] shadow-md shadow-blue-500/25 transition-all inline-flex items-center justify-center"
                >
                  Login as Manager →
                </button>
              </div>
            </Card>

            {/* Developer Role Card */}
            <Card className="border-border hover:border-emerald-500/50 transition-all flex flex-col justify-between">
              <CardHeader>
                <div className="h-10 w-10 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-3">
                  <Code2 className="h-5 w-5" />
                </div>
                <CardTitle className="text-xl font-bold">Developer / Member</CardTitle>
                <CardDescription>Task execution, points delivery &amp; sprint ledger</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground flex-1">
                <div className="flex items-center gap-2 text-foreground font-medium">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Active Task Execution &amp; Updates
                </div>
                <div className="flex items-center gap-2 text-foreground font-medium">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Story Point Accountability Tracking
                </div>
                <div className="flex items-center gap-2 text-foreground font-medium">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Personal Sprint Ledger Inspection
                </div>
                <div className="flex items-center gap-2 text-foreground font-medium">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" /> EVM Trend &amp; Quality Feedback
                </div>
              </CardContent>
              <div className="p-6 pt-0">
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="w-full h-10 rounded-lg font-semibold text-emerald-700 dark:text-emerald-300 border-2 border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/40 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 active:scale-[0.98] transition-all inline-flex items-center justify-center"
                >
                  Login as Developer →
                </button>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* ── CONTACT US SECTION ───────────────────────────────────── */}
      <section id="contact" className="py-20 lg:py-28 bg-muted/20 border-b border-border/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-12 gap-12 items-start">
            <div className="lg:col-span-5 space-y-6">
              <Badge variant="outline" className="text-xs px-3 py-1 border-primary/30 text-primary">
                Get In Touch
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
                Talk with our SmartEVM Engineers
              </h2>
              <p className="text-muted-foreground text-base leading-relaxed">
                Have questions regarding JIRA API connectivity, PostgreSQL deployment, custom ML model tuning, or
                enterprise role policies? Send us a note and we will reply promptly.
              </p>

              <div className="space-y-4 pt-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Direct Email</div>
                    <div className="text-sm font-semibold text-foreground">support@smartevm.io</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Response Time SLA</div>
                    <div className="text-sm font-semibold text-foreground">Under 2 hours for enterprise inquiries</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
                    <Database className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Supported Databases</div>
                    <div className="text-sm font-semibold text-foreground">Neon PostgreSQL, AWS Aurora, Oracle DB</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div className="lg:col-span-7 bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-xl">
              <form onSubmit={handleContactSubmit} className="space-y-5">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">Your Name *</label>
                    <Input
                      placeholder="e.g. Alex Johnson"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      required
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">Work Email *</label>
                    <Input
                      type="email"
                      placeholder="alex@company.com"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      required
                      className="bg-background"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Your Role</label>
                  <select
                    value={contactRole}
                    onChange={(e) => setContactRole(e.target.value)}
                    className="w-full h-10 px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="Administrator">Administrator / VP Engineering</option>
                    <option value="Project Manager">Project Manager / Scrum Master</option>
                    <option value="Developer">Lead Developer / Software Engineer</option>
                    <option value="Other">Other / Evaluator</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Your Message *</label>
                  <Textarea
                    rows={4}
                    placeholder="Tell us about your project requirements or what you would like to know..."
                    value={contactMessage}
                    onChange={(e) => setContactMessage(e.target.value)}
                    required
                    className="bg-background resize-none"
                  />
                </div>

                <Button type="submit" disabled={submitting} className="w-full gap-2 shadow-md">
                  {submitting ? (
                    "Sending Message..."
                  ) : (
                    <>
                      <Send className="h-4 w-4" /> Send Inquiry
                    </>
                  )}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────── */}
      <footer className="mt-auto py-12 border-t border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
                <Shield className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-bold text-foreground">SmartEVM</div>
                <div className="text-[11px] text-muted-foreground">Automated Agile Project Governance &amp; Machine Learning</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
              <button onClick={() => scrollToSection("features")} className="hover:text-foreground">Features</button>
              <button onClick={() => scrollToSection("evm-principles")} className="hover:text-foreground">EVM Architecture</button>
              <button onClick={() => scrollToSection("simulator")} className="hover:text-foreground">Live Calculator</button>
              <button onClick={() => scrollToSection("roles")} className="hover:text-foreground">Role Matrix</button>
              <button onClick={() => scrollToSection("contact")} className="hover:text-foreground">Contact</button>
              <Link to="/login" className="hover:text-foreground font-semibold text-primary">Login</Link>
              <Link to="/register" className="hover:text-foreground font-semibold text-primary">Register</Link>
            </div>

            <div className="text-xs text-muted-foreground text-center md:text-right">
              © {new Date().getFullYear()} SmartEVM. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
