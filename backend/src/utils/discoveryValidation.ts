import { ApplicationStatus } from "@prisma/client";

import { HttpError } from "../middleware/errorHandler.js";
import type { ApplicationDiscoveryInput, BulkAssignmentInput } from "../types/discovery.js";

function value(query: Record<string, unknown>, key: string): string | undefined {
  const candidate = query[key];
  if (candidate === undefined) return undefined;
  if (typeof candidate !== "string") throw new HttpError(400, `${key} must be a single string.`);
  return candidate;
}

function positiveInteger(query: Record<string, unknown>, key: string, fallback: number, maximum: number) {
  const candidate = value(query, key);
  if (candidate === undefined) return fallback;
  if (!/^\d+$/.test(candidate)) throw new HttpError(400, `${key} must be a positive integer.`);
  const parsed = Number(candidate);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) throw new HttpError(400, `${key} must be between 1 and ${maximum}.`);
  return parsed;
}

export function readApplicationDiscovery(query: Record<string, unknown>): ApplicationDiscoveryInput {
  const search = value(query, "search")?.trim();
  if (search !== undefined && (search.length === 0 || search.length > 200)) throw new HttpError(400, "search must be between 1 and 200 characters.");
  const status = value(query, "status");
  if (status !== undefined && !Object.values(ApplicationStatus).includes(status as ApplicationStatus)) throw new HttpError(400, "status is invalid.");
  const overdueValue = value(query, "overdue");
  if (overdueValue !== undefined && overdueValue !== "true" && overdueValue !== "false") throw new HttpError(400, "overdue must be true or false.");
  const sortBy = value(query, "sortBy") ?? "submittedAt";
  if (!(["submittedAt", "requestedAmount", "status"] as const).includes(sortBy as "submittedAt")) throw new HttpError(400, "sortBy is invalid.");
  const sortDirection = value(query, "sortDirection") ?? "desc";
  if (sortDirection !== "asc" && sortDirection !== "desc") throw new HttpError(400, "sortDirection must be asc or desc.");
  return {
    search,
    fundingRoundId: value(query, "fundingRoundId")?.trim() || undefined,
    status: status as ApplicationStatus | undefined,
    ownerId: value(query, "ownerId")?.trim() || undefined,
    overdue: overdueValue === undefined ? undefined : overdueValue === "true",
    sortBy: sortBy as ApplicationDiscoveryInput["sortBy"],
    sortDirection,
    page: positiveInteger(query, "page", 1, 1_000_000),
    pageSize: positiveInteger(query, "pageSize", 20, 100),
  };
}

export function readBulkAssignmentInput(body: unknown): BulkAssignmentInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "Request body must be a JSON object.");
  const value = body as Record<string, unknown>;
  if (!Array.isArray(value.reviewerIds) || value.reviewerIds.length === 0 || value.reviewerIds.some((id) => typeof id !== "string" || id.trim().length === 0)) throw new HttpError(400, "reviewerIds must be a non-empty array of reviewer IDs.");
  const reviewerIds = value.reviewerIds.map((id) => (id as string).trim());
  if (new Set(reviewerIds).size !== reviewerIds.length) throw new HttpError(400, "reviewerIds must not contain duplicates.");
  if (typeof value.dueAt !== "string") throw new HttpError(400, "dueAt is required.");
  const dueAt = new Date(value.dueAt);
  if (Number.isNaN(dueAt.getTime())) throw new HttpError(400, "dueAt must be a valid date.");
  return { reviewerIds, dueAt };
}
