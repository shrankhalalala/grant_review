import { Router } from "express";

import { currentUser, login, reviewers } from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { requireRole } from "../middleware/requireRole.js";
import { UserRole } from "@prisma/client";
import { list as calibration } from "../controllers/calibration.controller.js";

export const authRouter = Router();

authRouter.post("/auth/login", login);
authRouter.get("/auth/me", authenticate, currentUser);
authRouter.get("/reviewers", authenticate, requireRole(UserRole.PROGRAM_OFFICER), reviewers);
authRouter.get("/reviewers/calibration", authenticate, requireRole(UserRole.PROGRAM_OFFICER), calibration);
