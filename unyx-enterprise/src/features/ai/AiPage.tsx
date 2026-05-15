import { useMemo, useState } from "react"
import type { FormEvent } from "react"
import {
  AlertTriangle,
  Bot,
  BrainCircuit,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Lightbulb,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
} from "lucide-react"

import { BentoGrid } from "@/components/bento/BentoGrid"
import { MetricCard } from "@/components/bento/MetricCard"
import { PageHeader } from "@/components/shared/PageHeader"
import { StateBlock } from "@/components/shared/StateBlock"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  useAiAgent,
  useAllEmployees,
  useCreateOperationalNote,
  useOperationalStatuses,
  useReportEvents,
} from "@/hooks/useUnyxData"
import { formatDateTimeBR } from "@/lib/format"
import { statusMeta } from "@/lib/status"
import type { AiAgentSeverity, AiAgentTarget } from "@/services/unyxApi"
import type { OperationalStatusRecord } from "@/types/domain"

function isRecent(dateISO: string, days: number) {
  const date = new Date(dateISO)
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  return date >= cutoff
}

function severityBadgeVariant(severity: AiAgentSeverity) {
  if (severity === "critico" || severity === "alto") return "destructive"
  if (severity === "medio") return "outline"
  return "default"
}

function isPrioritySeverity(severity: AiAgentSeverity) {
  return severity === "alto" || severity === "critico"
}

function severityFromStatus(status: OperationalStatusRecord): AiAgentSeverity {
  if (status.current_status === "alerta_critico" || status.priority_level >= 90) {
    return "critico"
  }

  if (status.priority_level >= 70) return "alto"
  if (status.priority_level >= 40 || status.delay_minutes > 0) return "medio"
  return "normal"
}

function targetFromStatus(status: OperationalStatusRecord): AiAgentTarget {
  const employee = status.employees?.name ?? "Colaborador"
  const branch = status.branches?.name ?? "Filial"
  const statusLabel = statusMeta[status.current_status]?.label ?? status.current_status

  return {
    id: status.id,
    branch_id: status.branch_id,
    title: `${employee} - ${statusLabel}`,
    severity: severityFromStatus(status),
    evidence: [
      `Filial: ${branch}`,
      `Prioridade: ${status.priority_level}`,
      status.delay_minutes > 0 ? `Atraso: ${status.delay_minutes} min` : null,
      status.status_reason ? `Motivo: ${status.status_reason}` : null,
    ]
      .filter(Boolean)
      .join(" | "),
    action:
      status.status_reason ??
      "Validar o alerta com o responsavel e registrar a acao operacional.",
  }
}

export function AiPage() {
  const statuses = useOperationalStatuses()
  const events = useReportEvents()
  const employees = useAllEmployees()
  const aiAgent = useAiAgent()
  const createNote = useCreateOperationalNote()
  const [question, setQuestion] = useState("")
  const [resolutionTarget, setResolutionTarget] = useState<AiAgentTarget | null>(null)

  const insights = useMemo(() => {
    const recentEvents = (events.data ?? []).filter((event) =>
      isRecent(event.event_time, 30)
    )
    const delays = recentEvents.filter(
      (event) => event.event_type === "atraso_detectado"
    )
    const absences = recentEvents.filter(
      (event) => event.event_type === "falta_detectada"
    )
    const critical = (statuses.data ?? []).filter(
      (status) =>
        status.current_status === "alerta_critico" || status.priority_level >= 70
    )
    const priorityTargets = critical
      .slice()
      .sort((a, b) => b.priority_level - a.priority_level)
      .slice(0, 6)
    const working = (statuses.data ?? []).filter(
      (status) => status.current_status === "trabalhando"
    )
    const breakCandidate = working
      .slice()
      .sort((a, b) => {
        const aTime = a.schedules?.start_time ?? "99:99"
        const bTime = b.schedules?.start_time ?? "99:99"
        return aTime.localeCompare(bTime)
      })[0]

    const employeeIssues: Record<string, { name: string; count: number }> = {}
    for (const event of [...delays, ...absences]) {
      if (!employeeIssues[event.employee_id]) {
        employeeIssues[event.employee_id] = {
          name: event.employees?.name ?? "Colaborador",
          count: 0,
        }
      }
      employeeIssues[event.employee_id].count += 1
    }
    const recurringEmployee = Object.values(employeeIssues).sort(
      (a, b) => b.count - a.count
    )[0]

    const activeEmployees = (employees.data ?? []).filter(
      (employee) => employee.active
    ).length

    const recommendations = [
      {
        title: "Risco operacional",
        severity: critical.length > 0 ? "alto" : "normal",
        description:
          critical.length > 0
            ? `${critical.length} status critico(s) precisam de acao no turno atual.`
            : "Nenhum status critico ativo no momento.",
      },
      {
        title: "Previsao de atraso",
        severity: delays.length >= 3 ? "medio" : "normal",
        description:
          delays.length >= 3
            ? `${delays.length} atraso(s) nos ultimos 30 dias indicam padrao para acompanhar.`
            : "Historico recente de atrasos ainda esta baixo.",
      },
      {
        title: "Sugestao de intervalo",
        severity: breakCandidate ? "normal" : "medio",
        description: breakCandidate
          ? `${breakCandidate.employees?.name ?? "Colaborador"} pode ser priorizado para intervalo pela ordem de entrada.`
          : "Sem colaborador trabalhando para sugerir intervalo agora.",
      },
      {
        title: "Pessoa recorrente",
        severity: recurringEmployee?.count >= 2 ? "medio" : "normal",
        description: recurringEmployee
          ? `${recurringEmployee.name} aparece em ${recurringEmployee.count} evento(s) de risco recente.`
          : "Nenhum colaborador com reincidencia relevante.",
      },
      {
        title: "Cobertura de equipe",
        severity: activeEmployees < 3 ? "medio" : "normal",
        description:
          activeEmployees < 3
            ? "Equipe ativa pequena para absorver falta ou atraso sem impacto."
            : "Base ativa suficiente para cobrir variacoes comuns.",
      },
    ]

    return {
      activeEmployees,
      absences: absences.length,
      breakCandidate,
      critical: critical.length,
      delays: delays.length,
      priorityTargets,
      recommendations,
    }
  }, [employees.data, events.data, statuses.data])

  const isDataLoading = statuses.isLoading || events.isLoading || employees.isLoading

  function runAgent(nextQuestion?: string | null) {
    setResolutionTarget(null)
    aiAgent.mutate({
      intent: "analyze",
      question: nextQuestion?.trim() || null,
    })
  }

  function resolveWithAi(target: AiAgentTarget) {
    setResolutionTarget(target)
    aiAgent.mutate({
      intent: "resolve",
      target,
      question: `Gerar plano de resolucao para: ${target.title ?? "prioridade operacional"}`,
    })
  }

  async function applyResolutionAsNote() {
    const resolution = aiAgent.data?.resolution
    if (!resolution || resolution.status !== "drafted") return

    await createNote.mutateAsync({
      branch_id: resolutionTarget?.branch_id ?? null,
      sector_id: null,
      title: resolution.apply_note.title,
      content: resolution.apply_note.content,
      category: resolution.apply_note.category,
      priority: resolution.apply_note.priority,
      status: resolution.apply_note.status,
      due_at: null,
    })
  }

  function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    runAgent(question)
  }

  return (
    <>
      <PageHeader
        title="Unyx AI"
        description="Leitura automatica dos dados operacionais para antecipar riscos e sugerir acoes."
        action={
          <Button
            type="button"
            onClick={() => runAgent(null)}
            disabled={isDataLoading || aiAgent.isPending}
          >
            <RefreshCw className={`size-4 ${aiAgent.isPending ? "animate-spin" : ""}`} />
            {aiAgent.isPending ? "Analisando..." : "Executar agente"}
          </Button>
        }
      />

      <div className="space-y-6 p-6">
        {isDataLoading ? (
          <StateBlock type="loading" title="Gerando insights" />
        ) : statuses.isError ? (
          <StateBlock
            type="error"
            title="Erro ao carregar status"
            description={statuses.error.message}
          />
        ) : events.isError ? (
          <StateBlock
            type="error"
            title="Erro ao carregar eventos"
            description={events.error.message}
          />
        ) : employees.isError ? (
          <StateBlock
            type="error"
            title="Erro ao carregar colaboradores"
            description={employees.error.message}
          />
        ) : (
          <>
            <Card className="border bg-white shadow-sm">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="size-5" />
                    Agente operacional
                  </CardTitle>
                  <div className="flex flex-wrap gap-2">
                    {aiAgent.data?.provider ? (
                      <Badge variant="secondary">
                        {aiAgent.data.provider === "openai" ? "OpenAI" : "Fallback"}
                      </Badge>
                    ) : null}
                    {aiAgent.data?.overall_severity ? (
                      <Badge variant={severityBadgeVariant(aiAgent.data.overall_severity)}>
                        {aiAgent.data.overall_severity}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {aiAgent.data ? (
                  <>
                    {aiAgent.data.warning ? (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                        {aiAgent.data.warning}
                      </div>
                    ) : null}
                    <div className="rounded-lg border bg-slate-50 p-3">
                      <div className="text-sm font-medium">Resumo do agente</div>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {aiAgent.data.summary}
                      </p>
                    </div>

                    {insights.priorityTargets.length > 0 ? (
                      <div className="rounded-lg border border-red-100 bg-red-50/60 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-sm font-semibold text-red-900">
                            <ShieldAlert className="size-4" />
                            Prioridades para resolver
                          </div>
                          <Badge variant="destructive">
                            {insights.priorityTargets.length} prioridade(s)
                          </Badge>
                        </div>
                        <div className="mt-3 grid gap-2 lg:grid-cols-2">
                          {insights.priorityTargets.map((status) => {
                            const target = targetFromStatus(status)
                            const severity = target.severity ?? "alto"
                            return (
                              <div key={status.id} className="rounded-lg border bg-white p-3">
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <div>
                                    <div className="font-medium">
                                      {status.employees?.name ?? "Colaborador"}
                                    </div>
                                    <div className="mt-1 text-xs text-muted-foreground">
                                      {status.branches?.name ?? "Filial"} |{" "}
                                      {statusMeta[status.current_status]?.label ??
                                        status.current_status}
                                    </div>
                                  </div>
                                  <Badge variant={severityBadgeVariant(severity)}>
                                    {severity}
                                  </Badge>
                                </div>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                  {status.status_reason ??
                                    `Prioridade ${status.priority_level} no painel operacional.`}
                                </p>
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                  <Badge variant="outline">
                                    Prioridade {status.priority_level}
                                  </Badge>
                                  {status.delay_minutes > 0 ? (
                                    <Badge variant="outline">
                                      Atraso {status.delay_minutes} min
                                    </Badge>
                                  ) : null}
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => resolveWithAi(target)}
                                    disabled={aiAgent.isPending}
                                  >
                                    <Sparkles className="size-3.5" />
                                    Resolver com IA
                                  </Button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ) : null}

                    <div className="grid gap-3 lg:grid-cols-2">
                      <div className="space-y-3">
                        <div className="text-sm font-semibold">Riscos detectados</div>
                        {aiAgent.data.risks.length > 0 ? (
                          aiAgent.data.risks.map((risk) => (
                            <div key={`${risk.title}-${risk.evidence}`} className="rounded-lg border p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="font-medium">{risk.title}</div>
                                <Badge variant={severityBadgeVariant(risk.severity)}>
                                  {risk.severity}
                                </Badge>
                              </div>
                              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                {risk.reason}
                              </p>
                              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                                Evidencia: {risk.evidence}
                              </p>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <p className="min-w-0 flex-1 text-sm font-medium">
                                  {risk.action}
                                </p>
                                {isPrioritySeverity(risk.severity) ? (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      resolveWithAi({
                                        title: risk.title,
                                        severity: risk.severity,
                                        evidence: risk.evidence,
                                        action: risk.action,
                                      })
                                    }
                                    disabled={aiAgent.isPending}
                                  >
                                    <Sparkles className="size-3.5" />
                                    Resolver
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                          ))
                        ) : (
                          <StateBlock
                            title="Sem riscos destacados"
                            description="O agente nao apontou risco operacional relevante."
                          />
                        )}
                      </div>

                      <div className="space-y-3">
                        <div className="text-sm font-semibold">Recomendacoes</div>
                        {aiAgent.data.recommendations.map((recommendation) => (
                          <div key={recommendation.title} className="rounded-lg border p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="font-medium">{recommendation.title}</div>
                              <Badge variant={recommendation.priority === "alta" ? "destructive" : "outline"}>
                                {recommendation.priority}
                              </Badge>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                              {recommendation.description}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                              <span>{recommendation.owner}</span>
                              {recommendation.requires_confirmation ? (
                                <span>Requer confirmacao</span>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-lg border bg-slate-50 p-3">
                      <div className="text-sm font-semibold">
                        {aiAgent.data.next_action.title}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {aiAgent.data.next_action.description}
                      </p>
                    </div>

                    {aiAgent.data.resolution.status === "drafted" ? (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-950">
                              <ClipboardCheck className="size-4" />
                              Plano de resolucao
                            </div>
                            <p className="mt-2 text-sm leading-6 text-emerald-900">
                              {aiAgent.data.resolution.diagnosis}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant={severityBadgeVariant(aiAgent.data.resolution.severity)}>
                              {aiAgent.data.resolution.severity}
                            </Badge>
                            {aiAgent.data.resolution.confirmation_required ? (
                              <Badge variant="outline">Confirmar antes de concluir</Badge>
                            ) : null}
                          </div>
                        </div>

                        <div className="mt-3 grid gap-3 lg:grid-cols-2">
                          <div className="rounded-lg border bg-white p-3">
                            <div className="text-sm font-medium">Passos imediatos</div>
                            <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm leading-6 text-muted-foreground">
                              {aiAgent.data.resolution.immediate_steps.map((step) => (
                                <li key={step}>{step}</li>
                              ))}
                            </ol>
                          </div>
                          <div className="rounded-lg border bg-white p-3">
                            <div className="text-sm font-medium">Mensagem pronta</div>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                              {aiAgent.data.resolution.recommended_message}
                            </p>
                          </div>
                        </div>

                        {aiAgent.data.resolution.preventive_actions.length > 0 ? (
                          <div className="mt-3 rounded-lg border bg-white p-3">
                            <div className="text-sm font-medium">Prevencao</div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {aiAgent.data.resolution.preventive_actions.map((action) => (
                                <Badge key={action} variant="outline">
                                  {action}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        <div className="mt-3 flex flex-wrap justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              if (resolutionTarget) resolveWithAi(resolutionTarget)
                            }}
                            disabled={!resolutionTarget || aiAgent.isPending}
                          >
                            <RefreshCw className={`size-4 ${aiAgent.isPending ? "animate-spin" : ""}`} />
                            Atualizar proposta
                          </Button>
                          <Button
                            type="button"
                            onClick={applyResolutionAsNote}
                            disabled={createNote.isPending}
                          >
                            <CheckCircle2 className="size-4" />
                            {createNote.isPending
                              ? "Registrando..."
                              : "Aplicar como tarefa"}
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <StateBlock
                    title="Agente pronto"
                    description="Execute uma analise para gerar riscos, recomendacoes e proxima acao sugerida com IA."
                  />
                )}

                <form className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]" onSubmit={submitQuestion}>
                  <textarea
                    className="min-h-20 rounded-lg border bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"
                    placeholder="Pergunte ao agente: o que esta critico agora?"
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                  />
                  <Button type="submit" disabled={aiAgent.isPending}>
                    <Send className="size-4" />
                    Perguntar
                  </Button>
                </form>

                {aiAgent.data?.chat_answer ? (
                  <div className="rounded-lg border bg-white p-3 text-sm leading-6">
                    {aiAgent.data.chat_answer}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <BentoGrid>
              <MetricCard
                title="Riscos ativos"
                value={insights.critical}
                detail="Status criticos no agora"
                icon={<AlertTriangle className="size-5" />}
                className={insights.critical > 0 ? "border-red-200" : undefined}
              />
              <MetricCard
                title="Atrasos recentes"
                value={insights.delays}
                detail="Ultimos 30 dias"
                icon={<Clock className="size-5" />}
              />
              <MetricCard
                title="Faltas recentes"
                value={insights.absences}
                detail="Ultimos 30 dias"
                icon={<BrainCircuit className="size-5" />}
              />
              <MetricCard
                title="Equipe ativa"
                value={insights.activeEmployees}
                detail="Colaboradores disponiveis"
                icon={<Sparkles className="size-5" />}
              />
            </BentoGrid>

            <div className="grid gap-4 xl:grid-cols-[1fr_0.7fr]">
              <Card className="border bg-white shadow-sm">
                <CardHeader>
                  <CardTitle>Insights automaticos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {insights.recommendations.map((recommendation) => (
                    <div
                      key={recommendation.title}
                      className="rounded-lg border bg-slate-50 p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-medium">{recommendation.title}</div>
                        <Badge
                          variant={
                            recommendation.severity === "alto"
                              ? "destructive"
                              : recommendation.severity === "medio"
                                ? "outline"
                                : "default"
                          }
                        >
                          {recommendation.severity}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {recommendation.description}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="size-4" />
                    Proxima acao sugerida
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {insights.breakCandidate ? (
                    <div className="rounded-lg border bg-slate-50 p-3">
                      <div className="font-medium">
                        {insights.breakCandidate.employees?.name ?? "Colaborador"}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Priorize o acompanhamento deste colaborador para intervalo ou
                        validacao de status, pois ele aparece como trabalhando ha mais tempo.
                      </p>
                      <div className="mt-3 text-xs text-muted-foreground">
                        Atualizado em{" "}
                        {formatDateTimeBR(insights.breakCandidate.updated_at)}
                      </div>
                    </div>
                  ) : (
                    <StateBlock
                      title="Sem acao imediata"
                      description="Quando houver status ativo, a recomendacao aparece aqui."
                    />
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </>
  )
}
