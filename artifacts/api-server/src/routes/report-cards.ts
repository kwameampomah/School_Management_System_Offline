import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import path from "path";
import fs from "fs";
import PDFDocument from "pdfkit";
import {
  db,
  reportCardStatusTable,
  classesTable,
  termsTable,
  studentsTable,
  scoresTable,
  assessmentComponentsTable,
  classSubjectsTable,
  subjectsTable,
  gradingScaleTable,
  academicYearsTable,
  teacherAssignmentsTable,
  studentTermMetadataTable,
  usersTable,
  studentFeesTable,
  teachersTable,
  feeTypesTable,
} from "@workspace/db";
import { requireAuth, requireAdmin, requireTeacher } from "../middlewares/auth";
import { validate } from "../middlewares/validation";
import { UpdateReportCardStatusBody } from "@workspace/api-zod";
import { logAudit } from "../lib/audit";

const router: IRouter = Router();

// Helper: compute subject total for one student, one classSubject, one term
async function computeSubjectTotal(
  studentId: number,
  classSubjectId: number,
  termId: number,
): Promise<{ total: number; componentScores: Array<{ componentId: number; componentName: string; scoreValue: number; maxScore: number; weightPercent: number; weightedScore: number }> }> {
  const components = await db
    .select()
    .from(assessmentComponentsTable)
    .where(
      and(
        eq(assessmentComponentsTable.classSubjectId, classSubjectId),
        eq(assessmentComponentsTable.termId, termId),
      ),
    );

  const componentScores = [];
  let total = 0;

  for (const comp of components) {
    const [score] = await db
      .select()
      .from(scoresTable)
      .where(
        and(
          eq(scoresTable.studentId, studentId),
          eq(scoresTable.assessmentComponentId, comp.id),
        ),
      );

    const scoreValue = score ? parseFloat(score.scoreValue as unknown as string) : 0;
    const maxScore = parseFloat(comp.maxScore as unknown as string);
    const weightPercent = parseFloat(comp.weightPercent as unknown as string);
    const weightedScore = maxScore > 0 ? (scoreValue / maxScore) * weightPercent : 0;
    total += weightedScore;

    componentScores.push({
      componentId: comp.id,
      componentName: comp.name,
      scoreValue,
      maxScore,
      weightPercent,
      weightedScore: Math.round(weightedScore * 100) / 100,
    });
  }

  return { total: Math.round(total), componentScores };
}

// Helper: lookup grade from grading scale
async function lookupGrade(
  total: number,
  isPrimary: boolean = false,
  cachedScales?: Array<{ minScore: any; maxScore: any; gradeLabel: string; remark: string }>
): Promise<{ grade: string; remark: string }> {
  if (isPrimary) {
    if (total >= 80) return { grade: "A", remark: "ADVANCE" };
    if (total >= 68) return { grade: "P", remark: "PROFICIENCY" };
    if (total >= 54) return { grade: "AP", remark: "APPROACHING PROFICIENCY" };
    if (total >= 40) return { grade: "D", remark: "DEVELOPING" };
    return { grade: "B", remark: "BEGINNING" };
  }
  const scales = cachedScales || await db.select().from(gradingScaleTable);
  for (const scale of scales) {
    const min = parseFloat(scale.minScore as unknown as string);
    const max = parseFloat(scale.maxScore as unknown as string);
    if (total >= min && total <= max) {
      return { grade: scale.gradeLabel, remark: scale.remark };
    }
  }
  return { grade: "N/A", remark: "No grade" };
}

async function userCanManageStatus(
  role: string,
  teacherId: number | null,
  classId: number,
): Promise<boolean> {
  if (role === "admin") return true;
  if (!teacherId) return false;

  const [cls] = await db
    .select({ classTeacherId: classesTable.classTeacherId })
    .from(classesTable)
    .where(eq(classesTable.id, classId));

  return cls?.classTeacherId === teacherId;
}

// GET /report-card-status
router.get("/report-card-status", requireAuth, async (req, res): Promise<void> => {
  const termId = req.query.termId ? parseInt(req.query.termId as string, 10) : null;
  const classId = req.query.classId ? parseInt(req.query.classId as string, 10) : null;

  const conditions = [];
  if (termId) conditions.push(eq(reportCardStatusTable.termId, termId));
  if (classId) conditions.push(eq(reportCardStatusTable.classId, classId));

  const rows = await db
    .select({
      id: reportCardStatusTable.id,
      classId: reportCardStatusTable.classId,
      className: classesTable.name,
      termId: reportCardStatusTable.termId,
      termName: termsTable.name,
      status: reportCardStatusTable.status,
      approvedBy: reportCardStatusTable.approvedBy,
      approvedAt: reportCardStatusTable.approvedAt,
    })
    .from(reportCardStatusTable)
    .leftJoin(classesTable, eq(reportCardStatusTable.classId, classesTable.id))
    .leftJoin(termsTable, eq(reportCardStatusTable.termId, termsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(classesTable.name);

  res.json(rows);
});

router.patch("/report-card-status/:id", requireAuth, validate(UpdateReportCardStatusBody), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { status } = req.body;

  const [rcsRow] = await db
    .select()
    .from(reportCardStatusTable)
    .where(eq(reportCardStatusTable.id, id));

  if (!rcsRow) {
    res.status(404).json({ error: "Report card status not found" });
    return;
  }

  const allowed = await userCanManageStatus(
    req.session.role!,
    req.session.teacherId ?? null,
    rcsRow.classId,
  );
  if (!allowed) {
    res.status(403).json({ error: "You are not authorized to update status for this class" });
    return;
  }

  const updates: Record<string, unknown> = { status };
  if (status === "approved") {
    updates.approvedBy = req.session.userId;
    updates.approvedAt = new Date();
  }

  const [rcs] = await db
    .update(reportCardStatusTable)
    .set(updates)
    .where(eq(reportCardStatusTable.id, id))
    .returning();
  if (!rcs) {
    res.status(404).json({ error: "Report card status not found" });
    return;
  }

  await logAudit(
    req.session.userId ?? null,
    "UPDATE",
    "report_card_status",
    rcs.id,
    JSON.stringify(rcsRow),
    JSON.stringify(rcs)
  );

  const [row] = await db
    .select({
      id: reportCardStatusTable.id,
      classId: reportCardStatusTable.classId,
      className: classesTable.name,
      termId: reportCardStatusTable.termId,
      termName: termsTable.name,
      status: reportCardStatusTable.status,
      approvedBy: reportCardStatusTable.approvedBy,
      approvedAt: reportCardStatusTable.approvedAt,
    })
    .from(reportCardStatusTable)
    .leftJoin(classesTable, eq(reportCardStatusTable.classId, classesTable.id))
    .leftJoin(termsTable, eq(reportCardStatusTable.termId, termsTable.id))
    .where(eq(reportCardStatusTable.id, id));

  res.json(row);
});

// POST /report-card-status/class/:classId/term/:termId
router.post(
  "/report-card-status/class/:classId/term/:termId",
  requireAuth,
  async (req, res): Promise<void> => {
    const classId = parseInt(
      Array.isArray(req.params.classId) ? req.params.classId[0] : req.params.classId,
      10,
    );
    const termId = parseInt(
      Array.isArray(req.params.termId) ? req.params.termId[0] : req.params.termId,
      10,
    );

    const allowed = await userCanManageStatus(
      req.session.role!,
      req.session.teacherId ?? null,
      classId,
    );
    if (!allowed) {
      res.status(403).json({ error: "You are not authorized to initialize status for this class" });
      return;
    }

    const [existing] = await db
      .select()
      .from(reportCardStatusTable)
      .where(
        and(eq(reportCardStatusTable.classId, classId), eq(reportCardStatusTable.termId, termId)),
      );

    if (existing) {
      res.status(400).json({ error: "Report card status already exists for this class+term" });
      return;
    }

    const [rcs] = await db
      .insert(reportCardStatusTable)
      .values({ classId, termId, status: "draft" })
      .returning();

    await logAudit(
      req.session.userId ?? null,
      "INSERT",
      "report_card_status",
      rcs.id,
      null,
      JSON.stringify(rcs)
    );

    const [row] = await db
      .select({
        id: reportCardStatusTable.id,
        classId: reportCardStatusTable.classId,
        className: classesTable.name,
        termId: reportCardStatusTable.termId,
        termName: termsTable.name,
        status: reportCardStatusTable.status,
        approvedBy: reportCardStatusTable.approvedBy,
        approvedAt: reportCardStatusTable.approvedAt,
      })
      .from(reportCardStatusTable)
      .leftJoin(classesTable, eq(reportCardStatusTable.classId, classesTable.id))
      .leftJoin(termsTable, eq(reportCardStatusTable.termId, termsTable.id))
      .where(eq(reportCardStatusTable.id, rcs.id));

    res.status(201).json(row);
  },
);

// GET /report-cards/:studentId/:termId
router.get("/report-cards/:studentId/:termId", requireAuth, async (req, res): Promise<void> => {
  const studentId = parseInt(
    Array.isArray(req.params.studentId) ? req.params.studentId[0] : req.params.studentId,
    10,
  );
  const termId = parseInt(
    Array.isArray(req.params.termId) ? req.params.termId[0] : req.params.termId,
    10,
  );

  const [student] = await db
    .select({
      id: studentsTable.id,
      fullName: studentsTable.fullName,
      studentIdNumber: studentsTable.studentIdNumber,
      classId: studentsTable.classId,
      className: classesTable.name,
      guardianName: studentsTable.guardianName,
    })
    .from(studentsTable)
    .leftJoin(classesTable, eq(studentsTable.classId, classesTable.id))
    .where(eq(studentsTable.id, studentId));

  if (!student) {
    res.status(404).json({ error: "Student not found" });
    return;
  }

  // Teacher Access Audit: ensure teacher is assigned to this student's class
  if (req.session.role === "teacher") {
    const teacherId = req.session.teacherId;
    if (!teacherId) {
      res.status(403).json({ error: "No teacher profile associated with this account" });
      return;
    }
    
    const [cls] = await db
      .select()
      .from(classesTable)
      .where(and(eq(classesTable.id, student.classId!), eq(classesTable.classTeacherId, teacherId)));
      
    if (!cls) {
      const assignments = await db
        .select()
        .from(teacherAssignmentsTable)
        .innerJoin(classSubjectsTable, eq(teacherAssignmentsTable.classSubjectId, classSubjectsTable.id))
        .where(and(
          eq(teacherAssignmentsTable.teacherId, teacherId),
          eq(classSubjectsTable.classId, student.classId!)
        ));
      
      if (assignments.length === 0) {
        res.status(403).json({ error: "You are not authorized to view report cards for this student" });
        return;
      }
    }
  }

  // Parent Access Audit: ensure parent only sees their linked child's card
  if (req.session.role === "parent") {
    const [currentUser] = await db
      .select({ fullName: usersTable.fullName })
      .from(usersTable)
      .where(eq(usersTable.id, req.session.userId!));

    const parentName = currentUser?.fullName;
    if (!parentName || !student.guardianName || student.guardianName.toLowerCase() !== parentName.toLowerCase()) {
      res.status(403).json({ error: "You are not authorized to view report cards for this student" });
      return;
    }
  }

  const [term] = await db
    .select({ name: termsTable.name, academicYearLabel: academicYearsTable.yearLabel })
    .from(termsTable)
    .leftJoin(academicYearsTable, eq(termsTable.academicYearId, academicYearsTable.id))
    .where(eq(termsTable.id, termId));

  // Get all class subjects for this student's class
  const classSubjects = await db
    .select({
      id: classSubjectsTable.id,
      subjectId: subjectsTable.id,
      subjectName: subjectsTable.name,
      subjectCode: subjectsTable.code,
    })
    .from(classSubjectsTable)
    .leftJoin(subjectsTable, eq(classSubjectsTable.subjectId, subjectsTable.id))
    .where(eq(classSubjectsTable.classId, student.classId!));

  // Pre-fetch grading scale ONCE for caching
  const cachedGradingScales = await db.select().from(gradingScaleTable);

  // Get all students in this class for ranking
  const classStudents = await db
    .select({ id: studentsTable.id })
    .from(studentsTable)
    .where(eq(studentsTable.classId, student.classId!));

  // Compute totals for all students for ranking
  const studentTotals: Record<number, number> = {};
  for (const cs of classStudents) {
    let totalAvg = 0;
    for (const subj of classSubjects) {
      const { total } = await computeSubjectTotal(cs.id, subj.id, termId);
      totalAvg += total;
    }
    studentTotals[cs.id] = classSubjects.length > 0 ? totalAvg / classSubjects.length : 0;
  }

  // Overall position
  const sortedStudents = Object.entries(studentTotals)
    .sort(([, a], [, b]) => b - a)
    .map(([id]) => parseInt(id, 10));
  const overallPosition = sortedStudents.indexOf(studentId) + 1;
  const overallAverage = Math.round((studentTotals[studentId] ?? 0) * 100) / 100;

  // Subject results with class stats and per-subject rankings
  const isPrimaryClass = student.className ? !student.className.startsWith("JHS") : false;
  const subjectResults = [];
  for (const subj of classSubjects) {
    const { total, componentScores } = await computeSubjectTotal(studentId, subj.id, termId);
    const { grade, remark } = await lookupGrade(total, isPrimaryClass, cachedGradingScales);

    // Class stats for this subject
    const subjectTotals: number[] = [];
    for (const cs of classStudents) {
      const { total: t } = await computeSubjectTotal(cs.id, subj.id, termId);
      subjectTotals.push(t);
    }
    const sortedSubjectTotals = [...subjectTotals].sort((a, b) => b - a);
    const subjectRank = sortedSubjectTotals.indexOf(total) + 1;
    const classAverage = subjectTotals.length > 0
      ? Math.round((subjectTotals.reduce((a, b) => a + b, 0) / subjectTotals.length) * 100) / 100
      : 0;
    const classHighest = subjectTotals.length > 0 ? Math.max(...subjectTotals) : 0;
    const classLowest = subjectTotals.length > 0 ? Math.min(...subjectTotals) : 0;

    subjectResults.push({
      subjectId: subj.subjectId,
      subjectName: subj.subjectName,
      subjectCode: subj.subjectCode,
      total,
      grade,
      remark,
      subjectRank,
      classAverage,
      classHighest,
      classLowest,
      componentScores,
    });
  }

  // Report card publication status
  const [rcs] = await db
    .select({ status: reportCardStatusTable.status })
    .from(reportCardStatusTable)
    .where(
      and(
        eq(reportCardStatusTable.classId, student.classId!),
        eq(reportCardStatusTable.termId, termId),
      ),
    );

  // Fetch term metadata
  const [metadata] = await db
    .select()
    .from(studentTermMetadataTable)
    .where(
      and(
        eq(studentTermMetadataTable.studentId, studentId),
        eq(studentTermMetadataTable.termId, termId),
      ),
    );

  res.json({
    studentId,
    studentName: student.fullName,
    studentIdNumber: student.studentIdNumber,
    className: student.className,
    termName: term?.name ?? "",
    academicYear: term?.academicYearLabel ?? "",
    overallAverage,
    overallPosition,
    totalStudents: classStudents.length,
    subjectResults,
    reportCardStatus: rcs?.status ?? "draft",
    metadata: metadata ? {
      daysOpened: metadata.daysOpened,
      daysPresent: metadata.daysPresent,
      conduct: metadata.conduct,
      attitude: metadata.attitude,
      interest: metadata.interest,
      teacherRemarks: metadata.teacherRemarks,
      headmasterRemarks: metadata.headmasterRemarks,
    } : null,
  });
});

// GET /report-cards/:studentId/:termId/export
router.get("/report-cards/:studentId/:termId/export", requireAuth, async (req, res): Promise<void> => {
  const studentId = parseInt(
    Array.isArray(req.params.studentId) ? req.params.studentId[0] : req.params.studentId,
    10,
  );
  const termId = parseInt(
    Array.isArray(req.params.termId) ? req.params.termId[0] : req.params.termId,
    10,
  );

  const [student] = await db
    .select({
      id: studentsTable.id,
      fullName: studentsTable.fullName,
      studentIdNumber: studentsTable.studentIdNumber,
      classId: studentsTable.classId,
      className: classesTable.name,
      guardianName: studentsTable.guardianName,
      classTeacherName: usersTable.fullName,
    })
    .from(studentsTable)
    .leftJoin(classesTable, eq(studentsTable.classId, classesTable.id))
    .leftJoin(teachersTable, eq(classesTable.classTeacherId, teachersTable.id))
    .leftJoin(usersTable, eq(teachersTable.userId, usersTable.id))
    .where(eq(studentsTable.id, studentId));

  if (!student) {
    res.status(404).json({ error: "Student not found" });
    return;
  }

  // Teacher Access Audit
  if (req.session.role === "teacher") {
    const teacherId = req.session.teacherId;
    if (!teacherId) {
      res.status(403).json({ error: "No teacher profile associated with this account" });
      return;
    }
    const [cls] = await db
      .select()
      .from(classesTable)
      .where(and(eq(classesTable.id, student.classId!), eq(classesTable.classTeacherId, teacherId)));
      
    if (!cls) {
      const assignments = await db
        .select()
        .from(teacherAssignmentsTable)
        .innerJoin(classSubjectsTable, eq(teacherAssignmentsTable.classSubjectId, classSubjectsTable.id))
        .where(and(
          eq(teacherAssignmentsTable.teacherId, teacherId),
          eq(classSubjectsTable.classId, student.classId!)
        ));
      
      if (assignments.length === 0) {
        res.status(403).json({ error: "You are not authorized to view report cards for this student" });
        return;
      }
    }
  }

  // Parent Access Audit
  if (req.session.role === "parent") {
    const [currentUser] = await db
      .select({ fullName: usersTable.fullName })
      .from(usersTable)
      .where(eq(usersTable.id, req.session.userId!));

    const parentName = currentUser?.fullName;
    if (!parentName || !student.guardianName || student.guardianName.toLowerCase() !== parentName.toLowerCase()) {
      res.status(403).json({ error: "You are not authorized to view report cards for this student" });
      return;
    }
  }

  const [term] = await db
    .select({ name: termsTable.name, academicYearLabel: academicYearsTable.yearLabel })
    .from(termsTable)
    .leftJoin(academicYearsTable, eq(termsTable.academicYearId, academicYearsTable.id))
    .where(eq(termsTable.id, termId));

  const classSubjects = await db
    .select({
      id: classSubjectsTable.id,
      subjectId: subjectsTable.id,
      subjectName: subjectsTable.name,
      subjectCode: subjectsTable.code,
    })
    .from(classSubjectsTable)
    .leftJoin(subjectsTable, eq(classSubjectsTable.subjectId, subjectsTable.id))
    .where(eq(classSubjectsTable.classId, student.classId!));

  const classStudents = await db
    .select({ id: studentsTable.id })
    .from(studentsTable)
    .where(eq(studentsTable.classId, student.classId!));

  const studentTotals: Record<number, number> = {};
  for (const cs of classStudents) {
    let totalAvg = 0;
    for (const subj of classSubjects) {
      const { total } = await computeSubjectTotal(cs.id, subj.id, termId);
      totalAvg += total;
    }
    studentTotals[cs.id] = classSubjects.length > 0 ? totalAvg / classSubjects.length : 0;
  }

  const sortedStudents = Object.entries(studentTotals)
    .sort(([, a], [, b]) => b - a)
    .map(([id]) => parseInt(id, 10));
  const overallPosition = sortedStudents.indexOf(studentId) + 1;
  const overallAverage = Math.round((studentTotals[studentId] ?? 0) * 100) / 100;
  const isPrimary = !(student.className || "").toLowerCase().includes("jhs");

  const subjectResults = [];
  let totalScore = 0;
  for (const subj of classSubjects) {
    const { total, componentScores } = await computeSubjectTotal(studentId, subj.id, termId);
    totalScore += total;
    const { grade, remark } = await lookupGrade(total, isPrimary);

    const subjectTotalsList: number[] = [];
    for (const cs of classStudents) {
      const { total: t } = await computeSubjectTotal(cs.id, subj.id, termId);
      subjectTotalsList.push(t);
    }
    const sortedSubjectTotals = [...subjectTotalsList].sort((a, b) => b - a);
    const subjectRank = sortedSubjectTotals.indexOf(total) + 1;
    const classAverage = subjectTotalsList.length > 0
      ? Math.round((subjectTotalsList.reduce((a, b) => a + b, 0) / subjectTotalsList.length) * 100) / 100
      : 0;
    const classHighest = subjectTotalsList.length > 0 ? Math.max(...subjectTotalsList) : 0;
    const classLowest = subjectTotalsList.length > 0 ? Math.min(...subjectTotalsList) : 0;

    subjectResults.push({
      subjectId: subj.subjectId,
      subjectName: subj.subjectName,
      subjectCode: subj.subjectCode,
      total,
      grade,
      remark,
      subjectRank,
      classAverage,
      classHighest,
      classLowest,
      componentScores,
    });
  }

  const [metadata] = await db
    .select()
    .from(studentTermMetadataTable)
    .where(
      and(
        eq(studentTermMetadataTable.studentId, studentId),
        eq(studentTermMetadataTable.termId, termId),
      ),
    );

  // Fetch school fees billed and paid for this student in this term
  // Fetch all school fees billed and paid for this student across all terms to populate terminal bills
  const allStudentFees = await db
    .select({
      amountDue: studentFeesTable.amountDue,
      amountPaid: studentFeesTable.amountPaid,
      feeName: feeTypesTable.name,
      termId: studentFeesTable.termId,
    })
    .from(studentFeesTable)
    .innerJoin(feeTypesTable, eq(studentFeesTable.feeTypeId, feeTypesTable.id))
    .where(eq(studentFeesTable.studentId, studentId));

  let schoolFeesCurrent = 0;
  let schoolFeesArrears = 0;
  let classesFeesArrears = 0;
  let uniformsArrears = 0;
  let feedingFeesArrears = 0;
  let booksArrears = 0;
  let printingArrears = 0;

  for (const fee of allStudentFees) {
    const due = parseFloat(fee.amountDue);
    const paid = parseFloat(fee.amountPaid);
    const outstanding = due - paid;

    if (outstanding <= 0.01) continue;

    const name = fee.feeName.toLowerCase();
    
    if (fee.termId === termId) {
      // Current Term Bills
      if (name.includes("school fees") || name.includes("tuition")) {
        schoolFeesCurrent += outstanding;
      } else if (name.includes("class")) {
        classesFeesArrears += outstanding;
      } else if (name.includes("uniform")) {
        uniformsArrears += outstanding;
      } else if (name.includes("feeding") || name.includes("canteen")) {
        feedingFeesArrears += outstanding;
      } else if (name.includes("book")) {
        booksArrears += outstanding;
      } else if (name.includes("printing") || name.includes("exam")) {
        printingArrears += outstanding;
      } else {
        schoolFeesCurrent += outstanding;
      }
    } else {
      // Previous Terms Arrears
      if (name.includes("school fees") || name.includes("tuition")) {
        schoolFeesArrears += outstanding;
      } else if (name.includes("class")) {
        classesFeesArrears += outstanding;
      } else if (name.includes("uniform")) {
        uniformsArrears += outstanding;
      } else if (name.includes("feeding") || name.includes("canteen")) {
        feedingFeesArrears += outstanding;
      } else if (name.includes("book")) {
        booksArrears += outstanding;
      } else if (name.includes("printing") || name.includes("exam")) {
        printingArrears += outstanding;
      } else {
        schoolFeesArrears += outstanding;
      }
    }
  }

  const totalOutstandingBill = schoolFeesCurrent + schoolFeesArrears + classesFeesArrears + uniformsArrears + feedingFeesArrears + booksArrears + printingArrears;

  // Initialize PDF document - A4 size is 595.28 x 841.89
  const doc = new PDFDocument({ size: "A4", margin: 40 });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="report-card-${(student.fullName || "Student").replace(/\s+/g, "_")}.pdf"`
  );

  doc.pipe(res);

  // Outer border
  doc.rect(20, 20, 555.28, 801.89).lineWidth(1).stroke("#111827");

  // Logo loading
  const logoPaths = [
    path.join(process.cwd(), "artifacts/school-report/public/logo.png"),
    path.join(process.cwd(), "../school-report/public/logo.png"),
    path.join(process.cwd(), "school-report/public/logo.png"),
    "C:/Users/Afriyie/School_Management_System/artifacts/school-report/public/logo.png"
  ];
  let logoPath = "";
  for (const p of logoPaths) {
    if (fs.existsSync(p)) {
      logoPath = p;
      break;
    }
  }

  // Draw Left & Right Logos
  if (logoPath) {
    doc.image(logoPath, 35, 30, { width: 50 });
    doc.image(logoPath, 510, 30, { width: 50 });
  }

  // Header Title Text
  doc.fillColor("#111827");
  doc.font("Helvetica-Bold").fontSize(15).text("TAIFA EBENEZER PREP. & JHS", 95, 33, { align: "center", width: 405 });
  doc.fontSize(8).font("Helvetica").text("P.O. BOX TA 198 | TAIFA-ACCRA", 95, 51, { align: "center", width: 405 });
  doc.text("TEL: 0244085581 / 0245502914", 95, 63, { align: "center", width: 405 });

  // Report Card Sub-Header Box
  doc.rect(35, 80, 525, 16).stroke("#111827");
  doc.fontSize(8).font("Helvetica-Bold").text("END OF SECOND TERM REPORT: PRIMARY", 40, 84);

  // Student Info Box (y=98 to 158)
  doc.rect(35, 98, 435, 60).stroke("#111827");
  doc.rect(470, 98, 90, 60).stroke("#111827"); // PASSPORT PICTURE Slot
  doc.fontSize(7).font("Helvetica-Bold").text("PASSPORT\n\nPICTURE", 470, 115, { align: "center", width: 90 });

  // Student Info Rows
  doc.fontSize(7.5).font("Helvetica-Bold").text("NAME:", 40, 104);
  doc.font("Helvetica").text((student.fullName || "").toUpperCase(), 80, 104);
  doc.moveTo(270, 98).lineTo(270, 158).stroke("#111827");
  doc.font("Helvetica-Bold").text("ADMIN N°:", 275, 104);
  doc.font("Helvetica").text(student.studentIdNumber || "N/A", 330, 104);
  doc.moveTo(35, 118).lineTo(470, 118).stroke("#111827");

  doc.font("Helvetica-Bold").text("CLASS:", 40, 124);
  doc.font("Helvetica").text(student.className || "N/A", 80, 124);
  doc.moveTo(125, 118).lineTo(125, 138).stroke("#111827");
  doc.font("Helvetica-Bold").text("Term:", 130, 124);
  doc.font("Helvetica").text(term?.name ?? "N/A", 160, 124);
  doc.moveTo(205, 118).lineTo(205, 138).stroke("#111827");
  doc.font("Helvetica-Bold").text("Class Size:", 210, 124);
  doc.font("Helvetica").text(String(classStudents.length), 255, 124);
  doc.font("Helvetica-Bold").text("Learner's Total Score:", 275, 124);
  doc.font("Helvetica").text(String(totalScore), 380, 124);
  doc.moveTo(35, 138).lineTo(470, 138).stroke("#111827");

  doc.font("Helvetica-Bold").text("Next Term Re-\nopening Date", 40, 142);
  doc.font("Helvetica").text("08-09-2026", 115, 146);
  doc.font("Helvetica-Bold").text("Vacation\ndate", 275, 142);
  doc.font("Helvetica").text("31-07-2026", 325, 146);

  // Assessment Report Legend Grid (y=164 to 220)
  doc.rect(35, 164, 525, 10).fill("#111827");
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(7).text("ASSESSMENT REPORT", 35, 166, { align: "center", width: 525 });

  doc.rect(35, 174, 525, 48).stroke("#111827");
  doc.moveTo(110, 174).lineTo(110, 222).stroke("#111827");
  doc.moveTo(180, 174).lineTo(180, 222).stroke("#111827");
  doc.moveTo(270, 174).lineTo(270, 222).stroke("#111827");
  doc.moveTo(35, 182).lineTo(525, 182).stroke("#111827");

  doc.fillColor("#111827").font("Helvetica-Bold").fontSize(6.5);
  doc.text("MARKS", 40, 176);
  doc.text("GRADING", 115, 176);
  doc.text("REMARKS", 185, 176);
  doc.text("GRADE DESCRIPTION", 275, 176);

  doc.font("Helvetica").fontSize(5.5);
  const legendRows = [
    { m: "100 - 80", g: "A", r: "ADVANCE", d: "Learner exceeds core requirement in terms of knowledge, skills and understanding and can transfer them automatically and flexibly through authentic performance tasks" },
    { m: "79 - 68", g: "P", r: "PROFICIENCY", d: "Learner develops fundamental knowledge, skills and core understanding and transfers them independently through authentic performance tasks" },
    { m: "67 - 54", g: "AP", r: "APPROACHING PROFICIENCY", d: "Learner develops fundamental knowledge, skills and core understanding; with little guidance; can transfer understanding through authentic performance task" },
    { m: "53 - 40", g: "D", r: "DEVELOPING", d: "Learner possesses the minimum knowledge and skills but needs, help throughout the performance of authentic tasks." },
    { m: "39 - Below", g: "B", r: "BEGINNING", d: "Learner is struggling with his/her understanding due to lack of essential knowledge and skills." }
  ];

  let legendY = 185;
  for (const row of legendRows) {
    doc.text(row.m, 40, legendY);
    doc.text(row.g, 115, legendY);
    doc.text(row.r, 185, legendY);
    doc.text(row.d, 275, legendY, { width: 280 });
    legendY += 7.2;
    if (legendY < 220) {
      doc.moveTo(35, legendY).lineTo(560, legendY).stroke("#e5e7eb");
    }
  }

  // Subjects Table Grid (y=226 to 382)
  doc.rect(35, 226, 525, 156).stroke("#111827");
  doc.moveTo(215, 226).lineTo(215, 382).stroke("#111827");
  doc.moveTo(295, 226).lineTo(295, 382).stroke("#111827");
  doc.moveTo(375, 226).lineTo(375, 382).stroke("#111827");
  doc.moveTo(415, 226).lineTo(415, 382).stroke("#111827");
  doc.moveTo(455, 226).lineTo(455, 382).stroke("#111827");

  // Sub headers for SBA and Exam
  doc.moveTo(215, 238).lineTo(375, 238).stroke("#111827");
  doc.moveTo(255, 238).lineTo(255, 371).stroke("#111827");
  doc.moveTo(335, 238).lineTo(335, 371).stroke("#111827");
  doc.moveTo(35, 250).lineTo(560, 250).stroke("#111827");

  doc.font("Helvetica-Bold").fontSize(7);
  doc.text("SUBJECTS", 40, 235);
  doc.text("CLASS WORK", 215, 229, { width: 80, align: "center" });
  doc.text("100%", 215, 240, { width: 40, align: "center" });
  doc.text("50%", 255, 240, { width: 40, align: "center" });
  doc.text("EXAMINATION", 295, 229, { width: 80, align: "center" });
  doc.text("100%", 295, 240, { width: 40, align: "center" });
  doc.text("50%", 335, 240, { width: 40, align: "center" });
  doc.text("TOTAL\n100%", 375, 232, { width: 40, align: "center" });
  doc.text("GRADE", 415, 235, { width: 40, align: "center" });
  doc.text("REMARK", 455, 235, { width: 105, align: "center" });

  let subjectY = 253;
  for (const sub of subjectResults) {
    const classWorkComp = sub.componentScores?.find(c => c.componentName.toLowerCase().includes("class") || c.componentName.toLowerCase().includes("sba"));
    const examComp = sub.componentScores?.find(c => c.componentName.toLowerCase().includes("exam") || c.componentName.toLowerCase().includes("test"));

    const classWorkRaw = classWorkComp ? classWorkComp.scoreValue : 0;
    const classWorkMax = classWorkComp ? classWorkComp.maxScore : 100;
    const classWorkPct = Math.round((classWorkRaw / classWorkMax) * 100);
    const classWorkWeighted = classWorkComp ? classWorkComp.weightedScore : 0;

    const examRaw = examComp ? examComp.scoreValue : 0;
    const examMax = examComp ? examComp.maxScore : 100;
    const examPct = Math.round((examRaw / examMax) * 100);
    const examWeighted = examComp ? examComp.weightedScore : 0;

    doc.moveTo(35, subjectY + 9).lineTo(560, subjectY + 9).stroke("#e5e7eb");

    doc.fillColor("#111827").font("Helvetica-Bold").fontSize(6.5).text(sub.subjectName || "", 40, subjectY);
    doc.font("Helvetica").fontSize(7);
    doc.text(String(Math.round(classWorkPct)), 215, subjectY, { width: 40, align: "center" });
    doc.text(String(Math.round(classWorkWeighted)), 255, subjectY, { width: 40, align: "center" });
    doc.text(String(Math.round(examPct)), 295, subjectY, { width: 40, align: "center" });
    doc.text(String(Math.round(examWeighted)), 335, subjectY, { width: 40, align: "center" });
    doc.font("Helvetica-Bold").text(String(Math.round(sub.total)), 375, subjectY, { width: 40, align: "center" });
    doc.text(sub.grade || "N/A", 415, subjectY, { width: 40, align: "center" });
    doc.font("Helvetica").text(sub.remark || "N/A", 460, subjectY);

    subjectY += 10.7;
  }

  // TOTAL Row in Subjects Grid
  doc.moveTo(35, 371).lineTo(560, 371).stroke("#111827");
  doc.font("Helvetica-Bold").fontSize(7.5).text("TOTAL", 40, 373);
  doc.text(String(Math.round(totalScore)), 375, 373, { width: 40, align: "center" });

  // Attendance block (y=388 to 400)
  doc.rect(35, 388, 525, 12).stroke("#111827");
  doc.font("Helvetica-Bold").fontSize(7).text("LEARNER'S TOTAL ATTENDANCE:", 40, 391);
  const attendanceStr = metadata ? `${metadata.daysPresent}` : "0";
  doc.font("Helvetica").text(attendanceStr, 175, 391);
  doc.moveTo(270, 388).lineTo(270, 400).stroke("#111827");
  doc.font("Helvetica-Bold").text("TOTAL SCHOOL DAYS:", 275, 391);
  const totalDaysStr = metadata ? `${metadata.daysOpened}` : "0";
  doc.font("Helvetica").text(totalDaysStr, 385, 391);

  // Competencies & Bills Panel (y=406 to 530)
  doc.rect(35, 406, 525, 120).stroke("#111827");
  doc.moveTo(280, 406).lineTo(280, 526).stroke("#111827");

  // Left Column - Assessment on Core Competencies
  doc.rect(35, 406, 245, 12).fill("#111827");
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(6.5).text("ASSESSMENT ON CORE COMPETENCIES", 40, 409);
  doc.text("SCORE", 210, 409);
  doc.text("GRADE", 245, 409);
  doc.moveTo(205, 406).lineTo(205, 526).stroke("#111827");
  doc.moveTo(240, 406).lineTo(240, 526).stroke("#111827");

  const competencyGrade = overallAverage >= 80 ? "A" : (overallAverage >= 68 ? "P" : (overallAverage >= 54 ? "AP" : (overallAverage >= 40 ? "D" : "B")));
  const competencyMap = [
    "Critical Thinking and Problem Solving",
    "Creativity and Innovation",
    "Communication Skills and Collaboration Skills",
    "Cultural Identity and Global Citizenship",
    "Personal Development and Leadership Skills",
    "Digital Literacy"
  ];

  let compY = 422;
  doc.fillColor("#111827").font("Helvetica").fontSize(6);
  for (const compName of competencyMap) {
    doc.text(compName, 40, compY, { width: 160 });
    doc.text(competencyGrade, 245, compY, { width: 30, align: "center" });
    compY += 14.8;
    if (compY < 510) {
      doc.moveTo(35, compY - 3).lineTo(280, compY - 3).stroke("#e5e7eb");
    }
  }

  // Core Competency Total Row
  doc.moveTo(35, 511).lineTo(280, 511).stroke("#111827");
  doc.font("Helvetica-Bold").text("TOTAL SCORE FOR CORE COMPETENCY", 40, 516);
  doc.text(String(Math.round(totalScore)), 210, 516, { width: 30, align: "center" });

  // Right Column - Terminal Bills
  doc.rect(280, 406, 280, 12).fill("#111827");
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(7).text("TERMINAL BILLS", 290, 409);
  doc.moveTo(480, 406).lineTo(480, 526).stroke("#111827");

  const billMap = [
    { label: "SCHOOL FEES", val: schoolFeesCurrent },
    { label: "SCHOOL FEES ARREARS", val: schoolFeesArrears },
    { label: "CLASSES FEES ARREARS", val: classesFeesArrears },
    { label: "UNIFORMS ARREARS", val: uniformsArrears },
    { label: "FEEDING FEES ARREARS", val: feedingFeesArrears },
    { label: "BOOKS FEE ARREARS", val: booksArrears },
    { label: "PRINTING FEE ARREARS", val: printingArrears }
  ];

  let billY = 422;
  doc.fillColor("#111827").font("Helvetica").fontSize(6);
  for (const bill of billMap) {
    doc.text(bill.label, 290, billY);
    if (bill.val > 0) {
      doc.text(bill.val.toFixed(2), 485, billY, { width: 70, align: "right" });
    }
    billY += 12.8;
    if (billY < 510) {
      doc.moveTo(280, billY - 2).lineTo(560, billY - 2).stroke("#e5e7eb");
    }
  }

  // Terminal Bills Total Row
  doc.moveTo(280, 511).lineTo(560, 511).stroke("#111827");
  doc.font("Helvetica-Bold").text("TOTAL(GHC)", 290, 516);
  doc.text(totalOutstandingBill.toFixed(2), 485, 516, { width: 70, align: "right" });

  // Teacher info names and signatures (y=540)
  doc.font("Helvetica-Bold").fontSize(7.5).text("Class teacher's Name:", 35, 545);
  doc.font("Helvetica").text(student.classTeacherName || "MISS EVELYN NYONATOR", 130, 545);

  doc.font("Helvetica-Bold").text("Head teacher's Name:", 295, 545);
  doc.font("Helvetica").text("STEPHEN K. ADUKOR (SIR ZITO)", 395, 545);

  // Signature dividers
  doc.moveTo(35, 595).lineTo(180, 595).lineWidth(0.8).stroke("#111827");
  doc.font("Helvetica-Bold").text("Signature:", 35, 600);

  doc.moveTo(380, 595).lineTo(525, 595).stroke("#111827");
  doc.font("Helvetica-Bold").text("Sign:", 380, 600);

  doc.end();
});

// GET /report-cards/class/:classId/term/:termId
router.get(
  "/report-cards/class/:classId/term/:termId",
  requireTeacher,
  async (req, res): Promise<void> => {
    const classId = parseInt(
      Array.isArray(req.params.classId) ? req.params.classId[0] : req.params.classId,
      10,
    );
    const termId = parseInt(
      Array.isArray(req.params.termId) ? req.params.termId[0] : req.params.termId,
      10,
    );

    // Enforce that a teacher is assigned to at least one subject in this class+term
    if (req.session.role !== "admin") {
      const teacherId = req.session.teacherId ?? null;
      if (!teacherId) {
        res.status(403).json({ error: "No teacher profile associated with this account" });
        return;
      }

      const [ledClass] = await db
        .select({ id: classesTable.id })
        .from(classesTable)
        .where(and(eq(classesTable.id, classId), eq(classesTable.classTeacherId, teacherId)));

      const [assignment] = await db
        .select({ id: teacherAssignmentsTable.id })
        .from(teacherAssignmentsTable)
        .innerJoin(classSubjectsTable, eq(teacherAssignmentsTable.classSubjectId, classSubjectsTable.id))
        .where(
          and(
            eq(teacherAssignmentsTable.teacherId, teacherId),
            eq(classSubjectsTable.classId, classId),
            eq(teacherAssignmentsTable.termId, termId),
          ),
        );

      if (!ledClass && !assignment) {
        res.status(403).json({ error: "You are not authorized to access reports for this class" });
        return;
      }
    }

    const classStudents = await db
      .select({ id: studentsTable.id })
      .from(studentsTable)
      .where(eq(studentsTable.classId, classId));

    // Build each student's report card (simplified - reuse the logic inline)
    const reportCards = [];
    for (const s of classStudents) {
      // Make a sub-request conceptually by calling the same logic
      const [student] = await db
        .select({
          id: studentsTable.id,
          fullName: studentsTable.fullName,
          studentIdNumber: studentsTable.studentIdNumber,
          classId: studentsTable.classId,
          className: classesTable.name,
        })
        .from(studentsTable)
        .leftJoin(classesTable, eq(studentsTable.classId, classesTable.id))
        .where(eq(studentsTable.id, s.id));

      const [term] = await db
        .select({ name: termsTable.name, academicYearLabel: academicYearsTable.yearLabel })
        .from(termsTable)
        .leftJoin(academicYearsTable, eq(termsTable.academicYearId, academicYearsTable.id))
        .where(eq(termsTable.id, termId));

      const classSubjects = await db
        .select({
          id: classSubjectsTable.id,
          subjectId: subjectsTable.id,
          subjectName: subjectsTable.name,
          subjectCode: subjectsTable.code,
        })
        .from(classSubjectsTable)
        .leftJoin(subjectsTable, eq(classSubjectsTable.subjectId, subjectsTable.id))
        .where(eq(classSubjectsTable.classId, classId));

      let subjectTotalsSum = 0;
      const subjectResults = [];
      for (const subj of classSubjects) {
        const { total, componentScores } = await computeSubjectTotal(s.id, subj.id, termId);
        const { grade, remark } = await lookupGrade(total);
        subjectTotalsSum += total;
        subjectResults.push({
          subjectId: subj.subjectId,
          subjectName: subj.subjectName,
          subjectCode: subj.subjectCode,
          total,
          grade,
          remark,
          subjectRank: 0, // computed after all students
          classAverage: 0,
          classHighest: 0,
          classLowest: 0,
          componentScores,
        });
      }

      reportCards.push({
        studentId: s.id,
        studentName: student?.fullName ?? "",
        studentIdNumber: student?.studentIdNumber ?? "",
        className: student?.className ?? "",
        termName: term?.name ?? "",
        academicYear: term?.academicYearLabel ?? "",
        overallAverage: classSubjects.length > 0
          ? Math.round((subjectTotalsSum / classSubjects.length) * 100) / 100
          : 0,
        overallPosition: 0, // computed after
        totalStudents: classStudents.length,
        subjectResults,
        reportCardStatus: "draft" as const,
      });
    }

    // Compute overall positions
    const sorted = [...reportCards].sort((a, b) => b.overallAverage - a.overallAverage);
    for (const rc of reportCards) {
      rc.overallPosition = sorted.findIndex(s => s.studentId === rc.studentId) + 1;
    }

    const [rcs] = await db
      .select({ status: reportCardStatusTable.status })
      .from(reportCardStatusTable)
      .where(
        and(eq(reportCardStatusTable.classId, classId), eq(reportCardStatusTable.termId, termId)),
      );

    for (const rc of reportCards) {
      (rc as any).reportCardStatus = rcs?.status ?? "draft";
    }

    res.json(reportCards);
  },
);

export default router;
