import { defineConfig, devices } from "@playwright/test"

const production = process.env.PLAYWRIGHT_PRODUCTION === "true"

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  // Um arquivo por vez: vários navegadores competindo pelo servidor de desenvolvimento causavam falhas ocasionais.
  workers: 1,
  reporter: "list",
  // O servidor de desenvolvimento compila cada tela na primeira visita: dá mais tempo às verificações.
  expect: { timeout: 15_000 },
  use: {
    baseURL: "http://127.0.0.1:4173",
    ...devices["Desktop Chrome"],
    trace: "retain-on-failure",
  },
  webServer: {
    command: production
      ? "node scripts/serve-pages.mjs"
      : "npm run dev -- --host 127.0.0.1 --port 4173",
    url: production
      ? "http://127.0.0.1:4173/unyx_enterprise/"
      : "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_SUPABASE_URL: "https://test.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_placeholder",
    },
  },
})
