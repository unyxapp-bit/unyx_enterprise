import { createClient } from "https://esm.sh/@supabase/supabase-js@2.105.1"

type AgentSeverity = "normal" | "medio" | "alto" | "critico"

type AgentRequest = {
  branch_id?: string | null
  question?: string | null
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

async function fetchContext(
  supabase: ReturnType<typeof createClient>,
  profile: UserProfile,
  branchId: string | null
) {
  const today = todayInSaoPaulo()
  const recentSince = thirtyDaysAgoISO()

  let statusesQuery = supabase
    .from("operational_status")
    .select("current_status, priority_level, delay_minutes, status_reason, updated_at, branches(name), employees(name, role, sectors(name)), schedules(work_date, start_time, break_start, break_end, end_time)")
    .eq("organization_id", profile.organization_id)
    .order("priority_level", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(80)

  let eventsQuery = supabase
    .from("attendance_events")
    .select("event_type, event_time, notes, branches(name), employees(name, sectors(name))")
    .eq("organization_id", profile.organization_id)
    .gte("event_time", recentSince)
    .order("event_time", { ascending: false })
    .limit(200)

  let schedulesQuery = supabase
    .from("schedules")
    .select("work_date, start_time, break_start, break_end, end_time, status, notes, branches(name), employees(name, role, sectors(name))")
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
    .select("name, role, active, branches(name), sectors(name)")
    .eq("organization_id", profile.organization_id)
    .order("active", { ascending: false })
    .order("name")
    .limit(200)

  if (branchId) {
    statusesQuery = statusesQuery.eq("branch_id", branchId)
    eventsQuery = eventsQuery.eq("branch_id", branchId)
    schedulesQuery = schedulesQuery.eq("branch_id", branchId)
    checklistRunsQuery = checklistRunsQuery.eq("branch_id", branchId)
    employeesQuery = employeesQuery.eq("branch_id", branchId)
  }

  const [statuses, events, schedules, checklistRuns, employees] = await Promise.all([
    statusesQuery,
    eventsQuery,
    schedulesQuery,
    checklistRunsQuery,
    employeesQuery,
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
    },
  }
}

function fallbackInsight(context: Awaited<ReturnType<typeof fetchContext>>, question: string | null) {
  const critical = context.status_counts.critical
  const delays = context.recent_event_counts.delays
  const absences = context.recent_event_counts.absences
  const severity: AgentSeverity =
    critical > 0 ? "critico" : delays >= 3 || absences >= 2 ? "alto" : delays > 0 ? "medio" : "normal"

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
      title: critical > 0 ? "Atuar nos status criticos" : "Acompanhar operacao",
      description:
        critical > 0
          ? "Abra o painel operacional e confirme a acao para cada alerta critico."
          : "Continue monitorando atrasos e checklists pendentes.",
      can_execute: false,
      tool_name: null,
    },
    chat_answer: question
      ? `Com os dados atuais, minha leitura e: ${critical} risco(s) critico(s), ${delays} atraso(s) e ${absences} falta(s) recentes.`
      : "Clique em perguntar ao agente para aprofundar um ponto especifico.",
    tools_used: [
      "operational_status",
      "recent_events",
      "schedules_today",
      "checklist_runs",
      "employees",
    ],
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
    const openaiModel = Deno.env.get("OPENAI_MODEL") || "gpt-5.5"
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

    if (!openaiKey) {
      return jsonResponse({
        ...fallbackInsight(context, question),
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
              "Voce e o Unyx AI Agent, um agente operacional para varejo, food service e equipes de loja. Analise apenas os dados fornecidos. Seja objetivo, pratico e conservador. Nao invente dados. Nao diga que executou acoes. Acoes sensiveis exigem confirmacao humana. Responda em portugues do Brasil sem acentos problematicos quando possivel.",
          },
          {
            role: "user",
            content: JSON.stringify({
              task:
                "Analise a operacao atual, identifique riscos, recomende acoes e responda a pergunta do gestor se existir.",
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
      return jsonResponse({
        ...fallbackInsight(context, question),
        provider: "fallback",
        warning: "OpenAI indisponivel. Usando regras locais.",
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
        ...fallbackInsight(context, question),
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
