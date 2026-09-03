import { Router } from "express";

import { currentUser, login } from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/authenticate.js";

export const authRouter = Router();

authRouter.post("/auth/login", login);
authRouter.get("/auth/me", authenticate, currentUser);
