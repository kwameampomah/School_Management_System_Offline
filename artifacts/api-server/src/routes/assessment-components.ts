import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, assessmentComponentsTable, classSubjectsTable, subjectsTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { validate } from "../middlewares/validation";
import { CreateAssessmentComponentBody, UpdateAssessmentComponentBody } from "@workspace/api-zod";
import { logAudit } from "../lib/audit";

const router: IRouter = Router();

router.get("/assessment-components", requireAuth, async (req, res): Promise<void> => {
  const termId = req.query.termId ? parseInt(req.query.termId as string, 10) : null;
  const classSubjectId = req.query.classSubjectId ? parseInt(req.query.classSubjectId as string, 10) : null;

  const conditions = [];
  if (termId) conditions.push(eq(assessmentComponentsTable.termId, termId));
  if (classSubjectId) conditions.push(eq(assessmentComponentsTable.classSubjectId, classSubjectId));

  const rows = await db
    .select({
      id: assessmentComponentsTable.id,
      classSubjectId: assessmentComponentsTable.classSubjectId,
      subjectName: subjectsTable.name,
      termId: assessmentComponentsTable.termId,
      name: assessmentComponentsTable.name,
      weightPercent: assessmentComponentsTable.weightPercent,
      maxScore: assessmentComponentsTable.maxScore,
    })
    .from(assessmentComponentsTable)
    .leftJoin(classSubjectsTable, eq(assessmentComponentsTable.classSubjectId, classSubjectsTable.id))
    .leftJoin(subjectsTable, eq(classSubjectsTable.subjectId, subjectsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(subjectsTable.name, assessmentComponentsTable.name);

  // Parse numeric strings to numbers
  res.json(rows.map(r => ({
    ...r,
    weightPercent: parseFloat(r.weightPercent as unknown as string),
    maxScore: parseFloat(r.maxScore as unknown as string),
  })));
});

router.post("/assessment-components", requireAdmin, validate(CreateAssessmentComponentBody), async (req, res): Promise<void> => {
  const { classSubjectId, termId, name, weightPercent, maxScore } = req.body;

  const [comp] = await db
    .insert(assessmentComponentsTable)
    .values({ classSubjectId, termId, name, weightPercent, maxScore })
    .returning();

  await logAudit(req.session.userId ?? null, "INSERT", "assessment_components", comp.id, null, JSON.stringify(comp));

  const [row] = await db
    .select({
      id: assessmentComponentsTable.id,
      classSubjectId: assessmentComponentsTable.classSubjectId,
      subjectName: subjectsTable.name,
      termId: assessmentComponentsTable.termId,
      name: assessmentComponentsTable.name,
      weightPercent: assessmentComponentsTable.weightPercent,
      maxScore: assessmentComponentsTable.maxScore,
    })
    .from(assessmentComponentsTable)
    .leftJoin(classSubjectsTable, eq(assessmentComponentsTable.classSubjectId, classSubjectsTable.id))
    .leftJoin(subjectsTable, eq(classSubjectsTable.subjectId, subjectsTable.id))
    .where(eq(assessmentComponentsTable.id, comp.id));

  res.status(201).json({ ...row, weightPercent: parseFloat(row!.weightPercent as unknown as string), maxScore: parseFloat(row!.maxScore as unknown as string) });
});

router.patch("/assessment-components/:id", requireAdmin, validate(UpdateAssessmentComponentBody), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { name, weightPercent, maxScore } = req.body;

  const [existing] = await db.select().from(assessmentComponentsTable).where(eq(assessmentComponentsTable.id, id));

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (weightPercent !== undefined) updates.weightPercent = String(weightPercent);
  if (maxScore !== undefined) updates.maxScore = String(maxScore);

  const [comp] = await db
    .update(assessmentComponentsTable)
    .set(updates)
    .where(eq(assessmentComponentsTable.id, id))
    .returning();
  if (!comp) {
    res.status(404).json({ error: "Assessment component not found" });
    return;
  }

  await logAudit(
    req.session.userId ?? null,
    "UPDATE",
    "assessment_components",
    comp.id,
    existing ? JSON.stringify(existing) : null,
    JSON.stringify(comp)
  );

  const [row] = await db
    .select({
      id: assessmentComponentsTable.id,
      classSubjectId: assessmentComponentsTable.classSubjectId,
      subjectName: subjectsTable.name,
      termId: assessmentComponentsTable.termId,
      name: assessmentComponentsTable.name,
      weightPercent: assessmentComponentsTable.weightPercent,
      maxScore: assessmentComponentsTable.maxScore,
    })
    .from(assessmentComponentsTable)
    .leftJoin(classSubjectsTable, eq(assessmentComponentsTable.classSubjectId, classSubjectsTable.id))
    .leftJoin(subjectsTable, eq(classSubjectsTable.subjectId, subjectsTable.id))
    .where(eq(assessmentComponentsTable.id, id));

  res.json({ ...row, weightPercent: parseFloat(row!.weightPercent as unknown as string), maxScore: parseFloat(row!.maxScore as unknown as string) });
});

router.delete("/assessment-components/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [comp] = await db
    .delete(assessmentComponentsTable)
    .where(eq(assessmentComponentsTable.id, id))
    .returning();
  if (!comp) {
    res.status(404).json({ error: "Assessment component not found" });
    return;
  }

  await logAudit(
    req.session.userId ?? null,
    "DELETE",
    "assessment_components",
    comp.id,
    JSON.stringify(comp),
    null
  );

  res.json({ ok: true });
});

export default router;
