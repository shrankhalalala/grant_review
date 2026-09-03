import type { RequestHandler } from "express";

import { HttpError } from "../middleware/errorHandler.js";
import { archiveApplication, createApplication, getApplication, listApplications, moveToUnderReview, recordFundingDecision, restoreApplication, updateApplication } from "../services/application.service.js";
import { readCreateApplicationInput, readUpdateApplicationInput } from "../utils/applicationValidation.js";
import { readApplicationDiscovery } from "../utils/discoveryValidation.js";

function requireActorId(request: Parameters<RequestHandler>[0]): string {
  if (!request.auth) throw new HttpError(401, "Authentication required.");
  return request.auth.userId;
}

function requireApplicationId(request: Parameters<RequestHandler>[0]): string {
  const { id } = request.params;
  if (typeof id !== "string" || id.length === 0) {
    throw new HttpError(400, "A valid application ID is required.");
  }

  return id;
}

export const create: RequestHandler = async (request, response, next) => {
  try {
    const application = await createApplication(readCreateApplicationInput(request.body), requireActorId(request));
    response.status(201).json({ application });
  } catch (error) { next(error); }
};

export const list: RequestHandler = async (request, response, next) => {
  try { response.status(200).json(await listApplications(readApplicationDiscovery(request.query))); } catch (error) { next(error); }
};

export const detail: RequestHandler = async (request, response, next) => {
  try { response.status(200).json({ application: await getApplication(requireApplicationId(request)) }); } catch (error) { next(error); }
};

export const update: RequestHandler = async (request, response, next) => {
  try {
    const application = await updateApplication(requireApplicationId(request), readUpdateApplicationInput(request.body), requireActorId(request));
    response.status(200).json({ application });
  } catch (error) { next(error); }
};

export const archive: RequestHandler = async (request, response, next) => {
  try { response.status(200).json({ application: await archiveApplication(requireApplicationId(request), requireActorId(request)) }); } catch (error) { next(error); }
};

export const restore: RequestHandler = async (request, response, next) => {
  try { response.status(200).json({ application: await restoreApplication(requireApplicationId(request), requireActorId(request)) }); } catch (error) { next(error); }
};
export const status: RequestHandler = async (request, response, next) => { try { if (request.body?.status !== "UNDER_REVIEW" || Object.keys(request.body).length !== 1) throw new HttpError(400, "Only status UNDER_REVIEW can be requested."); response.json({ application: await moveToUnderReview(requireApplicationId(request), requireActorId(request)) }); } catch (error) { next(error); } };
export const decision: RequestHandler = async (request, response, next) => { try { const value = request.body?.decision; if (value !== "APPROVED" && value !== "DECLINED") throw new HttpError(400, "decision must be APPROVED or DECLINED."); response.status(201).json({ decision: await recordFundingDecision(requireApplicationId(request), value, requireActorId(request)) }); } catch (error) { next(error); } };
