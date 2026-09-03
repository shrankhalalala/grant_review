import { ApplicationStatus, Prisma, ReviewStatus, UserRole } from "@prisma/client";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  application: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  auditEvent: { findMany: vi.fn(), create: vi.fn() },
  reviewerAssignment: { findMany: vi.fn() },
  overdueAlert: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
}));
vi.mock("../src/config/prisma.js", () => ({ prisma: db }));
import { app } from "../src/app.js";

const secret = "test-jwt-secret-that-is-long-enough-for-validation";
const officer = { id: "officer-1", role: UserRole.PROGRAM_OFFICER };
const reviewer = { id: "reviewer-1", role: UserRole.REVIEWER };
const auth = (user: typeof officer | typeof reviewer) => ({ Authorization: `Bearer ${jwt.sign({ userId: user.id, role: user.role }, secret)}` });
const past = new Date("2020-01-01T00:00:00.000Z");
const future = new Date("2099-01-01T00:00:00.000Z");
const appRecord = (overrides: Record<string, unknown> = {}) => ({ id: "application-1", archivedAt: null, status: ApplicationStatus.UNDER_REVIEW, ...overrides });
const alert = (overrides: Record<string, unknown> = {}) => ({ id: "alert-1", assignmentId: "assignment-1", dueAtSnapshot: past, dismissedAt: null, triggeredAt: past, createdAt: past, assignment: { id: "assignment-1", dueAt: past, removedAt: null, application: { id: "application-1", organizationName: "Example" }, reviewer: { id: reviewer.id, name: "Ava" }, review: { status: ReviewStatus.DRAFT } }, ...overrides });

describe("timeline and overdue alerts", () => {
  beforeEach(() => {
    for (const group of Object.values(db)) for (const fn of Object.values(group)) (fn as ReturnType<typeof vi.fn>).mockReset();
    db.application.findUnique.mockResolvedValue(appRecord());
    db.auditEvent.findMany.mockResolvedValue([{ id: "event-1", applicationId: "application-1", actorId: officer.id, eventType: "APPLICATION_STATUS_CHANGED", metadata: { from: "SUBMITTED", to: "ASSIGNED" }, createdAt: past, actor: { id: officer.id, name: "Maya", passwordHash: "never" } }]);
    db.auditEvent.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "comment-1", ...data, createdAt: past, actor: { id: officer.id, name: "Maya" } }));
    db.reviewerAssignment.findMany.mockResolvedValue([{ id: "assignment-1", dueAt: past }]);
    db.overdueAlert.create.mockResolvedValue({ id: "alert-1" });
    db.overdueAlert.findMany.mockResolvedValue([alert()]);
    db.overdueAlert.findUnique.mockResolvedValue(alert());
    db.overdueAlert.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...alert(), ...data }));
  });

  it("enforces Program Officer timeline access and returns ordered safe history", async () => {
    expect((await request(app).get("/applications/application-1/timeline")).status).toBe(401);
    expect((await request(app).get("/applications/application-1/timeline").set(auth(reviewer))).status).toBe(403);
    const response = await request(app).get("/applications/application-1/timeline").set(auth(officer));
    expect(response).toMatchObject({ status: 200, body: { events: [{ eventType: "APPLICATION_STATUS_CHANGED", metadata: { from: "SUBMITTED", to: "ASSIGNED" }, actor: { id: officer.id, name: "Maya" } }] } });
    expect(JSON.stringify(response.body)).not.toContain("passwordHash");
    expect(db.auditEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] }));
  });

  it("creates trimmed immutable comments and rejects invalid, reviewer, and archived writes", async () => {
    const unauthenticated = await request(app).post("/applications/application-1/comments").send({ comment: "No" });
    const created = await request(app).post("/applications/application-1/comments").set(auth(officer)).send({ comment: " Note " });
    const missing = await request(app).post("/applications/application-1/comments").set(auth(officer)).send({ comment: "  " });
    const denied = await request(app).post("/applications/application-1/comments").set(auth(reviewer)).send({ comment: "No" });
    db.application.findUnique.mockResolvedValueOnce(appRecord({ archivedAt: past }));
    const archived = await request(app).post("/applications/application-1/comments").set(auth(officer)).send({ comment: "No" });
    expect([unauthenticated.status, created.status, missing.status, denied.status, archived.status]).toEqual([401, 201, 400, 403, 409]);
    expect(db.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ actorId: officer.id, eventType: "APPLICATION_COMMENT_ADDED", metadata: { comment: "Note" } }) }));
    expect((await request(app).patch("/audit-events/event-1").set(auth(officer))).status).toBe(404);
  });

  it("allows informational comments on decided applications without changing their lifecycle", async () => {
    const decided = appRecord({ status: ApplicationStatus.DECIDED }); const events: Array<Record<string, unknown>> = [];
    db.application.findUnique.mockResolvedValue(decided);
    db.auditEvent.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => { const event = { id: "comment-1", ...data, createdAt: past, actor: { id: officer.id, name: "Maya", passwordHash: "never" } }; events.push(event); return event; });
    db.auditEvent.findMany.mockImplementation(async () => events);
    const created = await request(app).post("/applications/application-1/comments").set(auth(officer)).send({ comment: " Final note " });
    const timeline = await request(app).get("/applications/application-1/timeline").set(auth(officer));
    expect(created.status).toBe(201);
    expect(db.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ actorId: officer.id, metadata: { comment: "Final note" } }) }));
    expect(decided.status).toBe(ApplicationStatus.DECIDED);
    expect(timeline).toMatchObject({ status: 200, body: { events: [{ eventType: "APPLICATION_COMMENT_ADDED", metadata: { comment: "Final note" } }] } });
    expect(JSON.stringify(timeline.body)).not.toContain("passwordHash");
    expect(db.application.update).not.toHaveBeenCalled();
    expect(db.application.updateMany).not.toHaveBeenCalled();
  });

  it("blocks non-officers from alert list and count, and returns 404 for a missing dismissal", async () => {
    for (const path of ["/alerts/overdue", "/alerts/overdue/count"]) {
      expect((await request(app).get(path)).status).toBe(401);
      expect((await request(app).get(path).set(auth(reviewer))).status).toBe(403);
      expect((await request(app).get(path).set(auth(officer))).status).toBe(200);
    }
    db.overdueAlert.findUnique.mockResolvedValueOnce(null);
    expect((await request(app).post("/alerts/overdue/missing/dismiss").set(auth(officer))).status).toBe(404);
  });

  it("queries only active, incomplete assignments that are overdue", async () => {
    db.reviewerAssignment.findMany.mockResolvedValue([]);
    db.overdueAlert.findMany.mockResolvedValue([]);
    const response = await request(app).get("/alerts/overdue").set(auth(officer));
    expect(response).toMatchObject({ status: 200, body: { alerts: [] } });
    expect(db.reviewerAssignment.findMany).toHaveBeenCalledWith({
      where: {
        removedAt: null,
        dueAt: { lt: expect.any(Date) },
        OR: [
          { review: { is: null } },
          { review: { is: { status: { not: ReviewStatus.COMPLETED } } } },
        ],
      },
      select: { id: true, dueAt: true },
    });
    expect(db.overdueAlert.create).not.toHaveBeenCalled();
  });

  it("uses due-date snapshots as occurrence identity across dismissal and rescheduling", async () => {
    const d1 = new Date("2020-01-01T00:00:00.000Z");
    const d2 = new Date("2020-02-01T00:00:00.000Z");
    const stored: Array<ReturnType<typeof alert>> = []; let currentDueAt = d1;
    db.reviewerAssignment.findMany.mockImplementation(async ({ where }: { where: { dueAt: { lt: Date } } }) => currentDueAt < where.dueAt.lt ? [{ id: "assignment-1", dueAt: currentDueAt }] : []);
    db.overdueAlert.create.mockImplementation(async ({ data }: { data: { assignmentId: string; dueAtSnapshot: Date } }) => { if (stored.some((item) => item.assignmentId === data.assignmentId && item.dueAtSnapshot.getTime() === data.dueAtSnapshot.getTime())) throw new Prisma.PrismaClientKnownRequestError("duplicate", { code: "P2002", clientVersion: "test" }); const value = alert({ id: `alert-${stored.length + 1}`, assignmentId: data.assignmentId, dueAtSnapshot: data.dueAtSnapshot, assignment: { ...alert().assignment, dueAt: currentDueAt } }); stored.push(value); return value; });
    db.overdueAlert.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => stored.find((item) => item.id === where.id) ?? null);
    db.overdueAlert.update.mockImplementation(async ({ where, data }: { where: { id: string }; data: { dismissedAt: Date } }) => { const value = stored.find((item) => item.id === where.id)!; value.dismissedAt = data.dismissedAt; return value; });
    db.overdueAlert.findMany.mockImplementation(async () => stored.filter((item) => !item.dismissedAt && item.dueAtSnapshot.getTime() === currentDueAt.getTime()).map((item) => ({ ...item, assignment: { ...item.assignment, dueAt: currentDueAt } })));
    await request(app).get("/alerts/overdue").set(auth(officer));
    expect(db.overdueAlert.create).toHaveBeenLastCalledWith({ data: { assignmentId: "assignment-1", dueAtSnapshot: d1 } });
    const a1 = stored[0];
    expect(a1.dueAtSnapshot).toEqual(d1);
    await request(app).post("/alerts/overdue/alert-1/dismiss").set(auth(officer));
    expect(stored).toContain(a1);
    expect(a1.dismissedAt).not.toBeNull();

    await request(app).get("/alerts/overdue").set(auth(officer));
    expect(stored).toHaveLength(1);
    currentDueAt = future;
    const futureList = await request(app).get("/alerts/overdue").set(auth(officer));
    const futureCount = await request(app).get("/alerts/overdue/count").set(auth(officer));
    expect(stored.filter((item) => item.dueAtSnapshot.getTime() === d2.getTime())).toHaveLength(0);
    expect(futureList).toMatchObject({ body: { alerts: [] } });
    expect(futureCount).toMatchObject({ body: { count: 0 } });
    expect(stored).toContain(a1);
    expect(a1.dismissedAt).not.toBeNull();
    currentDueAt = d2;
    const overdueList = await request(app).get("/alerts/overdue").set(auth(officer));
    const overdueCount = await request(app).get("/alerts/overdue/count").set(auth(officer));
    expect(db.overdueAlert.create).toHaveBeenLastCalledWith({ data: { assignmentId: "assignment-1", dueAtSnapshot: d2 } });
    expect(stored).toHaveLength(2);
    const a2 = stored[1];
    expect(a2.id).not.toBe(a1.id);
    expect(a2.dueAtSnapshot).toEqual(d2);
    expect(a2.dismissedAt).toBeNull();
    expect(a1.dismissedAt).not.toBeNull();
    expect(stored.filter((item) => item.dueAtSnapshot.getTime() === d1.getTime())).toHaveLength(1);
    expect(stored.filter((item) => item.dueAtSnapshot.getTime() === d2.getTime())).toHaveLength(1);
    expect(overdueList).toMatchObject({ body: { alerts: [{ id: a2.id }] } });
    expect(overdueList.body.alerts).toHaveLength(1);
    expect(overdueList.body.alerts.map((item: { id: string }) => item.id)).not.toContain(a1.id);
    expect(overdueCount).toMatchObject({ body: { count: 1 } });
  });

  it("synchronizes one overdue occurrence, excludes dismissed/currently invalid alerts, and counts active alerts", async () => {
    const list = await request(app).get("/alerts/overdue").set(auth(officer));
    const count = await request(app).get("/alerts/overdue/count").set(auth(officer));
    expect(list).toMatchObject({ status: 200, body: { alerts: [{ application: { organizationName: "Example" }, reviewer: { name: "Ava" } }] } });
    expect(count).toMatchObject({ status: 200, body: { count: 1 } });
    expect(db.overdueAlert.create).toHaveBeenCalledWith({ data: { assignmentId: "assignment-1", dueAtSnapshot: past } });
    db.overdueAlert.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    expect(await request(app).get("/alerts/overdue").set(auth(officer))).toMatchObject({ body: { alerts: [] } });
    expect(await request(app).get("/alerts/overdue/count").set(auth(officer))).toMatchObject({ body: { count: 0 } });
  });

  it("keeps dismissed history, supports a later due-date occurrence, and handles the duplicate-create race", async () => {
    const dismissed = await request(app).post("/alerts/overdue/alert-1/dismiss").set(auth(officer));
    db.overdueAlert.findUnique.mockResolvedValueOnce(alert({ dismissedAt: past }));
    const repeated = await request(app).post("/alerts/overdue/alert-1/dismiss").set(auth(officer));
    const later = new Date("2020-02-01T00:00:00.000Z");
    db.reviewerAssignment.findMany.mockResolvedValueOnce([{ id: "assignment-1", dueAt: later }]);
    db.overdueAlert.create.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("duplicate", { code: "P2002", clientVersion: "test" }));
    const raced = await request(app).get("/alerts/overdue").set(auth(officer));
    expect([dismissed.status, repeated.status, raced.status]).toEqual([200, 200, 200]);
    expect(db.overdueAlert.update).toHaveBeenCalledTimes(1);
    expect(db.overdueAlert.create).toHaveBeenCalledWith({ data: { assignmentId: "assignment-1", dueAtSnapshot: later } });
  });

  it("does not treat unrelated alert creation failures as duplicate occurrences", async () => {
    db.overdueAlert.create.mockRejectedValueOnce(new Error("database unavailable"));
    const response = await request(app).get("/alerts/overdue").set(auth(officer));
    expect(response.status).toBe(500);
    expect(response.body.message).not.toContain("duplicate");
  });
});
