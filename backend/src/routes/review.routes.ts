import { UserRole } from "@prisma/client";
import { Router } from "express";
import { complete, conflict, create, get, update } from "../controllers/review.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { requireRole } from "../middleware/requireRole.js";

export const reviewRouter = Router();
reviewRouter.post("/assignments/:assignmentId/review", authenticate, requireRole(UserRole.REVIEWER), create);
reviewRouter.get("/assignments/:assignmentId/review", authenticate, requireRole(UserRole.REVIEWER), get);
reviewRouter.post("/assignments/:assignmentId/conflict", authenticate, requireRole(UserRole.REVIEWER), conflict);
reviewRouter.patch("/reviews/:reviewId", authenticate, requireRole(UserRole.REVIEWER), update);
reviewRouter.post("/reviews/:reviewId/complete", authenticate, requireRole(UserRole.REVIEWER), complete);
