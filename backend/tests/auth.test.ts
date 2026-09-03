import { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
  },
}));

vi.mock("../src/config/prisma.js", () => ({ prisma: prismaMock }));

import { app } from "../src/app.js";
import { authenticate } from "../src/middleware/authenticate.js";
import { errorHandler } from "../src/middleware/errorHandler.js";
import { requireRole } from "../src/middleware/requireRole.js";

const testJwtSecret = "test-jwt-secret-that-is-long-enough-for-validation";
const password = "Demo123!";
const officer = {
  id: "officer-1",
  name: "Maya Patel",
  email: "maya.officer@example.test",
  role: UserRole.PROGRAM_OFFICER,
};
const reviewer = {
  id: "reviewer-1",
  name: "Ava Wilson",
  email: "ava.reviewer@example.test",
  role: UserRole.REVIEWER,
};

function tokenFor(user: typeof officer | typeof reviewer): string {
  return jwt.sign({ userId: user.id, role: user.role }, testJwtSecret, { expiresIn: "1h" });
}

function authorizationApp(...roles: UserRole[]) {
  const testApp = express();
  testApp.get("/protected", authenticate, requireRole(...roles), (_request, response) => {
    response.status(200).json({ status: "ok" });
  });
  testApp.use(errorHandler);
  return testApp;
}

describe("authentication routes", () => {
  beforeEach(async () => {
    const passwordHash = await bcrypt.hash(password, 4);
    prismaMock.user.findUnique.mockReset();
    prismaMock.user.findUnique.mockImplementation(async ({ where }: { where: { email?: string; id?: string } }) => {
      if (where.email === officer.email || where.id === officer.id) {
        return { ...officer, passwordHash };
      }

      if (where.email === reviewer.email || where.id === reviewer.id) {
        return { ...reviewer, passwordHash };
      }

      return null;
    });
  });

  it("logs in a Program Officer without exposing the password hash", async () => {
    const response = await request(app)
      .post("/auth/login")
      .send({ email: officer.email, password });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ user: officer });
    expect(response.body.token).toEqual(expect.any(String));
    expect(response.body).not.toHaveProperty("user.passwordHash");
  });

  it("logs in a Reviewer", async () => {
    const response = await request(app)
      .post("/auth/login")
      .send({ email: reviewer.email, password });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ user: reviewer });
  });

  it("returns a generic 401 for an incorrect password or unknown email", async () => {
    const incorrectPassword = await request(app)
      .post("/auth/login")
      .send({ email: officer.email, password: "wrong-password" });
    const unknownEmail = await request(app)
      .post("/auth/login")
      .send({ email: "unknown@example.test", password });

    expect(incorrectPassword).toMatchObject({ status: 401, body: { message: "Invalid email or password." } });
    expect(unknownEmail).toMatchObject({ status: 401, body: { message: "Invalid email or password." } });
  });

  it("rejects missing or malformed login fields", async () => {
    const missingPassword = await request(app).post("/auth/login").send({ email: officer.email });
    const malformedEmail = await request(app).post("/auth/login").send({ email: "not-an-email", password });

    expect(missingPassword.status).toBe(400);
    expect(malformedEmail.status).toBe(400);
  });

  it("rejects a login request with a missing email", async () => {
    const response = await request(app).post("/auth/login").send({ password });

    expect(response.status).toBe(400);
  });

  it("returns a safe JSON 400 response for malformed JSON", async () => {
    const response = await request(app)
      .post("/auth/login")
      .set("Content-Type", "application/json")
      .send('{"email":');

    expect(response.status).toBe(400);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(response.body).toEqual({ status: 400, message: "Invalid request." });
  });

  it("returns the current safe user profile for a valid token", async () => {
    const response = await request(app)
      .get("/auth/me")
      .set("Authorization", `Bearer ${tokenFor(officer)}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ user: officer });
    expect(response.body).not.toHaveProperty("user.passwordHash");
  });

  it("rejects missing, malformed, and invalid authorization headers", async () => {
    const missing = await request(app).get("/auth/me");
    const malformed = await request(app).get("/auth/me").set("Authorization", "Token value");
    const invalid = await request(app).get("/auth/me").set("Authorization", "Bearer invalid-token");

    expect(missing.status).toBe(401);
    expect(malformed.status).toBe(401);
    expect(invalid.status).toBe(401);
  });

  it("rejects a correctly signed expired JWT", async () => {
    const expiredToken = jwt.sign(
      { userId: officer.id, role: officer.role },
      testJwtSecret,
      { expiresIn: -1 },
    );
    const response = await request(app)
      .get("/auth/me")
      .set("Authorization", `Bearer ${expiredToken}`);

    expect(response.status).toBe(401);
  });
});

describe("role authorization middleware", () => {
  it("allows a Program Officer on a Program Officer-only route", async () => {
    const response = await request(authorizationApp(UserRole.PROGRAM_OFFICER))
      .get("/protected")
      .set("Authorization", `Bearer ${tokenFor(officer)}`);

    expect(response.status).toBe(200);
  });

  it("rejects a Reviewer from a Program Officer-only route", async () => {
    const response = await request(authorizationApp(UserRole.PROGRAM_OFFICER))
      .get("/protected")
      .set("Authorization", `Bearer ${tokenFor(reviewer)}`);

    expect(response.status).toBe(403);
  });

  it("allows a Reviewer on a Reviewer-only route", async () => {
    const response = await request(authorizationApp(UserRole.REVIEWER))
      .get("/protected")
      .set("Authorization", `Bearer ${tokenFor(reviewer)}`);

    expect(response.status).toBe(200);
  });

  it("rejects a Program Officer from a Reviewer-only route", async () => {
    const response = await request(authorizationApp(UserRole.REVIEWER))
      .get("/protected")
      .set("Authorization", `Bearer ${tokenFor(officer)}`);

    expect(response.status).toBe(403);
  });

  it("allows either role when both roles are permitted", async () => {
    const roleApp = authorizationApp(UserRole.PROGRAM_OFFICER, UserRole.REVIEWER);
    const officerResponse = await request(roleApp)
      .get("/protected")
      .set("Authorization", `Bearer ${tokenFor(officer)}`);
    const reviewerResponse = await request(roleApp)
      .get("/protected")
      .set("Authorization", `Bearer ${tokenFor(reviewer)}`);

    expect(officerResponse.status).toBe(200);
    expect(reviewerResponse.status).toBe(200);
  });
});
