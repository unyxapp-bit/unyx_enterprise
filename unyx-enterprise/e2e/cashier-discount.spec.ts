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
test("calculates the discount from the catalog price and registers the slip", async ({ page }) => {
  let posted: Record<string, unknown> | null = null
  await page.route("https://test.supabase.co/**", async (route) => {
    const table = new URL(route.request().url()).pathname.split("/").pop()
    const method = route.request().method()
    if (table === "products") {
      return route.fulfill({
        json: [{ id: "p-1", organization_id: "o", branch_id: null, name: "Batata pringles 104G original", sku: "1050444", barcode: null, price: 12.89, active: true, unit: "UN" }],
      })
    }
    if (table === "cashier_discounts" && method === "POST") {
      posted = route.request().postDataJSON()
      return route.fulfill({
        status: 201,
        json: { ...posted, created_at: new Date().toISOString(), user_profiles: { name: "Poster Tester" } },
      })
    }
    if (table === "cashier_discounts") return route.fulfill({ json: [] })
    return route.fallback()
  })
  await page.setViewportSize({ width: 1400, height: 1000 })
  await page.goto("/app/pos/discounts")
  await expect(page.getByRole("heading", { name: "Descontos no caixa" })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole("button", { name: "Registrar e imprimir ficha" })).toBeDisabled()

  // Escolher o produto do catálogo traz o código e o preço do sistema.
  // O catálogo carrega em segundo plano: repete até o produto ser reconhecido.
  await expect(async () => {
    await page.getByPlaceholder("Descrição do produto").fill("")
    await page.getByPlaceholder("Descrição do produto").fill("Batata pringles 104G original")
    await expect(page.getByPlaceholder("Código")).toHaveValue("1050444", { timeout: 1_500 })
  }).toPass({ timeout: 15_000 })
  await expect(page.getByLabel("Preço no sistema")).toHaveValue("12,89")

  // Caixa (PDV) e operador (OP) saem na ficha e ficam registrados.
  await page.getByPlaceholder("Ex.: Caixa 108").fill("Caixa 108")
  await page.getByPlaceholder("Nome do operador").fill("Francielly")
  await page.getByLabel("Quantidade").fill("3")
  await page.getByLabel("Preço de venda").fill("11,90")
  // (12,89 − 11,90) × 3 = 2,97, como na ficha de papel.
  await expect(page.getByTestId("discount-total")).toContainText("2,97")

  // "Outro motivo" exige descrição.
  await page.getByRole("button", { name: "Outro motivo" }).click()
  await expect(page.getByRole("button", { name: "Registrar e imprimir ficha" })).toBeDisabled()
  await page.getByPlaceholder("Explique o motivo do desconto").fill("Produto avariado")
  await expect(page.getByRole("button", { name: "Registrar e imprimir ficha" })).toBeEnabled()
  await page.getByRole("button", { name: "Preço errado" }).click()

  await page.getByRole("button", { name: "Registrar e imprimir ficha" }).click()
  await expect.poll(() => posted).not.toBeNull()
  expect(posted).toMatchObject({
    product_id: "p-1",
    product_name: "Batata pringles 104G original",
    product_code: "1050444",
    quantity: 3,
    system_price_cents: 1289,
    sale_price_cents: 1190,
    discount_cents: 297,
    reason: "preco_errado",
    pdv: "Caixa 108",
    operator_name: "Francielly",
  })
  // A ficha impressa leva o valor e a quantidade junto do produto.
  await expect
    .poll(async () => {
      for (const frame of page.frames()) {
        const html = await frame.content()
        if (html.includes("DESCONTO") && html.includes("(3X)") && html.includes("2,97") && html.includes("Francielly")) return true
      }
      return false
    })
    .toBe(true)
  await expect(page.getByPlaceholder("Descrição do produto")).toHaveValue("")
})

test("the PDV suggestions list scrolls when there are many cash registers", async ({ page }) => {
  const posts = Array.from({ length: 40 }, (_, index) => ({
    id: "post-" + index,
    organization_id: "o",
    branch_id: "b",
    sector_id: null,
    name: "Caixa " + (101 + index),
    type: "cashier",
    active: true,
    branches: { name: "LOJA" },
    sectors: null,
  }))
  await page.route("https://test.supabase.co/**", async (route) => {
    const table = new URL(route.request().url()).pathname.split("/").pop()
    if (table === "operational_posts") return route.fulfill({ json: posts })
    if (table === "cashier_discounts") return route.fulfill({ json: [] })
    return route.fallback()
  })
  await page.setViewportSize({ width: 1400, height: 900 })
  await page.goto("/app/pos/discounts")
  // O segundo botão de sugestões é o do campo Caixa (PDV).
  await page.getByRole("button", { name: "Mostrar sugestões" }).nth(1).click({ timeout: 20_000 })

  const first = page.getByRole("button", { name: "Caixa 101", exact: true })
  await expect(first).toBeVisible()
  const list = first.locator("xpath=..")
  // Há mais itens do que cabem e a lista rola (antes ela cortava o excedente).
  expect(await list.evaluate((node) => getComputedStyle(node).overflowY)).toBe("auto")
  expect(await list.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true)

  // Rolar com a roda do mouse sobre a lista chega até o último item.
  await first.hover()
  await page.mouse.wheel(0, 6000)
  const last = page.getByRole("button", { name: "Caixa 140", exact: true })
  await expect(last).toBeInViewport()
  await last.click()
  await expect(page.getByPlaceholder("Ex.: Caixa 108")).toHaveValue("Caixa 140")
})

})
