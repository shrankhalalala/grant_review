import type { RequestHandler } from "express";

import { listFundingRounds } from "../services/fundingRound.service.js";

export const list: RequestHandler = async (_request, response, next) => {
  try { response.json({ fundingRounds: await listFundingRounds() }); }
  catch (error) { next(error); }
};
