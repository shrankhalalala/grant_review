import type { RequestHandler } from "express";

import { HttpError } from "../middleware/errorHandler.js";
import { dismissOverdueAlert, listOverdueAlerts, overdueAlertCount } from "../services/overdueAlert.service.js";

function alertId(request: Parameters<RequestHandler>[0]) {
  const { alertId } = request.params;
  if (typeof alertId !== "string" || !alertId) throw new HttpError(400, "A valid alert ID is required.");
  return alertId;
}

export const list: RequestHandler = async (_request, response, next) => {
  try { response.json({ alerts: await listOverdueAlerts() }); } catch (error) { next(error); }
};

export const count: RequestHandler = async (_request, response, next) => {
  try { response.json({ count: await overdueAlertCount() }); } catch (error) { next(error); }
};

export const dismiss: RequestHandler = async (request, response, next) => {
  try { response.json({ alert: await dismissOverdueAlert(alertId(request)) }); } catch (error) { next(error); }
};
