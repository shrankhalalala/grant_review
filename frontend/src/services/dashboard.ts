import { apiRequest } from "./api"; import type { Dashboard } from "../types/dashboard";
export async function getDashboard(token: string) { return (await apiRequest<{ dashboard: Dashboard }>("/dashboard", { token })).dashboard; }
