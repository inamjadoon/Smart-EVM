import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, LogOut } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { authApi, passwordProblem, errorMessage } from "@/api/auth";
import { useAuth } from "@/auth/AuthProvider";
import { toast } from "sonner";

const ROLE_SUMMARY: Record<string, string> = {
  Admin: "Full access, including user management and every project.",
  Manager: "Manage your projects, sprints and tasks, assign work to your team, and track their progress.",
  Developer: "See the tasks assigned to you and update their status (To Do, In Progress, Done).",
  Viewer: "Read-only access to project performance.",
};

export default function Account() {
  const { user, role, refreshUser, acceptToken, logout } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name ?? "");
  const [org, setOrg] = useState(user?.organization ?? "");
  const [savingProfile, setSavingProfile] = useState(false);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);

  const saveProfile = async () => {
    if (!name.trim()) return toast.error("Name cannot be empty");
    setSavingProfile(true);
    try {
      await authApi.updateMe({ full_name: name.trim(), organization: org.trim() });
      await refreshUser();
      toast.success("Profile updated");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async () => {
    const problem = passwordProblem(next);
    if (problem) return toast.error(`New password: ${problem}`);
    if (next !== confirm) return toast.error("New passwords do not match");
    setSavingPwd(true);
    try {
      acceptToken(await authApi.changePassword(current, next));
      setCurrent(""); setNext(""); setConfirm("");
      toast.success("Password changed. Other devices have been signed out.");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSavingPwd(false);
    }
  };

  const signOutEverywhere = async () => {
    try {
      await authApi.logoutAll();
    } catch (e) {
      return toast.error(errorMessage(e));
    }
    await logout();
    toast.success("Signed out of all devices");
    navigate("/login", { replace: true });
  };

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Account</h2>
        <p className="text-muted-foreground mt-1">Your profile, password and sessions.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" /> Access level
          </CardTitle>
          <CardDescription>Roles are assigned by an administrator.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3 flex-wrap">
          <Badge className="text-sm px-3 py-1">{role}</Badge>
          <span className="text-sm text-muted-foreground">{ROLE_SUMMARY[role]}</span>
          {role === "Developer" && (
            <span className="text-sm w-full">
              Reports to: <span className="font-medium">{user?.managerName ?? "not assigned to a team yet"}</span>
            </span>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Signed in as {user?.email}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5"><Label htmlFor="acc-name">Full name</Label>
            <Input id="acc-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="grid gap-1.5"><Label htmlFor="acc-org">Organization</Label>
            <Input id="acc-org" value={org} onChange={(e) => setOrg(e.target.value)} /></div>
          <div className="sm:col-span-2">
            <Button onClick={saveProfile} disabled={savingProfile}>{savingProfile ? "Saving…" : "Save profile"}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Change password</CardTitle>
          <CardDescription>At least 8 characters with letters and numbers. Other devices will be signed out.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="grid gap-1.5"><Label htmlFor="pw-cur">Current password</Label>
            <Input id="pw-cur" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} /></div>
          <div className="grid gap-1.5"><Label htmlFor="pw-new">New password</Label>
            <Input id="pw-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} /></div>
          <div className="grid gap-1.5"><Label htmlFor="pw-confirm">Confirm new password</Label>
            <Input id="pw-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
          <div className="sm:col-span-3">
            <Button onClick={changePassword} disabled={savingPwd || !current || !next}>
              {savingPwd ? "Updating…" : "Update password"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sessions</CardTitle>
          <CardDescription>Lost a device or signed in on a shared computer? End every session at once.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={signOutEverywhere} className="gap-2 text-destructive hover:text-destructive">
            <LogOut className="h-4 w-4" /> Sign out of all devices
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
