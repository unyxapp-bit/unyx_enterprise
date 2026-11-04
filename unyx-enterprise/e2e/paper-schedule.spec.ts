import { expect, test } from "@playwright/test"

const userId = "11111111-1111-4111-8111-111111111111"
const organizationId = "22222222-2222-4222-8222-222222222222"
const branchId = "44444444-4444-4444-8444-444444444444"

type Row = Record<string, unknown>

const employee = (id: string, name: string): Row => ({
  id,
  organization_id: organizationId,
  branch_id: branchId,
  sector_id: null,
  name,
  document: null,
  role: "Operador",
  active: true,
  sectors: { name: "Frente" },
})

const employees = [
  employee("e1", "FRANCIELLY SOUZA"),
  employee("e2", "WESLEY ALVES"),
  employee("e3", "VITORIA LIMA"),
  employee("e4", "IRIS LIMA"),
]

test.describe("paper schedule", () => {
  let existing: Row[]
  let created: Row[]
  let patches: Array<{ id: string; body: Row }>

  test.beforeEach(async ({ page }) => {
    existing = [
      {
        id: "sch-w",
        organization_id: organizationId,
        branch_id: branchId,
        employee_id: "e2",
        work_date: "2026-11-02",
        start_time: "07:40:00",
        break_start: "12:30:00",
        break_end: "14:30:00",
        end_time: "17:40:00",
        status: "working",
        notes: null,
        branches: { name: "LOJA 04" },
        employees: employees[1],
      },
    ]
    created = []
    patches = []

    await page.addInitScript(({ userId }) => {
      const now = Math.floor(Date.now() / 1000)
      const token = `${btoa("{\"alg\":\"HS256\",\"typ\":\"JWT\"}")}.${btoa(JSON.stringify({ sub: userId, aud: "authenticated", role: "authenticated", exp: now + 3600, iat: now, email: "paper@example.test", app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, session_id: "test-session" }))}.signature`
      localStorage.setItem("sb-test-auth-token", JSON.stringify({ access_token: token, refresh_token: "test-refresh", token_type: "bearer", expires_in: 3600, expires_at: now + 3600, user: { id: userId, aud: "authenticated", role: "authenticated", email: "paper@example.test", app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {} } }))
      sessionStorage.setItem("unyx-access-mode", "system")
    }, { userId })

    await page.route("https://test.supabase.co/**", async (route) => {
      const url = new URL(route.request().url())
      const table = url.pathname.split("/").pop()
      const method = route.request().method()
      const idFilter = url.searchParams.get("id")?.replace("eq.", "")
      if (url.pathname.endsWith("/auth/v1/user")) {
        return route.fulfill({ json: { id: userId, aud: "authenticated", role: "authenticated", email: "paper@example.test", app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {} } })
      }
      if (url.pathname.endsWith("/rest/v1/user_profiles")) {
        return route.fulfill({ json: { id: "33333333-3333-4333-8333-333333333333", auth_user_id: userId, organization_id: organizationId, branch_id: null, name: "Paper Tester", email: "paper@example.test", role: "owner", active: true, custom_permissions: null } })
      }
      if (table === "branches") {
        const branch = { id: branchId, organization_id: organizationId, name: "LOJA 04", active: true }
        return route.fulfill({ json: idFilter ? branch : [branch] })
      }
      if (table === "employees") {
        return route.fulfill({
          json: idFilter ? employees.find((item) => item.id === idFilter) ?? null : employees,
        })
      }
      if (table === "schedules") {
        if (method === "POST") {
          const body = route.request().postDataJSON() as Row[]
          created.push(...body)
          return route.fulfill({ status: 201, json: body.map((row, index) => ({ ...row, id: `new-${index}` })) })
        }
        if (method === "PATCH") {
          const body = route.request().postDataJSON() as Row
          patches.push({ id: idFilter ?? "", body })
          return route.fulfill({ json: { ...existing[0], ...body } })
        }
        if (idFilter) return route.fulfill({ json: existing.find((row) => row.id === idFilter) ?? null })
        return route.fulfill({ json: existing })
      }
      return route.fulfill({ json: [] })
    })

    await page.setViewportSize({ width: 1500, height: 1100 })
    await page.goto("/app/schedules")
    await expect(page.getByRole("button", { name: "Escala do papel" })).toBeVisible({ timeout: 20_000 })
  })

  test("reads the weekly sheet, matches first names and updates what already exists", async ({ page }) => {
    await page.getByRole("button", { name: "Escala do papel" }).click()
    await page.getByLabel("Texto da escala").fill(
      [
        "segunda-feira, 2 de novembro de 2026\tHORARIO",
        "CAIXA\tENTRADA\tINTERVALO\tRETORNO\tSAIDA",
        "FRANCIELLY\t07:40\t11:20\t13:20\t16:40",
        "WESLEY\t07:40\t11:20\t13:20\t16:40",
        "VITORIA / ÍRIS\t11:20\t13:20\t15:20\t20:20",
        "LUANNE\tFOLGA\tFOLGA\tFOLGA\tFOLGA",
      ].join("\n")
    )

    await expect(page.getByText("2 novas", { exact: true })).toBeVisible()
    await expect(page.getByText("1 atualizam uma escala existente")).toBeVisible()
    await expect(page.getByText("1 sem colaborador", { exact: true })).toBeVisible()
    await expect(page.getByText("Atualiza a existente")).toBeVisible()
    await expect(page.getByLabel("Entrada de FRANCIELLY em 02/11/2026")).toHaveValue("07:40")

    // Corrige um horário direto na tabela antes de salvar.
    await page.getByLabel("Saída de FRANCIELLY em 02/11/2026", { exact: true }).fill("16:50")
    await page.getByRole("button", { name: /Salvar escala/ }).click()

    await expect.poll(() => created.length).toBe(2)
    expect(created[0]).toMatchObject({
      employee_id: "e1",
      work_date: "2026-11-02",
      start_time: "07:40",
      break_start: "11:20",
      break_end: "13:20",
      end_time: "16:50",
      status: "scheduled",
    })
    expect(created[1]).toMatchObject({ employee_id: "e3", start_time: "11:20", end_time: "20:20" })

    await expect.poll(() => patches.length).toBe(1)
    expect(patches[0].id).toBe("sch-w")
    // Quem já estava trabalhando no sistema mantém a situação; só os horários mudam.
    expect(patches[0].body).toMatchObject({
      start_time: "07:40",
      break_start: "11:20",
      break_end: "13:20",
      end_time: "16:40",
      status: "working",
    })
  })

  test("lists every employee of the day to type the times from the paper", async ({ page }) => {
    await page.getByRole("button", { name: "Escala do papel" }).click()
    await page.getByLabel("Dia para montar").fill("03/11/2026")
    await page.getByRole("button", { name: "Listar todos os colaboradores" }).click()

    await expect(page.getByText("4 sem colaborador")).toHaveCount(0)
    await expect(page.getByLabel("Entrada de FRANCIELLY SOUZA em 03/11/2026")).toBeVisible()
    await expect(page.getByLabel("Entrada de IRIS LIMA em 03/11/2026")).toBeVisible()
    // Sem horários digitados, nada pode ser salvo.
    await expect(page.getByRole("button", { name: /Salvar escala/ })).toBeDisabled()

    await page.getByLabel("Entrada de IRIS LIMA em 03/11/2026").fill("11:20")
    await page.getByLabel("Saída de IRIS LIMA em 03/11/2026", { exact: true }).fill("21:20")
    await expect(page.getByRole("button", { name: /Salvar escala \(1 novas/ })).toBeEnabled()
  })
})
