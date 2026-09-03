import { ApplicationStatus, FundingDecisionStatus, Prisma, ReviewStatus } from "@prisma/client";

import { prisma } from "../config/prisma.js";
import { HttpError } from "../middleware/errorHandler.js";
import type { ApplicationInput, ApplicationUpdateInput } from "../types/application.js";
import type { ApplicationDiscoveryInput } from "../types/discovery.js";

const applicationInclude = {
  fundingRound: { select: { id: true, name: true, opensAt: true, closesAt: true } },
  owner: { select: { id: true, name: true, email: true, role: true } },
  reviews: {
    where: { status: ReviewStatus.COMPLETED },
    select: { id: true, impactScore: true, feasibilityScore: true, budgetJustificationScore: true, comments: true, completedAt: true, reviewer: { select: { id: true, name: true } } },
  },
  fundingDecision: { select: { id: true, decision: true, decidedAt: true, notes: true, decidedBy: { select: { id: true, name: true } } } },
} satisfies Prisma.ApplicationInclude;

type ApplicationRecord = Prisma.ApplicationGetPayload<{ include: typeof applicationInclude }>;

function serializeApplication(application: ApplicationRecord) {
  return {
    ...application,
    requestedAmount: application.requestedAmount.toFixed(2),
    fundingDecision: application.fundingDecision && {
      id: application.fundingDecision.id,
      decision: application.fundingDecision.decision,
      decidedAt: application.fundingDecision.decidedAt,
      notes: application.fundingDecision.notes,
      decidedBy: { id: application.fundingDecision.decidedBy.id, name: application.fundingDecision.decidedBy.name },
    },
  };
}

async function requireFundingRound(fundingRoundId: string) {
  const fundingRound = await prisma.fundingRound.findUnique({ where: { id: fundingRoundId } });
  if (!fundingRound) {
    throw new HttpError(404, "Funding round not found.");
  }
}

async function requireApplication(id: string): Promise<ApplicationRecord> {
  const application = await prisma.application.findUnique({ where: { id }, include: applicationInclude });
  if (!application) {
    throw new HttpError(404, "Application not found.");
  }

  return application;
}

function auditMetadata(application: ApplicationRecord) {
  return {
    organizationName: application.organizationName,
    fundingRoundId: application.fundingRoundId,
    requestedAmount: application.requestedAmount.toFixed(2),
  };
}

type FieldChange = { from: string; to: string };

function getUpdateChanges(application: ApplicationRecord, input: ApplicationUpdateInput): Record<string, FieldChange> {
  const changes: Record<string, FieldChange> = {};

  if (input.organizationName !== undefined && input.organizationName !== application.organizationName) {
    changes.organizationName = { from: application.organizationName, to: input.organizationName };
  }
  if (input.contactEmail !== undefined && input.contactEmail !== application.contactEmail) {
    changes.contactEmail = { from: application.contactEmail, to: input.contactEmail };
  }
  if (input.fundingRoundId !== undefined && input.fundingRoundId !== application.fundingRoundId) {
    changes.fundingRoundId = { from: application.fundingRoundId, to: input.fundingRoundId };
  }
  if (input.requestedAmount !== undefined && !application.requestedAmount.equals(input.requestedAmount)) {
    changes.requestedAmount = { from: application.requestedAmount.toFixed(2), to: new Prisma.Decimal(input.requestedAmount).toFixed(2) };
  }
  if (input.submittedAt !== undefined && input.submittedAt.getTime() !== application.submittedAt.getTime()) {
    changes.submittedAt = { from: application.submittedAt.toISOString(), to: input.submittedAt.toISOString() };
  }

  return changes;
}

export async function createApplication(input: ApplicationInput, ownerId: string) {
  await requireFundingRound(input.fundingRoundId);
  const application = await prisma.$transaction(async (transaction) => {
    const created = await transaction.application.create({
      data: {
        ...input,
        requestedAmount: new Prisma.Decimal(input.requestedAmount),
        ownerId,
        status: "SUBMITTED",
      },
      include: applicationInclude,
    });
    await transaction.auditEvent.create({
      data: { applicationId: created.id, actorId: ownerId, eventType: "APPLICATION_CREATED", metadata: auditMetadata(created) },
    });
    return created;
  });

  return serializeApplication(application);
}

export async function listApplications(query: ApplicationDiscoveryInput) {
  const overdueAssignment: Prisma.ReviewerAssignmentWhereInput = {
    removedAt: null,
    dueAt: { lt: new Date() },
    OR: [{ review: { is: null } }, { review: { is: { status: { not: ReviewStatus.COMPLETED } } } }],
  };
  const where: Prisma.ApplicationWhereInput = {
    ...(query.search && { OR: [{ organizationName: { contains: query.search, mode: "insensitive" } }, { contactEmail: { contains: query.search, mode: "insensitive" } }] }),
    ...(query.fundingRoundId && { fundingRoundId: query.fundingRoundId }),
    ...(query.status && { status: query.status }),
    ...(query.ownerId && { ownerId: query.ownerId }),
    ...(query.overdue === true && { assignments: { some: overdueAssignment } }),
    ...(query.overdue === false && { NOT: { assignments: { some: overdueAssignment } } }),
  };
  const orderBy: Prisma.ApplicationOrderByWithRelationInput[] = query.sortBy === "submittedAt" && query.sortDirection === "desc"
    ? [{ submittedAt: "desc" }, { createdAt: "desc" }]
    : [{ [query.sortBy]: query.sortDirection }, { id: "asc" }];
  const [applications, total] = await Promise.all([prisma.application.findMany({
    where,
    include: applicationInclude,
    orderBy,
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
  }), prisma.application.count({ where })]);
  return { applications: applications.map(serializeApplication), total, page: query.page, pageSize: query.pageSize };
}

export async function getApplication(id: string) {
  return serializeApplication(await requireApplication(id));
}

export async function updateApplication(id: string, input: ApplicationUpdateInput, actorId: string) {
  const existing = await requireApplication(id);
  if (input.fundingRoundId) await requireFundingRound(input.fundingRoundId);
  const changes = getUpdateChanges(existing, input);

  if (Object.keys(changes).length === 0) {
    return serializeApplication(existing);
  }

  const application = await prisma.$transaction(async (transaction) => {
    const updated = await transaction.application.update({
      where: { id },
      data: {
        ...input,
        requestedAmount: input.requestedAmount ? new Prisma.Decimal(input.requestedAmount) : undefined,
      },
      include: applicationInclude,
    });
    await transaction.auditEvent.create({
      data: { applicationId: id, actorId, eventType: "APPLICATION_UPDATED", metadata: { changes } },
    });
    return updated;
  });

  return serializeApplication(application);
}

async function changeArchiveState(id: string, actorId: string, archive: boolean) {
  const existing = await requireApplication(id);
  if (Boolean(existing.archivedAt) === archive) {
    return serializeApplication(existing);
  }

  const application = await prisma.$transaction(async (transaction) => {
    const updated = await transaction.application.update({
      where: { id },
      data: { archivedAt: archive ? new Date() : null },
      include: applicationInclude,
    });
    await transaction.auditEvent.create({
      data: { applicationId: id, actorId, eventType: archive ? "APPLICATION_ARCHIVED" : "APPLICATION_RESTORED", metadata: auditMetadata(updated) },
    });
    return updated;
  });

  return serializeApplication(application);
}

export function archiveApplication(id: string, actorId: string) {
  return changeArchiveState(id, actorId, true);
}

export function restoreApplication(id: string, actorId: string) {
  return changeArchiveState(id, actorId, false);
}

async function lifecycleApplication(id: string) {
  const application = await prisma.application.findUnique({ where: { id } });
  if (!application) throw new HttpError(404, "Application not found.");
  if (application.archivedAt) throw new HttpError(409, "Archived applications cannot be changed.");
  return application;
}

export async function moveToUnderReview(id: string, actorId: string) {
  const existing = await lifecycleApplication(id);
  if (existing.status !== ApplicationStatus.ASSIGNED) throw new HttpError(409, existing.status === ApplicationStatus.UNDER_REVIEW ? "Application is already under review." : "Application must be assigned before review can begin.");
  return prisma.$transaction(async (tx) => {
    const transition = await tx.application.updateMany({ where: { id, status: ApplicationStatus.ASSIGNED, archivedAt: null }, data: { status: ApplicationStatus.UNDER_REVIEW } });
    if (transition.count !== 1) throw new HttpError(409, "Application must be assigned before review can begin.");
    const application = await tx.application.findUnique({ where: { id }, include: applicationInclude });
    if (!application) throw new HttpError(404, "Application not found.");
    await tx.auditEvent.create({ data: { applicationId: id, actorId, eventType: "APPLICATION_STATUS_CHANGED", metadata: { from: ApplicationStatus.ASSIGNED, to: ApplicationStatus.UNDER_REVIEW } } });
    return serializeApplication(application);
  });
}

export async function recordFundingDecision(id: string, decision: FundingDecisionStatus, actorId: string) {
  const existing = await lifecycleApplication(id);
  if (existing.status !== ApplicationStatus.UNDER_REVIEW) throw new HttpError(409, "Application must be under review before a funding decision.");
  if (await prisma.fundingDecision.findUnique({ where: { applicationId: id } })) throw new HttpError(409, "A funding decision already exists for this application.");
  try {
    return await prisma.$transaction(async (tx) => {
      const completed = await tx.review.count({ where: { applicationId: id, status: ReviewStatus.COMPLETED } });
      if (completed < 3) throw new HttpError(409, "At least 3 completed reviews are required before a funding decision.");
      const fundingDecision = await tx.fundingDecision.create({ data: { applicationId: id, decision, decidedById: actorId, decidedAt: new Date() }, include: { decidedBy: { select: { id: true, name: true } } } });
      await tx.application.update({ where: { id }, data: { status: ApplicationStatus.DECIDED } });
      await tx.auditEvent.create({ data: { applicationId: id, actorId, eventType: "APPLICATION_STATUS_CHANGED", metadata: { from: ApplicationStatus.UNDER_REVIEW, to: ApplicationStatus.DECIDED } } });
      await tx.auditEvent.create({ data: { applicationId: id, actorId, eventType: "FUNDING_DECISION_RECORDED", metadata: { decision, fundingDecisionId: fundingDecision.id } } });
      return fundingDecision;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new HttpError(409, "A funding decision already exists for this application.");
    throw error;
  }
}
