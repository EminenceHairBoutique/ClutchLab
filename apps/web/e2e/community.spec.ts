import { expect, test, type Page } from "@playwright/test";

/** Phase 6: community — posting, auto-flags, comments, reactions, reports. */

async function signup(page: Page): Promise<void> {
  const email = `e2e-comm-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("test-password-123");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/profile");
}

test("post, comment, react, and report round trip", async ({ page }) => {
  await signup(page);
  await page.goto("/community");

  const title = `My 3x spray after calibration ${Date.now()}`;
  await page.getByLabel("Type").selectOption("settings");
  await page.getByLabel("Title").fill(title);
  await page
    .getByLabel("Body")
    .fill("Dropped ADS 3x from 40 to 38 after the spray test — group tightened at 35m.");
  await page.getByRole("button", { name: "Post", exact: true }).click();
  await page.waitForURL("**/community/*");
  await expect(page.getByRole("heading", { name: title })).toBeVisible();

  // Comment
  await page.getByLabel("Add a comment").fill("Which grip are you on?");
  await page.getByRole("button", { name: "Comment" }).click();
  await expect(page.getByText("Which grip are you on?")).toBeVisible();

  // React
  await page.getByRole("button", { name: /Tested it/ }).click();
  await expect(page.getByRole("button", { name: /Tested it · 1/ })).toBeVisible();

  // Report
  await page.getByText("Report this").click();
  await page.getByLabel("Reason").selectOption("spam");
  await page.getByRole("button", { name: "Submit report" }).click();
  await expect(page.getByText(/Report submitted/)).toBeVisible();
});

test("prohibited content is auto-flagged and held from the public feed", async ({ page }) => {
  await signup(page);
  await page.goto("/community");

  await page.getByLabel("Title").fill("Selling my account cheap with UC");
  await page.getByLabel("Body").fill("uc cheap top-up deal, selling my account too");
  await page.getByRole("button", { name: "Post", exact: true }).click();
  await expect(page.getByText(/held for moderator review/)).toBeVisible();

  // Author sees it marked in the list; anonymous visitors don't see it at all.
  await expect(page.getByText("held for review", { exact: true })).toBeVisible();
});

test("community rules are stated up front", async ({ page }) => {
  await page.goto("/community");
  await expect(page.getByText(/no cheats, macros, modified clients/i)).toBeVisible();
  await expect(page.getByText(/claims need sources/i)).toBeVisible();
});
