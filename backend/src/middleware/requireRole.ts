import { UserRole } from "@prisma/client";
import type { RequestHandler } from "express";

import { HttpError } from "./errorHandler.js";

export function requireRole(...roles: UserRole[]): RequestHandler {
  return (request, _response, next) => {
    if (!request.auth) {
      next(new HttpError(401, "Authentication required."));
      return;
    }

    if (!roles.includes(request.auth.role)) {
      next(new HttpError(403, "You do not have permission to access this resource."));
      return;
    }

    next();
  };
}
