import { expect, test, type Page } from "@playwright/test";

/**
 * Phase 8: billing + entitlements — the §17 critical "user upgrades" flow and
 * the §14 gates it unlocks. Mock billing mode (no Stripe credentials).
 */

async function signup(page: Page, prefix = "e2e-bill"): Promise<void> {
  const email = `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("test-password-123");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/profile");
}

test("plans are public and mock mode is loudly labeled", async ({ page }) => {
  await page.goto("/billing");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Plans/);
  await expect(page.getByRole("heading", { name: "Free", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pro", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Elite", exact: true })).toBeVisible();
  await expect(page.getByText(/mock mode/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in to upgrade" }).first()).toBeVisible();
});

test("upgrading unlocks AI analysis; downgrading re-locks it", async ({ page }) => {
  await signup(page);

  // Free: coach is gated.
  await page.goto("/coach");
  await expect(page.getByText("AI analysis is a Pro feature")).toBeVisible();

  // Upgrade (mock checkout) — the critical flow.
  await page.goto("/billing");
  await expect(page.getByText("Current plan:")).toBeVisible();
  await page.getByRole("button", { name: "Switch to Pro (mock)" }).click();
  await expect(page.getByText(/Switched to pro \(mock billing/)).toBeVisible();
  await expect(page.getByRole("main").getByText("current", { exact: true })).toBeVisible();

  await page.goto("/coach");
  await expect(page.getByText(/Analyses this month: 0 of 10/)).toBeVisible();
  await expect(page.getByText("AI analysis is a Pro feature")).toHaveCount(0);

  // Downgrade re-locks.
  await page.goto("/billing");
  await page.getByRole("button", { name: "Back to Free (mock)" }).click();
  await expect(page.getByText(/Back on Free \(mock billing/)).toBeVisible();
  await page.goto("/coach");
  await expect(page.getByText("AI analysis is a Pro feature")).toBeVisible();
});

test("full-match reviews are Elite-only", async ({ page }) => {
  await signup(page);
  await page.goto("/billing");
  await page.getByRole("button", { name: "Switch to Pro (mock)" }).click();
  await expect(page.getByText(/Switched to pro/)).toBeVisible();

  await page.goto("/coach");
  const label = `Full match ${Date.now()}`;
  await page.getByLabel("Recording type").selectOption("full_match");
  await page.getByLabel("Label").fill(label);
  await page.getByRole("button", { name: "Register recording" }).click();
  await expect(page.getByText(label)).toBeVisible();
  await page.getByRole("button", { name: /Attach recording/ }).click();
  await page.getByRole("button", { name: "Request analysis" }).click();
  await expect(page.getByText(/Full-match reviews are an Elite feature/)).toBeVisible();

  await page.goto("/billing");
  await page.getByRole("button", { name: "Switch to Elite (mock)" }).click();
  await expect(page.getByText(/Switched to elite/)).toBeVisible();
  await page.goto("/coach");
  await page.getByRole("button", { name: "Request analysis" }).click();
  await expect(page.getByText("report ready")).toBeVisible();
});

test("free plan caps saved sensitivity profiles at one", async ({ page }) => {
  await signup(page);
  await page.goto("/settings/sensitivity");
  await page.getByLabel("New profile name").fill("Main profile");
  await page.getByRole("button", { name: "Create profile" }).click();
  await page.waitForURL("**/settings/sensitivity/*");

  await page.goto("/settings/sensitivity");
  await page.getByLabel("New profile name").fill("Second profile");
  await page.getByRole("button", { name: "Create profile" }).click();
  await expect(page.getByText(/plan includes 1 saved sensitivity/)).toBeVisible();

  // Upgrade lifts the cap.
  await page.goto("/billing");
  await page.getByRole("button", { name: "Switch to Pro (mock)" }).click();
  await expect(page.getByText(/Switched to pro/)).toBeVisible();
  await page.goto("/settings/sensitivity");
  await page.getByLabel("New profile name").fill("Second profile");
  await page.getByRole("button", { name: "Create profile" }).click();
  await page.waitForURL("**/settings/sensitivity/*");
});
