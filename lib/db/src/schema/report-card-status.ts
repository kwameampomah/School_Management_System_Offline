import { sqliteTable, integer, text, index } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { classesTable } from "./classes";
import { termsTable } from "./terms";
import { usersTable } from "./users";

export const reportCardStatusTable = sqliteTable("report_card_status", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  classId: integer("class_id")
    .notNull()
    .references(() => classesTable.id, { onDelete: "cascade" }),
  termId: integer("term_id")
    .notNull()
    .references(() => termsTable.id, { onDelete: "cascade" }),
  status: text("status").$type<"draft" | "submitted" | "approved" | "published">().notNull().default("draft"),
  approvedBy: integer("approved_by").references(() => usersTable.id, { onDelete: "set null" }),
  approvedAt: integer("approved_at", { mode: "timestamp" }),
}, (table) => [
  index("report_card_status_class_id_idx").on(table.classId),
  index("report_card_status_term_id_idx").on(table.termId),
  index("report_card_status_approved_by_idx").on(table.approvedBy),
]);

export const insertReportCardStatusSchema = createInsertSchema(reportCardStatusTable).omit({
  id: true,
  approvedAt: true,
});
export type InsertReportCardStatus = z.infer<typeof insertReportCardStatusSchema>;
export type ReportCardStatus = typeof reportCardStatusTable.$inferSelect;
