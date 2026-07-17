import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { rateLimit } from "express-rate-limit";
import { db, usersTable, teachersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { validate } from "../middlewares/validation";
import { LoginBody } from "@workspace/api-zod";
import { logAudit } from "../lib/audit";

// Brute-force protection: max 5 failed attempts per 15 minutes per IP
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "Too many login attempts. Please wait 15 minutes before trying again." },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Only count failed attempts
});

const router: IRouter = Router();

router.post("/auth/login", loginRateLimiter, validate(LoginBody), async (req, res): Promise<void> => {
  const { email, password } = req.body;

  let user;
  try {
    const rows = await db.select().from(usersTable).where(eq(usersTable.email, email));
    user = rows[0];
  } catch (err: any) {
    console.error("DIAGNOSTIC DATABASE ERROR STACK:", err.stack);
    console.error("DIAGNOSTIC DATABASE ERROR OBJECT:", err);
    res.status(500).json({ error: err.message || "Database query failed" });
    return;
  }

  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  // Get teacher record if applicable
  let teacherId: number | null = null;
  if (user.role === "teacher") {
    const [teacher] = await db
      .select()
      .from(teachersTable)
      .where(eq(teachersTable.userId, user.id));
    teacherId = teacher?.id ?? null;
  }

  req.session.userId = user.id;
  req.session.role = user.role;
  req.session.teacherId = teacherId;

  await logAudit(user.id, "UPDATE", "users", user.id, null, "User logged in successfully");

  res.json({
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    teacherId,
  });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  const userId = req.session.userId ?? null;
  req.session.destroy(async () => {
    if (userId) {
      await logAudit(userId, "UPDATE", "users", userId, null, "User logged out");
    }
    res.json({ ok: true });
  });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!));
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  let teacherId: number | null = null;
  if (user.role === "teacher") {
    const [teacher] = await db
      .select()
      .from(teachersTable)
      .where(eq(teachersTable.userId, user.id));
    teacherId = teacher?.id ?? null;
  }

  res.json({
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    teacherId,
  });
});

export default router;
