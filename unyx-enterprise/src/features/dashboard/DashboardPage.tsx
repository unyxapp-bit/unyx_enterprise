import {
  AlertTriangle,
  Building2,
  Clock,
  Coffee,
  DoorOpen,
  Gauge,
  MapPinned,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Store,
  Users,
  Utensils,
} from "lucide-react"
import type { ReactNode } from "react"
import { useMemo, useState } from "react"
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts"

import { StatusBadge } from "@/components/bento/StatusBadge"
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
import { Input } from "@/components/ui/input"
import type { DashboardMetricKey } from "@/features/ops/modes/modeUiConfig"
import { modeUiConfig } from "@/features/ops/modes/modeUiConfig"
import {
  getOperationalMode,
  operationalModeNames,
} from "@/features/ops/modes/operationalModes"
import {
  getPriorityByMode,
  isCashierContext,
  isResponsibleContext,
  sortDashboardRowsByMode,
} from "@/features/ops/modes/priorityRules"
import {
  useAttendanceEvents,
  useDashboardRows,
  useOperationalSettings,
  useOperationalPosts,
  useOperationalStatuses,
  useOrganization,
  usePostAllocations,
  useSchedules,
} from "@/hooks/useUnyxData"
import { formatTime, minutesLabel, todayISO } from "@/lib/format"
import { operationalStatuses, statusMeta } from "@/lib/status"
import type {
  DashboardRow,
  OperationalStatus,
  OperationalStatusRecord,
  ScheduleWithRelations,
} from "@/types/domain"

const fieldClass =
  "h-8 rounded-lg border bg-white px-2.5 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"

const STATUS_COLORS: Record<string, string> = {
  alerta_critico:    "#ef4444",
  aguardando_sangria:"#f97316",
  troca_de_caixa:    "#0ea5e9",
  deve_sair:         "#f59e0b",
  em_intervalo:      "#8b5cf6",
  voltou:            "#14b8a6",
  trabalhando:       "#22c55e",
  aguardando_evento: "#94a3b8",
  finalizado:        "#737373",
  folga:             "#a1a1aa",
}

type StatusCount = {
  current_status: OperationalStatus
  delay_minutes: number
  role?: string | null
  sectorName?: string | null
  reason?: string | null
}

interface MetricData {
  rows: DashboardRow[]
  statusSource: StatusCount[]
  schedules: ScheduleWithRelations[]
  occurrencesCount: number
  minimumTeamSize: number
}

function normalize(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function currentShiftLabel() {
  const hour = new Date().getHours()
  if (hour < 11) return "Manha"
  if (hour < 17) return "Tarde"
  return "Noite"
}

function nextRestaurantPeak() {
  const hour = new Date().getHours()
  if (hour < 11) return "Almoco"
  if (hour < 18) return "Jantar"
  return "Proximo almoco"
}

function getMetricIcon(key: DashboardMetricKey): ReactNode {
  const icons: Record<DashboardMetricKey, ReactNode> = {
    scheduled: <Users className="size-5" />,
    working: <Gauge className="size-5" />,
    critical: <AlertTriangle className="size-5" />,
    breaks: <Coffee className="size-5" />,
    delay: <Clock className="size-5" />,
    cashierCoverage: <Store className="size-5" />,
    activeSectors: <Building2 className="size-5" />,
    sectorAlerts: <ShieldAlert className="size-5" />,
    present: <Users className="size-5" />,
    absences: <AlertTriangle className="size-5" />,
    currentShift: <Clock className="size-5" />,
    minimumTeam: <ShieldCheck className="size-5" />,
    nextPeak: <Utensils className="size-5" />,
    criticalFunctions: <ShieldAlert className="size-5" />,
    responsiblePresence: <ShieldCheck className="size-5" />,
    serviceCoverage: <Users className="size-5" />,
    occurrences: <AlertTriangle className="size-5" />,
  }

  return icons[key]
}

function buildMetric(key: DashboardMetricKey, data: MetricData) {
  const { rows, schedules, statusSource, occurrencesCount, minimumTeamSize } = data
  const critical = statusSource.filter(
    (row) => row.current_status === "alerta_critico"
  ).length
  const working = statusSource.filter((row) =>
    ["trabalhando", "voltou"].includes(row.current_status)
  ).length
  const breaks = statusSource.filter(
    (row) => row.current_status === "em_intervalo"
  ).length
  const delayMinutes = statusSource.reduce(
    (total, row) => total + row.delay_minutes,
    0
  )
  const sectors = new Set(
    [
      ...rows.map((row) => row.sector_name),
      ...schedules.map((schedule) => schedule.employees?.sectors?.name),
    ].filter(Boolean) as string[]
  )
  const absenceRows = rows.filter((row) =>
    normalize(row.status_reason).includes("falta")
  )
  const cashierCoverage = rows.filter(
    (row) =>
      isCashierContext({
        role: row.employee_role,
        sectorName: row.sector_name,
      }) &&
      ["alerta_critico", "deve_sair", "em_intervalo"].includes(
        row.current_status
      )
  ).length
  const criticalFunctions = rows.filter(
    (row) =>
      row.current_status === "alerta_critico" &&
      /cozinha|salao|delivery|caixa/.test(
        normalize(`${row.employee_role ?? ""} ${row.sector_name ?? ""}`)
      )
  ).length
  const responsibleRows = rows.filter((row) =>
    isResponsibleContext({
      role: row.employee_role,
      sectorName: row.sector_name,
    })
  )
  const responsiblePresent = responsibleRows.some((row) =>
    ["trabalhando", "voltou"].includes(row.current_status)
  )

  const metrics: Record<
    DashboardMetricKey,
    { title: string; value: string | number; detail: string; danger?: boolean }
  > = {
    scheduled: {
      title: "Escalados",
      value: schedules.length || rows.length,
      detail: "Colaboradores na escala",
    },
    working: {
      title: "Trabalhando agora",
      value: working,
      detail: "Com status ativo",
    },
    critical: {
      title: "Alertas criticos",
      value: critical,
      detail: "Demandam acao imediata",
      danger: critical > 0,
    },
    breaks: {
      title: "Em intervalo",
      value: breaks,
      detail: "Pausas em andamento",
    },
    delay: {
      title: "Atraso acumulado",
      value: minutesLabel(delayMinutes),
      detail: "Somatorio do dia",
      danger: delayMinutes > 0,
    },
    cashierCoverage: {
      title: "Caixas em risco",
      value: cashierCoverage,
      detail: "Caixa, intervalo ou cobertura",
      danger: cashierCoverage > 0,
    },
    activeSectors: {
      title: "Setores ativos",
      value: sectors.size,
      detail: "Areas na operacao",
    },
    sectorAlerts: {
      title: "Alertas por setor",
      value: critical,
      detail: "Setores com risco aberto",
      danger: critical > 0,
    },
    present: {
      title: "Presentes",
      value: working,
      detail: "Equipe em atividade",
    },
    absences: {
      title: "Faltas",
      value: absenceRows.length,
      detail: "Ausencias identificadas",
      danger: absenceRows.length > 0,
    },
    currentShift: {
      title: "Turno atual",
      value: currentShiftLabel(),
      detail: "Baseado no horario local",
    },
    minimumTeam: {
      title: "Equipe minima",
      value: `${working}/${minimumTeamSize}`,
      detail: working >= minimumTeamSize ? "Base minima coberta" : "Abaixo do minimo sugerido",
      danger: working < minimumTeamSize,
    },
    nextPeak: {
      title: "Proximo pico",
      value: nextRestaurantPeak(),
      detail: "Referencia operacional",
    },
    criticalFunctions: {
      title: "Funcoes criticas",
      value: criticalFunctions,
      detail: "Cozinha, salao, delivery ou caixa",
      danger: criticalFunctions > 0,
    },
    responsiblePresence: {
      title: "Responsavel presente",
      value: responsibleRows.length === 0 ? "Nao definido" : responsiblePresent ? "Sim" : "Nao",
      detail:
        responsibleRows.length === 0
          ? "Marque cargo/setor responsavel"
          : "Farmaceutico ou tecnico",
      danger: responsibleRows.length > 0 && !responsiblePresent,
    },
    serviceCoverage: {
      title: "Atendimento ativo",
      value: working,
      detail: "Pessoas atendendo agora",
    },
    occurrences: {
      title: "Ocorrencias",
      value: occurrencesCount,
      detail: "Registros de ocorrencia do dia",
      danger: occurrencesCount > 0,
    },
  }

  return metrics[key]
}

function getPriority(row: DashboardRow, mode: ReturnType<typeof getOperationalMode>) {
  return getPriorityByMode(mode, row.current_status, {
    delayMinutes: row.delay_minutes,
    role: row.employee_role,
    sectorName: row.sector_name,
    reason: row.status_reason,
  })
}

export function DashboardPage() {
  const [date, setDate] = useState(todayISO())
  const [sectorFilter, setSectorFilter] = useState("")
  const dashboard = useDashboardRows(date)
  const schedules = useSchedules(date)
  const statuses = useOperationalStatuses()
  const organization = useOrganization()
  const operationalSettings = useOperationalSettings()
  const operationalPosts = useOperationalPosts()
  const postAllocations = usePostAllocations()

  const attendanceEvents = useAttendanceEvents()

  const mode = getOperationalMode(
    operationalSettings.data?.mode ?? organization.data?.segment
  )
  const modeConfig = modeUiConfig[mode]
  const rows = useMemo(() => dashboard.data ?? [], [dashboard.data])
  const liveStatuses = useMemo(
    () => statuses.data ?? [],
    [statuses.data]
  )
  const scheduledToday = useMemo(
    () => schedules.data ?? [],
    [schedules.data]
  )
  const activeOperationalPosts = useMemo(
    () => (operationalPosts.data ?? []).filter((post) => post.active),
    [operationalPosts.data]
  )
  const coveredPostIds = useMemo(
    () =>
      new Set(
        (postAllocations.data ?? [])
          .filter((allocation) => !allocation.ended_at)
          .map((allocation) => allocation.post_id)
      ),
    [postAllocations.data]
  )
  const uncoveredOperationalPosts = useMemo(
    () => activeOperationalPosts.filter((post) => !coveredPostIds.has(post.id)),
    [activeOperationalPosts, coveredPostIds]
  )

  const sectorOptions = useMemo(() => {
    const names = new Set(rows.map((r) => r.sector_name).filter(Boolean) as string[])
    return Array.from(names).sort()
  }, [rows])

  const filteredRows = useMemo(() => {
    const list = sectorFilter
      ? rows.filter((r) => r.sector_name === sectorFilter)
      : rows

    return sortDashboardRowsByMode(mode, list)
  }, [mode, rows, sectorFilter])

  const filteredSchedules = useMemo(() => {
    if (!sectorFilter) return scheduledToday
    return scheduledToday.filter(
      (schedule) => schedule.employees?.sectors?.name === sectorFilter
    )
  }, [scheduledToday, sectorFilter])

  const occurrencesCount = useMemo(() => {
    return (attendanceEvents.data ?? []).filter(
      (e) => e.event_time.slice(0, 10) === date && e.event_type === "ocorrencia_registrada"
    ).length
  }, [attendanceEvents.data, date])

  const toMin = (t: string | null) => {
    if (!t) return null
    const [h, m] = t.split(":").map(Number)
    return h * 60 + m
  }

  const liveRows = useMemo(() => {
    const now = new Date()
    const nowMin = now.getHours() * 60 + now.getMinutes()
    return filteredRows.filter((row) => {
      if (["folga", "finalizado"].includes(row.current_status)) return false
      const startMin = toMin(row.start_time)
      const endMin = toMin(row.end_time)
      if (startMin !== null && nowMin < startMin) return false
      if (endMin !== null && nowMin > endMin) return false
      return true
    })
  }, [filteredRows])

  const statusSource = useMemo((): StatusCount[] => {
    const active = liveRows.map((r) => ({
      current_status: r.current_status,
      delay_minutes: r.delay_minutes,
      role: r.employee_role,
      sectorName: r.sector_name,
      reason: r.status_reason,
    }))
    const off = filteredRows
      .filter((r) => ["folga", "finalizado"].includes(r.current_status))
      .map((r) => ({
        current_status: r.current_status,
        delay_minutes: r.delay_minutes,
        role: r.employee_role,
        sectorName: r.sector_name,
        reason: r.status_reason,
      }))
    const combined = [...active, ...off]
    if (combined.length > 0) return combined
    // Fallback: operational_status table filtered to today's schedules
    const today = todayISO()
    return liveStatuses
      .filter((s) => s.schedules?.work_date === today)
      .map((s: OperationalStatusRecord) => ({
        current_status: s.current_status,
        delay_minutes: s.delay_minutes,
        role: s.employees?.role,
        sectorName: s.employees?.sectors?.name,
        reason: s.status_reason,
      }))
  }, [liveRows, filteredRows, liveStatuses])

  const statusChartData = operationalStatuses
    .map((status) => ({
      status,
      label: statusMeta[status].label,
      total: statusSource.filter((row) => row.current_status === status).length,
    }))
    .filter((d) => d.total > 0)

  const primaryRows = filteredRows
    .filter(
      (row) =>
        row.current_status === "alerta_critico" ||
        getPriority(row, mode) >= 70
    )
    .slice(0, 5)

  const secondaryRows = filteredRows
    .filter((row) =>
      ["deve_sair", "aguardando_sangria", "troca_de_caixa", "em_intervalo"].includes(
        row.current_status
      )
    )
    .slice(0, 5)

  const lastUpdated = dashboard.dataUpdatedAt
    ? new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(new Date(dashboard.dataUpdatedAt))
    : null

  if (dashboard.isError) {
    return (
      <>
        <PageHeader title={modeConfig.title} />
        <div className="p-6">
          <StateBlock
            type="error"
            title="Nao foi possivel carregar o dashboard"
            description={dashboard.error.message}
          />
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={modeConfig.title}
        description={modeConfig.mainFocus}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{operationalModeNames[mode]}</Badge>
            <Input
              className="w-40"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            {sectorOptions.length > 0 ? (
              <select
                className={fieldClass}
                value={sectorFilter}
                onChange={(e) => setSectorFilter(e.target.value)}
              >
                <option value="">Todos os setores</option>
                {sectorOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            ) : null}
            <Button
              variant="outline"
              size="icon"
              onClick={() => void dashboard.refetch()}
              disabled={dashboard.isFetching}
              aria-label="Atualizar"
            >
              <RefreshCw
                className={`size-4 ${dashboard.isFetching ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        }
      />

      <div className="space-y-6 p-6">
        <div className="flex flex-col gap-2 rounded-lg border bg-white p-3 text-sm text-slate-700 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <span className="font-medium">Modo ativo:</span>{" "}
            {operationalModeNames[mode]}
            {lastUpdated ? (
              <span className="text-muted-foreground"> · atualizado as {lastUpdated}</span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {modeConfig.ruleHighlights.map((rule) => (
              <Badge key={rule} variant="outline">
                {rule}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {modeConfig.dashboardCards.map((key) => {
            const metric = buildMetric(key, {
              rows: filteredRows,
              schedules: filteredSchedules,
              statusSource,
              occurrencesCount,
              minimumTeamSize: modeConfig.minimumTeamSize,
            })

            return (
              <div
                key={key}
                className={`flex min-w-[130px] flex-1 items-center gap-2.5 rounded-lg border bg-white px-3 py-2.5 shadow-sm ${
                  metric.danger ? "border-red-200 bg-red-50" : ""
                }`}
              >
                <div className="shrink-0 text-muted-foreground [&_svg]:size-4">
                  {getMetricIcon(key)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[11px] leading-none text-muted-foreground">
                    {metric.title}
                  </p>
                  <p className={`mt-1 text-lg font-bold leading-none tabular-nums ${metric.danger ? "text-red-700" : ""}`}>
                    {metric.value}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        {activeOperationalPosts.length > 0 ? (
          <Card
            className={`border bg-white shadow-sm ${
              uncoveredOperationalPosts.length > 0 ? "border-red-200" : ""
            }`}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPinned className="size-5" />
                Cobertura de postos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border bg-slate-50 p-3">
                  <div className="text-sm text-muted-foreground">Postos ativos</div>
                  <div className="mt-1 text-2xl font-semibold">
                    {activeOperationalPosts.length}
                  </div>
                </div>
                <div className="rounded-lg border bg-emerald-50 p-3">
                  <div className="text-sm text-emerald-700">Cobertos</div>
                  <div className="mt-1 text-2xl font-semibold text-emerald-900">
                    {activeOperationalPosts.length - uncoveredOperationalPosts.length}
                  </div>
                </div>
                <div className="rounded-lg border bg-red-50 p-3">
                  <div className="text-sm text-red-700">Sem cobertura</div>
                  <div className="mt-1 text-2xl font-semibold text-red-900">
                    {uncoveredOperationalPosts.length}
                  </div>
                </div>
              </div>

              {uncoveredOperationalPosts.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {uncoveredOperationalPosts.slice(0, 8).map((post) => (
                    <Badge key={post.id} variant="destructive">
                      {post.name}
                    </Badge>
                  ))}
                </div>
              ) : (
                <div className="mt-3 text-sm text-muted-foreground">
                  Todos os postos ativos estao cobertos.
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
          <Card className="border bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gauge className="size-5" />
                Status por categoria
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dashboard.isLoading || statuses.isLoading ? (
                <StateBlock type="loading" title="Carregando status" />
              ) : statusChartData.length === 0 ? (
                <StateBlock
                  title="Sem status operacional"
                  description="Cadastre escalas e registre eventos para alimentar o painel."
                />
              ) : (
                <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                  <div className="relative mx-auto h-52 w-52 shrink-0 sm:mx-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={62}
                          outerRadius={96}
                          paddingAngle={2}
                          dataKey="total"
                          strokeWidth={0}
                        >
                          {statusChartData.map((entry) => (
                            <Cell
                              key={entry.status}
                              fill={STATUS_COLORS[entry.status] ?? "#94a3b8"}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value, _name, props) => [
                            value,
                            props.payload?.label ?? "",
                          ]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-bold leading-none">
                        {statusSource.length}
                      </span>
                      <span className="mt-1 text-xs text-muted-foreground">
                        {statusSource.length === 1 ? "colaborador" : "colaboradores"}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col gap-2">
                    {statusChartData.map((entry) => (
                      <div
                        key={entry.status}
                        className="flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: STATUS_COLORS[entry.status] ?? "#94a3b8" }}
                          />
                          <span className="truncate text-sm text-slate-700">
                            {entry.label}
                          </span>
                        </div>
                        <span className="text-sm font-semibold tabular-nums">
                          {entry.total}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="border bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="size-5 text-red-500" />
                  {modeConfig.highPriorityTitle}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {primaryRows.length === 0 ? (
                  <StateBlock
                    title="Nenhuma prioridade alta"
                    description="A operacao nao possui registros criticos no momento."
                  />
                ) : (
                  primaryRows.map((row) => (
                    <div
                      key={row.id}
                      className="rounded-lg border border-red-100 bg-red-50 p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium">{row.employee_name}</div>
                        <StatusBadge status={row.current_status} />
                      </div>
                      <div className="mt-1 text-sm text-red-700">
                        {row.status_reason ?? "Prioridade operacional alta"}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="border bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DoorOpen className="size-5 text-amber-500" />
                  {modeConfig.secondaryTitle}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {secondaryRows.length === 0 ? (
                  <StateBlock
                    title="Sem pendencias operacionais"
                    description="Intervalos, saidas e etapas obrigatorias estao regularizadas."
                  />
                ) : (
                  secondaryRows.map((row) => (
                    <div
                      key={row.id}
                      className="rounded-lg border border-amber-100 bg-amber-50 p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium">{row.employee_name}</div>
                        <StatusBadge status={row.current_status} />
                      </div>
                      <div className="mt-1 text-sm text-amber-700">
                        {row.sector_name ?? "Sem setor"} · {row.branch_name}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {(() => {
              const coverageRisk = filteredRows.filter(
                (row) =>
                  row.current_status === "alerta_critico" ||
                  row.current_status === "deve_sair" ||
                  row.current_status === "em_intervalo"
              ).length
              const total = filteredRows.length
              if (total === 0) return null
              const pct = Math.round((coverageRisk / total) * 100)
              if (pct < 30) return null
              return (
                <div className="flex items-start gap-3 rounded-lg border border-orange-200 bg-orange-50 p-3">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0 text-orange-600" />
                  <div className="text-sm text-orange-800">
                    <span className="font-medium">Risco de cobertura:</span>{" "}
                    {coverageRisk} de {total} colaboradores ({pct}%) estao em
                    situacao que pode impactar a operacao.
                  </div>
                </div>
              )
            })()}
          </div>
        </div>

        {(() => {
          const branchMap = new Map<string, { name: string; working: number; critical: number; total: number }>()
          for (const row of rows) {
            const key = row.branch_id ?? row.branch_name ?? "–"
            if (!branchMap.has(key)) {
              branchMap.set(key, { name: row.branch_name ?? key, working: 0, critical: 0, total: 0 })
            }
            const entry = branchMap.get(key)!
            entry.total++
            if (["trabalhando", "voltou"].includes(row.current_status)) entry.working++
            if (row.current_status === "alerta_critico") entry.critical++
          }
          if (branchMap.size <= 1) return null
          return (
            <Card className="border bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="size-5" />
                  Resumo por filial
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {Array.from(branchMap.values()).map((branch) => (
                    <div
                      key={branch.name}
                      className={`rounded-lg border p-3 ${branch.critical > 0 ? "border-red-200 bg-red-50" : "border-slate-200 bg-slate-50"}`}
                    >
                      <div className="font-medium">{branch.name}</div>
                      <div className="mt-1.5 flex gap-3 text-sm text-muted-foreground">
                        <span>{branch.working} trabalhando</span>
                        <span>{branch.total} total</span>
                        {branch.critical > 0 ? (
                          <span className="font-medium text-red-600">{branch.critical} critico{branch.critical > 1 ? "s" : ""}</span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )
        })()}

        <Card className="border bg-white shadow-sm">
          <CardHeader>
            <CardTitle>{modeConfig.liveTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            {dashboard.isLoading ? (
              <StateBlock type="loading" title="Carregando operacao" />
            ) : liveRows.length === 0 ? (
              <StateBlock
                title="Nenhum colaborador em turno agora"
                description="Os colaboradores aparecem aqui durante o horario de trabalho."
              />
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {liveRows.map((row) => (
                  <div
                    key={row.id}
                    className="rounded-lg border bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{row.employee_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {[row.employee_role, row.sector_name]
                            .filter(Boolean)
                            .join(" · ") || row.branch_name}
                        </div>
                      </div>
                      <StatusBadge status={row.current_status} />
                    </div>
                    <div className="mt-4 grid grid-cols-4 gap-2 text-xs text-muted-foreground">
                      <span>Entrada {formatTime(row.start_time)}</span>
                      <span>Int. {formatTime(row.break_start)}</span>
                      <span>Ret. {formatTime(row.break_end)}</span>
                      <span>Saida {formatTime(row.end_time)}</span>
                    </div>
                    {row.delay_minutes > 0 ? (
                      <div className="mt-3">
                        <Badge variant="destructive">
                          {minutesLabel(row.delay_minutes)} atraso
                        </Badge>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
