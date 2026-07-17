import { sqliteTable, integer, text, index } from "drizzle-orm/sqlite-core";
import { studentsTable } from "./students";
import { termsTable } from "./terms";

export const studentTermMetadataTable = sqliteTable("student_term_metadata", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: integer("student_id")
    .notNull()
    .references(() => studentsTable.id, { onDelete: "cascade" }),
  termId: integer("term_id")
    .notNull()
    .references(() => termsTable.id, { onDelete: "cascade" }),
  daysOpened: integer("days_opened").notNull().default(0),
  daysPresent: integer("days_present").notNull().default(0),
  conduct: text("conduct"),
  attitude: text("attitude"),
  interest: text("interest"),
  teacherRemarks: text("teacher_remarks"),
  headmasterRemarks: text("headmaster_remarks"),
}, (table) => [
  index("student_term_metadata_student_id_idx").on(table.studentId),
  index("student_term_metadata_term_id_idx").on(table.termId),
]);

export type StudentTermMetadata = typeof studentTermMetadataTable.$inferSelect;
export type InsertStudentTermMetadata = typeof studentTermMetadataTable.$inferInsert;
