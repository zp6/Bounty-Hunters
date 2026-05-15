import { test, expect } from "@playwright/test";

test.describe("Sidebar Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.locator("[data-testid='sidebar']").waitFor({ state: "visible" });
  });

  test("clicking sidebar items changes main content", async ({ page }) => {
    // Click on Files section
    const filesTab = page.locator("[data-testid='sidebar-tab-files']");
    await filesTab.click();

    // Verify files panel is visible
    await expect(page.locator("[data-testid='files-panel']")).toBeVisible();
  });

  test("navigates between sidebar sections", async ({ page }) => {
    // Click Chat tab
    await page.locator("[data-testid='sidebar-tab-chat']").click();
    await expect(page.locator("[data-testid='chat-panel']")).toBeVisible();

    // Click Settings tab
    await page.locator("[data-testid='sidebar-tab-settings']").click();
    await expect(page.locator("[data-testid='settings-panel']")).toBeVisible();
  });

  test("sidebar collapses and expands", async ({ page }) => {
    // Toggle sidebar
    await page.locator("[data-testid='sidebar-toggle']").click();
    await expect(page.locator("[data-testid='sidebar']")).toHaveClass(/collapsed/);

    // Expand again
    await page.locator("[data-testid='sidebar-toggle']").click();
    await expect(page.locator("[data-testid='sidebar']")).not.toHaveClass(/collapsed/);
  });
});
