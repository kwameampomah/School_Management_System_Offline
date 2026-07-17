import express, { type Express } from "express";
import cors from "cors";
import session from "express-session";
import pinoHttp from "pino-http";
import path from "path";
import fs from "fs";
import router from "./routes";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";
import swaggerUi from "swagger-ui-express";
import { swaggerDocument } from "./swagger";

const app: Express = express();

app.set("trust proxy", 1); // Trust proxy to allow secure cookies over HTTPS behind Vite proxy

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors({
  origin: true,
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET must be set");
}

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true, // Reset expiry on every request (activity-based timeout)
    cookie: {
      maxAge: 4 * 60 * 60 * 1000, // 4 hours of inactivity → auto logout
      httpOnly: true,              // Not accessible from JavaScript (XSS protection)
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    },
  }),
);

app.use("/api", router);

// API Documentation Endpoint
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Serve static frontend assets in production mode
if (process.env.NODE_ENV === "production") {
  const publicPath = path.join(process.cwd(), "artifacts/school-report/dist/public");
  const fallbackPath = path.join(process.cwd(), "../school-report/dist/public");
  
  const finalPath = fs.existsSync(publicPath) ? publicPath : fallbackPath;
  
  app.use(express.static(finalPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(finalPath, "index.html"));
  });
}

// Standardized JSON error handler
app.use((err: any, req: any, res: any, next: any): void => {
  req.log?.error(err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.message || "An unexpected error occurred",
  });
});

export default app;
