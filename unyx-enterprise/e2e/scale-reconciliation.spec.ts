import { expect, test } from "@playwright/test"

const userId = "11111111-1111-4111-8111-111111111111"
const organizationId = "22222222-2222-4222-8222-222222222222"
const branchId = "44444444-4444-4444-8444-444444444444"

function todayKey() {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

const isoAt = (hour: number, minute: number) => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute).toISOString()
}

type Row = Record<string, unknown>

test.describe("scale reconciliation", () => {
  let schedules: Row[]
  let events: Row[]
  let reconcileCalls: Row[]
  let correctCalls: Row[]

  const schedule = (end: string, start = "07:40:00"): Row => ({
    id: "sch-1",
    organization_id: organizationId,
    branch_id: branchId,
    employee_id: "emp-1",
    work_date: todayKey(),
    start_time: start,
    break_start: "11:00:00",
    break_end: "12:00:00",
    end_time: end,
    status: "working",
    notes: null,
    employees: { name: "FRANCIELLY", sectors: { name: "Frente" } },
    branches: { name: "LOJA 04" },
  })

  test.beforeEach(async ({ page }) => {
    schedules = []
    events = []
    reconcileCalls = []
    correctCalls = []

    await page.addInitScript(({ userId }) => {
      const now = Math.floor(Date.now() / 1000)
      const token = `${btoa("{\"alg\":\"HS256\",\"typ\":\"JWT\"}")}.${btoa(JSON.stringify({ sub: userId, aud: "authenticated", role: "authenticated", exp: now + 3600, iat: now, email: "scale@example.test", app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, session_id: "test-session" }))}.signature`
      localStorage.setItem("sb-test-auth-token", JSON.stringify({ access_token: token, refresh_token: "test-refresh", token_type: "bearer", expires_in: 3600, expires_at: now + 3600, user: { id: userId, aud: "authenticated", role: "authenticated", email: "scale@example.test", app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {} } }))
      sessionStorage.setItem("unyx-access-mode", "system")
    }, { userId })

    await page.route("https://test.supabase.co/**", async (route) => {
      const url = new URL(route.request().url())
      const table = url.pathname.split("/").pop()
      if (url.pathname.endsWith("/auth/v1/user")) {
        return route.fulfill({ json: { id: userId, aud: "authenticated", role: "authenticated", email: "scale@example.test", app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {} } })
      }
      if (url.pathname.endsWith("/rest/v1/user_profiles")) {
        return route.fulfill({ json: { id: "33333333-3333-4333-8333-333333333333", auth_user_id: userId, organization_id: organizationId, branch_id: null, name: "Scale Tester", email: "scale@example.test", role: "owner", active: true, custom_permissions: null } })
      }
      if (table === "branches") {
        return route.fulfill({ json: [{ id: branchId, organization_id: organizationId, name: "LOJA 04", active: true }] })
      }
      if (table === "reconcile_schedules_by_scale") {
        reconcileCalls.push(route.request().postDataJSON() as Row)
        return route.fulfill({ json: { arrivals: 1, breaks: 0, returns: 0, exits: 0 } })
      }
      if (table === "correct_schedule_attendance") {
        correctCalls.push(route.request().postDataJSON() as Row)
        return route.fulfill({ json: { ok: true } })
      }
      if (table === "schedules") return route.fulfill({ json: schedules })
      if (table === "attendance_events") return route.fulfill({ json: events })
      return route.fulfill({ json: [] })
    })

    await page.setViewportSize({ width: 1400, height: 1100 })
  })

  test("confirms by the scale when the map opens, and again after the grace for today only", async ({ page }) => {
    schedules = [schedule("17:00:00")]
    await page.goto("/app/allocation")

    await expect.poll(() => reconcileCalls.length).toBe(8)
    const today = reconcileCalls.filter((call) => call.p_date === todayKey())
    expect(today).toHaveLength(1)
    expect(today[0]).toMatchObject({ p_branch_id: branchId, p_grace_minutes: 120 })
    expect(reconcileCalls.filter((call) => call.p_grace_minutes === 0)).toHaveLength(7)
    await expect(page.getByText(/Confirmado conforme a escala: \d+ entradas?/)).toBeVisible()
  })

  test("shows where each time came from and corrects with the real times", async ({ page }) => {
    schedules = [schedule("17:00:00")]
    events = [
      { id: "ev1", schedule_id: "sch-1", event_type: "entrada_confirmada", event_time: isoAt(7, 40), source: "escala" },
      { id: "ev2", schedule_id: "sch-1", event_type: "saida_confirmada", event_time: isoAt(17, 0), source: "manual" },
    ]
    await page.goto("/app/allocation")
    await page.getByRole("button", { name: /Conferência/ }).click()

    await expect(page.getByText("FRANCIELLY")).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText("Conforme escala").first()).toBeVisible()
    await expect(page.getByText("Registrado").first()).toBeVisible()
    await expect(page.getByText("Sem registro").first()).toBeVisible()

    await page.getByRole("button", { name: "Corrigir" }).click()
    await expect(page.getByLabel("Entrada", { exact: true })).toHaveValue("07:40")
    await page.getByLabel("Entrada", { exact: true }).fill("08:10")
    await page.getByLabel("Saída", { exact: true }).fill("16:30")
    await page.getByRole("button", { name: "Salvar conferência" }).click()

    await expect.poll(() => correctCalls.length).toBe(1)
    expect(correctCalls[0]).toMatchObject({
      p_schedule_id: "sch-1",
      p_outcome: "compareceu",
      p_arrival: "08:10",
      p_exit: "16:30",
    })
  })

  test("holds today's report until the scale of the day is over", async ({ page }) => {
    schedules = [schedule("23:59:00")]
    await page.goto("/app/reports")
    await expect(page.getByText(/O relatório de hoje é gerado ao fim da escala do dia/)).toBeVisible({ timeout: 20_000 })
    expect(reconcileCalls.filter((call) => call.p_date === todayKey())).toHaveLength(0)
  })

  test("generates today's report after the scale ends, already reconciled", async ({ page }) => {
    schedules = [schedule("00:01:00", "00:00:00")]
    await page.goto("/app/reports")
    await expect.poll(() => reconcileCalls.length).toBeGreaterThan(0)
    expect(reconcileCalls[0]).toMatchObject({ p_date: todayKey(), p_grace_minutes: 0 })
    await expect(page.getByText(/O relatório de hoje é gerado ao fim da escala do dia/)).toHaveCount(0)
  })
})
