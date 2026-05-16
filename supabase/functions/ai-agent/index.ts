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

function todayInSaoPaulo() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
    year: "numeric",
  }).formatToParts(new Date())

  const year = parts.find((part) => part.type === "year")?.value
  const month = parts.find((part) => part.type === "month")?.value
  const day = parts.find((part) => part.type === "day")?.value

  return `${year}-${month}-${day}`
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
  branchId: string | null
) {
  const today = todayInSaoPaulo()
  const recentSince = thirtyDaysAgoISO()

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

  if (branchId) {
    statusesQuery = statusesQuery.eq("branch_id", branchId)
    eventsQuery = eventsQuery.eq("branch_id", branchId)
    schedulesQuery = schedulesQuery.eq("branch_id", branchId)
    checklistRunsQuery = checklistRunsQuery.eq("branch_id", branchId)
    employeesQuery = employeesQuery.eq("branch_id", branchId)
    postsQuery = postsQuery.eq("branch_id", branchId)
    allocationsQuery = allocationsQuery.eq("branch_id", branchId)
  }

  const [statuses, events, schedules, checklistRuns, employees, posts, allocations] = await Promise.all([
    statusesQuery,
    eventsQuery,
    schedulesQuery,
    checklistRunsQuery,
    employeesQuery,
    postsQuery,
    allocationsQuery,
  ])

  const errors = [statuses.error, events.error, schedules.error, checklistRuns.error, employees.error]
    .filter(Boolean)
    .map((error) => error?.message)

  if (errors.length > 0) {
    throw new Error(errors.join(" | "))
  }

  return {
    branch_id: branchId,
    generated_at: new Date().toISOString(),
    work_date: today,
    profile: {
      name: profile.name,
      role: profile.role,
    },
    status_counts: {
      total: statuses.data?.length ?? 0,
      critical: (statuses.data ?? []).filter(
        (item) => item.current_status === "alerta_critico" || item.priority_level >= 70
      ).length,
      working: (statuses.data ?? []).filter((item) => item.current_status === "trabalhando").length,
      delayed: (statuses.data ?? []).filter((item) => item.delay_minutes > 0).length,
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
    tools: {
      operational_status: compactRows(statuses.data ?? [], 30),
      recent_events: compactRows(events.data ?? [], 50),
      schedules_today: compactRows(schedules.data ?? [], 50),
      checklist_runs: compactRows(checklistRuns.data ?? [], 30),
      employees: compactRows(employees.data ?? [], 60),
      operational_posts: compactRows(posts.error ? [] : posts.data ?? [], 80),
      active_allocations: compactRows(allocations.error ? [] : allocations.data ?? [], 80),
    },
    optional_errors: [posts.error, allocations.error]
      .filter(Boolean)
      .map((error) => error?.message),
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
          "Nao ha dados suficientes para alocar com seguranca. Cadastre postos, confirme presenca e tente novamente.",
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
  const severity: AgentSeverity =
    critical > 0 ? "critico" : delays >= 3 || absences >= 2 ? "alto" : delays > 0 ? "medio" : "normal"
  const targetSeverity = target?.severity ?? severity
  const plannedAction =
    actionPlan.mode === "none" && delays > 0
      ? buildDelayReportActionPlan(context)
      : actionPlan

  return {
    summary:
      critical > 0
        ? `Existem ${critical} risco(s) critico(s) ativos na operacao.`
        : "A operacao nao apresenta risco critico ativo neste momento.",
    overall_severity: severity,
    risks: [
      {
        title: "Risco operacional atual",
        severity,
        reason:
          critical > 0
            ? "Ha status criticos ou prioridade elevada no painel operacional."
            : "Nao foram encontrados status criticos nos dados atuais.",
        evidence: `${critical} status critico(s), ${delays} atraso(s) e ${absences} falta(s) nos ultimos 30 dias.`,
        action:
          critical > 0
            ? "Validar os status criticos e acionar o responsavel da filial."
            : "Manter acompanhamento e revisar recorrencias no fim do turno.",
        confidence: 0.72,
      },
    ],
    recommendations: [
      {
        title: "Revisar cobertura do turno",
        description: "Confira escala, presença real e setores com prioridade alta antes do proximo pico.",
        owner: "Gestor da filial",
        priority: severity === "normal" ? "baixa" : "alta",
        requires_confirmation: false,
      },
    ],
    next_action: {
      title:
        plannedAction.mode !== "none"
          ? plannedAction.title
          : critical > 0
            ? "Atuar nos status criticos"
            : "Acompanhar operacao",
      description:
        plannedAction.mode !== "none"
          ? plannedAction.description
          : critical > 0
            ? "Abra o painel operacional e confirme a acao para cada alerta critico."
            : "Continue monitorando atrasos e checklists pendentes.",
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
      ? `Com os dados atuais, minha leitura e: ${critical} risco(s) critico(s), ${delays} atraso(s) e ${absences} falta(s) recentes.`
      : "Clique em perguntar ao agente para aprofundar um ponto especifico.",
    tools_used: [
      "operational_status",
      "recent_events",
      "schedules_today",
      "checklist_runs",
      "employees",
      "operational_posts",
      "active_allocations",
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

    const branchId = scopedBranchId(profile as UserProfile, payload.branch_id)
    const context = await fetchContext(supabase, profile as UserProfile, branchId)
    const question = payload.question?.trim() || null
    const intent: AgentIntent =
      payload.intent === "resolve" ? "resolve" : payload.intent === "act" ? "act" : "analyze"
    const target = payload.target ?? null
    const requestedAction = payload.action ?? null

    if (intent === "act") {
      const actionExecution = await executeAgentAction(supabase, context, question, requestedAction)

      return jsonResponse({
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

    if (!openaiKey) {
      return jsonResponse({
        ...fallbackInsight(context, question, intent, target),
        provider: "fallback",
        warning: "OPENAI_API_KEY nao configurada. Usando regras locais.",
      })
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      body: JSON.stringify({
        model: openaiModel,
        input: [
          {
            role: "system",
            content:
              "Voce e o Unyx AI Agent, um agente operacional para varejo, food service e equipes de loja. Analise apenas os dados fornecidos. Seja objetivo, pratico e conservador. Nao invente dados. Para action_plan use apenas generate_delay_report ou allocate_post. Relatorio de atrasos pode ser executado automaticamente; alocacao exige confirmacao humana. Nao diga que executou acoes quando intent nao for act. Quando intent for resolve, gere uma proposta aplicavel para o gestor revisar e registrar como tarefa operacional. Quando intent for analyze, deixe resolution.status como none. Responda em portugues do Brasil sem acentos problematicos quando possivel.",
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
              context,
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
      return jsonResponse({
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
      return jsonResponse({
        ...fallbackInsight(context, question, intent, target),
        provider: "fallback",
        warning: "Resposta vazia da OpenAI. Usando regras locais.",
      })
    }

    return jsonResponse({
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
