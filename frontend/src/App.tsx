import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "./layouts/AppLayout";
import LandingPage from "./pages/LandingPage";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import Sprints from "./pages/Sprints";
import Tasks from "./pages/Tasks";
import EVMDashboard from "./pages/EVMDashboard";
import MLPredictions from "./pages/MLPredictions";
import Intelligence from "./pages/Intelligence";
import ProjectLedger from "./pages/ProjectLedger";
import Team from "./pages/Team";
import Account from "./pages/Account";
import { AuthProvider } from "./auth/AuthProvider";
import { GuestOnly, RequireAuth, RequireRole } from "./auth/ProtectedRoute";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

// Every workspace page: must be signed in AND have a role allowed for that path.
const guarded = (path: string, element: JSX.Element) => (
  <Route path={path} element={<RequireRole path={path}>{element}</RequireRole>} />
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
