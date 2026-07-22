import { expect, test, type Page } from "@playwright/test";

/** Phase 4: training academy — catalog, generator, session round trip. */

async function signup(page: Page): Promise<void> {
  const email = `e2e-train-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("test-password-123");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/profile");
}

test("training overview shows drills, plans, and the code-free WoW directory", async ({ page }) => {
  await page.goto("/training");
  await expect(page.getByRole("heading", { level: 1, name: "Training" })).toBeVisible();
  await expect(page.getByText(/\d+ deliberate-practice drills/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Ultimate Royale prep/ })).toBeVisible();
  const pendingBadges = page.getByText("code pending verification");
  expect(await pendingBadges.count()).toBeGreaterThanOrEqual(6);
});

test("drill detail shows the full §5.10 structure", async ({ page }) => {
  await page.goto("/training/drills/first_ten_reddot");
  await expect(page.getByRole("heading", { level: 1, name: "First 10 — red dot" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pass bar" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Advanced bar" })).toBeVisible();
  await expect(page.getByText(/Common mistake:/)).toBeVisible();
  await expect(page.getByText(/Coaching cue:/)).toBeVisible();
  await expect(page.getByRole("link", { name: "First 10 — 3×" })).toBeVisible();
});

test("generator respects the budget and aim-assist-off prep", async ({ page }) => {
  await page.goto("/training/generate?minutes=15&aa=off");
  await expect(page.getByRole("heading", { level: 1, name: /15-minute plan/ })).toBeVisible();
  await expect(page.getByText(/Ultimate Royale preparation/)).toBeVisible();
  await expect(page.getByText(/minutes planned/)).toBeVisible();
});

test("full session round trip: plan → start → log → complete → weekly summary", async ({ page }) => {
  await signup(page);

  await page.goto("/training/plans/warmup_5");
  await page.getByRole("button", { name: "Start this session" }).click();
  await page.waitForURL("**/training/sessions/*");
  await expect(page.getByRole("heading", { level: 1, name: "5-minute warmup" })).toBeVisible();

  // Log a passing result on the first drill
  await page
    .getByLabel("Result")
    .first()
    .selectOption("pass");
  await page.getByRole("button", { name: "Log result" }).first().click();
  await expect(page.getByText("passed").first()).toBeVisible();

  // Complete the session
  await page.getByLabel("Session note (optional)").fill("Crisp start");
  await page.getByRole("button", { name: "Complete session" }).click();
  await expect(page.getByText("Session complete")).toBeVisible();

  // Weekly summary reflects it
  await page.goto("/training");
  await expect(page.getByText("Your last 7 days")).toBeVisible();
  await expect(page.getByText("sessions completed")).toBeVisible();

  // §5.14 report cadence: daily/weekly/monthly + a live 1-day streak.
  await page.getByRole("link", { name: /Reports & streak/ }).click();
  await page.waitForURL("**/training/reports");
  await expect(page.getByText("Practice streak")).toBeVisible();
  const streakCard = page
    .locator("div.rounded-lg.border")
    .filter({ hasText: "Practice streak" });
  await expect(streakCard.getByText(/1\s*day/)).toBeVisible();
  await expect(page.getByText("Today (last 24h)")).toBeVisible();
  await expect(page.getByText("This week (last 7 days)")).toBeVisible();
  await expect(page.getByText("This month (last 30 days)")).toBeVisible();
  await expect(page.getByText(/No fabricated accuracy scores/)).toBeVisible();
});
