import { Router, type IRouter } from "express";
import { eq, and, inArray } from "drizzle-orm";
import {
  db,
  scoresTable,
  studentsTable,
  assessmentComponentsTable,
  classSubjectsTable,
  classesTable,
  teacherAssignmentsTable,
  auditLogsTable,
  reportCardStatusTable,
} from "@workspace/db";
import { requireTeacher } from "../middlewares/auth";
import { validate } from "../middlewares/validation";
import { UpsertScoreBody, BulkUpsertScoresBody } from "@workspace/api-zod";

const router: IRouter = Router();

// Returns true if this teacher is assigned to teach the class+subject+term
// that the given assessmentComponentId belongs to. Admins bypass this check.
async function teacherCanAccessComponent(
  role: string,
  teacherId: number | null,
  assessmentComponentId: number,
): Promise<boolean> {
  if (role === "admin") return true;
  if (!teacherId) return false;

  const [component] = await db
    .select({
      classSubjectId: assessmentComponentsTable.classSubjectId,
      termId: assessmentComponentsTable.termId,
    })
    .from(assessmentComponentsTable)
    .where(eq(assessmentComponentsTable.id, assessmentComponentId));

  if (!component) return false;

  const [assignment] = await db
    .select()
    .from(teacherAssignmentsTable)
    .where(
      and(
        eq(teacherAssignmentsTable.teacherId, teacherId),
        eq(teacherAssignmentsTable.classSubjectId, component.classSubjectId),
        eq(teacherAssignmentsTable.termId, component.termId),
      ),
    );

  return !!assignment;
}

// Returns true if the student belongs to the class the given component is for.
// Prevents teachers from writing scores for arbitrary students under a component
// they happen to be assigned to.
async function studentBelongsToComponent(
  studentId: number,
  assessmentComponentId: number,
): Promise<boolean> {
  const [row] = await db
    .select({ studentClassId: studentsTable.classId, componentClassId: classSubjectsTable.classId })
    .from(assessmentComponentsTable)
    .innerJoin(classSubjectsTable, eq(assessmentComponentsTable.classSubjectId, classSubjectsTable.id))
    .innerJoin(studentsTable, eq(studentsTable.classId, classSubjectsTable.classId))
    .where(
      and(
        eq(assessmentComponentsTable.id, assessmentComponentId),
        eq(studentsTable.id, studentId),
      ),
    );

  return !!row;
}

// Returns the set of classSubjectIds this teacher is assigned to, optionally
// filtered by termId. Used to scope GET /scores for teacher accounts.
async function getAssignedClassSubjectIds(
  teacherId: number,
  termId: number | null,
): Promise<number[]> {
  const conditions = [eq(teacherAssignmentsTable.teacherId, teacherId)];
  if (termId) conditions.push(eq(teacherAssignmentsTable.termId, termId));

  const assignments = await db
    .select({ classSubjectId: teacherAssignmentsTable.classSubjectId })
    .from(teacherAssignmentsTable)
    .where(and(...conditions));

  return assignments.map((a) => a.classSubjectId);
}

router.get("/scores", requireTeacher, async (req, res): Promise<void> => {
  const termId = req.query.termId ? parseInt(req.query.termId as string, 10) : null;
  const classId = req.query.classId ? parseInt(req.query.classId as string, 10) : null;
  const assessmentComponentId = req.query.assessmentComponentId
    ? parseInt(req.query.assessmentComponentId as string, 10)
    : null;
  const studentId = req.query.studentId ? parseInt(req.query.studentId as string, 10) : null;

  const conditions = [];
  if (assessmentComponentId) conditions.push(eq(scoresTable.assessmentComponentId, assessmentComponentId));
  if (studentId) conditions.push(eq(scoresTable.studentId, studentId));
  if (termId) conditions.push(eq(assessmentComponentsTable.termId, termId));
  if (classId) conditions.push(eq(studentsTable.classId, classId));

  // Teachers can only see scores for their own assigned class-subjects
  if (req.session.role !== "admin") {
    const teacherId = req.session.teacherId ?? null;
    if (!teacherId) {
      res.status(403).json({ error: "No teacher profile associated with this account" });
      return;
    }
    const allowedClassSubjectIds = await getAssignedClassSubjectIds(teacherId, termId);
    if (allowedClassSubjectIds.length === 0) {
      res.json([]);
      return;
    }
    conditions.push(inArray(assessmentComponentsTable.classSubjectId, allowedClassSubjectIds));
  }

  const rows = await db
    .select({
      id: scoresTable.id,
      studentId: scoresTable.studentId,
      studentName: studentsTable.fullName,
      assessmentComponentId: scoresTable.assessmentComponentId,
      componentName: assessmentComponentsTable.name,
      scoreValue: scoresTable.scoreValue,
      isLocked: scoresTable.isLocked,
      enteredAt: scoresTable.enteredAt,
      lastEditedAt: scoresTable.lastEditedAt,
    })
    .from(scoresTable)
    .leftJoin(studentsTable, eq(scoresTable.studentId, studentsTable.id))
    .leftJoin(assessmentComponentsTable, eq(scoresTable.assessmentComponentId, assessmentComponentsTable.id))
    .leftJoin(classSubjectsTable, eq(assessmentComponentsTable.classSubjectId, classSubjectsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  res.json(rows.map((r) => ({
    ...r,
    scoreValue: parseFloat(r.scoreValue as unknown as string),
  })));
});

router.put("/scores", requireTeacher, validate(UpsertScoreBody), async (req, res): Promise<void> => {
  const { studentId, assessmentComponentId, scoreValue } = req.body;

  // Enforce that this teacher is actually assigned to this component's class+subject+term
  const allowed = await teacherCanAccessComponent(
    req.session.role!,
    req.session.teacherId ?? null,
    assessmentComponentId,
  );
  if (!allowed) {
    res.status(403).json({ error: "You are not assigned to this class/subject" });
    return;
  }

  // Enforce that the student belongs to the class this component is for
  const studentInClass = await studentBelongsToComponent(studentId, assessmentComponentId);
  if (!studentInClass) {
    res.status(403).json({ error: "This student does not belong to the class for this assessment component" });
    return;
  }

  // Bounds check against the component's maxScore
  const [component] = await db
    .select({
      maxScore: assessmentComponentsTable.maxScore,
      classSubjectId: assessmentComponentsTable.classSubjectId,
      termId: assessmentComponentsTable.termId
    })
    .from(assessmentComponentsTable)
    .where(eq(assessmentComponentsTable.id, assessmentComponentId));
  const maxScore = component ? parseFloat(component.maxScore as unknown as string) : 100;
  const numericScore = Number(scoreValue);
  if (Number.isNaN(numericScore) || numericScore < 0 || numericScore > maxScore) {
    res.status(400).json({ error: `scoreValue must be between 0 and ${maxScore}` });
    return;
  }

  // Lock check against submitted/approved report card status
  if (component && req.session.role !== "admin") {
    const [classSubj] = await db
      .select({ classId: classSubjectsTable.classId })
      .from(classSubjectsTable)
      .where(eq(classSubjectsTable.id, component.classSubjectId));

    if (classSubj) {
      const [statusRow] = await db
        .select()
        .from(reportCardStatusTable)
        .where(
          and(
            eq(reportCardStatusTable.classId, classSubj.classId),
            eq(reportCardStatusTable.termId, component.termId)
          )
        );
      if (statusRow?.status === "submitted" || statusRow?.status === "approved") {
        res.status(403).json({ error: "Report cards for this class and term are locked and cannot be edited." });
        return;
      }
    }
  }

  // Check if score exists
  const [existing] = await db
    .select()
    .from(scoresTable)
    .where(
      and(
        eq(scoresTable.studentId, studentId),
        eq(scoresTable.assessmentComponentId, assessmentComponentId),
      ),
    );

  let score;
  if (existing) {
    if (existing.isLocked) {
      res.status(403).json({ error: "Score is locked" });
      return;
    }
    [score] = await db
      .update(scoresTable)
      .set({ scoreValue: numericScore, lastEditedAt: new Date(), teacherId: req.session.teacherId ?? null })
      .where(eq(scoresTable.id, existing.id))
      .returning();
  } else {
    [score] = await db
      .insert(scoresTable)
      .values({
        studentId,
        assessmentComponentId,
        scoreValue: numericScore,
        teacherId: req.session.teacherId ?? null,
      })
      .returning();
  }
  
  // Log audit trail
  await db.insert(auditLogsTable).values({
    actorUserId: req.session.userId ?? null,
    action: existing ? "UPDATE" : "INSERT",
    tableName: "scores",
    rowId: score!.id,
    oldValue: existing ? String(existing.scoreValue) : null,
    newValue: String(numericScore),
  });

  const [row] = await db
    .select({
      id: scoresTable.id,
      studentId: scoresTable.studentId,
      studentName: studentsTable.fullName,
      assessmentComponentId: scoresTable.assessmentComponentId,
      componentName: assessmentComponentsTable.name,
      scoreValue: scoresTable.scoreValue,
      isLocked: scoresTable.isLocked,
      enteredAt: scoresTable.enteredAt,
      lastEditedAt: scoresTable.lastEditedAt,
    })
    .from(scoresTable)
    .leftJoin(studentsTable, eq(scoresTable.studentId, studentsTable.id))
    .leftJoin(assessmentComponentsTable, eq(scoresTable.assessmentComponentId, assessmentComponentsTable.id))
    .where(eq(scoresTable.id, score!.id));

  res.json({ ...row, scoreValue: parseFloat(row!.scoreValue as unknown as string) });
});

// PUT /scores/bulk — response stays Score[] to preserve the existing API contract.
// Entries failing access checks or bounds validation are silently skipped.
router.put("/scores/bulk", requireTeacher, validate(BulkUpsertScoresBody), async (req, res): Promise<void> => {
  const { scores } = req.body;
  const results = [];

  for (const s of scores) {
    const { studentId, assessmentComponentId, scoreValue } = s;

    // Enforce teacher assignment check per entry
    const allowed = await teacherCanAccessComponent(
      req.session.role!,
      req.session.teacherId ?? null,
      assessmentComponentId,
    );
    if (!allowed) continue;

    // Enforce student belongs to this component's class
    const studentInClass = await studentBelongsToComponent(studentId, assessmentComponentId);
    if (!studentInClass) continue;

    // Bounds check per entry
    const [component] = await db
      .select({ maxScore: assessmentComponentsTable.maxScore })
      .from(assessmentComponentsTable)
      .where(eq(assessmentComponentsTable.id, assessmentComponentId));
    const maxScore = component ? parseFloat(component.maxScore as unknown as string) : 100;
    const numericScore = Number(scoreValue);
    if (Number.isNaN(numericScore) || numericScore < 0 || numericScore > maxScore) continue;

    const [existing] = await db
      .select()
      .from(scoresTable)
      .where(
        and(
          eq(scoresTable.studentId, studentId),
          eq(scoresTable.assessmentComponentId, assessmentComponentId),
        ),
      );

    let score;
    if (existing) {
      if (existing.isLocked) continue;
      [score] = await db
        .update(scoresTable)
        .set({ scoreValue: numericScore, lastEditedAt: new Date(), teacherId: req.session.teacherId ?? null })
        .where(eq(scoresTable.id, existing.id))
        .returning();
    } else {
      [score] = await db
        .insert(scoresTable)
        .values({
          studentId,
          assessmentComponentId,
          scoreValue: numericScore,
          teacherId: req.session.teacherId ?? null,
        })
        .returning();
    }
    if (score) {
      // Log audit trail for bulk entry
      await db.insert(auditLogsTable).values({
        actorUserId: req.session.userId ?? null,
        action: existing ? "UPDATE" : "INSERT",
        tableName: "scores",
        rowId: score.id,
        oldValue: existing ? String(existing.scoreValue) : null,
        newValue: String(numericScore),
      });
      results.push({ ...score, scoreValue: parseFloat(score.scoreValue as unknown as string) });
    }
  }

  res.json(results);
});

export default router;
