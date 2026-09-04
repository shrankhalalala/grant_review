import { UserRole } from "@prisma/client";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({ fundingRound: { findMany: vi.fn() } }));

vi.mock("../src/config/prisma.js", () => ({ prisma: prismaMock }));

import { app } from "../src/app.js";

const secret = "test-jwt-secret-that-is-long-enough-for-validation";
const officer = { id: "officer-1", role: UserRole.PROGRAM_OFFICER };
const reviewer = { id: "reviewer-1", role: UserRole.REVIEWER };
const tokenFor = (user: typeof officer | typeof reviewer) => jwt.sign({ userId: user.id, role: user.role }, secret);
const rounds = [
  { id: "round-3", name: "Winter", opensAt: new Date("2026-12-01T00:00:00.000Z"), closesAt: new Date("2027-02-28T00:00:00.000Z") },
  { id: "round-2", name: "Autumn", opensAt: new Date("2026-09-01T00:00:00.000Z"), closesAt: new Date("2026-11-30T00:00:00.000Z") },
  { id: "round-1", name: "Autumn", opensAt: new Date("2026-01-01T00:00:00.000Z"), closesAt: new Date("2026-03-31T00:00:00.000Z") },
  { id: "round-4", name: "Spring", opensAt: new Date("2027-03-01T00:00:00.000Z"), closesAt: new Date("2027-05-31T00:00:00.000Z") },
];
const orderedRounds = [rounds[2], rounds[1], rounds[3], rounds[0]];

describe("funding round discovery", () => {
  beforeEach(() => {
    prismaMock.fundingRound.findMany.mockReset();
    prismaMock.fundingRound.findMany.mockImplementation(async ({ orderBy }) => {
      if (JSON.stringify(orderBy) === JSON.stringify([{ name: "asc" }, { id: "asc" }])) {
        return orderedRounds;
      }

      return rounds;
    });
  });

  it("returns only safe, deterministically ordered funding rounds to Program Officers", async () => {
    const response = await request(app).get("/funding-rounds").set("Authorization", `Bearer ${tokenFor(officer)}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ fundingRounds: orderedRounds.map((round) => ({ ...round, opensAt: round.opensAt.toISOString(), closesAt: round.closesAt.toISOString() })) });
    expect(Object.keys(response.body.fundingRounds[0]).sort()).toEqual(["closesAt", "id", "name", "opensAt"]);
    expect(JSON.stringify(response.body)).not.toContain("passwordHash");
    expect(prismaMock.fundingRound.findMany).toHaveBeenCalledWith({
      select: { id: true, name: true, opensAt: true, closesAt: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
  });

  it("requires an authenticated Program Officer", async () => {
    expect((await request(app).get("/funding-rounds")).status).toBe(401);
    expect((await request(app).get("/funding-rounds").set("Authorization", `Bearer ${tokenFor(reviewer)}`)).status).toBe(403);
  });
});
