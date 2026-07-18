import { sqliteTable, integer, text, index } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { studentsTable } from "./students";
import { classesTable } from "./classes";
import { termsTable } from "./terms";
import { usersTable } from "./users";

export const feeTypesTable = sqliteTable("fee_types", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  amount: text("amount").notNull(), // text to preserve precise decimals in SQLite
  description: text("description"),
  createdAt: text("created_at")
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
});

export const studentFeesTable = sqliteTable("student_fees", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: integer("student_id")
    .notNull()
    .references(() => studentsTable.id, { onDelete: "cascade" }),
  termId: integer("term_id")
    .notNull()
    .references(() => termsTable.id, { onDelete: "cascade" }),
  feeTypeId: integer("fee_type_id")
    .notNull()
    .references(() => feeTypesTable.id, { onDelete: "restrict" }),
  amountDue: text("amount_due").notNull(),
  amountPaid: text("amount_paid").notNull().default("0.00"),
  dueDate: text("due_date"),
  createdAt: text("created_at")
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
}, (table) => [
  index("student_fees_student_term_idx").on(table.studentId, table.termId),
]);

export const feePaymentsTable = sqliteTable("fee_payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentFeeId: integer("student_fee_id")
    .notNull()
    .references(() => studentFeesTable.id, { onDelete: "cascade" }),
  amountPaid: text("amount_paid").notNull(),
  paymentDate: text("payment_date").notNull(),
  paymentMethod: text("payment_method")
    .$type<"cash" | "bank_transfer" | "momo">()
    .notNull(),
  reference: text("reference"),
  recordedBy: integer("recorded_by").references(() => usersTable.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdAt: text("created_at")
    .$defaultFn(() => new Date().toISOString())
    .notNull(),
}, (table) => [
  index("fee_payments_student_fee_idx").on(table.studentFeeId),
]);

export const insertFeeTypeSchema = createInsertSchema(feeTypesTable).omit({ id: true, createdAt: true });
export type InsertFeeType = z.infer<typeof insertFeeTypeSchema>;
export type FeeType = typeof feeTypesTable.$inferSelect;

export const insertStudentFeeSchema = createInsertSchema(studentFeesTable).omit({ id: true, createdAt: true });
export type InsertStudentFee = z.infer<typeof insertStudentFeeSchema>;
export type StudentFee = typeof studentFeesTable.$inferSelect;

export const insertFeePaymentSchema = createInsertSchema(feePaymentsTable).omit({ id: true, createdAt: true });
export type InsertFeePayment = z.infer<typeof insertFeePaymentSchema>;
export type FeePayment = typeof feePaymentsTable.$inferSelect;
