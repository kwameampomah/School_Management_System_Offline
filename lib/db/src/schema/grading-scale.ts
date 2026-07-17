import { sqliteTable, integer, text, real } from "drizzle-orm/sqlite-core";
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
