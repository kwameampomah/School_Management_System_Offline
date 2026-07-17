import { db, auditLogsTable } from "@workspace/db";

export async function logAudit(
  actorUserId: number | null,
  action: "INSERT" | "UPDATE" | "DELETE",
  tableName: string,
  rowId: number,
  oldValue: string | null = null,
  newValue: string | null = null
): Promise<void> {
  try {
    await db.insert(auditLogsTable).values({
      actorUserId,
      action,
      tableName,
      rowId,
      oldValue,
      newValue,
    });
  } catch (error) {
    console.error(`Failed to write audit log for ${action} on ${tableName}:`, error);
  }
}
