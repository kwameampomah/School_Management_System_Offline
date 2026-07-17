import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, attendanceTable, studentsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { validate } from "../middlewares/validation";
import { z } from "zod";

const router: IRouter = Router();

const BulkAttendanceSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  termId: z.number(),
  classId: z.number(),
  records: z.array(
    z.object({
      studentId: z.number(),
      status: z.enum(["present", "absent", "late", "excused"]),
      notes: z.string().optional().nullable()
    })
  )
});

// 1. Bulk Upsert Daily Attendance
router.post("/attendance/bulk", requireAuth, validate(BulkAttendanceSchema), async (req, res): Promise<void> => {
  const { date, termId, classId, records } = req.body;
  const userId = req.session.userId ?? null;

  try {
    for (const record of records) {
      await db.insert(attendanceTable)
        .values({
          studentId: record.studentId,
          classId,
          termId,
          attendanceDate: date,
          status: record.status,
          notes: record.notes,
          recordedBy: userId
        })
        .onConflictDoUpdate({
          target: [attendanceTable.studentId, attendanceTable.classId, attendanceTable.attendanceDate],
          set: {
            status: record.status,
            notes: record.notes,
            recordedBy: userId
          }
        });
    }

    res.json({ success: true, message: `Successfully recorded attendance for ${records.length} students.` });
  } catch (error) {
    console.error("Bulk attendance recording failed:", error);
    res.status(500).json({ error: "Failed to record bulk attendance" });
  }
});

// 2. GET Student Attendance Summary for Term
router.get("/attendance/summary/:studentId/:termId", requireAuth, async (req, res): Promise<void> => {
  const studentIdStr = Array.isArray(req.params.studentId) ? req.params.studentId[0] : req.params.studentId;
  const termIdStr = Array.isArray(req.params.termId) ? req.params.termId[0] : req.params.termId;

  const studentId = parseInt(studentIdStr as string, 10);
  const termId = parseInt(termIdStr as string, 10);

  if (isNaN(studentId) || isNaN(termId)) {
    res.status(400).json({ error: "Invalid studentId or termId parameter" });
    return;
  }

  try {
    const rows = await db
      .select({
        status: attendanceTable.status,
        count: sql<number>`count(*)`
      })
      .from(attendanceTable)
      .where(
        and(
          eq(attendanceTable.studentId, studentId),
          eq(attendanceTable.termId, termId)
        )
      )
      .groupBy(attendanceTable.status);

    const summary = {
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
      total: 0,
      percentage: 100
    };

    rows.forEach(r => {
      const cnt = Number(r.count);
      if (r.status === "present") summary.present = cnt;
      else if (r.status === "absent") summary.absent = cnt;
      else if (r.status === "late") summary.late = cnt;
      else if (r.status === "excused") summary.excused = cnt;
    });

    summary.total = summary.present + summary.absent + summary.late + summary.excused;
    if (summary.total > 0) {
      summary.percentage = Math.round((summary.present / summary.total) * 100);
    }

    res.json(summary);
  } catch (error) {
    console.error("Failed to fetch student attendance summary:", error);
    res.status(500).json({ error: "Failed to fetch student attendance summary" });
  }
});

// 3. GET Class Attendance Report for Term
router.get("/attendance/report/:classId/:termId", requireAuth, async (req, res): Promise<void> => {
  const classIdStr = Array.isArray(req.params.classId) ? req.params.classId[0] : req.params.classId;
  const termIdStr = Array.isArray(req.params.termId) ? req.params.termId[0] : req.params.termId;

  const classId = parseInt(classIdStr as string, 10);
  const termId = parseInt(termIdStr as string, 10);

  if (isNaN(classId) || isNaN(termId)) {
    res.status(400).json({ error: "Invalid classId or termId parameter" });
    return;
  }

  try {
    const classStudents = await db
      .select({
        id: studentsTable.id,
        fullName: studentsTable.fullName,
        studentIdNumber: studentsTable.studentIdNumber
      })
      .from(studentsTable)
      .where(eq(studentsTable.classId, classId))
      .orderBy(studentsTable.fullName);

    const logs = await db
      .select()
      .from(attendanceTable)
      .where(
        and(
          eq(attendanceTable.classId, classId),
          eq(attendanceTable.termId, termId)
        )
      );

    const report = classStudents.map(student => {
      const studentLogs = logs.filter(l => l.studentId === student.id);
      const present = studentLogs.filter(l => l.status === "present").length;
      const absent = studentLogs.filter(l => l.status === "absent").length;
      const late = studentLogs.filter(l => l.status === "late").length;
      const excused = studentLogs.filter(l => l.status === "excused").length;
      const total = studentLogs.length;
      const percentage = total > 0 ? Math.round((present / total) * 100) : 100;

      return {
        studentId: student.id,
        fullName: student.fullName,
        studentIdNumber: student.studentIdNumber,
        present,
        absent,
        late,
        excused,
        total,
        percentage
      };
    });

    res.json(report);
  } catch (error) {
    console.error("Failed to fetch class attendance report:", error);
    res.status(500).json({ error: "Failed to fetch class attendance report" });
  }
});

export default router;
