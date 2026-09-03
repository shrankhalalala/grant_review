import { Prisma } from "@prisma/client";

import { HttpError } from "../middleware/errorHandler.js";
import type { ApplicationInput, ApplicationUpdateInput } from "../types/application.js";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const amountPattern = /^\d+(?:\.\d{1,2})?$/;
const forbiddenUpdateFields = new Set(["status", "archivedAt", "owner", "ownerId", "assignments", "reviews", "fundingDecision", "auditEvents"]);

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "Request body must be a JSON object.");
  }

  return value as Record<string, unknown>;
}

function readText(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HttpError(400, `${field} is required.`);
  }

  return value.trim();
}

function readEmail(value: unknown): string {
  const email = readText(value, "contactEmail").toLowerCase();

  if (!emailPattern.test(email)) {
    throw new HttpError(400, "contactEmail must be a valid email address.");
  }

  return email;
}

function readAmount(value: unknown): string {
  if (typeof value !== "string" || !amountPattern.test(value)) {
    throw new HttpError(400, "requestedAmount must be a decimal string with up to two decimal places.");
  }

  const [whole] = value.split(".");
  const decimal = new Prisma.Decimal(value);
  if (whole.length > 10 || decimal.lessThanOrEqualTo(0)) {
    throw new HttpError(400, "requestedAmount must be a positive value within the supported range.");
  }

  return value;
}

function readDate(value: unknown): Date {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HttpError(400, "submittedAt is required.");
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(400, "submittedAt must be a valid date.");
  }

  return date;
}

export function readCreateApplicationInput(body: unknown): ApplicationInput {
  const value = asRecord(body);
  return {
    organizationName: readText(value.organizationName, "organizationName"),
    contactEmail: readEmail(value.contactEmail),
    fundingRoundId: readText(value.fundingRoundId, "fundingRoundId"),
    requestedAmount: readAmount(value.requestedAmount),
    submittedAt: readDate(value.submittedAt),
  };
}

export function readUpdateApplicationInput(body: unknown): ApplicationUpdateInput {
  const value = asRecord(body);
  const suppliedFields = Object.keys(value);

  if (suppliedFields.length === 0) {
    throw new HttpError(400, "At least one editable application field is required.");
  }

  if (suppliedFields.some((field) => forbiddenUpdateFields.has(field))) {
    throw new HttpError(400, "Application status, archive state, and owner cannot be changed here.");
  }

  const input: ApplicationUpdateInput = {};
  if ("organizationName" in value) input.organizationName = readText(value.organizationName, "organizationName");
  if ("contactEmail" in value) input.contactEmail = readEmail(value.contactEmail);
  if ("fundingRoundId" in value) input.fundingRoundId = readText(value.fundingRoundId, "fundingRoundId");
  if ("requestedAmount" in value) input.requestedAmount = readAmount(value.requestedAmount);
  if ("submittedAt" in value) input.submittedAt = readDate(value.submittedAt);

  if (Object.keys(input).length === 0) {
    throw new HttpError(400, "No editable application fields were supplied.");
  }

  return input;
}
