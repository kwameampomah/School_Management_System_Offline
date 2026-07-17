import { defineConfig } from "drizzle-kit";

function resolveConnectionString(): string {
  const url = process.env.DATABASE_URL || "file:./school.db";
  return url;
}

export default defineConfig({
  schema: "./src/schema/index.ts",
  dialect: "sqlite",
  dbCredentials: {
    url: resolveConnectionString(),
  },
});
