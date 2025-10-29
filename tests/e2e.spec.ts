import { test, expect } from "@playwright/test";

test.describe("App loads and renders scene", () => {
  test("should render canvas and instruction UI", async ({ page }) => {
    await page.goto("/");

    // Canvas should be present
    const canvas = page.locator("canvas");
    await expect(canvas).toBeVisible();

    // Instruction panel should be visible with key texts
    await expect(page.getByText("조작법")).toBeVisible();
    await expect(page.getByText("W/S: 전진/후진")).toBeVisible();
    await expect(page.getByText("A/D: 좌회전/우회전")).toBeVisible();
  });
});
