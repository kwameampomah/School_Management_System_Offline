import { Router, type IRouter } from "express";
import { inArray } from "drizzle-orm";
import { db, studentsTable, auditLogsTable } from "@workspace/db";
import { requireAdmin } from "../middlewares/auth";
import { validate } from "../middlewares/validation";
import { z } from "zod";

const router: IRouter = Router();

const BulkPromotionBody = z.object({
  studentIds: z.array(z.number()),
  targetClassId: z.coerce.number(),
});

router.post("/promotions/bulk", requireAdmin, validate(BulkPromotionBody), async (req, res): Promise<void> => {
  const { studentIds, targetClassId } = req.body;

  try {
    const numericTargetClassId = parseInt(targetClassId, 10);

    // Update students
    const updatedRows = await db
      .update(studentsTable)
      .set({ classId: numericTargetClassId })
      .where(inArray(studentsTable.id, studentIds))
      .returning();

    // Log promotions in the audit trail
    for (const student of updatedRows) {
      await db.insert(auditLogsTable).values({
        actorUserId: req.session.userId ?? null,
        action: "PROMOTE",
        tableName: "students",
        rowId: student.id,
        oldValue: `Class ID change for student: ${student.fullName}`,
        newValue: `New Class ID: ${numericTargetClassId}`,
      });
    }

    res.json({ successCount: updatedRows.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message || "Failed to process promotions" });
  }
});

export default router;
