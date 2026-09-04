import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { RoleLabel } from "../components/RoleLabel";
import { useAuth } from "../auth/AuthProvider";
import { ThemeToggle } from "../theme";
import type { UserRole } from "../types/auth";

interface NavigationItem { label: string; to: string; }

export function AppShell({ role, navigation }: { role: UserRole; navigation: NavigationItem[] }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("grant-review.sidebar-collapsed") === "true");
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => { localStorage.setItem("grant-review.sidebar-collapsed", String(collapsed)); }, [collapsed]);
  useEffect(() => { const close = (event: KeyboardEvent) => event.key === "Escape" && setMobileOpen(false); window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, []);
  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""} ${mobileOpen ? "mobile-nav-open" : ""}`}>
    <button className="mobile-menu" type="button" onClick={() => setMobileOpen(true)} aria-label="Open navigation">☰</button>
    {mobileOpen && <button className="nav-overlay" type="button" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
    <aside className="sidebar">
      <div className="sidebar-top"><button className="icon-button collapse-button" type="button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Expand navigation" : "Collapse navigation"} title={collapsed ? "Expand navigation" : "Collapse navigation"}>☰</button>
      <NavLink to={role === "PROGRAM_OFFICER" ? "/program" : "/reviewer"} className="brand">
        <span className="brand-mark">GR</span><span className="brand-label">Grant Review</span>
      </NavLink>
      </div>
      <nav aria-label="Primary navigation">
        {navigation.map((item) => <NavLink key={item.to} to={item.to} title={item.label} aria-label={item.label} onClick={() => setMobileOpen(false)} end={item.to === "/program" || item.to === "/reviewer"}><span className="nav-mark" aria-hidden="true">{item.label[0]}</span><span className="nav-label">{item.label}</span></NavLink>)}
      </nav>
      <div className="account-panel">
        <div className="account-copy"><p className="account-name">{user?.name ?? "Signed in"}</p><p className="account-email">{user?.email}</p><RoleLabel role={role} /></div>
        <div className="sidebar-controls"><ThemeToggle /><button className="logout-button" type="button" title="Log out" onClick={handleLogout}><span aria-hidden="true">↗</span><span className="logout-label">Log out</span></button></div>
      </div>
    </aside>
    <main className="workspace"><Outlet /></main>
  </div>;
}
