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
test("receives coins left by the customer and prints both vias", async ({ page }) => {
  let posted: Record<string, unknown> | null = null
  await page.route("https://test.supabase.co/**", async (route) => {
    const url = new URL(route.request().url())
    const table = url.pathname.split("/").pop()
    if (table === "coin_deposits" && route.request().method() === "POST") {
      posted = route.request().postDataJSON()
      return route.fulfill({
        status: 201,
        json: { ...posted, status: "pendente", completed_at: null, created_at: new Date().toISOString(), branches: null, user_profiles: { name: "Poster Tester" } },
      })
    }
    if (table === "coin_deposits") return route.fulfill({ json: [] })
    if (table === "coin_exchange_settings" && route.request().method() === "GET") return route.fulfill({ json: null })
    if (table === "coin_exchanges") return route.fulfill({ json: [] })
    return route.fallback()
  })
  await page.setViewportSize({ width: 1400, height: 900 })
  await page.goto("/app/pos/coins")
  await page.getByRole("tab", { name: "Moedas deixadas pelo cliente" }).click({ timeout: 20_000 })
  await expect(page.getByText("Receber moedas para troca")).toBeVisible()
  await expect(page.getByText("Nenhuma troca aguardando")).toBeVisible()

  // Sem os dados mínimos não registra.
  await expect(page.getByRole("button", { name: "Registrar e imprimir vias" })).toBeDisabled()

  await page.getByPlaceholder("Nome do cliente", { exact: true }).fill("Maria da Silva")
  await page.getByPlaceholder("(00) 00000-0000").fill("11987654321")
  await expect(page.getByPlaceholder("(00) 00000-0000")).toHaveValue("(11) 98765-4321")
  await page.getByLabel("Valor estimado das moedas").fill("250,50")

  // O rascunho sobrevive a recarregar a página.
  await page.reload()
  await page.getByRole("tab", { name: "Moedas deixadas pelo cliente" }).click({ timeout: 20_000 })
  await expect(page.getByPlaceholder("Nome do cliente", { exact: true })).toHaveValue("Maria da Silva")

  await page.getByRole("button", { name: "Registrar e imprimir vias" }).click()
  await expect.poll(() => posted).not.toBeNull()
  expect(posted).toMatchObject({
    customer_name: "Maria da Silva",
    customer_phone: "(11) 98765-4321",
    estimated_cents: 25050,
  })
  expect(String((posted as Record<string, unknown>).fiscal_name)).not.toBe("")

  // O comprovante impresso leva as duas vias no mesmo arquivo.
  await expect.poll(async () => (await page.frames().at(-1)!.content()).includes("VIA DO FISCAL")).toBe(true)
  const html = await page.frames().at(-1)!.content()
  expect(html).toContain("VIA DO CLIENTE")
  expect(html).toContain("Maria da Silva")
  await expect(page.getByPlaceholder("Nome do cliente", { exact: true })).toHaveValue("")
})

test("opens the exchange from a deposit with name and phone filled in", async ({ page }) => {
  let depositBody: Record<string, unknown> | null = null
  let exchangeBody: Record<string, unknown> | null = null
  let statusBody: Record<string, unknown> | null = null
  let savedDeposit: Record<string, unknown> | null = null
  await page.route("https://test.supabase.co/**", async (route) => {
    const url = new URL(route.request().url())
    const table = url.pathname.split("/").pop()
    const method = route.request().method()
    if (table === "coin_deposits" && method === "POST") {
      depositBody = route.request().postDataJSON()
      savedDeposit = { ...depositBody, status: "pendente", completed_at: null, created_at: new Date().toISOString(), branches: null, user_profiles: { name: "Poster Tester" } }
      return route.fulfill({ status: 201, json: savedDeposit })
    }
    if (table === "coin_deposits" && method === "PATCH") {
      statusBody = route.request().postDataJSON()
      return route.fulfill({ status: 204, body: "" })
    }
    if (table === "coin_deposits") return route.fulfill({ json: savedDeposit ? [savedDeposit] : [] })
    if (table === "coin_exchanges" && method === "POST") {
      exchangeBody = route.request().postDataJSON()
      return route.fulfill({ status: 201, json: [] })
    }
    if (table === "coin_exchanges") return route.fulfill({ json: [] })
    if (table === "coin_exchange_settings" && method === "GET") return route.fulfill({ json: null })
    return route.fallback()
  })
  await page.setViewportSize({ width: 1400, height: 900 })
  await page.goto("/app/pos/coins")
  await page.getByRole("tab", { name: "Moedas deixadas pelo cliente" }).click({ timeout: 20_000 })
  await page.getByPlaceholder("Nome do cliente", { exact: true }).fill("Maria da Silva")
  await page.getByPlaceholder("(00) 00000-0000").fill("11987654321")
  await page.getByLabel("Valor estimado das moedas").fill("250,50")
  await page.getByRole("button", { name: "Só registrar" }).click()

  // O recebimento aparece na lista; "Fazer a troca" abre a troca com o cliente preenchido.
  await page.getByRole("button", { name: "Fazer a troca de Maria da Silva" }).click({ timeout: 20_000 })

  // Abre a aba de troca com o cliente preenchido e vinculado ao recebimento.
  await expect(page.getByRole("tab", { name: "Troca de moedas" })).toHaveAttribute("aria-selected", "true")
  await expect(page.getByText("Troca de moedas deixadas ·")).toBeVisible()
  await expect(page.getByText("Maria da Silva · (11) 98765-4321")).toBeVisible()
  // Com o cliente já mostrado no quadro, os campos de cliente e observação não aparecem de novo.
  await expect(page.getByText("Adicionar observação (opcional)")).toHaveCount(0)
  await expect(page.getByPlaceholder("Nome do cliente (sai na conferência)")).toHaveCount(0)

  await page.getByLabel("Valor em moedas de R$ 1,00").fill("200")
  await page.getByRole("button", { name: "Registrar troca" }).click()
  await expect.poll(() => exchangeBody).not.toBeNull()
  expect(exchangeBody).toMatchObject({
    customer_name: "Maria da Silva",
    customer_phone: "(11) 98765-4321",
    deposit_id: (depositBody as unknown as { id: string }).id,
  })
  // Registrar a troca conclui o recebimento de onde ela veio.
  await expect.poll(() => statusBody).not.toBeNull()
  expect(statusBody).toMatchObject({ status: "concluida" })
})


test("registers coins left by a customer who does not know the estimated value", async ({ page }) => {
  let posted: Record<string, unknown> | null = null
  await page.route("https://test.supabase.co/**", async (route) => {
    const table = new URL(route.request().url()).pathname.split("/").pop()
    if (table === "coin_deposits" && route.request().method() === "POST") {
      posted = route.request().postDataJSON()
      return route.fulfill({
        status: 201,
        json: { ...posted, status: "pendente", completed_at: null, created_at: new Date().toISOString(), branches: null, user_profiles: null },
      })
    }
    if (table === "coin_deposits") return route.fulfill({ json: [] })
    if (table === "coin_exchange_settings" && route.request().method() === "GET") return route.fulfill({ json: null })
    if (table === "coin_exchanges") return route.fulfill({ json: [] })
    return route.fallback()
  })
  await page.goto("/app/pos/coins")
  await page.getByRole("tab", { name: "Moedas deixadas pelo cliente" }).click({ timeout: 20_000 })
  await page.getByPlaceholder("Nome do cliente", { exact: true }).fill("João")
  // Sem valor e sem marcar que o cliente não sabe, não registra (evita esquecer o campo).
  await expect(page.getByRole("button", { name: "Só registrar" })).toBeDisabled()
  await page.getByLabel("O cliente não sabe o valor estimado").check()
  await expect(page.getByLabel("Valor estimado das moedas")).toBeDisabled()
  // Marcado: o registro é permitido e a ficha sai "A conferir".
  await expect(page.getByRole("button", { name: "Só registrar" })).toBeEnabled()
  await page.getByRole("button", { name: "Só registrar" }).click()
  await expect.poll(() => posted).not.toBeNull()
  expect(posted).toMatchObject({ customer_name: "João", estimated_cents: 0 })
})

})
