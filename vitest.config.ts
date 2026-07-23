import { defineConfig } from "vitest/config";

export default defineConfig({
  ssr: {
    noExternal: ["@react-spectrum/s2"]
  },
  test: {
    globals: true,
    coverage: { enabled: false },
    include: ["tests/**/*.test.{ts,tsx}", "packages/**/*.test.{ts,tsx}"]
  }
});
