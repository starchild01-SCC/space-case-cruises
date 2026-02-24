import "express-async-errors";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { getRuntimeMode } from "./data/repository.js";
import { restoreLatestMemoryBackupIfPresent } from "./data/backup.js";
import { HttpError, errorHandler } from "./middleware/errors.js";
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
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(
  "/uploads",
  express.static(uploadsRootDir, {
    setHeaders: (response) => {
      response.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    },
  }),
);

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

app.use("/api/v1/auth", authRouter);
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
