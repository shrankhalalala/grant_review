import { UserRole } from "@prisma/client";
import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import type { AuthIdentity } from "../types/auth.js";
import { HttpError } from "./errorHandler.js";

function isAuthIdentity(value: unknown): value is AuthIdentity {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Record<string, unknown>;
  return typeof payload.userId === "string"
    && (payload.role === UserRole.PROGRAM_OFFICER || payload.role === UserRole.REVIEWER);
}

export const authenticate: RequestHandler = (request, _response, next) => {
  const authorization = request.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    next(new HttpError(401, "Authentication required."));
    return;
  }

  const token = authorization.slice("Bearer ".length).trim();

  if (!token) {
    next(new HttpError(401, "Authentication required."));
    return;
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);

    if (!isAuthIdentity(payload)) {
      throw new Error("Invalid token payload.");
    }

    request.auth = payload;
    next();
  } catch {
    next(new HttpError(401, "Authentication required."));
  }
};
