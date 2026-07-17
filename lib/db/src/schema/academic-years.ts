import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
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
