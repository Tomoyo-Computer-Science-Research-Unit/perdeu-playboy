import { expect, test } from "@playwright/test";

const pages = ["/dashboard", "/trends", "/map", "/rankings", "/changes", "/governors", "/sources", "/glossary", "/methodology"];

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
  await expect(page.getByLabel("Indicador")).toHaveValue("crime_geral");
  await expect(page.locator("text=12/2024")).toBeVisible();
  await expect(page.locator("text=Bairros:")).toBeVisible();
});

test("map loads Sao Paulo official snapshot", async ({ page }) => {
  await page.goto("/map?uf=SP");
  await expect(page.getByLabel("Selecionar UF")).toHaveValue("SP");
  await expect(page.locator("text=Municípios: 645")).toBeVisible();
  await expect(page.locator("text=Falha ao carregar mapa")).toHaveCount(0);
});
