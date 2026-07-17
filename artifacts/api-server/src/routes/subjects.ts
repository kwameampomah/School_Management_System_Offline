import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, subjectsTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { validate } from "../middlewares/validation";
import { CreateSubjectBody, UpdateSubjectBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/subjects", requireAuth, async (_req, res): Promise<void> => {
  const subjects = await db.select().from(subjectsTable).orderBy(subjectsTable.name);
  res.json(subjects);
});

router.post("/subjects", requireAdmin, validate(CreateSubjectBody), async (req, res): Promise<void> => {
  const { name, code } = req.body;
  const [subject] = await db.insert(subjectsTable).values({ name, code }).returning();
  res.status(201).json(subject);
});

router.patch("/subjects/:id", requireAdmin, validate(UpdateSubjectBody), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { name, code } = req.body;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (code !== undefined) updates.code = code;

  const [subject] = await db
    .update(subjectsTable)
    .set(updates)
    .where(eq(subjectsTable.id, id))
    .returning();
  if (!subject) {
    res.status(404).json({ error: "Subject not found" });
    return;
  }
  res.json(subject);
});

router.delete("/subjects/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [subject] = await db.delete(subjectsTable).where(eq(subjectsTable.id, id)).returning();
  if (!subject) {
    res.status(404).json({ error: "Subject not found" });
    return;
  }
  res.json({ ok: true });
});

export default router;
