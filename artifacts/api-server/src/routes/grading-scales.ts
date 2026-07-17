import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, gradingScaleTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { validate } from "../middlewares/validation";
import { CreateGradingScaleBody, UpdateGradingScaleBody } from "@workspace/api-zod";
import { logAudit } from "../lib/audit";

const router: IRouter = Router();

router.get("/grading-scales", requireAuth, async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(gradingScaleTable)
    .orderBy(gradingScaleTable.minScore);
  res.json(rows.map(r => ({
    ...r,
    minScore: parseFloat(r.minScore as unknown as string),
    maxScore: parseFloat(r.maxScore as unknown as string),
  })));
});

router.post("/grading-scales", requireAdmin, validate(CreateGradingScaleBody), async (req, res): Promise<void> => {
  const { minScore, maxScore, gradeLabel, remark } = req.body;
  const [row] = await db
    .insert(gradingScaleTable)
    .values({ minScore, maxScore, gradeLabel, remark })
    .returning();

  await logAudit(req.session.userId ?? null, "INSERT", "grading_scale", row.id, null, JSON.stringify(row));

  res.status(201).json({ ...row, minScore: parseFloat(row.minScore as unknown as string), maxScore: parseFloat(row.maxScore as unknown as string) });
});

router.patch("/grading-scales/:id", requireAdmin, validate(UpdateGradingScaleBody), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { minScore, maxScore, gradeLabel, remark } = req.body;

  const [existing] = await db.select().from(gradingScaleTable).where(eq(gradingScaleTable.id, id));

  const updates: Record<string, unknown> = {};
  if (minScore !== undefined) updates.minScore = minScore;
  if (maxScore !== undefined) updates.maxScore = maxScore;
  if (gradeLabel !== undefined) updates.gradeLabel = gradeLabel;
  if (remark !== undefined) updates.remark = remark;

  const [row] = await db.update(gradingScaleTable).set(updates).where(eq(gradingScaleTable.id, id)).returning();
  if (!row) {
    res.status(404).json({ error: "Grading scale not found" });
    return;
  }

  await logAudit(
    req.session.userId ?? null,
    "UPDATE",
    "grading_scale",
    row.id,
    existing ? JSON.stringify(existing) : null,
    JSON.stringify(row)
  );

  res.json({ ...row, minScore: parseFloat(row.minScore as unknown as string), maxScore: parseFloat(row.maxScore as unknown as string) });
});

router.delete("/grading-scales/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [row] = await db.delete(gradingScaleTable).where(eq(gradingScaleTable.id, id)).returning();
  if (!row) {
    res.status(404).json({ error: "Grading scale not found" });
    return;
  }

  await logAudit(
    req.session.userId ?? null,
    "DELETE",
    "grading_scale",
    row.id,
    JSON.stringify(row),
    null
  );

  res.json({ ok: true });
});

export default router;
