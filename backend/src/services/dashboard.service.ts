import { ApplicationStatus, Prisma, ReviewStatus } from "@prisma/client";

import { prisma } from "../config/prisma.js";

const statuses = [ApplicationStatus.SUBMITTED, ApplicationStatus.ASSIGNED, ApplicationStatus.UNDER_REVIEW, ApplicationStatus.DECIDED] as const;

function startOfUtcWeek(date: Date) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  return start;
}

function addUtcDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function getDashboard(now = new Date()) {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const currentWeekStart = startOfUtcWeek(now);
  const firstWeekStart = addUtcDays(currentWeekStart, -49);
  const nextWeekStart = addUtcDays(currentWeekStart, 7);
  const overdueWhere: Prisma.ReviewerAssignmentWhereInput = {
    removedAt: null,
    dueAt: { lt: now },
    OR: [{ review: { is: null } }, { review: { is: { status: { not: ReviewStatus.COMPLETED } } } }],
  };

  const [openApplications, overdueReviews, readyApplications, requestedThisMonth, statusGroups, fundingRounds, decisions] = await Promise.all([
    prisma.application.count({ where: { status: { not: ApplicationStatus.DECIDED } } }),
    prisma.reviewerAssignment.count({ where: overdueWhere }),
    prisma.review.groupBy({
      by: ["applicationId"],
      where: { status: ReviewStatus.COMPLETED, application: { is: { status: ApplicationStatus.UNDER_REVIEW, archivedAt: null } } },
      _count: { _all: true },
      having: { applicationId: { _count: { gte: 3 } } },
    }),
    prisma.application.aggregate({ where: { submittedAt: { gte: monthStart, lt: nextMonthStart } }, _sum: { requestedAmount: true } }),
    prisma.application.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.fundingRound.findMany({ select: { id: true, name: true, _count: { select: { applications: true } } }, orderBy: [{ name: "asc" }, { id: "asc" }] }),
    prisma.fundingDecision.findMany({ where: { decidedAt: { gte: firstWeekStart, lt: nextWeekStart } }, select: { decidedAt: true } }),
  ]);

  const statusCounts = new Map(statusGroups.map((group) => [group.status, group._count._all]));
  const decidedByWeek = new Map<string, number>();
  for (let offset = 0; offset < 8; offset += 1) decidedByWeek.set(isoDate(addUtcDays(firstWeekStart, offset * 7)), 0);
  for (const decision of decisions) {
    const week = isoDate(startOfUtcWeek(decision.decidedAt));
    if (decidedByWeek.has(week)) decidedByWeek.set(week, (decidedByWeek.get(week) ?? 0) + 1);
  }

  return {
    openApplications,
    overdueReviews,
    readyForDecision: readyApplications.length,
    amountRequestedThisMonth: requestedThisMonth._sum.requestedAmount?.toFixed(2) ?? "0.00",
    applicationsByStatus: statuses.map((status) => ({ status, count: statusCounts.get(status) ?? 0 })),
    applicationsByFundingRound: fundingRounds.map((round) => ({ fundingRound: { id: round.id, name: round.name }, count: round._count.applications })),
    applicationsDecidedByWeek: [...decidedByWeek].map(([weekStart, count]) => ({ weekStart, count })),
  };
}
