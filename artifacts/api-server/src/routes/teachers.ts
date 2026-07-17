import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, teachersTable, usersTable, teacherAssignmentsTable, classSubjectsTable, classesTable, subjectsTable, termsTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { validate } from "../middlewares/validation";
import { CreateTeacherAssignmentBody } from "@workspace/api-zod";
import { logAudit } from "../lib/audit";

const router: IRouter = Router();

router.get("/teachers", requireAuth, async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: teachersTable.id,
      userId: teachersTable.userId,
      fullName: usersTable.fullName,
      email: usersTable.email,
      staffId: teachersTable.staffId,
      phone: teachersTable.phone,
    })
    .from(teachersTable)
    .leftJoin(usersTable, eq(teachersTable.userId, usersTable.id))
    .orderBy(usersTable.fullName);
  res.json(rows);
});

router.get("/teachers/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [row] = await db
    .select({
      id: teachersTable.id,
      userId: teachersTable.userId,
      fullName: usersTable.fullName,
      email: usersTable.email,
      staffId: teachersTable.staffId,
      phone: teachersTable.phone,
    })
    .from(teachersTable)
    .leftJoin(usersTable, eq(teachersTable.userId, usersTable.id))
    .where(eq(teachersTable.id, id));
  if (!row) {
    res.status(404).json({ error: "Teacher not found" });
    return;
  }
  res.json(row);
});

// Teacher assignments
router.get("/teacher-assignments", requireAuth, async (req, res): Promise<void> => {
  const teacherId = req.query.teacherId ? parseInt(req.query.teacherId as string, 10) : null;
  const termId = req.query.termId ? parseInt(req.query.termId as string, 10) : null;

  const conditions = [];
  if (teacherId) conditions.push(eq(teacherAssignmentsTable.teacherId, teacherId));
  if (termId) conditions.push(eq(teacherAssignmentsTable.termId, termId));

  const rows = await db
    .select({
      id: teacherAssignmentsTable.id,
      teacherId: teacherAssignmentsTable.teacherId,
      teacherName: usersTable.fullName,
      classSubjectId: teacherAssignmentsTable.classSubjectId,
      className: classesTable.name,
      subjectName: subjectsTable.name,
      termId: teacherAssignmentsTable.termId,
      termName: termsTable.name,
    })
    .from(teacherAssignmentsTable)
    .leftJoin(teachersTable, eq(teacherAssignmentsTable.teacherId, teachersTable.id))
    .leftJoin(usersTable, eq(teachersTable.userId, usersTable.id))
    .leftJoin(classSubjectsTable, eq(teacherAssignmentsTable.classSubjectId, classSubjectsTable.id))
    .leftJoin(classesTable, eq(classSubjectsTable.classId, classesTable.id))
    .leftJoin(subjectsTable, eq(classSubjectsTable.subjectId, subjectsTable.id))
    .leftJoin(termsTable, eq(teacherAssignmentsTable.termId, termsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(usersTable.fullName);

  res.json(rows);
});

router.post("/teacher-assignments", requireAdmin, validate(CreateTeacherAssignmentBody), async (req, res): Promise<void> => {
  const { teacherId, classSubjectId, termId } = req.body;

  const [assignment] = await db
    .insert(teacherAssignmentsTable)
    .values({ teacherId, classSubjectId, termId })
    .returning();

  await logAudit(req.session.userId ?? null, "INSERT", "teacher_assignments", assignment.id, null, JSON.stringify(assignment));

  const [row] = await db
    .select({
      id: teacherAssignmentsTable.id,
      teacherId: teacherAssignmentsTable.teacherId,
      teacherName: usersTable.fullName,
      classSubjectId: teacherAssignmentsTable.classSubjectId,
      className: classesTable.name,
      subjectName: subjectsTable.name,
      termId: teacherAssignmentsTable.termId,
      termName: termsTable.name,
    })
    .from(teacherAssignmentsTable)
    .leftJoin(teachersTable, eq(teacherAssignmentsTable.teacherId, teachersTable.id))
    .leftJoin(usersTable, eq(teachersTable.userId, usersTable.id))
    .leftJoin(classSubjectsTable, eq(teacherAssignmentsTable.classSubjectId, classSubjectsTable.id))
    .leftJoin(classesTable, eq(classSubjectsTable.classId, classesTable.id))
    .leftJoin(subjectsTable, eq(classSubjectsTable.subjectId, subjectsTable.id))
    .leftJoin(termsTable, eq(teacherAssignmentsTable.termId, termsTable.id))
    .where(eq(teacherAssignmentsTable.id, assignment.id));

  res.status(201).json(row);
});

router.delete("/teacher-assignments/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const [assignment] = await db
    .delete(teacherAssignmentsTable)
    .where(eq(teacherAssignmentsTable.id, id))
    .returning();
  if (!assignment) {
    res.status(404).json({ error: "Teacher assignment not found" });
    return;
  }

  await logAudit(req.session.userId ?? null, "DELETE", "teacher_assignments", assignment.id, JSON.stringify(assignment), null);
  res.json({ ok: true });
});

export default router;
