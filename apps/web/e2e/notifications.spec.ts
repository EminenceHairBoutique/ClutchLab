import { expect, test, type Page } from "@playwright/test";

/** §5.18: strictly opt-in preferences, in-app inbox, honest push state. */

async function signup(page: Page, prefix = "e2e-notif"): Promise<void> {
  const email = `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("test-password-123");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/profile");
}

async function upgradeToPro(page: Page): Promise<void> {
  await page.goto("/billing");
  await page.getByRole("button", { name: "Switch to Pro (mock)" }).click();
  await expect(page.getByText(/Switched to pro/)).toBeVisible();
}

async function runCoachAnalysis(page: Page, label: string): Promise<void> {
  await page.goto("/coach");
  await page.getByLabel("Recording type").selectOption("clip");
  await page.getByLabel("Label").fill(label);
  await page.getByRole("button", { name: "Register recording" }).click();
  await expect(page.getByText(label)).toBeVisible();
  await page.getByRole("button", { name: /Attach recording/ }).click();
  await page.getByRole("button", { name: "Request analysis" }).click();
  await expect(page.getByText("report ready")).toBeVisible();
}

test("nothing fires without opt-in; enabling a kind delivers to the inbox", async ({ page }) => {
  await signup(page);
  await upgradeToPro(page);

  // Analysis completes BEFORE any preference is enabled → inbox stays empty.
  await runCoachAnalysis(page, `Silent run ${Date.now()}`);
  await page.goto("/notifications");
  await expect(page.getByText(/Everything here is opt-in/)).toBeVisible();
  await expect(page.getByText("Nothing yet", { exact: false })).toBeVisible();

  // Opt in to coach activity, run another analysis → notification arrives.
  await page.getByLabel(/Coach activity/).check();
  await page.getByRole("button", { name: "Save preferences" }).click();
  await runCoachAnalysis(page, `Notified run ${Date.now()}`);

  await page.goto("/notifications");
  await expect(page.getByText("Your coaching report is ready")).toBeVisible();
  await expect(page.getByText("1 unread")).toBeVisible();

  // The notification links into the report; mark-all-read clears the badge.
  await page.getByRole("button", { name: "Mark all read" }).click();
  await expect(page.getByText("1 unread")).toHaveCount(0);
});

test("community replies notify the post author when opted in", async ({ browser }) => {
  const authorContext = await browser.newContext();
  const authorPage = await authorContext.newPage();
  await signup(authorPage, "e2e-notif-author");
  await authorPage.goto("/notifications");
  await authorPage.getByLabel(/Community reply/).check();
  await authorPage.getByRole("button", { name: "Save preferences" }).click();

  const title = `Notify me thread ${Date.now()}`;
  await authorPage.goto("/community");
  await authorPage.getByLabel("Type").selectOption("question");
  await authorPage.getByLabel("Title").fill(title);
  await authorPage.getByLabel("Body").fill("Which grip works best on a 6.1 inch phone?");
  await authorPage.getByRole("button", { name: "Post", exact: true }).click();
  await authorPage.waitForURL("**/community/*");
  const postUrl = authorPage.url();

  const replierContext = await browser.newContext();
  const replierPage = await replierContext.newPage();
  await signup(replierPage, "e2e-notif-replier");
  await replierPage.goto(postUrl);
  await replierPage.getByLabel("Add a comment").fill("Claw with index triggers worked for me.");
  await replierPage.getByRole("button", { name: "Comment" }).click();
  await expect(replierPage.getByText(/Claw with index triggers/)).toBeVisible();

  await authorPage.goto("/notifications");
  await expect(authorPage.getByText("New reply on your post")).toBeVisible();

  await authorContext.close();
  await replierContext.close();
});

test("push section states the honest unconfigured status", async ({ page }) => {
  await signup(page);
  await page.goto("/notifications");
  await expect(page.getByText(/Web push is not configured/)).toBeVisible();
  await expect(page.getByText(/install ClutchLab to your Home Screen/i)).toBeVisible();
});
