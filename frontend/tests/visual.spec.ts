import { expect, test, type Page } from "@playwright/test";

// Um build serve todas as UFs: o Rio na raiz, as demais em /<uf>/. O conjunto comum roda no Rio, em
// São Paulo, em quatro UFs do Sinesp (Minas, Distrito Federal, Amazonas, Bahia) e no Brasil (/br/,
// o país no lugar do estado e as UFs no dos municípios); os testes que dependem de dados de uma UF ficam nela.
const UFS = ["RJ", "SP", "MG", "DF", "AM", "BA", "BR"];
const prefix = (uf: string) => (uf === "RJ" ? "" : `/${uf.toLowerCase()}`);
const screensFor = (uf: string) => ["/", "/series", "/mapa", "/rankings", "/mudancas", "/mandatos", "/metodologia", "/status", ...(uf === "RJ" ? ["/tiroteios"] : [])];

/** Abre uma tela e espera o núcleo de dados da UF chegar. */
async function open(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator("main > [role=status]")).toHaveCount(0, { timeout: 15_000 });
}

for (const uf of UFS) {
  const screens = screensFor(uf);
  const pages = [...screens.filter((path) => path !== "/metodologia" && path !== "/status"), "/fontes", "/glossario", "/metodologia", "/status"];

  test.describe(`${uf} static pages`, () => {
    for (const path of pages) {
      test(`${uf} ${path} renders with visible content`, async ({ page }) => {
        const consoleErrors: string[] = [];
        page.on("console", (message) => {
          // O Discord flutuante vem da raiz do g0v, que não existe no servidor de teste.
          if (message.type() === "error" && !message.location().url.endsWith("/discord-float.js")) {
            consoleErrors.push(message.text());
          }
        });

        await open(page, `${prefix(uf)}${path}`);
        await expect(page.getByRole("heading", { name: /404|not found/i })).toHaveCount(0);
        await expect(page.getByText("DADOS INDISPONÍVEIS")).toHaveCount(0);

        // O snapshot commitado do Rio não tem o Fogo Cruzado (credenciais só no servidor): Tiroteios
        // mostra o aviso de fonte ausente, uma tela quase vazia.
        const screenshot = await page.locator("main").screenshot();
        expect(screenshot.length).toBeGreaterThan(path === "/tiroteios" ? 8_000 : 12_000);
        expect(consoleErrors).toEqual([]);
      });
    }
  });

  test(`${uf} screens fit the viewport without page scroll`, async ({ page }) => {
    for (const path of screens) {
      await open(page, `${prefix(uf)}${path}`);
      await page.waitForLoadState("networkidle");
      const [scrollHeight, viewport] = await page.evaluate(() => [document.documentElement.scrollHeight, window.innerHeight]);
      expect(scrollHeight, `${uf} ${path} deve caber na tela`).toBeLessThanOrEqual(viewport);
    }
  });

  test(`${uf} UF selector marks the current UF`, async ({ page }) => {
    await open(page, `${prefix(uf)}/`);
    const selector = page.getByLabel("Unidade da federação");
    await expect(selector).toHaveValue(uf);
    // As 27 UFs e o Brasil, no topo.
    expect(await selector.locator("option").count()).toBe(28);
    await expect(selector.locator("option").first()).toHaveText("Brasil");
  });
}

test("home shows year-to-date cards for the state", async ({ page }) => {
  await open(page, "/");
  await expect(page.getByRole("heading", { level: 3, name: "Letalidade violenta" }).first()).toBeVisible();
  await expect(page.getByText("Estado do Rio de Janeiro").first()).toBeVisible();
});

test("series accepts permalink filters", async ({ page }) => {
  await open(page, "/series?indicator=roubo_rua&type=municipality&name=Niter%C3%B3i&view=rolling&from=2015&to=2024");
  await expect(page.getByLabel("Indicador", { exact: true })).toHaveValue("roubo_rua");
  await expect(page.getByLabel("Município", { exact: true })).toHaveValue("Niterói");
  await expect(page.getByRole("button", { name: "12 meses" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("De", { exact: true })).toHaveValue("2015");
  await expect(page.getByLabel("Até", { exact: true })).toHaveValue("2024");
});

test("map accepts permalink filters", async ({ page }) => {
  await open(page, "/mapa?indicator=crime_geral&mode=rate&period=2024-12&view=rio_city");
  await expect(page.getByRole("option", { name: "Crime geral" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("text=12/2024").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Voltar" })).toBeVisible();
  await expect(page.locator("svg[role=img] path").first()).toBeVisible();
});

test("municipal series load on demand", async ({ page }) => {
  await open(page, "/rankings");
  // 92 municípios no ranking de crime geral, carregados de static-series/crime_geral.
  await expect.poll(async () => page.locator("table.ruled tbody tr").count(), { timeout: 15_000 }).toBeGreaterThan(60);
  await open(page, "/series?indicator=roubo_rua&type=municipality&name=Niter%C3%B3i");
  await expect(page.locator("svg.recharts-surface").first()).toBeVisible();
  await expect.poll(async () => page.locator(".recharts-bar-rectangle, .recharts-line-curve").count(), { timeout: 15_000 }).toBeGreaterThan(0);
});

test("theme toggle switches to dark", async ({ page }) => {
  await open(page, "/");
  await page.getByRole("button", { name: /tema escuro/i }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("hotkeys switch screens, indicators and UF", async ({ page }) => {
  await open(page, "/");
  await page.keyboard.press("ArrowDown");
  // O seletor de UF também tem opções; o menu de indicadores é o listbox.
  await expect(page.getByRole("listbox").getByRole("option", { selected: true })).not.toHaveText(/Homic[ií]dio doloso/);
  await page.keyboard.press("2");
  await expect(page).toHaveURL(/\/series/);
  await page.keyboard.press("u");
  await expect(page).toHaveURL(/\/sp\/series\/?$/);
  await page.keyboard.press("3");
  await expect(page).toHaveURL(/\/sp\/mapa/);
});

test("UF selector keeps the screen and leaves Tiroteios for the Panorama", async ({ page }) => {
  await open(page, "/mandatos");
  await page.getByLabel("Unidade da federação").selectOption("BA");
  await expect(page).toHaveURL(/\/ba\/mandatos\/?$/);
  await expect(page.getByText("Jerônimo Rodrigues").first()).toBeVisible();
  await open(page, "/tiroteios");
  await page.getByLabel("Unidade da federação").selectOption("AM");
  await expect(page).toHaveURL(/\/am\/?$/);
  await expect(page.getByRole("link", { name: /Tiroteios/ })).toHaveCount(0);
});

test("SP: state cards, municipal series and no shootings screen", async ({ page }) => {
  await open(page, "/sp/");
  await expect(page.getByText("Estado de São Paulo").first()).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: "Letalidade violenta" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Tiroteios/ })).toHaveCount(0);
  await open(page, "/sp/series?indicator=roubo_outros&type=municipality&name=Campinas&view=rolling");
  await expect(page.getByLabel("Município", { exact: true })).toHaveValue("Campinas");
  await expect.poll(async () => page.locator(".recharts-bar-rectangle, .recharts-line-curve").count(), { timeout: 15_000 }).toBeGreaterThan(0);
  await open(page, "/sp/rankings");
  await expect.poll(async () => page.locator("table.ruled tbody tr").count(), { timeout: 15_000 }).toBeGreaterThan(60);
});

test("DF: one municipality, map with a single shape", async ({ page }) => {
  await open(page, "/df/mapa");
  await expect(page.locator("svg[role=img] path")).toHaveCount(1);
  await expect(page.getByText("SEM DADOS PARA ESTE RECORTE")).toHaveCount(0);
  await expect(page.locator("main").getByText("Distrito Federal").first()).toBeVisible();
});

test("AM: Manaus series and governors since 2014", async ({ page }) => {
  await open(page, "/am/series?indicator=homicidio_doloso&type=municipality&name=Manaus");
  await expect(page.getByLabel("Município", { exact: true })).toHaveValue("Manaus");
  await expect.poll(async () => page.locator(".recharts-bar-rectangle, .recharts-line-curve").count(), { timeout: 15_000 }).toBeGreaterThan(0);
  await open(page, "/am/mandatos");
  await expect(page.getByText("Amazonino Mendes").first()).toBeVisible();
});

test("BR: national total, UFs as units and presidents", async ({ page }) => {
  await open(page, "/br/");
  await expect(page.getByLabel("Unidade da federação")).toHaveValue("BR");
  await expect(page.getByRole("heading", { level: 3, name: "Letalidade violenta" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Brasil", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "UF", exact: true })).toBeVisible();

  await open(page, "/br/mapa");
  // A malha do país com divisão por UF: 27 formas, todas com dado de homicídio doloso.
  await expect(page.locator("svg[role=img] path")).toHaveCount(27);
  await expect(page.locator("main").getByText("UFs").first()).toBeVisible();

  await open(page, "/br/rankings");
  await expect(page.getByText("UFs", { exact: true }).first()).toBeVisible();
  await expect.poll(async () => page.locator("table.ruled tbody tr").count(), { timeout: 15_000 }).toBe(27);
  await expect(page.locator("table.ruled tbody").getByText("Rio de Janeiro")).toBeVisible();

  await open(page, "/br/mandatos");
  await expect(page.getByText("Presidentes").first()).toBeVisible();
  for (const name of ["Luiz Inácio Lula da Silva", "Jair Bolsonaro", "Michel Temer", "Dilma Rousseff"]) {
    await expect(page.getByText(name).first()).toBeVisible();
  }
  await expect(page.getByText("Ricardo Couto")).toHaveCount(0);
});

test("BR: series of one UF and the U key cycles back to Brasil", async ({ page }) => {
  await open(page, "/br/series?indicator=homicidio_doloso&type=municipality&name=Bahia");
  await expect(page.getByLabel("UF", { exact: true })).toHaveValue("Bahia");
  await expect.poll(async () => page.locator(".recharts-bar-rectangle, .recharts-line-curve").count(), { timeout: 15_000 }).toBeGreaterThan(0);
  await open(page, "/to/");
  await page.keyboard.press("u");
  await expect(page).toHaveURL(/\/br\/?$/);
});
