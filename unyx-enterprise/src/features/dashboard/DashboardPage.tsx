import {
  AlertTriangle,
  Building2,
  Clock,
  Coffee,
  DoorOpen,
  Gauge,
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
  useOperationalStatuses,
  useOrganization,
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

const ACTIVE_STATUSES: OperationalStatus[] = ["trabalhando", "voltou"]

const RISK_STATUSES: OperationalStatus[] = [
  "alerta_critico",
  "deve_sair",
  "em_intervalo",
  "aguardando_sangria",
  "troca_de_caixa",
]

const SECONDARY_STATUSES: OperationalStatus[] = [
  "deve_sair",
  "aguardando_sangria",
  "troca_de_caixa",
  "em_intervalo",
]

function getInitials(name: string): string {
  const parts = (name ?? "").trim().split(" ").filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return (parts[0][0] ?? "?").toUpperCase()
  return ((parts[0][0] ?? "") + (parts[parts.length - 1][0] ?? "")).toUpperCase()
}

const avatarColorByStatus: Partial<Record<OperationalStatus, string>> = {
  aguardando_evento:  "bg-slate-100 text-slate-600",
  trabalhando:        "bg-emerald-100 text-emerald-700",
  deve_sair:          "bg-amber-100 text-amber-700",
  aguardando_sangria: "bg-orange-100 text-orange-700",
  troca_de_caixa:     "bg-sky-100 text-sky-700",
  em_intervalo:       "bg-violet-100 text-violet-700",
  voltou:             "bg-teal-100 text-teal-700",
  folga:              "bg-zinc-100 text-zinc-600",
  finalizado:         "bg-neutral-100 text-neutral-600",
  alerta_critico:     "bg-red-100 text-red-700",
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

function rowMatchesSearch(row: DashboardRow, searchText: string) {
  const query = normalize(searchText)
  if (!query) return true

  return [
    row.employee_name,
    row.employee_role,
    row.sector_name,
    row.branch_name,
    row.status_reason,
  ].some((value) => normalize(value).includes(query))
}

function rowMatchesStatusFilter(row: DashboardRow, statusFilter: string) {
  if (!statusFilter) return true
  if (statusFilter === "active") {
    return ACTIVE_STATUSES.includes(row.current_status)
  }
  if (statusFilter === "risk") {
    return RISK_STATUSES.includes(row.current_status)
  }
  if (statusFilter === "delayed") {
    return row.delay_minutes > 0
  }
  if (statusFilter === "absences") {
    return normalize(row.status_reason).includes("falta")
  }
  return row.current_status === statusFilter
}

function getMetricStatusFilter(key: DashboardMetricKey) {
  const filters: Partial<Record<DashboardMetricKey, string>> = {
    working: "active",
    present: "active",
    serviceCoverage: "active",
    critical: "alerta_critico",
    sectorAlerts: "alerta_critico",
    criticalFunctions: "alerta_critico",
    breaks: "em_intervalo",
    delay: "delayed",
    cashierCoverage: "risk",
    absences: "absences",
  }

  return filters[key] ?? ""
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
  const [searchText, setSearchText] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [showAllPrimary, setShowAllPrimary] = useState(false)
  const [showAllSecondary, setShowAllSecondary] = useState(false)
  const [showAllLive, setShowAllLive] = useState(false)
  const dashboard = useDashboardRows(date)
  const schedules = useSchedules(date)
  const statuses = useOperationalStatuses()
  const organization = useOrganization()
  const operationalSettings = useOperationalSettings()
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
  const sectorOptions = useMemo(() => {
    const names = new Set(rows.map((r) => r.sector_name).filter(Boolean) as string[])
    return Array.from(names).sort()
  }, [rows])

  const filteredRows = useMemo(() => {
    let list = sectorFilter
      ? rows.filter((r) => r.sector_name === sectorFilter)
      : rows

    list = list.filter((row) => rowMatchesSearch(row, searchText))
    list = list.filter((row) => rowMatchesStatusFilter(row, statusFilter))

    return sortDashboardRowsByMode(mode, list)
  }, [mode, rows, searchText, sectorFilter, statusFilter])

  const filteredSchedules = useMemo(() => {
    return scheduledToday.filter((schedule) => {
      if (
        sectorFilter &&
        schedule.employees?.sectors?.name !== sectorFilter
      ) {
        return false
      }

      const query = normalize(searchText)
      if (!query) return true

      return [
        schedule.employees?.name,
        schedule.employees?.role,
        schedule.employees?.sectors?.name,
        schedule.branches?.name,
        schedule.notes,
      ].some((value) => normalize(value).includes(query))
    })
  }, [scheduledToday, searchText, sectorFilter])

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
    // Fallback: operational_status table filtered to the selected date.
    return liveStatuses
      .filter((s) => s.schedules?.work_date === date)
      .map((s: OperationalStatusRecord) => ({
        current_status: s.current_status,
        delay_minutes: s.delay_minutes,
        role: s.employees?.role,
        sectorName: s.employees?.sectors?.name,
        reason: s.status_reason,
      }))
  }, [date, liveRows, filteredRows, liveStatuses])

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

  const secondaryRows = filteredRows
    .filter((row) => SECONDARY_STATUSES.includes(row.current_status))

  const visiblePrimaryRows = showAllPrimary ? primaryRows : primaryRows.slice(0, 5)
  const visibleSecondaryRows = showAllSecondary
    ? secondaryRows
    : secondaryRows.slice(0, 5)
  const visibleLiveRows = showAllLive ? liveRows : liveRows.slice(0, 12)

  const coverageRisk = filteredRows.filter((row) =>
    RISK_STATUSES.includes(row.current_status)
  ).length
  const coverageTotal = filteredRows.length
  const coverageRiskPct =
    coverageTotal > 0 ? Math.round((coverageRisk / coverageTotal) * 100) : 0
  const shouldShowCoverageRisk = coverageTotal > 0 && coverageRiskPct >= 30

  const lastUpdated = dashboard.dataUpdatedAt
    ? new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(new Date(dashboard.dataUpdatedAt))
    : null

  const workingCount = statusSource.filter((r) =>
    ["trabalhando", "voltou"].includes(r.current_status)
  ).length
  const scheduledCount = filteredSchedules.length || filteredRows.length
  const presencePct =
    scheduledCount > 0 ? Math.round((workingCount / scheduledCount) * 100) : 0

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
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDate(todayISO())}
            >
              Hoje
            </Button>
            <Input
              className="w-52"
              type="search"
              placeholder="Buscar colaborador..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              aria-label="Buscar colaborador"
            />
            {sectorOptions.length > 0 ? (
              <select
                className={fieldClass}
                value={sectorFilter}
                onChange={(e) => setSectorFilter(e.target.value)}
              >
                <option value="">Todos os setores</option>
                {sectorOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            ) : null}
            <select
              className={fieldClass}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filtrar por status"
            >
              <option value="">Todos os status</option>
              <option value="active">Ativos agora</option>
              <option value="risk">Em risco</option>
              <option value="delayed">Com atraso</option>
              <option value="absences">Faltas</option>
              {operationalStatuses.map((status) => (
                <option key={status} value={status}>
                  {statusMeta[status].label}
                </option>
              ))}
            </select>
            {searchText || sectorFilter || statusFilter ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchText("")
                  setSectorFilter("")
                  setStatusFilter("")
                }}
              >
                Limpar
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="icon"
              onClick={() => void dashboard.refetch()}
              disabled={dashboard.isFetching}
              aria-label="Atualizar"
            >
              <RefreshCw className={`size-4 ${dashboard.isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        }
      />

      <div className="space-y-5 p-6">

        {/* Row 1: Hero gauge + status breakdown */}
        <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">

          {/* Hero: half-donut gauge + KPI sub-cards */}
          <Card className="border bg-white shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Equipe hoje</CardTitle>
            </CardHeader>
            <CardContent>
              {dashboard.isLoading ? (
                <StateBlock type="loading" title="Carregando" />
              ) : (
                <div className="grid gap-5 lg:grid-cols-[minmax(18rem,1.15fr)_minmax(14rem,0.85fr)] lg:items-center">
                  <div className="relative h-56 w-full sm:h-60 lg:h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { value: presencePct },
                            { value: Math.max(0, 100 - presencePct) },
                          ]}
                          cx="50%"
                          cy="82%"
                          startAngle={210}
                          endAngle={-30}
                          innerRadius="57%"
                          outerRadius="90%"
                          dataKey="value"
                          strokeWidth={0}
                          cornerRadius={8}
                        >
                          <Cell fill="#6366f1" />
                          <Cell fill="#e2e8f0" />
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-center">
                      <p className="text-5xl font-bold tracking-tight tabular-nums text-slate-900">
                        {presencePct}%
                      </p>
                      <p className="text-xs font-medium text-slate-400">
                        Equipe ativa
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <p className="text-[11px] font-medium text-slate-400">
                          Escalados
                        </p>
                        <p className="mt-1 text-2xl font-bold tabular-nums text-slate-800">
                          {scheduledCount}
                        </p>
                      </div>
                      <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3">
                        <p className="text-[11px] font-medium text-emerald-500">
                          Trabalhando
                        </p>
                        <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-800">
                          {workingCount}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-3">
                      <p className="text-[11px] font-medium text-indigo-500">
                        Nao ativos agora
                      </p>
                      <p className="mt-1 text-2xl font-bold tabular-nums text-indigo-900">
                        {Math.max(0, scheduledCount - workingCount)}
                      </p>
                      <p className="mt-1 text-xs text-indigo-600">
                        Escalados que ainda nao aparecem como equipe ativa.
                      </p>
                    </div>

                    {lastUpdated ? (
                      <p className="text-right text-[10px] text-slate-400">
                        atualizado as {lastUpdated}
                      </p>
                    ) : null}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Status breakdown with progress bars */}
          <Card className="border bg-white shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between gap-3 text-base">
                <span>Status operacional</span>
                <Badge variant="outline">{statusSource.length} registros</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dashboard.isLoading || statuses.isLoading ? (
                <StateBlock type="loading" title="Carregando" />
              ) : statusChartData.length === 0 ? (
                <StateBlock
                  title="Sem status"
                  description="Registre eventos para visualizar."
                />
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="text-3xl font-bold tracking-tight tabular-nums text-slate-900">
                          {statusSource.length}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          colaboradores no recorte atual
                        </p>
                      </div>
                      {statusFilter ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setStatusFilter("")}
                        >
                          Ver todos
                        </Button>
                      ) : null}
                    </div>

                    <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
                      {statusChartData.map((entry) => {
                        const pct =
                          statusSource.length > 0
                            ? (entry.total / statusSource.length) * 100
                            : 0
                        return (
                          <div
                            key={entry.status}
                            className="h-full transition-all"
                            style={{
                              width: `${pct}%`,
                              backgroundColor:
                                STATUS_COLORS[entry.status] ?? "#94a3b8",
                            }}
                            title={`${entry.label}: ${entry.total}`}
                          />
                        )
                      })}
                    </div>
                  </div>

                  {statusChartData.map((entry) => {
                    const pct =
                      statusSource.length > 0
                        ? Math.round((entry.total / statusSource.length) * 100)
                        : 0
                    return (
                      <div
                        key={entry.status}
                        className="rounded-lg border border-slate-100 bg-slate-50 p-2.5"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="size-2 shrink-0 rounded-full"
                              style={{ backgroundColor: STATUS_COLORS[entry.status] ?? "#94a3b8" }}
                            />
                            <span className="text-xs text-slate-600">{entry.label}</span>
                          </div>
                          <span className="text-xs font-semibold tabular-nums text-slate-700">
                            {entry.total} - {pct}%
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

        </div>

        {/* Row 2: KPI cards grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {modeConfig.dashboardCards.map((key) => {
            const metric = buildMetric(key, {
              rows: filteredRows,
              schedules: filteredSchedules,
              statusSource,
              occurrencesCount,
              minimumTeamSize: modeConfig.minimumTeamSize,
            })
            const metricFilter = getMetricStatusFilter(key)
            const isMetricFilterActive =
              metricFilter.length > 0 && statusFilter === metricFilter
            return (
              <button
                type="button"
                key={key}
                className={`rounded-xl border bg-white p-4 text-left shadow-sm transition ${
                  metric.danger ? "border-red-200 bg-red-50" : "border-slate-200"
                } ${
                  metricFilter
                    ? "hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                    : "cursor-default"
                } ${isMetricFilterActive ? "ring-2 ring-indigo-200" : ""}`}
                onClick={() => {
                  if (!metricFilter) return
                  setStatusFilter((current) =>
                    current === metricFilter ? "" : metricFilter
                  )
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[11px] font-medium leading-tight text-slate-500">
                    {metric.title}
                  </p>
                  <div className={`shrink-0 rounded-lg p-1.5 ${metric.danger ? "bg-red-100" : "bg-slate-100"}`}>
                    <div className={`[&_svg]:size-3.5 ${metric.danger ? "text-red-600" : "text-slate-500"}`}>
                      {getMetricIcon(key)}
                    </div>
                  </div>
                </div>
                <p className={`mt-2.5 text-2xl font-bold tracking-tight tabular-nums ${
                  metric.danger ? "text-red-700" : "text-slate-900"
                }`}>
                  {metric.value}
                </p>
                <p className="mt-0.5 text-[10px] leading-tight text-slate-400">
                  {metric.detail}
                </p>
              </button>
            )
          })}
        </div>

        {shouldShowCoverageRisk ? (
          <div className="flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 p-4">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-orange-600" />
            <div className="text-sm text-orange-800">
              <span className="font-medium">Risco de cobertura:</span>{" "}
              {coverageRisk} de {coverageTotal} colaboradores ({coverageRiskPct}%)
              estao em situacao que pode impactar a operacao.
            </div>
          </div>
        ) : null}

        {/* Row 3: High priority + secondary */}
        <div className="grid gap-4 xl:grid-cols-2">
          <Card className="border bg-white shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="size-4 text-red-500" />
                  {modeConfig.highPriorityTitle}
                </CardTitle>
                {primaryRows.length > 0 ? (
                  <Badge variant="outline">
                    {visiblePrimaryRows.length} de {primaryRows.length}
                  </Badge>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {primaryRows.length === 0 ? (
                <StateBlock
                  title="Nenhuma prioridade alta"
                  description="A operacao nao possui registros criticos no momento."
                />
              ) : (
                <>
                  {visiblePrimaryRows.map((row) => {
                    const initials = getInitials(row.employee_name)
                    return (
                      <div key={row.id} className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50/70 p-3">
                        <div className="w-1 self-stretch shrink-0 rounded-full bg-red-400" />
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-700">
                          {initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-800">{row.employee_name}</p>
                          <p className="truncate text-xs text-red-600">
                            {row.status_reason ?? "Prioridade operacional alta"}
                          </p>
                          <p className="mt-0.5 truncate text-[11px] text-red-500">
                            {[row.sector_name, row.branch_name].filter(Boolean).join(" - ")}
                          </p>
                        </div>
                        <StatusBadge status={row.current_status} />
                      </div>
                    )
                  })}
                  {primaryRows.length > 5 ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => setShowAllPrimary((value) => !value)}
                    >
                      {showAllPrimary ? "Recolher" : `Ver todos (${primaryRows.length})`}
                    </Button>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border bg-white shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <DoorOpen className="size-4 text-amber-500" />
                  {modeConfig.secondaryTitle}
                </CardTitle>
                {secondaryRows.length > 0 ? (
                  <Badge variant="outline">
                    {visibleSecondaryRows.length} de {secondaryRows.length}
                  </Badge>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {secondaryRows.length === 0 ? (
                <StateBlock
                  title="Sem pendencias operacionais"
                  description="Intervalos, saidas e etapas estao regularizadas."
                />
              ) : (
                <>
                  {visibleSecondaryRows.map((row) => {
                  const initials = getInitials(row.employee_name)
                  return (
                    <div key={row.id} className="flex items-center gap-3 rounded-xl border border-amber-100 bg-amber-50/70 p-3">
                      <div className="w-1 self-stretch shrink-0 rounded-full bg-amber-400" />
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700">
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800">{row.employee_name}</p>
                        <p className="truncate text-xs text-amber-600">
                          {row.sector_name ?? "Sem setor"} · {row.branch_name}
                        </p>
                      </div>
                      <StatusBadge status={row.current_status} />
                    </div>
                  )
                  })}
                  {secondaryRows.length > 5 ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => setShowAllSecondary((value) => !value)}
                    >
                      {showAllSecondary
                        ? "Recolher"
                        : `Ver todos (${secondaryRows.length})`}
                    </Button>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Row 4: Live team */}
        <Card className="border bg-white shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">{modeConfig.liveTitle}</CardTitle>
              {liveRows.length > 0 ? (
                <Badge variant="outline">
                  {visibleLiveRows.length} de {liveRows.length}
                </Badge>
              ) : null}
            </div>
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
              <>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {visibleLiveRows.map((row) => {
                  const initials = getInitials(row.employee_name)
                  const avatarClass =
                    avatarColorByStatus[row.current_status] ?? "bg-slate-100 text-slate-600"
                  return (
                    <div key={row.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className={`flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${avatarClass}`}>
                          {initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-800">
                            {row.employee_name}
                          </p>
                          <p className="truncate text-xs text-slate-400">
                            {[row.employee_role, row.sector_name].filter(Boolean).join(" · ") || row.branch_name}
                          </p>
                        </div>
                        <StatusBadge status={row.current_status} />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {row.start_time ? (
                          <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] text-slate-500">
                            {formatTime(row.start_time)}
                          </span>
                        ) : null}
                        {row.break_start ? (
                          <span className="rounded-md bg-violet-50 px-2 py-1 text-[11px] text-violet-600">
                            int. {formatTime(row.break_start)}
                          </span>
                        ) : null}
                        {row.break_end ? (
                          <span className="rounded-md bg-teal-50 px-2 py-1 text-[11px] text-teal-600">
                            ret. {formatTime(row.break_end)}
                          </span>
                        ) : null}
                        {row.end_time ? (
                          <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] text-slate-500">
                            → {formatTime(row.end_time)}
                          </span>
                        ) : null}
                      </div>
                      {row.delay_minutes > 0 ? (
                        <div className="mt-2">
                          <Badge variant="destructive" className="text-[10px]">
                            {minutesLabel(row.delay_minutes)} atraso
                          </Badge>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
                </div>
                {liveRows.length > 12 ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full"
                    onClick={() => setShowAllLive((value) => !value)}
                  >
                    {showAllLive ? "Recolher" : `Ver todos (${liveRows.length})`}
                  </Button>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

        {/* Row 5: Branch summary (multi-branch only) */}
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
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Building2 className="size-4" />
                  Resumo por filial
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {Array.from(branchMap.values()).map((branch) => (
                    <div
                      key={branch.name}
                      className={`rounded-xl border p-3 ${
                        branch.critical > 0
                          ? "border-red-200 bg-red-50"
                          : "border-slate-200 bg-slate-50"
                      }`}
                    >
                      <p className="font-semibold text-slate-800">{branch.name}</p>
                      <div className="mt-1.5 flex gap-3 text-sm text-muted-foreground">
                        <span>{branch.working} trabalhando</span>
                        <span>{branch.total} total</span>
                        {branch.critical > 0 ? (
                          <span className="font-medium text-red-600">
                            {branch.critical} critico{branch.critical > 1 ? "s" : ""}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )
        })()}

      </div>
    </>
  )
}
