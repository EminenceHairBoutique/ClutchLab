import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Booting a throwaway Postgres cluster + migrations takes a few seconds.
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});
