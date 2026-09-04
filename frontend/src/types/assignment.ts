import type { Application, ApplicationStatus } from "./application";

export type ReviewStatus = "DRAFT" | "COMPLETED";

export interface Review {
  id: string;
  applicationId: string;
  reviewerId: string;
  assignmentId: string;
  status: ReviewStatus;
  impactScore: number | null;
  feasibilityScore: number | null;
  budgetJustificationScore: number | null;
  comments: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssignmentApplication extends Pick<Application, "id" | "organizationName" | "contactEmail" | "requestedAmount" | "submittedAt" | "status" | "archivedAt" | "fundingRoundId"> {
  fundingRound: { id: string; name: string };
}

export interface ReviewerAssignment {
  id: string;
  applicationId: string;
  reviewerId: string;
  dueAt: string;
  assignedAt: string;
  completedAt: string | null;
  removedAt: string | null;
  createdAt: string;
  updatedAt: string;
  reviewer: { id: string; name: string; email: string; role: string };
  application: AssignmentApplication;
  review: Pick<Review, "status"> | null;
}

export interface AssignmentInput {
  reviewerId: string;
  dueAt: string;
}

export interface ReviewInput {
  impactScore?: number;
  feasibilityScore?: number;
  budgetJustificationScore?: number;
  comments?: string;
}

export interface ConflictOfInterest {
  id: string;
  applicationId: string;
  reviewerId: string;
  reason: string;
  declaredAt: string;
  resolvedAt: string | null;
}

export function assignmentIsOverdue(assignment: ReviewerAssignment, now = Date.now()) {
  return !assignment.removedAt && assignment.review?.status !== "COMPLETED" && new Date(assignment.dueAt).getTime() < now;
}

export function assignmentCanBeReviewed(assignment: ReviewerAssignment) {
  return !assignment.removedAt && !assignment.application.archivedAt && assignment.application.status !== "DECIDED" && (assignment.application.status === "ASSIGNED" || assignment.application.status === "UNDER_REVIEW");
}

export function readableApplicationStatus(status: ApplicationStatus) { return status.replaceAll("_", " "); }
