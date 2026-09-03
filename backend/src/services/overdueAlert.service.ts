import { Prisma, ReviewStatus } from "@prisma/client";

import { prisma } from "../config/prisma.js";
import { HttpError } from "../middleware/errorHandler.js";

const overdueWhere = (now: Date) => ({
  removedAt: null,
  dueAt: { lt: now },
  OR: [{ review: { is: null } }, { review: { is: { status: { not: ReviewStatus.COMPLETED } } } }],
});

const alertInclude = {
  assignment: {
    include: {
      application: { select: { id: true, organizationName: true } },
      reviewer: { select: { id: true, name: true } },
      review: { select: { status: true } },
    },
  },
} satisfies Prisma.OverdueAlertInclude;

type Alert = Prisma.OverdueAlertGetPayload<{ include: typeof alertInclude }>;

function serialize(alert: Alert) {
  return {
    id: alert.id,
    assignmentId: alert.assignmentId,
    application: alert.assignment.application,
    reviewer: alert.assignment.reviewer,
    dueAtSnapshot: alert.dueAtSnapshot,
    dismissedAt: alert.dismissedAt,
    triggeredAt: alert.triggeredAt,
    createdAt: alert.createdAt,
  };
}

export async function synchronizeOverdueAlerts(now = new Date()) {
  const assignments = await prisma.reviewerAssignment.findMany({
    where: overdueWhere(now),
    select: { id: true, dueAt: true },
  });

  await Promise.all(assignments.map(async (assignment) => {
    try {
      await prisma.overdueAlert.create({ data: { assignmentId: assignment.id, dueAtSnapshot: assignment.dueAt } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return;
      throw error;
    }
  }));
}

async function currentAlerts(now = new Date()) {
  const alerts = await prisma.overdueAlert.findMany({
    where: { dismissedAt: null, assignment: { is: overdueWhere(now) } },
    include: alertInclude,
    orderBy: [{ triggeredAt: "desc" }, { id: "desc" }],
  });
  return alerts.filter((alert) => alert.assignment.dueAt.getTime() === alert.dueAtSnapshot.getTime());
}

export async function listOverdueAlerts() {
  await synchronizeOverdueAlerts();
  return (await currentAlerts()).map(serialize);
}

export async function overdueAlertCount() {
  await synchronizeOverdueAlerts();
  return (await currentAlerts()).length;
}

export async function dismissOverdueAlert(id: string) {
  const alert = await prisma.overdueAlert.findUnique({ where: { id } });
  if (!alert) throw new HttpError(404, "Overdue alert not found.");
  if (alert.dismissedAt) return alert;
  return prisma.overdueAlert.update({ where: { id }, data: { dismissedAt: new Date() } });
}
