const fs = require('fs');
const path = require('path');

const targetDir = 'c:/Users/Afriyie/School_Management_System_Offline/lib/db/src/schema';

const files = {
  'users.ts': `import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sql } from "drizzle-orm";

export const usersTable = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fullName: text("full_name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").$type<"admin" | "teacher" | "parent">().notNull().default("teacher"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql\`(strftime('%s', 'now'))\`),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
`,
  'academic-years.ts': `import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const academicYearsTable = sqliteTable("academic_years", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  yearLabel: text("year_label").notNull().unique(),
  isCurrent: integer("is_current", { mode: "boolean" }).notNull().default(false),
});

export const insertAcademicYearSchema = createInsertSchema(academicYearsTable).omit({ id: true });
export type InsertAcademicYear = z.infer<typeof insertAcademicYearSchema>;
export type AcademicYear = typeof academicYearsTable.$inferSelect;
`,
  'terms.ts': `import { sqliteTable, integer, text, index } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { academicYearsTable } from "./academic-years";

export const termsTable = sqliteTable("terms", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  academicYearId: integer("academic_year_id")
    .notNull()
    .references(() => academicYearsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  startDate: text("start_date"),
  endDate: text("end_date"),
  isCurrent: integer("is_current", { mode: "boolean" }).notNull().default(false),
}, (table) => [
  index("terms_academic_year_id_idx").on(table.academicYearId),
]);

export const insertTermSchema = createInsertSchema(termsTable).omit({ id: true });
export type InsertTerm = z.infer<typeof insertTermSchema>;
export type Term = typeof termsTable.$inferSelect;
`,
  'teachers.ts': `import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const teachersTable = sqliteTable("teachers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" })
    .unique(),
  staffId: text("staff_id"),
  phone: text("phone"),
});

export const insertTeacherSchema = createInsertSchema(teachersTable).omit({ id: true });
export type InsertTeacher = z.infer<typeof insertTeacherSchema>;
export type Teacher = typeof teachersTable.$inferSelect;
`,
  'classes.ts': `import { sqliteTable, integer, text, index } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { academicYearsTable } from "./academic-years";
import { teachersTable } from "./teachers";

export const classesTable = sqliteTable("classes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  academicYearId: integer("academic_year_id")
    .notNull()
    .references(() => academicYearsTable.id, { onDelete: "cascade" }),
  classTeacherId: integer("class_teacher_id").references(() => teachersTable.id, {
    onDelete: "set null",
  }),
}, (table) => [
  index("classes_academic_year_id_idx").on(table.academicYearId),
  index("classes_class_teacher_id_idx").on(table.classTeacherId),
]);

export const insertClassSchema = createInsertSchema(classesTable).omit({ id: true });
export type InsertClass = z.infer<typeof insertClassSchema>;
export type Class = typeof classesTable.$inferSelect;
`,
  'subjects.ts': `import { sqliteTable, integer, text, index } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { classesTable } from "./classes";

export const subjectsTable = sqliteTable("subjects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
});

export const classSubjectsTable = sqliteTable("class_subjects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  classId: integer("class_id")
    .notNull()
    .references(() => classesTable.id, { onDelete: "cascade" }),
  subjectId: integer("subject_id")
    .notNull()
    .references(() => subjectsTable.id, { onDelete: "cascade" }),
}, (table) => [
  index("class_subjects_class_id_idx").on(table.classId),
  index("class_subjects_subject_id_idx").on(table.subjectId),
]);

export const insertSubjectSchema = createInsertSchema(subjectsTable).omit({ id: true });
export const insertClassSubjectSchema = createInsertSchema(classSubjectsTable).omit({ id: true });
export type InsertSubject = z.infer<typeof insertSubjectSchema>;
export type Subject = typeof subjectsTable.$inferSelect;
export type ClassSubject = typeof classSubjectsTable.$inferSelect;
`,
  'teacher-assignments.ts': `import { sqliteTable, integer, index } from "drizzle-orm/sqlite-core";
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
`,
  'students.ts': `import { sqliteTable, integer, text, index } from "drizzle-orm/sqlite-core";
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
`,
  'assessment-components.ts': `import { sqliteTable, integer, text, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { classSubjectsTable } from "./subjects";
import { termsTable } from "./terms";

export const assessmentComponentsTable = sqliteTable("assessment_components", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  classSubjectId: integer("class_subject_id")
    .notNull()
    .references(() => classSubjectsTable.id, { onDelete: "cascade" }),
  termId: integer("term_id")
    .notNull()
    .references(() => termsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  weightPercent: real("weight_percent").notNull(),
  maxScore: real("max_score").notNull(),
});

export const insertAssessmentComponentSchema = createInsertSchema(
  assessmentComponentsTable,
).omit({ id: true });
export type InsertAssessmentComponent = z.infer<typeof insertAssessmentComponentSchema>;
export type AssessmentComponent = typeof assessmentComponentsTable.$inferSelect;
`,
  'scores.ts': `import { sqliteTable, integer, text, real, index } from "drizzle-orm/sqlite-core";
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
  enteredAt: integer("entered_at", { mode: "timestamp" }).notNull().default(sql\`(strftime('%s', 'now'))\`),
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
`,
  'grading-scale.ts': `import { sqliteTable, integer, text, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const gradingScaleTable = sqliteTable("grading_scale", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  minScore: real("min_score").notNull(),
  maxScore: real("max_score").notNull(),
  gradeLabel: text("grade_label").notNull(),
  remark: text("remark").notNull(),
});

export const insertGradingScaleSchema = createInsertSchema(gradingScaleTable).omit({ id: true });
export type InsertGradingScale = z.infer<typeof insertGradingScaleSchema>;
export type GradingScale = typeof gradingScaleTable.$inferSelect;
`,
  'report-card-status.ts': `import { sqliteTable, integer, text, index } from "drizzle-orm/sqlite-core";
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
`,
  'audit-logs.ts': `import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { usersTable } from "./users";

export const auditLogsTable = sqliteTable("audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  actorUserId: integer("actor_user_id")
    .references(() => usersTable.id, { onDelete: "set null" }),
  action: text("action").notNull(), // e.g. "INSERT", "UPDATE", "DELETE"
  tableName: text("table_name").notNull(), // e.g. "scores"
  rowId: integer("row_id").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  timestamp: integer("timestamp", { mode: "timestamp" }).notNull().default(sql\`(strftime('%s', 'now'))\`),
});

export type AuditLog = typeof auditLogsTable.$inferSelect;
export type InsertAuditLog = typeof auditLogsTable.$inferInsert;
`,
  'student-term-metadata.ts': `import { sqliteTable, integer, text, index } from "drizzle-orm/sqlite-core";
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
`
};

for (const [filename, content] of Object.entries(files)) {
  const filepath = path.join(targetDir, filename);
  console.log(`Writing SQLite port for ${filename}...`);
  fs.writeFileSync(filepath, content, 'utf8');
}
console.log('All schemas ported to SQLite successfully!');
