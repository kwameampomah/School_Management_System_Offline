import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
    env: {
      DATABASE_URL: "file:./school_test.db",
      SESSION_SECRET: "test-secret-value-for-sessions-here",
    },
  },
});
