import { ReviewStatus } from "@prisma/client";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ review: { findMany: vi.fn() } }));
vi.mock("../src/config/prisma.js", () => ({ prisma: db }));

import { getReviewerCalibration } from "../src/services/calibration.service.js";
import { app } from "../src/app.js";

const secret = "test-jwt-secret-that-is-long-enough-for-validation";
const officer = { id: "officer-1", role: "PROGRAM_OFFICER" as const };
const reviewer = { id: "reviewer-1", role: "REVIEWER" as const };
const tokenFor = (user: typeof officer | typeof reviewer) => jwt.sign({ userId: user.id, role: user.role }, secret);

function completedReviews(reviewerId: string, reviewerName: string, totalScore: number) {
  let remainingAdjustment = totalScore - 900;
  return Array.from({ length: 100 }, () => {
    const scores = [3, 3, 3];
    for (let index = 0; index < scores.length && remainingAdjustment > 0; index += 1) {
      const adjustment = Math.min(2, remainingAdjustment);
      scores[index] += adjustment;
      remainingAdjustment -= adjustment;
    }
    return {
      impactScore: scores[0], feasibilityScore: scores[1], budgetJustificationScore: scores[2],
      reviewer: { id: reviewerId, name: reviewerName, email: `${reviewerId}@example.test` },
    };
  });
}

describe("reviewer calibration", () => {
  beforeEach(() => db.review.findMany.mockReset());

  it("uses only completed review data, calculates benchmarks, and returns safe reviewer fields", async () => {
    db.review.findMany.mockResolvedValue([
      { impactScore: 2, feasibilityScore: 2, budgetJustificationScore: 2, reviewer: { id: "strict", name: "Ava", email: "ava@example.test" } },
      { impactScore: 2, feasibilityScore: 2, budgetJustificationScore: 2, reviewer: { id: "strict", name: "Ava", email: "ava@example.test" } },
      { impactScore: 2, feasibilityScore: 2, budgetJustificationScore: 2, reviewer: { id: "strict", name: "Ava", email: "ava@example.test" } },
      { impactScore: 5, feasibilityScore: 5, budgetJustificationScore: 5, reviewer: { id: "lenient", name: "Ben", email: "ben@example.test" } },
      { impactScore: 5, feasibilityScore: 5, budgetJustificationScore: 5, reviewer: { id: "lenient", name: "Ben", email: "ben@example.test" } },
      { impactScore: 5, feasibilityScore: 5, budgetJustificationScore: 5, reviewer: { id: "lenient", name: "Ben", email: "ben@example.test" } },
      { impactScore: 3, feasibilityScore: 3, budgetJustificationScore: 3, reviewer: { id: "limited", name: "Cy", email: "cy@example.test" } },
    ]);

    const result = await getReviewerCalibration("round-1");

    expect(db.review.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: ReviewStatus.COMPLETED, application: { is: { fundingRoundId: "round-1" } } } }));
    expect(result.globalOverallAverage).toBe(3.43);
    expect(result.reviewers).toEqual(expect.arrayContaining([
      expect.objectContaining({ reviewerId: "strict", averageImpact: 2, overallAverage: 2, overallDifference: -1.43, tendency: "More stringent" }),
      expect.objectContaining({ reviewerId: "lenient", averageFeasibility: 5, overallAverage: 5, overallDifference: 1.57, tendency: "More lenient" }),
      expect.objectContaining({ reviewerId: "limited", completedReviewCount: 1, tendency: "Limited data" }),
    ]));
    expect(JSON.stringify(result)).not.toContain("passwordHash");
  });

  it("returns a valid empty report", async () => {
    db.review.findMany.mockResolvedValue([]);
    await expect(getReviewerCalibration()).resolves.toEqual({ globalOverallAverage: 0, reviewers: [] });
    expect(db.review.findMany).toHaveBeenCalledWith({ where: { status: ReviewStatus.COMPLETED }, select: expect.any(Object) });
  });

  it("applies the exact tendency boundaries after the limited-data threshold", async () => {
    db.review.findMany.mockResolvedValue([
      ...completedReviews("strict-boundary", "Ava", 900),
      ...completedReviews("strict-near", "Bea", 903),
      ...completedReviews("average", "Cy", 1050),
      ...completedReviews("lenient-near", "Dee", 1197),
      ...completedReviews("lenient-boundary", "Eli", 1200),
      { impactScore: 1, feasibilityScore: 1, budgetJustificationScore: 1, reviewer: { id: "limited", name: "Fox", email: "fox@example.test" } },
    ]);

    const result = await getReviewerCalibration();
    const byId = Object.fromEntries(result.reviewers.map((entry) => [entry.reviewerId, entry]));

    expect(byId["strict-boundary"]).toMatchObject({ overallDifference: -0.5, tendency: "More stringent" });
    expect(byId["strict-near"]).toMatchObject({ overallDifference: -0.49, tendency: "Around average" });
    expect(byId.average).toMatchObject({ overallDifference: 0, tendency: "Around average" });
    expect(byId["lenient-near"]).toMatchObject({ overallDifference: 0.49, tendency: "Around average" });
    expect(byId["lenient-boundary"]).toMatchObject({ overallDifference: 0.5, tendency: "More lenient" });
    expect(byId.limited).toMatchObject({ completedReviewCount: 1, tendency: "Limited data" });
  });

  it("allows only Program Officers to retrieve calibration reports", async () => {
    db.review.findMany.mockResolvedValue([]);

    const unauthenticated = await request(app).get("/reviewers/calibration");
    const forbidden = await request(app).get("/reviewers/calibration").set("Authorization", `Bearer ${tokenFor(reviewer)}`);
    const allowed = await request(app).get("/reviewers/calibration").set("Authorization", `Bearer ${tokenFor(officer)}`);

    expect(unauthenticated.status).toBe(401);
    expect(forbidden.status).toBe(403);
    expect(allowed).toMatchObject({ status: 200, body: { calibration: { globalOverallAverage: 0, reviewers: [] } } });
  });
});
