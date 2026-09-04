import { UserRole } from "@prisma/client";
import { Router } from "express";

import { list } from "../controllers/fundingRound.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { requireRole } from "../middleware/requireRole.js";

export const fundingRoundRouter = Router();

fundingRoundRouter.get("/funding-rounds", authenticate, requireRole(UserRole.PROGRAM_OFFICER), list);
