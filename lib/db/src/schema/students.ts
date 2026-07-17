import { sqliteTable, integer, text, index } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { classesTable } from "./classes";

export const studentsTable = sqliteTable("students", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentIdNumber: text("student_id_number").notNull().unique(),
  fullName: text("full_name").notNull(),
  dateOfBirth: text("date_of_birth"),
  gender: text("gender"),
  classId: integer("class_id")
    .notNull()
    .references(() => classesTable.id, { onDelete: "restrict" }),
  guardianName: text("guardian_name"),
  guardianPhone: text("guardian_phone"),
  admissionDate: text("admission_date"),
}, (table) => [
  index("students_class_id_idx").on(table.classId),
]);

export const insertStudentSchema = createInsertSchema(studentsTable).omit({ id: true });
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type Student = typeof studentsTable.$inferSelect;
