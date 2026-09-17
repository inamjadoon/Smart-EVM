import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Shield, Lock, Mail, ArrowRight, CheckCircle2, UserCheck, Briefcase, Code2, Sparkles, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth, type Role } from "@/auth/AuthProvider";
import { toast } from "sonner";

export default function Login() {
  const navigate = useNavigate();
  const { loginWithRole } = useAuth();

  const [selectedRole, setSelectedRole] = useState<Role>("Admin");
  const [email, setEmail] = useState("admin@smartevm.io");
  const [password, setPassword] = useState("••••••••••••");
  const [loading, setLoading] = useState(false);

  const roleDescriptions: Record<Role, { title: string; subtitle: string; defaultEmail: string; icon: any; color: string }> = {
    Admin: {
      title: "System Administrator",
      subtitle: "Full access to portfolio, database tables, user management, and AI settings",
      defaultEmail: "admin@smartevm.io",
      icon: Shield,
      color: "text-purple-500 border-purple-500/30 bg-purple-500/10",
    },
    Manager: {
      title: "Project Manager",
      subtitle: "Sprint planning, budget allocation, live JIRA import, and ML predictions",
      defaultEmail: "manager@smartevm.io",
      icon: Briefcase,
      color: "text-primary border-primary/30 bg-primary/10",
    },
    Developer: {
      title: "Developer / Member",
      subtitle: "Task execution, story points, personal project ledger, and defect audits",
      defaultEmail: "alex.dev@smartevm.io",
      icon: Code2,
      color: "text-emerald-500 border-emerald-500/30 bg-emerald-500/10",
    },
    Viewer: {
      title: "Viewer / Stakeholder",
      subtitle: "Read-only portfolio posture and executive summary charts",
      defaultEmail: "viewer@smartevm.io",
      icon: UserCheck,
      color: "text-blue-500 border-blue-500/30 bg-blue-500/10",
    },
  };

  const handleRoleChange = (r: Role) => {
    setSelectedRole(r);
    setEmail(roleDescriptions[r].defaultEmail);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      loginWithRole(selectedRole, {
        email,
        name: selectedRole === "Admin" ? "Sarah Connor (Admin)" : selectedRole === "Manager" ? "Marcus Vance (PM)" : "Alex Mercer (Dev)",
        role: selectedRole,
      });
      setLoading(false);
      toast.success(`Logged in successfully as ${selectedRole}!`);
      navigate("/dashboard");
    }, 400);
  };

  const handleQuickDemoLogin = (roleToLogin: Role) => {
    loginWithRole(roleToLogin, {
      email: roleDescriptions[roleToLogin].defaultEmail,
      name: roleToLogin === "Admin" ? "Sarah Connor (Admin)" : roleToLogin === "Manager" ? "Marcus Vance (PM)" : "Alex Mercer (Dev)",
      role: roleToLogin,
    });
    toast.success(`Demo access granted as ${roleToLogin}!`);
    navigate("/dashboard");
  };

  const ActiveIcon = roleDescriptions[selectedRole].icon;

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-background p-4 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[350px] bg-primary/10 blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute -bottom-10 right-1/4 w-[350px] h-[300px] bg-purple-500/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Back Link */}
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Landing Page
        </Link>

        {/* Card Header Logo */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 rounded-xl bg-primary items-center justify-center shadow-lg shadow-primary/30">
            <Shield className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
            Sign in to SmartEVM
          </h1>
          <p className="text-xs text-muted-foreground">
            Select your role to access the corresponding governance workspace
          </p>
        </div>

        {/* Role Selector Tabs */}
        <div className="grid grid-cols-3 gap-2 p-1 rounded-xl bg-muted/60 border border-border">
          {(["Admin", "Manager", "Developer"] as Role[]).map((r) => {
            const isSelected = selectedRole === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => handleRoleChange(r)}
                className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all flex flex-col items-center gap-1 ${
                  isSelected
                    ? "bg-card text-foreground shadow-sm border border-border/80"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>{r}</span>
              </button>
            );
          })}
        </div>

        {/* Main Login Card */}
        <Card className="border-border shadow-2xl bg-card/80 backdrop-blur-xl">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2.5">
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center border ${roleDescriptions[selectedRole].color}`}>
                <ActiveIcon className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base font-bold">{roleDescriptions[selectedRole].title}</CardTitle>
                <CardDescription className="text-xs">{roleDescriptions[selectedRole].subtitle}</CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  Email Address
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-background font-mono text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                    Password
                  </label>
                  <span className="text-[11px] text-primary cursor-pointer hover:underline">
                    Forgot password?
                  </span>
                </div>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-background"
                />
              </div>

              <Button type="submit" disabled={loading} className="w-full h-10 gap-2 shadow-md">
                {loading ? "Signing in..." : `Sign in as ${selectedRole}`}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>

            <div className="relative my-6 text-center text-xs">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <span className="relative bg-card px-2 text-muted-foreground uppercase text-[10px] font-semibold tracking-wider">
                Or 1-Click Demo Access
              </span>
            </div>

            {/* Quick Demo Login Buttons */}
            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleQuickDemoLogin("Admin")}
                className="text-[11px] h-9 border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 font-medium"
              >
                Admin
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleQuickDemoLogin("Manager")}
                className="text-[11px] h-9 border-primary/30 text-primary hover:bg-primary/10 font-medium"
              >
                Manager
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleQuickDemoLogin("Developer")}
                className="text-[11px] h-9 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 font-medium"
              >
                Developer
              </Button>
            </div>
          </CardContent>

          <CardFooter className="pt-2 pb-6 flex justify-center text-xs text-muted-foreground">
            Don't have an account?{" "}
            <Link to="/register" className="ml-1 text-primary font-semibold hover:underline">
              Create an account
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
