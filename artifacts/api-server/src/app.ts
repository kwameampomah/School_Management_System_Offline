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

// Offline system: allow only local network origins (no internet exposure)
const allowedOrigins: (string | RegExp)[] = [
  "http://localhost:3000",
  "http://localhost:5173",
  /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}:3000$/,  // LAN access within school network
  /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}:3000$/,
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server requests (no Origin header)
    if (!origin) return callback(null, true);
    const isAllowed = allowedOrigins.some((allowed) =>
      typeof allowed === "string" ? allowed === origin : allowed.test(origin)
    );
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error(`CORS policy: origin '${origin}' is not allowed.`));
    }
  },
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
app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction): void => {
  // Type guard — only access known properties of Error objects
  if (err instanceof Error) {
    const status = (err as any).status || (err as any).statusCode || 500;
    req.log?.error({ err }, err.message);
    res.status(status).json({ error: err.message || "An unexpected error occurred" });
  } else {
    req.log?.error({ err }, "Unknown error thrown");
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});

export default app;

