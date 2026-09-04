import { apiRequest } from "./api";
import type { AssignmentInput, ReviewerAssignment } from "../types/assignment";

export interface ReviewerOption { id: string; name: string; email: string; role: "REVIEWER"; }

export async function listReviewers(token: string) {
  return (await apiRequest<{ reviewers: ReviewerOption[] }>("/reviewers", { token })).reviewers;
}

export async function listMyAssignments(token: string) {
  return (await apiRequest<{ assignments: ReviewerAssignment[] }>("/reviewer/assignments", { token })).assignments;
}

export async function listApplicationAssignments(token: string, applicationId: string) {
  return (await apiRequest<{ assignments: ReviewerAssignment[] }>(`/applications/${applicationId}/assignments`, { token })).assignments;
}

export async function createAssignment(token: string, applicationId: string, input: AssignmentInput) {
  return (await apiRequest<{ assignment: ReviewerAssignment }>(`/applications/${applicationId}/assignments`, { method: "POST", token, body: input })).assignment;
}

export async function updateAssignmentDueAt(token: string, assignmentId: string, dueAt: string) {
  return (await apiRequest<{ assignment: ReviewerAssignment }>(`/assignments/${assignmentId}`, { method: "PATCH", token, body: { dueAt } })).assignment;
}

export async function removeAssignment(token: string, assignmentId: string) {
  return (await apiRequest<{ assignment: ReviewerAssignment }>(`/assignments/${assignmentId}`, { method: "DELETE", token })).assignment;
}
