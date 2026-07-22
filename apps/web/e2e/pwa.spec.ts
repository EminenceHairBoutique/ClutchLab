import { expect, test } from "@playwright/test";

/** §18 PWA/offline: installability surface for iPhone (and everywhere else). */

test("web app manifest is served with PNG icons and standalone display", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);
  const manifest = (await response.json()) as {
    display: string;
    icons: Array<{ src: string; sizes: string; purpose?: string }>;
  };
  expect(manifest.display).toBe("standalone");
  const sizes = manifest.icons.map((icon) => icon.sizes);
  expect(sizes).toContain("192x192");
  expect(sizes).toContain("512x512");
  expect(manifest.icons.some((icon) => icon.purpose === "maskable")).toBe(true);
  for (const icon of manifest.icons) {
    const iconResponse = await request.get(icon.src);
    expect(iconResponse.ok(), `icon ${icon.src}`).toBe(true);
  }
});

test("iPhone install metadata is present", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    "href",
    /apple-icon/,
  );
  // Next emits the modern standard name; iOS honors it + the manifest display mode.
  await expect(page.locator('meta[name="mobile-web-app-capable"]')).toHaveAttribute(
    "content",
    "yes",
  );
  await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute(
    "content",
    "ClutchLab",
  );
  await expect(
    page.locator('meta[name="apple-mobile-web-app-status-bar-style"]'),
  ).toHaveAttribute("content", "black-translucent");
  const viewport = await page.locator('meta[name="viewport"]').getAttribute("content");
  expect(viewport).toContain("viewport-fit=cover");
});

test("service worker is served and registers", async ({ page, request }) => {
  const swResponse = await request.get("/sw.js");
  expect(swResponse.ok()).toBe(true);
  const body = await swResponse.text();
  expect(body).toContain("addEventListener(\"push\"");
  expect(body).toContain("/offline");

  await page.goto("/");
  const registered = await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return "unsupported";
    const registration = await navigator.serviceWorker.ready;
    return registration.active ? "active" : "pending";
  });
  expect(registered).toBe("active");
});

test("offline fallback page renders", async ({ page }) => {
  await page.goto("/offline");
  await expect(page.getByRole("heading", { name: /offline/i })).toBeVisible();
  await expect(page.getByText(/keep working from cache/i)).toBeVisible();
});
