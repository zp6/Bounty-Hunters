import { test, expect } from "@playwright/test";

test.describe("App Loading", () => {
  test("app renders without errors", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto("/");

    // Verify main layout renders
    await expect(page.locator("[data-testid='app-layout']")).toBeVisible({ timeout: 10000 });

    // Verify no console errors
    expect(consoleErrors).toHaveLength(0);
  });

  test("sidebar is visible on load", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("[data-testid='sidebar']")).toBeVisible({ timeout: 10000 });
  });

  test("chat panel is visible on load", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("[data-testid='chat-panel']")).toBeVisible({ timeout: 10000 });
  });
});
