import { ApplicationStatus, Prisma, ReviewStatus } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { HttpError } from "../middleware/errorHandler.js";
import type { ReviewInput } from "../types/review.js";

const assignmentInclude = { application: true, review: true } satisfies Prisma.ReviewerAssignmentInclude;
const reviewInclude = { assignment: { include: { application: true } } } satisfies Prisma.ReviewInclude;
type Assignment = Prisma.ReviewerAssignmentGetPayload<{ include: typeof assignmentInclude }>;
type Review = Prisma.ReviewGetPayload<{ include: typeof reviewInclude }>;

async function ownedAssignment(id: string, reviewerId: string, mutate: boolean): Promise<Assignment> {
  const value = await prisma.reviewerAssignment.findUnique({ where: { id }, include: assignmentInclude });
  if (!value) throw new HttpError(404, "Assignment not found.");
  if (value.reviewerId !== reviewerId) throw new HttpError(403, "You do not have permission to access this assignment.");
  if (mutate) {
    if (value.removedAt) throw new HttpError(409, "Removed assignments cannot be reviewed.");
    if (value.application.archivedAt) throw new HttpError(409, "Archived applications cannot be reviewed.");
    if (value.application.status === ApplicationStatus.DECIDED) throw new HttpError(409, "Decided applications cannot be reviewed.");
    if (value.application.status !== ApplicationStatus.ASSIGNED && value.application.status !== ApplicationStatus.UNDER_REVIEW) throw new HttpError(409, "Application is not ready for review.");
  }
  return value;
}

async function ensureNoConflict(applicationId: string, reviewerId: string) {
  if (await prisma.conflictOfInterest.findFirst({ where: { applicationId, reviewerId, resolvedAt: null } })) throw new HttpError(409, "An unresolved conflict of interest blocks review activity.");
}

function changes(review: Review, input: ReviewInput) {
  const result: Record<string, { from: string | number | null; to: string | number | null }> = {};
  for (const key of ["impactScore", "feasibilityScore", "budgetJustificationScore", "comments"] as const) {
    if (input[key] !== undefined && input[key] !== review[key]) result[key] = { from: review[key] ?? null, to: input[key] ?? null };
  }
  return result;
}

export async function createReview(assignmentId: string, input: ReviewInput, reviewerId: string) {
  const assignment = await ownedAssignment(assignmentId, reviewerId, true);
  await ensureNoConflict(assignment.applicationId, reviewerId);
  if (assignment.review) throw new HttpError(409, "A review already exists for this assignment.");
  try {
    return await prisma.$transaction(async (tx) => {
    const review = await tx.review.create({ data: { assignmentId, applicationId: assignment.applicationId, reviewerId, ...input } });
    if (assignment.application.status === ApplicationStatus.ASSIGNED) {
      await tx.application.update({ where: { id: assignment.applicationId }, data: { status: ApplicationStatus.UNDER_REVIEW } });
      await tx.auditEvent.create({ data: { applicationId: assignment.applicationId, actorId: reviewerId, eventType: "APPLICATION_STATUS_CHANGED", metadata: { from: ApplicationStatus.ASSIGNED, to: ApplicationStatus.UNDER_REVIEW, assignmentId, reviewId: review.id } } });
    }
    await tx.auditEvent.create({ data: { applicationId: assignment.applicationId, actorId: reviewerId, eventType: "REVIEW_CREATED", metadata: { assignmentId, reviewId: review.id } } });
    return review;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new HttpError(409, "A review already exists for this assignment.");
    throw error;
  }
}

async function ownedReview(id: string, reviewerId: string, mutate: boolean): Promise<Review> {
  const review = await prisma.review.findUnique({ where: { id }, include: reviewInclude });
  if (!review) throw new HttpError(404, "Review not found.");
  if (review.reviewerId !== reviewerId) throw new HttpError(403, "You do not have permission to access this review.");
  if (mutate) {
    await ownedAssignment(review.assignmentId, reviewerId, true);
    await ensureNoConflict(review.applicationId, reviewerId);
  }
  return review;
}

export async function getReview(assignmentId: string, reviewerId: string) {
  const assignment = await ownedAssignment(assignmentId, reviewerId, false);
  if (!assignment.review) throw new HttpError(404, "Review not found.");
  return assignment.review;
}

export async function updateReview(id: string, input: ReviewInput, reviewerId: string) {
  const review = await ownedReview(id, reviewerId, true);
  if (review.status === ReviewStatus.COMPLETED) throw new HttpError(409, "Completed reviews cannot be modified.");
  const delta = changes(review, input);
  if (!Object.keys(delta).length) return review;
  return prisma.$transaction(async (tx) => {
    const updated = await tx.review.update({ where: { id }, data: input });
    await tx.auditEvent.create({ data: { applicationId: review.applicationId, actorId: reviewerId, eventType: "REVIEW_UPDATED", metadata: { reviewId: id, changes: delta } } });
    return updated;
  });
}

export async function completeReview(id: string, reviewerId: string) {
  const review = await ownedReview(id, reviewerId, true);
  if (review.status === ReviewStatus.COMPLETED) throw new HttpError(409, "Review is already completed.");
  if (![review.impactScore, review.feasibilityScore, review.budgetJustificationScore].every((score) => typeof score === "number" && Number.isInteger(score) && score >= 1 && score <= 5)) throw new HttpError(409, "All three scores are required to complete a review.");
  return prisma.$transaction(async (tx) => {
    const completedAt = new Date();
    const updated = await tx.review.update({ where: { id }, data: { status: ReviewStatus.COMPLETED, completedAt } });
    await tx.auditEvent.create({ data: { applicationId: review.applicationId, actorId: reviewerId, eventType: "REVIEW_COMPLETED", metadata: { reviewId: id, assignmentId: review.assignmentId, status: ReviewStatus.COMPLETED } } });
    return updated;
  });
}

export async function declareConflict(assignmentId: string, reason: string, reviewerId: string) {
  const assignment = await ownedAssignment(assignmentId, reviewerId, true);
  if (assignment.review?.status === ReviewStatus.COMPLETED) throw new HttpError(409, "Conflicts cannot be declared after review completion.");
  if (await prisma.conflictOfInterest.findFirst({ where: { applicationId: assignment.applicationId, reviewerId, resolvedAt: null } })) throw new HttpError(409, "An unresolved conflict already exists.");
  return prisma.$transaction(async (tx) => {
    const conflict = await tx.conflictOfInterest.create({ data: { applicationId: assignment.applicationId, reviewerId, reason, activeConflictKey: `${assignment.applicationId}:${reviewerId}` } });
    await tx.auditEvent.create({ data: { applicationId: assignment.applicationId, actorId: reviewerId, eventType: "CONFLICT_DECLARED", metadata: { assignmentId, conflictId: conflict.id } } });
    return conflict;
  });
}
