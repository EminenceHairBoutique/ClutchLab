import { expect, test, type Page } from "@playwright/test";

/** Phase 3: settings library + the full sensitivity builder journey (mock mode). */

async function signup(page: Page): Promise<string> {
  const email = `e2e-sens-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("test-password-123");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/profile");
  return email;
}

test("settings library lists 30+ explainers with honest framing", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
  await expect(page.getByText(/\d{2} settings explained/)).toBeVisible();
  const aimAssist = page.locator("details", { hasText: "Aim assist" }).first();
  await aimAssist.locator("summary").click();
  await expect(aimAssist).toContainText("What it does:");
  await expect(aimAssist).toContainText("What it doesn't:");
});

test("full sensitivity journey: create, edit, version, rollback, code", async ({ page }) => {
  await signup(page);

  await page.goto("/settings/sensitivity");
  await page.getByLabel("New profile name").fill("Main 4-finger");
  await page.getByRole("button", { name: "Create profile" }).click();
  await page.waitForURL("**/settings/sensitivity/*");
  await expect(page.getByRole("heading", { level: 1, name: "Main 4-finger" })).toBeVisible();
  await expect(page.getByText("v1")).toBeVisible();

  // Edit one value and save → v2
  const redDot = page.getByLabel("Red dot / holo / iron", { exact: true }).first();
  await redDot.fill("88");
  await page.getByLabel("Version note").fill("Lowered red dot after tracking test");
  await page.getByRole("button", { name: "Save as new version" }).click();
  await expect(page.getByText("Saved as a new version.")).toBeVisible();
  await page.reload();
  await expect(page.locator("div", { hasText: /^v2/ }).getByText("active").first()).toBeVisible();

  // Roll back to v1 → creates v3 with origin rollback
  await page
    .locator("div")
    .filter({ hasText: /^v1/ })
    .getByRole("button", { name: "Roll back to this" })
    .first()
    .click();
  await expect(page.getByText("Rollback to v1")).toBeVisible();
  await expect(page.getByText("v3")).toBeVisible();

  // Store a code verbatim
  await page.getByLabel("Your in-game share code").fill("6972-1002-3344-5566-777");
  await page.getByRole("button", { name: "Store verbatim" }).click();
  await expect(page.locator("code", { hasText: "6972-1002-3344-5566-777" })).toBeVisible();
});

test("guided calibration adjusts one variable at a time and saves a version", async ({ page }) => {
  await signup(page);
  await page.goto("/settings/sensitivity");
  await page.getByLabel("New profile name").fill("Calib");
  await page.getByRole("button", { name: "Create profile" }).click();
  await page.waitForURL("**/settings/sensitivity/*");

  await page.getByRole("link", { name: "Start guided calibration" }).click();
  await page.waitForURL("**/calibrate");
  await expect(page.getByText("1/14")).toBeVisible();

  // Baseline: on target
  await page.getByRole("button", { name: "On target" }).click();
  // 90° turn: overshoot → −5% on camera:no_scope_tpp (100 → 95)
  await page.getByRole("button", { name: "Overshot / too fast" }).click();
  await expect(page.getByText(/camera:no_scope_tpp 100→95/)).toBeVisible();

  // Walk the remaining steps with neutral outcomes
  for (let i = 0; i < 12; i++) {
    const onTarget = page.getByRole("button", { name: "On target" });
    const stable = page.getByRole("button", { name: "Stable", exact: true }).first();
    if (await onTarget.isVisible().catch(() => false)) {
      await onTarget.click();
    } else {
      await stable.click();
    }
  }

  await expect(page.getByText("Calibration complete")).toBeVisible();
  await page.getByRole("button", { name: "Save as new version" }).click();
  await page.waitForURL("**/settings/sensitivity/*");
  await expect(page.getByText("calibration").first()).toBeVisible();
  await expect(page.getByText(/camera:no_scope_tpp 100→95/)).toBeVisible();
});
