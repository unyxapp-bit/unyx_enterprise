import { expect, test } from "@playwright/test"

const userId = "11111111-1111-4111-8111-111111111111"
const organizationId = "22222222-2222-4222-8222-222222222222"

test.describe("authenticated customer orders", () => {
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
      await route.fulfill({ json: [] })
    })
  })

  test("registers an order with items and pickup, then moves it to ready and picked up", async ({ page }) => {
    let posted: Record<string, unknown> | null = null
    const statusPatches: Array<Record<string, unknown>> = []
    let saved: Record<string, unknown> | null = null
    await page.route("https://test.supabase.co/**", async (route) => {
      const table = new URL(route.request().url()).pathname.split("/").pop()
      const method = route.request().method()
      if (table === "customer_orders" && method === "POST") {
        posted = route.request().postDataJSON()
        saved = { ...posted, status: "pendente", status_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
        return route.fulfill({ status: 201, json: saved })
      }
      if (table === "customer_orders" && method === "PATCH") {
        const patch = route.request().postDataJSON()
        statusPatches.push(patch)
        if (saved) saved = { ...saved, ...patch }
        return route.fulfill({ json: [] })
      }
      if (table === "customer_orders") return route.fulfill({ json: saved ? [saved] : [] })
      return route.fallback()
    })
    await page.setViewportSize({ width: 1400, height: 1100 })
    await page.goto("/app/pos/orders")
    await expect(page.getByRole("heading", { name: "Encomendas", exact: true })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole("button", { name: "Registrar e imprimir" })).toBeDisabled()

    await page.getByPlaceholder("Nome do cliente").fill("Fernanda Carvalho")
    await page.getByPlaceholder("(00) 00000-0000").fill("38988365631")
    await expect(page.getByPlaceholder("(00) 00000-0000")).toHaveValue("(38) 98836-5631")
    await page.getByLabel("Quantidade do item 1").fill("40")
    await page.getByLabel("Descrição do item 1").fill("mini pães de sal")
    // Enter na última linha abre outra linha.
    await page.getByLabel("Descrição do item 1").press("Enter")
    await page.getByLabel("Quantidade do item 2").fill("2,5")
    // A unidade varia: unidade, kg, g ou fardo.
    await page.getByRole("combobox", { name: "Unidade do item 2" }).click()
    await page.getByRole("option", { name: "Kg" }).click()
    await page.getByLabel("Descrição do item 2").fill("queijo mussarela")
    await page.getByLabel("Valor total").fill("120,00")
    await page.getByLabel("Sinal pago").fill("50,00")
    await expect(page.getByText("Falta pagar na retirada:")).toContainText("70,00")

    // Sem a data de retirada não registra.
    await expect(page.getByRole("button", { name: "Registrar e imprimir" })).toBeDisabled()
    await page.getByLabel("Retirada em").fill("31/10/2030 16:00")
    await expect(page.getByRole("button", { name: "Registrar e imprimir" })).toBeEnabled()

    await page.getByRole("button", { name: "Registrar e imprimir" }).click()
    await expect.poll(() => posted).not.toBeNull()
    expect(posted).toMatchObject({
      customer_name: "Fernanda Carvalho",
      customer_phone: "(38) 98836-5631",
      items: [
        { quantity: "40", unit: "un", description: "mini pães de sal" },
        { quantity: "2,5", unit: "kg", description: "queijo mussarela" },
      ],
      total_cents: 12000,
      paid_cents: 5000,
      attendant_name: "Poster Tester",
    })
    expect(String((posted as unknown as Record<string, unknown>).pickup_at)).toContain("2030-10-31")

    // O comprovante impresso leva as duas vias.
    await expect
      .poll(async () => {
        for (const frame of page.frames()) {
          const html = await frame.content()
          if (html.includes("VIA DA PRODUÇÃO") && html.includes("2,5 Kg · queijo mussarela")) return true
        }
        return false
      })
      .toBe(true)
    await expect(page.getByPlaceholder("Nome do cliente")).toHaveValue("")

    // A encomenda aparece na lista, em aberto, e avança de situação.
    await expect(page.getByText("Quinta, 31/10/2030 às 16:00")).toBeVisible()
    await page.getByRole("button", { name: "Marcar pronta" }).click()
    await expect.poll(() => statusPatches.length).toBe(1)
    expect(statusPatches[0]).toMatchObject({ status: "pronta" })
    await page.getByRole("button", { name: "Marcar retirada" }).click()
    await expect.poll(() => statusPatches.length).toBe(2)
    expect(statusPatches[1]).toMatchObject({ status: "retirada" })
  })

  test("keeps the form after reloading the page", async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1100 })
    await page.goto("/app/pos/orders")
    await expect(page.getByRole("heading", { name: "Encomendas", exact: true })).toBeVisible({ timeout: 20_000 })
    await page.getByPlaceholder("Nome do cliente").fill("Maria")
    await page.getByLabel("Descrição do item 1").fill("bolo de cenoura")
    await page.reload()
    await expect(page.getByPlaceholder("Nome do cliente")).toHaveValue("Maria")
    await expect(page.getByLabel("Descrição do item 1")).toHaveValue("bolo de cenoura")
  })
})
