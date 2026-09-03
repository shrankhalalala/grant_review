import { HttpError } from "../middleware/errorHandler.js";
import type { AssignmentInput } from "../types/assignment.js";

function record(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "Request body must be a JSON object.");
  return body as Record<string, unknown>;
}

function dueAt(value: unknown): Date {
  if (typeof value !== "string") throw new HttpError(400, "dueAt is required.");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new HttpError(400, "dueAt must be a valid date.");
  return date;
}

export function readAssignmentInput(body: unknown): AssignmentInput {
  const value = record(body);
  if (typeof value.reviewerId !== "string" || value.reviewerId.trim().length === 0) throw new HttpError(400, "reviewerId is required.");
  return { reviewerId: value.reviewerId.trim(), dueAt: dueAt(value.dueAt) };
}

export function readDueAt(body: unknown): Date {
  const value = record(body);
  if (Object.keys(value).some((key) => key !== "dueAt")) throw new HttpError(400, "Only dueAt can be changed.");
  return dueAt(value.dueAt);
}
