import { expect, test } from "@playwright/test";

// O mesmo conjunto roda para cada UF (NEXT_PUBLIC_UF); os testes que dependem de dados do Rio ficam no Rio.
const UF = (process.env.NEXT_PUBLIC_UF ?? "RJ").toUpperCase();
const isRJ = UF === "RJ";
const screens = ["/", "/series", "/mapa", "/rankings", "/mudancas", "/mandatos", "/metodologia", "/status", ...(isRJ ? ["/tiroteios"] : [])];
const pages = [...screens.filter((path) => path !== "/metodologia" && path !== "/status"), "/fontes", "/glossario", "/metodologia", "/status"];

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
  test.skip(!isRJ, "dados do Rio");
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 3, name: "Letalidade violenta" }).first()).toBeVisible();
  await expect(page.getByText("Estado do Rio de Janeiro").first()).toBeVisible();
});

test("series accepts permalink filters", async ({ page }) => {
  test.skip(!isRJ, "dados do Rio");
  await page.goto("/series?indicator=roubo_rua&type=municipality&name=Niter%C3%B3i&view=rolling&from=2015&to=2024");
  await expect(page.getByLabel("Indicador", { exact: true })).toHaveValue("roubo_rua");
  await expect(page.getByLabel("Município", { exact: true })).toHaveValue("Niterói");
  await expect(page.getByRole("button", { name: "12 meses" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("De", { exact: true })).toHaveValue("2015");
  await expect(page.getByLabel("Até", { exact: true })).toHaveValue("2024");
});

test("map accepts permalink filters", async ({ page }) => {
  test.skip(!isRJ, "dados do Rio");
  await page.goto("/mapa?indicator=crime_geral&mode=rate&period=2024-12&view=rio_city");
  await expect(page.getByRole("option", { name: "Crime geral" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("text=12/2024").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Voltar" })).toBeVisible();
  await expect(page.locator("svg[role=img] path").first()).toBeVisible();
});

test("municipal series load on demand", async ({ page }) => {
  test.skip(!isRJ, "dados do Rio");
  await page.goto("/rankings");
  // 92 municípios no ranking de crime geral, carregados de static-series/crime_geral.
  await expect.poll(async () => page.locator("table.ruled tbody tr").count(), { timeout: 15_000 }).toBeGreaterThan(60);
  await page.goto("/series?indicator=roubo_rua&type=municipality&name=Niter%C3%B3i");
  await expect(page.locator("svg.recharts-surface").first()).toBeVisible();
  await expect.poll(async () => page.locator(".recharts-bar-rectangle, .recharts-line-curve").count(), { timeout: 15_000 }).toBeGreaterThan(0);
});

test("theme toggle switches to dark", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /tema escuro/i }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("screens fit the viewport without page scroll", async ({ page }) => {
  for (const path of screens) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const [scrollHeight, viewport] = await page.evaluate(() => [document.documentElement.scrollHeight, window.innerHeight]);
    expect(scrollHeight, `${path} deve caber na tela`).toBeLessThanOrEqual(viewport);
  }
});

test("hotkeys switch screens and indicators", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("ArrowDown");
  // O seletor de UF também tem opções; o menu de indicadores é o listbox.
  await expect(page.getByRole("listbox").getByRole("option", { selected: true })).not.toHaveText(/Homic[ií]dio doloso/);
  await page.keyboard.press("2");
  await expect(page).toHaveURL(/\/series/);
});

test("UF selector lists the published UFs and marks the current one", async ({ page }) => {
  await page.goto("/");
  const selector = page.getByLabel("Unidade da federação");
  await expect(selector).toHaveValue(UF);
  expect(await selector.locator("option").count()).toBeGreaterThan(1);
});

test("SP: state cards, municipal series and no shootings screen", async ({ page }) => {
  test.skip(UF !== "SP", "só São Paulo");
  await page.goto("/");
  await expect(page.getByText("Estado de São Paulo").first()).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: "Letalidade violenta" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Tiroteios/ })).toHaveCount(0);
  await page.goto("/series?indicator=roubo_outros&type=municipality&name=Campinas&view=rolling");
  await expect(page.getByLabel("Município", { exact: true })).toHaveValue("Campinas");
  await expect.poll(async () => page.locator(".recharts-bar-rectangle, .recharts-line-curve").count(), { timeout: 15_000 }).toBeGreaterThan(0);
  await page.goto("/rankings");
  await expect.poll(async () => page.locator("table.ruled tbody tr").count(), { timeout: 15_000 }).toBeGreaterThan(60);
});
