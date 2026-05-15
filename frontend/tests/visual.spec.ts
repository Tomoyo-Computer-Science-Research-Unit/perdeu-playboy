import { expect, test } from "@playwright/test";

const pages = ["/dashboard", "/trends", "/map", "/rankings", "/changes", "/governors", "/sources", "/methodology"];

test.describe("static pages", () => {
  for (const path of pages) {
    test(`${path} renders with visible content`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") {
          consoleErrors.push(message.text());
        }
      });

      await page.goto(path);
      await expect(page.locator("body")).toBeVisible();
      await expect(page.locator("main")).toBeVisible();
      await expect(page.locator("text=404")).toHaveCount(0);

      const screenshot = await page.locator("main").screenshot();
      expect(screenshot.length).toBeGreaterThan(12_000);
      expect(consoleErrors).toEqual([]);
    });
  }
});

test("map accepts permalink filters", async ({ page }) => {
  await page.goto("/map?indicator=crime_geral&mode=rate&period=2024-12&view=rio_city");
  await expect(page.locator("body")).toBeVisible();
  await expect(page.locator("select").first()).toHaveValue("crime_geral");
  await expect(page.locator("text=12/2024")).toBeVisible();
  await expect(page.locator("text=Bairros:")).toBeVisible();
});
