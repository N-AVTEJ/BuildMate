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
      RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || "rzp_test_To6HiHdDl4WMSZ",
      RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || "IOwgSYU19bkWaE8JWM20xwlm",
      NEXT_PUBLIC_RAZORPAY_KEY_ID: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_To6HiHdDl4WMSZ",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
