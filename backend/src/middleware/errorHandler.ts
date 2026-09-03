import type { ErrorRequestHandler, RequestHandler } from "express";

import { env } from "../config/env.js";

export const notFoundHandler: RequestHandler = (_request, response) => {
  response.status(404).json({
    status: 404,
    message: "Route not found.",
  });
};

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  const status = response.statusCode >= 400 ? response.statusCode : 500;
  const message = error instanceof Error && env.nodeEnv !== "production"
    ? error.message
    : "Internal server error.";

  response.status(status).json({ status, message });
};
