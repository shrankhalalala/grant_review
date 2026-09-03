import { UserRole } from "@prisma/client";
import { Router } from "express";

import { count, dismiss, list } from "../controllers/overdueAlert.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { requireRole } from "../middleware/requireRole.js";

export const overdueAlertRouter = Router();

overdueAlertRouter.use("/alerts/overdue", authenticate, requireRole(UserRole.PROGRAM_OFFICER));
overdueAlertRouter.get("/alerts/overdue", list);
overdueAlertRouter.get("/alerts/overdue/count", count);
overdueAlertRouter.post("/alerts/overdue/:alertId/dismiss", dismiss);
