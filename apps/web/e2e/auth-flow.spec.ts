import { expect, test } from "@playwright/test";

/**
 * Full auth + profile flow against the mock adapter (the server runs with
 * APP_ENV=test and no Supabase env): signup → save profile → sign out, plus
 * the /admin role gate. The same UI drives Supabase when configured.
 */

test("signup, profile save, and sign-out round trip", async ({ page }) => {
  const email = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;

  await page.goto("/signup");
  await expect(page.getByText(/mock mode/i)).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("test-password-123");
  await page.getByRole("button", { name: "Create account" }).click();

  await page.waitForURL("**/profile");
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();

  await page.getByLabel("Display name").fill("E2E Player");
  await page.getByLabel("Handle").fill("e2e_player");
  await page.getByLabel("Finger count").selectOption("4");
  await page.getByLabel("Grip style").selectOption("claw_4");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Profile saved.")).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL((url) => url.pathname === "/");
  await page.goto("/profile");
  await expect(page.getByText(/browsing as a guest/i)).toBeVisible();
});

test("signin rejects wrong credentials with a visible error", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("nobody@example.com");
  await page.getByLabel("Password").fill("wrong-password-1");
  await page.getByRole("button", { name: "Sign in" }).click();
  // .filter() excludes Next.js's always-present route-announcer alert node.
  await expect(page.getByRole("alert").filter({ hasText: /invalid/i })).toContainText(
    /invalid email or password/i,
  );
});

test("admin area redirects guests to login and denies non-editors", async ({ page }) => {
  await page.goto("/admin");
  await page.waitForURL("**/login");

  const email = `e2e-admin-${Date.now()}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("test-password-123");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/profile");

  await page.goto("/admin");
  await expect(page.getByText("Access denied")).toBeVisible();
});
