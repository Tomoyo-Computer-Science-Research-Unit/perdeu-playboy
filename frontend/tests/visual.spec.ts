import { expect, test } from "@playwright/test";

const pages = ["/", "/dashboard", "/trends", "/map", "/rankings", "/changes", "/governors", "/sources", "/glossary", "/methodology"];

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
      await expect(page.getByRole("heading", { name: /404|not found/i })).toHaveCount(0);

      const screenshot = await page.locator("main").screenshot();
      expect(screenshot.length).toBeGreaterThan(12_000);
      expect(consoleErrors).toEqual([]);
    });
  }
});

test("home shows year-to-date cards for the state", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 3, name: "Letalidade violenta" }).first()).toBeVisible();
  await expect(page.getByText("Estado do Rio de Janeiro").first()).toBeVisible();
});

test("trends accepts permalink filters", async ({ page }) => {
  await page.goto("/trends?indicator=roubo_rua&type=municipality&name=Niter%C3%B3i&view=rolling&from=2015&to=2024");
  await expect(page.getByLabel("Indicador", { exact: true })).toHaveValue("roubo_rua");
  await expect(page.getByLabel("Município", { exact: true })).toHaveValue("Niterói");
  await expect(page.getByRole("button", { name: "12 meses" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("De", { exact: true })).toHaveValue("2015");
  await expect(page.getByLabel("Até", { exact: true })).toHaveValue("2024");
});

test("map accepts permalink filters", async ({ page }) => {
  await page.goto("/map?indicator=crime_geral&mode=rate&period=2024-12&view=rio_city");
  await expect(page.getByLabel("Indicador", { exact: true })).toHaveValue("crime_geral");
  await expect(page.locator("text=12/2024").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Voltar" })).toBeVisible();
  await expect(page.locator("svg[role=img] path").first()).toBeVisible();
});

test("theme toggle switches to dark", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /tema escuro/i }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
