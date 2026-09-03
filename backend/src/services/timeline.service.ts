import { Prisma } from "@prisma/client";

import { prisma } from "../config/prisma.js";
import { HttpError } from "../middleware/errorHandler.js";

const timelineInclude = {
  actor: { select: { id: true, name: true } },
} satisfies Prisma.AuditEventInclude;

async function requireApplication(applicationId: string) {
  const application = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!application) throw new HttpError(404, "Application not found.");
  return application;
}

export async function getTimeline(applicationId: string) {
  await requireApplication(applicationId);
  const events = await prisma.auditEvent.findMany({
    where: { applicationId },
    include: timelineInclude,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return events.map((event) => ({
    id: event.id,
    applicationId: event.applicationId,
    actorId: event.actorId,
    eventType: event.eventType,
    metadata: event.metadata,
    createdAt: event.createdAt,
    actor: event.actor && { id: event.actor.id, name: event.actor.name },
  }));
}

export async function addTimelineComment(applicationId: string, comment: string, actorId: string) {
  const application = await requireApplication(applicationId);
  if (application.archivedAt) throw new HttpError(409, "Archived applications cannot receive comments.");
  const event = await prisma.auditEvent.create({
    data: { applicationId, actorId, eventType: "APPLICATION_COMMENT_ADDED", metadata: { comment } },
    include: timelineInclude,
  });
  return { id: event.id, applicationId: event.applicationId, actorId: event.actorId, eventType: event.eventType, metadata: event.metadata, createdAt: event.createdAt, actor: event.actor && { id: event.actor.id, name: event.actor.name } };
}
