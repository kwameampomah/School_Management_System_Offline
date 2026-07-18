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

  return { total: Math.round(total * 100) / 100, componentScores };
}

// Helper: lookup grade from grading scale
async function lookupGrade(total: number): Promise<{ grade: string; remark: string }> {
  const scales = await db.select().from(gradingScaleTable);
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
  const subjectResults = [];
  for (const subj of classSubjects) {
    const { total, componentScores } = await computeSubjectTotal(studentId, subj.id, termId);
    const { grade, remark } = await lookupGrade(total);

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
    })
    .from(studentsTable)
    .leftJoin(classesTable, eq(studentsTable.classId, classesTable.id))
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

  const subjectResults = [];
  let totalScore = 0;
  for (const subj of classSubjects) {
    const { total, componentScores } = await computeSubjectTotal(studentId, subj.id, termId);
    totalScore += total;
    const { grade, remark } = await lookupGrade(total);

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
  const studentFees = await db
    .select()
    .from(studentFeesTable)
    .where(
      and(
        eq(studentFeesTable.studentId, studentId),
        eq(studentFeesTable.termId, termId)
      )
    );

  let totalFeesDue = 0;
  let totalFeesPaid = 0;
  for (const fee of studentFees) {
    totalFeesDue += parseFloat(fee.amountDue);
    totalFeesPaid += parseFloat(fee.amountPaid);
  }
  const outstandingBalance = totalFeesDue - totalFeesPaid;

  // Initialize PDF document
  const doc = new PDFDocument({ size: "A4", margin: 40 });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="report-card-${(student.fullName || "Student").replace(/\s+/g, "_")}.pdf"`
  );

  doc.pipe(res);

  // Outer border
  doc.rect(20, 20, 555.28, 801.89).stroke("#cccccc");

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

  if (logoPath) {
    doc.image(logoPath, 40, 35, { width: 65 });
  }

  doc.fillColor("#1f2937");
  doc.font("Helvetica-Bold").fontSize(18).text("TAIFA EBENEZER PREP. & J.H.S", 120, 40);
  doc.fontSize(12).font("Helvetica").text("Terminal Report Card", 120, 62);
  doc.fontSize(10).fillColor("#4b5563").text(`Academic Year: ${term?.academicYearLabel ?? ""} | ${term?.name ?? ""}`, 120, 78);

  doc.moveTo(40, 110).lineTo(555, 110).stroke("#e5e7eb");

  // Student Info Block
  doc.fillColor("#111827");
  doc.font("Helvetica-Bold").fontSize(10).text("Student Name:", 40, 125);
  doc.font("Helvetica").text((student.fullName || "").toUpperCase(), 130, 125);

  doc.font("Helvetica-Bold").text("Student ID:", 300, 125);
  doc.font("Helvetica").text(student.studentIdNumber || "N/A", 390, 125);

  doc.font("Helvetica-Bold").text("Class Allocated:", 40, 145);
  doc.font("Helvetica").text(student.className || "N/A", 130, 145);

  doc.font("Helvetica-Bold").text("Term:", 300, 145);
  doc.font("Helvetica").text(term?.name ?? "N/A", 390, 145);

  doc.moveTo(40, 165).lineTo(555, 165).stroke("#e5e7eb");

  // Subjects Table Header
  let y = 180;
  doc.rect(40, y, 515, 20).fill("#111827");
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(9);
  doc.text("Subject Breakdown", 45, y + 6, { width: 180 });
  doc.text("Avg", 240, y + 6, { width: 30, align: "center" });
  doc.text("High", 275, y + 6, { width: 30, align: "center" });
  doc.text("Low", 310, y + 6, { width: 30, align: "center" });
  doc.text("Score", 345, y + 6, { width: 35, align: "center" });
  doc.text("Rank", 385, y + 6, { width: 30, align: "center" });
  doc.text("Grade", 420, y + 6, { width: 35, align: "center" });
  doc.text("Remarks", 460, y + 6, { width: 90 });

  y += 20;

  // Draw Rows
  doc.fillColor("#1f2937").font("Helvetica").fontSize(8);
  for (const sub of subjectResults) {
    if (y > 600) {
      doc.addPage();
      doc.rect(20, 20, 555.28, 801.89).stroke("#cccccc");
      y = 40;
    }

    doc.moveTo(40, y).lineTo(555, y).stroke("#e5e7eb");

    doc.fillColor("#111827").font("Helvetica-Bold").text(sub.subjectName || "", 45, y + 6);
    
    let compText = "";
    if (sub.componentScores && sub.componentScores.length > 0) {
      compText = sub.componentScores.map((c: any) => `${c.componentName || "Component"}: ${c.scoreValue}/${c.maxScore}`).join(" | ");
      doc.fillColor("#4b5563").font("Helvetica-Oblique").fontSize(7).text(compText, 45, y + 16, { width: 180 });
    }

    const rowHeight = compText ? 28 : 20;

    doc.fillColor("#1f2937").font("Helvetica").fontSize(8);
    doc.text(String(sub.classAverage), 240, y + 6, { width: 30, align: "center" });
    doc.text(String(sub.classHighest), 275, y + 6, { width: 30, align: "center" });
    doc.text(String(sub.classLowest), 310, y + 6, { width: 30, align: "center" });
    doc.font("Helvetica-Bold").text(String(sub.total), 345, y + 6, { width: 35, align: "center" });
    doc.font("Helvetica").text(`${sub.subjectRank}/${classStudents.length}`, 385, y + 6, { width: 30, align: "center" });
    doc.font("Helvetica-Bold").text(sub.grade || "N/A", 420, y + 6, { width: 35, align: "center" });
    doc.font("Helvetica").text(sub.remark || "N/A", 460, y + 6, { width: 90 });

    y += rowHeight;
  }

  doc.moveTo(40, y).lineTo(555, y).stroke("#111827");
  y += 15;

  if (y > 600) {
    doc.addPage();
    doc.rect(20, 20, 555.28, 801.89).stroke("#cccccc");
    y = 40;
  }

  const startRemarksY = y;
  // Left column: Behavioral Traits
  doc.fillColor("#111827").font("Helvetica-Bold").fontSize(10).text("ATTENDANCE & BEHAVIOR", 40, y);
  doc.moveTo(40, y + 14).lineTo(280, y + 14).stroke("#e5e7eb");
  
  y += 20;
  doc.fontSize(8).font("Helvetica-Bold").text("Days Present:", 40, y);
  const attendancePct = metadata && metadata.daysOpened > 0 ? Math.round((metadata.daysPresent / metadata.daysOpened) * 100) : 0;
  doc.font("Helvetica").text(metadata ? `${metadata.daysPresent} of ${metadata.daysOpened} (${attendancePct}%)` : "—", 140, y);

  y += 14;
  doc.font("Helvetica-Bold").text("General Conduct:", 40, y);
  doc.font("Helvetica").text((metadata && metadata.conduct) || "—", 140, y);

  y += 14;
  doc.font("Helvetica-Bold").text("Attitude to Work:", 40, y);
  doc.font("Helvetica").text((metadata && metadata.attitude) || "—", 140, y);

  y += 14;
  doc.font("Helvetica-Bold").text("Special Interest:", 40, y);
  doc.font("Helvetica").text((metadata && metadata.interest) || "—", 140, y);

  // Right column: General Remarks
  let rightY = startRemarksY;
  doc.fillColor("#111827").font("Helvetica-Bold").fontSize(10).text("GENERAL COMMENTS", 315, rightY);
  doc.moveTo(315, rightY + 14).lineTo(555, rightY + 14).stroke("#e5e7eb");

  rightY += 20;
  doc.fontSize(8).font("Helvetica-Bold").text("Class Teacher's Remarks:", 315, rightY);
  doc.font("Helvetica-Oblique").text(`"${(metadata && metadata.teacherRemarks) || "A hardworking and pleasant student."}"`, 315, rightY + 12, { width: 240 });

  rightY += 35;
  doc.font("Helvetica-Bold").text("Headmaster's Remarks:", 315, rightY);
  doc.font("Helvetica-Oblique").text(`"${(metadata && metadata.headmasterRemarks) || "Satisfactory terminal results. Promoted."}"`, 315, rightY + 12, { width: 240 });

  y = Math.max(y, rightY + 40) + 15;

  // Overall Summary Panel
  if (y > 640) {
    doc.addPage();
    doc.rect(20, 20, 555.28, 801.89).stroke("#cccccc");
    y = 40;
  }

  doc.rect(40, y, 515, 55).fill("#f3f4f6");
  doc.fillColor("#111827").font("Helvetica-Bold").fontSize(9).text("OVERALL PERFORMANCE SUMMARY", 50, y + 8);
  
  doc.fontSize(8);
  doc.font("Helvetica-Bold").text("Accumulated Score:", 50, y + 24);
  doc.font("Helvetica").text(String(totalScore), 160, y + 24);

  doc.font("Helvetica-Bold").text("Terminal Average:", 50, y + 38);
  doc.font("Helvetica").text(`${overallAverage}%`, 160, y + 38);

  doc.font("Helvetica-Bold").text("Class Position:", 315, y + 24);
  doc.font("Helvetica").text(`${overallPosition} of ${classStudents.length} students`, 405, y + 24);

  y += 65;

  if (y > 700) {
    doc.addPage();
    doc.rect(20, 20, 555.28, 801.89).stroke("#cccccc");
    y = 40;
  }

  // Draw school fees card box
  doc.rect(40, y, 515, 30).fill("#f9fafb");
  doc.rect(40, y, 515, 30).stroke("#e5e7eb");

  doc.fillColor("#111827").font("Helvetica-Bold").fontSize(8).text("SCHOOL FEES STATUS", 50, y + 10);
  doc.font("Helvetica").fillColor("#4b5563").text(`Total Bill: GH₵ ${totalFeesDue.toFixed(2)}`, 180, y + 10);
  doc.text(`Total Paid: GH₵ ${totalFeesPaid.toFixed(2)}`, 300, y + 10);

  if (outstandingBalance > 0.01) {
    doc.fillColor("#b91c1c").font("Helvetica-Bold").text(`Outstanding Balance: GH₵ ${outstandingBalance.toFixed(2)}`, 420, y + 10);
  } else {
    doc.fillColor("#16a34a").font("Helvetica-Bold").text(`Outstanding Balance: GH₵ 0.00 (PAID)`, 420, y + 10);
  }

  y += 45;

  // Signatures
  if (y > 720) {
    doc.addPage();
    doc.rect(20, 20, 555.28, 801.89).stroke("#cccccc");
    y = 40;
  }

  doc.moveTo(50, y + 20).lineTo(220, y + 20).stroke("#9ca3af");
  doc.fillColor("#4b5563").font("Helvetica-Bold").fontSize(8).text("CLASS TEACHER'S SIGNATURE", 50, y + 26, { width: 170, align: "center" });

  doc.moveTo(375, y + 20).lineTo(545, y + 20).stroke("#9ca3af");
  doc.text("HEADMASTER'S SIGNATURE", 375, y + 26, { width: 170, align: "center" });

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
