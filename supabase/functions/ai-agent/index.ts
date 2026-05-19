import { createClient } from "https://esm.sh/@supabase/supabase-js@2.105.1"

type AgentSeverity = "normal" | "medio" | "alto" | "critico"
type AgentIntent = "analyze" | "resolve" | "act"
type OperationalSupportPriority = "low" | "normal" | "high" | "urgent"
type AgentActionTool = "generate_delay_report" | "allocate_post"
type AgentActionMode = "none" | "suggest" | "execute_with_confirmation" | "execute_auto"
type AgentActionStatus = "none" | "executed" | "pending_confirmation" | "blocked" | "failed"

type AgentActionArguments = {
  branch_id?: string | null
  post_id?: string | null
  employee_id?: string | null
  schedule_id?: string | null
  notes?: string | null
  period_days?: number | null
}

type AgentActionRequest = {
  tool_name?: AgentActionTool | null
  arguments?: AgentActionArguments | null
  confirmed?: boolean | null
}

type AgentTarget = {
  id?: string | null
  branch_id?: string | null
  title?: string | null
  severity?: AgentSeverity | null
  evidence?: string | null
  action?: string | null
}

type AgentRequest = {
  branch_id?: string | null
  question?: string | null
  intent?: AgentIntent | null
  target?: AgentTarget | null
  action?: AgentActionRequest | null
}

type UserProfile = {
  id: string
  auth_user_id: string
  organization_id: string
  branch_id: string | null
  role: string
  name: string | null
  custom_permissions: string[] | null
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
}

const actionArgumentsSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    branch_id: { type: ["string", "null"] },
    post_id: { type: ["string", "null"] },
    employee_id: { type: ["string", "null"] },
    schedule_id: { type: ["string", "null"] },
    notes: { type: ["string", "null"] },
    period_days: { type: ["number", "null"] },
  },
  required: [
    "branch_id",
    "post_id",
    "employee_id",
    "schedule_id",
    "notes",
    "period_days",
  ],
}

const actionPlanSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    mode: {
      type: "string",
      enum: ["none", "suggest", "execute_with_confirmation", "execute_auto"],
    },
    tool_name: {
      type: ["string", "null"],
      enum: ["generate_delay_report", "allocate_post", null],
    },
    title: { type: "string" },
    description: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    confirmation_required: { type: "boolean" },
    arguments: actionArgumentsSchema,
    arguments_summary: { type: "string" },
  },
  required: [
    "mode",
    "tool_name",
    "title",
    "description",
    "confidence",
    "confirmation_required",
    "arguments",
    "arguments_summary",
  ],
}

const actionResultSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: {
      type: "string",
      enum: ["none", "executed", "pending_confirmation", "blocked", "failed"],
    },
    tool_name: {
      type: ["string", "null"],
      enum: ["generate_delay_report", "allocate_post", null],
    },
    title: { type: "string" },
    message: { type: "string" },
    artifact_markdown: { type: "string" },
  },
  required: [
    "status",
    "tool_name",
    "title",
    "message",
    "artifact_markdown",
  ],
}

const resolutionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: {
      type: "string",
      enum: ["none", "drafted"],
    },
    target_title: { type: "string" },
    severity: {
      type: "string",
      enum: ["normal", "medio", "alto", "critico"],
    },
    diagnosis: { type: "string" },
    immediate_steps: {
      type: "array",
      maxItems: 6,
      items: { type: "string" },
    },
    recommended_message: { type: "string" },
    preventive_actions: {
      type: "array",
      maxItems: 5,
      items: { type: "string" },
    },
    confirmation_required: { type: "boolean" },
    apply_note: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        content: { type: "string" },
        category: { type: "string" },
        priority: {
          type: "string",
          enum: ["low", "normal", "high", "urgent"],
        },
        status: {
          type: "string",
          enum: ["open", "in_review"],
        },
      },
      required: ["title", "content", "category", "priority", "status"],
    },
  },
  required: [
    "status",
    "target_title",
    "severity",
    "diagnosis",
    "immediate_steps",
    "recommended_message",
    "preventive_actions",
    "confirmation_required",
    "apply_note",
  ],
}

const insightSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    overall_severity: {
      type: "string",
      enum: ["normal", "medio", "alto", "critico"],
    },
    risks: {
      type: "array",
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          severity: {
            type: "string",
            enum: ["normal", "medio", "alto", "critico"],
          },
          reason: { type: "string" },
          evidence: { type: "string" },
          action: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
        required: ["title", "severity", "reason", "evidence", "action", "confidence"],
      },
    },
    recommendations: {
      type: "array",
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          owner: { type: "string" },
          priority: {
            type: "string",
            enum: ["baixa", "media", "alta"],
          },
          requires_confirmation: { type: "boolean" },
        },
        required: ["title", "description", "owner", "priority", "requires_confirmation"],
      },
    },
    next_action: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        can_execute: { type: "boolean" },
        tool_name: { type: ["string", "null"] },
      },
      required: ["title", "description", "can_execute", "tool_name"],
    },
    action_plan: actionPlanSchema,
    action_result: actionResultSchema,
    resolution: resolutionSchema,
    chat_answer: { type: "string" },
    tools_used: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: [
    "summary",
    "overall_severity",
    "risks",
    "recommendations",
    "next_action",
    "action_plan",
    "action_result",
    "resolution",
    "chat_answer",
    "tools_used",
  ],
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: jsonHeaders,
    status,
  })
}

function dateInSaoPaulo(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null

  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
    year: "numeric",
  }).formatToParts(date)

  const year = parts.find((part) => part.type === "year")?.value
  const month = parts.find((part) => part.type === "month")?.value
  const day = parts.find((part) => part.type === "day")?.value
  if (!year || !month || !day) return null

  return `${year}-${month}-${day}`
}

function todayInSaoPaulo() {
  return dateInSaoPaulo(new Date()) ?? new Date().toISOString().slice(0, 10)
}

function isSameDateInSaoPaulo(value: unknown, expectedDate: string) {
  return typeof value === "string" && dateInSaoPaulo(value) === expectedDate
}

function thirtyDaysAgoISO() {
  const date = new Date()
  date.setDate(date.getDate() - 30)
  return date.toISOString()
}

function canUseAi(profile: UserProfile) {
  if (["owner", "admin", "branch_manager"].includes(profile.role)) return true
  return profile.custom_permissions?.includes("ai") ?? false
}

function scopedBranchId(profile: UserProfile, requestedBranchId?: string | null) {
  if (profile.role === "owner" || profile.role === "admin") {
    return requestedBranchId || null
  }

  return profile.branch_id || requestedBranchId || null
}

function compactRows(rows: unknown[], maxRows: number) {
  return rows.slice(0, maxRows)
}

function todayStartInSaoPauloISO(today: string) {
  return `${today}T00:00:00-03:00`
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
}

function parseQuestionTime(question?: string | null) {
  if (!question) return null
  const normalized = normalizeText(question)
  const match = normalized.match(/\b([01]?\d|2[0-3])\s*(?::|h)\s*([0-5]\d)\b/)
  if (!match) return null

  const hour = match[1].padStart(2, "0")
  const minute = match[2]
  return {
    display: `${hour}:${minute}`,
    value: `${hour}:${minute}:00`,
  }
}

function parsePostQuestion(question?: string | null) {
  if (!question) return null
  const normalized = normalizeText(question)
  const match = normalized.match(/\b(caixa|pdv|posto|checkout|balcao)\s*(?:numero|n\.?|#)?\s*([a-z0-9][a-z0-9-]*)\b/)
  if (!match) return null

  return {
    kind: match[1],
    term: match[2],
    label: `${match[1]} ${match[2]}`,
  }
}

function optionalRows<T>(result: { data?: T[] | null; error?: { message?: string } | null }) {
  return result.error ? [] : result.data ?? []
}

function optionalError(label: string, result: { error?: { message?: string } | null }) {
  return result.error?.message ? `${label}: ${result.error.message}` : null
}

function countRows<T>(rows: T[], predicate: (row: T) => boolean) {
  return rows.filter(predicate).length
}

function numericValue(value: unknown) {
  if (typeof value === "number") return value
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function sumRows(rows: Record<string, unknown>[], key: string) {
  return rows.reduce((total, row) => total + numericValue(row[key]), 0)
}

const NON_OPERATIONAL_SCHEDULE_STATUSES = new Set([
  "day_off",
  "banked_hours",
  "cancelled",
])

const DEFAULT_BREAK_TOLERANCE_MINUTES = 15

const ENTERED_STATUSES_FOR_PENDING = new Set([
  "trabalhando",
  "em_intervalo",
  "intervalo_finalizado",
  "voltou",
  "aguardando_sangria",
  "troca_de_caixa",
  "deve_sair",
  "pico",
  "apoio_operacional",
  "fechamento",
  "saida_registrada",
])

const ACTIVE_ALLOCATION_STATUSES_FOR_PENDING = new Set([
  "alocado",
  "aguardando_troca",
  "em_troca",
])

const REAL_WORKING_STATUSES_FOR_PENDING = new Set([
  "trabalhando",
  "voltou",
  "aguardando_sangria",
  "troca_de_caixa",
  "deve_sair",
  "pico",
  "apoio_operacional",
  "fechamento",
])

function nowInSaoPauloMinutes() {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).formatToParts(new Date())

  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0")
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0")
  return (hour === 24 ? 0 : hour) * 60 + minute
}

function timeToMinutes(value: unknown) {
  if (typeof value !== "string") return null
  const match = value.match(/^(\d{1,2}):([0-5]\d)/)
  if (!match) return null

  const hour = Number(match[1])
  const minute = Number(match[2])
  if (!Number.isFinite(hour) || hour > 23) return null

  return hour * 60 + minute
}

function isPastDateTime(value: unknown) {
  if (typeof value !== "string" || value.length === 0) return false
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) && parsed < Date.now()
}

function formatPendingDateTime(value: unknown) {
  if (typeof value !== "string" || value.length === 0) return "sem horario"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 16)

  return parsed.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  })
}

function allocationBelongsToWorkDate(allocation: DataRow, workDate: string) {
  const schedule = asRow(allocation.schedules)
  const scheduleDate = readString(schedule, "work_date")
  if (scheduleDate) return scheduleDate === workDate

  const startedAt = readString(allocation, "started_at")
  return isSameDateInSaoPaulo(startedAt, workDate)
}

function buildPendingGroup(
  key: string,
  title: string,
  count: number,
  alert: boolean,
  empty: string,
  examples: string[]
) {
  return {
    key,
    title,
    count,
    alert,
    empty,
    examples: examples.slice(0, 3),
  }
}

function buildOperationalPendingSummary(params: {
  workDate: string
  schedules: unknown[]
  statuses: unknown[]
  posts: unknown[]
  allocations: unknown[]
  cashSessions: unknown[]
  deliveries: unknown[]
  productionOrders: unknown[]
  queueSignals: unknown[]
}) {
  const currentMinutes = nowInSaoPauloMinutes()
  const schedules = params.schedules
    .map(asRow)
    .filter((schedule) => !NON_OPERATIONAL_SCHEDULE_STATUSES.has(readString(schedule, "status") ?? ""))
  const statuses = params.statuses.map(asRow)
  const statusByScheduleId = new Map<string, DataRow>()
  const statusByEmployeeId = new Map<string, DataRow>()

  for (const status of statuses) {
    const scheduleId = readString(status, "schedule_id")
    const employeeId = readString(status, "employee_id")
    if (scheduleId) statusByScheduleId.set(scheduleId, status)
    if (employeeId) statusByEmployeeId.set(employeeId, status)
  }

  const schedulesToArrive = schedules.filter((schedule) => {
    const scheduleId = readString(schedule, "id")
    const status = scheduleId ? readString(statusByScheduleId.get(scheduleId) ?? {}, "current_status") : null
    return !status || status === "aguardando_evento"
  })
  const schedulesInTurn = schedules.filter((schedule) => {
    const scheduleId = readString(schedule, "id")
    const status = scheduleId ? readString(statusByScheduleId.get(scheduleId) ?? {}, "current_status") : null
    return Boolean(status && ENTERED_STATUSES_FOR_PENDING.has(status))
  })
  const activeAllocations = params.allocations
    .map(asRow)
    .filter(
      (allocation) =>
        !readString(allocation, "ended_at") &&
        ACTIVE_ALLOCATION_STATUSES_FOR_PENDING.has(readString(allocation, "status") ?? "") &&
        allocationBelongsToWorkDate(allocation, params.workDate)
    )
  const occupiedPostIds = new Set(
    activeAllocations
      .filter((allocation) => {
        const scheduleId = readString(allocation, "schedule_id")
        const employeeId = readString(allocation, "employee_id")
        const status =
          (scheduleId ? statusByScheduleId.get(scheduleId) : undefined) ??
          (employeeId ? statusByEmployeeId.get(employeeId) : undefined)
        const currentStatus = status ? readString(status, "current_status") : null
        return Boolean(currentStatus && REAL_WORKING_STATUSES_FOR_PENDING.has(currentStatus))
      })
      .map((allocation) => readString(allocation, "post_id"))
      .filter((postId): postId is string => Boolean(postId))
  )

  const lateArrivals = schedulesToArrive.filter((schedule) => {
    const start = timeToMinutes(readString(schedule, "start_time"))
    return start !== null && currentMinutes > start
  })
  const overdueBreaks = schedulesInTurn.filter((schedule) => {
    const scheduleId = readString(schedule, "id")
    const status = scheduleId ? readString(statusByScheduleId.get(scheduleId) ?? {}, "current_status") : null
    const breakEnd = timeToMinutes(readString(schedule, "break_end"))
    return (
      status === "em_intervalo" &&
      breakEnd !== null &&
      currentMinutes > breakEnd + DEFAULT_BREAK_TOLERANCE_MINUTES
    )
  })
  const breaksWaitingRelease = schedulesInTurn.filter((schedule) => {
    const scheduleId = readString(schedule, "id")
    const status = scheduleId ? readString(statusByScheduleId.get(scheduleId) ?? {}, "current_status") : null
    const breakStart = timeToMinutes(readString(schedule, "break_start"))
    const notes = readString(schedule, "notes") ?? ""
    const lunchDone = notes.includes("lunch_done") || status === "voltou"
    return (
      !lunchDone &&
      breakStart !== null &&
      currentMinutes > breakStart + DEFAULT_BREAK_TOLERANCE_MINUTES &&
      [
        "trabalhando",
        "deve_sair",
        "aguardando_sangria",
        "troca_de_caixa",
        "pico",
        "apoio_operacional",
        "fechamento",
      ].includes(status ?? "")
    )
  })
  const openQueueSignals = params.queueSignals
    .map(asRow)
    .filter((signal) => ["open", "monitoring"].includes(readString(signal, "status") ?? ""))
  const uncoveredPosts = params.posts
    .map(asRow)
    .filter((post) => !occupiedPostIds.has(readString(post, "id") ?? ""))
  const allocationsWithoutSchedule = activeAllocations.filter(
    (allocation) => !readString(allocation, "schedule_id")
  )
  const openCashSessions = params.cashSessions
    .map(asRow)
    .filter((session) => readString(session, "status") === "open")
  const overdueDeliveries = params.deliveries
    .map(asRow)
    .filter((order) => {
      if (["delivered", "failed", "cancelled"].includes(readString(order, "status") ?? "")) {
        return false
      }
      return isPastDateTime(readString(order, "estimated_delivery_at") ?? readString(order, "scheduled_for"))
    })
  const overdueProduction = params.productionOrders
    .map(asRow)
    .filter((order) => {
      if (["ready", "delivered", "cancelled"].includes(readString(order, "status") ?? "")) {
        return false
      }
      return isPastDateTime(readString(order, "promised_at"))
    })

  const groups = [
    buildPendingGroup(
      "late-arrivals",
      "Entradas atrasadas",
      lateArrivals.length,
      true,
      "Nenhum colaborador atrasado para entrada.",
      lateArrivals.map(
        (schedule) =>
          `${relationName(schedule, "employees") ?? "Colaborador"} - entrada ${readString(schedule, "start_time") ?? "sem horario"}`
      )
    ),
    buildPendingGroup(
      "overdue-breaks",
      "Intervalos vencidos",
      overdueBreaks.length,
      true,
      "Nenhum intervalo vencido.",
      overdueBreaks.map(
        (schedule) =>
          `${relationName(schedule, "employees") ?? "Colaborador"} - retorno ${readString(schedule, "break_end") ?? "sem horario"}`
      )
    ),
    buildPendingGroup(
      "breaks-waiting-release",
      "Intervalos a liberar",
      breaksWaitingRelease.length,
      true,
      "Nenhum intervalo aguardando liberacao.",
      breaksWaitingRelease.map(
        (schedule) =>
          `${relationName(schedule, "employees") ?? "Colaborador"} - previsto ${readString(schedule, "break_start") ?? "sem horario"}`
      )
    ),
    buildPendingGroup(
      "queue-signals",
      "Filas operacionais",
      openQueueSignals.length,
      true,
      "Nenhuma fila operacional aberta.",
      openQueueSignals.map(
        (signal) =>
          `${readString(signal, "title") ?? "Fila"} - ${readNumber(signal, "customer_count") ?? 0} cliente(s), ${readNumber(signal, "wait_minutes") ?? 0}min`
      )
    ),
    buildPendingGroup(
      "uncovered-posts",
      "Postos sem cobertura",
      uncoveredPosts.length,
      true,
      "Todos os postos ativos estao cobertos.",
      uncoveredPosts.map((post) =>
        [readString(post, "name") ?? "Posto", relationName(post, "sectors")]
          .filter(Boolean)
          .join(" - ")
      )
    ),
    buildPendingGroup(
      "allocations-without-schedule",
      "Alocados sem escala",
      allocationsWithoutSchedule.length,
      true,
      "Todas as alocacoes ativas estao vinculadas a uma escala.",
      allocationsWithoutSchedule.map((allocation) =>
        [
          relationName(allocation, "employees") ?? "Colaborador",
          relationName(allocation, "operational_posts") ?? "Posto",
        ].join(" - ")
      )
    ),
    buildPendingGroup(
      "open-cash-sessions",
      "Caixas abertos",
      openCashSessions.length,
      false,
      "Nenhum caixa aberto agora.",
      openCashSessions.map((session) =>
        [
          relationName(session, "operational_posts") ?? "Caixa",
          relationName(session, "employees") ?? relationName(session, "user_profiles"),
        ]
          .filter(Boolean)
          .join(" - ")
      )
    ),
    buildPendingGroup(
      "overdue-deliveries",
      "Entregas atrasadas",
      overdueDeliveries.length,
      true,
      "Nenhuma entrega atrasada.",
      overdueDeliveries.map((order) => {
        const due = readString(order, "estimated_delivery_at") ?? readString(order, "scheduled_for")
        return `${readString(order, "customer_name") ?? "Cliente"} - entrega ${formatPendingDateTime(due)}`
      })
    ),
    buildPendingGroup(
      "overdue-production",
      "Producao atrasada",
      overdueProduction.length,
      true,
      "Nenhum pedido de producao atrasado.",
      overdueProduction.map(
        (order) =>
          `${readString(order, "order_code") ?? "Pedido"} - ${readString(order, "customer_name") ?? "Cliente"}`
      )
    ),
  ]
  const totalAlerts = groups.reduce(
    (total, group) => total + (group.alert ? group.count : 0),
    0
  )

  return {
    generated_at: new Date().toISOString(),
    work_date: params.workDate,
    current_minutes: currentMinutes,
    total_alerts: totalAlerts,
    has_alerts: totalAlerts > 0,
    groups,
    counts: Object.fromEntries(groups.map((group) => [group.key, group.count])),
  }
}

function emptyActionArguments(): Required<AgentActionArguments> {
  return {
    branch_id: null,
    post_id: null,
    employee_id: null,
    schedule_id: null,
    notes: null,
    period_days: null,
  }
}

function emptyActionPlan() {
  return {
    mode: "none" as AgentActionMode,
    tool_name: null as AgentActionTool | null,
    title: "",
    description: "",
    confidence: 0,
    confirmation_required: false,
    arguments: emptyActionArguments(),
    arguments_summary: "",
  }
}

function emptyActionResult() {
  return {
    status: "none" as AgentActionStatus,
    tool_name: null as AgentActionTool | null,
    title: "",
    message: "",
    artifact_markdown: "",
  }
}

function emptyResolution() {
  return {
    status: "none",
    target_title: "",
    severity: "normal" as AgentSeverity,
    diagnosis: "",
    immediate_steps: [] as string[],
    recommended_message: "",
    preventive_actions: [] as string[],
    confirmation_required: false,
    apply_note: {
      title: "",
      content: "",
      category: "IA operacional",
      priority: "normal" as OperationalSupportPriority,
      status: "open",
    },
  }
}

function priorityForSeverity(severity: AgentSeverity): OperationalSupportPriority {
  if (severity === "critico") return "urgent"
  if (severity === "alto") return "high"
  if (severity === "medio") return "normal"
  return "low"
}

function buildFallbackResolution(
  context: Awaited<ReturnType<typeof fetchContext>>,
  severity: AgentSeverity,
  target: AgentTarget | null
) {
  const targetTitle =
    target?.title?.trim() ||
    (context.status_counts.critical > 0
      ? "Risco critico operacional"
      : "Risco operacional")
  const evidence =
    target?.evidence?.trim() ||
    `${context.status_counts.critical} status critico(s), ${context.recent_event_counts.delays} atraso(s) e ${context.recent_event_counts.absences} falta(s) recentes.`
  const suggestedAction =
    target?.action?.trim() ||
    "Validar a situacao com o responsavel da filial e registrar a acao executada."
  const immediateSteps = [
    "Confirmar se o alerta continua ativo no painel operacional.",
    "Acionar o responsavel da filial ou setor antes do proximo pico.",
    "Registrar a acao tomada para manter historico da ocorrencia.",
  ]
  const content = [
    `Diagnostico: ${targetTitle}.`,
    `Evidencia: ${evidence}`,
    `Acao recomendada: ${suggestedAction}`,
    "",
    "Passos imediatos:",
    ...immediateSteps.map((step, index) => `${index + 1}. ${step}`),
  ].join("\n")

  return {
    status: "drafted",
    target_title: targetTitle,
    severity,
    diagnosis:
      severity === "critico"
        ? "Ha prioridade critica ativa e a acao deve ser acompanhada ate conclusao."
        : "Ha prioridade alta que precisa de acompanhamento do gestor.",
    immediate_steps: immediateSteps,
    recommended_message:
      "Temos um alerta prioritario ativo. Por favor, valide a situacao agora, informe a acao tomada e registre o retorno no sistema.",
    preventive_actions: [
      "Revisar recorrencia no fechamento do turno.",
      "Confirmar cobertura de equipe para os proximos horarios.",
      "Acompanhar se o mesmo motivo reaparece nos proximos dias.",
    ],
    confirmation_required: true,
    apply_note: {
      title: `IA - ${targetTitle}`.slice(0, 120),
      content,
      category: "IA operacional",
      priority: priorityForSeverity(severity),
      status: "in_review",
    },
  }
}

async function fetchContext(
  supabase: ReturnType<typeof createClient>,
  profile: UserProfile,
  branchId: string | null,
  question?: string | null
) {
  const today = todayInSaoPaulo()
  const todayStart = todayStartInSaoPauloISO(today)
  const recentSince = thirtyDaysAgoISO()
  const branchScoped = (query: any) => (branchId ? query.eq("branch_id", branchId) : query)
  const nullableBranchScoped = (query: any) =>
    branchId ? query.or(`branch_id.is.null,branch_id.eq.${branchId}`) : query
  const requestedTime = parseQuestionTime(question)
  const requestedPost = parsePostQuestion(question)

  let statusesQuery = supabase
    .from("operational_status")
    .select("id, branch_id, employee_id, schedule_id, current_status, priority_level, delay_minutes, status_reason, updated_at, branches(name), employees(name, role, sectors(name)), schedules(work_date, start_time, break_start, break_end, end_time)")
    .eq("organization_id", profile.organization_id)
    .order("priority_level", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(80)

  let eventsQuery = supabase
    .from("attendance_events")
    .select("id, branch_id, employee_id, schedule_id, event_type, event_time, notes, branches(name), employees(name, sectors(name))")
    .eq("organization_id", profile.organization_id)
    .gte("event_time", recentSince)
    .order("event_time", { ascending: false })
    .limit(200)

  let schedulesQuery = supabase
    .from("schedules")
    .select("id, branch_id, employee_id, work_date, start_time, break_start, break_end, end_time, status, notes, branches(name), employees(name, role, sectors(name))")
    .eq("organization_id", profile.organization_id)
    .eq("work_date", today)
    .order("start_time", { ascending: true, nullsFirst: false })
    .limit(120)

  const schedulesAllBranchesQuery = supabase
    .from("schedules")
    .select("id, branch_id, employee_id, work_date, start_time, break_start, break_end, end_time, status, branches(name), employees(name)")
    .eq("organization_id", profile.organization_id)
    .eq("work_date", today)
    .order("start_time", { ascending: true, nullsFirst: false })
    .limit(200)

  let checklistRunsQuery = supabase
    .from("checklist_runs")
    .select("status, notes, started_at, completed_at, created_at, branches(name), checklist_procedures(title, category, frequency)")
    .eq("organization_id", profile.organization_id)
    .gte("created_at", recentSince)
    .order("created_at", { ascending: false })
    .limit(120)

  let employeesQuery = supabase
    .from("employees")
    .select("id, branch_id, sector_id, name, role, active, branches(name), sectors(name)")
    .eq("organization_id", profile.organization_id)
    .order("active", { ascending: false })
    .order("name")
    .limit(200)

  let postsQuery = supabase
    .from("operational_posts")
    .select("id, branch_id, sector_id, name, type, active, branches(name), sectors(name)")
    .eq("organization_id", profile.organization_id)
    .eq("active", true)
    .order("name")
    .limit(120)

  let allocationsQuery = supabase
    .from("post_allocations")
    .select("id, branch_id, post_id, employee_id, schedule_id, status, started_at, ended_at, operational_posts(name), employees(name), schedules(work_date, start_time, end_time)")
    .eq("organization_id", profile.organization_id)
    .is("ended_at", null)
    .in("status", ["alocado", "aguardando_troca", "em_troca"])
    .order("started_at", { ascending: false })
    .limit(200)

  let queueSignalsQuery = supabase
    .from("operational_queue")
    .select("id, branch_id, post_id, sector_id, queue_type, severity, status, title, customer_count, wait_minutes, required_posts, active_posts, notes, created_at, resolved_at, operational_posts(name, type), sectors(name)")
    .eq("organization_id", profile.organization_id)
    .in("status", ["open", "monitoring"])
    .order("created_at", { ascending: false })
    .limit(80)

  let branchesQuery = supabase
    .from("branches")
    .select("id, name, city, state, active")
    .eq("organization_id", profile.organization_id)
    .order("active", { ascending: false })
    .order("name")
    .limit(80)

  let sectorsQuery = supabase
    .from("sectors")
    .select("id, branch_id, name, active, branches(name)")
    .eq("organization_id", profile.organization_id)
    .order("active", { ascending: false })
    .order("name")
    .limit(160)

  let settingsQuery = supabase
    .from("operational_settings")
    .select("branch_id, mode, late_tolerance_minutes, break_tolerance_minutes, require_cashier_cash_count, require_coverage_before_break, block_break_on_peak_hours, require_responsible_presence, queue_attention_threshold, queue_critical_threshold, cash_count_alert_amount")
    .eq("organization_id", profile.organization_id)
    .limit(80)

  let dashboardQuery = supabase
    .from("v_operational_dashboard")
    .select("*")
    .eq("organization_id", profile.organization_id)
    .eq("work_date", today)
    .order("priority_level", { ascending: false })
    .order("start_time", { ascending: true, nullsFirst: false })
    .limit(160)

  let notesQuery = supabase
    .from("operational_notes")
    .select("id, branch_id, sector_id, title, category, priority, status, due_at, created_at, updated_at, branches(name), sectors(name)")
    .eq("organization_id", profile.organization_id)
    .eq("active", true)
    .in("status", ["open", "in_review"])
    .order("created_at", { ascending: false })
    .limit(80)

  let formsQuery = supabase
    .from("operational_forms")
    .select("id, branch_id, sector_id, title, category, active, created_at, branches(name), sectors(name)")
    .eq("organization_id", profile.organization_id)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(80)

  let formResponsesQuery = supabase
    .from("operational_form_responses")
    .select("id, form_id, branch_id, notes, submitted_at, branches(name), operational_forms(title, category)")
    .eq("organization_id", profile.organization_id)
    .gte("submitted_at", recentSince)
    .order("submitted_at", { ascending: false })
    .limit(80)

  let postersQuery = supabase
    .from("operational_posters")
    .select("id, branch_id, sector_id, title, tone, format, product_name, price_text, active, updated_at, branches(name), sectors(name)")
    .eq("organization_id", profile.organization_id)
    .eq("active", true)
    .order("updated_at", { ascending: false })
    .limit(50)

  let commsPostsQuery = supabase
    .from("comms_posts")
    .select("id, branch_id, sector_id, title, content, pinned, created_at, branches(name), sectors(name)")
    .eq("organization_id", profile.organization_id)
    .gte("created_at", recentSince)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(60)

  const trainingItemsQuery = supabase
    .from("training_items")
    .select("id, title, type, duration_minutes, active, created_at")
    .eq("organization_id", profile.organization_id)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(80)

  let deliveriesQuery = supabase
    .from("delivery_orders")
    .select("id, branch_id, assigned_employee_id, source, status, priority, customer_name, neighborhood, city, total_amount, payment_status, scheduled_for, estimated_delivery_at, dispatched_at, delivered_at, created_at, branches(name), employees(name)")
    .eq("organization_id", profile.organization_id)
    .gte("created_at", recentSince)
    .order("created_at", { ascending: false })
    .limit(120)

  let customersQuery = supabase
    .from("customers")
    .select("id, branch_id, customer_code, name, status, city, neighborhood, marketing_opt_in, created_at, updated_at, branches(name)")
    .eq("organization_id", profile.organization_id)
    .order("updated_at", { ascending: false })
    .limit(120)

  let cashSessionsQuery = supabase
    .from("cash_sessions")
    .select("id, branch_id, post_id, user_profile_id, employee_id, opened_at, closed_at, expected_amount, final_amount, difference_amount, status, branches(name), operational_posts(name), employees(name)")
    .eq("organization_id", profile.organization_id)
    .gte("opened_at", recentSince)
    .order("opened_at", { ascending: false })
    .limit(80)

  let salesTodayQuery = supabase
    .from("sales")
    .select("id, branch_id, cash_session_id, post_id, employee_id, customer_name, subtotal, discount_amount, total_amount, status, sale_mode, sold_at, branches(name), employees(name)")
    .eq("organization_id", profile.organization_id)
    .gte("sold_at", todayStart)
    .order("sold_at", { ascending: false })
    .limit(120)

  let productionOrdersQuery = supabase
    .from("production_orders")
    .select("id, branch_id, order_code, customer_name, status, priority, ordered_at, promised_at, created_at, branches(name)")
    .eq("organization_id", profile.organization_id)
    .gte("created_at", recentSince)
    .order("created_at", { ascending: false })
    .limit(100)

  let fiscalDocumentsQuery = supabase
    .from("fiscal_documents")
    .select("id, branch_id, sale_id, doc_type, status, operation_mode, series, number, sefaz_rejection_reason, issued_at, cancelled_at, branches(name)")
    .eq("organization_id", profile.organization_id)
    .gte("issued_at", recentSince)
    .order("issued_at", { ascending: false })
    .limit(100)

  let productsQuery = supabase
    .from("products")
    .select("id, branch_id, category_id, name, product_kind, category, brand, price, stock_quantity, min_stock_quantity, track_inventory, active, branches(name), product_categories(name)")
    .eq("organization_id", profile.organization_id)
    .eq("active", true)
    .order("stock_quantity", { ascending: true })
    .limit(120)

  let productCategoriesQuery = supabase
    .from("product_categories")
    .select("id, branch_id, name, segment, active, branches(name)")
    .eq("organization_id", profile.organization_id)
    .eq("active", true)
    .order("name")
    .limit(80)

  let auditLogsQuery = supabase
    .from("audit_logs")
    .select("id, branch_id, user_id, action, entity_type, entity_id, created_at, branches(name)")
    .eq("organization_id", profile.organization_id)
    .gte("created_at", recentSince)
    .order("created_at", { ascending: false })
    .limit(120)

  let directScheduleQuery = requestedTime
    ? supabase
        .from("schedules")
        .select("id, branch_id, employee_id, work_date, start_time, break_start, break_end, end_time, status, notes, branches(name), employees(name, role, sectors(name))")
        .eq("organization_id", profile.organization_id)
        .eq("work_date", today)
        .eq("start_time", requestedTime.value)
        .order("start_time", { ascending: true, nullsFirst: false })
        .limit(50)
    : null

  let directPostsQuery = requestedPost
    ? supabase
        .from("operational_posts")
        .select("id, branch_id, sector_id, name, type, active, branches(name), sectors(name)")
        .eq("organization_id", profile.organization_id)
        .eq("active", true)
        .ilike("name", `%${requestedPost.term}%`)
        .order("name")
        .limit(20)
    : null

  if (branchId) {
    statusesQuery = statusesQuery.eq("branch_id", branchId)
    eventsQuery = eventsQuery.eq("branch_id", branchId)
    schedulesQuery = schedulesQuery.eq("branch_id", branchId)
    checklistRunsQuery = checklistRunsQuery.eq("branch_id", branchId)
    employeesQuery = employeesQuery.eq("branch_id", branchId)
    postsQuery = postsQuery.eq("branch_id", branchId)
    allocationsQuery = allocationsQuery.eq("branch_id", branchId)
    queueSignalsQuery = queueSignalsQuery.eq("branch_id", branchId)
    branchesQuery = branchesQuery.eq("id", branchId)
    sectorsQuery = sectorsQuery.eq("branch_id", branchId)
    settingsQuery = settingsQuery.or(`branch_id.is.null,branch_id.eq.${branchId}`)
    dashboardQuery = dashboardQuery.eq("branch_id", branchId)
    notesQuery = nullableBranchScoped(notesQuery)
    formsQuery = nullableBranchScoped(formsQuery)
    formResponsesQuery = nullableBranchScoped(formResponsesQuery)
    postersQuery = nullableBranchScoped(postersQuery)
    commsPostsQuery = nullableBranchScoped(commsPostsQuery)
    deliveriesQuery = branchScoped(deliveriesQuery)
    customersQuery = nullableBranchScoped(customersQuery)
    cashSessionsQuery = branchScoped(cashSessionsQuery)
    salesTodayQuery = branchScoped(salesTodayQuery)
    productionOrdersQuery = branchScoped(productionOrdersQuery)
    fiscalDocumentsQuery = branchScoped(fiscalDocumentsQuery)
    productsQuery = nullableBranchScoped(productsQuery)
    productCategoriesQuery = nullableBranchScoped(productCategoriesQuery)
    auditLogsQuery = nullableBranchScoped(auditLogsQuery)
    directScheduleQuery = directScheduleQuery?.eq("branch_id", branchId) ?? null
    directPostsQuery = directPostsQuery?.eq("branch_id", branchId) ?? null
  }

  const [
    statuses,
    events,
    schedules,
    checklistRuns,
    employees,
    posts,
    allocations,
    queueSignals,
    branches,
    sectors,
    settings,
    dashboardRows,
    notes,
    forms,
    formResponses,
    posters,
    commsPosts,
    trainingItems,
    deliveries,
    customers,
    cashSessions,
    salesToday,
    productionOrders,
    fiscalDocuments,
    products,
    productCategories,
    auditLogs,
    directSchedules,
    directPosts,
    schedulesAllBranches,
  ] = await Promise.all([
    statusesQuery,
    eventsQuery,
    schedulesQuery,
    checklistRunsQuery,
    employeesQuery,
    postsQuery,
    allocationsQuery,
    queueSignalsQuery,
    branchesQuery,
    sectorsQuery,
    settingsQuery,
    dashboardQuery,
    notesQuery,
    formsQuery,
    formResponsesQuery,
    postersQuery,
    commsPostsQuery,
    trainingItemsQuery,
    deliveriesQuery,
    customersQuery,
    cashSessionsQuery,
    salesTodayQuery,
    productionOrdersQuery,
    fiscalDocumentsQuery,
    productsQuery,
    productCategoriesQuery,
    auditLogsQuery,
    directScheduleQuery ?? Promise.resolve({ data: [], error: null }),
    directPostsQuery ?? Promise.resolve({ data: [], error: null }),
    schedulesAllBranchesQuery,
  ])

  const errors = [
    statuses.error,
    events.error,
    schedules.error,
    checklistRuns.error,
    employees.error,
    branches.error,
    sectors.error,
    settings.error,
  ]
    .filter(Boolean)
    .map((error) => error?.message)

  if (errors.length > 0) {
    throw new Error(errors.join(" | "))
  }

  const currentStatuses = (statuses.data ?? []).filter(
    (item: { schedules?: { work_date?: string | null } | null; updated_at?: string | null }) => {
      const scheduleDate = item.schedules?.work_date
      return scheduleDate === today || (!scheduleDate && isSameDateInSaoPaulo(item.updated_at, today))
    }
  )
  const queueSignalsData = optionalRows(queueSignals)
  const dashboardData = optionalRows(dashboardRows)
  const notesData = optionalRows(notes)
  const formsData = optionalRows(forms)
  const formResponsesData = optionalRows(formResponses)
  const postersData = optionalRows(posters)
  const commsPostsData = optionalRows(commsPosts)
  const trainingItemsData = optionalRows(trainingItems)
  const deliveriesData = optionalRows(deliveries)
  const customersData = optionalRows(customers)
  const cashSessionsData = optionalRows(cashSessions)
  const salesTodayData = optionalRows(salesToday)
  const productionOrdersData = optionalRows(productionOrders)
  const fiscalDocumentsData = optionalRows(fiscalDocuments)
  const productsData = optionalRows(products)
  const productCategoriesData = optionalRows(productCategories)
  const auditLogsData = optionalRows(auditLogs)
  const directSchedulesData = optionalRows(directSchedules)
  const schedulesAllBranchesData = optionalRows(schedulesAllBranches)
  const otherBranchScheduleRows = branchId
    ? schedulesAllBranchesData.filter((schedule: any) => schedule.branch_id !== branchId)
    : []
  const otherBranchIds = Array.from(
    new Set(
      otherBranchScheduleRows
        .map((schedule: any) => schedule.branch_id)
        .filter((id: unknown): id is string => typeof id === "string")
    )
  )
  const directPostsData = optionalRows(directPosts)
  const directPostIds = directPostsData
    .map((item: any) => item.id)
    .filter((id: unknown): id is string => typeof id === "string")
  const directAllocations =
    directPostIds.length > 0
      ? await branchScoped(
          supabase
            .from("post_allocations")
            .select("id, branch_id, post_id, employee_id, schedule_id, status, started_at, ended_at, operational_posts(name, type), employees(name, role, sectors(name)), schedules(work_date, start_time, break_start, break_end, end_time)")
            .eq("organization_id", profile.organization_id)
            .in("post_id", directPostIds)
            .is("ended_at", null)
            .in("status", ["alocado", "aguardando_troca", "em_troca"])
            .order("started_at", { ascending: false })
            .limit(20)
        )
      : { data: [], error: null }
  const directCashSessions =
    directPostIds.length > 0
      ? await branchScoped(
          supabase
            .from("cash_sessions")
            .select("id, branch_id, post_id, employee_id, user_profile_id, opened_at, expected_amount, status, operational_posts(name, type), employees(name, role, sectors(name)), user_profiles(name)")
            .eq("organization_id", profile.organization_id)
            .in("post_id", directPostIds)
            .eq("status", "open")
            .order("opened_at", { ascending: false })
            .limit(20)
        )
      : { data: [], error: null }
  const directAllocationsData = optionalRows(directAllocations)
  const directCashSessionsData = optionalRows(directCashSessions)
  const salesRows = salesTodayData.map((row) => row as Record<string, unknown>)
  const openDeliveryStatuses = ["pending", "preparing", "ready_for_dispatch", "out_for_delivery"]
  const openProductionStatuses = ["pending", "in_production"]
  const lowStockProducts = productsData.filter((item) => {
    const row = item as Record<string, unknown>
    return Boolean(row.track_inventory) && numericValue(row.stock_quantity) <= numericValue(row.min_stock_quantity)
  })
  const operationalPendingSummary = buildOperationalPendingSummary({
    workDate: today,
    schedules: schedules.data ?? [],
    statuses: currentStatuses,
    posts: posts.error ? [] : posts.data ?? [],
    allocations: allocations.error ? [] : allocations.data ?? [],
    cashSessions: cashSessionsData,
    deliveries: deliveriesData,
    productionOrders: productionOrdersData,
    queueSignals: queueSignalsData,
  })

  return {
    branch_id: branchId,
    generated_at: new Date().toISOString(),
    work_date: today,
    profile: {
      name: profile.name,
      role: profile.role,
    },
    status_counts: {
      total: currentStatuses.length,
      critical: currentStatuses.filter(
        (item) => item.current_status === "alerta_critico" || item.priority_level >= 70
      ).length,
      working: currentStatuses.filter((item) =>
        [
          "trabalhando",
          "voltou",
          "pico",
          "apoio_operacional",
          "fechamento",
        ].includes(item.current_status)
      ).length,
      delayed: currentStatuses.filter((item) => item.delay_minutes > 0).length,
    },
    recent_event_counts: {
      total: events.data?.length ?? 0,
      delays: (events.data ?? []).filter((item) => item.event_type === "atraso_detectado").length,
      absences: (events.data ?? []).filter((item) => item.event_type === "falta_detectada").length,
    },
    employee_counts: {
      total: employees.data?.length ?? 0,
      active: (employees.data ?? []).filter((item) => item.active).length,
    },
    organization_counts: {
      branches: branches.data?.length ?? 0,
      active_branches: (branches.data ?? []).filter((item) => item.active).length,
      sectors: sectors.data?.length ?? 0,
      active_sectors: (sectors.data ?? []).filter((item) => item.active).length,
    },
    dashboard_counts: {
      rows: dashboardData.length,
      critical: countRows(
        dashboardData,
        (item: any) => item.current_status === "alerta_critico" || numericValue(item.priority_level) >= 70
      ),
      delayed: countRows(dashboardData, (item: any) => numericValue(item.delay_minutes) > 0),
      waiting: countRows(dashboardData, (item: any) => item.current_status === "aguardando_evento"),
    },
    schedule_scope: {
      branch_id: branchId,
      selected_branch_schedules: schedules.data?.length ?? 0,
      all_branches_schedules: schedulesAllBranchesData.length,
      other_branches_schedules: otherBranchScheduleRows.length,
      other_branch_ids: otherBranchIds.slice(0, 8),
    },
    support_counts: {
      open_notes: countRows(notesData, (item: any) => item.status === "open"),
      urgent_notes: countRows(notesData, (item: any) => item.priority === "urgent"),
      active_forms: formsData.length,
      recent_form_responses: formResponsesData.length,
      active_posters: postersData.length,
      recent_comms_posts: commsPostsData.length,
      pinned_comms_posts: countRows(commsPostsData, (item: any) => Boolean(item.pinned)),
      active_training_items: trainingItemsData.length,
      recent_audit_logs: auditLogsData.length,
      open_queue_signals: queueSignalsData.length,
      critical_queue_signals: countRows(queueSignalsData, (item: any) => item.severity === "critical"),
    },
    delivery_counts: {
      total_recent: deliveriesData.length,
      open: countRows(deliveriesData, (item: any) => openDeliveryStatuses.includes(item.status)),
      pending: countRows(deliveriesData, (item: any) => item.status === "pending"),
      out_for_delivery: countRows(deliveriesData, (item: any) => item.status === "out_for_delivery"),
      urgent: countRows(deliveriesData, (item: any) => item.priority === "urgent"),
      failed: countRows(deliveriesData, (item: any) => item.status === "failed"),
    },
    customer_counts: {
      sampled: customersData.length,
      active: countRows(customersData, (item: any) => item.status === "active"),
      blocked: countRows(customersData, (item: any) => item.status === "blocked"),
      inactive: countRows(customersData, (item: any) => item.status === "inactive"),
    },
    pos_counts: {
      open_cash_sessions: countRows(cashSessionsData, (item: any) => item.status === "open"),
      cash_sessions_recent: cashSessionsData.length,
      sales_today: salesTodayData.length,
      sales_total_today: Number(sumRows(salesRows, "total_amount").toFixed(2)),
      cancelled_sales_today: countRows(salesTodayData, (item: any) => item.status === "cancelled"),
      production_open: countRows(productionOrdersData, (item: any) => openProductionStatuses.includes(item.status)),
      production_urgent: countRows(productionOrdersData, (item: any) => item.priority === "urgent"),
      fiscal_pending: countRows(
        fiscalDocumentsData,
        (item: any) =>
          item.status !== "cancelled" &&
          (item.status === "draft" ||
            item.operation_mode === "sefaz_pending" ||
            item.operation_mode === "sefaz_rejected")
      ),
      low_stock_products: lowStockProducts.length,
      active_product_categories: productCategoriesData.length,
    },
    direct_lookup_counts: {
      requested_time: requestedTime?.display ?? null,
      schedule_matches: directSchedulesData.length,
      requested_post: requestedPost?.label ?? null,
      post_matches: directPostsData.length,
      active_allocations: directAllocationsData.length,
      open_cash_sessions: directCashSessionsData.length,
    },
    tools: {
      branches: compactRows(branches.data ?? [], 40),
      sectors: compactRows(sectors.data ?? [], 80),
      operational_settings: compactRows(settings.data ?? [], 20),
      operational_pending_summary: operationalPendingSummary,
      dashboard_today: compactRows(dashboardData, 60),
      operational_status: compactRows(currentStatuses, 30),
      recent_events: compactRows(events.data ?? [], 50),
      schedules_today: compactRows(schedules.data ?? [], 50),
      schedules_today_all_branches: compactRows(schedulesAllBranchesData, 50),
      checklist_runs: compactRows(checklistRuns.data ?? [], 30),
      employees: compactRows(employees.data ?? [], 60),
      operational_posts: compactRows(posts.error ? [] : posts.data ?? [], 80),
      active_allocations: compactRows(allocations.error ? [] : allocations.data ?? [], 80),
      operational_queue: compactRows(queueSignalsData, 50),
      operational_notes: compactRows(notesData, 40),
      operational_forms: compactRows(formsData, 40),
      operational_form_responses: compactRows(formResponsesData, 30),
      operational_posters: compactRows(postersData, 30),
      comms_posts: compactRows(commsPostsData, 30),
      training_items: compactRows(trainingItemsData, 30),
      delivery_orders: compactRows(deliveriesData, 50),
      customers: compactRows(customersData, 50),
      cash_sessions: compactRows(cashSessionsData, 30),
      sales_today: compactRows(salesTodayData, 50),
      production_orders: compactRows(productionOrdersData, 40),
      fiscal_documents: compactRows(fiscalDocumentsData, 40),
      products_low_stock_first: compactRows(productsData, 50),
      product_categories: compactRows(productCategoriesData, 30),
      audit_logs: compactRows(auditLogsData, 50),
      direct_lookup: {
        requested_time: requestedTime?.display ?? null,
        requested_post: requestedPost,
        schedule_entries_at_time: compactRows(directSchedulesData, 30),
        posts_matching_request: compactRows(directPostsData, 20),
        active_post_allocations: compactRows(directAllocationsData, 20),
        open_cash_sessions: compactRows(directCashSessionsData, 20),
      },
    },
    optional_errors: [
      optionalError("operational_posts", posts),
      optionalError("post_allocations", allocations),
      optionalError("operational_queue", queueSignals),
      optionalError("v_operational_dashboard", dashboardRows),
      optionalError("operational_notes", notes),
      optionalError("operational_forms", forms),
      optionalError("operational_form_responses", formResponses),
      optionalError("operational_posters", posters),
      optionalError("comms_posts", commsPosts),
      optionalError("training_items", trainingItems),
      optionalError("delivery_orders", deliveries),
      optionalError("customers", customers),
      optionalError("cash_sessions", cashSessions),
      optionalError("sales", salesToday),
      optionalError("production_orders", productionOrders),
      optionalError("fiscal_documents", fiscalDocuments),
      optionalError("products", products),
      optionalError("product_categories", productCategories),
      optionalError("audit_logs", auditLogs),
      optionalError("direct_schedules", directSchedules),
      optionalError("direct_posts", directPosts),
      optionalError("schedules_all_branches", schedulesAllBranches),
      optionalError("direct_post_allocations", directAllocations),
      optionalError("direct_cash_sessions", directCashSessions),
    ].filter(Boolean),
  }
}

type AgentContext = Awaited<ReturnType<typeof fetchContext>>
type DataRow = Record<string, unknown>

function asRow(value: unknown): DataRow {
  return value && typeof value === "object" ? (value as DataRow) : {}
}

function readString(row: DataRow, key: string) {
  const value = row[key]
  return typeof value === "string" ? value : null
}

function readNumber(row: DataRow, key: string) {
  return numericValue(row[key])
}

function readBoolean(row: DataRow, key: string) {
  return typeof row[key] === "boolean" ? row[key] : false
}

function readArray(row: DataRow, key: string) {
  const value = row[key]
  return Array.isArray(value) ? value : []
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : []
}

function relationName(row: DataRow, key: string) {
  const relation = row[key]
  if (Array.isArray(relation)) {
    return relationName(asRow(relation[0]), "name")
  }

  if (relation && typeof relation === "object") {
    return readString(relation as DataRow, "name")
  }

  return null
}

function trimText(value: string | null, maxLength = 140) {
  if (!value) return null
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value
}

function buildModelContext(context: AgentContext) {
  const branches = (context.tools.branches as unknown[]).map(asRow)
  const sectors = (context.tools.sectors as unknown[]).map(asRow)
  const settings = (context.tools.operational_settings as unknown[]).map(asRow)
  const pendingSummary = asRow(context.tools.operational_pending_summary)
  const dashboard = (context.tools.dashboard_today as unknown[]).map(asRow)
  const statuses = (context.tools.operational_status as unknown[]).map(asRow)
  const events = (context.tools.recent_events as unknown[]).map(asRow)
  const schedules = (context.tools.schedules_today as unknown[]).map(asRow)
  const schedulesAllBranches = (context.tools.schedules_today_all_branches as unknown[]).map(asRow)
  const checklists = (context.tools.checklist_runs as unknown[]).map(asRow)
  const posts = (context.tools.operational_posts as unknown[]).map(asRow)
  const allocations = (context.tools.active_allocations as unknown[]).map(asRow)
  const queueSignals = (context.tools.operational_queue as unknown[]).map(asRow)
  const notes = (context.tools.operational_notes as unknown[]).map(asRow)
  const forms = (context.tools.operational_forms as unknown[]).map(asRow)
  const formResponses = (context.tools.operational_form_responses as unknown[]).map(asRow)
  const posters = (context.tools.operational_posters as unknown[]).map(asRow)
  const commsPosts = (context.tools.comms_posts as unknown[]).map(asRow)
  const trainingItems = (context.tools.training_items as unknown[]).map(asRow)
  const deliveries = (context.tools.delivery_orders as unknown[]).map(asRow)
  const customers = (context.tools.customers as unknown[]).map(asRow)
  const cashSessions = (context.tools.cash_sessions as unknown[]).map(asRow)
  const salesToday = (context.tools.sales_today as unknown[]).map(asRow)
  const productionOrders = (context.tools.production_orders as unknown[]).map(asRow)
  const fiscalDocuments = (context.tools.fiscal_documents as unknown[]).map(asRow)
  const products = (context.tools.products_low_stock_first as unknown[]).map(asRow)
  const productCategories = (context.tools.product_categories as unknown[]).map(asRow)
  const auditLogs = (context.tools.audit_logs as unknown[]).map(asRow)
  const directLookup = asRow(context.tools.direct_lookup)
  const directSchedules = readArray(directLookup, "schedule_entries_at_time").map(asRow)
  const directPosts = readArray(directLookup, "posts_matching_request").map(asRow)
  const directAllocations = readArray(directLookup, "active_post_allocations").map(asRow)
  const directCashSessions = readArray(directLookup, "open_cash_sessions").map(asRow)

  return {
    branch_id: context.branch_id,
    generated_at: context.generated_at,
    work_date: context.work_date,
    profile: context.profile,
    status_counts: context.status_counts,
    recent_event_counts: context.recent_event_counts,
    employee_counts: context.employee_counts,
    organization_counts: context.organization_counts,
    dashboard_counts: context.dashboard_counts,
    schedule_scope: context.schedule_scope,
    support_counts: context.support_counts,
    delivery_counts: context.delivery_counts,
    customer_counts: context.customer_counts,
    pos_counts: context.pos_counts,
    direct_lookup_counts: context.direct_lookup_counts,
    action_capabilities: [
      {
        tool_name: "generate_delay_report",
        mode: "execute_auto",
        description: "Gera relatorio de atrasos recentes sem mudar dados operacionais.",
      },
      {
        tool_name: "allocate_post",
        mode: "execute_with_confirmation",
        description: "Prepara alocacao de colaborador em posto quando houver escala do dia; gravacao exige confirmacao humana.",
      },
    ],
    tools: {
      branches: branches.slice(0, 12).map((branch) => ({
        id: readString(branch, "id"),
        name: readString(branch, "name"),
        city: readString(branch, "city"),
        state: readString(branch, "state"),
        active: readBoolean(branch, "active"),
      })),
      sectors: sectors.slice(0, 20).map((sector) => ({
        id: readString(sector, "id"),
        branch_id: readString(sector, "branch_id"),
        name: readString(sector, "name"),
        branch: relationName(sector, "branches"),
        active: readBoolean(sector, "active"),
      })),
      operational_settings: settings.slice(0, 8).map((setting) => ({
        branch_id: readString(setting, "branch_id"),
        mode: readString(setting, "mode"),
        late_tolerance_minutes: readNumber(setting, "late_tolerance_minutes"),
        break_tolerance_minutes: readNumber(setting, "break_tolerance_minutes"),
        require_cashier_cash_count: readBoolean(setting, "require_cashier_cash_count"),
        require_coverage_before_break: readBoolean(setting, "require_coverage_before_break"),
        block_break_on_peak_hours: readBoolean(setting, "block_break_on_peak_hours"),
        require_responsible_presence: readBoolean(setting, "require_responsible_presence"),
        queue_attention_threshold: readNumber(setting, "queue_attention_threshold"),
        queue_critical_threshold: readNumber(setting, "queue_critical_threshold"),
        cash_count_alert_amount: readNumber(setting, "cash_count_alert_amount"),
      })),
      operational_pending_summary: {
        total_alerts: readNumber(pendingSummary, "total_alerts"),
        has_alerts: readBoolean(pendingSummary, "has_alerts"),
        groups: readArray(pendingSummary, "groups").map((group) => {
          const row = asRow(group)
          return {
            key: readString(row, "key"),
            title: readString(row, "title"),
            count: readNumber(row, "count"),
            alert: readBoolean(row, "alert"),
            examples: readArray(row, "examples").slice(0, 3),
          }
        }),
      },
      dashboard_today: dashboard.slice(0, 18).map((row) => ({
        branch_id: readString(row, "branch_id"),
        employee_id: readString(row, "employee_id"),
        employee: readString(row, "employee_name"),
        employee_role: readString(row, "employee_role"),
        sector: readString(row, "sector_name"),
        branch: readString(row, "branch_name"),
        status: readString(row, "current_status"),
        priority: readNumber(row, "priority_level"),
        delay: readNumber(row, "delay_minutes"),
        start_time: readString(row, "start_time"),
        break_start: readString(row, "break_start"),
        break_end: readString(row, "break_end"),
        end_time: readString(row, "end_time"),
        reason: trimText(readString(row, "status_reason"), 100),
      })),
      operational_status: statuses.slice(0, 12).map((status) => ({
        id: readString(status, "id"),
        branch_id: readString(status, "branch_id"),
        employee_id: readString(status, "employee_id"),
        schedule_id: readString(status, "schedule_id"),
        status: readString(status, "current_status"),
        priority: status.priority_level,
        delay: status.delay_minutes,
        reason: trimText(readString(status, "status_reason")),
        branch: relationName(status, "branches"),
        employee: relationName(status, "employees"),
        updated_at: readString(status, "updated_at"),
      })),
      recent_events: events.slice(0, 18).map((event) => ({
        type: readString(event, "event_type"),
        time: readString(event, "event_time"),
        branch: relationName(event, "branches"),
        employee: relationName(event, "employees"),
        notes: trimText(readString(event, "notes"), 100),
      })),
      schedules_today: schedules.slice(0, 18).map((schedule) => ({
        id: readString(schedule, "id"),
        employee_id: readString(schedule, "employee_id"),
        status: readString(schedule, "status"),
        start_time: readString(schedule, "start_time"),
        break_start: readString(schedule, "break_start"),
        break_end: readString(schedule, "break_end"),
        end_time: readString(schedule, "end_time"),
        branch: relationName(schedule, "branches"),
        employee: relationName(schedule, "employees"),
      })),
      schedules_today_all_branches: schedulesAllBranches.slice(0, 18).map((schedule) => ({
        id: readString(schedule, "id"),
        branch_id: readString(schedule, "branch_id"),
        status: readString(schedule, "status"),
        start_time: readString(schedule, "start_time"),
        branch: relationName(schedule, "branches"),
        employee: relationName(schedule, "employees"),
      })),
      checklist_runs: checklists.slice(0, 8).map((run) => ({
        status: readString(run, "status"),
        branch: relationName(run, "branches"),
        created_at: readString(run, "created_at"),
        completed_at: readString(run, "completed_at"),
      })),
      operational_posts: posts.slice(0, 18).map((post) => ({
        id: readString(post, "id"),
        branch_id: readString(post, "branch_id"),
        name: readString(post, "name"),
        type: readString(post, "type"),
        branch: relationName(post, "branches"),
        sector: relationName(post, "sectors"),
      })),
      active_allocations: allocations.slice(0, 18).map((allocation) => ({
        id: readString(allocation, "id"),
        post_id: readString(allocation, "post_id"),
        employee_id: readString(allocation, "employee_id"),
        status: readString(allocation, "status"),
        post: relationName(allocation, "operational_posts"),
        employee: relationName(allocation, "employees"),
      })),
      operational_queue: queueSignals.slice(0, 18).map((signal) => ({
        id: readString(signal, "id"),
        branch_id: readString(signal, "branch_id"),
        post_id: readString(signal, "post_id"),
        queue_type: readString(signal, "queue_type"),
        severity: readString(signal, "severity"),
        status: readString(signal, "status"),
        title: trimText(readString(signal, "title"), 90),
        customer_count: readNumber(signal, "customer_count"),
        wait_minutes: readNumber(signal, "wait_minutes"),
        post: relationName(signal, "operational_posts"),
        sector: relationName(signal, "sectors"),
      })),
      operational_notes: notes.slice(0, 12).map((note) => ({
        id: readString(note, "id"),
        branch_id: readString(note, "branch_id"),
        title: trimText(readString(note, "title"), 90),
        category: readString(note, "category"),
        priority: readString(note, "priority"),
        status: readString(note, "status"),
        due_at: readString(note, "due_at"),
        branch: relationName(note, "branches"),
        sector: relationName(note, "sectors"),
        created_at: readString(note, "created_at"),
      })),
      operational_forms: forms.slice(0, 10).map((form) => ({
        id: readString(form, "id"),
        branch_id: readString(form, "branch_id"),
        title: trimText(readString(form, "title"), 90),
        category: readString(form, "category"),
        branch: relationName(form, "branches"),
        sector: relationName(form, "sectors"),
        created_at: readString(form, "created_at"),
      })),
      operational_form_responses: formResponses.slice(0, 8).map((response) => ({
        form_id: readString(response, "form_id"),
        branch_id: readString(response, "branch_id"),
        form: relationName(response, "operational_forms") ?? readString(asRow(response.operational_forms), "title"),
        branch: relationName(response, "branches"),
        submitted_at: readString(response, "submitted_at"),
        notes: trimText(readString(response, "notes"), 100),
      })),
      operational_posters: posters.slice(0, 8).map((poster) => ({
        id: readString(poster, "id"),
        branch_id: readString(poster, "branch_id"),
        title: trimText(readString(poster, "title"), 90),
        tone: readString(poster, "tone"),
        format: readString(poster, "format"),
        product_name: trimText(readString(poster, "product_name"), 70),
        price_text: readString(poster, "price_text"),
        branch: relationName(poster, "branches"),
        sector: relationName(poster, "sectors"),
      })),
      comms_posts: commsPosts.slice(0, 8).map((post) => ({
        id: readString(post, "id"),
        branch_id: readString(post, "branch_id"),
        title: trimText(readString(post, "title"), 90),
        content: trimText(readString(post, "content"), 140),
        pinned: readBoolean(post, "pinned"),
        branch: relationName(post, "branches"),
        sector: relationName(post, "sectors"),
        created_at: readString(post, "created_at"),
      })),
      training_items: trainingItems.slice(0, 8).map((item) => ({
        id: readString(item, "id"),
        title: trimText(readString(item, "title"), 90),
        type: readString(item, "type"),
        duration_minutes: readNumber(item, "duration_minutes"),
      })),
      delivery_orders: deliveries.slice(0, 14).map((delivery) => ({
        id: readString(delivery, "id"),
        branch_id: readString(delivery, "branch_id"),
        status: readString(delivery, "status"),
        priority: readString(delivery, "priority"),
        source: readString(delivery, "source"),
        customer: trimText(readString(delivery, "customer_name"), 80),
        neighborhood: readString(delivery, "neighborhood"),
        city: readString(delivery, "city"),
        total_amount: readNumber(delivery, "total_amount"),
        payment_status: readString(delivery, "payment_status"),
        scheduled_for: readString(delivery, "scheduled_for"),
        estimated_delivery_at: readString(delivery, "estimated_delivery_at"),
        dispatched_at: readString(delivery, "dispatched_at"),
        delivered_at: readString(delivery, "delivered_at"),
        branch: relationName(delivery, "branches"),
        assigned_employee: relationName(delivery, "employees"),
      })),
      customers: customers.slice(0, 10).map((customer) => ({
        id: readString(customer, "id"),
        branch_id: readString(customer, "branch_id"),
        code: readString(customer, "customer_code"),
        name: trimText(readString(customer, "name"), 80),
        status: readString(customer, "status"),
        city: readString(customer, "city"),
        neighborhood: readString(customer, "neighborhood"),
        branch: relationName(customer, "branches"),
        updated_at: readString(customer, "updated_at"),
      })),
      cash_sessions: cashSessions.slice(0, 8).map((session) => ({
        id: readString(session, "id"),
        branch_id: readString(session, "branch_id"),
        status: readString(session, "status"),
        opened_at: readString(session, "opened_at"),
        closed_at: readString(session, "closed_at"),
        expected_amount: readNumber(session, "expected_amount"),
        final_amount: readNumber(session, "final_amount"),
        difference_amount: readNumber(session, "difference_amount"),
        branch: relationName(session, "branches"),
        post: relationName(session, "operational_posts"),
        employee: relationName(session, "employees"),
      })),
      sales_today: salesToday.slice(0, 12).map((sale) => ({
        id: readString(sale, "id"),
        branch_id: readString(sale, "branch_id"),
        status: readString(sale, "status"),
        sale_mode: readString(sale, "sale_mode"),
        total_amount: readNumber(sale, "total_amount"),
        sold_at: readString(sale, "sold_at"),
        branch: relationName(sale, "branches"),
        employee: relationName(sale, "employees"),
      })),
      production_orders: productionOrders.slice(0, 10).map((order) => ({
        id: readString(order, "id"),
        branch_id: readString(order, "branch_id"),
        code: readString(order, "order_code"),
        customer: trimText(readString(order, "customer_name"), 80),
        status: readString(order, "status"),
        priority: readString(order, "priority"),
        ordered_at: readString(order, "ordered_at"),
        promised_at: readString(order, "promised_at"),
        branch: relationName(order, "branches"),
      })),
      fiscal_documents: fiscalDocuments.slice(0, 10).map((document) => ({
        id: readString(document, "id"),
        branch_id: readString(document, "branch_id"),
        doc_type: readString(document, "doc_type"),
        status: readString(document, "status"),
        operation_mode: readString(document, "operation_mode"),
        number: readNumber(document, "number"),
        rejection: trimText(readString(document, "sefaz_rejection_reason"), 100),
        issued_at: readString(document, "issued_at"),
        branch: relationName(document, "branches"),
      })),
      products_low_stock_first: products.slice(0, 14).map((product) => ({
        id: readString(product, "id"),
        branch_id: readString(product, "branch_id"),
        name: trimText(readString(product, "name"), 80),
        kind: readString(product, "product_kind"),
        category: relationName(product, "product_categories") ?? readString(product, "category"),
        brand: readString(product, "brand"),
        price: readNumber(product, "price"),
        stock_quantity: readNumber(product, "stock_quantity"),
        min_stock_quantity: readNumber(product, "min_stock_quantity"),
        track_inventory: readBoolean(product, "track_inventory"),
        branch: relationName(product, "branches"),
      })),
      product_categories: productCategories.slice(0, 10).map((category) => ({
        id: readString(category, "id"),
        branch_id: readString(category, "branch_id"),
        name: readString(category, "name"),
        segment: readString(category, "segment"),
        branch: relationName(category, "branches"),
      })),
      audit_logs: auditLogs.slice(0, 12).map((log) => ({
        action: readString(log, "action"),
        entity_type: readString(log, "entity_type"),
        entity_id: readString(log, "entity_id"),
        branch: relationName(log, "branches"),
        created_at: readString(log, "created_at"),
      })),
      direct_lookup: {
        requested_time: readString(directLookup, "requested_time"),
        requested_post: directLookup.requested_post ?? null,
        schedule_entries_at_time: directSchedules.slice(0, 20).map((schedule) => ({
          id: readString(schedule, "id"),
          branch_id: readString(schedule, "branch_id"),
          employee_id: readString(schedule, "employee_id"),
          status: readString(schedule, "status"),
          start_time: readString(schedule, "start_time"),
          break_start: readString(schedule, "break_start"),
          break_end: readString(schedule, "break_end"),
          end_time: readString(schedule, "end_time"),
          branch: relationName(schedule, "branches"),
          employee: relationName(schedule, "employees"),
        })),
        posts_matching_request: directPosts.slice(0, 10).map((post) => ({
          id: readString(post, "id"),
          branch_id: readString(post, "branch_id"),
          name: readString(post, "name"),
          type: readString(post, "type"),
          branch: relationName(post, "branches"),
          sector: relationName(post, "sectors"),
        })),
        active_post_allocations: directAllocations.slice(0, 10).map((allocation) => ({
          id: readString(allocation, "id"),
          post_id: readString(allocation, "post_id"),
          employee_id: readString(allocation, "employee_id"),
          status: readString(allocation, "status"),
          started_at: readString(allocation, "started_at"),
          post: relationName(allocation, "operational_posts"),
          employee: relationName(allocation, "employees"),
        })),
        open_cash_sessions: directCashSessions.slice(0, 10).map((session) => ({
          id: readString(session, "id"),
          post_id: readString(session, "post_id"),
          employee_id: readString(session, "employee_id"),
          status: readString(session, "status"),
          opened_at: readString(session, "opened_at"),
          post: relationName(session, "operational_posts"),
          employee: relationName(session, "employees") ?? relationName(session, "user_profiles"),
        })),
      },
    },
    compacted: true,
    omitted_rows_note:
      "Contexto enviado ao modelo foi resumido para evitar limite de tokens; a funcao mantem dados completos para acoes locais.",
  }
}

function actionArgs(args?: AgentActionArguments | null): Required<AgentActionArguments> {
  return {
    ...emptyActionArguments(),
    branch_id: args?.branch_id ?? null,
    post_id: args?.post_id ?? null,
    employee_id: args?.employee_id ?? null,
    schedule_id: args?.schedule_id ?? null,
    notes: args?.notes ?? null,
    period_days: typeof args?.period_days === "number" ? args.period_days : null,
  }
}

function buildDelayReportActionPlan(context: AgentContext) {
  const args = actionArgs({
    branch_id: context.branch_id,
    period_days: 30,
    notes: "Relatorio gerado pelo Unyx AI Agent.",
  })

  return {
    mode: "execute_auto" as AgentActionMode,
    tool_name: "generate_delay_report" as AgentActionTool,
    title: "Gerar relatorio de atrasos",
    description:
      "Consolidar atrasos recentes por colaborador e listar os eventos mais recentes.",
    confidence: context.recent_event_counts.delays > 0 ? 0.88 : 0.72,
    confirmation_required: false,
    arguments: args,
    arguments_summary: `Filial: ${context.branch_id ?? "todas"} | periodo: ultimos 30 dias`,
  }
}

function buildDelayReportActionResult(context: AgentContext) {
  const delayEvents = (context.tools.recent_events as unknown[])
    .map(asRow)
    .filter((event) => readString(event, "event_type") === "atraso_detectado")

  const employeeMap = new Map<
    string,
    { name: string; branch: string; count: number; lastEvent: string }
  >()

  for (const event of delayEvents) {
    const employeeId = readString(event, "employee_id") ?? relationName(event, "employees") ?? "desconhecido"
    const previous = employeeMap.get(employeeId)
    const eventTime = readString(event, "event_time") ?? ""
    employeeMap.set(employeeId, {
      name: relationName(event, "employees") ?? "Colaborador",
      branch: relationName(event, "branches") ?? "Filial",
      count: (previous?.count ?? 0) + 1,
      lastEvent: previous?.lastEvent && previous.lastEvent > eventTime ? previous.lastEvent : eventTime,
    })
  }

  const topEmployees = Array.from(employeeMap.values())
    .sort((a, b) => b.count - a.count || b.lastEvent.localeCompare(a.lastEvent))
    .slice(0, 5)

  const recentRows = delayEvents.slice(0, 10)
  const lines = [
    "Relatorio de atrasos",
    `Periodo: ultimos 30 dias ate ${context.work_date}`,
    `Total consultado: ${context.recent_event_counts.delays} atraso(s)`,
    `Eventos detalhados: ${delayEvents.length}`,
    "",
    "Top reincidencias:",
    ...(topEmployees.length > 0
      ? topEmployees.map(
          (item, index) =>
            `${index + 1}. ${item.name} - ${item.count} atraso(s) - ${item.branch}`
        )
      : ["Sem atrasos no periodo detalhado."]),
    "",
    "Eventos recentes:",
    ...(recentRows.length > 0
      ? recentRows.map((event) => {
          const time = readString(event, "event_time") ?? "-"
          const employee = relationName(event, "employees") ?? "Colaborador"
          const branch = relationName(event, "branches") ?? "Filial"
          const notes = readString(event, "notes")
          return `- ${time} | ${employee} | ${branch}${notes ? ` | ${notes}` : ""}`
        })
      : ["Sem eventos para listar."]),
  ]

  return {
    status: "executed" as AgentActionStatus,
    tool_name: "generate_delay_report" as AgentActionTool,
    title: "Relatorio de atrasos gerado",
    message:
      context.recent_event_counts.delays > 0
        ? `Relatorio gerado com ${context.recent_event_counts.delays} atraso(s) recentes.`
        : "Relatorio gerado sem atrasos recentes.",
    artifact_markdown: lines.join("\n"),
  }
}

function buildAllocationCandidate(context: AgentContext, requestedArgs?: AgentActionArguments | null) {
  const requested = actionArgs(requestedArgs)
  const posts = (context.tools.operational_posts as unknown[]).map(asRow)
  const allocations = (context.tools.active_allocations as unknown[]).map(asRow)
  const statuses = (context.tools.operational_status as unknown[]).map(asRow)

  const allocatedPostIds = new Set(allocations.map((item) => readString(item, "post_id")).filter(Boolean))
  const allocatedEmployeeIds = new Set(allocations.map((item) => readString(item, "employee_id")).filter(Boolean))

  const post =
    posts.find((item) => readString(item, "id") === requested.post_id) ??
    posts.find((item) => {
      const postId = readString(item, "id")
      return Boolean(postId && !allocatedPostIds.has(postId))
    })

  const employeeStatus =
    statuses.find((item) => readString(item, "employee_id") === requested.employee_id) ??
    statuses.find((item) => {
      const employeeId = readString(item, "employee_id")
      return (
        readString(item, "current_status") === "trabalhando" &&
        Boolean(employeeId && !allocatedEmployeeIds.has(employeeId))
      )
    })

  const postId = requested.post_id ?? readString(post ?? {}, "id")
  const employeeId = requested.employee_id ?? readString(employeeStatus ?? {}, "employee_id")
  const scheduleId = requested.schedule_id ?? readString(employeeStatus ?? {}, "schedule_id")
  const postName = relationName(post ?? {}, "operational_posts") ?? readString(post ?? {}, "name")
  const employeeName = relationName(employeeStatus ?? {}, "employees")

  return {
    postId,
    employeeId,
    scheduleId,
    postName,
    employeeName,
    branchId: requested.branch_id ?? context.branch_id ?? readString(post ?? {}, "branch_id"),
  }
}

function buildAllocationActionPlan(context: AgentContext, requestedArgs?: AgentActionArguments | null) {
  const scheduleScope = asRow(context.schedule_scope)
  const selectedBranchScheduleCount = readNumber(scheduleScope, "selected_branch_schedules")
  const scheduleCount = Math.max(
    asArray(context.tools.schedules_today).length,
    selectedBranchScheduleCount
  )
  if (scheduleCount === 0) {
    const otherBranchScheduleCount = readNumber(scheduleScope, "other_branches_schedules")
    const hasScheduleInOtherBranch = otherBranchScheduleCount > 0
    return {
      mode: "suggest" as AgentActionMode,
      tool_name: null as AgentActionTool | null,
      title: hasScheduleInOtherBranch ? "Conferir filial selecionada" : "Criar escala do dia",
      description:
        hasScheduleInOtherBranch
          ? `Nao ha escala hoje na filial selecionada, mas existem ${otherBranchScheduleCount} escala(s) em outra(s) filial(is). Selecione a filial correta ou importe a escala para esta filial antes de propor alocacao.`
          : "Nao ha escala cadastrada para hoje. Copie a ultima escala valida ou importe a escala do dia antes de propor alocacao.",
      confidence: 0.9,
      confirmation_required: false,
      arguments: actionArgs({
        branch_id: context.branch_id,
        notes: hasScheduleInOtherBranch
          ? "Escala ausente na filial selecionada; alocacao bloqueada ate conferir a filial correta."
          : "Escala do dia ausente; alocacao bloqueada ate a escala ser criada.",
      }),
      arguments_summary: "Sem escala do dia para vincular colaborador, horario e posto.",
    }
  }

  const candidate = buildAllocationCandidate(context, requestedArgs)
  const hasCandidate = Boolean(candidate.postId && candidate.employeeId)
  const args = actionArgs({
    branch_id: candidate.branchId ?? context.branch_id,
    post_id: candidate.postId,
    employee_id: candidate.employeeId,
    schedule_id: candidate.scheduleId,
    notes: "Alocacao confirmada pelo Unyx AI Agent com revisao humana.",
  })

  return {
    mode: hasCandidate ? "execute_with_confirmation" as AgentActionMode : "suggest" as AgentActionMode,
    tool_name: "allocate_post" as AgentActionTool,
    title: hasCandidate ? "Alocar colaborador em posto" : "Alocacao precisa de dados",
    description: hasCandidate
      ? `Proposta: ${candidate.employeeName ?? "colaborador selecionado"} em ${candidate.postName ?? "posto sem cobertura"}.`
      : "Nao encontrei simultaneamente um posto ativo sem cobertura e um colaborador trabalhando sem alocacao.",
    confidence: hasCandidate ? 0.78 : 0.35,
    confirmation_required: true,
    arguments: args,
    arguments_summary: hasCandidate
      ? `Posto: ${candidate.postName ?? candidate.postId} | Colaborador: ${candidate.employeeName ?? candidate.employeeId}`
      : "Sem candidato suficiente para executar.",
  }
}

function actionToolFromQuestion(question: string | null, action?: AgentActionRequest | null): AgentActionTool | null {
  if (action?.tool_name) return action.tool_name
  const normalized = question
    ?.normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()

  if (!normalized) return null
  if (normalized.includes("aloca")) return "allocate_post"
  if (normalized.includes("atras") || normalized.includes("relatorio")) return "generate_delay_report"
  return null
}

async function executeAgentAction(
  supabase: ReturnType<typeof createClient>,
  context: AgentContext,
  question: string | null,
  action?: AgentActionRequest | null
) {
  const tool = actionToolFromQuestion(question, action)

  if (!tool) {
    const plan =
      context.recent_event_counts.delays > 0
        ? buildDelayReportActionPlan(context)
        : emptyActionPlan()

    return {
      action_plan: plan,
      action_result: emptyActionResult(),
    }
  }

  if (tool === "generate_delay_report") {
    return {
      action_plan: buildDelayReportActionPlan(context),
      action_result: buildDelayReportActionResult(context),
    }
  }

  const plan = buildAllocationActionPlan(context, action?.arguments)
  const args = plan.arguments

  if (!args.post_id || !args.employee_id) {
    return {
      action_plan: plan,
      action_result: {
        status: "blocked" as AgentActionStatus,
        tool_name: "allocate_post" as AgentActionTool,
        title: "Alocacao bloqueada",
        message:
          plan.tool_name === null
            ? plan.description
            : "Nao ha dados suficientes para alocar com seguranca. Cadastre postos, confirme presenca e tente novamente.",
        artifact_markdown: "",
      },
    }
  }

  if (!action?.confirmed) {
    return {
      action_plan: plan,
      action_result: {
        status: "pending_confirmation" as AgentActionStatus,
        tool_name: "allocate_post" as AgentActionTool,
        title: "Confirmacao necessaria",
        message:
          "A alocacao esta pronta, mas precisa de confirmacao humana antes de gravar no sistema.",
        artifact_markdown: plan.arguments_summary,
      },
    }
  }

  const { data, error } = await supabase.rpc("allocate_post", {
    p_post_id: args.post_id,
    p_employee_id: args.employee_id,
    p_schedule_id: args.schedule_id,
    p_notes: args.notes,
  })

  if (error) {
    return {
      action_plan: plan,
      action_result: {
        status: "failed" as AgentActionStatus,
        tool_name: "allocate_post" as AgentActionTool,
        title: "Falha ao alocar",
        message: error.message,
        artifact_markdown: "",
      },
    }
  }

  const allocationId = readString(asRow(data), "id") ?? "sem_id"

  return {
    action_plan: plan,
    action_result: {
      status: "executed" as AgentActionStatus,
      tool_name: "allocate_post" as AgentActionTool,
      title: "Alocacao realizada",
      message: "O colaborador foi alocado no posto selecionado.",
      artifact_markdown: `Alocacao: ${allocationId}\n${plan.arguments_summary}`,
    },
  }
}

function buildDirectLookupAnswer(context: AgentContext) {
  const lookup = asRow(context.tools.direct_lookup)
  const requestedTime = readString(lookup, "requested_time")
  const requestedPost = asRow(lookup.requested_post)
  const scheduleEntries = readArray(lookup, "schedule_entries_at_time").map(asRow)
  const posts = readArray(lookup, "posts_matching_request").map(asRow)
  const allocations = readArray(lookup, "active_post_allocations").map(asRow)
  const cashSessions = readArray(lookup, "open_cash_sessions").map(asRow)

  if (requestedTime) {
    if (scheduleEntries.length === 0) {
      return `Nao encontrei nenhum colaborador com entrada marcada hoje as ${requestedTime}.`
    }

    const people = scheduleEntries
      .map((schedule) => {
        const employee = relationName(schedule, "employees") ?? "Colaborador"
        const branch = relationName(schedule, "branches")
        const role = readString(asRow(schedule.employees), "role")
        const details = [role, branch].filter(Boolean).join(" - ")
        return details ? `${employee} (${details})` : employee
      })
      .join(", ")

    return `Hoje as ${requestedTime} entra(m): ${people}.`
  }

  if (readString(requestedPost, "label")) {
    const label = readString(requestedPost, "label")
    if (posts.length === 0) {
      return `Nao encontrei posto cadastrado para ${label}.`
    }

    const allocationPeople = allocations.map((allocation) => ({
      source: "alocacao",
      employee: relationName(allocation, "employees"),
      post: relationName(allocation, "operational_posts"),
      since: readString(allocation, "started_at"),
    }))
    const cashPeople = cashSessions.map((session) => ({
      source: "caixa aberto",
      employee: relationName(session, "employees") ?? relationName(session, "user_profiles"),
      post: relationName(session, "operational_posts"),
      since: readString(session, "opened_at"),
    }))
    const people = [...allocationPeople, ...cashPeople].filter((item) => item.employee)

    if (people.length === 0) {
      const postNames = posts.map((post) => readString(post, "name")).filter(Boolean).join(", ")
      return `Encontrei ${postNames || label}, mas nao ha alocacao ativa nem caixa aberto vinculado agora.`
    }

    const details = people
      .map((item) => {
        const since = item.since ? ` desde ${item.since}` : ""
        return `${item.employee} em ${item.post ?? label} (${item.source}${since})`
      })
      .join(", ")

    return `No ${label}, encontrei: ${details}.`
  }

  return null
}

function fallbackInsight(
  context: AgentContext,
  question: string | null,
  intent: AgentIntent,
  target: AgentTarget | null,
  actionPlan = emptyActionPlan(),
  actionResult = emptyActionResult()
) {
  const critical = context.status_counts.critical
  const delays = context.recent_event_counts.delays
  const absences = context.recent_event_counts.absences
  const urgentNotes = context.support_counts.urgent_notes
  const openDeliveries = context.delivery_counts.open
  const urgentDeliveries = context.delivery_counts.urgent
  const openProduction = context.pos_counts.production_open
  const fiscalPending = context.pos_counts.fiscal_pending
  const lowStockProducts = context.pos_counts.low_stock_products
  const pendingSummary = asRow(context.tools.operational_pending_summary)
  const pendingGroups = readArray(pendingSummary, "groups").map(asRow)
  const pendingAlerts = readNumber(pendingSummary, "total_alerts")
  const activePendingGroups = pendingGroups.filter(
    (group) => readBoolean(group, "alert") && readNumber(group, "count") > 0
  )
  const scheduleScope = asRow(context.schedule_scope)
  const otherBranchScheduleCount = readNumber(scheduleScope, "other_branches_schedules")
  const selectedBranchScheduleCount = readNumber(scheduleScope, "selected_branch_schedules")
  const scheduleCount = Math.max(
    asArray(context.tools.schedules_today).length,
    selectedBranchScheduleCount
  )
  const activeEmployees = context.employee_counts.active
  const missingSchedulesToday = scheduleCount === 0 && activeEmployees > 0
  const schedulesExistInOtherBranch = missingSchedulesToday && otherBranchScheduleCount > 0
  const severity: AgentSeverity =
    critical > 0
      ? "critico"
      : missingSchedulesToday || pendingAlerts >= 3 || urgentNotes > 0 || urgentDeliveries > 0 || delays >= 3 || absences >= 2
        ? "alto"
        : pendingAlerts > 0 || delays > 0 || openDeliveries > 0 || openProduction > 0 || lowStockProducts > 0
          ? "medio"
          : "normal"
  const targetSeverity = target?.severity ?? severity
  const plannedAction =
    actionPlan.mode === "none" && delays > 0
      ? buildDelayReportActionPlan(context)
      : actionPlan
  const directAnswer = question ? buildDirectLookupAnswer(context) : null
  const risks = [
    {
      title: "Risco operacional atual",
      severity,
      reason:
        critical > 0
          ? "Ha status criticos ou prioridade elevada no painel operacional."
          : "Nao foram encontrados status criticos nos dados atuais.",
      evidence: `${critical} status critico(s), ${delays} atraso(s), ${absences} falta(s), ${urgentNotes} anotacao(oes) urgente(s), ${openDeliveries} entrega(s) aberta(s) e ${openProduction} pedido(s) de producao aberto(s).`,
      action:
        critical > 0
          ? "Validar os status criticos e acionar o responsavel da filial."
          : "Manter acompanhamento e revisar recorrencias no fim do turno.",
      confidence: 0.72,
    },
    ...(missingSchedulesToday
      ? [
          {
            title: schedulesExistInOtherBranch
              ? "Escala ausente na filial selecionada"
              : "Escala do dia ausente",
            severity: "alto" as AgentSeverity,
            reason: schedulesExistInOtherBranch
              ? "A filial selecionada nao tem escala hoje, mas ha escala cadastrada em outra filial."
              : "Nao ha escala cadastrada para hoje no contexto operacional.",
            evidence: schedulesExistInOtherBranch
              ? `0 escala(s) na filial selecionada e ${otherBranchScheduleCount} escala(s) em outra(s) filial(is).`
              : `0 escala(s) para hoje e ${activeEmployees} colaborador(es) ativo(s).`,
            action: schedulesExistInOtherBranch
              ? "Conferir a filial selecionada no topo ou copiar/importar a escala para a filial correta."
              : "Copiar a ultima escala valida ou importar a escala do dia antes de avaliar atrasos e cobertura.",
            confidence: 0.86,
          },
        ]
      : []),
    ...(urgentNotes > 0
      ? [
          {
            title: "Anotacoes urgentes abertas",
            severity: "alto" as AgentSeverity,
            reason: "Existem pendencias de frente de loja classificadas como urgentes.",
            evidence: `${urgentNotes} anotacao(oes) urgente(s) em aberto ou revisao.`,
            action: "Abrir anotacoes operacionais e definir responsavel antes do proximo pico.",
            confidence: 0.7,
          },
        ]
      : []),
    ...(urgentDeliveries > 0 || openDeliveries > 0
      ? [
          {
            title: "Fila de entregas",
            severity: urgentDeliveries > 0 ? "alto" as AgentSeverity : "medio" as AgentSeverity,
            reason: "Ha pedidos de entrega recentes ainda em fluxo.",
            evidence: `${openDeliveries} entrega(s) aberta(s), ${urgentDeliveries} urgente(s).`,
            action: "Conferir preparo, despacho e entregador alocado para pedidos pendentes.",
            confidence: 0.68,
          },
        ]
      : []),
    ...(pendingAlerts > 0
      ? [
          {
            title: "Pendencias operacionais",
            severity: pendingAlerts >= 3 ? "alto" as AgentSeverity : "medio" as AgentSeverity,
            reason: "O painel de Operacao encontrou pendencias acionaveis para o turno.",
            evidence:
              activePendingGroups
                .map((group) => `${readString(group, "title")}: ${readNumber(group, "count")}`)
                .join(", ") || `${pendingAlerts} pendencia(s) operacional(is).`,
            action: "Abrir Operacao e tratar as pendencias por prioridade antes do proximo pico.",
            confidence: 0.78,
          },
        ]
      : []),
    ...(lowStockProducts > 0
      ? [
          {
            title: "Produtos com estoque baixo",
            severity: "medio" as AgentSeverity,
            reason: "A lista de produtos ativos mostra itens no minimo ou abaixo do minimo configurado.",
            evidence: `${lowStockProducts} produto(s) no limite de estoque.`,
            action: "Validar reposicao ou ajustar disponibilidade antes de novas vendas.",
            confidence: 0.66,
          },
        ]
      : []),
  ]
  const passiveActionTitle =
    missingSchedulesToday
      ? schedulesExistInOtherBranch
        ? "Conferir filial selecionada"
        : "Gerar escala do dia"
      : critical > 0
      ? "Atuar nos status criticos"
      : pendingAlerts > 0
        ? "Tratar pendencias operacionais"
      : urgentNotes > 0
        ? "Priorizar anotacoes urgentes"
        : openDeliveries > 0
          ? "Revisar fila de entregas"
          : openProduction > 0
            ? "Acompanhar producao"
            : fiscalPending > 0
              ? "Conferir documentos fiscais"
            : "Acompanhar operacao"
  const passiveActionDescription =
    missingSchedulesToday
      ? schedulesExistInOtherBranch
        ? "A filial selecionada esta sem escala hoje, mas ha escala em outra filial. Confira se a filial do topo e a correta."
        : "Copie a ultima escala valida ou importe a escala de hoje para corrigir Dashboard, Operacoes e leitura da IA."
      : critical > 0
      ? "Abra o painel operacional e confirme a acao para cada alerta critico."
      : pendingAlerts > 0
        ? "Abra a tela Operacao e resolva entradas atrasadas, intervalos a liberar, intervalos vencidos, postos descobertos ou filas atrasadas."
      : urgentNotes > 0
        ? "Abra as anotacoes urgentes e defina responsavel para cada pendencia."
        : openDeliveries > 0
          ? "Confira pedidos pendentes, preparo, despacho e responsavel pela entrega."
          : openProduction > 0
            ? "Confira pedidos em producao e promessas de entrega."
            : fiscalPending > 0
              ? "Confira documentos em rascunho, pendentes ou rejeitados antes do fechamento."
              : "Continue monitorando atrasos, checklists, entregas, caixa e postos."

  return {
    summary:
      missingSchedulesToday
        ? "Nao ha escala cadastrada para hoje; a leitura operacional fica incompleta."
        : critical > 0
        ? `Existem ${critical} risco(s) critico(s) ativos na operacao.`
        : severity === "normal"
          ? "A operacao nao apresenta risco critico ativo neste momento."
          : "A operacao tem pontos de atencao fora do painel de presenca.",
    overall_severity: severity,
    risks: risks.slice(0, 6),
    recommendations: [
      ...(missingSchedulesToday
        ? [
            {
              title: schedulesExistInOtherBranch
                ? "Conferir filial da escala"
                : "Criar escala do dia",
              description: schedulesExistInOtherBranch
                ? "Existe escala hoje em outra filial. Valide se a filial selecionada e a mesma onde a escala foi importada."
                : "Copie a ultima escala valida ou importe a escala de hoje antes de analisar atrasos e cobertura.",
              owner: "Gestor da filial",
              priority: "alta",
              requires_confirmation: false,
            },
          ]
        : []),
      {
        title: "Revisar cobertura do turno",
        description: "Confira escala, presenca real e setores com prioridade alta antes do proximo pico.",
        owner: "Gestor da filial",
        priority: severity === "normal" ? "baixa" : "alta",
        requires_confirmation: false,
      },
      {
        title: "Cruzar operacao com entregas e caixa",
        description: "Confira pendencias da Operacao, entregas abertas, pedidos de producao, caixa aberto e produtos com estoque baixo.",
        owner: "Gestor da filial",
        priority: pendingAlerts > 0 || openDeliveries > 0 || openProduction > 0 || lowStockProducts > 0 ? "media" : "baixa",
        requires_confirmation: false,
      },
    ],
    next_action: {
      title:
        plannedAction.mode !== "none"
          ? plannedAction.title
          : passiveActionTitle,
      description:
        plannedAction.mode !== "none"
          ? plannedAction.description
          : passiveActionDescription,
      can_execute: plannedAction.mode !== "none" && plannedAction.tool_name !== null,
      tool_name: plannedAction.tool_name,
    },
    action_plan: plannedAction,
    action_result: actionResult,
    resolution:
      intent === "resolve"
        ? buildFallbackResolution(context, targetSeverity, target)
        : emptyResolution(),
    chat_answer: question
      ? directAnswer ??
        (missingSchedulesToday
          ? schedulesExistInOtherBranch
            ? `Nao ha escala na filial selecionada hoje, mas encontrei ${otherBranchScheduleCount} escala(s) em outra(s) filial(is). Confira a filial selecionada no topo para eu responder com seguranca.`
            : `Nao ha escala cadastrada para hoje. Com ${activeEmployees} colaborador(es) ativo(s), preciso da escala do dia para responder com seguranca sobre entradas, atrasos, cobertura e alocacoes.`
          : `Com os dados atuais, minha leitura e: ${critical} risco(s) critico(s), ${delays} atraso(s), ${absences} falta(s), ${openDeliveries} entrega(s) aberta(s), ${openProduction} pedido(s) em producao e ${lowStockProducts} produto(s) em estoque baixo.`)
      : "Clique em perguntar ao agente para aprofundar um ponto especifico.",
    tools_used: [
      "branches",
      "sectors",
      "operational_settings",
      "operational_pending_summary",
      "dashboard_today",
      "operational_status",
      "recent_events",
      "schedules_today",
      "schedules_today_all_branches",
      "checklist_runs",
      "employees",
      "operational_posts",
      "active_allocations",
      "operational_notes",
      "operational_forms",
      "operational_form_responses",
      "operational_posters",
      "comms_posts",
      "training_items",
      "delivery_orders",
      "customers",
      "cash_sessions",
      "sales_today",
      "production_orders",
      "fiscal_documents",
      "products_low_stock_first",
      "product_categories",
      "audit_logs",
      "direct_lookup",
    ],
  }
}

function sanitizeOpenAiError(value: unknown) {
  const error = (value as { error?: { code?: string; message?: string; type?: string } })?.error
  if (!error) return "erro_desconhecido"

  const raw = [error.code, error.type, error.message].filter(Boolean).join(" - ")
  return raw
    .replace(/sk-proj-[A-Za-z0-9_-]+/g, "sk-proj-***")
    .replace(/sk-[A-Za-z0-9_-]+/g, "sk-***")
    .slice(0, 260)
}

async function saveAgentSnapshot(
  supabase: ReturnType<typeof createClient>,
  profile: UserProfile,
  branchId: string | null,
  intent: AgentIntent,
  question: string | null,
  target: AgentTarget | null,
  insight: Record<string, unknown>
) {
  const actionResult = asRow(insight.action_result)
  const { error } = await supabase
    .from("ai_agent_snapshots")
    .insert({
      organization_id: profile.organization_id,
      branch_id: branchId,
      created_by: profile.id,
      intent,
      question,
      target,
      result: insight,
      provider: readString(insight, "provider"),
      model: readString(insight, "model"),
      action_tool: readString(actionResult, "tool_name"),
      action_status: readString(actionResult, "status"),
    })

  if (error) {
    console.warn("[ai-agent] snapshot not saved", error.message)
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Metodo nao permitido." }, 405)
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")
    const openaiKey = Deno.env.get("OPENAI_API_KEY")
    const openaiModel = Deno.env.get("OPENAI_MODEL") || "gpt-5.4-mini"
    const aiProviderMode = (Deno.env.get("AI_PROVIDER_MODE") || "local").toLowerCase()
    const authHeader = request.headers.get("Authorization") ?? ""
    const token = authHeader.replace("Bearer ", "")

    if (!supabaseUrl || !supabaseAnonKey) {
      return jsonResponse({ error: "Supabase nao configurado na funcao." }, 500)
    }

    if (!token) {
      return jsonResponse({ error: "Sessao obrigatoria." }, 401)
    }

    const payload = (await request.json().catch(() => ({}))) as AgentRequest
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    if (userError || !userData.user) {
      return jsonResponse({ error: "Sessao invalida." }, 401)
    }

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("id, auth_user_id, organization_id, branch_id, role, name, custom_permissions")
      .eq("auth_user_id", userData.user.id)
      .maybeSingle()

    if (profileError) throw profileError
    if (!profile) return jsonResponse({ error: "Perfil nao encontrado." }, 404)
    if (!canUseAi(profile as UserProfile)) {
      return jsonResponse({ error: "Sem permissao para usar o agente de IA." }, 403)
    }

    const question = payload.question?.trim() || null
    const branchId = scopedBranchId(profile as UserProfile, payload.branch_id)
    const context = await fetchContext(supabase, profile as UserProfile, branchId, question)
    const intent: AgentIntent =
      payload.intent === "resolve" ? "resolve" : payload.intent === "act" ? "act" : "analyze"
    const target = payload.target ?? null
    const requestedAction = payload.action ?? null
    const insightResponse = async (body: Record<string, unknown>) => {
      const directAnswer = buildDirectLookupAnswer(context)
      const responseBody = directAnswer
        ? {
            ...body,
            chat_answer: directAnswer,
            tools_used: Array.from(
              new Set([...(Array.isArray(body.tools_used) ? body.tools_used : []), "direct_lookup"])
            ),
          }
        : body
      await saveAgentSnapshot(
        supabase,
        profile as UserProfile,
        branchId,
        intent,
        question,
        target,
        responseBody
      )
      return jsonResponse(responseBody)
    }
    const directAnswer = buildDirectLookupAnswer(context)

    if (intent === "act") {
      const actionExecution = await executeAgentAction(supabase, context, question, requestedAction)

      return insightResponse({
        ...fallbackInsight(
          context,
          question,
          "analyze",
          target,
          actionExecution.action_plan,
          actionExecution.action_result
        ),
        provider: "local",
      })
    }

    if (directAnswer) {
      return insightResponse({
        ...fallbackInsight(context, question, intent, target),
        provider: "local",
        ai_mode: "direct_lookup",
      })
    }

    if (aiProviderMode === "local" || aiProviderMode === "off") {
      return insightResponse({
        ...fallbackInsight(context, question, intent, target),
        provider: "local",
        ai_mode: aiProviderMode,
      })
    }

    if (!openaiKey) {
      return insightResponse({
        ...fallbackInsight(context, question, intent, target),
        provider: "fallback",
        warning: "OPENAI_API_KEY nao configurada. Usando regras locais.",
      })
    }

    const modelContext = buildModelContext(context)
    const response = await fetch("https://api.openai.com/v1/responses", {
      body: JSON.stringify({
        model: openaiModel,
        max_output_tokens: 2200,
        input: [
          {
            role: "system",
            content:
              "Voce e o Unyx AI Agent, um agente operacional para varejo, food service e equipes de loja. Analise apenas os dados fornecidos. Considere colaboradores, horarios, dashboard, pendencias operacionais, notas, formularios, comunicados, entregas, clientes, caixa/PDV, producao, fiscal, estoque, auditoria e configuracoes quando vierem no contexto. Trate o fiscal como orquestrador da operacao: cobertura de PDVs, filas, intervalos, sangrias, trocas, apoio, redistribuicao, comunicacao e fechamento. Use context.tools.operational_pending_summary como resumo prioritario da tela Operacao: entradas atrasadas, intervalos a liberar, intervalos vencidos, postos sem cobertura, alocados sem escala, caixas abertos, entregas atrasadas e producao atrasada. Use context.tools.operational_queue para filas, gargalos e pedidos de apoio registrados pelo fiscal. Use context.schedule_scope para diferenciar falta de escala na organizacao de falta de escala apenas na filial selecionada; se houver escala em outra filial, diga isso explicitamente e recomende conferir a filial do topo. Se context.tools.direct_lookup trouxer resultado para horario, posto, PDV ou caixa perguntado pelo gestor, priorize essa consulta direta na resposta e nao responda por amostragem. Seja objetivo, pratico e conservador. Nao invente dados. Para action_plan use apenas generate_delay_report ou allocate_post. Relatorio de atrasos pode ser executado automaticamente; alocacao exige confirmacao humana e escala do dia em context.tools.schedules_today. Se nao houver escala do dia na filial selecionada, nao proponha allocate_post; recomende conferir a filial ou criar/copiar a escala primeiro. Nao diga que executou acoes quando intent nao for act. Quando intent for resolve, gere uma proposta aplicavel para o gestor revisar e registrar como tarefa operacional. Quando intent for analyze, deixe resolution.status como none. Responda em portugues do Brasil sem acentos problematicos quando possivel.",
          },
          {
            role: "user",
            content: JSON.stringify({
              task:
                intent === "resolve"
                  ? "Resolva de forma assistida o alvo priorizado. Gere diagnostico, passos imediatos, mensagem recomendada, prevencao e uma anotacao operacional pronta para registro. Nao execute mudancas reais."
                  : "Analise a operacao atual, identifique riscos, recomende acoes e responda a pergunta do gestor se existir. Preencha action_plan com uma acao permitida quando houver valor operacional claro; caso contrario use mode none. action_result deve ficar none.",
              intent,
              target,
              question,
              context: modelContext,
            }),
          },
        ],
        reasoning: { effort: "low" },
        text: {
          verbosity: "low",
          format: {
            type: "json_schema",
            name: "unyx_ai_agent_insight",
            strict: true,
            schema: insightSchema,
          },
        },
      }),
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    })

    const openaiData = await response.json()

    if (!response.ok) {
      console.error("[ai-agent] OpenAI error", openaiData)
      const reason = sanitizeOpenAiError(openaiData)
      return insightResponse({
        ...fallbackInsight(context, question, intent, target),
        provider: "fallback",
        warning: `OpenAI retornou erro (${reason}). Usando regras locais.`,
      })
    }

    const outputText =
      typeof openaiData.output_text === "string"
        ? openaiData.output_text
        : openaiData.output
          ?.flatMap((item: { content?: Array<{ text?: string }> }) => item.content ?? [])
          ?.map((content: { text?: string }) => content.text ?? "")
          ?.join("")

    if (!outputText) {
      return insightResponse({
        ...fallbackInsight(context, question, intent, target),
        provider: "fallback",
        warning: "Resposta vazia da OpenAI. Usando regras locais.",
      })
    }

    return insightResponse({
      ...JSON.parse(outputText),
      provider: "openai",
      model: openaiModel,
    })
  } catch (error) {
    console.error("[ai-agent] error", error)
    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel executar o agente de IA.",
      },
      500
    )
  }
})
