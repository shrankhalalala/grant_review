import type { UserRole } from "../types/auth";

export function RoleLabel({ role }: { role: UserRole }) {
  return <span className="role-label">{role === "PROGRAM_OFFICER" ? "Program Officer" : "Reviewer"}</span>;
}
