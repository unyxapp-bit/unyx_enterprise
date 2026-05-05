import { useEffect, useMemo, useState } from "react"
import type { FormEvent } from "react"
import { Activity, History, MapPinned, Phone } from "lucide-react"

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
import {
  getSchedulePriorityByMode,
  isCashierContext,
  isResponsibleContext,
} from "@/features/ops/modes/priorityRules"
import {
  useAttendanceEvents,
  useFinalizePostAllocation,
  useOperationalSettings,
  useOperationalStatuses,
  useOrganization,
  usePostAllocations,
  useRecordOperationalEvent,
  useSchedules,
  useSectors,
  useUpdateSchedule,
} from "@/hooks/useUnyxData"
import { formatDateTimeBR, formatTime, minutesLabel, todayISO } from "@/lib/format"
import { eventLabel, operationalActions, statusMeta } from "@/lib/status"
import type {
  AttendanceEventType,
  OperationalSettings,
  OperationalStatus,
  OperationalStatusRecord,
  PostAllocation,
  ScheduleWithRelations,
} from "@/types/domain"

function addNoteMarker(current: string | null, marker: string): string {
  if (!current) return marker
  if (current.includes(marker)) return current
  return `${current},${marker}`
}

const PAGE_SIZE = 12

const fieldClass =
  "h-8 rounded-lg border bg-white px-2.5 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"

type PendingConfirm = {
  scheduleId: string
  eventType: AttendanceEventType
}

type ContextBadge = {
  label: string
  warning: boolean
}

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

function getInitials(name: string): string {
  const parts = name.trim().split(" ").filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return (parts[0][0] ?? "?").toUpperCase()
  return ((parts[0][0] ?? "") + (parts[parts.length - 1][0] ?? "")).toUpperCase()
}

// Maps each operational status to the actions that make sense from that state.
// Cashier employees with require_cashier_cash_count follow the sangria flow
// (intervalo_solicitado) instead of going straight to em_intervalo.
function getAvailableActions(
  status: OperationalStatus | undefined,
  isCashier: boolean,
  requireCashierCashCount: boolean
): AttendanceEventType[] {
  const sangriaFlow = isCashier && requireCashierCashCount

  switch (status) {
    case undefined:
    case "aguardando_evento":
      return ["entrada_confirmada", "atraso_detectado", "falta_detectada"]
    case "trabalhando":
    case "voltou":
      return [
        sangriaFlow ? "intervalo_solicitado" : "intervalo_iniciado",
        "atraso_detectado",
        "ocorrencia_registrada",
        "saida_confirmada",
      ]
    case "aguardando_sangria":
      return ["sangria_confirmada", "ocorrencia_registrada"]
    case "troca_de_caixa":
      return ["troca_caixa_confirmada", "ocorrencia_registrada"]
    case "deve_sair":
      return ["intervalo_iniciado", "saida_confirmada", "ocorrencia_registrada"]
    case "em_intervalo":
      return ["retorno_confirmado", "ocorrencia_registrada"]
    case "alerta_critico":
      return ["entrada_confirmada", "saida_confirmada", "ocorrencia_registrada"]
    case "finalizado":
    case "folga":
      return ["ocorrencia_registrada"]
    default:
      return ["ocorrencia_registrada"]
  }
}

// Returns per-employee contextual badges. Each badge is only included when
// the relevant setting is active AND the employee's role/sector matches.
// warning=true triggers amber styling to signal a live risk.
function getContextBadges(
  schedule: ScheduleWithRelations,
  status: OperationalStatusRecord | undefined,
  settings: OperationalSettings | null | undefined
): ContextBadge[] {
  if (!settings) return []

  const badges: ContextBadge[] = []
  const isCashier = isCashierContext({
    role: schedule.employees?.role,
    sectorName: schedule.employees?.sectors?.name,
  })
  const isResponsible = isResponsibleContext({
    role: schedule.employees?.role,
    sectorName: schedule.employees?.sectors?.name,
  })
  const currentStatus = status?.current_status

  if (settings.require_cashier_cash_count && isCashier) {
    const waitingSangria = currentStatus === "aguardando_sangria"
    badges.push({
      label: waitingSangria ? "Sangria pendente" : "Sangria obrigatória",
      warning: waitingSangria,
    })
  }

  if (settings.block_break_on_peak_hours) {
    const onBreak =
      currentStatus === "em_intervalo" || currentStatus === "aguardando_sangria"
    badges.push({
      label: "Pico protege intervalo",
      warning: onBreak,
    })
  }

  if (settings.require_responsible_presence && isResponsible) {
    const present =
      currentStatus === "trabalhando" || currentStatus === "voltou"
    badges.push({
      label: present ? "Responsável presente" : "Responsável ausente",
      warning: !present,
    })
  }

  return badges
}

// Atraso and Falta require a two-step inline confirmation before firing.
const REQUIRES_CONFIRM = new Set<AttendanceEventType>([
  "atraso_detectado",
  "falta_detectada",
])

// Short overrides for labels that are too terse out of context.
const ACTION_LABEL_OVERRIDE: Partial<Record<AttendanceEventType, string>> = {
  intervalo_iniciado: "Iniciar intervalo",
  troca_caixa_confirmada: "Troca de caixa",
}

function formatHHMM(isoString: string) {
  return new Date(isoString).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function OperationsPage() {
  const [date, setDate] = useState(todayISO())
  const [sectorFilter, setSectorFilter] = useState("")
  const [pageIndex, setPageIndex] = useState(0)
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null)
  const [occurrenceSchedule, setOccurrenceSchedule] =
    useState<ScheduleWithRelations | null>(null)
  const [occurrenceNote, setOccurrenceNote] = useState("")
  const [occurrenceError, setOccurrenceError] = useState<string | null>(null)

  const schedules = useSchedules(date)
  const statuses = useOperationalStatuses()
  const events = useAttendanceEvents()
  const allocations = usePostAllocations()
  const recordEvent = useRecordOperationalEvent()
  const finalize = useFinalizePostAllocation()
  const updateSchedule = useUpdateSchedule()
  const sectors = useSectors()
  const organization = useOrganization()
  const operationalSettings = useOperationalSettings()

  const activeAllocationByEmployeeId = useMemo(() => {
    const map = new Map<string, PostAllocation>()
    for (const alloc of (allocations.data ?? []) as PostAllocation[]) {
      if (!alloc.ended_at) map.set(alloc.employee_id, alloc)
    }
    return map
  }, [allocations.data])

  const mode = getOperationalMode(
    operationalSettings.data?.mode ?? organization.data?.segment
  )
  const modeConfig = modeUiConfig[mode]

  const statusByScheduleId = useMemo(() => {
    const map = new Map<string, OperationalStatusRecord>()
    for (const status of statuses.data ?? []) {
      if (status.schedule_id) map.set(status.schedule_id, status)
    }
    return map
  }, [statuses.data])

  const orderedSchedules = useMemo(() => {
    const all = schedules.data ?? []
    const filtered = sectorFilter
      ? all.filter(
          (schedule) =>
            schedule.employees?.sectors?.name === sectorFilter ||
            (sectorFilter === "__none__" && !schedule.employees?.sectors)
        )
      : all

    return filtered.slice().sort((a, b) => {
      const statusA = statusByScheduleId.get(a.id)
      const statusB = statusByScheduleId.get(b.id)

      return (
        getSchedulePriorityByMode(mode, b, statusB) -
          getSchedulePriorityByMode(mode, a, statusA) ||
        (a.employees?.name ?? "").localeCompare(b.employees?.name ?? "")
      )
    })
  }, [mode, schedules.data, sectorFilter, statusByScheduleId])

  useEffect(() => {
    setPageIndex(0)
  }, [date, sectorFilter])

  const pageCount = Math.ceil(orderedSchedules.length / PAGE_SIZE)
  const pagedSchedules = useMemo(
    () => orderedSchedules.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE),
    [orderedSchedules, pageIndex]
  )

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

    // Cross-module: sync with Alocacao
    const activeAlloc = activeAllocationByEmployeeId.get(schedule.employee_id)

    if (eventType === "entrada_confirmada") {
      // Mark schedule as working
      updateSchedule.mutate({ scheduleId: schedule.id, values: { status: "working" } })
    }

    if (eventType === "intervalo_iniciado") {
      // Free the post + mark schedule on_break
      if (activeAlloc) {
        finalize.mutate({ allocation_id: activeAlloc.id, notes: "Intervalo via operacao" })
      }
      updateSchedule.mutate({
        scheduleId: schedule.id,
        values: { status: "on_break", break_start: nowTime },
      })
    }

    if (eventType === "retorno_confirmado") {
      // Mark schedule as returned + record lunch_done marker
      const notes = addNoteMarker(schedule.notes, "lunch_done")
      updateSchedule.mutate({
        scheduleId: schedule.id,
        values: { status: "returned", break_end: nowTime, notes },
      })
    }

    if (eventType === "saida_confirmada") {
      // Free the post + mark schedule as finished
      if (activeAlloc) {
        finalize.mutate({ allocation_id: activeAlloc.id, notes: "Saida confirmada" })
      }
      updateSchedule.mutate({ scheduleId: schedule.id, values: { status: "finished" } })
    }
  }

  function handleAction(
    schedule: ScheduleWithRelations,
    eventType: AttendanceEventType
  ) {
    if (REQUIRES_CONFIRM.has(eventType)) {
      setPendingConfirm({ scheduleId: schedule.id, eventType })
      return
    }
    void fireAction(schedule, eventType)
  }

  async function handleConfirm(schedule: ScheduleWithRelations) {
    if (!pendingConfirm) return
    try {
      await fireAction(schedule, pendingConfirm.eventType)
      setPendingConfirm(null)
    } catch {
      // error surfaced via recordEvent.error — keep confirm visible so user can cancel
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
              onChange={(event) => setDate(event.target.value)}
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
        <Card className="border bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="size-5" />
              Painel operacional
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-wrap gap-1.5">
              {modeConfig.ruleHighlights.map((rule) => (
                <Badge key={rule} variant="outline">
                  {rule}
                </Badge>
              ))}
            </div>

            {schedules.isLoading || statuses.isLoading ? (
              <StateBlock type="loading" title="Carregando operação" />
            ) : schedules.isError ? (
              <StateBlock
                type="error"
                title="Erro ao carregar operação"
                description={schedules.error.message}
              />
            ) : orderedSchedules.length === 0 ? (
              <StateBlock
                title="Sem escala para operar"
                description="Cadastre a escala do dia antes de registrar eventos."
              />
            ) : (
              <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {pagedSchedules.map((schedule) => {
                  const status = statusByScheduleId.get(schedule.id)
                  const currentStatus = status?.current_status
                  const isDone =
                    currentStatus === "finalizado" || currentStatus === "folga"
                  const isCashier = isCashierContext({
                    role: schedule.employees?.role,
                    sectorName: schedule.employees?.sectors?.name,
                  })
                  const availableActions = getAvailableActions(
                    currentStatus,
                    isCashier,
                    operationalSettings.data?.require_cashier_cash_count ?? false
                  )
                  const contextBadges = getContextBadges(
                    schedule,
                    status,
                    operationalSettings.data
                  )
                  const activeAlloc = activeAllocationByEmployeeId.get(schedule.employee_id)
                  const isPending = pendingConfirm?.scheduleId === schedule.id

                  const flowActions = availableActions.filter(
                    (et) => et !== "ocorrencia_registrada" && et !== "saida_confirmada"
                  )
                  const hasExit = availableActions.includes("saida_confirmada")
                  const hasOccurrence = availableActions.includes("ocorrencia_registrada")

                  const cardMeta = currentStatus ? statusMeta[currentStatus] : null
                  const avatarClass =
                    avatarClassByStatus[currentStatus ?? "aguardando_evento"] ??
                    "bg-slate-200 text-slate-700"

                  return (
                    <div
                      key={schedule.id}
                      className={`flex flex-col rounded-lg border p-4 shadow-sm transition-opacity ${
                        cardMeta ? cardMeta.cardClassName : "border-slate-200 bg-white"
                      } ${isDone ? "opacity-60" : ""}`}
                    >
                      {/* Avatar + status badge */}
                      <div className="flex items-start justify-between gap-2">
                        <div
                          className={`flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${avatarClass}`}
                        >
                          {getInitials(schedule.employees?.name ?? "?")}
                        </div>
                        <StatusBadge status={currentStatus ?? "aguardando_evento"} />
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
                            · intervalo {formatTime(schedule.break_start)}
                          </span>
                        ) : null}
                      </div>

                      {/* Extra badges */}
                      {activeAlloc?.operational_posts?.name ||
                      (status && status.delay_minutes > 0) ||
                      contextBadges.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {activeAlloc?.operational_posts?.name ? (
                            <Badge
                              variant="outline"
                              className="border-blue-200 bg-blue-50 text-blue-700"
                            >
                              <MapPinned className="mr-1 size-3" />
                              {activeAlloc.operational_posts.name}
                            </Badge>
                          ) : null}
                          {status && status.delay_minutes > 0 ? (
                            <Badge variant="destructive">
                              {minutesLabel(status.delay_minutes)} atraso
                            </Badge>
                          ) : null}
                          {contextBadges.map((badge) => (
                            <Badge
                              key={badge.label}
                              variant="outline"
                              className={
                                badge.warning
                                  ? "border-amber-300 bg-amber-50 text-amber-700"
                                  : "border-slate-200 bg-slate-50 text-slate-600"
                              }
                            >
                              {badge.label}
                            </Badge>
                          ))}
                        </div>
                      ) : null}

                      {status?.status_reason ? (
                        <div className="mt-1.5 text-xs text-muted-foreground">
                          {status.status_reason}
                          {status.updated_at ? (
                            <span className="ml-1.5 text-slate-400">
                              · {formatHHMM(status.updated_at)}
                            </span>
                          ) : null}
                        </div>
                      ) : null}

                      {/* Action area — pushed to bottom */}
                      <div className="mt-auto pt-4">
                        {isPending ? (
                          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                            <span className="text-sm text-red-800">
                              Confirmar{" "}
                              <span className="font-medium">
                                {eventLabel[pendingConfirm.eventType].toLowerCase()}
                              </span>
                              ?
                            </span>
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={recordEvent.isPending}
                              onClick={() => void handleConfirm(schedule)}
                            >
                              {recordEvent.isPending ? "Registrando..." : "Confirmar"}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={recordEvent.isPending}
                              onClick={() => setPendingConfirm(null)}
                            >
                              Cancelar
                            </Button>
                          </div>
                        ) : (
                          <>
                            {/* Primary row: main action + phone */}
                            <div className="flex gap-2">
                              {flowActions[0] ? (
                                <Button
                                  variant={
                                    REQUIRES_CONFIRM.has(flowActions[0])
                                      ? "destructive"
                                      : "outline"
                                  }
                                  size="sm"
                                  className="flex-1"
                                  disabled={recordEvent.isPending}
                                  onClick={() => handleAction(schedule, flowActions[0])}
                                >
                                  {ACTION_LABEL_OVERRIDE[flowActions[0]] ??
                                    (operationalActions.find(
                                      (a) => a.eventType === flowActions[0]
                                    )?.label ?? flowActions[0])}
                                </Button>
                              ) : null}
                              {schedule.employees?.phone ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="shrink-0"
                                  asChild
                                >
                                  <a href={`tel:${schedule.employees.phone}`}>
                                    <Phone className="size-4" />
                                  </a>
                                </Button>
                              ) : null}
                            </div>

                            {/* Secondary actions */}
                            {flowActions.length > 1 || hasExit || hasOccurrence ? (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {flowActions.slice(1).map((eventType) => {
                                  const action = operationalActions.find(
                                    (a) => a.eventType === eventType
                                  )
                                  if (!action) return null
                                  const label =
                                    ACTION_LABEL_OVERRIDE[eventType] ?? action.label
                                  return (
                                    <Button
                                      key={eventType}
                                      variant={
                                        REQUIRES_CONFIRM.has(eventType) ? "destructive" : "ghost"
                                      }
                                      size="sm"
                                      className="h-7 text-xs"
                                      disabled={recordEvent.isPending}
                                      onClick={() => handleAction(schedule, eventType)}
                                    >
                                      {label}
                                    </Button>
                                  )
                                })}
                                {hasExit ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs text-slate-600"
                                    disabled={recordEvent.isPending}
                                    onClick={() =>
                                      void fireAction(schedule, "saida_confirmada")
                                    }
                                  >
                                    Confirmar saída
                                  </Button>
                                ) : null}
                                {hasOccurrence ? (
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    className="h-7 text-xs"
                                    disabled={recordEvent.isPending}
                                    onClick={() => setOccurrenceSchedule(schedule)}
                                  >
                                    Ocorrência
                                  </Button>
                                ) : null}
                              </div>
                            ) : null}
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {pageCount > 1 ? (
                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 text-sm text-slate-600">
                  <span>
                    {pageIndex * PAGE_SIZE + 1}–{Math.min((pageIndex + 1) * PAGE_SIZE, orderedSchedules.length)} de {orderedSchedules.length} colaboradores
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
                      const showEllipsisAfter = i === pageIndex + 2 && pageIndex + 2 < pageCount - 2
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

        <Card className="border bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="size-5" />
              Timeline
            </CardTitle>
          </CardHeader>
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
        </Card>
      </div>

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
                onChange={(event) => setOccurrenceNote(event.target.value)}
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
