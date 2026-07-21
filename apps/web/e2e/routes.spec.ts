import { expect, test, type Page } from "@playwright/test";

/**
 * Every §4 destination must render without console errors or page crashes —
 * the literal Phase exit-gate requirement, verified in a real browser on a
 * mobile viewport.
 */

const ROUTES = [
  { path: "/", heading: /blindly copy a pro/i },
  { path: "/meta", heading: /meta/i },
  { path: "/weapons", heading: /weapons/i },
  { path: "/settings", heading: /settings/i },
  { path: "/controls", heading: /controls/i },
  { path: "/training", heading: /training/i },
  { path: "/coach", heading: /coach/i },
  { path: "/maps", heading: /maps/i },
  { path: "/pros", heading: /pro settings vault/i },
  { path: "/community", heading: /community/i },
  { path: "/profile", heading: /profile/i },
];

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => {
    errors.push(error.message);
  });
  return errors;
}

for (const route of ROUTES) {
  test(`${route.path} renders without console errors`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(route.path);
    const h1 = page.getByRole("heading", { level: 1 }).first();
    await expect(h1).toBeVisible();
    await expect(h1).toContainText(route.heading);
    // Disclaimer must be visible on every page (spec §15/§23).
    await expect(page.getByText(/independent training companion/i)).toBeVisible();
    expect(errors, `console errors on ${route.path}`).toEqual([]);
  });
}

test("bottom navigation More sheet exposes all 11 destinations", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "More destinations" }).click();
  const dialog = page.getByRole("dialog", { name: "All destinations" });
  await expect(dialog).toBeVisible();
  for (const title of [
    "Home",
    "Meta",
    "Weapons",
    "Settings",
    "Controls",
    "Training",
    "Coach",
    "Maps",
    "Pros",
    "Community",
    "Profile",
  ]) {
    await expect(dialog.getByRole("link", { name: new RegExp(`^${title}`) })).toBeVisible();
  }
});
