import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Shield, Lock, Mail, User, Building, ArrowRight, ArrowLeft, CheckCircle2, Circle, Loader2, AlertCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/auth/AuthProvider";
import { passwordProblem, errorMessage } from "@/api/auth";
import { toast } from "sonner";

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [organization, setOrganization] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rules = [
    { ok: password.length >= 8, label: "At least 8 characters" },
    { ok: /[A-Za-z]/.test(password) && /\d/.test(password), label: "Letters and numbers" },
    { ok: !!password && password === confirm, label: "Passwords match" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !email.trim()) return setError("Please fill in your name and email.");
    const problem = passwordProblem(password);
    if (problem) return setError(`Password: ${problem.toLowerCase()}.`);
    if (password !== confirm) return setError("Passwords do not match.");

    setLoading(true);
    try {
      await register({
        full_name: name.trim(),
        email: email.trim(),
        password,
        organization: organization.trim() || undefined,
      });
      toast.success("Account created — welcome to SmartEVM!");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(errorMessage(err, "Could not create your account."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-background p-4 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[350px] bg-primary/10 blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute -bottom-10 left-1/4 w-[350px] h-[300px] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Landing Page
        </Link>

        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 rounded-xl bg-primary items-center justify-center shadow-lg shadow-primary/30">
            <Shield className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">Create your SmartEVM Account</h1>
          <p className="text-xs text-muted-foreground">Get access to project governance and EVM analytics</p>
        </div>

        <Card className="border-border shadow-2xl bg-card/80 backdrop-blur-xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-bold">New User Registration</CardTitle>
            <CardDescription className="text-xs flex items-start gap-1.5">
              <Info className="h-3.5 w-3.5 shrink-0 mt-px" />
              New accounts start with Developer access. An administrator can grant Manager or Admin access.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {error && (
                <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-px" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="name" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  Full Name *
                </label>
                <Input id="name" autoComplete="name" placeholder="e.g. Jordan Miller" value={name}
                  onChange={(e) => setName(e.target.value)} required className="bg-background text-sm" />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="email" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  Work Email *
                </label>
                <Input id="email" type="email" autoComplete="email" placeholder="jordan@company.com" value={email}
                  onChange={(e) => setEmail(e.target.value)} required className="bg-background text-sm" />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="org" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Building className="h-3.5 w-3.5 text-muted-foreground" />
                  Organization / Team
                </label>
                <Input id="org" autoComplete="organization" placeholder="e.g. Acme Corp Enterprise" value={organization}
                  onChange={(e) => setOrganization(e.target.value)} className="bg-background text-sm" />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                  Password *
                </label>
                <Input id="password" type="password" autoComplete="new-password" placeholder="Create a strong password"
                  value={password} onChange={(e) => setPassword(e.target.value)} required className="bg-background" />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="confirm" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                  Confirm Password *
                </label>
                <Input id="confirm" type="password" autoComplete="new-password" value={confirm}
                  onChange={(e) => setConfirm(e.target.value)} required className="bg-background" />
              </div>

              <ul className="grid grid-cols-1 gap-1 text-[11px]">
                {rules.map((r) => (
                  <li key={r.label} className={`flex items-center gap-1.5 ${r.ok ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                    {r.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                    {r.label}
                  </li>
                ))}
              </ul>

              <Button type="submit" disabled={loading} className="w-full h-10 gap-2 shadow-md mt-2">
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating account…</> : <>Create account <ArrowRight className="h-4 w-4" /></>}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="pt-2 pb-6 flex justify-center text-xs text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="ml-1 text-primary font-semibold hover:underline">
              Sign in
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
