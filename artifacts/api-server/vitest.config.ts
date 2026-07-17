import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
    env: {
      DATABASE_URL: "postgres://postgres:postgres@localhost:5432/school_test",
      SESSION_SECRET: "test-secret-value-for-sessions-here",
    },
  },
});
