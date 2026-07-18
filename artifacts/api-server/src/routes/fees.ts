import { Router, type IRouter } from "express";
import { eq, and, sql, inArray } from "drizzle-orm";
import { db, feeTypesTable, studentFeesTable, feePaymentsTable, studentsTable, classesTable, usersTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { validate } from "../middlewares/validation";
import { z } from "zod";

const router: IRouter = Router();

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
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Payment date must be YYYY-MM-DD"),
  paymentMethod: z.enum(["cash", "bank_transfer", "momo"]),
  reference: z.string().max(100).optional().nullable(),
  notes: z.string().max(500).optional().nullable()
});

// 1. GET all global fee categories (Admin only)
router.get("/fees/types", requireAdmin, async (req, res): Promise<void> => {
  try {
    const rows = await db.select().from(feeTypesTable).orderBy(feeTypesTable.name);
    res.json(rows);
  } catch (error) {
    console.error("Failed to fetch fee types:", error);
    res.status(500).json({ error: "Failed to fetch fee types" });
  }
});

// 2. POST create a new fee category (Admin only)
router.post("/fees/types", requireAdmin, validate(CreateFeeTypeSchema), async (req, res): Promise<void> => {
  const { name, amount, description } = req.body;
  try {
    const [row] = await db
      .insert(feeTypesTable)
      .values({
        name,
        amount: String(amount),
        description: description ?? null
      })
      .returning();
    res.status(201).json(row);
  } catch (error) {
    console.error("Failed to create fee type:", error);
    res.status(500).json({ error: "Failed to create fee type" });
  }
});

// 3. POST bulk assign fee type to students in a class (Admin only)
router.post("/fees/assign-bulk", requireAdmin, validate(AssignBulkFeesSchema), async (req, res): Promise<void> => {
  const { classId, termId, feeTypeId, amount, dueDate } = req.body;

  try {
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
    await db.transaction(async (tx) => {
      for (const student of studentsToBill) {
        await tx.insert(studentFeesTable).values({
          studentId: student.id,
          termId,
          feeTypeId,
          amountDue: String(amount),
          amountPaid: "0.00",
          dueDate: dueDate ?? null
        });
      }
    });

    res.status(201).json({
      success: true,
      message: `Successfully assigned fee to ${studentsToBill.length} students.`
    });
  } catch (error) {
    console.error("Bulk fee assignment failed:", error);
    res.status(500).json({ error: "Failed to assign fees to class" });
  }
});

// 4. POST record a fee payment (Admin only)
router.post("/fees/payments", requireAdmin, validate(RecordPaymentSchema), async (req, res): Promise<void> => {
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

      const due = parseFloat(invoice.amountDue);
      const paid = parseFloat(invoice.amountPaid);
      const outstanding = due - paid;

      // Allow up to remaining outstanding balance
      if (amountPaid > outstanding + 0.01) {
        throw new Error("OVERPAYMENT");
      }

      const newPaidTotal = (paid + amountPaid).toFixed(2);

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

      // Update total paid in invoice
      await tx
        .update(studentFeesTable)
        .set({ amountPaid: newPaidTotal })
        .where(eq(studentFeesTable.id, studentFeeId));

      return payment;
    });

    res.status(201).json(result);
  } catch (error: any) {
    if (error.message === "INVOICE_NOT_FOUND") {
      res.status(404).json({ error: "Student fee record not found" });
    } else if (error.message === "OVERPAYMENT") {
      res.status(400).json({ error: "Payment amount exceeds the outstanding balance." });
    } else {
      console.error("Record payment transaction failed:", error);
      res.status(500).json({ error: "Failed to record payment" });
    }
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
        amountDue: studentFeesTable.amountDue,
        amountPaid: studentFeesTable.amountPaid,
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

    let payments: any[] = [];
    if (invoiceIds.length > 0) {
      payments = await db
        .select({
          id: feePaymentsTable.id,
          studentFeeId: feePaymentsTable.studentFeeId,
          amountPaid: feePaymentsTable.amountPaid,
          paymentDate: feePaymentsTable.paymentDate,
          paymentMethod: feePaymentsTable.paymentMethod,
          reference: feePaymentsTable.reference,
          notes: feePaymentsTable.notes
        })
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
  } catch (error) {
    console.error("Failed to fetch student billing details:", error);
    res.status(500).json({ error: "Failed to fetch student billing details" });
  }
});

export default router;
