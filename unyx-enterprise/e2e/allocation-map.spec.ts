import { expect, test } from "@playwright/test"

const userId = "11111111-1111-4111-8111-111111111111"
const organizationId = "22222222-2222-4222-8222-222222222222"
const production = process.env.PLAYWRIGHT_PRODUCTION === "true"

test.describe("authenticated poster editor", () => {
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
test("map filters by status and control shows the Now panel", async ({ page }) => {
  const org = "22222222-2222-4222-8222-222222222222"
  const branch = "44444444-4444-4444-8444-444444444444"
  const today = new Date()
  const key = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0")
  const mkPost = (i: number, sector: string, active = true) => ({ id: "p" + i, organization_id: org, branch_id: branch, sector_id: "s" + sector, name: "Caixa " + (100 + i), type: "cashier", active, branches: { name: "LOJA 04" }, sectors: { name: sector } })
  const posts = [mkPost(1, "Frente"), mkPost(2, "Frente"), mkPost(3, "Frente"), mkPost(4, "Self", true), mkPost(5, "Self", false)]
  const started = new Date(Date.now() - 95 * 60000).toISOString()
  const sch = (id: string, name: string, start: string, status = "scheduled") => ({ id, organization_id: org, employee_id: "e" + id, branch_id: branch, work_date: key, start_time: start, end_time: "23:50:00", break_start: "00:10:00", break_end: "01:10:00", status, notes: null, employees: { name, sectors: { name: "Frente" } }, branches: { name: "LOJA 04" } })
  const schedules = [sch("1", "FRANCIELLY", "00:01:00", "working"), sch("2", "GILMAR", "00:01:00", "working"), sch("3", "PEDRO", "00:01:00")]
  const allocations = [{ id: "a1", organization_id: org, branch_id: branch, post_id: "p1", employee_id: "e1", schedule_id: "1", started_at: started, ended_at: null, status: "alocado", notes: null, created_at: started, updated_at: started, operational_posts: posts[0], employees: { name: "FRANCIELLY", sectors: { name: "Frente" } }, schedules: { work_date: key, start_time: "00:01:00", break_start: "00:10:00", break_end: "01:10:00", end_time: "23:50:00" } }]
  await page.route("https://test.supabase.co/**", async (route) => {
    const url = new URL(route.request().url())
    const t = url.pathname.split("/").pop()
    if (t === "operational_posts") return route.fulfill({ json: posts })
    if (t === "post_allocations") return route.fulfill({ json: allocations })
    if (t === "schedules") return route.fulfill({ json: schedules })
    if (t === "attendance_events") return route.fulfill({ json: [{ id: "ev1", organization_id: org, branch_id: branch, employee_id: "e1", schedule_id: "1", event_type: "entrada_confirmada", event_time: new Date(Date.now() - 100 * 60000).toISOString(), created_by: null, notes: "Chegou no horário (07:40). Confirmado em lote às 07:45 pelo controle PDV.", created_at: "" }] })
    if (t === "user_profiles" && !url.searchParams.get("auth_user_id")) return route.fulfill({ json: [] })
    return route.fallback()
  })
  await page.setViewportSize({ width: 1400, height: 1100 })
  await page.goto("/app/allocation")

  await expect(page.getByRole("button", { name: /Ocupados\s*1/ })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole("button", { name: /Livres\s*3/ })).toBeVisible()
  await expect(page.getByText(/há 1h \d+min/)).toBeVisible()

  await page.getByRole("button", { name: /Ocupados\s*1/ }).click()
  await expect(page.getByText("Caixa 102")).toHaveCount(0)
  await page.getByRole("button", { name: /Ocupados\s*1/ }).click()
  await page.getByLabel("Buscar no mapa de postos").fill("caixa 104")
  await expect(page.getByText("Caixa 101")).toHaveCount(0)
  await expect(page.getByText("Caixa 104")).toBeVisible()
  await page.getByLabel("Buscar no mapa de postos").fill("")

  // Liberar no card abre o formulário de horário em vez de liberar na hora.
  await page.locator("button", { hasText: "Liberar caixa" }).first().click()
  await expect(page.getByText("Liberar caixa: horário e motivo")).toBeVisible()
  await page.keyboard.press("Escape")

  await page.getByRole("button", { name: /Controle PDV/ }).click()
  await expect(page.getByText("Agora", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: /Chegada atrasada/ })).toBeVisible()
  await expect(page.getByRole("button", { name: /Sem posto/ }).first()).toBeVisible()
})
})
