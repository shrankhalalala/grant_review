import { ApplicationStatus, Prisma, ReviewStatus, UserRole } from "@prisma/client";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  application: { aggregate: vi.fn(), count: vi.fn(), groupBy: vi.fn() },
  reviewerAssignment: { count: vi.fn() },
  review: { groupBy: vi.fn() },
  fundingRound: { findMany: vi.fn() },
  fundingDecision: { findMany: vi.fn() },
}));
vi.mock("../src/config/prisma.js", () => ({ prisma: db }));
import { app } from "../src/app.js";
import { getDashboard } from "../src/services/dashboard.service.js";

const secret = "test-jwt-secret-that-is-long-enough-for-validation";
const officer = { id: "officer-1", role: UserRole.PROGRAM_OFFICER };
const reviewer = { id: "reviewer-1", role: UserRole.REVIEWER };
const auth = (user: typeof officer | typeof reviewer) => ({ Authorization: `Bearer ${jwt.sign({ userId: user.id, role: user.role }, secret)}` });

describe("Phase 11 dashboard", () => {
  beforeEach(() => {
    for (const group of Object.values(db)) for (const fn of Object.values(group)) (fn as ReturnType<typeof vi.fn>).mockReset();
    db.application.count.mockResolvedValue(7);
    db.reviewerAssignment.count.mockResolvedValue(2);
    db.review.groupBy.mockResolvedValue([{ applicationId: "ready-1", _count: { _all: 3 } }, { applicationId: "ready-2", _count: { _all: 4 } }]);
    db.application.aggregate.mockResolvedValue({ _sum: { requestedAmount: new Prisma.Decimal("1234.56") } });
    db.application.groupBy.mockResolvedValue([{ status: ApplicationStatus.SUBMITTED, _count: { _all: 2 } }, { status: ApplicationStatus.UNDER_REVIEW, _count: { _all: 5 } }]);
    db.fundingRound.findMany.mockResolvedValue([{ id: "round-1", name: "Autumn", _count: { applications: 4 } }, { id: "round-2", name: "Spring", _count: { applications: 0 } }]);
    db.fundingDecision.findMany.mockResolvedValue([{ decidedAt: new Date("2026-08-03T10:00:00.000Z") }, { decidedAt: new Date("2026-08-09T23:00:00.000Z") }, { decidedAt: new Date("2026-09-14T00:00:00.000Z") }]);
  });

  it("protects the Program Officer dashboard", async () => {
    expect((await request(app).get("/dashboard")).status).toBe(401);
    expect((await request(app).get("/dashboard").set(auth(reviewer))).status).toBe(403);
  });

  it("returns dashboard aggregates with fixed status and eight-week buckets", async () => {
    const response = await request(app).get("/dashboard").set(auth(officer));
    expect(response).toMatchObject({ status: 200, body: { dashboard: {
      openApplications: 7, overdueReviews: 2, readyForDecision: 2, amountRequestedThisMonth: "1234.56",
      applicationsByStatus: [
        { status: ApplicationStatus.SUBMITTED, count: 2 }, { status: ApplicationStatus.ASSIGNED, count: 0 },
        { status: ApplicationStatus.UNDER_REVIEW, count: 5 }, { status: ApplicationStatus.DECIDED, count: 0 },
      ],
      applicationsByFundingRound: [{ fundingRound: { id: "round-1", name: "Autumn" }, count: 4 }, { fundingRound: { id: "round-2", name: "Spring" }, count: 0 }],
    } } });
    expect(response.body.dashboard.applicationsDecidedByWeek).toHaveLength(8);
  });

  it("counts only active under-review applications with at least three completed reviews", async () => {
    const dashboard = await getDashboard(new Date("2026-09-16T12:00:00.000Z"));
    expect(db.reviewerAssignment.count).toHaveBeenCalledWith({ where: {
      removedAt: null, dueAt: { lt: new Date("2026-09-16T12:00:00.000Z") },
      OR: [{ review: { is: null } }, { review: { is: { status: { not: ReviewStatus.COMPLETED } } } }],
    } });
    expect(db.review.groupBy).toHaveBeenCalledWith({
      by: ["applicationId"], where: { status: ReviewStatus.COMPLETED, application: { is: { status: ApplicationStatus.UNDER_REVIEW, archivedAt: null } } },
      _count: { _all: true }, having: { applicationId: { _count: { gte: 3 } } },
    });
    expect(db.application.aggregate).toHaveBeenCalledWith({ where: { submittedAt: { gte: new Date("2026-09-01T00:00:00.000Z"), lt: new Date("2026-10-01T00:00:00.000Z") } }, _sum: { requestedAmount: true } });
    expect(db.fundingDecision.findMany).toHaveBeenCalledWith({ where: { decidedAt: { gte: new Date("2026-07-27T00:00:00.000Z"), lt: new Date("2026-09-21T00:00:00.000Z") } }, select: { decidedAt: true } });
    expect(dashboard.applicationsDecidedByWeek).toEqual([
      { weekStart: "2026-07-27", count: 0 }, { weekStart: "2026-08-03", count: 2 },
      { weekStart: "2026-08-10", count: 0 }, { weekStart: "2026-08-17", count: 0 },
      { weekStart: "2026-08-24", count: 0 }, { weekStart: "2026-08-31", count: 0 },
      { weekStart: "2026-09-07", count: 0 }, { weekStart: "2026-09-14", count: 1 },
    ]);
  });

  it("serializes a missing monthly sum as an exact zero amount", async () => {
    db.application.aggregate.mockResolvedValueOnce({ _sum: { requestedAmount: null } });
    const response = await request(app).get("/dashboard").set(auth(officer));
    expect(response).toMatchObject({ status: 200, body: { dashboard: { amountRequestedThisMonth: "0.00" } } });
  });
});
