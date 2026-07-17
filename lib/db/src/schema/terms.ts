import { sqliteTable, integer, text, index } from "drizzle-orm/sqlite-core";
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
