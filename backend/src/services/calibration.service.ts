import { ReviewStatus } from "@prisma/client";

import { prisma } from "../config/prisma.js";

const rounded = (value: number) => Number(value.toFixed(2));

export async function getReviewerCalibration(fundingRoundId?: string) {
  const reviews = await prisma.review.findMany({
    where: {
      status: ReviewStatus.COMPLETED,
      ...(fundingRoundId && { application: { is: { fundingRoundId } } }),
    },
    select: {
      impactScore: true,
      feasibilityScore: true,
      budgetJustificationScore: true,
      reviewer: { select: { id: true, name: true, email: true } },
    },
  });

  const totals = new Map<string, {
    reviewerId: string;
    reviewerName: string;
    reviewerEmail: string;
    completedReviewCount: number;
    impact: number;
    feasibility: number;
    budget: number;
  }>();

  for (const review of reviews) {
    // Completed-review validation guarantees each criterion is present.
    const record = totals.get(review.reviewer.id) ?? {
      reviewerId: review.reviewer.id,
      reviewerName: review.reviewer.name,
      reviewerEmail: review.reviewer.email,
      completedReviewCount: 0,
      impact: 0,
      feasibility: 0,
      budget: 0,
    };
    record.completedReviewCount += 1;
    record.impact += review.impactScore ?? 0;
    record.feasibility += review.feasibilityScore ?? 0;
    record.budget += review.budgetJustificationScore ?? 0;
    totals.set(record.reviewerId, record);
  }

  const globalOverallAverage = reviews.length === 0
    ? 0
    : rounded(reviews.reduce((sum, review) => sum + (review.impactScore ?? 0) + (review.feasibilityScore ?? 0) + (review.budgetJustificationScore ?? 0), 0) / (reviews.length * 3));

  const reviewers = [...totals.values()]
    .map((record) => {
      const averageImpact = rounded(record.impact / record.completedReviewCount);
      const averageFeasibility = rounded(record.feasibility / record.completedReviewCount);
      const averageBudgetJustification = rounded(record.budget / record.completedReviewCount);
      const overallAverage = rounded((record.impact + record.feasibility + record.budget) / (record.completedReviewCount * 3));
      const overallDifference = rounded(overallAverage - globalOverallAverage);
      const tendency = record.completedReviewCount < 3
        ? "Limited data"
        : overallDifference <= -0.5
          ? "More stringent"
          : overallDifference >= 0.5
            ? "More lenient"
            : "Around average";
      return {
        reviewerId: record.reviewerId,
        reviewerName: record.reviewerName,
        reviewerEmail: record.reviewerEmail,
        completedReviewCount: record.completedReviewCount,
        averageImpact,
        averageFeasibility,
        averageBudgetJustification,
        overallAverage,
        overallDifference,
        tendency,
      };
    })
    .sort((left, right) => left.reviewerName.localeCompare(right.reviewerName) || left.reviewerId.localeCompare(right.reviewerId));

  return { globalOverallAverage, reviewers };
}
