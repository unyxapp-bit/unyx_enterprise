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
test("coin exchange sums coins with the percentage per type and registers", async ({ page }) => {
  let registered: Record<string, unknown> | null = null
  await page.route("https://test.supabase.co/**", async (route) => {
    const url = new URL(route.request().url())
    const table = url.pathname.split("/").pop()
    if (table === "coin_exchange_settings" && route.request().method() === "GET") {
      return route.fulfill({ json: null })
    }
    if (table === "coin_exchanges" && route.request().method() === "POST") {
      registered = route.request().postDataJSON()
      return route.fulfill({ status: 201, json: [] })
    }
    if (table === "coin_exchanges") return route.fulfill({ json: [] })
    return route.fallback()
  })
  await page.setViewportSize({ width: 1400, height: 1000 })
  await page.goto("/app/pos/coins")
  await expect(page.getByRole("heading", { name: "Troca de moedas" })).toBeVisible({ timeout: 20_000 })

  // Informa-se o valor em reais de cada tipo de moeda, não a quantidade de moedas.
  const amounts: Array<[string, string]> = [
    ["R$ 0,05", "5,00"],
    ["R$ 0,10", "10,00"],
    ["R$ 0,25", "25,00"],
    ["R$ 0,50", "50,00"],
    ["R$ 1,00", "100,00"],
  ]
  for (const [label, value] of amounts) {
    await page.getByLabel("Valor em moedas de " + label).fill(value)
  }
  // 5,50 + 11,00 + 26,25 + 52,50 + 105,00
  await expect(page.getByTestId("coin-total")).toContainText("200,25")

  // Os fiscais veem o acréscimo somado por percentual: 10% sobre R$ 15,00 e 5% sobre R$ 175,00.
  await expect(page.getByText("Acréscimo de 10%")).toBeVisible()
  await expect(page.getByText("sobre R$ 15,00")).toBeVisible()
  await expect(page.getByText("Acréscimo de 5%")).toBeVisible()
  await expect(page.getByText("sobre R$ 175,00")).toBeVisible()

  // Pacotes: R$ 2,50 / 5,00 / 5,00 / 10,00 / 20,00. R$ 20,60 em moedas de R$ 0,10 = 4 pacotes + R$ 0,60.
  await page.getByLabel("Valor em moedas de R$ 0,10").fill("20,60")
  await expect(page.getByText("4 pacotes", { exact: true })).toBeVisible()
  await expect(page.getByText("+ R$ 0,60 soltos")).toBeVisible()
  await page.getByLabel("Valor em moedas de R$ 0,10").fill("10,00")

  await page.getByLabel("Valor em moedas de R$ 1,00").fill("0")
  await expect(page.getByTestId("coin-total")).toContainText("95,25")
  await page.getByLabel("Valor em moedas de R$ 1,00").fill("100")

  // R$ 1,05 não fecha em moedas de R$ 0,10: avisa e bloqueia o registro.
  await page.getByLabel("Valor em moedas de R$ 0,10").fill("1,05")
  await expect(page.getByText("Não fecha em moedas de R$ 0,10.")).toBeVisible()
  await expect(page.getByRole("button", { name: "Registrar troca" })).toBeDisabled()
  await page.getByLabel("Valor em moedas de R$ 0,10").fill("10")

  // Recarregar a página não perde o que foi digitado.
  await page.reload()
  await expect(page.getByLabel("Valor em moedas de R$ 1,00")).toHaveValue("100", { timeout: 20_000 })
  await expect(page.getByLabel("Valor em moedas de R$ 0,10")).toHaveValue("10")
  await expect(page.getByTestId("coin-total")).toContainText("200,25")

  await page.getByRole("button", { name: "Registrar troca" }).click()
  await expect.poll(() => registered).not.toBeNull()
  expect(registered).toMatchObject({ coin_count: 500, face_cents: 19000, bonus_cents: 1025, total_cents: 20025 })
  await expect(page.getByLabel("Valor em moedas de R$ 0,05")).toHaveValue("")

  // Depois de registrar, o rascunho some: recarregar abre a tela limpa.
  await page.reload()
  await expect(page.getByLabel("Valor em moedas de R$ 1,00")).toHaveValue("", { timeout: 20_000 })
})

test("warns before printing the customer conference without the customer name", async ({ page }) => {
  await page.goto("/app/pos/coins")
  await page.getByRole("tab", { name: "Troca de moedas" }).click({ timeout: 20_000 })
  await page.getByLabel("Valor em moedas de R$ 1,00").fill("100")

  // Sem nome: pergunta antes de imprimir (e cancelar não imprime).
  let message = ""
  page.once("dialog", (dialog) => {
    message = dialog.message()
    void dialog.dismiss()
  })
  await page.getByRole("button", { name: "Conferência do cliente" }).click()
  await expect.poll(() => message).toContain("nome do cliente está vazio")

  // Com o nome preenchido (campo sempre visível), imprime sem perguntar e o nome sai na conferência.
  await page.getByPlaceholder("Nome do cliente (sai na conferência)").fill("Maria da Silva")
  await page.getByRole("button", { name: "Conferência do cliente" }).click()
  await expect
    .poll(async () => {
      for (const frame of page.frames()) {
        const html = await frame.content()
        if (html.includes("TOTAL A RECEBER") && html.includes("Maria da Silva")) return true
      }
      return false
    })
    .toBe(true)
})

})
