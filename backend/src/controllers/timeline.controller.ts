import type { RequestHandler } from "express";

import { HttpError } from "../middleware/errorHandler.js";
import { addTimelineComment, getTimeline } from "../services/timeline.service.js";

function applicationId(request: Parameters<RequestHandler>[0]) {
  const { applicationId } = request.params;
  if (typeof applicationId !== "string" || !applicationId) throw new HttpError(400, "A valid application ID is required.");
  return applicationId;
}

function actorId(request: Parameters<RequestHandler>[0]) {
  if (!request.auth) throw new HttpError(401, "Authentication required.");
  return request.auth.userId;
}

function readComment(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "comment is required.");
  const value = (body as Record<string, unknown>).comment;
  if (typeof value !== "string") throw new HttpError(400, "comment is required.");
  const comment = value.trim();
  if (!comment) throw new HttpError(400, "comment cannot be empty.");
  if (comment.length > 2000) throw new HttpError(400, "comment must be at most 2000 characters.");
  return comment;
}

export const timeline: RequestHandler = async (request, response, next) => {
  try { response.json({ events: await getTimeline(applicationId(request)) }); } catch (error) { next(error); }
};

export const comment: RequestHandler = async (request, response, next) => {
  try { response.status(201).json({ event: await addTimelineComment(applicationId(request), readComment(request.body), actorId(request)) }); } catch (error) { next(error); }
};
