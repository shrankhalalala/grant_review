import { UserRole } from "@prisma/client";
import { Router } from "express";

import { archive, create, detail, list, restore, update } from "../controllers/application.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { requireRole } from "../middleware/requireRole.js";

export const applicationRouter = Router();

applicationRouter.use("/applications", authenticate, requireRole(UserRole.PROGRAM_OFFICER));
applicationRouter.post("/applications", create);
applicationRouter.get("/applications", list);
applicationRouter.get("/applications/:id", detail);
applicationRouter.patch("/applications/:id", update);
applicationRouter.post("/applications/:id/archive", archive);
applicationRouter.post("/applications/:id/restore", restore);
