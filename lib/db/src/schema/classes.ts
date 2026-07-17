import { sqliteTable, integer, text, index } from "drizzle-orm/sqlite-core";
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
