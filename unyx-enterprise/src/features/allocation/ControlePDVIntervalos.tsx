import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  Coffee,
  Search,
  Store,
  Timer,
  Unlock,
  Users,
} from "lucide-react"

import { SectionPanel } from "@/components/shared/SectionPanel"
import { StateBlock } from "@/components/shared/StateBlock"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  useAllocatePost,
  useAttendanceEvents,
  useFinalizePostAllocation,
  useOperationalPosts,
  useOperationalSettings,
  useOperationalStatuses,
  usePostAllocations,
  useSchedules,
  useAllocationHistory,
} from "@/hooks/useUnyxData"
import { formatDateTimeBR } from "@/lib/format"
import { eventLabel, scheduleStatusLabel, statusMeta } from "@/lib/status"
import { cn } from "@/lib/utils"
import {
  formatDuration,
  localDateKey,
  timeToMinutes,
} from "@/features/operational/utils"
import type {
  OperationalStatusRecord,
  PostAllocation,
  ScheduleWithRelations,
} from "@/types/domain"
import { useAppStore } from "@/store/useAppStore"

const ACTIVE_STATUS_SET = new Set([
  "trabalhando",
  "voltou",
  "pico",
  "apoio_operacional",
  "fechamento",
])

function isCoffeeMarker(notes: string | null | undefined) {
  return notes?.includes("cafe_active") ?? false
}

function minutesSinceTimestamp(value: string | null | undefined, nowMs: number) {
  if (!value) return 0
  const startedAt = new Date(value).getTime()
  if (Number.isNaN(startedAt)) return 0
  return Math.max(0, Math.floor((nowMs - startedAt) / 60_000))
}

function minutesSinceTimeValue(value: string | null | undefined, nowMinutes: number) {
  const startMin = timeToMinutes(value)
  if (startMin === null) return 0
  const elapsed = nowMinutes - startMin
  return elapsed < 0 ? elapsed + 24 * 60 : elapsed
}

function badgeTone(
  schedule: ScheduleWithRelations,
  status: OperationalStatusRecord | undefined,
  allocation: PostAllocation | null
) {
  if (status?.current_status === "alerta_critico") {
    return {
      label: statusMeta.alerta_critico.label,
      className: "border-red-200 bg-red-50 text-red-700",
    }
  }

  if (schedule.status === "day_off" || schedule.status === "absent") {
    return {
      label: scheduleStatusLabel[schedule.status],
      className: "border-zinc-200 bg-zinc-50 text-zinc-600",
    }
  }

  if (schedule.status === "finished" || schedule.status === "cancelled") {
    return {
      label: scheduleStatusLabel[schedule.status],
      className: "border-neutral-200 bg-neutral-50 text-neutral-700",
    }
  }

  if (schedule.status === "on_break") {
    return isCoffeeMarker(schedule.notes)
      ? {
          label: "Cafe",
          className: "border-amber-200 bg-amber-50 text-amber-700",
        }
      : {
          label: "Almoco",
          className: "border-amber-200 bg-amber-50 text-amber-700",
        }
  }

  if (allocation) {
    return {
      label: "Em posto",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    }
  }

  if (status && ACTIVE_STATUS_SET.has(status.current_status)) {
    return {
      label: statusMeta[status.current_status].label,
      className: statusMeta[status.current_status].badgeClassName,
    }
  }

  return {
    label: scheduleStatusLabel[schedule.status] ?? "Agendado",
    className: "border-slate-200 bg-slate-50 text-slate-600",
  }
}

function currentStatusText(
  schedule: ScheduleWithRelations,
  status: OperationalStatusRecord | undefined,
  allocation: PostAllocation | null
) {
  if (status?.status_reason) return status.status_reason
  if (schedule.status === "on_break" && isCoffeeMarker(schedule.notes)) {
    return "Pausa de cafe em andamento."
  }
  if (schedule.status === "on_break") {
    return "Intervalo em andamento."
  }
  if (allocation) {
    return `Posto ${allocation.operational_posts?.name ?? "alocado"} em uso.`
  }
  if (status?.current_status === "aguardando_evento") {
    return "Aguardando entrada confirmada."
  }
  if (status?.current_status === "alerta_critico") {
    return "Atenção imediata requerida."
  }
  return "Sem movimentação operacional no momento."
}

export function ControlePDVIntervalos() {
  const today = localDateKey()
  const selectedBranchId = useAppStore((state) => state.selectedBranchId)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date())
    }, 30_000)

    return () => window.clearInterval(timer)
  }, [])

  const nowMs = now.getTime()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  const schedulesQuery = useSchedules(today)
  const statusesQuery = useOperationalStatuses()
  const postsQuery = useOperationalPosts(selectedBranchId)
  const allocationsQuery = usePostAllocations(selectedBranchId)
  const allocationHistoryQuery = useAllocationHistory(selectedBranchId)
  const attendanceQuery = useAttendanceEvents()
  const settingsQuery = useOperationalSettings(selectedBranchId)

  const allocatePost = useAllocatePost()
  const finalizePostAllocation = useFinalizePostAllocation()

  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null)
  const [selectedPostId, setSelectedPostId] = useState<string>("")
  const [searchText, setSearchText] = useState("")
  const [statusFilter, setStatusFilter] = useState<
    "all" | "working" | "break" | "no_post" | "alert"
  >("all")

  const activePosts = useMemo(
    () => (postsQuery.data ?? []).filter((post) => post.active),
    [postsQuery.data]
  )

  const activeAllocations = useMemo(
    () =>
      (allocationsQuery.data ?? []).slice().sort((left, right) => {
        return Date.parse(right.started_at) - Date.parse(left.started_at)
      }),
    [allocationsQuery.data]
  )

  const allocationByScheduleId = useMemo(() => {
    const map = new Map<string, PostAllocation>()
    for (const allocation of activeAllocations) {
      if (allocation.schedule_id) {
        map.set(allocation.schedule_id, allocation)
      }
    }
    return map
  }, [activeAllocations])

  const allocationByPostId = useMemo(() => {
    const map = new Map<string, PostAllocation>()
    for (const allocation of activeAllocations) {
      map.set(allocation.post_id, allocation)
    }
    return map
  }, [activeAllocations])

  const statusByScheduleId = useMemo(() => {
    const map = new Map<string, OperationalStatusRecord>()
    for (const status of statusesQuery.data ?? []) {
      if (status.schedule_id) map.set(status.schedule_id, status)
    }
    return map
  }, [statusesQuery.data])

  const freePosts = useMemo(
    () => activePosts.filter((post) => !allocationByPostId.has(post.id)),
    [activePosts, allocationByPostId]
  )

  const workingSchedules = useMemo(
    () =>
      (schedulesQuery.data ?? [])
        .slice()
        .sort((left, right) => {
          const leftStart = timeToMinutes(left.start_time) ?? 24 * 60
          const rightStart = timeToMinutes(right.start_time) ?? 24 * 60
          if (leftStart !== rightStart) return leftStart - rightStart
          return (left.employees?.name ?? "").localeCompare(right.employees?.name ?? "")
        }),
    [schedulesQuery.data]
  )

  const visibleSchedules = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase()

    return workingSchedules.filter((schedule) => {
      const status = statusByScheduleId.get(schedule.id)
      const allocation = allocationByScheduleId.get(schedule.id) ?? null
      const currentStatus = status?.current_status ?? null
      const hasSearch =
        normalizedSearch.length === 0 ||
        schedule.employees?.name?.toLowerCase().includes(normalizedSearch) ||
        schedule.employees?.sectors?.name?.toLowerCase().includes(normalizedSearch) ||
        schedule.branches?.name?.toLowerCase().includes(normalizedSearch) ||
        (allocation?.operational_posts?.name ?? "").toLowerCase().includes(normalizedSearch)

      if (!hasSearch) return false

      if (statusFilter === "working" && currentStatus && !ACTIVE_STATUS_SET.has(currentStatus)) {
        return false
      }
      if (statusFilter === "break" && schedule.status !== "on_break") return false
      if (statusFilter === "no_post" && allocation) return false
      if (statusFilter === "alert") {
        const overdueCoffee =
          isCoffeeMarker(schedule.notes) &&
          minutesSinceTimeValue(schedule.break_start, nowMinutes) >
            (settingsQuery.data?.coffee_break_duration_minutes ?? 10)
        const overdueBreak =
          schedule.status === "on_break" &&
          Boolean(schedule.break_end) &&
          minutesSinceTimeValue(schedule.break_start, nowMinutes) >
            (settingsQuery.data?.break_tolerance_minutes ?? 15)
        const uncovered =
          Boolean(status && ACTIVE_STATUS_SET.has(status.current_status)) && !allocation
        if (!overdueCoffee && !overdueBreak && !uncovered && status?.current_status !== "alerta_critico") {
          return false
        }
      }

      return true
    })
  }, [
    allocationByScheduleId,
    nowMinutes,
    searchText,
    settingsQuery.data?.break_tolerance_minutes,
    settingsQuery.data?.coffee_break_duration_minutes,
    statusByScheduleId,
    statusFilter,
    workingSchedules,
  ])

  const selectedSchedule = useMemo(
    () => workingSchedules.find((schedule) => schedule.id === selectedScheduleId) ?? null,
    [selectedScheduleId, workingSchedules]
  )

  const selectedStatus = selectedSchedule ? statusByScheduleId.get(selectedSchedule.id) : null
  const selectedAllocation = selectedSchedule
    ? allocationByScheduleId.get(selectedSchedule.id) ?? null
    : null

  const alerts = useMemo(() => {
    const coffeeDuration = settingsQuery.data?.coffee_break_duration_minutes ?? 10
    const breakTolerance = settingsQuery.data?.break_tolerance_minutes ?? 15
    const items: Array<{
      tone: "critical" | "warning" | "info"
      title: string
      detail: string
    }> = []

    for (const schedule of workingSchedules) {
      const status = statusByScheduleId.get(schedule.id)
      const allocation = allocationByScheduleId.get(schedule.id) ?? null

      if (status?.current_status === "alerta_critico") {
        items.push({
          tone: "critical",
          title: schedule.employees?.name ?? "Colaborador",
          detail: status.status_reason ?? "Alerta operacional crítico.",
        })
        continue
      }

      if (isCoffeeMarker(schedule.notes)) {
        const elapsed = minutesSinceTimeValue(schedule.break_start, nowMinutes)
        if (elapsed > coffeeDuration) {
          items.push({
            tone: "warning",
            title: schedule.employees?.name ?? "Colaborador",
            detail: `Cafe acima do limite em ${elapsed - coffeeDuration} min.`,
          })
        }
      }

      if (schedule.status === "on_break" && !isCoffeeMarker(schedule.notes)) {
        if (schedule.break_end) {
          const elapsed = minutesSinceTimeValue(schedule.break_start, nowMinutes)
          if (elapsed > breakTolerance) {
            items.push({
              tone: "warning",
              title: schedule.employees?.name ?? "Colaborador",
              detail: `Intervalo acima da tolerancia em ${elapsed - breakTolerance} min.`,
            })
          }
        }
      }

      if (
        status &&
        ACTIVE_STATUS_SET.has(status.current_status) &&
        !allocation
      ) {
        items.push({
          tone: "info",
          title: schedule.employees?.name ?? "Colaborador",
          detail: "Sem posto alocado para um status ativo.",
        })
      }
    }

    if (freePosts.length === 0) {
      items.push({
        tone: "critical",
        title: "Cobertura",
        detail: "Nao ha postos livres neste momento.",
      })
    }

    return items.slice(0, 6)
  }, [
    allocationByScheduleId,
    freePosts.length,
    nowMinutes,
    settingsQuery.data?.break_tolerance_minutes,
    settingsQuery.data?.coffee_break_duration_minutes,
    statusByScheduleId,
    workingSchedules,
  ])

  const currentEvents = useMemo(
    () => (attendanceQuery.data ?? []).slice(0, 8),
    [attendanceQuery.data]
  )

  const recentAllocations = useMemo(
    () => (allocationHistoryQuery.data ?? []).slice(0, 8),
    [allocationHistoryQuery.data]
  )

  const counts = useMemo(() => {
    const scheduled = workingSchedules.length
    const active = workingSchedules.filter((schedule) => {
      const status = statusByScheduleId.get(schedule.id)
      return Boolean(status && ACTIVE_STATUS_SET.has(status.current_status))
    }).length
    const inBreak = workingSchedules.filter((schedule) => schedule.status === "on_break").length
    const coffee = workingSchedules.filter((schedule) => isCoffeeMarker(schedule.notes)).length
    const withoutPost = workingSchedules.filter((schedule) => {
      const status = statusByScheduleId.get(schedule.id)
      return Boolean(status && ACTIVE_STATUS_SET.has(status.current_status) && !allocationByScheduleId.has(schedule.id))
    }).length

    return {
      scheduled,
      active,
      inBreak,
      coffee,
      occupiedPosts: activeAllocations.length,
      freePosts: freePosts.length,
      withoutPost,
    }
  }, [activeAllocations.length, allocationByScheduleId, freePosts.length, statusByScheduleId, workingSchedules])

  const isLoading =
    schedulesQuery.isLoading ||
    statusesQuery.isLoading ||
    postsQuery.isLoading ||
    allocationsQuery.isLoading ||
    attendanceQuery.isLoading ||
    allocationHistoryQuery.isLoading

  const error =
    schedulesQuery.error ??
    statusesQuery.error ??
    postsQuery.error ??
    allocationsQuery.error ??
    attendanceQuery.error ??
    allocationHistoryQuery.error

  async function handleAllocatePost(schedule: ScheduleWithRelations) {
    if (!selectedPostId) return
    await allocatePost.mutateAsync({
      post_id: selectedPostId,
      employee_id: schedule.employee_id,
      schedule_id: schedule.id,
      notes: "Alocacao realizada pelo controle PDV",
    })
    setSelectedScheduleId(null)
    setSelectedPostId("")
  }

  async function handleReleasePost(allocation: PostAllocation) {
    await finalizePostAllocation.mutateAsync({
      allocation_id: allocation.id,
      notes: "Liberado pelo controle PDV",
    })
    setSelectedScheduleId(null)
  }

  if (isLoading) {
    return <StateBlock type="loading" title="Carregando controle PDV" />
  }

  if (error) {
    return (
      <StateBlock
        type="error"
        title="Erro ao carregar controle PDV"
        description={error.message}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {[
          { label: "Escalados", value: counts.scheduled, icon: Users, tone: "blue" },
          { label: "Em atividade", value: counts.active, icon: CheckCircle2, tone: "green" },
          { label: "Em intervalo", value: counts.inBreak, icon: Coffee, tone: "amber" },
          { label: "Cafes", value: counts.coffee, icon: Timer, tone: "sky" },
          { label: "Sem posto", value: counts.withoutPost, icon: Unlock, tone: "rose" },
          { label: "Livres", value: counts.freePosts, icon: Store, tone: "slate" },
        ].map(({ label, value, icon: Icon, tone }) => (
          <div
            key={label}
            className={cn(
              "rounded-2xl border bg-[color:var(--bg-surface)] p-4 shadow-sm",
              tone === "blue" && "border-blue-200/80 bg-blue-50/30",
              tone === "green" && "border-emerald-200/80 bg-emerald-50/30",
              tone === "amber" && "border-amber-200/80 bg-amber-50/35",
              tone === "sky" && "border-sky-200/80 bg-sky-50/35",
              tone === "rose" && "border-rose-200/80 bg-rose-50/30",
              tone === "slate" && "border-slate-200 bg-slate-50/35"
            )}
          >
            <div className="flex items-center gap-3">
              <div className="rounded-full border border-[color:var(--border-soft)] bg-white p-2 text-[color:var(--text-secondary)]">
                <Icon className="size-4" />
              </div>
              <div>
                <div className="text-2xl font-semibold leading-none text-[color:var(--text-primary)]">
                  {value}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
        <SectionPanel
          id="escala-real"
          title="Escala real do dia"
          variant="original"
          defaultOpen
          headerClassName="rounded-[24px] bg-[color:var(--bg-muted)] px-4 text-[color:var(--text-primary)]"
          contentClassName="rounded-[28px] bg-[color:var(--bg-surface)] p-4"
        >
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Buscar colaborador, setor, filial ou posto"
                className="h-10 rounded-full pl-9"
              />
            </div>
            {(["all", "working", "break", "no_post", "alert"] as const).map((filter) => {
              const labelMap = {
                all: "Todos",
                working: "Ativos",
                break: "Intervalos",
                no_post: "Sem posto",
                alert: "Alertas",
              } as const
              const active = statusFilter === filter
              return (
                <Button
                  key={filter}
                  variant={active ? "default" : "outline"}
                  size="sm"
                  className="rounded-full"
                  onClick={() => setStatusFilter(filter)}
                >
                  {labelMap[filter]}
                </Button>
              )
            })}
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => {
                setSearchText("")
                setStatusFilter("all")
              }}
            >
              Limpar
            </Button>
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            {visibleSchedules.map((schedule) => {
              const status = statusByScheduleId.get(schedule.id)
              const allocation = allocationByScheduleId.get(schedule.id) ?? null
              const tone = badgeTone(schedule, status, allocation)
              const elapsed = allocation
                ? minutesSinceTimestamp(allocation.started_at, nowMs)
                : minutesSinceTimeValue(schedule.start_time, nowMinutes)
              const postName = allocation?.operational_posts?.name ?? "Sem posto"

              return (
                <button
                  key={schedule.id}
                  type="button"
                  className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] p-4 text-left shadow-sm transition hover:border-[color:var(--border-strong)] hover:shadow-md"
                  onClick={() => {
                    setSelectedScheduleId(schedule.id)
                    setSelectedPostId(
                      freePosts[0]?.id ?? allocation?.post_id ?? ""
                    )
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-[color:var(--text-primary)]">
                        {schedule.employees?.name ?? "Colaborador"}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {schedule.employees?.sectors?.name ?? "Sem setor"} ·{" "}
                        {schedule.branches?.name ?? "Filial"}
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn("rounded-full px-2 py-0.5 text-[10px]", tone.className)}
                    >
                      {tone.label}
                    </Badge>
                  </div>

                  <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                    <div className="rounded-2xl bg-[color:var(--bg-surface-soft)] px-3 py-2">
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Jornada
                      </div>
                      <div className="mt-1 font-medium text-[color:var(--text-primary)]">
                        {schedule.start_time ?? "--:--"} → {schedule.end_time ?? "--:--"}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-[color:var(--bg-surface-soft)] px-3 py-2">
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Tempo
                      </div>
                      <div className="mt-1 font-medium text-[color:var(--text-primary)]">
                        {formatDuration(elapsed)}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-[color:var(--bg-surface-soft)] px-3 py-2 sm:col-span-2">
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Posto
                      </div>
                      <div className="mt-1 truncate font-medium text-[color:var(--text-primary)]">
                        {postName}
                      </div>
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-muted-foreground">
                    {currentStatusText(schedule, status, allocation)}
                  </p>
                </button>
              )
            })}
          </div>
        </SectionPanel>

        <div className="space-y-6">
          <SectionPanel
            id="cobertura-pdv"
            title="Postos e cobertura"
            variant="original"
            defaultOpen
            headerClassName="rounded-[24px] bg-[color:var(--bg-muted)] px-4 text-[color:var(--text-primary)]"
            contentClassName="rounded-[28px] bg-[color:var(--bg-surface)] p-4"
          >
            <div className="space-y-2">
              {activePosts.slice(0, 10).map((post) => {
                const allocation = allocationByPostId.get(post.id) ?? null
                return (
                  <button
                    key={post.id}
                    type="button"
                    className={cn(
                      "w-full rounded-2xl border px-3 py-2 text-left transition",
                      allocation
                        ? "border-emerald-200 bg-emerald-50/40"
                        : "border-sky-200 bg-sky-50/40"
                    )}
                    onClick={() => {
                      if (allocation?.schedule_id) {
                        setSelectedScheduleId(allocation.schedule_id)
                        setSelectedPostId(post.id)
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-[color:var(--text-primary)]">
                          {post.name}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">
                          {post.sectors?.name ?? "Sem setor"} ·{" "}
                          {post.branches?.name ?? "Filial"}
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px]",
                          allocation
                            ? "border-emerald-200 bg-white text-emerald-700"
                            : "border-sky-200 bg-white text-sky-700"
                        )}
                      >
                        {allocation ? "Ocupado" : "Livre"}
                      </Badge>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {allocation
                        ? `${allocation.employees?.name ?? "Operador"} desde ${formatDateTimeBR(allocation.started_at)}`
                        : "Disponivel para nova alocacao."}
                    </div>
                  </button>
                )
              })}
            </div>
          </SectionPanel>

          <SectionPanel
            id="alertas-historico"
            title="Alertas e historico"
            variant="original"
            defaultOpen
            headerClassName="rounded-[24px] bg-[color:var(--bg-muted)] px-4 text-[color:var(--text-primary)]"
            contentClassName="rounded-[28px] bg-[color:var(--bg-surface)] p-4"
          >
            <div className="space-y-4">
              <div className="space-y-2">
                {alerts.length === 0 ? (
                  <StateBlock
                    title="Tudo regular"
                    description="Nao ha alertas operacionais no momento."
                  />
                ) : (
                  alerts.map((alert, index) => (
                    <div
                      key={`${alert.title}-${index}`}
                      className={cn(
                        "rounded-2xl border p-3",
                        alert.tone === "critical" &&
                          "border-red-200 bg-red-50 text-red-800",
                        alert.tone === "warning" &&
                          "border-amber-200 bg-amber-50 text-amber-800",
                        alert.tone === "info" &&
                          "border-sky-200 bg-sky-50 text-sky-800"
                      )}
                    >
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        {alert.tone === "critical" ? (
                          <AlertTriangle className="size-4" />
                        ) : alert.tone === "warning" ? (
                          <Timer className="size-4" />
                        ) : (
                          <CheckCircle2 className="size-4" />
                        )}
                        {alert.title}
                      </div>
                      <p className="mt-1 text-xs leading-5 opacity-90">{alert.detail}</p>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Historico de alocacoes
                </div>
                {recentAllocations.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[color:var(--border-soft)] px-3 py-4 text-sm text-muted-foreground">
                    Nenhuma alocacao recente encontrada.
                  </div>
                ) : (
                  recentAllocations.map((allocation) => (
                    <div
                      key={allocation.id}
                      className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-soft)] px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-[color:var(--text-primary)]">
                            {allocation.operational_posts?.name ?? "Posto"}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {allocation.employees?.name ?? "Operador"} ·{" "}
                            {allocation.status === "finalizado" ? "Finalizada" : "Ativa"}
                          </div>
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {formatDateTimeBR(allocation.started_at)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Eventos recentes
                </div>
                {currentEvents.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[color:var(--border-soft)] px-3 py-4 text-sm text-muted-foreground">
                    Nenhum evento recente.
                  </div>
                ) : (
                  currentEvents.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-2xl border border-[color:var(--border-soft)] px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-[color:var(--text-primary)]">
                            {event.employees?.name ?? "Colaborador"}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {eventLabel[event.event_type] ?? event.event_type}
                          </div>
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {formatDateTimeBR(event.event_time)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </SectionPanel>
        </div>
      </div>

      <Dialog
        open={Boolean(selectedSchedule)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedScheduleId(null)
            setSelectedPostId("")
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Controle do colaborador</DialogTitle>
          </DialogHeader>

          {selectedSchedule ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-soft)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold text-[color:var(--text-primary)]">
                      {selectedSchedule.employees?.name ?? "Colaborador"}
                    </div>
                    <div className="mt-0.5 text-sm text-muted-foreground">
                      {selectedSchedule.employees?.sectors?.name ?? "Sem setor"} ·{" "}
                      {selectedSchedule.branches?.name ?? "Filial"}
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs",
                      badgeTone(
                        selectedSchedule,
                        selectedStatus ?? undefined,
                        selectedAllocation
                      ).className
                    )}
                  >
                    {badgeTone(
                      selectedSchedule,
                      selectedStatus ?? undefined,
                      selectedAllocation
                    ).label}
                  </Badge>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-2xl bg-white px-3 py-2">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Entrada
                    </div>
                    <div className="mt-1 text-sm font-medium">
                      {selectedSchedule.start_time ?? "--:--"}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white px-3 py-2">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Intervalo
                    </div>
                    <div className="mt-1 text-sm font-medium">
                      {selectedSchedule.break_start ?? "--:--"} / {selectedSchedule.break_end ?? "--:--"}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white px-3 py-2">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Saida
                    </div>
                    <div className="mt-1 text-sm font-medium">
                      {selectedSchedule.end_time ?? "--:--"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-[color:var(--border-soft)] p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Posto atual
                  </div>
                  <div className="mt-1 text-base font-semibold text-[color:var(--text-primary)]">
                    {selectedAllocation?.operational_posts?.name ?? "Sem posto"}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {selectedAllocation
                      ? `Alocado ha ${formatDuration(
                          minutesSinceTimestamp(selectedAllocation.started_at, nowMs)
                        )}`
                      : "Nenhuma alocacao em andamento."}
                  </div>
                </div>
                <div className="rounded-2xl border border-[color:var(--border-soft)] p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Status operacional
                  </div>
                  <div className="mt-1 text-base font-semibold text-[color:var(--text-primary)]">
                    {selectedStatus?.current_status
                      ? statusMeta[selectedStatus.current_status].label
                      : scheduleStatusLabel[selectedSchedule.status]}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {currentStatusText(selectedSchedule, selectedStatus ?? undefined, selectedAllocation)}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[color:var(--border-soft)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Alocar posto
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Escolha um posto livre para este colaborador.
                    </div>
                  </div>
                  <div className="flex min-w-0 flex-1 gap-2 sm:max-w-md">
                    <select
                      className="h-10 min-w-0 flex-1 rounded-full border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] px-3 text-sm outline-none"
                      value={selectedPostId}
                      onChange={(event) => setSelectedPostId(event.target.value)}
                    >
                      <option value="">Selecione um posto</option>
                      {freePosts.map((post) => (
                        <option key={post.id} value={post.id}>
                          {post.name}
                        </option>
                      ))}
                      {selectedAllocation ? (
                        <option value={selectedAllocation.post_id}>
                          {selectedAllocation.operational_posts?.name ?? "Posto atual"}
                        </option>
                      ) : null}
                    </select>
                    <Button
                      type="button"
                      variant="default"
                      disabled={
                        allocatePost.isPending ||
                        !selectedPostId ||
                        Boolean(selectedAllocation)
                      }
                      onClick={() => void handleAllocatePost(selectedSchedule)}
                    >
                      {allocatePost.isPending ? "Alocando..." : "Alocar"}
                    </Button>
                  </div>
                </div>
                {selectedAllocation ? (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[color:var(--bg-surface-soft)] px-3 py-2">
                    <div className="text-sm text-muted-foreground">
                      Para mover este operador, libere o posto atual primeiro.
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={finalizePostAllocation.isPending}
                      onClick={() => void handleReleasePost(selectedAllocation)}
                    >
                      {finalizePostAllocation.isPending ? "Liberando..." : "Liberar posto"}
                    </Button>
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-dashed border-[color:var(--border-soft)] p-4 text-sm text-muted-foreground">
                Horario de trabalho em andamento:{" "}
                {selectedAllocation
                  ? formatDuration(minutesSinceTimestamp(selectedAllocation.started_at, nowMs))
                  : formatDuration(minutesSinceTimeValue(selectedSchedule.start_time, nowMinutes))}
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSelectedScheduleId(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
