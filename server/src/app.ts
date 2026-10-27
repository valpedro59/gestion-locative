import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import type { Database } from "./db/types";
import { createRequireAuth } from "./middleware/auth";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { createAuthRouter } from "./modules/auth/auth.routes";
import { createAuthService } from "./modules/auth/auth.service";
import { createPaymentsRouter } from "./modules/payments/payments.routes";
import { createPaymentsService } from "./modules/payments/payments.service";
import { globalLimiter } from "./lib/rateLimit";

export function createApp(db: Database) {
  const app = express();
  app.use(helmet());
  app.use(
    cors({
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());
  app.use(globalLimiter);

  app.get("/health", (_req, res) => res.json({ ok: true }));
  const requireAuth = createRequireAuth(db);

  const apiRouter = express.Router();
  app.use("/auth", createAuthRouter(createAuthService(db), requireAuth));

  app.use(
    "/payments",
    createPaymentsRouter(createPaymentsService(db), requireAuth),
  );
  app.use("/api/v1", apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
