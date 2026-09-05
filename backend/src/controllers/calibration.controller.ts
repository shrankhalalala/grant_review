import type { RequestHandler } from "express";

import { getReviewerCalibration } from "../services/calibration.service.js";
import { HttpError } from "../middleware/errorHandler.js";

export const list: RequestHandler = async (request, response, next) => {
  try {
    const fundingRoundId = request.query.fundingRoundId;
    if (fundingRoundId !== undefined && (typeof fundingRoundId !== "string" || !fundingRoundId)) {
      throw new HttpError(400, "fundingRoundId must be a non-empty string.");
    }
    response.json({ calibration: await getReviewerCalibration(fundingRoundId) });
  } catch (error) { next(error); }
};
