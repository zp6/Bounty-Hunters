import { test, expect } from "@playwright/test";

test.describe("Command Palette", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.locator("[data-testid='app-layout']").waitFor({ state: "visible" });
  });

  test("opens command palette with keyboard shortcut", async ({ page }) => {
    // Press Ctrl+Shift+P to open
    await page.keyboard.press("Control+Shift+P");
    await expect(page.locator("[data-testid='command-palette']")).toBeVisible();
  });

  test("searches for a command", async ({ page }) => {
    await page.keyboard.press("Control+Shift+P");
    await expect(page.locator("[data-testid='command-palette']")).toBeVisible();

    // Type search query
    await page.locator("[data-testid='command-palette-input']").fill("new chat");
    await expect(page.locator("[data-testid='command-palette-results']")).toBeVisible();

    // Should find matching commands
    const results = page.locator("[data-testid='command-result']");
    expect(await results.count()).toBeGreaterThan(0);
  });

  test("closes command palette with Escape", async ({ page }) => {
    await page.keyboard.press("Control+Shift+P");
    await expect(page.locator("[data-testid='command-palette']")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.locator("[data-testid='command-palette']")).not.toBeVisible();
  });
});
