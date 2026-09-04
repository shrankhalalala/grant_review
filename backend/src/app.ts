import cors from "cors";
import express from "express";

import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { authRouter } from "./routes/auth.routes.js";
import { applicationRouter } from "./routes/application.routes.js";
import { assignmentRouter } from "./routes/assignment.routes.js";
import { dashboardRouter } from "./routes/dashboard.routes.js";
import { healthRouter } from "./routes/health.routes.js";
import { overdueAlertRouter } from "./routes/overdueAlert.routes.js";
import { reportingRouter } from "./routes/reporting.routes.js";
import { reviewRouter } from "./routes/review.routes.js";

export const app = express();

app.use(express.json());
app.use(cors({ origin: env.frontendUrl }));
app.use(healthRouter);
app.use(authRouter);
app.use(applicationRouter);
app.use(assignmentRouter);
app.use(reviewRouter);
app.use(overdueAlertRouter);
app.use(reportingRouter);
app.use(dashboardRouter);
app.use(notFoundHandler);
app.use(errorHandler);
