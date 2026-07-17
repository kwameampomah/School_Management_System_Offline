import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, academicYearsTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { validate } from "../middlewares/validation";
import { CreateAcademicYearBody, UpdateAcademicYearBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/academic-years", requireAuth, async (_req, res): Promise<void> => {
  const years = await db
    .select()
    .from(academicYearsTable)
    .orderBy(academicYearsTable.yearLabel);
  res.json(years);
});

router.post("/academic-years", requireAdmin, validate(CreateAcademicYearBody), async (req, res): Promise<void> => {
  const { yearLabel, isCurrent } = req.body;

  if (isCurrent) {
    await db.update(academicYearsTable).set({ isCurrent: false });
  }

  const [year] = await db
    .insert(academicYearsTable)
    .values({ yearLabel, isCurrent: isCurrent ?? false })
    .returning();
  res.status(201).json(year);
});

router.get("/academic-years/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [year] = await db
    .select()
    .from(academicYearsTable)
    .where(eq(academicYearsTable.id, id));
  if (!year) {
    res.status(404).json({ error: "Academic year not found" });
    return;
  }
  res.json(year);
});

router.patch("/academic-years/:id", requireAdmin, validate(UpdateAcademicYearBody), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { yearLabel, isCurrent } = req.body;

  if (isCurrent) {
    await db.update(academicYearsTable).set({ isCurrent: false });
  }

  const [year] = await db
    .update(academicYearsTable)
    .set({ ...(yearLabel && { yearLabel }), ...(isCurrent !== undefined && { isCurrent }) })
    .where(eq(academicYearsTable.id, id))
    .returning();
  if (!year) {
    res.status(404).json({ error: "Academic year not found" });
    return;
  }
  res.json(year);
});

router.delete("/academic-years/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [year] = await db
    .delete(academicYearsTable)
    .where(eq(academicYearsTable.id, id))
    .returning();
  if (!year) {
    res.status(404).json({ error: "Academic year not found" });
    return;
  }
  res.json({ ok: true });
});

export default router;
