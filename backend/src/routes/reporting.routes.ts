import { UserRole } from "@prisma/client";
import { Router } from "express";

import { completedReviewsCsv } from "../controllers/reporting.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { requireRole } from "../middleware/requireRole.js";

export const reportingRouter = Router();
reportingRouter.get("/funding-rounds/:fundingRoundId/reviews/export.csv", authenticate, requireRole(UserRole.PROGRAM_OFFICER), completedReviewsCsv);
