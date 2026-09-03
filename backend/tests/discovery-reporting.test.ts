import { ApplicationStatus, Prisma, ReviewStatus, UserRole } from "@prisma/client";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  fundingRound: { findUnique: vi.fn() }, user: { findUnique: vi.fn() },
  application: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), count: vi.fn() },
  reviewerAssignment: { findFirst: vi.fn(), count: vi.fn(), create: vi.fn() },
  conflictOfInterest: { findFirst: vi.fn() }, review: { findMany: vi.fn() }, auditEvent: { create: vi.fn() }, $transaction: vi.fn(),
}));
vi.mock("../src/config/prisma.js", () => ({ prisma: db }));
import { app } from "../src/app.js";

const secret = "test-jwt-secret-that-is-long-enough-for-validation";
const officer = { id: "officer-1", name: "Maya", email: "maya@example.test", role: UserRole.PROGRAM_OFFICER };
const reviewerOne = { id: "reviewer-1", name: "Ava", email: "ava@example.test", role: UserRole.REVIEWER };
const reviewerTwo = { id: "reviewer-2", name: "Ben", email: "ben@example.test", role: UserRole.REVIEWER };
const round = { id: "round-1", name: "Spring", opensAt: new Date("2026-01-01"), closesAt: new Date("2026-03-31") };
const headers = { Authorization: `Bearer ${jwt.sign({ userId: officer.id, role: officer.role }, secret)}` };
const reviewerHeaders = { Authorization: `Bearer ${jwt.sign({ userId: reviewerOne.id, role: reviewerOne.role }, secret)}` };

function application(id = "application-1", overrides: Record<string, unknown> = {}) {
  return { id, organizationName: "Example Foundation", contactEmail: "contact@example.test", requestedAmount: new Prisma.Decimal("1000.00"), submittedAt: new Date("2026-01-01"), status: ApplicationStatus.ASSIGNED, archivedAt: null, ownerId: officer.id, fundingRoundId: round.id, createdAt: new Date(), updatedAt: new Date(), fundingRound: round, owner: officer, reviews: [], fundingDecision: null, ...overrides };
}
function assignment(applicationId: string, reviewerId: string) {
  const reviewer = reviewerId === reviewerOne.id ? reviewerOne : reviewerTwo;
  return { id: `${applicationId}-${reviewerId}`, applicationId, reviewerId, activeAssignmentKey: `${applicationId}:${reviewerId}`, dueAt: new Date("2026-04-01"), assignedAt: new Date(), completedAt: null, removedAt: null, createdAt: new Date(), updatedAt: new Date(), reviewer, application: { ...application(applicationId), fundingRound: { id: round.id, name: round.name } }, review: null };
}

describe("Phase 10 discovery, bulk assignment, and reporting", () => {
  beforeEach(() => {
    for (const group of Object.values(db)) {
      if (group && typeof group === "object") for (const fn of Object.values(group)) (fn as ReturnType<typeof vi.fn>).mockReset();
    }
    db.$transaction.mockReset();
    db.fundingRound.findUnique.mockResolvedValue(round);
    db.application.findMany.mockResolvedValue([application()]);
    db.application.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => application(where.id));
    db.application.count.mockResolvedValue(1);
    db.user.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => where.id === reviewerOne.id ? reviewerOne : where.id === reviewerTwo.id ? reviewerTwo : null);
    db.reviewerAssignment.findFirst.mockResolvedValue(null);
    db.reviewerAssignment.count.mockImplementation(async ({ where }: { where: { reviewerId: string } }) => where.reviewerId === reviewerTwo.id ? 5 : 0);
    db.reviewerAssignment.create.mockImplementation(async ({ data }: { data: { applicationId: string; reviewerId: string } }) => assignment(data.applicationId, data.reviewerId));
    db.conflictOfInterest.findFirst.mockImplementation(async ({ where }: { where: { applicationId: string; reviewerId: string } }) => where.applicationId === "application-2" && where.reviewerId === reviewerOne.id ? { id: "conflict" } : null);
    db.review.findMany.mockResolvedValue([]);
    db.$transaction.mockImplementation(async (callback: (transaction: typeof db) => unknown) => callback(db));
  });

  it("builds server-side discovery filters, sorting, pagination, and total count", async () => {
    const response = await request(app).get("/applications?search=example&fundingRoundId=round-1&status=ASSIGNED&ownerId=officer-1&overdue=true&sortBy=requestedAmount&sortDirection=asc&page=2&pageSize=10").set(headers);
    expect(response).toMatchObject({ status: 200, body: { applications: [{ id: "application-1", requestedAmount: "1000.00" }], total: 1, page: 2, pageSize: 10 } });
    expect(db.application.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ fundingRoundId: round.id, status: ApplicationStatus.ASSIGNED, ownerId: officer.id, assignments: expect.objectContaining({ some: expect.objectContaining({ removedAt: null, dueAt: { lt: expect.any(Date) } }) }) }), orderBy: [{ requestedAmount: "asc" }, { id: "asc" }], skip: 10, take: 10 }));
    const [findManyArgs] = db.application.findMany.mock.calls[0];
    const [countArgs] = db.application.count.mock.calls[0];
    expect(countArgs.where).toEqual(findManyArgs.where);
    expect(countArgs).toEqual({ where: findManyArgs.where });
    expect((await request(app).get("/applications?overdue=maybe").set(headers)).status).toBe(400);
  });

  it("constructs search, overdue, and individual discovery filters in Prisma", async () => {
    await request(app).get("/applications?search=foundation").set(headers);
    expect(db.application.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: { OR: [{ organizationName: { contains: "foundation", mode: "insensitive" } }, { contactEmail: { contains: "foundation", mode: "insensitive" } }] } }));

    await request(app).get("/applications?overdue=true").set(headers);
    expect(db.application.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: { assignments: { some: { removedAt: null, dueAt: { lt: expect.any(Date) }, OR: [{ review: { is: null } }, { review: { is: { status: { not: ReviewStatus.COMPLETED } } } }] } } } }));

    await request(app).get("/applications?overdue=false").set(headers);
    expect(db.application.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: { NOT: { assignments: { some: expect.objectContaining({ removedAt: null, dueAt: { lt: expect.any(Date) } }) } } } }));

    for (const [query, where] of [["fundingRoundId=other-round", { fundingRoundId: "other-round" }], ["status=DECIDED", { status: ApplicationStatus.DECIDED }], ["ownerId=officer-2", { ownerId: "officer-2" }]] as const) {
      await request(app).get(`/applications?${query}`).set(headers);
      expect(db.application.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where }));
    }
  });

  it("validates discovery sorting and pagination while preserving database ordering", async () => {
    for (const [query, orderBy] of [["sortBy=submittedAt&sortDirection=asc", [{ submittedAt: "asc" }, { id: "asc" }]], ["sortBy=requestedAmount&sortDirection=desc", [{ requestedAmount: "desc" }, { id: "asc" }]], ["sortBy=status&sortDirection=asc", [{ status: "asc" }, { id: "asc" }]]] as const) {
      await request(app).get(`/applications?${query}`).set(headers);
      expect(db.application.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ orderBy }));
    }
    for (const query of ["sortBy=name", "sortDirection=sideways", "page=0", "pageSize=101", "status=UNKNOWN"]) {
      expect((await request(app).get(`/applications?${query}`).set(headers)).status).toBe(400);
    }
  });

  it("returns each bulk-assignment success or Phase 6 refusal", async () => {
    db.application.findMany.mockResolvedValue([{ id: "application-1" }, { id: "application-2" }]);
    const response = await request(app).post("/funding-rounds/round-1/assignments/bulk").set(headers).send({ reviewerIds: [reviewerOne.id, reviewerTwo.id], dueAt: "2026-04-01T00:00:00.000Z" });
    expect(response.status).toBe(200);
    expect(response.body.results).toEqual(expect.arrayContaining([
      expect.objectContaining({ applicationId: "application-1", reviewerId: reviewerOne.id, success: true }),
      expect.objectContaining({ applicationId: "application-1", reviewerId: reviewerTwo.id, success: false, reason: "Reviewer has reached the maximum of 5 active assignments." }),
      expect.objectContaining({ applicationId: "application-2", reviewerId: reviewerOne.id, success: false, reason: "Reviewer has an unresolved conflict of interest." }),
    ]));
    expect(db.reviewerAssignment.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ applicationId: "application-1", reviewerId: reviewerOne.id }) }));
  });

  it("validates bulk access and request contracts", async () => {
    const path = "/funding-rounds/round-1/assignments/bulk";
    expect((await request(app).post(path).send({ reviewerIds: [reviewerOne.id], dueAt: "2026-04-01T00:00:00.000Z" })).status).toBe(401);
    expect((await request(app).post(path).set(reviewerHeaders).send({ reviewerIds: [reviewerOne.id], dueAt: "2026-04-01T00:00:00.000Z" })).status).toBe(403);
    expect((await request(app).post(path).set(headers).send({ reviewerIds: [], dueAt: "2026-04-01T00:00:00.000Z" })).status).toBe(400);
    expect((await request(app).post(path).set(headers).send({ reviewerIds: [reviewerOne.id, reviewerOne.id], dueAt: "2026-04-01T00:00:00.000Z" })).status).toBe(400);
    expect((await request(app).post(path).set(headers).send({ reviewerIds: [reviewerOne.id], dueAt: "not-a-date" })).status).toBe(400);
  });

  it("keeps processing pairs while sequentially consuming reviewer capacity", async () => {
    let active = 4;
    db.application.findMany.mockResolvedValue([{ id: "application-1" }, { id: "application-2" }]);
    db.conflictOfInterest.findFirst.mockResolvedValue(null);
    db.reviewerAssignment.count.mockImplementation(async () => active);
    db.reviewerAssignment.create.mockImplementation(async ({ data }: { data: { applicationId: string; reviewerId: string } }) => { active += 1; return assignment(data.applicationId, data.reviewerId); });
    const response = await request(app).post("/funding-rounds/round-1/assignments/bulk").set(headers).send({ reviewerIds: [reviewerOne.id, reviewerTwo.id], dueAt: "2026-04-01T00:00:00.000Z" });
    expect(response.body.results).toEqual(expect.arrayContaining([
      expect.objectContaining({ applicationId: "application-1", reviewerId: reviewerOne.id, success: true }),
      expect.objectContaining({ applicationId: "application-1", reviewerId: reviewerTwo.id, success: false, reason: "Reviewer has reached the maximum of 5 active assignments." }),
      expect.objectContaining({ applicationId: "application-2", reviewerId: reviewerOne.id, success: false, reason: "Reviewer has reached the maximum of 5 active assignments." }),
    ]));
    expect(db.reviewerAssignment.count).toHaveBeenCalledTimes(4);
  });

  it("returns safe results for missing rounds, reviewers, and empty rounds", async () => {
    db.fundingRound.findUnique.mockResolvedValueOnce(null);
    expect((await request(app).post("/funding-rounds/missing/assignments/bulk").set(headers).send({ reviewerIds: [reviewerOne.id], dueAt: "2026-04-01T00:00:00.000Z" })).status).toBe(404);
    db.application.findMany.mockResolvedValueOnce([{ id: "application-1" }]);
    db.user.findUnique.mockResolvedValueOnce(null);
    const missingReviewer = await request(app).post("/funding-rounds/round-1/assignments/bulk").set(headers).send({ reviewerIds: ["missing-reviewer"], dueAt: "2026-04-01T00:00:00.000Z" });
    expect(missingReviewer).toMatchObject({ status: 200, body: { results: [{ success: false, reason: "Reviewer not found." }] } });
    db.application.findMany.mockResolvedValueOnce([]);
    expect(await request(app).post("/funding-rounds/round-1/assignments/bulk").set(headers).send({ reviewerIds: [reviewerOne.id], dueAt: "2026-04-01T00:00:00.000Z" })).toMatchObject({ status: 200, body: { results: [] } });
  });

  it("exports only completed reviews as correctly escaped CSV", async () => {
    const records = [
      { id: "review-1", applicationId: "application-1", status: ReviewStatus.COMPLETED, completedAt: new Date("2026-04-02T00:00:00.000Z"), impactScore: 5, feasibilityScore: 4, budgetJustificationScore: 3, application: { id: "application-1", organizationName: 'Example, "Foundation"\nLine two', contactEmail: "contact@example.test" }, reviewer: reviewerOne },
      { id: "draft-1", applicationId: "application-1", status: ReviewStatus.DRAFT, completedAt: null, impactScore: null, feasibilityScore: null, budgetJustificationScore: null, application: { id: "application-1", organizationName: "Draft-only", contactEmail: "draft@example.test" }, reviewer: reviewerTwo },
    ];
    db.review.findMany.mockImplementation(async ({ where }: { where: { status: ReviewStatus } }) => records.filter((record) => record.status === where.status));
    const response = await request(app).get("/funding-rounds/round-1/reviews/export.csv").set(headers);
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/csv");
    expect(response.headers["content-disposition"]).toContain("attachment");
    expect(response.text).toContain('"Example, ""Foundation""\nLine two"');
    expect(response.text).not.toContain("Draft-only");
    expect(response.text).toContain('"5","4","3"');
    expect(db.review.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: ReviewStatus.COMPLETED, application: { is: { fundingRoundId: round.id } } } }));
  });

  it("protects CSV access and returns deliberate empty and missing-round results", async () => {
    const path = "/funding-rounds/round-1/reviews/export.csv";
    expect((await request(app).get(path)).status).toBe(401);
    expect((await request(app).get(path).set(reviewerHeaders)).status).toBe(403);
    db.review.findMany.mockResolvedValue([]);
    const empty = await request(app).get(path).set(headers);
    expect(empty).toMatchObject({ status: 200 });
    expect(empty.text.trim()).toBe('"Application ID","Organization","Contact Email","Reviewer ID","Reviewer","Reviewer Email","Review ID","Completed At","Impact","Feasibility","Budget Justification"');
    db.fundingRound.findUnique.mockResolvedValueOnce(null);
    expect((await request(app).get("/funding-rounds/missing/reviews/export.csv").set(headers)).status).toBe(404);
  });

  it("neutralizes formula-leading user-controlled CSV values", async () => {
    db.review.findMany.mockResolvedValue(["=formula", "+formula", "-formula", "@formula"].map((organizationName, index) => ({ id: `review-${index}`, applicationId: `application-${index}`, status: ReviewStatus.COMPLETED, completedAt: new Date("2026-04-02T00:00:00.000Z"), impactScore: 5, feasibilityScore: 4, budgetJustificationScore: 3, application: { id: `application-${index}`, organizationName, contactEmail: "contact@example.test" }, reviewer: reviewerOne })));
    const response = await request(app).get("/funding-rounds/round-1/reviews/export.csv").set(headers);
    for (const value of ["=formula", "+formula", "-formula", "@formula"]) expect(response.text).toContain(`"'${value}"`);
  });
});
