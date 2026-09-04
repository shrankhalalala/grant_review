import { Navigate, Route, Routes } from "react-router-dom";
import type { PropsWithChildren } from "react";

import { useAuth } from "./auth/AuthProvider";
import { LoadingScreen } from "./components/LoadingScreen";
import { ProgramShell } from "./layouts/ProgramShell";
import { ReviewerShell } from "./layouts/ReviewerShell";
import { LoginPage } from "./pages/LoginPage";
import { ProgramApplicationsPage } from "./pages/ProgramApplicationsPage";
import { ReviewerAssignmentsPage } from "./pages/ReviewerAssignmentsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { AlertsPage } from "./pages/AlertsPage";
import { ReportsPage } from "./pages/ReportsPage";
import type { UserRole } from "./types/auth";

function roleHome(role: UserRole) { return role === "PROGRAM_OFFICER" ? "/program" : "/reviewer"; }

function ProtectedRoute({ children }: PropsWithChildren) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  return user ? children : <Navigate to="/login" replace />;
}

function RoleRoute({ role, children }: PropsWithChildren<{ role: UserRole }>) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return user.role === role ? children : <Navigate to={roleHome(user.role)} replace />;
}

function RoleHome() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  return <Navigate to={user ? roleHome(user.role) : "/login"} replace />;
}

export function AppRoutes() {
  return <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/" element={<RoleHome />} />
    <Route element={<ProtectedRoute><RoleRoute role="PROGRAM_OFFICER"><ProgramShell /></RoleRoute></ProtectedRoute>}>
      <Route path="/program" element={<Navigate to="/program/dashboard" replace />} />
      <Route path="/program/applications" element={<ProgramApplicationsPage />} />
      <Route path="/program/dashboard" element={<DashboardPage />} />
      <Route path="/program/alerts" element={<AlertsPage />} />
      <Route path="/program/reports" element={<ReportsPage />} />
    </Route>
    <Route element={<ProtectedRoute><RoleRoute role="REVIEWER"><ReviewerShell /></RoleRoute></ProtectedRoute>}>
      <Route path="/reviewer" element={<Navigate to="/reviewer/assignments" replace />} />
      <Route path="/reviewer/assignments" element={<ReviewerAssignmentsPage />} />
    </Route>
    <Route path="*" element={<RoleHome />} />
  </Routes>;
}
