import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "./layouts/AppLayout";
import LandingPage from "./pages/LandingPage";
import Login from "./pages/Login";
import Register from "./pages/Register";
import { Loader2 } from "lucide-react";
import { AuthProvider } from "./auth/AuthProvider";
import { GuestOnly, RequireAuth, RequireRole } from "./auth/ProtectedRoute";
import NotFound from "./pages/NotFound.tsx";

// Workspace pages load on demand, so the landing and sign-in pages stay small and fast.
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Projects = lazy(() => import("./pages/Projects"));
const Sprints = lazy(() => import("./pages/Sprints"));
const Tasks = lazy(() => import("./pages/Tasks"));
const EVMDashboard = lazy(() => import("./pages/EVMDashboard"));
const MLPredictions = lazy(() => import("./pages/MLPredictions"));
const Intelligence = lazy(() => import("./pages/Intelligence"));
const ProjectLedger = lazy(() => import("./pages/ProjectLedger"));
const Team = lazy(() => import("./pages/Team"));
const Account = lazy(() => import("./pages/Account"));

const PageLoading = () => (
  <div className="flex items-center justify-center py-24 text-sm text-muted-foreground gap-2">
    <Loader2 className="h-4 w-4 animate-spin" /> Loading…
  </div>
);

const queryClient = new QueryClient();

// Every workspace page: must be signed in AND have a role allowed for that path.
const guarded = (path: string, element: JSX.Element) => (
  <Route path={path} element={<RequireRole path={path}><Suspense fallback={<PageLoading />}>{element}</Suspense></RequireRole>} />
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner position="top-right" richColors />
          <Routes>
            {/* Public Landing & Authentication Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
            <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />

            {/* Authenticated Workspace Layout */}
            <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
              {guarded("/dashboard", <Dashboard />)}
              {guarded("/projects", <Projects />)}
              {guarded("/sprints", <Sprints />)}
              {guarded("/tasks", <Tasks />)}
              {guarded("/ledger", <ProjectLedger />)}
              {guarded("/evm", <EVMDashboard />)}
              {guarded("/intelligence", <Intelligence />)}
              {guarded("/ml", <MLPredictions />)}
              {guarded("/team", <Team />)}
              {guarded("/account", <Account />)}
            </Route>

            {/* Fallback */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </TooltipProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
