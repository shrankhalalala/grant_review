import { apiRequest } from "./api";
import type { Application, ApplicationDiscovery, ApplicationInput, ApplicationListResponse, ApplicationUpdateInput, FundingDecisionStatus } from "../types/application";

function queryString(query: ApplicationDiscovery) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return params.toString();
}

export function listApplications(token: string, query: ApplicationDiscovery) {
  const search = queryString(query);
  return apiRequest<ApplicationListResponse>(`/applications${search ? `?${search}` : ""}`, { token });
}

export async function getApplication(token: string, id: string) {
  return (await apiRequest<{ application: Application }>(`/applications/${id}`, { token })).application;
}

export async function createApplication(token: string, input: ApplicationInput) {
  return (await apiRequest<{ application: Application }>("/applications", { method: "POST", token, body: input })).application;
}

export async function updateApplication(token: string, id: string, input: ApplicationUpdateInput) {
  return (await apiRequest<{ application: Application }>(`/applications/${id}`, { method: "PATCH", token, body: input })).application;
}

export async function setArchiveState(token: string, id: string, archived: boolean) {
  const action = archived ? "archive" : "restore";
  return (await apiRequest<{ application: Application }>(`/applications/${id}/${action}`, { method: "POST", token })).application;
}

export async function beginReview(token: string, id: string) {
  return (await apiRequest<{ application: Application }>(`/applications/${id}/status`, { method: "POST", token, body: { status: "UNDER_REVIEW" } })).application;
}

export function recordDecision(token: string, id: string, decision: FundingDecisionStatus) {
  return apiRequest<{ decision: unknown }>(`/applications/${id}/decision`, { method: "POST", token, body: { decision } });
}
