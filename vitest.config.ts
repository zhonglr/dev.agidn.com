import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    coverage: { enabled: false },
    include: ["tests/**/*.test.{ts,tsx}", "packages/**/*.test.{ts,tsx}"]
  }
});
