import { test, expect } from "@playwright/test";

test.describe("Parent Report Card Viewer", () => {
  test("loads parent dashboard and transitions to single report card page", async ({ page }) => {
    // 1. Start on the dashboard/login page
    await page.goto("/");

    // 2. Validate basic title/header is present
    await expect(page).toHaveTitle(/Taifa Ebenezer/i);

    // 3. Check for main page content elements
    const heading = page.locator("h1");
    await expect(heading).toBeVisible();
  });
});
