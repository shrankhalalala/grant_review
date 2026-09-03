import { ApplicationStatus, Prisma, ReviewStatus, UserRole } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { HttpError } from "../middleware/errorHandler.js";
import type { AssignmentInput } from "../types/assignment.js";
import type { BulkAssignmentInput } from "../types/discovery.js";

const include = {
  reviewer: { select: { id: true, name: true, email: true, role: true } },
  application: { include: { fundingRound: { select: { id: true, name: true } } } },
  review: { select: { status: true } },
} satisfies Prisma.ReviewerAssignmentInclude;
type Assignment = Prisma.ReviewerAssignmentGetPayload<{ include: typeof include }>;

function serialize(assignment: Assignment) {
  return {
    ...assignment,
    application: { ...assignment.application, requestedAmount: assignment.application.requestedAmount.toFixed(2) },
  };
}

async function application(id: string) {
  const value = await prisma.application.findUnique({ where: { id } });
  if (!value) throw new HttpError(404, "Application not found.");
  if (value.archivedAt) throw new HttpError(409, "Archived applications cannot receive assignments.");
  if (value.status === ApplicationStatus.DECIDED) throw new HttpError(409, "Decided applications cannot receive assignments.");
  return value;
}

async function assignment(id: string): Promise<Assignment> {
  const value = await prisma.reviewerAssignment.findUnique({ where: { id }, include });
  if (!value) throw new HttpError(404, "Assignment not found.");
  return value;
}

function incomplete(value: Assignment) { return !value.review || value.review.status !== ReviewStatus.COMPLETED; }

export async function createAssignment(applicationId: string, input: AssignmentInput, actorId: string) {
  const app = await application(applicationId);
  const reviewer = await prisma.user.findUnique({ where: { id: input.reviewerId } });
  if (!reviewer || reviewer.role !== UserRole.REVIEWER) throw new HttpError(404, "Reviewer not found.");
  const existing = await prisma.reviewerAssignment.findFirst({ where: { applicationId, reviewerId: input.reviewerId, removedAt: null } });
  if (existing) throw new HttpError(409, "Reviewer is already assigned to this application.");
  const conflict = await prisma.conflictOfInterest.findFirst({ where: { applicationId, reviewerId: input.reviewerId, resolvedAt: null } });
  if (conflict) throw new HttpError(409, "Reviewer has an unresolved conflict of interest.");
  const active = await prisma.reviewerAssignment.count({ where: { reviewerId: input.reviewerId, removedAt: null, OR: [{ review: { is: null } }, { review: { is: { status: { not: ReviewStatus.COMPLETED } } } }] } });
  if (active >= 5) throw new HttpError(409, "Reviewer has reached the maximum of 5 active assignments.");
  const value = await prisma.$transaction(async (tx) => {
    const created = await tx.reviewerAssignment.create({ data: { applicationId, reviewerId: input.reviewerId, dueAt: input.dueAt, activeAssignmentKey: `${applicationId}:${input.reviewerId}` }, include });
    if (app.status === ApplicationStatus.SUBMITTED) {
      await tx.application.update({ where: { id: applicationId }, data: { status: ApplicationStatus.ASSIGNED } });
      await tx.auditEvent.create({ data: { applicationId, actorId, eventType: "APPLICATION_STATUS_CHANGED", metadata: { from: ApplicationStatus.SUBMITTED, to: ApplicationStatus.ASSIGNED, assignmentId: created.id, reviewerId: input.reviewerId } } });
    }
    await tx.auditEvent.create({ data: { applicationId, actorId, eventType: "ASSIGNMENT_CREATED", metadata: { assignmentId: created.id, reviewerId: input.reviewerId, dueAt: input.dueAt.toISOString() } } });
    return created;
  });
  return serialize(value);
}

export async function bulkAssignFundingRound(fundingRoundId: string, input: BulkAssignmentInput, actorId: string) {
  const fundingRound = await prisma.fundingRound.findUnique({ where: { id: fundingRoundId } });
  if (!fundingRound) throw new HttpError(404, "Funding round not found.");
  const applications = await prisma.application.findMany({ where: { fundingRoundId }, select: { id: true } });
  const results: Array<{ applicationId: string; reviewerId: string; success: boolean; assignment?: unknown; reason?: string }> = [];
  for (const application of applications) {
    for (const reviewerId of input.reviewerIds) {
      try {
        results.push({ applicationId: application.id, reviewerId, success: true, assignment: await createAssignment(application.id, { reviewerId, dueAt: input.dueAt }, actorId) });
      } catch (error) {
        results.push({ applicationId: application.id, reviewerId, success: false, reason: error instanceof HttpError ? error.message : "Assignment could not be created." });
      }
    }
  }
  return results;
}

export async function listApplicationAssignments(applicationId: string) {
  await application(applicationId);
  return (await prisma.reviewerAssignment.findMany({ where: { applicationId }, include, orderBy: { createdAt: "asc" } })).map(serialize);
}

export async function listMyAssignments(reviewerId: string) {
  return (await prisma.reviewerAssignment.findMany({ where: { reviewerId }, include, orderBy: { createdAt: "desc" } })).map(serialize);
}

export async function updateDueAt(id: string, dueAt: Date, actorId: string) {
  const existing = await assignment(id);
  if (existing.removedAt) throw new HttpError(409, "Removed assignments cannot be modified.");
  if (!incomplete(existing)) throw new HttpError(409, "Completed review assignments cannot be modified.");
  if (existing.dueAt.getTime() === dueAt.getTime()) return serialize(existing);
  const value = await prisma.$transaction(async (tx) => {
    const updated = await tx.reviewerAssignment.update({ where: { id }, data: { dueAt }, include });
    await tx.auditEvent.create({ data: { applicationId: updated.applicationId, actorId, eventType: "ASSIGNMENT_DUE_DATE_CHANGED", metadata: { assignmentId: id, changes: { dueAt: { from: existing.dueAt.toISOString(), to: dueAt.toISOString() } } } } });
    return updated;
  });
  return serialize(value);
}

export async function removeAssignment(id: string, actorId: string) {
  const existing = await assignment(id);
  if (!incomplete(existing)) throw new HttpError(409, "Completed review assignments cannot be removed.");
  if (existing.removedAt) return serialize(existing);
  const value = await prisma.$transaction(async (tx) => {
    const updated = await tx.reviewerAssignment.update({ where: { id }, data: { removedAt: new Date(), activeAssignmentKey: null }, include });
    await tx.auditEvent.create({ data: { applicationId: updated.applicationId, actorId, eventType: "ASSIGNMENT_REMOVED", metadata: { assignmentId: id, reviewerId: updated.reviewerId } } });
    return updated;
  });
  return serialize(value);
}
