import { sqliteTable, integer, index } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { teachersTable } from "./teachers";
import { classSubjectsTable } from "./subjects";
import { termsTable } from "./terms";

export const teacherAssignmentsTable = sqliteTable("teacher_assignments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  teacherId: integer("teacher_id")
    .notNull()
    .references(() => teachersTable.id, { onDelete: "cascade" }),
  classSubjectId: integer("class_subject_id")
    .notNull()
    .references(() => classSubjectsTable.id, { onDelete: "cascade" }),
  termId: integer("term_id")
    .notNull()
    .references(() => termsTable.id, { onDelete: "cascade" }),
}, (table) => [
  index("assignments_teacher_id_idx").on(table.teacherId),
  index("assignments_class_subject_id_idx").on(table.classSubjectId),
  index("assignments_term_id_idx").on(table.termId),
]);

export const insertTeacherAssignmentSchema = createInsertSchema(teacherAssignmentsTable).omit({
  id: true,
});
export type InsertTeacherAssignment = z.infer<typeof insertTeacherAssignmentSchema>;
export type TeacherAssignment = typeof teacherAssignmentsTable.$inferSelect;
