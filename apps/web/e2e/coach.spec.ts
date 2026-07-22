import { expect, test, type Page } from "@playwright/test";

/**
 * Phase 7: AI coach — upload flow, simulated analysis, honest mock report,
 * privacy deletion, and the editor review tools.
 */

async function signup(page: Page, prefix = "e2e-coach"): Promise<void> {
  const email = `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("test-password-123");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/profile");
}

async function createAnalyzedUpload(page: Page, label: string): Promise<void> {
  await page.goto("/coach");
  await page.getByLabel("Recording type").selectOption("clip");
  await page.getByLabel("Label").fill(label);
  await page.getByLabel("Length (seconds)").fill("95");
  await page.getByRole("button", { name: "Register recording" }).click();
  await expect(page.getByText(label)).toBeVisible();
  await page.getByRole("button", { name: /Attach recording/ }).click();
  await expect(page.getByText("ready to analyze")).toBeVisible();
  await page.getByRole("button", { name: "Request analysis" }).click();
  await expect(page.getByText("report ready")).toBeVisible();
}

test("upload → analysis → honest mock report round trip", async ({ page }) => {
  await signup(page);
  await page.goto("/coach");

  // The page is explicit about mode, quota, and boundaries before upload.
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/AI Coach/i);
  await expect(page.getByText(/mock provider/i)).toBeVisible();
  await expect(page.getByText(/Analyses this month: 0 of/)).toBeVisible();
  await expect(page.getByText(/never live assistance/i)).toBeVisible();

  const label = `Ranked final circle ${Date.now()}`;
  await createAnalyzedUpload(page, label);

  await page.getByRole("link", { name: "View report" }).click();
  await page.waitForURL("**/coach/reports/**");

  // §5.13 output format, honestly labeled as mock.
  await expect(page.getByRole("heading", { name: "Coaching report" })).toBeVisible();
  await expect(page.getByText("pending human spot-check")).toBeVisible();
  await expect(page.getByText(/MOCK ANALYSIS/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Highest-impact mistakes" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Assigned drills" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "What the model could not determine" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Observation timeline" })).toBeVisible();
  await expect(page.getByText(/model: mock-coach · prompt: coach-v1/)).toBeVisible();

  // Drill assignments link into the training academy.
  const drillLink = page
    .locator("a[href^='/training/drills/']")
    .first();
  await expect(drillLink).toBeVisible();
});

test("deleting an upload removes the whole analysis (privacy)", async ({ page }) => {
  await signup(page);
  const label = `Delete me ${Date.now()}`;
  await createAnalyzedUpload(page, label);

  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText(label)).toHaveCount(0);
  await expect(page.getByText(/Nothing registered yet/)).toBeVisible();
});

test("editors spot-check reports; players see the outcome", async ({ browser }) => {
  // Player produces a report.
  const playerContext = await browser.newContext();
  const playerPage = await playerContext.newPage();
  await signup(playerPage, "e2e-coach-player");
  const label = `Review flow ${Date.now()}`;
  await createAnalyzedUpload(playerPage, label);
  await playerPage.getByRole("link", { name: "View report" }).click();
  await playerPage.waitForURL("**/coach/reports/**");
  const reportUrl = playerPage.url();
  await expect(playerPage.getByText("pending human spot-check")).toBeVisible();

  // Editor (mock-mode affordance: editor-* email) reviews that exact report.
  const editorContext = await browser.newContext();
  const editorPage = await editorContext.newPage();
  await signup(editorPage, "editor-e2e");
  await editorPage.goto("/admin/coach");
  await expect(editorPage.getByText(/awaiting a human spot-check/i)).toBeVisible();

  await editorPage.goto(reportUrl);
  await expect(editorPage.getByText("Editorial spot-check")).toBeVisible();
  await editorPage.getByRole("button", { name: "Publish" }).click();
  await expect(editorPage.getByText("human spot-checked")).toBeVisible();

  // The player sees the reviewed badge.
  await playerPage.reload();
  await expect(playerPage.getByText("human spot-checked")).toBeVisible();

  await playerContext.close();
  await editorContext.close();
});

test("guests are asked to sign in", async ({ page }) => {
  await page.goto("/coach");
  await expect(page.getByText(/Sign in to upload recordings/)).toBeVisible();
});
