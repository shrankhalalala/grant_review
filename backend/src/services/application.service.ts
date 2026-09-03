import { Prisma } from "@prisma/client";

import { prisma } from "../config/prisma.js";
import { HttpError } from "../middleware/errorHandler.js";
import type { ApplicationInput, ApplicationUpdateInput } from "../types/application.js";

const applicationInclude = {
  fundingRound: { select: { id: true, name: true, opensAt: true, closesAt: true } },
  owner: { select: { id: true, name: true, email: true, role: true } },
} satisfies Prisma.ApplicationInclude;

type ApplicationRecord = Prisma.ApplicationGetPayload<{ include: typeof applicationInclude }>;

function serializeApplication(application: ApplicationRecord) {
  return {
    ...application,
    requestedAmount: application.requestedAmount.toFixed(2),
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

export async function listApplications() {
  const applications = await prisma.application.findMany({
    include: applicationInclude,
    orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
  });
  return applications.map(serializeApplication);
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
