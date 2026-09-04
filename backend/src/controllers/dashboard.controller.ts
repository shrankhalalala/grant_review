import type { RequestHandler } from "express";

import { getDashboard } from "../services/dashboard.service.js";

export const summary: RequestHandler = async (_request, response, next) => {
  try { response.json({ dashboard: await getDashboard() }); } catch (error) { next(error); }
};
