import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Explicit imports (no vitest globals) mean RTL can't self-register cleanup.
afterEach(() => {
  cleanup();
});
