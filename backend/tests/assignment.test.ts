import { ApplicationStatus, Prisma, ReviewStatus, UserRole } from "@prisma/client";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  application: { findUnique: vi.fn(), update: vi.fn() },
  reviewerAssignment: { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn() },
  conflictOfInterest: { findFirst: vi.fn() },
  auditEvent: { create: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("../src/config/prisma.js", () => ({ prisma: db }));

import { app } from "../src/app.js";

const secret = "test-jwt-secret-that-is-long-enough-for-validation";
const officer = { id: "officer-1", role: UserRole.PROGRAM_OFFICER };
const reviewer = { id: "reviewer-1", role: UserRole.REVIEWER };
const assignmentPath = "/applications/application-1/assignments";
const token = (user: typeof officer | typeof reviewer) => jwt.sign({ userId: user.id, role: user.role }, secret, { expiresIn: "1h" });
const headers = { Authorization: `Bearer ${token(officer)}` };
const input = { reviewerId: reviewer.id, dueAt: "2026-10-01T00:00:00.000Z" };

function application(overrides: Record<string, unknown> = {}) {
  return {
    id: "application-1", organizationName: "Example", contactEmail: "contact@example.org",
    requestedAmount: new Prisma.Decimal("1000.01"), submittedAt: new Date(), status: ApplicationStatus.SUBMITTED,
    archivedAt: null, ownerId: officer.id, fundingRoundId: "round-1", createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  };
}

function assignment(overrides: Record<string, unknown> = {}) {
  return {
    id: "assignment-1", applicationId: "application-1", reviewerId: reviewer.id,
    activeAssignmentKey: "application-1:reviewer-1", dueAt: new Date(input.dueAt), assignedAt: new Date(),
    completedAt: null, removedAt: null, createdAt: new Date(), updatedAt: new Date(),
    reviewer: { ...reviewer, name: "Ava", email: "ava@example.test" },
    application: { ...application(), fundingRound: { id: "round-1", name: "Round" } }, review: null,
    ...overrides,
  };
}

describe("reviewer assignments", () => {
  beforeEach(() => {
    for (const group of Object.values(db)) {
      if (group && typeof group === "object") {
        for (const fn of Object.values(group as object)) {
          if (typeof fn === "function") (fn as ReturnType<typeof vi.fn>).mockReset();
        }
      }
    }
    db.application.findUnique.mockResolvedValue(application());
    db.application.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => application(data));
    db.user.findUnique.mockResolvedValue({ ...reviewer, name: "Ava", email: "ava@example.test" });
    db.reviewerAssignment.findFirst.mockResolvedValue(null);
    db.conflictOfInterest.findFirst.mockResolvedValue(null);
    db.reviewerAssignment.count.mockResolvedValue(0);
    db.reviewerAssignment.findUnique.mockResolvedValue(assignment());
    db.reviewerAssignment.findMany.mockResolvedValue([assignment()]);
    db.reviewerAssignment.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => assignment({
      applicationId: data.applicationId, reviewerId: data.reviewerId, dueAt: data.dueAt, activeAssignmentKey: data.activeAssignmentKey,
    }));
    db.reviewerAssignment.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => assignment(data));
    db.$transaction.mockImplementation(async (callback: (transaction: typeof db) => unknown) => callback(db));
  });

  it("requires a Program Officer to manage assignments", async () => {
    expect((await request(app).post(assignmentPath).send(input)).status).toBe(401);
    expect((await request(app).post(assignmentPath).set("Authorization", `Bearer ${token(reviewer)}`).send(input)).status).toBe(403);
  });

  it("creates a related assignment, persists its due date, and audits the transition", async () => {
    const response = await request(app).post(assignmentPath).set(headers).send(input);

    expect(response).toMatchObject({ status: 201, body: { assignment: { applicationId: "application-1", reviewerId: reviewer.id, dueAt: input.dueAt } } });
    expect(db.application.update).toHaveBeenCalledWith({ where: { id: "application-1" }, data: { status: ApplicationStatus.ASSIGNED } });
    expect(db.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ eventType: "APPLICATION_STATUS_CHANGED", metadata: expect.objectContaining({ from: "SUBMITTED", to: "ASSIGNED" }) }) }));
    expect(db.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ eventType: "ASSIGNMENT_CREATED" }) }));
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });

  it("keeps ASSIGNED and UNDER_REVIEW applications unchanged", async () => {
    for (const status of [ApplicationStatus.ASSIGNED, ApplicationStatus.UNDER_REVIEW]) {
      db.application.findUnique.mockResolvedValueOnce(application({ status }));
      const response = await request(app).post(assignmentPath).set(headers).send(input);
      expect(response.status).toBe(201);
    }

    expect(db.application.update).not.toHaveBeenCalled();
    expect(db.auditEvent.create).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ eventType: "APPLICATION_STATUS_CHANGED" }) }));
  });

  it("rejects invalid reviewers, missing applications, and unavailable application states", async () => {
    db.user.findUnique.mockResolvedValueOnce({ ...officer, name: "Maya", email: "maya@example.test" });
    const officerTarget = await request(app).post(assignmentPath).set(headers).send({ ...input, reviewerId: officer.id });
    db.user.findUnique.mockResolvedValueOnce(null);
    const missingReviewer = await request(app).post(assignmentPath).set(headers).send(input);
    db.application.findUnique.mockResolvedValueOnce(null);
    const missingApplication = await request(app).post("/applications/missing/assignments").set(headers).send(input);
    db.application.findUnique.mockResolvedValueOnce(application({ archivedAt: new Date() }));
    const archived = await request(app).post(assignmentPath).set(headers).send(input);
    db.application.findUnique.mockResolvedValueOnce(application({ status: ApplicationStatus.DECIDED }));
    const decided = await request(app).post(assignmentPath).set(headers).send(input);

    expect([officerTarget.status, missingReviewer.status, missingApplication.status]).toEqual([404, 404, 404]);
    expect([archived.status, decided.status]).toEqual([409, 409]);
  });

  it("blocks duplicates, conflicts, and workload overflow", async () => {
    db.reviewerAssignment.findFirst.mockResolvedValueOnce({ id: "existing" });
    const duplicate = await request(app).post(assignmentPath).set(headers).send(input);
    db.conflictOfInterest.findFirst.mockResolvedValueOnce({ id: "conflict" });
    const conflict = await request(app).post(assignmentPath).set(headers).send(input);
    db.reviewerAssignment.count.mockResolvedValueOnce(5);
    const full = await request(app).post(assignmentPath).set(headers).send(input);

    expect([duplicate.status, conflict.status, full.status]).toEqual([409, 409, 409]);
  });

  it("counts only active assignments, excluding removed assignment history", async () => {
    const response = await request(app).post(assignmentPath).set(headers).send(input);

    expect(response.status).toBe(201);
    expect(db.reviewerAssignment.count).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ reviewerId: reviewer.id, removedAt: null }) }));
  });

  it("allows Program Officers to list application assignments but not Reviewers", async () => {
    const allowed = await request(app).get(assignmentPath).set(headers);
    const denied = await request(app).get(assignmentPath).set("Authorization", `Bearer ${token(reviewer)}`);

    expect(allowed).toMatchObject({ status: 200, body: { assignments: [expect.objectContaining({ id: "assignment-1" })] } });
    expect(denied.status).toBe(403);
  });

  it("lists only the authenticated Reviewer's assignments, including visible removal history", async () => {
    const removedAt = new Date("2026-10-02T00:00:00.000Z");
    db.reviewerAssignment.findMany.mockResolvedValue([assignment({ removedAt })]);

    const response = await request(app).get("/reviewer/assignments").set("Authorization", `Bearer ${token(reviewer)}`);

    expect(response).toMatchObject({ status: 200, body: { assignments: [expect.objectContaining({ reviewerId: reviewer.id, removedAt: removedAt.toISOString() })] } });
    expect(response.body.assignments[0].application.requestedAmount).toBe("1000.01");
    expect(db.reviewerAssignment.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { reviewerId: reviewer.id } }));
  });

  it("allows Program Officers to update due dates and records the before and after values", async () => {
    const dueAt = "2026-10-02T00:00:00.000Z";
    const response = await request(app).patch("/assignments/assignment-1").set(headers).send({ dueAt });

    expect(response).toMatchObject({ status: 200, body: { assignment: { dueAt } } });
    expect(db.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ eventType: "ASSIGNMENT_DUE_DATE_CHANGED", metadata: expect.objectContaining({ changes: { dueAt: { from: input.dueAt, to: dueAt } } }) }) }));
  });

  it("prevents Reviewers, removed assignments, and completed reviews from changing due dates", async () => {
    const reviewerDenied = await request(app).patch("/assignments/assignment-1").set("Authorization", `Bearer ${token(reviewer)}`).send({ dueAt: "2026-10-02T00:00:00.000Z" });
    db.reviewerAssignment.findUnique.mockResolvedValueOnce(assignment({ removedAt: new Date() }));
    const removed = await request(app).patch("/assignments/assignment-1").set(headers).send({ dueAt: "2026-10-02T00:00:00.000Z" });
    db.reviewerAssignment.findUnique.mockResolvedValueOnce(assignment({ review: { status: ReviewStatus.COMPLETED } }));
    const completed = await request(app).patch("/assignments/assignment-1").set(headers).send({ dueAt: "2026-10-02T00:00:00.000Z" });

    expect([reviewerDenied.status, removed.status, completed.status]).toEqual([403, 409, 409]);
  });

  it("soft-removes assignments, preserves rows, audits removal, and keeps Reviewer routes read-only", async () => {
    const response = await request(app).delete("/assignments/assignment-1").set(headers);
    const reviewerDenied = await request(app).delete("/assignments/assignment-1").set("Authorization", `Bearer ${token(reviewer)}`);

    expect(response.status).toBe(200);
    expect(db.reviewerAssignment.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ activeAssignmentKey: null, removedAt: expect.any(Date) }) }));
    expect(db.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ eventType: "ASSIGNMENT_REMOVED" }) }));
    expect(db.reviewerAssignment).not.toHaveProperty("delete");
    expect(reviewerDenied.status).toBe(403);
  });

  it("blocks removal after review completion and permits reassignment after soft removal", async () => {
    db.reviewerAssignment.findUnique.mockResolvedValueOnce(assignment({ review: { status: ReviewStatus.COMPLETED } }));
    const completed = await request(app).delete("/assignments/assignment-1").set(headers);
    db.reviewerAssignment.findFirst.mockResolvedValueOnce(null);
    const reassigned = await request(app).post(assignmentPath).set(headers).send(input);

    expect(completed.status).toBe(409);
    expect(reassigned).toMatchObject({ status: 201, body: { assignment: { activeAssignmentKey: "application-1:reviewer-1" } } });
  });
});
