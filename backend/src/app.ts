import cors from "cors";
import express from "express";

import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { authRouter } from "./routes/auth.routes.js";
import { healthRouter } from "./routes/health.routes.js";

export const app = express();

app.use(express.json());
app.use(cors({ origin: env.frontendUrl }));
app.use(healthRouter);
app.use(authRouter);
app.use(notFoundHandler);
app.use(errorHandler);
