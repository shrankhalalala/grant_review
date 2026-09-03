import { ApplicationStatus, Prisma, UserRole } from "@prisma/client";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  fundingRound: { findUnique: vi.fn() },
  application: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  auditEvent: { create: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("../src/config/prisma.js", () => ({ prisma: prismaMock }));

import { app } from "../src/app.js";

const jwtSecret = "test-jwt-secret-that-is-long-enough-for-validation";
const officer = { id: "officer-1", name: "Maya Patel", email: "maya.officer@example.test", role: UserRole.PROGRAM_OFFICER };
const reviewer = { id: "reviewer-1", name: "Ava Wilson", email: "ava.reviewer@example.test", role: UserRole.REVIEWER };
const fundingRound = { id: "round-2026-spring", name: "Spring 2026 Community Grants", opensAt: new Date("2026-01-01"), closesAt: new Date("2026-03-31") };

function tokenFor(user: typeof officer | typeof reviewer) {
  return jwt.sign({ userId: user.id, role: user.role }, jwtSecret, { expiresIn: "1h" });
}

function input(overrides: Record<string, unknown> = {}) {
  return {
    organizationName: "Example Foundation",
    contactEmail: "contact@example.org",
    fundingRoundId: fundingRound.id,
    requestedAmount: "1000.01",
    submittedAt: "2026-09-03T00:00:00.000Z",
    ...overrides,
  };
}

function application(overrides: Record<string, unknown> = {}) {
  return {
    id: "application-1",
    organizationName: "Example Foundation",
    contactEmail: "contact@example.org",
    requestedAmount: new Prisma.Decimal("1000.01"),
    submittedAt: new Date("2026-09-03T00:00:00.000Z"),
    status: ApplicationStatus.SUBMITTED,
    archivedAt: null,
    ownerId: officer.id,
    fundingRoundId: fundingRound.id,
    createdAt: new Date("2026-09-03T00:00:00.000Z"),
    updatedAt: new Date("2026-09-03T00:00:00.000Z"),
    fundingRound,
    owner: officer,
    ...overrides,
  };
}

describe("application routes", () => {
  beforeEach(() => {
    prismaMock.fundingRound.findUnique.mockReset();
    prismaMock.application.create.mockReset();
    prismaMock.application.findMany.mockReset();
    prismaMock.application.findUnique.mockReset();
    prismaMock.application.update.mockReset();
    prismaMock.auditEvent.create.mockReset();
    prismaMock.$transaction.mockReset();

    prismaMock.fundingRound.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
      where.id === fundingRound.id ? fundingRound : null);
    prismaMock.application.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
      where.id === "missing" ? null : application());
    prismaMock.application.findMany.mockResolvedValue([application()]);
    prismaMock.application.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => application({
      ...data,
      requestedAmount: data.requestedAmount,
      fundingRound,
      owner: officer,
    }));
    prismaMock.application.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => application(data));
    prismaMock.$transaction.mockImplementation(async (callback: (transaction: typeof prismaMock) => unknown) => callback(prismaMock));
  });

  it("rejects unauthenticated and Reviewer creation", async () => {
    const unauthenticated = await request(app).post("/applications").send(input());
    const reviewerResponse = await request(app).post("/applications")
      .set("Authorization", `Bearer ${tokenFor(reviewer)}`).send(input());

    expect(unauthenticated.status).toBe(401);
    expect(reviewerResponse.status).toBe(403);
  });

  it("creates a submitted application owned by the authenticated Program Officer with an exact decimal", async () => {
    const response = await request(app).post("/applications")
      .set("Authorization", `Bearer ${tokenFor(officer)}`)
      .send(input({ ownerId: "officer-2", status: "DECIDED", requestedAmount: "1000.01" }));

    expect(response.status).toBe(201);
    expect(response.body.application).toMatchObject({ ownerId: officer.id, status: "SUBMITTED", requestedAmount: "1000.01" });
    expect(prismaMock.application.create.mock.calls[0][0].data.ownerId).toBe(officer.id);
    expect(prismaMock.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ eventType: "APPLICATION_CREATED" }) }));
  });

  it("rejects missing fields, invalid email, invalid decimal amounts, and an unknown funding round", async () => {
    const authorization = { Authorization: `Bearer ${tokenFor(officer)}` };
    const missing = await request(app).post("/applications").set(authorization).send(input({ organizationName: "" }));
    const invalidEmail = await request(app).post("/applications").set(authorization).send(input({ contactEmail: "invalid" }));
    const invalidAmount = await request(app).post("/applications").set(authorization).send(input({ requestedAmount: "1.001" }));
    const unknownRound = await request(app).post("/applications").set(authorization).send(input({ fundingRoundId: "missing" }));

    expect(missing.status).toBe(400);
    expect(invalidEmail.status).toBe(400);
    expect(invalidAmount.status).toBe(400);
    expect(unknownRound.status).toBe(404);
  });

  it("lists applications with decimal strings and deterministic ordering", async () => {
    const response = await request(app).get("/applications").set("Authorization", `Bearer ${tokenFor(officer)}`);

    expect(response.status).toBe(200);
    expect(response.body.applications[0].requestedAmount).toBe("1000.01");
    expect(prismaMock.application.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }] }));
  });

  it("returns application detail and a 404 for an unknown application", async () => {
    const found = await request(app).get("/applications/application-1").set("Authorization", `Bearer ${tokenFor(officer)}`);
    const missing = await request(app).get("/applications/missing").set("Authorization", `Bearer ${tokenFor(officer)}`);

    expect(found).toMatchObject({ status: 200, body: { application: { id: "application-1", requestedAmount: "1000.01" } } });
    expect(missing.status).toBe(404);
  });

  it("projects completed reviews only with safe reviewer data and exact amounts", async () => {
    const completedAt = new Date("2026-10-01T00:00:00.000Z");
    prismaMock.application.findUnique.mockResolvedValue(application({ reviews: [{ id: "review-completed", impactScore: 5, feasibilityScore: 4, budgetJustificationScore: 3, comments: "Completed comments", completedAt, reviewer: { id: reviewer.id, name: "Ava Wilson" } }] }));
    const response = await request(app).get("/applications/application-1").set("Authorization", `Bearer ${tokenFor(officer)}`);
    expect(response.status).toBe(200);
    expect(response.body.application).toMatchObject({ id: "application-1", requestedAmount: "1000.01" });
    expect(response.body.application.reviews[0]).toMatchObject({ id: "review-completed", comments: "Completed comments", reviewer: { name: "Ava Wilson" } });
    expect(response.body.application.reviews).not.toContainEqual(expect.objectContaining({ comments: "Draft-only content" }));
    expect(JSON.stringify(response.body)).not.toContain("passwordHash");
    expect(prismaMock.application.findUnique).toHaveBeenCalledWith(expect.objectContaining({ include: expect.objectContaining({ reviews: expect.objectContaining({ where: { status: "COMPLETED" } }) }) }));
  });

  it("updates only editable fields and records the update", async () => {
    const response = await request(app).patch("/applications/application-1")
      .set("Authorization", `Bearer ${tokenFor(officer)}`)
      .send({ organizationName: "Updated Foundation", requestedAmount: "9999999999.99" });

    expect(response.status).toBe(200);
    expect(response.body.application).toMatchObject({ organizationName: "Updated Foundation", requestedAmount: "9999999999.99" });
    expect(prismaMock.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        eventType: "APPLICATION_UPDATED",
        metadata: {
          changes: {
            organizationName: { from: "Example Foundation", to: "Updated Foundation" },
            requestedAmount: { from: "1000.01", to: "9999999999.99" },
          },
        },
      }),
    }));
  });

  it("rejects direct status, owner, and archive-state changes", async () => {
    const authorization = { Authorization: `Bearer ${tokenFor(officer)}` };
    const status = await request(app).patch("/applications/application-1").set(authorization).send({ status: "DECIDED" });
    const owner = await request(app).patch("/applications/application-1").set(authorization).send({ ownerId: "officer-2" });
    const archive = await request(app).patch("/applications/application-1").set(authorization).send({ archivedAt: new Date().toISOString() });

    expect(status.status).toBe(400);
    expect(owner.status).toBe(400);
    expect(archive.status).toBe(400);
  });

  it("archives and restores without changing lifecycle status, retaining audit history", async () => {
    prismaMock.application.findUnique
      .mockResolvedValueOnce(application({ archivedAt: null, status: ApplicationStatus.UNDER_REVIEW }))
      .mockResolvedValueOnce(application({ archivedAt: new Date(), status: ApplicationStatus.UNDER_REVIEW }));
    prismaMock.application.update
      .mockResolvedValueOnce(application({ archivedAt: new Date(), status: ApplicationStatus.UNDER_REVIEW }))
      .mockResolvedValueOnce(application({ archivedAt: null, status: ApplicationStatus.UNDER_REVIEW }));

    const archive = await request(app).post("/applications/application-1/archive").set("Authorization", `Bearer ${tokenFor(officer)}`);
    const restore = await request(app).post("/applications/application-1/restore").set("Authorization", `Bearer ${tokenFor(officer)}`);

    expect(archive.body.application).toMatchObject({ status: "UNDER_REVIEW" });
    expect(archive.body.application.archivedAt).not.toBeNull();
    expect(restore.body.application).toMatchObject({ status: "UNDER_REVIEW", archivedAt: null });
    expect(prismaMock.auditEvent.create).toHaveBeenCalledTimes(2);
  });

  it("keeps archive and restore idempotent and rejects Reviewer mutation", async () => {
    prismaMock.application.findUnique.mockResolvedValue(application({ archivedAt: new Date() }));
    const archivedAgain = await request(app).post("/applications/application-1/archive").set("Authorization", `Bearer ${tokenFor(officer)}`);
    const reviewerMutation = await request(app).patch("/applications/application-1")
      .set("Authorization", `Bearer ${tokenFor(reviewer)}`).send({ organizationName: "No access" });

    expect(archivedAgain.status).toBe(200);
    expect(prismaMock.application.update).not.toHaveBeenCalled();
    expect(reviewerMutation.status).toBe(403);
  });

  it("keeps an archived application retrievable", async () => {
    const archived = application({ archivedAt: new Date("2026-09-04T00:00:00.000Z") });
    prismaMock.application.findUnique.mockResolvedValueOnce(application()).mockResolvedValueOnce(archived);
    prismaMock.application.update.mockResolvedValueOnce(archived);

    const archivedResponse = await request(app).post("/applications/application-1/archive")
      .set("Authorization", `Bearer ${tokenFor(officer)}`);
    const detailResponse = await request(app).get("/applications/application-1")
      .set("Authorization", `Bearer ${tokenFor(officer)}`);

    expect(archivedResponse.status).toBe(200);
    expect(detailResponse).toMatchObject({ status: 200, body: { application: { id: "application-1", archivedAt: "2026-09-04T00:00:00.000Z" } } });
  });

  it("rejects Reviewer archive and restore requests", async () => {
    const archiveResponse = await request(app).post("/applications/application-1/archive")
      .set("Authorization", `Bearer ${tokenFor(reviewer)}`);
    const restoreResponse = await request(app).post("/applications/application-1/restore")
      .set("Authorization", `Bearer ${tokenFor(reviewer)}`);

    expect(archiveResponse.status).toBe(403);
    expect(restoreResponse.status).toBe(403);
  });
});
