import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

/**
 * Route smoke E2E (Phase exit gate: new routes render without console errors).
 * Uses the preinstalled Chromium at /opt/pw-browsers/chromium when present
 * (sandbox/remote environments); otherwise the Playwright-managed browser (CI
 * installs it with `playwright install chromium`).
 */

const PREINSTALLED_CHROMIUM = "/opt/pw-browsers/chromium";
const PORT = 3211;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    ...devices["Pixel 7"],
    launchOptions: existsSync(PREINSTALLED_CHROMIUM)
      ? { executablePath: PREINSTALLED_CHROMIUM }
      : {},
  },
  webServer: {
    command: `pnpm start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      // Verification server: mock auth mode, never production.
      APP_ENV: "test",
    },
  },
});
