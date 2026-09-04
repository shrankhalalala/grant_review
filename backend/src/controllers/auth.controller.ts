import type { RequestHandler } from "express";

import { HttpError } from "../middleware/errorHandler.js";
import { authenticate, findSafeUserById, listReviewers } from "../services/auth.service.js";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readCredentials(body: unknown): { email: string; password: string } | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const { email, password } = body as Record<string, unknown>;

  if (typeof email !== "string" || typeof password !== "string") {
    return null;
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!emailPattern.test(normalizedEmail) || password.length === 0) {
    return null;
  }

  return { email: normalizedEmail, password };
}

export const login: RequestHandler = async (request, response, next) => {
  const credentials = readCredentials(request.body);

  if (!credentials) {
    next(new HttpError(400, "A valid email and password are required."));
    return;
  }

  try {
    const result = await authenticate(credentials.email, credentials.password);

    if (!result) {
      next(new HttpError(401, "Invalid email or password."));
      return;
    }

    response.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const currentUser: RequestHandler = async (request, response, next) => {
  if (!request.auth) {
    next(new HttpError(401, "Authentication required."));
    return;
  }

  try {
    const user = await findSafeUserById(request.auth.userId);

    if (!user) {
      next(new HttpError(401, "Authentication required."));
      return;
    }

    response.status(200).json({ user });
  } catch (error) {
    next(error);
  }
};

export const reviewers: RequestHandler = async (_request, response, next) => {
  try { response.json({ reviewers: await listReviewers() }); }
  catch (error) { next(error); }
};
