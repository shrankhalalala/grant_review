import type { RequestHandler } from "express";

import { HttpError } from "../middleware/errorHandler.js";
import { archiveApplication, createApplication, getApplication, listApplications, restoreApplication, updateApplication } from "../services/application.service.js";
import { readCreateApplicationInput, readUpdateApplicationInput } from "../utils/applicationValidation.js";

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

export const list: RequestHandler = async (_request, response, next) => {
  try { response.status(200).json({ applications: await listApplications() }); } catch (error) { next(error); }
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
