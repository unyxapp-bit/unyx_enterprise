import { defineConfig, devices } from "@playwright/test"

const production = process.env.PLAYWRIGHT_PRODUCTION === "true"

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  reporter: "list",
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
