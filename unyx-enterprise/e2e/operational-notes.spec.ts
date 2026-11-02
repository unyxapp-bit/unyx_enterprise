import { expect, test } from "@playwright/test"

const userId = "11111111-1111-4111-8111-111111111111"
const organizationId = "22222222-2222-4222-8222-222222222222"

// O prazo é digitado no horário de Brasília e precisa chegar ao banco com o fuso correto.
test.use({ timezoneId: "America/Sao_Paulo" })

type Row = Record<string, unknown>

test.describe("authenticated operational notes", () => {
  let notes: Row[]
  let posted: Row[]
  let patches: Row[]
  let failStatusPatch = false
  let failAudit = false

  test.beforeEach(async ({ page }) => {
    notes = []
    posted = []
    patches = []
    failStatusPatch = false
    failAudit = false

    await page.addInitScript(({ userId }) => {
      const now = Math.floor(Date.now() / 1000)
      const token = `${btoa("{\"alg\":\"HS256\",\"typ\":\"JWT\"}")}.${btoa(JSON.stringify({ sub: userId, aud: "authenticated", role: "authenticated", exp: now + 3600, iat: now, email: "notes@example.test", app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, session_id: "test-session" }))}.signature`
      localStorage.setItem("sb-test-auth-token", JSON.stringify({ access_token: token, refresh_token: "test-refresh", token_type: "bearer", expires_in: 3600, expires_at: now + 3600, user: { id: userId, aud: "authenticated", role: "authenticated", email: "notes@example.test", app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {} } }))
      sessionStorage.setItem("unyx-access-mode", "system")
    }, { userId })

    await page.route("https://test.supabase.co/**", async (route) => {
      const url = new URL(route.request().url())
      const table = url.pathname.split("/").pop()
      const method = route.request().method()
      if (url.pathname.endsWith("/auth/v1/user")) {
        return route.fulfill({ json: { id: userId, aud: "authenticated", role: "authenticated", email: "notes@example.test", app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {} } })
      }
      if (url.pathname.endsWith("/rest/v1/user_profiles")) {
        return route.fulfill({ json: { id: "33333333-3333-4333-8333-333333333333", auth_user_id: userId, organization_id: organizationId, branch_id: null, name: "Notes Tester", email: "notes@example.test", role: "owner", active: true, custom_permissions: null } })
      }
      if (table === "audit_logs" && method === "POST") {
        if (failAudit) return route.fulfill({ status: 500, json: { message: "audit indisponivel" } })
        return route.fulfill({ status: 201, json: [] })
      }
      if (table === "operational_notes") {
        if (method === "POST") {
          const body = route.request().postDataJSON() as Row
          posted.push(body)
          const row = { ...body, id: `note-${notes.length + 1}`, active: true, resolved_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), branches: null, sectors: null, user_profiles: { name: "Notes Tester" } }
          notes.push(row)
          return route.fulfill({ status: 201, json: row })
        }
        if (method === "PATCH") {
          const body = route.request().postDataJSON() as Row
          if (failStatusPatch && body.status) {
            return route.fulfill({ status: 400, json: { message: "falha ao mover" } })
          }
          patches.push(body)
          const id = url.searchParams.get("id")?.replace("eq.", "")
          const index = notes.findIndex((note) => note.id === id)
          notes[index] = { ...notes[index], ...body }
          return route.fulfill({ json: notes[index] })
        }
        const id = url.searchParams.get("id")?.replace("eq.", "")
        if (id) return route.fulfill({ json: notes.find((note) => note.id === id) ?? null })
        return route.fulfill({ json: notes })
      }
      return route.fulfill({ json: [] })
    })

    await page.setViewportSize({ width: 1400, height: 1100 })
    await page.goto("/app/notes")
    await expect(page.getByRole("heading", { name: "Anotações", exact: true })).toBeVisible({ timeout: 20_000 })
  })

  test("creates and edits a note keeping the deadline in local time", async ({ page }) => {
    failAudit = true // a falha na auditoria não pode virar erro nem impedir o salvamento

    await page.getByRole("button", { name: "Nova anotação" }).click()
    await page.getByLabel("Título").fill("Balança do caixa 3")
    await page.getByLabel("Conteúdo").fill("A balança está descalibrada.")
    await page.getByLabel("Prazo").fill("05/11/2030 12:00")
    await page.getByRole("button", { name: "Salvar anotação" }).click()

    await expect.poll(() => posted.length).toBe(1)
    expect(posted[0]).toMatchObject({
      title: "Balança do caixa 3",
      content: "A balança está descalibrada.",
      status: "open",
      priority: "normal",
      due_at: "2030-11-05T15:00:00.000Z",
    })
    await expect(page.getByRole("dialog")).toBeHidden()
    await expect(page.getByRole("heading", { name: "Balança do caixa 3" })).toBeVisible()

    // Edita: o campo mostra o horário local e o salvamento mantém o prazo.
    await page.getByRole("button", { name: "Editar" }).click()
    await expect(page.getByLabel("Prazo")).toHaveValue("05/11/2030 12:00")
    await page.getByLabel("Título").fill("Balança do caixa 4")
    await page.getByLabel("Conteúdo").fill("Calibrada pelo técnico.")
    await page.getByRole("button", { name: "Salvar anotação" }).click()

    await expect.poll(() => patches.length).toBe(1)
    expect(patches[0]).toMatchObject({
      title: "Balança do caixa 4",
      content: "Calibrada pelo técnico.",
      due_at: "2030-11-05T15:00:00.000Z",
      status: "open",
    })
    await expect(page.getByRole("dialog")).toBeHidden()
    await expect(page.getByRole("heading", { name: "Balança do caixa 4" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Balança do caixa 3" })).toHaveCount(0)
  })

  test("moves, archives and only deletes archived notes", async ({ page }) => {
    await page.getByRole("button", { name: "Nova anotação" }).click()
    await page.getByLabel("Título").fill("Falta de sacolas")
    await page.getByLabel("Conteúdo").fill("Repor sacolas no caixa 1.")
    await page.getByRole("button", { name: "Salvar anotação" }).click()
    await expect(page.getByRole("heading", { name: "Falta de sacolas" })).toBeVisible()

    // Sem anotação arquivada não há Excluir: só Arquivar.
    await expect(page.getByRole("button", { name: "Excluir" })).toHaveCount(0)

    await page.getByRole("button", { name: "Analisar" }).click()
    await expect.poll(() => patches.length).toBe(1)
    expect(patches[0]).toMatchObject({ status: "in_review" })
    await expect(page.getByRole("button", { name: "Resolver" })).toBeVisible()

    await page.getByRole("button", { name: "Arquivar" }).click()
    await expect.poll(() => patches.length).toBe(2)
    expect(patches[1]).toMatchObject({ status: "archived" })
    await expect(page.getByRole("button", { name: "Excluir" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Reabrir" })).toBeVisible()
  })

  test("rolls the card back when moving fails", async ({ page }) => {
    await page.getByRole("button", { name: "Nova anotação" }).click()
    await page.getByLabel("Título").fill("Piso molhado")
    await page.getByLabel("Conteúdo").fill("Corredor 4.")
    await page.getByRole("button", { name: "Salvar anotação" }).click()
    await expect(page.getByRole("button", { name: "Analisar" })).toBeVisible()

    failStatusPatch = true
    await page.getByRole("button", { name: "Analisar" }).click()
    await expect(page.getByText("falha ao mover").first()).toBeVisible()
    // Voltou para "Em aberto": o botão principal continua sendo Analisar.
    await expect(page.getByRole("button", { name: "Analisar" })).toBeVisible()
    expect(patches).toHaveLength(0)
  })

  test("prints a note on A6 with its details", async ({ page }) => {
    await page.getByRole("button", { name: "Nova anotação" }).click()
    await page.getByLabel("Título").fill("Vazamento no freezer")
    await page.getByLabel("Conteúdo").fill("Chamar a manutenção.")
    await page.getByLabel("Prazo").fill("05/11/2030 12:00")
    await page.getByRole("button", { name: "Salvar anotação" }).click()
    await expect(page.getByRole("heading", { name: "Vazamento no freezer" })).toBeVisible()

    await page.evaluate(() => {
      window.setTimeout = ((fn: TimerHandler, ms?: number) =>
        ms === 100 ? 0 : setTimeout(fn, ms)) as typeof window.setTimeout
    })
    await page.getByRole("button", { name: "Imprimir" }).click()
    await expect
      .poll(async () => {
        for (const frame of page.frames()) {
          const html = await frame.content()
          if (html.includes("Anotação operacional") && html.includes("Vazamento no freezer") && html.includes("05/11/2030 12:00") && html.includes("Chamar a manutenção.")) return true
        }
        return false
      })
      .toBe(true)
  })

  test("expands long content", async ({ page }) => {
    await page.getByRole("button", { name: "Nova anotação" }).click()
    await page.getByLabel("Título").fill("Nota longa")
    await page.getByLabel("Conteúdo").fill("detalhe ".repeat(40))
    await page.getByRole("button", { name: "Salvar anotação" }).click()
    await page.getByRole("button", { name: "Ver mais" }).click()
    await expect(page.getByRole("button", { name: "Ver menos" })).toBeVisible()
  })
})
