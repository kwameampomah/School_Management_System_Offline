import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, classesTable, academicYearsTable, teachersTable, usersTable, classSubjectsTable, subjectsTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { validate } from "../middlewares/validation";
import { CreateClassBody, UpdateClassBody, AddClassSubjectBody } from "@workspace/api-zod";

const router: IRouter = Router();

async function getClassRow(id: number) {
  const [row] = await db
    .select({
      id: classesTable.id,
      name: classesTable.name,
      academicYearId: classesTable.academicYearId,
      academicYearLabel: academicYearsTable.yearLabel,
      classTeacherId: classesTable.classTeacherId,
      classTeacherName: usersTable.fullName,
      studentCount: sql<number>`(select count(*) from students where students.class_id = ${classesTable.id})`.as("studentCount"),
    })
    .from(classesTable)
    .leftJoin(academicYearsTable, eq(classesTable.academicYearId, academicYearsTable.id))
    .leftJoin(teachersTable, eq(classesTable.classTeacherId, teachersTable.id))
    .leftJoin(usersTable, eq(teachersTable.userId, usersTable.id))
    .where(eq(classesTable.id, id));
  return row;
}

router.get("/classes", requireAuth, async (req, res): Promise<void> => {
  const academicYearId = req.query.academicYearId
    ? parseInt(req.query.academicYearId as string, 10)
    : null;

  const rows = await db
    .select({
      id: classesTable.id,
      name: classesTable.name,
      academicYearId: classesTable.academicYearId,
      academicYearLabel: academicYearsTable.yearLabel,
      classTeacherId: classesTable.classTeacherId,
      classTeacherName: usersTable.fullName,
      studentCount: sql<number>`(select count(*) from students where students.class_id = ${classesTable.id})`.as("studentCount"),
    })
    .from(classesTable)
    .leftJoin(academicYearsTable, eq(classesTable.academicYearId, academicYearsTable.id))
    .leftJoin(teachersTable, eq(classesTable.classTeacherId, teachersTable.id))
    .leftJoin(usersTable, eq(teachersTable.userId, usersTable.id))
    .where(academicYearId ? eq(classesTable.academicYearId, academicYearId) : undefined)
    .orderBy(classesTable.name);

  res.json(rows);
});

router.post("/classes", requireAdmin, validate(CreateClassBody), async (req, res): Promise<void> => {
  const { name, academicYearId, classTeacherId } = req.body;
  const [cls] = await db
    .insert(classesTable)
    .values({ name, academicYearId, classTeacherId: classTeacherId ?? null })
    .returning();
  const row = await getClassRow(cls.id);
  res.status(201).json(row);
});

router.get("/classes/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const row = await getClassRow(id);
  if (!row) {
    res.status(404).json({ error: "Class not found" });
    return;
  }
  res.json(row);
});

router.patch("/classes/:id", requireAdmin, validate(UpdateClassBody), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { name, classTeacherId } = req.body;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (classTeacherId !== undefined) updates.classTeacherId = classTeacherId;

  const [cls] = await db.update(classesTable).set(updates).where(eq(classesTable.id, id)).returning();
  if (!cls) {
    res.status(404).json({ error: "Class not found" });
    return;
  }
  const row = await getClassRow(id);
  res.json(row);
});

router.delete("/classes/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [cls] = await db.delete(classesTable).where(eq(classesTable.id, id)).returning();
  if (!cls) {
    res.status(404).json({ error: "Class not found" });
    return;
  }
  res.json({ ok: true });
});

// Class subjects
router.get("/classes/:id/subjects", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const rows = await db
    .select({
      id: classSubjectsTable.id,
      classId: classSubjectsTable.classId,
      subjectId: classSubjectsTable.subjectId,
      subjectName: subjectsTable.name,
      subjectCode: subjectsTable.code,
    })
    .from(classSubjectsTable)
    .leftJoin(subjectsTable, eq(classSubjectsTable.subjectId, subjectsTable.id))
    .where(eq(classSubjectsTable.classId, id))
    .orderBy(subjectsTable.name);
  res.json(rows);
});

router.post("/classes/:id/subjects", requireAdmin, validate(AddClassSubjectBody), async (req, res): Promise<void> => {
  const classId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { subjectId } = req.body;
  const [cs] = await db.insert(classSubjectsTable).values({ classId, subjectId }).returning();
  const [row] = await db
    .select({
      id: classSubjectsTable.id,
      classId: classSubjectsTable.classId,
      subjectId: classSubjectsTable.subjectId,
      subjectName: subjectsTable.name,
      subjectCode: subjectsTable.code,
    })
    .from(classSubjectsTable)
    .leftJoin(subjectsTable, eq(classSubjectsTable.subjectId, subjectsTable.id))
    .where(eq(classSubjectsTable.id, cs.id));
  res.status(201).json(row);
});

router.delete("/class-subjects/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [cs] = await db.delete(classSubjectsTable).where(eq(classSubjectsTable.id, id)).returning();
  if (!cs) {
    res.status(404).json({ error: "Class subject not found" });
    return;
  }
  res.json({ ok: true });
});

export default router;
