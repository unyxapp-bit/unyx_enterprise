import { expect, test } from "@playwright/test"

const userId = "11111111-1111-4111-8111-111111111111"
const organizationId = "22222222-2222-4222-8222-222222222222"

const staffProfile = {
  id: "44444444-4444-4444-8444-444444444444",
  auth_user_id: "55555555-5555-4555-8555-555555555555",
  organization_id: organizationId,
  branch_id: null,
  name: "Lorena Souza",
  email: "lorena01@mercadoabc.unyx.app",
  role: "operator",
  active: true,
  custom_permissions: ["pos_cash", "front_notes"],
  login_code: "lorena01",
  job_title: "Fiscal de caixa",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  branches: null,
}

test("the staff login tab builds the internal email from store and code", async ({ page }) => {
  let attempt: Record<string, unknown> | null = null
  await page.route("https://test.supabase.co/**", async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith("/auth/v1/token")) {
      attempt = route.request().postDataJSON()
      return route.fulfill({
        status: 400,
        json: { code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" },
      })
    }
    return route.fulfill({ json: [] })
  })
  await page.goto("/login")
  await page.getByRole("button", { name: "Fiscal", exact: true }).click()
  await expect(page.getByText("Entrada do fiscal")).toBeVisible()
  // Sem e-mail: só loja, código e senha.
  await expect(page.getByLabel("Email")).toHaveCount(0)
  await page.getByLabel("Código da loja").fill("Mercado ABC")
  await page.getByLabel("Código de acesso").fill("Lorena01")
  await page.getByLabel("Senha").fill("123456")
  await page.getByRole("button", { name: "Entrar", exact: true }).last().click()

  await expect.poll(() => attempt).not.toBeNull()
  expect(attempt).toMatchObject({ email: "lorena01@mercadoabc.unyx.app", password: "123456" })
  await expect(page.getByText("Loja, código ou senha incorretos.")).toBeVisible()
})

test.describe("authenticated staff management", () => {
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
        // O perfil de quem entrou é buscado pelo auth_user_id; a lista de fiscais, não.
        const single = url.searchParams.has("auth_user_id")
        if (single) {
          await route.fulfill({ json: { id: "33333333-3333-4333-8333-333333333333", auth_user_id: userId, organization_id: organizationId, branch_id: null, name: "Poster Tester", email: "poster@example.test", role: "owner", active: true, custom_permissions: null } })
        } else {
          await route.fulfill({ json: [staffProfile] })
        }
        return
      }
      await route.fulfill({ json: [] })
    })
  })

  test("shows the store code and the staff list, creates and blocks a staff member", async ({ page }) => {
    const calls: Array<Record<string, unknown>> = []
    await page.route("https://test.supabase.co/functions/v1/staff-admin", async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>
      calls.push(body)
      if (body.action === "store") return route.fulfill({ json: { prefix: "mercadoabc" } })
      if (body.action === "create") {
        return route.fulfill({
          json: { profile: { ...staffProfile, id: "66666666-6666-4666-8666-666666666666", name: body.name, login_code: body.login_code }, prefix: "mercadoabc" },
        })
      }
      return route.fulfill({ json: { ok: true } })
    })
    await page.setViewportSize({ width: 1400, height: 1000 })
    await page.goto("/app/staff")
    await expect(page.getByRole("heading", { name: "Fiscais", exact: true })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText("mercadoabc", { exact: true })).toBeVisible()
    await expect(page.getByText("Lorena Souza")).toBeVisible()
    await expect(page.getByText("Fiscal de caixa").first()).toBeVisible()
    await expect(page.getByText("lorena01", { exact: true })).toBeVisible()

    await page.getByRole("button", { name: "Novo fiscal" }).click()
    const save = page.getByRole("button", { name: "Cadastrar fiscal" })
    await expect(save).toBeDisabled()
    await page.getByPlaceholder("Nome do fiscal").fill("Marcos Lima")
    await page.getByPlaceholder("Ex.: lorena01").fill("Marcos 02")
    await expect(page.getByPlaceholder("Ex.: lorena01")).toHaveValue("marcos02")
    // Senha curta não deixa cadastrar; "Gerar" cria uma senha de 6 números.
    await page.getByLabel("Senha", { exact: true }).fill("123")
    await expect(save).toBeDisabled()
    await page.getByRole("button", { name: "Gerar" }).click()
    await expect(save).toBeEnabled()
    await save.click()

    await expect.poll(() => calls.filter((call) => call.action === "create").length).toBe(1)
    const created = calls.find((call) => call.action === "create")!
    expect(created).toMatchObject({ name: "Marcos Lima", login_code: "marcos02", branch_id: null })
    expect(String(created.password)).toMatch(/^\d{6}$/)
    // Vem a sugestão de fiscal de caixa marcada.
    expect(created.permissions).toEqual(expect.arrayContaining(["pos_cash", "pos_posters"]))
    expect(created.permissions).not.toContain("users")

    // Bloquear pede confirmação e chama a função.
    page.once("dialog", (dialog) => void dialog.accept())
    await page.getByRole("button", { name: "Bloquear" }).click()
    await expect.poll(() => calls.some((call) => call.action === "set_active")).toBe(true)
    expect(calls.find((call) => call.action === "set_active")).toMatchObject({
      profile_id: staffProfile.id,
      active: false,
    })
  })
})
