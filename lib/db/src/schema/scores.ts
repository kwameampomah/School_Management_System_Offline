import { sqliteTable, integer, text, real, index } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sql } from "drizzle-orm";
import { studentsTable } from "./students";
import { assessmentComponentsTable } from "./assessment-components";
import { teachersTable } from "./teachers";

export const scoresTable = sqliteTable("scores", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: integer("student_id")
    .notNull()
    .references(() => studentsTable.id, { onDelete: "cascade" }),
  assessmentComponentId: integer("assessment_component_id")
    .notNull()
    .references(() => assessmentComponentsTable.id, { onDelete: "cascade" }),
  teacherId: integer("teacher_id").references(() => teachersTable.id, { onDelete: "set null" }),
  scoreValue: real("score_value").notNull(),
  isLocked: integer("is_locked", { mode: "boolean" }).notNull().default(false),
  enteredAt: integer("entered_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
  lastEditedAt: integer("last_edited_at", { mode: "timestamp" }),
}, (table) => [
  index("scores_student_id_idx").on(table.studentId),
  index("scores_component_id_idx").on(table.assessmentComponentId),
  index("scores_teacher_id_idx").on(table.teacherId),
]);

export const insertScoreSchema = createInsertSchema(scoresTable).omit({
  id: true,
  enteredAt: true,
  lastEditedAt: true,
});
export type InsertScore = z.infer<typeof insertScoreSchema>;
export type Score = typeof scoresTable.$inferSelect;
