import { expect, test } from "@playwright/test";

/** Phase 2: meta + weapons pages serving the versioned baseline. */

test("meta page renders the classic tier board with explainable scores", async ({ page }) => {
  await page.goto("/meta");
  await expect(page.getByRole("heading", { level: 1, name: "Meta" })).toBeVisible();
  // Mode tabs exist and mark Ultimate Royale's aim-assist rule
  await expect(page.getByRole("navigation", { name: "Mode" })).toContainText("Ultimate Royale");
  await expect(page.getByRole("navigation", { name: "Mode" })).toContainText("no aim assist");
  // Tier groups render with weapons
  await expect(page.getByLabel("Tier S").or(page.getByLabel("Tier A")).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "M416" })).toBeVisible();
  // Explainability: a breakdown can be opened
  const details = page.locator("details").first();
  await details.locator("summary").click();
  await expect(details).toContainText(/weight/);
  // Provenance is always disclosed
  await expect(page.getByText(/bundled editorial baseline/i)).toBeVisible();
});

test("meta page switches modes via tabs", async ({ page }) => {
  await page.goto("/meta?mode=ultimate_royale");
  await expect(page.getByRole("navigation", { name: "Mode" }).getByText("Ultimate Royale")).toHaveAttribute(
    "aria-current",
    "page",
  );
  // The aim-assist-off penalty appears in the expandable score breakdown.
  const details = page.locator("details").first();
  await details.locator("summary").click();
  await expect(details).toContainText(/Aim assist disabled/);
});

test("weapons catalog groups by class and links to details", async ({ page }) => {
  await page.goto("/weapons");
  await expect(page.getByRole("heading", { level: 1, name: "Weapons" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Assault rifle/ })).toBeVisible();
  await page.getByRole("link", { name: /ACE32/ }).click();
  await page.waitForURL("**/weapons/ace32");
});

test("weapon detail is honest: change callout, no invented stats, tier breakdowns", async ({
  page,
}) => {
  await page.goto("/weapons/ace32");
  await expect(page.getByRole("heading", { level: 1, name: "ACE32" })).toBeVisible();
  await expect(page.getByText("Version 4.5 change")).toBeVisible();
  await expect(page.getByText(/Retest required/)).toBeVisible();
  await expect(page.getByText("Not yet verified")).toBeVisible();
  await expect(page.getByText(/does not invent statistics/)).toBeVisible();
  await expect(page.getByText("Classic Ranked")).toBeVisible();
  await expect(page.getByText("Ultimate Royale")).toBeVisible();
});

test("unknown weapon slugs 404", async ({ page }) => {
  const response = await page.goto("/weapons/not-a-weapon");
  expect(response?.status()).toBe(404);
});

test("home shows version and season intelligence with countdowns", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("PUBG Mobile Version 4.5")).toBeVisible();
  await expect(page.getByText("S31 Classic Season")).toBeVisible();
  await expect(page.getByText("S31 Ultimate Royale")).toBeVisible();
  await expect(page.getByText(/unverified/).first()).toBeVisible();
  await expect(page.getByText(/Balance changes affecting weapons/)).toBeVisible();
});
