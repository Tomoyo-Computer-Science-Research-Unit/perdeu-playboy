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
  await expect(page.getByRole("option", { name: "Crime geral" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("text=12/2024").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Voltar" })).toBeVisible();
  await expect(page.locator("svg[role=img] path").first()).toBeVisible();
});

test("theme toggle switches to dark", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /tema escuro/i }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("screens fit the viewport without page scroll", async ({ page }) => {
  for (const path of ["/", "/trends", "/map", "/rankings", "/changes", "/governors", "/methodology"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const [scrollHeight, viewport] = await page.evaluate(() => [document.documentElement.scrollHeight, window.innerHeight]);
    expect(scrollHeight, `${path} deve caber na tela`).toBeLessThanOrEqual(viewport);
  }
});

test("hotkeys switch screens and indicators", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("option", { selected: true })).not.toHaveText(/Homicidio doloso/);
  await page.keyboard.press("2");
  await expect(page).toHaveURL(/\/trends/);
});
