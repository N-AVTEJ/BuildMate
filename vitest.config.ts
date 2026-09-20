import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/tests/**/*.test.ts"],
    testTimeout: 30000,
    env: {
      DATABASE_URL: process.env.DATABASE_URL || "postgresql://postgres@127.0.0.1:5433/buildmate",
      NODE_ENV: "test",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
