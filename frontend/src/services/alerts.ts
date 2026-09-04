import { apiRequest } from "./api"; import type { OverdueAlert } from "../types/alert";
export async function listOverdueAlerts(token: string) { return (await apiRequest<{ alerts: OverdueAlert[] }>("/alerts/overdue", { token })).alerts; }
export async function getOverdueAlertCount(token: string) { return (await apiRequest<{ count: number }>("/alerts/overdue/count", { token })).count; }
export async function dismissOverdueAlert(token: string, id: string) { return (await apiRequest<{ alert: OverdueAlert }>(`/alerts/overdue/${id}/dismiss`, { method: "POST", token })).alert; }
