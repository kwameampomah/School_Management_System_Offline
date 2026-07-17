import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, termsTable, academicYearsTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { validate } from "../middlewares/validation";
import { CreateTermBody, UpdateTermBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/terms", requireAuth, async (req, res): Promise<void> => {
  const academicYearId = req.query.academicYearId
    ? parseInt(req.query.academicYearId as string, 10)
    : null;

  const rows = await db
    .select({
      id: termsTable.id,
      academicYearId: termsTable.academicYearId,
      academicYearLabel: academicYearsTable.yearLabel,
      name: termsTable.name,
      startDate: termsTable.startDate,
      endDate: termsTable.endDate,
      isCurrent: termsTable.isCurrent,
    })
    .from(termsTable)
    .leftJoin(academicYearsTable, eq(termsTable.academicYearId, academicYearsTable.id))
    .where(academicYearId ? eq(termsTable.academicYearId, academicYearId) : undefined)
    .orderBy(academicYearsTable.yearLabel, termsTable.name);

  res.json(rows);
});

router.post("/terms", requireAdmin, validate(CreateTermBody), async (req, res): Promise<void> => {
  const { academicYearId, name, startDate, endDate, isCurrent } = req.body;

  if (isCurrent) {
    await db.update(termsTable).set({ isCurrent: false });
  }

  const [term] = await db
    .insert(termsTable)
    .values({ academicYearId, name, startDate, endDate, isCurrent: isCurrent ?? false })
    .returning();

  const [row] = await db
    .select({
      id: termsTable.id,
      academicYearId: termsTable.academicYearId,
      academicYearLabel: academicYearsTable.yearLabel,
      name: termsTable.name,
      startDate: termsTable.startDate,
      endDate: termsTable.endDate,
      isCurrent: termsTable.isCurrent,
    })
    .from(termsTable)
    .leftJoin(academicYearsTable, eq(termsTable.academicYearId, academicYearsTable.id))
    .where(eq(termsTable.id, term.id));

  res.status(201).json(row);
});

router.get("/terms/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [row] = await db
    .select({
      id: termsTable.id,
      academicYearId: termsTable.academicYearId,
      academicYearLabel: academicYearsTable.yearLabel,
      name: termsTable.name,
      startDate: termsTable.startDate,
      endDate: termsTable.endDate,
      isCurrent: termsTable.isCurrent,
    })
    .from(termsTable)
    .leftJoin(academicYearsTable, eq(termsTable.academicYearId, academicYearsTable.id))
    .where(eq(termsTable.id, id));
  if (!row) {
    res.status(404).json({ error: "Term not found" });
    return;
  }
  res.json(row);
});

router.patch("/terms/:id", requireAdmin, validate(UpdateTermBody), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { name, startDate, endDate, isCurrent } = req.body;

  if (isCurrent) {
    await db.update(termsTable).set({ isCurrent: false });
  }

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (startDate !== undefined) updates.startDate = startDate;
  if (endDate !== undefined) updates.endDate = endDate;
  if (isCurrent !== undefined) updates.isCurrent = isCurrent;

  const [term] = await db.update(termsTable).set(updates).where(eq(termsTable.id, id)).returning();
  if (!term) {
    res.status(404).json({ error: "Term not found" });
    return;
  }

  const [row] = await db
    .select({
      id: termsTable.id,
      academicYearId: termsTable.academicYearId,
      academicYearLabel: academicYearsTable.yearLabel,
      name: termsTable.name,
      startDate: termsTable.startDate,
      endDate: termsTable.endDate,
      isCurrent: termsTable.isCurrent,
    })
    .from(termsTable)
    .leftJoin(academicYearsTable, eq(termsTable.academicYearId, academicYearsTable.id))
    .where(eq(termsTable.id, id));

  res.json(row);
});

router.delete("/terms/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [term] = await db.delete(termsTable).where(eq(termsTable.id, id)).returning();
  if (!term) {
    res.status(404).json({ error: "Term not found" });
    return;
  }
  res.json({ ok: true });
});

export default router;
