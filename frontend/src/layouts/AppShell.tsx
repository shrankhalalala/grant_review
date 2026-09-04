import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { RoleLabel } from "../components/RoleLabel";
import { useAuth } from "../auth/AuthProvider";
import type { UserRole } from "../types/auth";

interface NavigationItem { label: string; to: string; }

export function AppShell({ role, navigation }: { role: UserRole; navigation: NavigationItem[] }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return <div className="app-shell">
    <aside className="sidebar">
      <NavLink to={role === "PROGRAM_OFFICER" ? "/program" : "/reviewer"} className="brand">
        <span className="brand-mark">GR</span><span>Grant Review</span>
      </NavLink>
      <nav aria-label="Primary navigation">
        {navigation.map((item) => <NavLink key={item.to} to={item.to} end={item.to === "/program" || item.to === "/reviewer"}>{item.label}</NavLink>)}
      </nav>
      <div className="account-panel">
        <p className="account-name">{user?.name ?? "Signed in"}</p>
        <p className="account-email">{user?.email}</p>
        <RoleLabel role={role} />
        <button className="logout-button" type="button" onClick={handleLogout}>Log out</button>
      </div>
    </aside>
    <main className="workspace"><Outlet /></main>
  </div>;
}
