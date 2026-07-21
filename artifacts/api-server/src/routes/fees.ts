import { Router, type IRouter } from "express";
import { eq, and, sql, inArray } from "drizzle-orm";
import { db, feeTypesTable, studentFeesTable, feePaymentsTable, studentsTable, classesTable, usersTable, type FeePayment } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { validate } from "../middlewares/validation";
import { logAudit } from "../lib/audit";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";

const router: IRouter = Router();

// Rate limit payments endpoint: max 100 payments per minute per user/IP
const paymentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: "Too many payments recorded. Please wait a minute." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Zod schemas for input validation
const CreateFeeTypeSchema = z.object({
  name: z.string().min(1, "Fee type name is required").max(100),
  amount: z.number().positive("Amount must be a positive number"),
  description: z.string().max(500).optional().nullable()
});

const AssignBulkFeesSchema = z.object({
  classId: z.number().int().positive(),
  termId: z.number().int().positive(),
  feeTypeId: z.number().int().positive(),
  amount: z.number().positive(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Due date must be in YYYY-MM-DD format").optional().nullable()
});

const RecordPaymentSchema = z.object({
  studentFeeId: z.number().int().positive(),
  amountPaid: z.number().positive("Amount paid must be positive"),
  paymentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Payment date must be YYYY-MM-DD")
    .refine(
      (d) => d <= new Date().toISOString().split("T")[0],
      "Payment date cannot be in the future"
    ),
  paymentMethod: z.enum(["cash", "bank_transfer", "momo"]),
  reference: z.string().max(100).optional().nullable(),
  notes: z.string().max(500).optional().nullable()
});

const AssignIndividualFeeSchema = z.object({
  studentId: z.number().int().positive(),
  termId: z.number().int().positive(),
  feeTypeId: z.number().int().positive(),
  amount: z.number().positive(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Due date must be in YYYY-MM-DD format").optional().nullable()
});

const UpdateStudentFeeSchema = z.object({
  amountDue: z.number().positive().optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Due date must be in YYYY-MM-DD format").optional().nullable()
});

// 1. GET all global fee categories (Admin only)
router.get("/fees/types", requireAdmin, async (req, res): Promise<void> => {
  try {
    const rows = await db.select().from(feeTypesTable).orderBy(feeTypesTable.name);
    res.json(rows);
  } catch (error: unknown) {
    console.error("Failed to fetch fee types:", error);
    res.status(500).json({ error: "Failed to fetch fee types" });
  }
});

// 2. POST create a new fee category (Admin only)
router.post("/fees/types", requireAdmin, validate(CreateFeeTypeSchema), async (req, res): Promise<void> => {
  const { name, amount, description } = req.body;
  const adminId = req.session.userId ?? null;

  try {
    const [row] = await db
      .insert(feeTypesTable)
      .values({
        name,
        amount: String(amount),
        description: description ?? null
      })
      .returning();

    // Audit log
    await logAudit(
      adminId,
      "INSERT",
      "fee_types",
      row.id,
      null,
      JSON.stringify(row)
    );

    res.status(201).json(row);
  } catch (error: unknown) {
    console.error("Failed to create fee type:", error);
    res.status(500).json({ error: "Failed to create fee type" });
  }
});

// DELETE a fee category (Admin only with orphan protection check)
router.delete("/fees/types/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  try {
    const assignedRecords = await db
      .select({ id: studentFeesTable.id })
      .from(studentFeesTable)
      .where(eq(studentFeesTable.feeTypeId, id));

    if (assignedRecords.length > 0) {
      res.status(400).json({ error: "Cannot delete fee category because it is assigned to active student fee accounts." });
      return;
    }

    const [deleted] = await db
      .delete(feeTypesTable)
      .where(eq(feeTypesTable.id, id))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Fee category not found" });
      return;
    }

    res.json({ ok: true });
  } catch (error: unknown) {
    console.error("Failed to delete fee type:", error);
    res.status(500).json({ error: "Failed to delete fee category" });
  }
});

// 3. POST bulk assign fee type to students in a class (Admin only)
router.post("/fees/assign-bulk", requireAdmin, validate(AssignBulkFeesSchema), async (req, res): Promise<void> => {
  const { classId, termId, feeTypeId, amount, dueDate } = req.body;
  const adminId = req.session.userId ?? null;

  try {
    // Check if class exists
    const [classRecord] = await db
      .select()
      .from(classesTable)
      .where(eq(classesTable.id, classId));

    if (!classRecord) {
      res.status(404).json({ error: "Class not found" });
      return;
    }

    // 1. Fetch all students in the class
    const classStudents = await db
      .select({ id: studentsTable.id })
      .from(studentsTable)
      .where(eq(studentsTable.classId, classId));

    if (classStudents.length === 0) {
      res.status(400).json({ error: "No students found in the selected class" });
      return;
    }

    // 2. Fetch existing fees for this term and fee type
    const existingFees = await db
      .select({ studentId: studentFeesTable.studentId })
      .from(studentFeesTable)
      .where(
        and(
          eq(studentFeesTable.termId, termId),
          eq(studentFeesTable.feeTypeId, feeTypeId)
        )
      );

    const billedStudentIds = new Set(existingFees.map(f => f.studentId));
    const studentsToBill = classStudents.filter(s => !billedStudentIds.has(s.id));

    if (studentsToBill.length === 0) {
      res.json({ success: true, message: "All students in this class have already been billed for this fee." });
      return;
    }

    // 3. Insert bills
    const assignedIds: number[] = [];
    await db.transaction(async (tx) => {
      for (const student of studentsToBill) {
        const [inserted] = await tx.insert(studentFeesTable).values({
          studentId: student.id,
          termId,
          feeTypeId,
          amountDue: String(amount),
          amountPaid: "0.00",
          isPaid: false,
          dueDate: dueDate ?? null
        }).returning();
        assignedIds.push(inserted.id);
      }
    });

    // Audit log bulk assignment
    await logAudit(
      adminId,
      "INSERT",
      "student_fees",
      classId, // group by class ID for the log
      null,
      `Bulk assigned feeTypeId ${feeTypeId} of GH₵ ${amount} to ${studentsToBill.length} students in class ${classRecord.name}. Assigned IDs: ${assignedIds.join(",")}`
    );

    res.status(201).json({
      success: true,
      assignedCount: studentsToBill.length,
      message: `Successfully assigned fee to ${studentsToBill.length} students.`
    });
  } catch (error: unknown) {
    console.error("Bulk fee assignment failed:", error);
    res.status(500).json({ error: "Failed to assign fees to class" });
  }
});

// 4. POST record a fee payment (Admin only with rate limiting)
router.post("/fees/payments", requireAdmin, paymentLimiter, validate(RecordPaymentSchema), async (req, res): Promise<void> => {
  const { studentFeeId, amountPaid, paymentDate, paymentMethod, reference, notes } = req.body;
  const adminId = req.session.userId ?? null;

  try {
    const result = await db.transaction(async (tx) => {
      // Get the existing invoice
      const [invoice] = await tx
        .select()
        .from(studentFeesTable)
        .where(eq(studentFeesTable.id, studentFeeId));

      if (!invoice) {
        throw new Error("INVOICE_NOT_FOUND");
      }

      // Idempotency check: prevent duplicate payments within the same transaction to handle double-clicks/retries
      const existingPayment = await tx
        .select()
        .from(feePaymentsTable)
        .where(
          and(
            eq(feePaymentsTable.studentFeeId, studentFeeId),
            eq(feePaymentsTable.paymentDate, paymentDate),
            eq(feePaymentsTable.amountPaid, String(amountPaid)),
            eq(feePaymentsTable.paymentMethod, paymentMethod),
            reference ? eq(feePaymentsTable.reference, reference) : sql`reference IS NULL`
          )
        );

      if (existingPayment.length > 0) {
        return existingPayment[0]; // Return the existing record instead of inserting again
      }

      // Check for backdated payment date before invoice creation date
      const invoiceCreated = new Date(invoice.createdAt);
      invoiceCreated.setHours(0, 0, 0, 0);
      const paidDate = new Date(paymentDate);
      paidDate.setHours(0, 0, 0, 0);

      if (paidDate < invoiceCreated) {
        throw new Error("BACKDATED_PAYMENT");
      }

      // Cents-based safe integer arithmetic to prevent floating-point calculation issues
      const dueCents = Math.round(parseFloat(invoice.amountDue) * 100);
      const paidCents = Math.round(parseFloat(invoice.amountPaid) * 100);
      const addCents = Math.round(amountPaid * 100);
      const outstandingCents = dueCents - paidCents;

      // Allow up to remaining outstanding balance
      if (addCents > outstandingCents) {
        throw new Error("OVERPAYMENT");
      }

      const newPaidTotal = ((paidCents + addCents) / 100).toFixed(2);
      const isPaid = (paidCents + addCents) >= dueCents;

      // Insert transaction event
      const [payment] = await tx
        .insert(feePaymentsTable)
        .values({
          studentFeeId,
          amountPaid: String(amountPaid),
          paymentDate,
          paymentMethod,
          reference: reference ?? null,
          recordedBy: adminId,
          notes: notes ?? null
        })
        .returning();

      // Update total paid in invoice and update isPaid
      await tx
        .update(studentFeesTable)
        .set({
          amountPaid: newPaidTotal,
          isPaid,
          updatedAt: new Date().toISOString()
        })
        .where(eq(studentFeesTable.id, studentFeeId));

      // Audit log
      await logAudit(
        adminId,
        "INSERT",
        "fee_payments",
        payment.id,
        null,
        JSON.stringify(payment)
      );

      return payment;
    });

    res.status(201).json(result);
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === "INVOICE_NOT_FOUND") {
        res.status(404).json({ error: "Student fee record not found" });
        return;
      }
      if (error.message === "OVERPAYMENT") {
        res.status(400).json({ error: "Payment amount exceeds the outstanding balance." });
        return;
      }
      if (error.message === "BACKDATED_PAYMENT") {
        res.status(400).json({ error: "Payment date cannot be prior to the billing invoice date." });
        return;
      }
    }
    console.error("Record payment transaction failed:", error);
    res.status(500).json({ error: "Failed to record payment" });
  }
});

// 5. GET student fee summary (Admin & Parents only)
router.get("/fees/student/:studentId/:termId", requireAuth, async (req, res): Promise<void> => {
  const studentIdStr = Array.isArray(req.params.studentId) ? req.params.studentId[0] : req.params.studentId;
  const termIdStr = Array.isArray(req.params.termId) ? req.params.termId[0] : req.params.termId;

  const studentId = parseInt(studentIdStr as string, 10);
  const termId = parseInt(termIdStr as string, 10);

  if (isNaN(studentId) || isNaN(termId)) {
    res.status(400).json({ error: "Invalid studentId or termId parameter" });
    return;
  }

  // Parent security check: ensure parent can only see their children's bills
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

    const [child] = await db
      .select({ id: studentsTable.id })
      .from(studentsTable)
      .where(
        and(
          eq(studentsTable.id, studentId),
          sql`lower(${studentsTable.guardianName}) = lower(${parentName})`
        )
      );

    if (!child) {
      res.status(403).json({ error: "You are not authorized to view this student's billing information" });
      return;
    }
  }

  try {
    const invoices = await db
      .select({
        id: studentFeesTable.id,
        feeTypeId: studentFeesTable.feeTypeId,
        feeName: feeTypesTable.name,
        feeTypeName: feeTypesTable.name,
        amountDue: studentFeesTable.amountDue,
        amountPaid: studentFeesTable.amountPaid,
        isPaid: studentFeesTable.isPaid,
        dueDate: studentFeesTable.dueDate
      })
      .from(studentFeesTable)
      .innerJoin(feeTypesTable, eq(studentFeesTable.feeTypeId, feeTypesTable.id))
      .where(
        and(
          eq(studentFeesTable.studentId, studentId),
          eq(studentFeesTable.termId, termId)
        )
      );

    const invoiceIds = invoices.map(i => i.id);

    let payments: FeePayment[] = [];
    if (invoiceIds.length > 0) {
      payments = await db
        .select()
        .from(feePaymentsTable)
        .where(inArray(feePaymentsTable.studentFeeId, invoiceIds))
        .orderBy(feePaymentsTable.paymentDate);
    }

    res.json({
      invoices: invoices.map(inv => ({
        ...inv,
        amountDue: parseFloat(inv.amountDue),
        amountPaid: parseFloat(inv.amountPaid)
      })),
      payments: payments.map(p => ({
        ...p,
        amountPaid: parseFloat(p.amountPaid)
      }))
    });
  } catch (error: unknown) {
    console.error("Failed to fetch student billing details:", error);
    res.status(500).json({ error: "Failed to fetch student billing details" });
  }
});

// 6. POST assign fee to an individual student (Admin only)
router.post("/fees/assign-individual", requireAdmin, validate(AssignIndividualFeeSchema), async (req, res): Promise<void> => {
  const { studentId, termId, feeTypeId, amount, dueDate } = req.body;
  const adminId = req.session.userId ?? null;

  try {
    const [inserted] = await db
      .insert(studentFeesTable)
      .values({
        studentId,
        termId,
        feeTypeId,
        amountDue: String(amount),
        amountPaid: "0.00",
        isPaid: false,
        dueDate: dueDate ?? null
      })
      .returning();

    await logAudit(adminId, "INSERT", "student_fees", inserted.id, null, JSON.stringify(inserted));

    res.status(201).json(inserted);
  } catch (error: unknown) {
    console.error("Assign individual fee failed:", error);
    res.status(500).json({ error: "Failed to assign fee to student" });
  }
});

// 7. PUT update an existing student fee line item (Admin only)
router.put("/fees/student-fee/:id", requireAdmin, validate(UpdateStudentFeeSchema), async (req, res): Promise<void> => {
  const idStr = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(idStr as string, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid student fee ID" });
    return;
  }

  const { amountDue, dueDate } = req.body;
  const adminId = req.session.userId ?? null;

  try {
    const [fee] = await db.select().from(studentFeesTable).where(eq(studentFeesTable.id, id));
    if (!fee) {
      res.status(404).json({ error: "Student fee record not found" });
      return;
    }

    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString()
    };

    if (dueDate !== undefined) {
      updates.dueDate = dueDate;
    }

    if (amountDue !== undefined) {
      const paidNum = parseFloat(fee.amountPaid);
      if (amountDue < paidNum) {
        res.status(400).json({ error: `Amount due (GH₵ ${amountDue.toFixed(2)}) cannot be less than amount already paid (GH₵ ${paidNum.toFixed(2)})` });
        return;
      }
      updates.amountDue = String(amountDue);
      updates.isPaid = paidNum >= amountDue;
    }

    const [updated] = await db
      .update(studentFeesTable)
      .set(updates)
      .where(eq(studentFeesTable.id, id))
      .returning();

    await logAudit(adminId, "UPDATE", "student_fees", id, JSON.stringify(fee), JSON.stringify(updated));

    res.json(updated);
  } catch (error: unknown) {
    console.error("Update student fee failed:", error);
    res.status(500).json({ error: "Failed to update student fee record" });
  }
});

// 8. DELETE a student fee line item (Admin only)
router.delete("/fees/student-fee/:id", requireAdmin, async (req, res): Promise<void> => {
  const idStr = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(idStr as string, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid student fee ID" });
    return;
  }

  const adminId = req.session.userId ?? null;

  try {
    const [fee] = await db.select().from(studentFeesTable).where(eq(studentFeesTable.id, id));
    if (!fee) {
      res.status(404).json({ error: "Student fee record not found" });
      return;
    }

    await db.delete(studentFeesTable).where(eq(studentFeesTable.id, id));
    await logAudit(adminId, "DELETE", "student_fees", id, JSON.stringify(fee), null);

    res.json({ success: true, message: "Fee line item deleted successfully" });
  } catch (error: unknown) {
    console.error("Delete student fee failed:", error);
    res.status(500).json({ error: "Failed to delete student fee record" });
  }
});

export default router;
