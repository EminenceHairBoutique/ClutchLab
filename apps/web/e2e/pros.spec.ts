import { expect, test, type Page } from "@playwright/test";

/** Phase 3: pro vault — labels, honest sample framing, compare, fork. */

async function signup(page: Page): Promise<void> {
  const email = `e2e-pros-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("test-password-123");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/profile");
}

test("pro vault lists sample profiles with explicit fictional labeling", async ({ page }) => {
  await page.goto("/pros");
  await expect(page.getByRole("heading", { level: 1, name: "Pro settings vault" })).toBeVisible();
  await expect(page.getByText(/fictional sample profiles/)).toBeVisible();
  const badges = page.getByText("SAMPLE (fictional)");
  expect(await badges.count()).toBeGreaterThanOrEqual(10);
  await expect(page.getByRole("link", { name: /NovaDrift/ })).toBeVisible();
});

test("pro detail shows values, warnings, and the fictional note", async ({ page }) => {
  await page.goto("/pros/sample-novadrift");
  await expect(page.getByRole("heading", { level: 1, name: "NovaDrift" })).toBeVisible();
  await expect(page.getByText(/Fictional sample profile/)).toBeVisible();
  await expect(page.getByText(/rarely transfer 1:1/)).toBeVisible();
  await expect(page.getByText("Sensitivity values")).toBeVisible();
  await expect(page.getByText("Red dot / holo / iron").first()).toBeVisible();
});

test("signed-in users can fork a pro profile and land in the builder", async ({ page }) => {
  await signup(page);
  await page.goto("/pros/sample-novadrift");
  await page.getByRole("button", { name: "Fork as my profile" }).click();
  await page.waitForURL("**/settings/sensitivity/*");
  await expect(page.getByRole("heading", { level: 1, name: "Fork of NovaDrift" })).toBeVisible();
  await expect(page.getByText(/Forked from NovaDrift/)).toBeVisible();
  await expect(page.getByText("fork").first()).toBeVisible();
});

test("compare view shows deltas against the user's own profile", async ({ page }) => {
  await signup(page);
  // Create a profile to compare with (defaults at 100).
  await page.goto("/settings/sensitivity");
  await page.getByLabel("New profile name").fill("CompareMe");
  await page.getByRole("button", { name: "Create profile" }).click();
  await page.waitForURL("**/settings/sensitivity/*");

  await page.goto("/pros/sample-novadrift");
  await page.getByLabel("Compare with").selectOption({ label: "CompareMe" });
  await page.getByRole("button", { name: "Compare" }).click();
  await expect(page.getByText(/Comparing against/)).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "You" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Δ" })).toBeVisible();
});
