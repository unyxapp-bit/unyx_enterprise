import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

const userId = "11111111-1111-4111-8111-111111111111"
const organizationId = "22222222-2222-4222-8222-222222222222"
const production = process.env.PLAYWRIGHT_PRODUCTION === "true"

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ userId }) => {
    const now = Math.floor(Date.now() / 1000)
    const token = `${btoa("{\"alg\":\"HS256\",\"typ\":\"JWT\"}")}.${btoa(JSON.stringify({ sub: userId, aud: "authenticated", role: "authenticated", exp: now + 3600, iat: now, email: "poster@example.test", app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, session_id: "test-session" }))}.signature`
    localStorage.setItem("sb-test-auth-token", JSON.stringify({ access_token: token, refresh_token: "test-refresh", token_type: "bearer", expires_in: 3600, expires_at: now + 3600, user: { id: userId, aud: "authenticated", role: "authenticated", email: "poster@example.test", app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {} } }))
    sessionStorage.setItem("unyx-access-mode", "system")
  }, { userId })

  await page.route("https://test.supabase.co/**", async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith("/auth/v1/user")) {
      await route.fulfill({ json: { id: userId, aud: "authenticated", role: "authenticated", email: "poster@example.test", app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {} } })
      return
    }
    if (url.pathname.endsWith("/rest/v1/user_profiles")) {
      await route.fulfill({ json: { id: "33333333-3333-4333-8333-333333333333", auth_user_id: userId, organization_id: organizationId, branch_id: null, name: "Poster Tester", email: "poster@example.test", role: "owner", active: true, custom_permissions: null } })
      return
    }
    if (url.pathname.endsWith("/rest/v1/poster_editor_workspaces")) {
      if (route.request().method() === "GET") await route.fulfill({ json: null })
      else await route.fulfill({ status: 201, json: [] })
      return
    }
    await route.fulfill({ json: [] })
  })

  await page.goto(`${production ? "/unyx_enterprise" : ""}/app/pos/posters`)
  await expect(page.getByRole("heading", { name: "Editor de cartazes" })).toBeVisible()
})

test("production bundle opens the poster editor without runtime errors", async ({ page }) => {
  test.skip(!production, "Runs only against the deployed base path bundle.")
  const runtimeErrors: string[] = []
  page.on("pageerror", (error) => runtimeErrors.push(error.message))
  await expect(page.getByRole("heading", { name: "Editor de cartazes" })).toBeVisible()
  expect(runtimeErrors).toEqual([])
})

test("imports template, edits text, saves locally and in cloud, exports vector PDF", async ({ page }) => {
  const cloudSave = page.waitForRequest((request) =>
    request.url().includes("/rest/v1/poster_editor_workspaces") && request.method() === "POST"
  )
  await page.locator("#poster-template-upload").setInputFiles({
    name: "modelo.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1100"><rect width="800" height="1100" fill="#ffffff"/></svg>'),
  })

  await page.getByPlaceholder("Nome do produto").fill("TESTE VETORIAL")
  await page.getByRole("button", { name: "Camadas" }).click()
  await page.getByRole("button", { name: "Salvar versao" }).click()
  await expect(page.getByText("Versoes salvas")).toBeVisible()
  await expect(page.getByText("Sincronizacao automatica ativa")).toBeVisible()
  await cloudSave

  await page.getByRole("button", { name: "Exportar" }).click()
  const downloadPromise = page.waitForEvent("download")
  await page.getByRole("menuitem", { name: "PDF para impressao" }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/\.pdf$/)
})

test("keeps editor text readable in light and dark application themes", async ({ page }) => {
  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value
      document.documentElement.classList.toggle("dark", value === "dark")
    }, theme)
    const results = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze()
    expect(results.violations, `Contrast violations in ${theme} theme`).toEqual([])
  }
})
