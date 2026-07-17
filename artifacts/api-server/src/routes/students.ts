import { Router, type IRouter } from "express";
import { eq, and, inArray, sql } from "drizzle-orm";
import { db, studentsTable, classesTable, teacherAssignmentsTable, classSubjectsTable, usersTable } from "@workspace/db";
import { requireAuth, requireAdmin, requireTeacher } from "../middlewares/auth";
import { validate } from "../middlewares/validation";
import { CreateStudentBody, UpdateStudentBody } from "@workspace/api-zod";
import { logAudit } from "../lib/audit";

async function getTeacherClassIds(teacherId: number): Promise<number[]> {
  const classTeacherClasses = await db
    .select({ id: classesTable.id })
    .from(classesTable)
    .where(eq(classesTable.classTeacherId, teacherId));
  
  const assignedClasses = await db
    .select({ classId: classSubjectsTable.classId })
    .from(teacherAssignmentsTable)
    .innerJoin(classSubjectsTable, eq(teacherAssignmentsTable.classSubjectId, classSubjectsTable.id))
    .where(eq(teacherAssignmentsTable.teacherId, teacherId));
  
  const classIds = new Set<number>();
  classTeacherClasses.forEach(c => classIds.add(c.id));
  assignedClasses.forEach(c => classIds.add(c.classId));
  
  return Array.from(classIds);
}

const router: IRouter = Router();

async function teacherCanManageStudent(
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

async function teacherCanManageStudentId(
  role: string,
  teacherId: number | null,
  studentId: number,
): Promise<boolean> {
  if (role === "admin") return true;
  if (!teacherId) return false;

  const [student] = await db
    .select({ classId: studentsTable.classId })
    .from(studentsTable)
    .where(eq(studentsTable.id, studentId));

  if (!student) return false;

  return teacherCanManageStudent(role, teacherId, student.classId);
}

async function getStudentRow(id: number) {
  const [row] = await db
    .select({
      id: studentsTable.id,
      studentIdNumber: studentsTable.studentIdNumber,
      fullName: studentsTable.fullName,
      dateOfBirth: studentsTable.dateOfBirth,
      gender: studentsTable.gender,
      classId: studentsTable.classId,
      className: classesTable.name,
      guardianName: studentsTable.guardianName,
      guardianPhone: studentsTable.guardianPhone,
      admissionDate: studentsTable.admissionDate,
    })
    .from(studentsTable)
    .leftJoin(classesTable, eq(studentsTable.classId, classesTable.id))
    .where(eq(studentsTable.id, id));
  return row;
}

router.get("/students", requireAuth, async (req, res): Promise<void> => {
  const classId = req.query.classId ? parseInt(req.query.classId as string, 10) : null;
  const conditions = [];

  if (classId) {
    conditions.push(eq(studentsTable.classId, classId));
  }

  // Teachers can only see students in classes they are assigned to or lead
  if (req.session.role === "teacher") {
    const teacherId = req.session.teacherId;
    if (!teacherId) {
      res.status(403).json({ error: "No teacher profile found for this account" });
      return;
    }
    const allowedClassIds = await getTeacherClassIds(teacherId);
    if (classId) {
      if (!allowedClassIds.includes(classId)) {
        res.status(403).json({ error: "You are not authorized to view students in this class" });
        return;
      }
    } else {
      if (allowedClassIds.length === 0) {
        res.json([]);
        return;
      }
      conditions.push(inArray(studentsTable.classId, allowedClassIds));
    }
  }

  // Parents can only see their own children
  if (req.session.role === "parent") {
    const [currentUser] = await db
      .select({ fullName: usersTable.fullName })
      .from(usersTable)
      .where(eq(usersTable.id, req.session.userId!));

    const parentName = currentUser?.fullName;
    if (!parentName) {
      res.status(403).json({ error: "No parent profile found for this account" });
      return;
    }
    const children = await db
      .select({ id: studentsTable.id })
      .from(studentsTable)
      .where(sql`lower(${studentsTable.guardianName}) = lower(${parentName})`);
    
    const childIds = children.map(c => c.id);
    if (childIds.length === 0) {
      res.json([]);
      return;
    }
    
    if (classId) {
      conditions.push(and(
        inArray(studentsTable.id, childIds),
        eq(studentsTable.classId, classId)
      ));
    } else {
      conditions.push(inArray(studentsTable.id, childIds));
    }
  }

  const rows = await db
    .select({
      id: studentsTable.id,
      studentIdNumber: studentsTable.studentIdNumber,
      fullName: studentsTable.fullName,
      dateOfBirth: studentsTable.dateOfBirth,
      gender: studentsTable.gender,
      classId: studentsTable.classId,
      className: classesTable.name,
      guardianName: studentsTable.guardianName,
      guardianPhone: studentsTable.guardianPhone,
      admissionDate: studentsTable.admissionDate,
    })
    .from(studentsTable)
    .leftJoin(classesTable, eq(studentsTable.classId, classesTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(studentsTable.fullName);

  res.json(rows);
});

router.post("/students", requireTeacher, validate(CreateStudentBody), async (req, res): Promise<void> => {
  const { studentIdNumber, fullName, classId, dateOfBirth, gender, guardianName, guardianPhone, admissionDate } = req.body;

  const classIdNum = parseInt(classId as any, 10);
  const allowed = await teacherCanManageStudent(req.session.role!, req.session.teacherId ?? null, classIdNum);
  if (!allowed) {
    res.status(403).json({ error: "You are not authorized to add students to this class" });
    return;
  }

  const [student] = await db
    .insert(studentsTable)
    .values({ studentIdNumber, fullName, classId: classIdNum, dateOfBirth, gender, guardianName, guardianPhone, admissionDate })
    .returning();
  
  await logAudit(req.session.userId ?? null, "INSERT", "students", student.id, null, JSON.stringify(student));

  const row = await getStudentRow(student.id);
  res.status(201).json(row);
});

router.post("/students/bulk", requireTeacher, async (req, res): Promise<void> => {
  const { students } = req.body;
  if (!Array.isArray(students) || students.length === 0) {
    res.status(400).json({ error: "students array is required" });
    return;
  }

  const results = [];
  const errors = [];

  for (let i = 0; i < students.length; i++) {
    const s = students[i];
    const { studentIdNumber, fullName, classId, dateOfBirth, gender, guardianName, guardianPhone, admissionDate } = s;
    if (!studentIdNumber || !fullName || !classId) {
      errors.push({ index: i, error: "studentIdNumber, fullName, and classId are required" });
      continue;
    }

    const classIdNum = parseInt(classId, 10);
    const allowed = await teacherCanManageStudent(req.session.role!, req.session.teacherId ?? null, classIdNum);
    if (!allowed) {
      errors.push({ index: i, name: fullName, error: "You are not authorized to add students to this class" });
      continue;
    }

    // Server-side safety gender normalization
    let normalizedGender: string | null = null;
    if (gender) {
      const g = gender.toLowerCase().trim();
      if (g.startsWith("m")) {
        normalizedGender = "male";
      } else if (g.startsWith("f")) {
        normalizedGender = "female";
      }
    }

    // Server-side safety date normalization
    const normalizeDate = (dateStr: string | null | undefined): string | null => {
      if (!dateStr) return null;
      const cleaned = dateStr.trim().replace(/[\/\.]/g, "-");
      if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
        return cleaned;
      }
      return dateStr;
    };

    try {
      const [student] = await db
        .insert(studentsTable)
        .values({
          studentIdNumber,
          fullName,
          classId: parseInt(classId, 10),
          dateOfBirth: normalizeDate(dateOfBirth),
          gender: normalizedGender,
          guardianName: guardianName || null,
          guardianPhone: guardianPhone || null,
          admissionDate: normalizeDate(admissionDate)
        })
        .returning();
      
      results.push(student);
    } catch (e: any) {
      errors.push({ index: i, name: fullName, error: e.message || "Insert failed" });
    }
  }

  res.json({ successCount: results.length, errorCount: errors.length, errors });
});

router.get("/students/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const row = await getStudentRow(id);
  if (!row) {
    res.status(404).json({ error: "Student not found" });
    return;
  }
  res.json(row);
});

router.patch("/students/:id", requireTeacher, validate(UpdateStudentBody), async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { fullName, dateOfBirth, gender, classId, guardianName, guardianPhone } = req.body;

  const allowed = await teacherCanManageStudentId(req.session.role!, req.session.teacherId ?? null, id);
  if (!allowed) {
    res.status(403).json({ error: "You are not authorized to modify this student" });
    return;
  }

  if (classId !== undefined) {
    const targetClassId = parseInt(classId as any, 10);
    const targetAllowed = await teacherCanManageStudent(req.session.role!, req.session.teacherId ?? null, targetClassId);
    if (!targetAllowed) {
      res.status(403).json({ error: "You are not authorized to move student to this class" });
      return;
    }
  }

  const [existing] = await db.select().from(studentsTable).where(eq(studentsTable.id, id));

  const updates: Record<string, unknown> = {};
  if (fullName !== undefined) updates.fullName = fullName;
  if (dateOfBirth !== undefined) updates.dateOfBirth = dateOfBirth;
  if (gender !== undefined) updates.gender = gender;
  if (classId !== undefined) updates.classId = classId;
  if (guardianName !== undefined) updates.guardianName = guardianName;
  if (guardianPhone !== undefined) updates.guardianPhone = guardianPhone;

  const [student] = await db.update(studentsTable).set(updates).where(eq(studentsTable.id, id)).returning();
  if (!student) {
    res.status(404).json({ error: "Student not found" });
    return;
  }

  await logAudit(
    req.session.userId ?? null,
    "UPDATE",
    "students",
    student.id,
    existing ? JSON.stringify(existing) : null,
    JSON.stringify(student)
  );

  const row = await getStudentRow(id);
  res.json(row);
});

router.delete("/students/:id", requireTeacher, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);

  const allowed = await teacherCanManageStudentId(req.session.role!, req.session.teacherId ?? null, id);
  if (!allowed) {
    res.status(403).json({ error: "You are not authorized to delete this student" });
    return;
  }

  const [student] = await db.delete(studentsTable).where(eq(studentsTable.id, id)).returning();
  if (!student) {
    res.status(404).json({ error: "Student not found" });
    return;
  }

  await logAudit(
    req.session.userId ?? null,
    "DELETE",
    "students",
    student.id,
    JSON.stringify(student),
    null
  );

  res.json({ ok: true });
});

export default router;
