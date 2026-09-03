import { HttpError } from "../middleware/errorHandler.js";
import type { ReviewInput } from "../types/review.js";

function record(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "Request body must be a JSON object.");
  return body as Record<string, unknown>;
}

function score(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 5) throw new HttpError(400, `${field} must be an integer between 1 and 5.`);
  return value;
}

export function readReviewInput(body: unknown, requireField = false): ReviewInput {
  const value = record(body);
  const allowed = new Set(["impactScore", "feasibilityScore", "budgetJustificationScore", "comments"]);
  if (Object.keys(value).some((key) => !allowed.has(key))) throw new HttpError(400, "Only review fields can be changed.");
  if (requireField && Object.keys(value).length === 0) throw new HttpError(400, "At least one review field is required.");
  const input: ReviewInput = {};
  if (value.impactScore !== undefined) input.impactScore = score(value.impactScore, "impactScore");
  if (value.feasibilityScore !== undefined) input.feasibilityScore = score(value.feasibilityScore, "feasibilityScore");
  if (value.budgetJustificationScore !== undefined) input.budgetJustificationScore = score(value.budgetJustificationScore, "budgetJustificationScore");
  if (value.comments !== undefined) {
    if (typeof value.comments !== "string") throw new HttpError(400, "comments must be a string.");
    input.comments = value.comments.trim();
  }
  return input;
}

export function readConflictReason(body: unknown): string {
  const value = record(body);
  if (typeof value.reason !== "string" || !value.reason.trim()) throw new HttpError(400, "reason is required.");
  if (Object.keys(value).some((key) => key !== "reason")) throw new HttpError(400, "Only reason can be provided.");
  return value.reason.trim();
}
