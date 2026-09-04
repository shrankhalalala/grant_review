import { UserRole } from "@prisma/client";
import { Router } from "express";

import { summary } from "../controllers/dashboard.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { requireRole } from "../middleware/requireRole.js";

export const dashboardRouter = Router();
dashboardRouter.get("/dashboard", authenticate, requireRole(UserRole.PROGRAM_OFFICER), summary);
