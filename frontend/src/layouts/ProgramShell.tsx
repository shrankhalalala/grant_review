import { AppShell } from "./AppShell";
import { AlertCountProvider, useAlertCount } from "../alerts/AlertCountProvider";

const navigation = [
  { label: "Dashboard", to: "/program/dashboard" },
  { label: "Applications", to: "/program/applications" },
  { label: "Alerts", to: "/program/alerts" },
  { label: "Reports", to: "/program/reports" },
];

function Shell() { const { count } = useAlertCount(); return <AppShell role="PROGRAM_OFFICER" navigation={navigation.map((item) => item.label === "Alerts" && count > 0 ? { ...item, label: `Alerts (${count})` } : item)} />; }
export function ProgramShell() { return <AlertCountProvider><Shell /></AlertCountProvider>; }
