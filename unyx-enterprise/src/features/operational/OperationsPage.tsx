import { useEffect, useMemo, useState } from "react"
import type { FormEvent } from "react"
import { Activity, ChevronDown, Coffee, History, LogIn, LogOut, RefreshCw, Timer } from "lucide-react"

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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { modeUiConfig } from "@/features/ops/modes/modeUiConfig"
import {
  getOperationalMode,
  operationalModeNames,
} from "@/features/ops/modes/operationalModes"
import { getSchedulePriorityByMode } from "@/features/ops/modes/priorityRules"
import {
  useAttendanceEvents,
  useOperationalSettings,
  useOperationalStatuses,
  useOrganization,
  useRecordOperationalEvent,
  useSchedules,
  useSectors,
  useUpdateSchedule,
} from "@/hooks/useUnyxData"
import { formatDateTimeBR, formatTime, minutesLabel, todayISO } from "@/lib/format"
import { eventLabel, statusMeta } from "@/lib/status"
import type {
  AttendanceEventType,
  OperationalStatus,
  OperationalStatusRecord,
  ScheduleWithRelations,
} from "@/types/domain"

// ─── helpers ─────────────────────────────────────────────────────────────────

function timeToMinutes(time: string | null | undefined): number | null {
  if (!time) return null
  const [h, m] = time.split(":").map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h ${m}min`
}

function nowMinutes(): number {
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes()
}

function addNoteMarker(current: string | null, marker: string): string {
  if (!current) return marker
  if (current.includes(marker)) return current
  return `${current},${marker}`
}

function getInitials(name: string): string {
  const parts = name.trim().split(" ").filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return (parts[0][0] ?? "?").toUpperCase()
  return ((parts[0][0] ?? "") + (parts[parts.length - 1][0] ?? "")).toUpperCase()
}

// ─── constants ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 12

const fieldClass =
  "h-8 rounded-lg border bg-white px-2.5 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"

const avatarClassByStatus: Partial<Record<OperationalStatus, string>> = {
  aguardando_evento: "bg-slate-200 text-slate-700",
  trabalhando: "bg-emerald-100 text-emerald-700",
  deve_sair: "bg-amber-100 text-amber-700",
  aguardando_sangria: "bg-orange-100 text-orange-700",
  troca_de_caixa: "bg-sky-100 text-sky-700",
  em_intervalo: "bg-violet-100 text-violet-700",
  voltou: "bg-teal-100 text-teal-700",
  folga: "bg-zinc-200 text-zinc-600",
  finalizado: "bg-neutral-200 text-neutral-600",
  alerta_critico: "bg-red-100 text-red-700",
}

// Statuses that mean the employee has already entered (excludes finalizado — they've left)
const ENTERED_STATUSES = new Set<OperationalStatus>([
  "trabalhando",
  "voltou",
  "em_intervalo",
  "aguardando_sangria",
  "troca_de_caixa",
  "deve_sair",
  "alerta_critico",
])

type Tab = "em_turno" | "a_chegar"

// ─── page ────────────────────────────────────────────────────────────────────

export function OperationsPage() {
  const [date, setDate] = useState(todayISO())
  const [sectorFilter, setSectorFilter] = useState("")
  const [pageIndex, setPageIndex] = useState(0)
  const [activeTab, setActiveTab] = useState<Tab>("em_turno")
  const [timelineOpen, setTimelineOpen] = useState(true)
  const [occurrenceSchedule, setOccurrenceSchedule] =
    useState<ScheduleWithRelations | null>(null)
  const [occurrenceNote, setOccurrenceNote] = useState("")
  const [occurrenceError, setOccurrenceError] = useState<string | null>(null)

  const schedules = useSchedules(date)
  const statuses = useOperationalStatuses()
  const events = useAttendanceEvents()
  const recordEvent = useRecordOperationalEvent()
  const updateSchedule = useUpdateSchedule()
  const sectors = useSectors()
  const organization = useOrganization()
  const operationalSettings = useOperationalSettings()

  const mode = getOperationalMode(
    operationalSettings.data?.mode ?? organization.data?.segment
  )
  const modeConfig = modeUiConfig[mode]

  const statusByScheduleId = useMemo(() => {
    const map = new Map<string, OperationalStatusRecord>()
    for (const s of statuses.data ?? []) {
      if (s.schedule_id) map.set(s.schedule_id, s)
    }
    return map
  }, [statuses.data])

  // Base list sorted by operational priority
  const sortedSchedules = useMemo(() => {
    const all = schedules.data ?? []
    const filtered = sectorFilter
      ? all.filter(
          (s) =>
            s.employees?.sectors?.name === sectorFilter ||
            (sectorFilter === "__none__" && !s.employees?.sectors)
        )
      : all

    return filtered.slice().sort((a, b) => {
      const sA = statusByScheduleId.get(a.id)
      const sB = statusByScheduleId.get(b.id)
      return (
        getSchedulePriorityByMode(mode, b, sB) -
          getSchedulePriorityByMode(mode, a, sA) ||
        (a.employees?.name ?? "").localeCompare(b.employees?.name ?? "")
      )
    })
  }, [mode, schedules.data, sectorFilter, statusByScheduleId])

  // Tab split
  const emTurno = useMemo(
    () =>
      sortedSchedules.filter((s) => {
        const status = statusByScheduleId.get(s.id)?.current_status
        return status && ENTERED_STATUSES.has(status)
      }),
    [sortedSchedules, statusByScheduleId]
  )

  const aChegar = useMemo(
    () =>
      sortedSchedules
        .filter((s) => {
          const status = statusByScheduleId.get(s.id)?.current_status
          return !status || status === "aguardando_evento"
        })
        .sort((a, b) => {
          const ta = a.start_time ?? ""
          const tb = b.start_time ?? ""
          if (!ta && tb) return 1
          if (ta && !tb) return -1
          return ta.localeCompare(tb)
        }),
    [sortedSchedules, statusByScheduleId]
  )

  const activeList = activeTab === "em_turno" ? emTurno : aChegar

  useEffect(() => {
    setPageIndex(0)
  }, [date, sectorFilter, activeTab])

  const pageCount = Math.ceil(activeList.length / PAGE_SIZE)
  const pagedSchedules = useMemo(
    () => activeList.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE),
    [activeList, pageIndex]
  )

  // ── actions ──

  async function fireAction(
    schedule: ScheduleWithRelations,
    eventType: AttendanceEventType
  ) {
    const now = new Date()
    const nowTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`

    await recordEvent.mutateAsync({
      branch_id: schedule.branch_id,
      employee_id: schedule.employee_id,
      schedule_id: schedule.id,
      event_type: eventType,
      notes: eventLabel[eventType],
    })

    if (eventType === "entrada_confirmada") {
      updateSchedule.mutate({ scheduleId: schedule.id, values: { status: "working" } })
    }

    if (eventType === "intervalo_iniciado") {
      updateSchedule.mutate({
        scheduleId: schedule.id,
        values: { status: "on_break", break_start: nowTime },
      })
    }

    if (eventType === "retorno_confirmado") {
      const notes = addNoteMarker(schedule.notes, "lunch_done")
      updateSchedule.mutate({
        scheduleId: schedule.id,
        values: { status: "returned", break_end: nowTime, notes },
      })
    }

    if (eventType === "saida_confirmada") {
      updateSchedule.mutate({ scheduleId: schedule.id, values: { status: "finished" } })
    }
  }

  async function handleOccurrenceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setOccurrenceError(null)
    if (!occurrenceSchedule) return
    if (!occurrenceNote.trim()) {
      setOccurrenceError("Descreva a ocorrência.")
      return
    }
    await recordEvent.mutateAsync({
      branch_id: occurrenceSchedule.branch_id,
      employee_id: occurrenceSchedule.employee_id,
      schedule_id: occurrenceSchedule.id,
      event_type: "ocorrencia_registrada",
      notes: occurrenceNote.trim(),
    })
    setOccurrenceNote("")
    setOccurrenceSchedule(null)
  }

  // ─── render ──────────────────────────────────────────────────────────────

  return (
    <>
      <PageHeader
        title={modeConfig.liveTitle}
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
            {(sectors.data ?? []).length > 0 ? (
              <select
                className={fieldClass}
                value={sectorFilter}
                onChange={(e) => setSectorFilter(e.target.value)}
              >
                <option value="">Todos os setores</option>
                {(sectors.data ?? []).map((sector) => (
                  <option key={sector.id} value={sector.name}>
                    {sector.name}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-4 p-6 xl:grid-cols-[1.35fr_0.65fr]">

        {/* ── Painel operacional ── */}
        <Card className="border bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="size-5" />
              <span className="flex-1">Painel operacional</span>
              <button
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-slate-100 hover:text-slate-900"
                onClick={() => { void schedules.refetch(); void statuses.refetch() }}
                disabled={schedules.isFetching || statuses.isFetching}
                aria-label="Atualizar"
              >
                <RefreshCw className={`size-4 ${schedules.isFetching || statuses.isFetching ? "animate-spin" : ""}`} />
              </button>
            </CardTitle>
          </CardHeader>
          <CardContent>

            {/* Tabs */}
            <div className="mb-4 flex gap-1 rounded-lg border bg-slate-50 p-1">
              <button
                onClick={() => setActiveTab("em_turno")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  activeTab === "em_turno"
                    ? "bg-white shadow-sm text-slate-900"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Em turno
                <span
                  className={`rounded-full px-1.5 py-0.5 text-xs tabular-nums ${
                    activeTab === "em_turno"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {emTurno.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab("a_chegar")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  activeTab === "a_chegar"
                    ? "bg-white shadow-sm text-slate-900"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                A chegar
                <span
                  className={`rounded-full px-1.5 py-0.5 text-xs tabular-nums ${
                    activeTab === "a_chegar"
                      ? "bg-slate-800 text-white"
                      : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {aChegar.length}
                </span>
              </button>
            </div>

            {schedules.isLoading || statuses.isLoading ? (
              <StateBlock type="loading" title="Carregando operação" />
            ) : schedules.isError ? (
              <StateBlock
                type="error"
                title="Erro ao carregar operação"
                description={schedules.error.message}
              />
            ) : activeList.length === 0 ? (
              <StateBlock
                title={
                  activeTab === "em_turno"
                    ? "Nenhum colaborador em turno"
                    : "Todos os colaboradores já entraram"
                }
                description={
                  activeTab === "em_turno"
                    ? "Confirme entradas para ver colaboradores aqui."
                    : "Sem previsão de novos colaboradores para hoje."
                }
              />
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {pagedSchedules.map((schedule) => {
                    const statusRecord = statusByScheduleId.get(schedule.id)
                    const currentStatus = statusRecord?.current_status
                    const isDone =
                      currentStatus === "finalizado" || currentStatus === "folga"

                    const nowMin = nowMinutes()
                    const startMin = timeToMinutes(schedule.start_time)
                    const breakStartMin = timeToMinutes(schedule.break_start)
                    const breakEndMin = timeToMinutes(schedule.break_end)

                    // Time worked since shift start (only if entered)
                    const timeWorked =
                      currentStatus &&
                      ENTERED_STATUSES.has(currentStatus) &&
                      currentStatus !== "finalizado" &&
                      startMin !== null &&
                      nowMin > startMin
                        ? formatDuration(nowMin - startMin)
                        : null

                    // Time until break (only if break not yet done)
                    const breakDone =
                      schedule.notes?.includes("lunch_done") ||
                      currentStatus === "voltou" ||
                      currentStatus === "em_intervalo" ||
                      (breakEndMin !== null && nowMin > breakEndMin)
                    const timeUntilBreak =
                      !breakDone &&
                      breakStartMin !== null &&
                      nowMin < breakStartMin
                        ? formatDuration(breakStartMin - nowMin)
                        : null

                    const cardMeta = currentStatus ? statusMeta[currentStatus] : null
                    const avatarClass =
                      avatarClassByStatus[currentStatus ?? "aguardando_evento"] ??
                      "bg-slate-200 text-slate-700"

                    // Button states
                    const canEntrada =
                      !currentStatus || currentStatus === "aguardando_evento"
                    const canIntervalo =
                      currentStatus === "trabalhando" ||
                      currentStatus === "voltou" ||
                      currentStatus === "deve_sair"
                    const canSaida =
                      !!currentStatus && ENTERED_STATUSES.has(currentStatus)

                    // Late indicator (only in A chegar tab)
                    const isLate =
                      activeTab === "a_chegar" &&
                      startMin !== null &&
                      nowMin > startMin &&
                      (!currentStatus || currentStatus === "aguardando_evento")
                    const lateMinutes = isLate ? nowMin - (startMin ?? 0) : 0

                    const cardBorderClass = isLate
                      ? "border-orange-300 bg-orange-50/40"
                      : cardMeta
                        ? cardMeta.cardClassName
                        : "border-slate-200 bg-white"

                    return (
                      <div
                        key={schedule.id}
                        className={`flex flex-col rounded-lg border p-4 shadow-sm transition-opacity ${cardBorderClass} ${isDone ? "opacity-60" : ""}`}
                      >
                        {/* Header: avatar + status */}
                        <div className="flex items-start justify-between gap-2">
                          <div
                            className={`flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${avatarClass}`}
                          >
                            {getInitials(schedule.employees?.name ?? "?")}
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <StatusBadge status={currentStatus ?? "aguardando_evento"} />
                            {isLate ? (
                              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700">
                                {formatDuration(lateMinutes)} atrasado
                              </span>
                            ) : null}
                          </div>
                        </div>

                        {/* Name + role/sector */}
                        <div className="mt-3">
                          <div className="text-sm font-semibold leading-tight">
                            {schedule.employees?.name ?? "Colaborador"}
                          </div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {[
                              schedule.employees?.role,
                              schedule.employees?.sectors?.name ?? "Sem setor",
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                        </div>

                        {/* Schedule times */}
                        <div className="mt-2 text-xs text-muted-foreground">
                          {formatTime(schedule.start_time)} → {formatTime(schedule.end_time)}
                          {schedule.break_start ? (
                            <span className="ml-2 text-slate-400">
                              · int. {formatTime(schedule.break_start)}
                            </span>
                          ) : null}
                        </div>

                        {/* Time worked + time until break (Em turno only) */}
                        {activeTab === "em_turno" && (timeWorked || timeUntilBreak) ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {timeWorked ? (
                              <span className="flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                                <Timer className="size-3" />
                                {timeWorked} trabalhando
                              </span>
                            ) : null}
                            {timeUntilBreak ? (
                              <span className="flex items-center gap-1 rounded-md bg-violet-50 px-2 py-0.5 text-xs text-violet-700">
                                <Coffee className="size-3" />
                                int. em {timeUntilBreak}
                              </span>
                            ) : null}
                          </div>
                        ) : null}

                        {/* Delay badge */}
                        {statusRecord && statusRecord.delay_minutes > 0 ? (
                          <div className="mt-2">
                            <Badge variant="destructive">
                              {minutesLabel(statusRecord.delay_minutes)} atraso
                            </Badge>
                          </div>
                        ) : null}

                        {/* Last event reason */}
                        {statusRecord?.status_reason ? (
                          <div className="mt-1.5 text-xs text-muted-foreground">
                            {statusRecord.status_reason}
                          </div>
                        ) : null}

                        {/* Action buttons */}
                        <div className="mt-auto pt-4">
                          {activeTab === "a_chegar" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex w-full items-center justify-center gap-1.5 text-xs"
                              disabled={!canEntrada || recordEvent.isPending}
                              onClick={() => void fireAction(schedule, "entrada_confirmada")}
                            >
                              <LogIn className="size-3.5" />
                              Confirmar entrada
                            </Button>
                          ) : (
                            <div className="grid grid-cols-2 gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex flex-col gap-0.5 h-auto py-2 text-xs"
                                disabled={!canEntrada || recordEvent.isPending}
                                onClick={() => void fireAction(schedule, "entrada_confirmada")}
                              >
                                <LogIn className="size-3.5" />
                                Entrada
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex flex-col gap-0.5 h-auto py-2 text-xs"
                                disabled={!canIntervalo || recordEvent.isPending}
                                onClick={() => void fireAction(schedule, "intervalo_iniciado")}
                              >
                                <Timer className="size-3.5" />
                                Intervalo
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex flex-col gap-0.5 h-auto py-2 text-xs"
                                disabled
                              >
                                <Coffee className="size-3.5" />
                                Café
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex flex-col gap-0.5 h-auto py-2 text-xs"
                                disabled={!canSaida || recordEvent.isPending}
                                onClick={() => void fireAction(schedule, "saida_confirmada")}
                              >
                                <LogOut className="size-3.5" />
                                Saída
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {pageCount > 1 ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-4 text-sm text-slate-600">
                    <span>
                      {pageIndex * PAGE_SIZE + 1}–{Math.min((pageIndex + 1) * PAGE_SIZE, activeList.length)} de {activeList.length} colaboradores
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        className="rounded-md border bg-white px-3 py-1.5 text-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                        onClick={() => setPageIndex((p) => p - 1)}
                        disabled={pageIndex === 0}
                      >
                        Anterior
                      </button>
                      {Array.from({ length: pageCount }, (_, i) => {
                        const show =
                          pageCount <= 7 ||
                          i === 0 ||
                          i === pageCount - 1 ||
                          Math.abs(i - pageIndex) <= 1
                        const showEllipsisBefore = i === pageIndex - 2 && pageIndex - 2 > 1
                        const showEllipsisAfter =
                          i === pageIndex + 2 && pageIndex + 2 < pageCount - 2
                        if (showEllipsisBefore || showEllipsisAfter) {
                          return <span key={i} className="px-1 text-slate-400">…</span>
                        }
                        if (!show) return null
                        return (
                          <button
                            key={i}
                            className={`min-w-[32px] rounded-md border px-2 py-1.5 text-sm transition-colors ${
                              i === pageIndex
                                ? "border-indigo-600 bg-indigo-600 font-semibold text-white"
                                : "bg-white hover:bg-slate-50"
                            }`}
                            onClick={() => setPageIndex(i)}
                          >
                            {i + 1}
                          </button>
                        )
                      })}
                      <button
                        className="rounded-md border bg-white px-3 py-1.5 text-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                        onClick={() => setPageIndex((p) => p + 1)}
                        disabled={pageIndex === pageCount - 1}
                      >
                        Próximo
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

        {/* ── Timeline (collapsible) ── */}
        <Card className="self-start border bg-white shadow-sm">
          <CardHeader
            className="cursor-pointer select-none"
            onClick={() => setTimelineOpen((v) => !v)}
          >
            <CardTitle className="flex items-center gap-2">
              <History className="size-5" />
              <span className="flex-1">Timeline</span>
              <ChevronDown
                className={`size-4 text-muted-foreground transition-transform duration-200 ${
                  timelineOpen ? "rotate-180" : ""
                }`}
              />
            </CardTitle>
          </CardHeader>
          {timelineOpen ? (
            <CardContent>
              {events.isLoading ? (
                <StateBlock type="loading" title="Carregando eventos" />
              ) : events.isError ? (
                <StateBlock
                  type="error"
                  title="Erro ao carregar eventos"
                  description={events.error.message}
                />
              ) : (events.data ?? []).length === 0 ? (
                <StateBlock title="Nenhum evento registrado" />
              ) : (
                <div className="space-y-3">
                  {(events.data ?? []).slice(0, 12).map((event) => (
                    <div key={event.id} className="rounded-lg border bg-slate-50 p-3">
                      <div className="text-sm font-medium">
                        {eventLabel[event.event_type]}
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {event.employees?.name ?? "Colaborador"} ·{" "}
                        {formatDateTimeBR(event.event_time)}
                      </div>
                      {event.notes ? (
                        <div className="mt-2 text-sm text-muted-foreground">
                          {event.notes}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          ) : null}
        </Card>
      </div>

      {/* ── Occurrence dialog ── */}
      <Dialog
        open={Boolean(occurrenceSchedule)}
        onOpenChange={(open) => {
          if (!open) {
            setOccurrenceSchedule(null)
            setOccurrenceNote("")
            setOccurrenceError(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar ocorrência</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleOccurrenceSubmit}>
            <div className="rounded-lg border bg-slate-50 p-3 text-sm">
              <div className="font-medium">
                {occurrenceSchedule?.employees?.name ?? "Colaborador"}
              </div>
              <div className="mt-1 text-muted-foreground">
                {occurrenceSchedule?.employees?.sectors?.name ?? "Sem setor"} ·{" "}
                {occurrenceSchedule?.branches?.name ?? "Filial"}
              </div>
            </div>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Descrição da ocorrência</span>
              <textarea
                className="min-h-28 w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"
                value={occurrenceNote}
                onChange={(e) => setOccurrenceNote(e.target.value)}
                placeholder="Ex.: colaborador precisou cobrir outro setor por falta inesperada."
              />
            </label>
            {occurrenceError || recordEvent.error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {occurrenceError ?? recordEvent.error?.message}
              </div>
            ) : null}
            <DialogFooter>
              <Button type="submit" disabled={recordEvent.isPending}>
                {recordEvent.isPending ? "Registrando..." : "Registrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
