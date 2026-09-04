import { apiRequest } from "./api";
import type { TimelineEvent } from "../types/application";

export async function listTimeline(token: string, applicationId: string) {
  return (await apiRequest<{ events: TimelineEvent[] }>(`/applications/${applicationId}/timeline`, { token })).events;
}

export async function addTimelineComment(token: string, applicationId: string, comment: string) {
  return (await apiRequest<{ event: TimelineEvent }>(`/applications/${applicationId}/comments`, { method: "POST", token, body: { comment } })).event;
}
