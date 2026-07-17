import { sqliteTable, integer, text, real } from "drizzle-orm/sqlite-core";
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
