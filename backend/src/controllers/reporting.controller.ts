import type { RequestHandler } from "express";

import { HttpError } from "../middleware/errorHandler.js";
import { exportCompletedReviewsCsv } from "../services/reporting.service.js";

export const completedReviewsCsv: RequestHandler = async (request, response, next) => {
  try {
    const fundingRoundId = request.params.fundingRoundId;
    if (typeof fundingRoundId !== "string" || !fundingRoundId) throw new HttpError(400, "A valid funding round ID is required.");
    response.type("text/csv").attachment(`completed-reviews-${fundingRoundId}.csv`).send(await exportCompletedReviewsCsv(fundingRoundId));
  } catch (error) { next(error); }
};
