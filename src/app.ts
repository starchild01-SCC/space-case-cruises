import "express-async-errors";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { env } from "./config/env.js";
import { getRuntimeMode } from "./data/repository.js";
import { restoreLatestMemoryBackupIfPresent } from "./data/backup.js";
import { HttpError, errorHandler } from "./middleware/errors.js";
import { sanitizeInputs } from "./middleware/sanitize.js";
import { requireAuth, requireRole } from "./middleware/auth.js";
import { adminRouter } from "./routes/admin.routes.js";
import { authRouter } from "./routes/auth.routes.js";
import { badgesRouter } from "./routes/badges.routes.js";
import { cadetsRouter } from "./routes/cadets.routes.js";
import { cadreRouter } from "./routes/cadre.routes.js";
import { commitmentsRouter } from "./routes/commitments.routes.js";
import { cruiseSubgroupsRouter } from "./routes/cruise-subgroups.routes.js";
import { cruisesRouter } from "./routes/cruises.routes.js";
import { mapRouter } from "./routes/map.routes.js";
import { profileRouter } from "./routes/profile.routes.js";
import { subgroupsRouter } from "./routes/subgroups.routes.js";
import { uploadsRootDir, uploadsRouter } from "./routes/uploads.routes.js";

export const app = express();

restoreLatestMemoryBackupIfPresent();

app.disable("x-powered-by");

// Trust proxy specifically for Cloudflare Tunnel (trusts 1 proxy)
// MUST be set before rate limiting and CORS to allow proper IP detection
app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    hsts:
      env.nodeEnv === "production"
        ? { maxAge: 31536000, includeSubDomains: true, preload: true }
        : false,
  }),
);
const corsOptions = env.corsAllowedOrigins.length
  ? { origin: env.corsAllowedOrigins, credentials: true }
  : undefined;
app.use(cors(corsOptions));

if (env.enableRateLimit) {
  app.use(
    rateLimit({
      windowMs: env.rateLimitWindowMs,
      max: env.rateLimitMax,
      standardHeaders: true,
      legacyHeaders: false,
      skip: (request) => request.path === "/health",
    }),
  );
}
app.use(express.json({ limit: "1mb" }));
app.use(sanitizeInputs);
const uploadsStaticMiddleware = express.static(uploadsRootDir, {
  setHeaders: (response) => {
    response.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  },
});
app.use("/uploads", uploadsStaticMiddleware);
app.use("/api/uploads", uploadsStaticMiddleware);

app.use((request, response, next) => {
  response.setTimeout(env.requestTimeoutMs, () => {
    if (!response.headersSent) {
      response.status(504).json({
        error: {
          code: "TIMEOUT",
          message: "Request timeout",
          details: [],
        },
      });
    }
  });
  next();
});

app.get("/health", (_request, response) => {
  response.json({ status: "ok", mode: getRuntimeMode() });
});

const authRateLimiter = rateLimit({
  windowMs: env.rateLimitAuthWindowMs,
  max: env.rateLimitAuthMax,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (request) => request.path === "/api/v1/auth/mode",
});
app.use("/api/v1/auth", authRateLimiter, authRouter);

// Guard all admin endpoints centrally, so non-admins can never access `/api/v1/admin/*`,
// even if an individual route forgets to include `requireRole(["admin"])`.
app.use("/api/v1/admin", requireAuth, requireRole(["admin"]));

app.use("/api/v1", cadreRouter);
app.use("/api/v1", cadetsRouter);
app.use("/api/v1", profileRouter);
app.use("/api/v1", adminRouter);
app.use("/api/v1", cruisesRouter);
app.use("/api/v1", subgroupsRouter);
app.use("/api/v1", cruiseSubgroupsRouter);
app.use("/api/v1", commitmentsRouter);
app.use("/api/v1", mapRouter);
app.use("/api/v1", badgesRouter);
app.use("/api/v1", uploadsRouter);

app.use((_request, _response, next) => {
  next(new HttpError(404, "NOT_FOUND", "Route not found"));
});

app.use(errorHandler);
