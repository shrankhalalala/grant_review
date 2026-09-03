import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

import { getDatabaseUrl } from "../src/config/env.js";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: getDatabaseUrl() }),
});

const ids = {
  officers: ["officer-1", "officer-2"],
  reviewers: ["reviewer-1", "reviewer-2", "reviewer-3", "reviewer-4", "reviewer-5"],
  rounds: ["round-2026-spring", "round-2026-autumn"],
  applications: ["application-1", "application-2", "application-3", "application-4"],
  assignments: ["assignment-1", "assignment-2", "assignment-3", "assignment-4", "assignment-5"],
};

async function main() {
  await prisma.overdueAlert.deleteMany();
  await prisma.auditEvent.deleteMany();
  await prisma.fundingDecision.deleteMany();
  await prisma.review.deleteMany();
  await prisma.conflictOfInterest.deleteMany();
  await prisma.reviewerAssignment.deleteMany();
  await prisma.application.deleteMany();
  await prisma.fundingRound.deleteMany();
  await prisma.user.deleteMany();

  await prisma.user.createMany({
    data: [
      { id: ids.officers[0], email: "maya.officer@example.test", name: "Maya Patel", role: "PROGRAM_OFFICER" },
      { id: ids.officers[1], email: "liam.officer@example.test", name: "Liam Chen", role: "PROGRAM_OFFICER" },
      { id: ids.reviewers[0], email: "ava.reviewer@example.test", name: "Ava Wilson", role: "REVIEWER" },
      { id: ids.reviewers[1], email: "noah.reviewer@example.test", name: "Noah Garcia", role: "REVIEWER" },
      { id: ids.reviewers[2], email: "emma.reviewer@example.test", name: "Emma Brown", role: "REVIEWER" },
      { id: ids.reviewers[3], email: "oliver.reviewer@example.test", name: "Oliver Davis", role: "REVIEWER" },
      { id: ids.reviewers[4], email: "sophia.reviewer@example.test", name: "Sophia Martinez", role: "REVIEWER" },
    ],
  });

  await prisma.fundingRound.createMany({
    data: [
      { id: ids.rounds[0], name: "Spring 2026 Community Grants", description: "Community-led resilience projects.", opensAt: new Date("2026-01-01"), closesAt: new Date("2026-03-31") },
      { id: ids.rounds[1], name: "Autumn 2026 Innovation Grants", description: "Early-stage public-benefit innovation.", opensAt: new Date("2026-07-01"), closesAt: new Date("2026-09-30") },
    ],
  });

  await prisma.application.createMany({
    data: [
      { id: ids.applications[0], organizationName: "Northside Learning Collective", contactEmail: "grants@northside.example.test", requestedAmount: new Prisma.Decimal("75000.00"), status: "DECIDED", ownerId: ids.officers[0], fundingRoundId: ids.rounds[0], submittedAt: new Date("2026-02-12") },
      { id: ids.applications[1], organizationName: "Riverwatch Network", contactEmail: "contact@riverwatch.example.test", requestedAmount: new Prisma.Decimal("48000.00"), status: "UNDER_REVIEW", ownerId: ids.officers[0], fundingRoundId: ids.rounds[0], submittedAt: new Date("2026-03-01") },
      { id: ids.applications[2], organizationName: "Civic Data Lab", contactEmail: "hello@civicdata.example.test", requestedAmount: new Prisma.Decimal("62000.00"), status: "ASSIGNED", ownerId: ids.officers[1], fundingRoundId: ids.rounds[1], submittedAt: new Date("2026-08-15") },
      { id: ids.applications[3], organizationName: "Green Blocks Cooperative", contactEmail: "team@greenblocks.example.test", requestedAmount: new Prisma.Decimal("25000.00"), status: "SUBMITTED", ownerId: ids.officers[1], fundingRoundId: ids.rounds[1], submittedAt: new Date("2026-08-29") },
    ],
  });

  await prisma.reviewerAssignment.createMany({
    data: [
      { id: ids.assignments[0], applicationId: ids.applications[0], reviewerId: ids.reviewers[0], activeAssignmentKey: `${ids.applications[0]}:${ids.reviewers[0]}`, dueAt: new Date("2026-03-10"), completedAt: new Date("2026-03-08") },
      { id: ids.assignments[1], applicationId: ids.applications[0], reviewerId: ids.reviewers[1], activeAssignmentKey: `${ids.applications[0]}:${ids.reviewers[1]}`, dueAt: new Date("2026-03-10"), completedAt: new Date("2026-03-09") },
      { id: ids.assignments[2], applicationId: ids.applications[0], reviewerId: ids.reviewers[2], activeAssignmentKey: `${ids.applications[0]}:${ids.reviewers[2]}`, dueAt: new Date("2026-03-10"), completedAt: new Date("2026-03-10") },
      { id: ids.assignments[3], applicationId: ids.applications[1], reviewerId: ids.reviewers[3], activeAssignmentKey: `${ids.applications[1]}:${ids.reviewers[3]}`, dueAt: new Date("2026-03-20") },
      { id: ids.assignments[4], applicationId: ids.applications[2], reviewerId: ids.reviewers[4], activeAssignmentKey: `${ids.applications[2]}:${ids.reviewers[4]}`, dueAt: new Date("2026-08-20") },
    ],
  });

  await prisma.review.createMany({
    data: [
      { applicationId: ids.applications[0], reviewerId: ids.reviewers[0], assignmentId: ids.assignments[0], status: "COMPLETED", impactScore: 5, feasibilityScore: 4, budgetJustificationScore: 4, comments: "Strong community evidence.", completedAt: new Date("2026-03-08") },
      { applicationId: ids.applications[0], reviewerId: ids.reviewers[1], assignmentId: ids.assignments[1], status: "COMPLETED", impactScore: 4, feasibilityScore: 5, budgetJustificationScore: 4, comments: "Implementation plan is well scoped.", completedAt: new Date("2026-03-09") },
      { applicationId: ids.applications[0], reviewerId: ids.reviewers[2], assignmentId: ids.assignments[2], status: "COMPLETED", impactScore: 4, feasibilityScore: 4, budgetJustificationScore: 5, comments: "Budget is well justified.", completedAt: new Date("2026-03-10") },
      { applicationId: ids.applications[1], reviewerId: ids.reviewers[3], assignmentId: ids.assignments[3], status: "DRAFT", comments: "Initial assessment in progress." },
    ],
  });

  await prisma.conflictOfInterest.create({
    data: {
      applicationId: ids.applications[2],
      reviewerId: ids.reviewers[0],
      activeConflictKey: `${ids.applications[2]}:${ids.reviewers[0]}`,
      reason: "Current advisory relationship with the applicant.",
    },
  });

  await prisma.fundingDecision.create({
    data: {
      applicationId: ids.applications[0],
      decision: "APPROVED",
      amountAwarded: new Prisma.Decimal("70000.00"),
      notes: "Approved following three completed reviews.",
      decidedById: ids.officers[0],
      decidedAt: new Date("2026-03-15"),
    },
  });

  await prisma.auditEvent.createMany({
    data: [
      { applicationId: ids.applications[0], actorId: ids.officers[0], eventType: "APPLICATION_CREATED", metadata: { source: "seed" } },
      { applicationId: ids.applications[0], actorId: ids.officers[0], eventType: "DECISION_RECORDED", metadata: { decision: "APPROVED" } },
      { applicationId: ids.applications[1], actorId: ids.officers[0], eventType: "REVIEWER_ASSIGNED", metadata: { reviewerId: ids.reviewers[3] } },
    ],
  });

  await prisma.overdueAlert.create({
    data: {
      assignmentId: ids.assignments[4],
      dueAtSnapshot: new Date("2026-08-20"),
      triggeredAt: new Date("2026-08-21"),
    },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
