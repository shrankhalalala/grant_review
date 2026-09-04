import { apiRequest } from "./api";
import type { ConflictOfInterest, Review, ReviewInput } from "../types/assignment";

export async function createReview(token: string, assignmentId: string, input: ReviewInput) {
  return (await apiRequest<{ review: Review }>(`/assignments/${assignmentId}/review`, { method: "POST", token, body: input })).review;
}

export async function getReview(token: string, assignmentId: string) {
  return (await apiRequest<{ review: Review }>(`/assignments/${assignmentId}/review`, { token })).review;
}

export async function updateReview(token: string, reviewId: string, input: ReviewInput) {
  return (await apiRequest<{ review: Review }>(`/reviews/${reviewId}`, { method: "PATCH", token, body: input })).review;
}

export async function completeReview(token: string, reviewId: string) {
  return (await apiRequest<{ review: Review }>(`/reviews/${reviewId}/complete`, { method: "POST", token })).review;
}

export async function declareConflict(token: string, assignmentId: string, reason: string) {
  return (await apiRequest<{ conflict: ConflictOfInterest }>(`/assignments/${assignmentId}/conflict`, { method: "POST", token, body: { reason } })).conflict;
}
