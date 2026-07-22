import { expect, test, type Page } from "@playwright/test";

/**
 * Phase 8: coach marketplace — application, editor verification, booking,
 * delivery, review, and the admin payout ledger (§5.17, §14 Marketplace).
 */

async function signup(page: Page, prefix: string): Promise<void> {
  const email = `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("test-password-123");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/profile");
}

function card(page: Page, text: string) {
  return page.locator("div.rounded-lg.border").filter({ hasText: text });
}

test("directory shows sample coaches honestly and blocks credential-risk listings", async ({
  page,
}) => {
  await page.goto("/coach/marketplace");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/marketplace/i);
  await expect(page.getByText(/never.*get your game account|coaches.*never/i).first()).toBeVisible();
  await expect(page.getByText("Emberline (sample)")).toBeVisible();
  await expect(page.getByText("not accepting bookings").first()).toBeVisible();

  // Sample coach detail renders with sample labeling; no booking form offered.
  await page.goto("/coach/marketplace/sample-coach-emberline");
  await expect(page.getByText("sample", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Request booking" })).toHaveCount(0);
});

test("full loop: apply → verify → book → deliver → confirm → review → payout", async ({
  browser,
}) => {
  const stamp = Date.now();
  const coachName = `Coach E2E ${stamp}`;

  // 1. A user applies as a coach.
  const coachContext = await browser.newContext();
  const coachPage = await coachContext.newPage();
  await signup(coachPage, "e2e-mk-coach");
  await coachPage.goto("/coach/marketplace");
  await coachPage.getByLabel("Coach name").fill(coachName);
  await coachPage.getByLabel("Region").fill("EU");
  await coachPage.getByLabel("Headline").fill("Entry timing and trade discipline specialist");
  await coachPage
    .getByLabel("Bio")
    .fill("Async reviews with timestamped notes and drill assignments from the academy.");
  await coachPage.getByLabel("Languages (comma-separated)").fill("en");
  await coachPage
    .getByLabel("Credentials (editors verify this)")
    .fill("Three seasons of competitive scrims; e2e fixture data.");
  await coachPage.getByLabel("Title").fill("Async clip review");
  await coachPage.getByLabel("Price (USD)").fill("15");
  await coachPage.getByRole("button", { name: "Apply as a coach" }).click();
  await expect(coachPage.getByText("coach application pending review")).toBeVisible();

  // 2. An editor verifies the credentials.
  const editorContext = await browser.newContext();
  const editorPage = await editorContext.newPage();
  await signup(editorPage, "editor-mk");
  await editorPage.goto("/admin/coach");
  await expect(editorPage.getByText("Coach applications")).toBeVisible();
  await card(editorPage, coachName)
    .getByRole("button", { name: "Verify credentials" })
    .click();
  await expect(editorPage.getByText(coachName)).toHaveCount(0);

  // 3. A player books the now-verified coach.
  const playerContext = await browser.newContext();
  const playerPage = await playerContext.newPage();
  await signup(playerPage, "e2e-mk-player");
  await playerPage.goto("/coach/marketplace");
  await expect(playerPage.getByText(coachName)).toBeVisible();
  await card(playerPage, coachName).getByRole("link", { name: "View" }).click();
  await playerPage.waitForURL("**/coach/marketplace/**");
  await playerPage
    .getByLabel("What should the coach focus on?")
    .fill("Mid-range fights on Miramar; I keep losing the first exchange.");
  await playerPage.getByRole("button", { name: "Request booking" }).click();
  await playerPage.waitForURL("**/coach/bookings");
  await expect(playerPage.getByText("requested")).toBeVisible();

  // 4. The coach accepts and delivers.
  await coachPage.goto("/coach/bookings");
  await expect(coachPage.getByRole("heading", { name: "As coach" })).toBeVisible();
  await coachPage.getByRole("button", { name: "Accept" }).click();
  await expect(coachPage.getByText("accepted")).toBeVisible();
  await coachPage
    .getByLabel("Written deliverable")
    .fill(
      "00:42 you peek the same head angle twice — vary the re-peek. Run peek_timer twice this week.",
    );
  await coachPage.getByRole("button", { name: "Deliver review" }).click();
  await expect(coachPage.getByText("delivered")).toBeVisible();

  // 5. The player confirms delivery and reviews.
  await playerPage.reload();
  await expect(playerPage.getByText(/peek the same head angle/)).toBeVisible();
  await playerPage.getByRole("button", { name: "Confirm delivery" }).click();
  await expect(playerPage.getByText("completed")).toBeVisible();
  await playerPage.getByLabel("Rating (1–5)").fill("5");
  await playerPage.getByLabel("Review (optional)").fill("Specific, timestamped, worth it.");
  await playerPage.getByRole("button", { name: "Submit review" }).click();
  // Revalidation replaces the form once the review is recorded.
  await expect(playerPage.getByRole("button", { name: "Submit review" })).toHaveCount(0);

  // 6. The payout appears for admins with the fee split, and can be marked sent.
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await signup(adminPage, "admin-mk");
  await adminPage.goto("/admin/payouts");
  const payoutCard = card(adminPage, coachName);
  await expect(payoutCard.getByText(/charge \$15\.00/)).toBeVisible();
  await expect(payoutCard.getByText(/net \$12\.00/)).toBeVisible();
  await payoutCard.getByRole("button", { name: "Mark payout sent" }).click();
  await expect(adminPage.getByText(coachName)).toHaveCount(0);

  // 7. The public coach page now shows the review.
  await playerPage.goto("/coach/marketplace");
  await expect(card(playerPage, coachName).getByText(/★ 5/)).toBeVisible();

  await coachContext.close();
  await editorContext.close();
  await playerContext.close();
  await adminContext.close();
});
