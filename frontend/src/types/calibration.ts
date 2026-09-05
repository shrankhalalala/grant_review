export type ReviewerTendency = "Limited data" | "More stringent" | "Around average" | "More lenient";

export interface ReviewerCalibration {
  reviewerId: string;
  reviewerName: string;
  reviewerEmail: string;
  completedReviewCount: number;
  averageImpact: number;
  averageFeasibility: number;
  averageBudgetJustification: number;
  overallAverage: number;
  overallDifference: number;
  tendency: ReviewerTendency;
}

export interface CalibrationReport {
  globalOverallAverage: number;
  reviewers: ReviewerCalibration[];
}
