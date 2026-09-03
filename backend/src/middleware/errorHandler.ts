import type { ErrorRequestHandler, RequestHandler } from "express";

import { env } from "../config/env.js";

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export const notFoundHandler: RequestHandler = (_request, response) => {
  response.status(404).json({
    status: 404,
    message: "Route not found.",
  });
};

function readClientErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  const { status, statusCode } = error as { status?: unknown; statusCode?: unknown };
  const candidate = typeof statusCode === "number" ? statusCode : status;

  return typeof candidate === "number" && Number.isInteger(candidate)
    && candidate >= 400 && candidate < 500
    ? candidate
    : undefined;
}

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  const clientErrorStatus = readClientErrorStatus(error);
  const status = error instanceof HttpError ? error.statusCode : clientErrorStatus ?? 500;
  const message = error instanceof HttpError
    ? error.message
    : clientErrorStatus
      ? "Invalid request."
    : error instanceof Error && env.nodeEnv !== "production"
      ? error.message
      : "Internal server error.";

  response.status(status).json({ status, message });
};
