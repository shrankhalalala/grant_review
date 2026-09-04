import { AppShell } from "./AppShell";

export function ReviewerShell() { return <AppShell role="REVIEWER" navigation={[{ label: "My assignments", to: "/reviewer/assignments" }]} />; }
