import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Pure logic only — RN components are exercised by `expo export` bundling.
    include: ["src/lib/**/*.test.ts"],
  },
});
