import { defineConfig, devices } from "@playwright/test";

// Um build serve todas as UFs (o Rio na raiz, as demais em /<uf>/); os testes passam por várias.
const PORT = 4173;

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  expect: {
    timeout: 10_000
  },
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    launchOptions: { args: ["--mute-audio"] }
  },
  webServer: {
    // Os testes rodam na raiz; o deploy em g0v.tomoyo.systems usa NEXT_PUBLIC_BASE_PATH=/perdeu-playboy.
    command: `NEXT_PUBLIC_BASE_PATH= npm run build && npx serve out -l ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000
  },
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } }
    },
    {
      // Palco mínimo do site (1280×720): abaixo disso a página rola, o layout não cede.
      name: "chromium-min",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 720 } }
    }
  ]
});
