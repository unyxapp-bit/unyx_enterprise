import { useMemo } from "react"
import { AlertTriangle, BrainCircuit, Clock, Lightbulb, Sparkles } from "lucide-react"

import { BentoGrid } from "@/components/bento/BentoGrid"
import { MetricCard } from "@/components/bento/MetricCard"
import { PageHeader } from "@/components/shared/PageHeader"
import { StateBlock } from "@/components/shared/StateBlock"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  useAllEmployees,
  useOperationalStatuses,
  useReportEvents,
} from "@/hooks/useUnyxData"
import { formatDateTimeBR } from "@/lib/format"

function isRecent(dateISO: string, days: number) {
  const date = new Date(dateISO)
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  return date >= cutoff
}

export function AiPage() {
  const statuses = useOperationalStatuses()
  const events = useReportEvents()
  const employees = useAllEmployees()

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
        status.current_status === "alerta_critico" || status.priority_level >= 4
    )
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
      recommendations,
    }
  }, [employees.data, events.data, statuses.data])

  return (
    <>
      <PageHeader
        title="Unyx AI"
        description="Leitura automatica dos dados operacionais para antecipar riscos e sugerir acoes."
      />

      <div className="space-y-6 p-6">
        {statuses.isLoading || events.isLoading || employees.isLoading ? (
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
