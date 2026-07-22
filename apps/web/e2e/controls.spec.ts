import { expect, test, type Page } from "@playwright/test";

/** Phase 5: Control Layout Studio — templates, editor, analysis, versioning. */

async function signup(page: Page): Promise<void> {
  const email = `e2e-ctrl-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("test-password-123");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/profile");
}

test("guest view shows templates and a sign-in prompt", async ({ page }) => {
  await page.goto("/controls");
  await expect(page.getByRole("heading", { level: 1, name: "Control Layout Studio" })).toBeVisible();
  await expect(page.getByText("Sign in to build layouts")).toBeVisible();
  await expect(page.getByText("Four-finger claw")).toBeVisible();
  expect(await page.getByText("sample starting point").count()).toBe(4);
});

test("create → edit → save version → rollback round trip", async ({ page }) => {
  await signup(page);
  await page.goto("/controls");
  await page.getByLabel("New layout name").fill("Main claw");
  await page.getByLabel("Starting template", { exact: true }).selectOption("four_finger");
  await page.getByRole("button", { name: "Create layout" }).click();
  await page.waitForURL("**/controls/*");

  // Editor renders elements and a live score
  await expect(page.getByRole("heading", { level: 1, name: "Main claw" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Fire (left) control" })).toBeVisible();
  await expect(page.getByText(/live ergonomics score \d+/)).toBeVisible();
  await expect(page.getByText("v1")).toBeVisible();

  // Drag the ADS button toward center-right
  const canvas = page.getByTestId("layout-canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas not measurable");
  const scope = page.getByRole("button", { name: "ADS / scope control" });
  const scopeBox = await scope.boundingBox();
  if (!scopeBox) throw new Error("scope not measurable");
  await page.mouse.move(scopeBox.x + scopeBox.width / 2, scopeBox.y + scopeBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.4, { steps: 5 });
  await page.mouse.up();

  // Save as v2
  await page.getByLabel("Version note").fill("Moved scope inward");
  await page.getByRole("button", { name: "Save as new version" }).click();
  await expect(page.getByText("Saved as a new version.")).toBeVisible();
  await page.reload();
  await expect(page.locator("div").filter({ hasText: /^v2/ }).getByText("active").first()).toBeVisible();

  // Roll back to v1 → v3 with origin rollback
  await page
    .locator("div")
    .filter({ hasText: /^v1/ })
    .getByRole("button", { name: "Roll back to this" })
    .first()
    .click();
  await expect(page.getByText("Rollback to v1")).toBeVisible();
  await expect(page.getByText("v3")).toBeVisible();

  // Test-drill links present
  await expect(page.getByRole("link", { name: "Scope-fire timing" })).toBeVisible();
});
