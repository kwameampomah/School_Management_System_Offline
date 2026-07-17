import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

// ─── Database Mode Selection (Offline SQLite) ────────────────────────────────
//
// Connecting to a local SQLite file (school.db) via LibSQL.
// No cloud DB required.
// ─────────────────────────────────────────────────────────────────────────────

function resolveConnectionString(): string {
  const url = process.env.DATABASE_URL || "file:./school.db";
  return url;
}

const connectionString = resolveConnectionString();

export const client = createClient({ url: connectionString });
export const db = drizzle(client, { schema });
export const pool = client as any; // Mock pg pool export to prevent breaking backend session store setup if referenced

export * from "./schema";
