import { Router, type IRouter } from "express";
import { eq, and, count, sql } from "drizzle-orm";
import {
  db,
  usersTable,
  teachersTable,
  classesTable,
  subjectsTable,
  studentsTable,
  termsTable,
  academicYearsTable,
  reportCardStatusTable,
  teacherAssignmentsTable,
  classSubjectsTable,
  assessmentComponentsTable,
  scoresTable,
} from "@workspace/db";
import { requireAuth, requireAdmin, requireTeacher } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/dashboard/admin-summary", requireAdmin, async (_req, res): Promise<void> => {
  const [{ totalStudents }] = await db
    .select({ totalStudents: count() })
    .from(studentsTable);

  const [{ totalTeachers }] = await db
    .select({ totalTeachers: count() })
    .from(teachersTable);

  const [{ totalClasses }] = await db
    .select({ totalClasses: count() })
    .from(classesTable);

  const [{ totalSubjects }] = await db
    .select({ totalSubjects: count() })
    .from(subjectsTable);

  const [currentTerm] = await db
    .select({
      name: termsTable.name,
      yearLabel: academicYearsTable.yearLabel,
    })
    .from(termsTable)
    .leftJoin(academicYearsTable, eq(termsTable.academicYearId, academicYearsTable.id))
    .where(eq(termsTable.isCurrent, true));

  // Report card status counts
  const statusRows = await db
    .select({ status: reportCardStatusTable.status, cnt: count() })
    .from(reportCardStatusTable)
    .groupBy(reportCardStatusTable.status);

  const statusCounts = { draft: 0, submitted: 0, approved: 0, published: 0 };
  for (const row of statusRows) {
    if (row.status in statusCounts) {
      statusCounts[row.status as keyof typeof statusCounts] = row.cnt;
    }
  }

  res.json({
    totalStudents,
    totalTeachers,
    totalClasses,
    totalSubjects,
    currentTerm: currentTerm?.name ?? null,
    currentAcademicYear: currentTerm?.yearLabel ?? null,
    reportCardStatusCounts: statusCounts,
  });
});

router.get("/dashboard/teacher-summary", requireTeacher, async (req, res): Promise<void> => {
  const teacherId = req.session.teacherId;
  if (!teacherId) {
    res.status(400).json({ error: "No teacher profile found" });
    return;
  }

  const [teacher] = await db
    .select({ fullName: usersTable.fullName })
    .from(teachersTable)
    .leftJoin(usersTable, eq(teachersTable.userId, usersTable.id))
    .where(eq(teachersTable.id, teacherId));

  // Get current term assignments
  const [currentTerm] = await db
    .select()
    .from(termsTable)
    .where(eq(termsTable.isCurrent, true));

  const termId = currentTerm?.id;

  const assignments = await db
    .select({
      id: teacherAssignmentsTable.id,
      classSubjectId: teacherAssignmentsTable.classSubjectId,
      classId: classesTable.id,
      className: classesTable.name,
      subjectName: subjectsTable.name,
    })
    .from(teacherAssignmentsTable)
    .leftJoin(classSubjectsTable, eq(teacherAssignmentsTable.classSubjectId, classSubjectsTable.id))
    .leftJoin(classesTable, eq(classSubjectsTable.classId, classesTable.id))
    .leftJoin(subjectsTable, eq(classSubjectsTable.subjectId, subjectsTable.id))
    .where(
      and(
        eq(teacherAssignmentsTable.teacherId, teacherId),
        termId ? eq(teacherAssignmentsTable.termId, termId) : sql`true`,
      ),
    );

  const assignedClasses = [];
  let totalStudentsInCharge = 0;
  let pendingScoreEntries = 0;

  if (assignments.length > 0) {
    const classIds = [...new Set(assignments.map(a => a.classId).filter(Boolean))] as number[];
    const classSubjectIds = assignments.map(a => a.classSubjectId).filter(Boolean) as number[];

    // Bulk query student counts per class
    const studentCountsResult = classIds.length > 0 ? await db
      .select({
        classId: studentsTable.classId,
        studentCount: count(),
      })
      .from(studentsTable)
      .where(sql`${studentsTable.classId} = ANY(ARRAY[${sql.join(classIds.map(id => sql`${id}`), sql`, `)}]::int[])`)
      .groupBy(studentsTable.classId) : [];

    const studentCountMap = new Map<number, number>();
    for (const row of studentCountsResult) {
      if (row.classId) {
        studentCountMap.set(row.classId, Number(row.studentCount));
      }
    }

    // Bulk query components for all classSubjectIds in this term
    const componentsResult = classSubjectIds.length > 0 ? await db
      .select({
        id: assessmentComponentsTable.id,
        classSubjectId: assessmentComponentsTable.classSubjectId,
      })
      .from(assessmentComponentsTable)
      .where(
        and(
          sql`${assessmentComponentsTable.classSubjectId} = ANY(ARRAY[${sql.join(classSubjectIds.map(id => sql`${id}`), sql`, `)}]::int[])`,
          termId ? eq(assessmentComponentsTable.termId, termId) : sql`true`,
        )
      ) : [];

    const componentsMap = new Map<number, number[]>();
    for (const comp of componentsResult) {
      const list = componentsMap.get(comp.classSubjectId!) ?? [];
      list.push(comp.id);
      componentsMap.set(comp.classSubjectId!, list);
    }

    // Bulk query score counts per component
    const allComponentIds = componentsResult.map(c => c.id);
    const scoreCountsMap = new Map<number, number>();
    if (allComponentIds.length > 0) {
      const scoreCountsResult = await db
        .select({
          componentId: scoresTable.assessmentComponentId,
          cnt: count(),
        })
        .from(scoresTable)
        .where(sql`${scoresTable.assessmentComponentId} = ANY(ARRAY[${sql.join(allComponentIds.map(id => sql`${id}`), sql`, `)}]::int[])`)
        .groupBy(scoresTable.assessmentComponentId);

      for (const row of scoreCountsResult) {
        if (row.componentId) {
          scoreCountsMap.set(row.componentId, Number(row.cnt));
        }
      }
    }

    for (const assignment of assignments) {
      const classId = assignment.classId;
      if (!classId) continue;

      const studentCount = studentCountMap.get(classId) ?? 0;
      const componentIds = componentsMap.get(assignment.classSubjectId!) ?? [];
      const totalScoresExpected = studentCount * componentIds.length;

      let scoresEntered = 0;
      for (const compId of componentIds) {
        scoresEntered += scoreCountsMap.get(compId) ?? 0;
      }

      const pending = totalScoresExpected - scoresEntered;
      pendingScoreEntries += Math.max(0, pending);
      totalStudentsInCharge += studentCount;

      assignedClasses.push({
        classId,
        className: assignment.className ?? "",
        subjectName: assignment.subjectName ?? "",
        studentCount,
        scoresEntered,
        totalScoresExpected,
      });
    }
  }

  const ledClasses = await db
    .select({
      classId: classesTable.id,
      className: classesTable.name,
    })
    .from(classesTable)
    .where(eq(classesTable.classTeacherId, teacherId));

  res.json({
    teacherName: teacher?.fullName ?? "",
    assignedClasses,
    totalStudentsInCharge,
    pendingScoreEntries,
    ledClasses,
  });
});

router.get("/dashboard/score-completion", requireAdmin, async (req, res): Promise<void> => {
  const termId = req.query.termId ? parseInt(req.query.termId as string, 10) : null;
  if (!termId) {
    res.status(400).json({ error: "termId is required" });
    return;
  }

  const classSubjects = await db
    .select({
      classSubjectId: classSubjectsTable.id,
      classId: classesTable.id,
      className: classesTable.name,
      subjectId: subjectsTable.id,
      subjectName: subjectsTable.name,
    })
    .from(classSubjectsTable)
    .leftJoin(classesTable, eq(classSubjectsTable.classId, classesTable.id))
    .leftJoin(subjectsTable, eq(classSubjectsTable.subjectId, subjectsTable.id))
    .orderBy(classesTable.name, subjectsTable.name);

  const result = [];

  if (classSubjects.length > 0) {
    const classIds = [...new Set(classSubjects.map(cs => cs.classId).filter(Boolean))] as number[];
    const classSubjectIds = classSubjects.map(cs => cs.classSubjectId).filter(Boolean) as number[];

    // Bulk query student counts
    const studentCountsResult = classIds.length > 0 ? await db
      .select({
        classId: studentsTable.classId,
        studentCount: count(),
      })
      .from(studentsTable)
      .where(sql`${studentsTable.classId} = ANY(ARRAY[${sql.join(classIds.map(id => sql`${id}`), sql`, `)}]::int[])`)
      .groupBy(studentsTable.classId) : [];

    const studentCountMap = new Map<number, number>();
    for (const row of studentCountsResult) {
      if (row.classId) {
        studentCountMap.set(row.classId, Number(row.studentCount));
      }
    }

    // Bulk query components
    const componentsResult = classSubjectIds.length > 0 ? await db
      .select({
        id: assessmentComponentsTable.id,
        classSubjectId: assessmentComponentsTable.classSubjectId,
      })
      .from(assessmentComponentsTable)
      .where(
        and(
          sql`${assessmentComponentsTable.classSubjectId} = ANY(ARRAY[${sql.join(classSubjectIds.map(id => sql`${id}`), sql`, `)}]::int[])`,
          eq(assessmentComponentsTable.termId, termId),
        )
      ) : [];

    const componentsMap = new Map<number, number[]>();
    for (const comp of componentsResult) {
      const list = componentsMap.get(comp.classSubjectId!) ?? [];
      list.push(comp.id);
      componentsMap.set(comp.classSubjectId!, list);
    }

    // Bulk query score counts
    const allComponentIds = componentsResult.map(c => c.id);
    const scoreCountsMap = new Map<number, number>();
    if (allComponentIds.length > 0) {
      const scoreCountsResult = await db
        .select({
          componentId: scoresTable.assessmentComponentId,
          cnt: count(),
        })
        .from(scoresTable)
        .where(sql`${scoresTable.assessmentComponentId} = ANY(ARRAY[${sql.join(allComponentIds.map(id => sql`${id}`), sql`, `)}]::int[])`)
        .groupBy(scoresTable.assessmentComponentId);

      for (const row of scoreCountsResult) {
        if (row.componentId) {
          scoreCountsMap.set(row.componentId, Number(row.cnt));
        }
      }
    }

    for (const cs of classSubjects) {
      const studentCount = studentCountMap.get(cs.classId!) ?? 0;
      const componentIds = componentsMap.get(cs.classSubjectId!) ?? [];
      const totalExpected = studentCount * componentIds.length;

      let totalEntered = 0;
      for (const compId of componentIds) {
        totalEntered += scoreCountsMap.get(compId) ?? 0;
      }

      result.push({
        classId: cs.classId,
        className: cs.className,
        subjectId: cs.subjectId,
        subjectName: cs.subjectName,
        totalExpected,
        totalEntered,
        percentComplete: totalExpected > 0 ? Math.round((totalEntered / totalExpected) * 100) : 0,
      });
    }
  }

  res.json(result);
});

export default router;
