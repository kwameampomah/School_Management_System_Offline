import { sqliteTable, integer, text, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { studentsTable } from "./students";
import { classesTable } from "./classes";
import { termsTable } from "./terms";
import { usersTable } from "./users";

export const attendanceTable = sqliteTable("attendance", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: integer("student_id")
    .notNull()
    .references(() => studentsTable.id, { onDelete: "cascade" }),
  classId: integer("class_id")
    .notNull()
    .references(() => classesTable.id, { onDelete: "cascade" }),
  termId: integer("term_id")
    .notNull()
    .references(() => termsTable.id, { onDelete: "cascade" }),
  attendanceDate: text("attendance_date").notNull(),
  status: text("status").$type<"present" | "absent" | "late" | "excused">().notNull(),
  recordedBy: integer("recorded_by").references(() => usersTable.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()).notNull(),
}, (table) => [
  uniqueIndex("attendance_student_class_date_idx").on(table.studentId, table.classId, table.attendanceDate),
  index("attendance_student_term_idx").on(table.studentId, table.termId),
  index("attendance_date_idx").on(table.attendanceDate),
]);

export const insertAttendanceSchema = createInsertSchema(attendanceTable).omit({
  id: true,
  createdAt: true,
});
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type Attendance = typeof attendanceTable.$inferSelect;
