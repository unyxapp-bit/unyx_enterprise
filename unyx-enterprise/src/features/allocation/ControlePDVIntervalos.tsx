import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  Ban,
  CheckCircle2,
  Clock3,
  RotateCcw,
  Search,
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
import { Select } from "@/components/ui/select"
import {
  useAdjustPostAllocationStart,
  useAllocatePost,
  useFinalizePostAllocation,
  useOperationalPosts,
  useOperationalBreaks,
  useOperationalBreakSettings,
  useOperationalSettings,
  useOperationalStatuses,
  usePostAllocations,
  useRecordOperationalEvent,
  useRecordBreakAlreadyDone,
  useRegisterEmployeeBreakDelay,
  useReleaseEmployeeBreak,
  useRescheduleEmployeeBreak,
  useReturnEmployeeBreak,
  useCancelEmployeeBreak,
  useSchedules,
} from "@/hooks/useUnyxData"
import { scheduleStatusLabel, statusMeta } from "@/lib/status"
import { cn } from "@/lib/utils"
import {
  formatDuration,
  localDateKey,
  timeToMinutes,
} from "@/features/operational/utils"
import type {
  OperationalBreak,
  OperationalBreakStatus,
  OperationalBreakType,
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

const WORK_STARTED_STATUS_SET = new Set([
  ...ACTIVE_STATUS_SET,
  "aguardando_sangria",
  "troca_de_caixa",
  "deve_sair",
  "em_intervalo",
])

const NON_WORKING_SCHEDULE_STATUS_SET = new Set([
  "absent",
  "day_off",
  "banked_hours",
  "cancelled",
  "finished",
])

const ACTIVE_BREAK_STATUS_SET = new Set<OperationalBreakStatus>([
  "pendente",
  "liberado",
  "atrasado",
])

const COFFEE_BREAK_TYPES: OperationalBreakType[] = ["cafe_manha", "cafe_tarde"]
const INTERVAL_DELAY_NOTICE_MINUTES = 10

export type ControlePDVTab = "overview" | "releases"

interface ControlePDVIntervalosProps {
  tab?: ControlePDVTab
}

const breakTypeLabel: Record<OperationalBreakType, string> = {
  cafe_manha: "Café manhã",
  cafe_tarde: "Café tarde",
  intervalo: "Intervalo",
}

const breakStatusLabel: Record<OperationalBreakStatus, string> = {
  pendente: "Pendente",
  liberado: "Liberado",
  retornou: "Retornou",
  atrasado: "Atrasado",
  cancelado: "Cancelado",
}

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

function compareSchedulesByStartTime(
  left: ScheduleWithRelations,
  right: ScheduleWithRelations
) {
  const leftStart = timeToMinutes(left.start_time) ?? 24 * 60
  const rightStart = timeToMinutes(right.start_time) ?? 24 * 60
  if (leftStart !== rightStart) return leftStart - rightStart

  return (left.employees?.name ?? "").localeCompare(right.employees?.name ?? "")
}

function scheduleEndState(schedule: ScheduleWithRelations, nowMinutes: number) {
  const end = timeToMinutes(schedule.end_time)
  if (end === null) {
    return { hasReachedEnd: false, overtimeMinutes: 0 }
  }

  const start = timeToMinutes(schedule.start_time)
  let normalizedEnd = end
  let normalizedNow = nowMinutes

  if (start !== null && end <= start) {
    normalizedEnd += 24 * 60
    if (normalizedNow < start) normalizedNow += 24 * 60
  }

  const diff = normalizedNow - normalizedEnd
  return {
    hasReachedEnd: diff >= 0,
    overtimeMinutes: Math.max(0, diff),
  }
}

function hasStartTimeArrived(
  start: string | null | undefined,
  currentMinutes: number
) {
  const startMin = timeToMinutes(start)
  return startMin !== null && currentMinutes >= startMin
}

function isNowInsideTimeWindow(
  start: string | null | undefined,
  end: string | null | undefined,
  currentMinutes: number
) {
  const startMin = timeToMinutes(start)
  const endMin = timeToMinutes(end)
  if (startMin === null || endMin === null) return false
  if (startMin === endMin) return currentMinutes === startMin

  if (endMin < startMin) {
    return currentMinutes >= startMin || currentMinutes <= endMin
  }

  return currentMinutes >= startMin && currentMinutes <= endMin
}

/** "HH:MM" de um dia (yyyy-mm-dd) no fuso local -> ISO. */
function isoFromDayAndTime(dateKey: string, hhmm: string) {
  const [year, month, day] = dateKey.split("-").map(Number)
  const [hours, minutes] = hhmm.split(":").map(Number)
  return new Date(year, month - 1, day, hours, minutes).toISOString()
}

function hhmmFromIso(iso: string) {
  const date = new Date(iso)
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const POST_EXIT_REASONS = [
  { value: "Saída antecipada", label: "Saída antecipada do colaborador" },
  { value: "Fim do turno", label: "Fim do turno" },
  { value: "Troca de posto", label: "Troca de posto" },
  { value: "Outro motivo", label: "Outro motivo" },
]

function formatTimeValue(value: string | null | undefined) {
  if (!value) return "--:--"
  return value.slice(0, 5)
}

function timeWindowLabel(
  label: string,
  start: string | null | undefined,
  end: string | null | undefined
) {
  return `${label} ${formatTimeValue(start)} - ${formatTimeValue(end)}`
}

function timeWindowProgress(
  start: string | null | undefined,
  end: string | null | undefined,
  currentMinutes: number
) {
  const startMin = timeToMinutes(start)
  if (startMin === null) return null

  const endMin = timeToMinutes(end)
  let normalizedNow = currentMinutes
  let normalizedEnd = endMin

  if (endMin !== null && endMin <= startMin) {
    normalizedEnd = endMin + 24 * 60
    if (normalizedNow < startMin) normalizedNow += 24 * 60
  }

  return {
    minutesUntilStart: startMin - normalizedNow,
    minutesSinceStart: Math.max(0, normalizedNow - startMin),
    minutesAfterEnd:
      normalizedEnd === null ? null : normalizedNow - normalizedEnd,
  }
}

function timeWindowDuration(
  start: string | null | undefined,
  end: string | null | undefined
) {
  const startMin = timeToMinutes(start)
  const endMin = timeToMinutes(end)
  if (startMin === null || endMin === null) return null

  let duration = endMin - startMin
  if (duration <= 0) duration += 24 * 60
  return duration
}

function durationSummary(values: number[]) {
  const durations = [...new Set(values)].sort((left, right) => left - right)
  if (durations.length === 0) return "Conforme escala"
  if (durations.length <= 3) {
    return durations.map((duration) => formatDuration(duration)).join(" / ")
  }

  return `${formatDuration(durations[0])} - ${formatDuration(
    durations[durations.length - 1]
  )}`
}

function breakTimerState(item: OperationalBreak, nowMs: number) {
  const plannedStartMs = Date.parse(item.planned_start)
  const plannedEndMs = Date.parse(item.planned_end)
  const actualStartMs = item.actual_start
    ? Date.parse(item.actual_start)
    : plannedStartMs

  if (!Number.isNaN(actualStartMs) && nowMs < actualStartMs) {
    return {
      label: `Comeca em ${formatDuration(Math.ceil((actualStartMs - nowMs) / 60_000))}`,
      isOverdue: false,
    }
  }

  if (!Number.isNaN(plannedEndMs)) {
    const minutes = Math.max(0, Math.ceil(Math.abs(plannedEndMs - nowMs) / 60_000))

    if (nowMs <= plannedEndMs) {
      return {
        label: `Restam ${formatDuration(minutes)}`,
        isOverdue: false,
      }
    }

    return {
      label: `Atrasado ha ${formatDuration(minutes)}`,
      isOverdue: true,
    }
  }

  return {
    label: `Em andamento ha ${formatDuration(
      minutesSinceTimestamp(item.actual_start ?? item.planned_start, nowMs)
    )}`,
    isOverdue: false,
  }
}

function breakActionLabel(type: OperationalBreakType) {
  if (type === "intervalo") return "Liberar intervalo"
  return `Liberar ${breakTypeLabel[type].toLowerCase()}`
}

function breakTypeSummary(types: OperationalBreakType[]) {
  const hasCoffee = types.some((type) => type === "cafe_manha" || type === "cafe_tarde")
  const hasInterval = types.includes("intervalo")

  if (hasCoffee && hasInterval) return "Café + intervalo"
  if (hasCoffee) return "Café"
  return "Intervalo"
}

function intervalNoticeClassName(tone: "info" | "success" | "warning" | "critical") {
  if (tone === "critical") return "border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-red-800 dark:text-red-300"
  if (tone === "warning") return "border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300"
  if (tone === "success") return "border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
  return "border-sky-200 dark:border-sky-500/30 bg-sky-50 dark:bg-sky-500/10 text-sky-800 dark:text-sky-300"
}

function intervalNoticeState(
  schedule: ScheduleWithRelations,
  operationalBreak: OperationalBreak | null,
  nowMs: number,
  nowMinutes: number,
  hasOperationalEntry: boolean
) {
  if (
    operationalBreak &&
    ACTIVE_BREAK_STATUS_SET.has(operationalBreak.status)
  ) {
    const timerState = breakTimerState(operationalBreak, nowMs)

    if (operationalBreak.break_type !== "intervalo") {
      return {
        tone: timerState.isOverdue ? ("warning" as const) : ("success" as const),
        title: `${breakTypeLabel[operationalBreak.break_type]} em andamento`,
        detail: timerState.label,
        action: null,
      }
    }

    if (timerState.isOverdue) {
      return {
        tone: "critical" as const,
        title: "Retorno do intervalo pendente",
        detail: `Intervalo encerrado. ${timerState.label}.`,
        action: "return" as const,
      }
    }

    return {
      tone: "success" as const,
      title: "Intervalo em andamento",
      detail: timerState.label,
      action: null,
    }
  }

  if (schedule.status === "returned") return null

  const progress = timeWindowProgress(
    schedule.break_start,
    schedule.break_end,
    nowMinutes
  )

  if (!progress) return null

  if (schedule.status === "on_break" && !isCoffeeMarker(schedule.notes)) {
    if (progress.minutesAfterEnd !== null && progress.minutesAfterEnd > 0) {
      return {
        tone: "critical" as const,
        title: "Retorno do intervalo pendente",
        detail: `Intervalo acabou ha ${formatDuration(progress.minutesAfterEnd)}.`,
        action: null,
      }
    }

    return {
      tone: "success" as const,
      title: "Intervalo em andamento",
      detail:
        progress.minutesAfterEnd === null
          ? `Em intervalo ha ${formatDuration(progress.minutesSinceStart)}.`
          : `Restam ${formatDuration(
              Math.max(0, Math.abs(progress.minutesAfterEnd))
            )}.`,
      action: null,
    }
  }

  if (progress.minutesUntilStart > 0) {
    return {
      tone: "info" as const,
      title: "Intervalo programado",
      detail: `Faltam ${formatDuration(progress.minutesUntilStart)}.`,
      action: null,
    }
  }

  if (!hasOperationalEntry) return null

  if (progress.minutesAfterEnd !== null && progress.minutesAfterEnd > 0) {
    return {
      tone: "warning" as const,
      title: "Intervalo sem registro",
      detail: `Janela terminou ha ${formatDuration(
        progress.minutesAfterEnd
      )}. Confirme se foi realizado no horario da escala.`,
      action: "confirmDone" as const,
    }
  }

  if (progress.minutesSinceStart >= INTERVAL_DELAY_NOTICE_MINUTES) {
    return {
      tone: "warning" as const,
      title: "Intervalo atrasado",
      detail: `Trabalhando sem intervalo ha ${formatDuration(
        progress.minutesSinceStart
      )}.`,
      action: "release" as const,
    }
  }

  return {
    tone: "success" as const,
    title: "Pode sair para intervalo",
    detail:
      progress.minutesSinceStart > 0
        ? `Janela aberta ha ${formatDuration(progress.minutesSinceStart)}.`
        : "Horário de intervalo chegou.",
    action: "release" as const,
  }
}

function formatTimeBR(value: string | null | undefined) {
  if (!value) return "--:--"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "--:--"
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function isBreakFromDay(item: OperationalBreak, dateKey: string) {
  return (
    item.schedules?.work_date === dateKey ||
    item.planned_start.slice(0, 10) === dateKey ||
    ACTIVE_BREAK_STATUS_SET.has(item.status)
  )
}

function breakStatusClassName(status: OperationalBreakStatus) {
  if (status === "atrasado") return "border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300"
  if (status === "liberado") return "border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300"
  if (status === "retornou") return "border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
  if (status === "cancelado") return "border-zinc-200 bg-zinc-50 text-zinc-600"
  return "border-sky-200 dark:border-sky-500/30 bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300"
}

function badgeTone(
  schedule: ScheduleWithRelations,
  status: OperationalStatusRecord | undefined,
  allocation: PostAllocation | null,
  operationalBreak?: OperationalBreak | null
) {
  if (operationalBreak?.status === "atrasado") {
    return {
      label: "Atrasado",
      className: "border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300",
    }
  }

  if (operationalBreak && ACTIVE_BREAK_STATUS_SET.has(operationalBreak.status)) {
    return {
      label:
        operationalBreak.break_type === "intervalo"
          ? "Em intervalo"
          : "Em café",
      className: "border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300",
    }
  }

  if (status?.current_status === "alerta_critico") {
    return {
      label: statusMeta.alerta_critico.label,
      className: "border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300",
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
          label: "Café",
          className: "border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300",
        }
      : {
          label: "Almoco",
          className: "border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300",
        }
  }

  if (allocation) {
    return {
      label: "Em posto",
      className: "border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
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
  allocation: PostAllocation | null,
  operationalBreak?: OperationalBreak | null
) {
  if (operationalBreak && ACTIVE_BREAK_STATUS_SET.has(operationalBreak.status)) {
    return `${breakTypeLabel[operationalBreak.break_type]} liberado até ${formatTimeBR(operationalBreak.planned_end)}.`
  }
  if (status?.status_reason) return status.status_reason
  if (schedule.status === "on_break" && isCoffeeMarker(schedule.notes)) {
    return "Pausa de café em andamento."
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

export function ControlePDVIntervalos({ tab = "overview" }: ControlePDVIntervalosProps) {
  const today = localDateKey()
  const selectedBranchId = useAppStore((state) => state.selectedBranchId)
  const [now, setNow] = useState(() => new Date())
  const [dayUiState, setDayUiState] = useState(() => ({
    day: today,
    overtimeScheduleIds: new Set<string>(),
    hiddenScheduleIds: new Set<string>(),
  }))

  const currentDayUiState =
    dayUiState.day === today
      ? dayUiState
      : {
          day: today,
          overtimeScheduleIds: new Set<string>(),
          hiddenScheduleIds: new Set<string>(),
        }
  const overtimeScheduleIds = currentDayUiState.overtimeScheduleIds
  const hiddenScheduleIds = currentDayUiState.hiddenScheduleIds

  const updateOvertimeScheduleIds = (
    update: (current: Set<string>) => Set<string>
  ) => {
    setDayUiState((current) => {
      const base =
        current.day === today
          ? current
          : {
              day: today,
              overtimeScheduleIds: new Set<string>(),
              hiddenScheduleIds: new Set<string>(),
            }
      return {
        ...base,
        overtimeScheduleIds: update(base.overtimeScheduleIds),
      }
    })
  }

  const updateHiddenScheduleIds = (
    update: (current: Set<string>) => Set<string>
  ) => {
    setDayUiState((current) => {
      const base =
        current.day === today
          ? current
          : {
              day: today,
              overtimeScheduleIds: new Set<string>(),
              hiddenScheduleIds: new Set<string>(),
            }
      return { ...base, hiddenScheduleIds: update(base.hiddenScheduleIds) }
    })
  }

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
  const operationalBreaksQuery = useOperationalBreaks(selectedBranchId)
  const breakSettingsQuery = useOperationalBreakSettings(selectedBranchId)
  const settingsQuery = useOperationalSettings(selectedBranchId)

  const allocatePost = useAllocatePost()
  const adjustAllocationStart = useAdjustPostAllocationStart()
  const finalizePostAllocation = useFinalizePostAllocation()
  const releaseEmployeeBreak = useReleaseEmployeeBreak()
  const returnEmployeeBreak = useReturnEmployeeBreak()
  const cancelEmployeeBreak = useCancelEmployeeBreak()
  const rescheduleEmployeeBreak = useRescheduleEmployeeBreak()
  const registerEmployeeBreakDelay = useRegisterEmployeeBreakDelay()
  const recordBreakAlreadyDone = useRecordBreakAlreadyDone()
  const recordOperationalEvent = useRecordOperationalEvent()

  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null)
  const [selectedPostId, setSelectedPostId] = useState<string>("")
  // Correções de horário feitas no modal do colaborador (sempre com confirmação).
  const [timeEditMode, setTimeEditMode] = useState<"start" | "exit" | "break" | null>(null)
  const [timeEditValue, setTimeEditValue] = useState("")
  const [exitReason, setExitReason] = useState(POST_EXIT_REASONS[0].value)
  const [breakTypeChoice, setBreakTypeChoice] = useState<OperationalBreakType>("intervalo")
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

  const todayBreaks = useMemo(
    () =>
      (operationalBreaksQuery.data ?? [])
        .filter((item) => isBreakFromDay(item, today))
        .sort((left, right) => {
          return Date.parse(left.planned_start) - Date.parse(right.planned_start)
        }),
    [operationalBreaksQuery.data, today]
  )

  const activeBreaks = useMemo(
    () => todayBreaks.filter((item) => ACTIVE_BREAK_STATUS_SET.has(item.status)),
    [todayBreaks]
  )

  const activeBreakByAllocationId = useMemo(() => {
    const map = new Map<string, OperationalBreak>()
    for (const item of activeBreaks) {
      if (item.allocation_id) map.set(item.allocation_id, item)
    }
    return map
  }, [activeBreaks])

  const activeBreakByScheduleId = useMemo(() => {
    const map = new Map<string, OperationalBreak>()
    for (const item of activeBreaks) {
      if (item.schedule_id) map.set(item.schedule_id, item)
    }
    return map
  }, [activeBreaks])

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
        .sort(compareSchedulesByStartTime),
    [schedulesQuery.data]
  )

  // Escalados cujo horário de entrada já passou e ainda sem chegada registrada.
  const pendingArrivalSchedules = useMemo(
    () =>
      workingSchedules.filter((schedule) => {
        if (NON_WORKING_SCHEDULE_STATUS_SET.has(schedule.status)) return false
        if (!hasStartTimeArrived(schedule.start_time, nowMinutes)) return false
        if (["working", "on_break", "returned"].includes(schedule.status)) return false
        if (allocationByScheduleId.has(schedule.id)) return false
        if (activeBreakByScheduleId.has(schedule.id)) return false
        const current = statusByScheduleId.get(schedule.id)?.current_status
        return !current || current === "aguardando_evento" || current === "alerta_critico"
      }),
    [activeBreakByScheduleId, allocationByScheduleId, nowMinutes, statusByScheduleId, workingSchedules]
  )

  const intervalDurationSummary = useMemo(
    () =>
      durationSummary(
        workingSchedules
          .map((schedule) =>
            timeWindowDuration(schedule.break_start, schedule.break_end)
          )
          .filter((duration): duration is number => duration !== null)
      ),
    [workingSchedules]
  )

  const visibleSchedules = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase()

    return workingSchedules
      .filter((schedule) => {
        const status = statusByScheduleId.get(schedule.id)
        const allocation = allocationByScheduleId.get(schedule.id) ?? null
        const operationalBreak =
          (allocation ? activeBreakByAllocationId.get(allocation.id) : null) ??
          activeBreakByScheduleId.get(schedule.id) ??
          null
        const currentStatus = status?.current_status ?? null

        if (
          hiddenScheduleIds.has(schedule.id) ||
          schedule.status === "finished" ||
          currentStatus === "finalizado"
        ) {
          return false
        }

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
        if (statusFilter === "break" && schedule.status !== "on_break" && !operationalBreak) return false
        if (statusFilter === "no_post" && (allocation || operationalBreak)) return false
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
          const overdueOperationalBreak =
            operationalBreak &&
            Date.parse(operationalBreak.planned_end) < nowMs &&
            operationalBreak.status !== "atrasado"
          const intervalProgress = timeWindowProgress(
            schedule.break_start,
            schedule.break_end,
            nowMinutes
          )
          const delayedIntervalStart =
            !operationalBreak &&
            schedule.status !== "on_break" &&
            schedule.status !== "returned" &&
            Boolean(
              intervalProgress &&
                intervalProgress.minutesSinceStart >= INTERVAL_DELAY_NOTICE_MINUTES
            )
          if (
            !overdueCoffee &&
            !overdueBreak &&
            !overdueOperationalBreak &&
            !delayedIntervalStart &&
            !uncovered &&
            status?.current_status !== "alerta_critico"
          ) {
            return false
          }
        }

        return true
      })
      .sort(compareSchedulesByStartTime)
  }, [
    activeBreakByAllocationId,
    activeBreakByScheduleId,
    allocationByScheduleId,
    hiddenScheduleIds,
    nowMs,
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
  const selectedOperationalBreak =
    (selectedAllocation ? activeBreakByAllocationId.get(selectedAllocation.id) : null) ??
    (selectedSchedule ? activeBreakByScheduleId.get(selectedSchedule.id) : null) ??
    null

  const selectedHasEntry = selectedSchedule
    ? Boolean(selectedAllocation) ||
      selectedSchedule.status === "working" ||
      selectedSchedule.status === "on_break" ||
      selectedSchedule.status === "returned" ||
      Boolean(selectedStatus && WORK_STARTED_STATUS_SET.has(selectedStatus.current_status))
    : false
  const selectedUnavailable = selectedSchedule
    ? NON_WORKING_SCHEDULE_STATUS_SET.has(selectedSchedule.status) ||
      selectedStatus?.current_status === "finalizado" ||
      selectedStatus?.current_status === "folga"
    : true
  const selectedAwaitingArrival =
    Boolean(selectedSchedule) &&
    !selectedHasEntry &&
    !selectedAllocation &&
    !selectedOperationalBreak &&
    !selectedUnavailable
  const selectedWorkingWithoutPost =
    Boolean(selectedSchedule) &&
    selectedHasEntry &&
    !selectedAllocation &&
    !selectedOperationalBreak &&
    !selectedUnavailable
  const selectedArrivalStarted = selectedSchedule
    ? hasStartTimeArrived(selectedSchedule.start_time, nowMinutes)
    : false
  const selectedArrivalLateMinutes =
    selectedSchedule && selectedArrivalStarted
      ? minutesSinceTimeValue(selectedSchedule.start_time, nowMinutes)
      : 0
  const selectedArrivalIsLate =
    selectedArrivalLateMinutes > (settingsQuery.data?.late_tolerance_minutes ?? 5)

  const releaseCandidates = useMemo(() => {
    const coffeeWindowOpen =
      settingsQuery.data?.coffee_break_enabled === true &&
      isNowInsideTimeWindow(
        settingsQuery.data?.coffee_window_start,
        settingsQuery.data?.coffee_window_end,
        nowMinutes
      )

    return activeAllocations
      .filter((allocation) => !activeBreakByAllocationId.has(allocation.id))
      .map((allocation) => {
        const schedule =
          workingSchedules.find((item) => item.id === allocation.schedule_id) ??
          null
        const breakStart = schedule?.break_start ?? allocation.schedules?.break_start ?? null
        const breakEnd = schedule?.break_end ?? allocation.schedules?.break_end ?? null
        const intervalWindowOpen = isNowInsideTimeWindow(
          breakStart,
          breakEnd,
          nowMinutes
        )
        const availableBreakTypes: OperationalBreakType[] = []

        if (coffeeWindowOpen) {
          availableBreakTypes.push(...COFFEE_BREAK_TYPES)
        }
        if (intervalWindowOpen) {
          availableBreakTypes.push("intervalo")
        }

        return {
          allocation,
          schedule,
          breakStart,
          breakEnd,
          coffeeWindowOpen,
          intervalWindowOpen,
          availableBreakTypes,
        }
      })
      .filter((item) => item.availableBreakTypes.length > 0)
      .sort((left, right) =>
        (left.allocation.employees?.name ?? "").localeCompare(
          right.allocation.employees?.name ?? ""
        )
      )
  }, [
    activeAllocations,
    activeBreakByAllocationId,
    nowMinutes,
    settingsQuery.data?.coffee_break_enabled,
    settingsQuery.data?.coffee_window_end,
    settingsQuery.data?.coffee_window_start,
    workingSchedules,
  ])

  const isBreakMutationPending =
    releaseEmployeeBreak.isPending ||
    returnEmployeeBreak.isPending ||
    cancelEmployeeBreak.isPending ||
    rescheduleEmployeeBreak.isPending ||
    registerEmployeeBreakDelay.isPending ||
    recordBreakAlreadyDone.isPending
  const isExitMutationPending =
    recordOperationalEvent.isPending ||
    finalizePostAllocation.isPending ||
    returnEmployeeBreak.isPending

  const isLoading =
    schedulesQuery.isLoading ||
    statusesQuery.isLoading ||
    postsQuery.isLoading ||
    allocationsQuery.isLoading

  const error =
    schedulesQuery.error ??
    statusesQuery.error ??
    postsQuery.error ??
    allocationsQuery.error

  async function handleAllocatePost(schedule: ScheduleWithRelations) {
    if (!selectedPostId) return
    // O tempo no posto conta desde a entrada da escala (e só muda com confirmação depois).
    const scheduledStart =
      schedule.start_time && hasStartTimeArrived(schedule.start_time, nowMinutes)
        ? isoFromDayAndTime(today, formatTimeValue(schedule.start_time))
        : null
    await allocatePost.mutateAsync({
      post_id: selectedPostId,
      employee_id: schedule.employee_id,
      schedule_id: schedule.id,
      notes: "Alocação realizada pelo controle PDV",
      started_at: scheduledStart,
    })
    closeScheduleControl()
  }

  function closeScheduleControl() {
    setSelectedScheduleId(null)
    setSelectedPostId("")
    setTimeEditMode(null)
  }

  function openTimeEdit(mode: "start" | "exit" | "break", initial: string) {
    setTimeEditMode(mode)
    setTimeEditValue(initial)
  }

  // Horário informado pelo fiscal: não pode ser futuro nem anterior ao limite dado.
  function parsePastTime(hhmm: string, notBeforeIso?: string | null) {
    if (!/^\d{2}:\d{2}$/.test(hhmm)) {
      toast.error("Informe o horário no formato hh:mm.")
      return null
    }
    const iso = isoFromDayAndTime(today, hhmm)
    if (Date.parse(iso) > Date.now() + 60_000) {
      toast.error("O horário não pode ser no futuro.")
      return null
    }
    if (notBeforeIso && Date.parse(iso) < Date.parse(notBeforeIso)) {
      toast.error(`O horário não pode ser antes de ${formatTimeBR(notBeforeIso)}.`)
      return null
    }
    return iso
  }

  async function handleAdjustStart(allocation: PostAllocation) {
    const iso = parsePastTime(timeEditValue)
    if (!iso) return
    await adjustAllocationStart.mutateAsync({
      allocation_id: allocation.id,
      branch_id: allocation.branch_id,
      started_at: iso,
      previous_started_at: allocation.started_at,
    })
    setTimeEditMode(null)
  }

  async function handleExitPost(allocation: PostAllocation) {
    const iso = parsePastTime(timeEditValue, allocation.started_at)
    if (!iso) return
    const isNow = Date.now() - Date.parse(iso) < 90_000
    await finalizePostAllocation.mutateAsync({
      allocation_id: allocation.id,
      ended_at: isNow ? null : iso,
      notes: `${exitReason}. Saída do posto às ${timeEditValue}, registrada pelo controle PDV.`,
    })
    closeScheduleControl()
  }

  async function handleReleaseBreakAt(allocation: PostAllocation) {
    const iso = parsePastTime(timeEditValue, allocation.started_at)
    if (!iso) return
    const isNow = Date.now() - Date.parse(iso) < 90_000
    await releaseEmployeeBreak.mutateAsync({
      allocation_id: allocation.id,
      employee_id: allocation.employee_id,
      post_id: allocation.post_id,
      schedule_id: allocation.schedule_id,
      break_type: breakTypeChoice,
      started_at: isNow ? null : iso,
      notes: isNow
        ? `${breakTypeLabel[breakTypeChoice]} liberado pelo controle PDV`
        : `${breakTypeLabel[breakTypeChoice]} com saída às ${timeEditValue}, registrada depois pelo controle PDV`,
    })
    setTimeEditMode(null)
  }

  function openScheduleControl(
    schedule: ScheduleWithRelations,
    allocation: PostAllocation | null
  ) {
    setSelectedScheduleId(schedule.id)
    setSelectedPostId(freePosts[0]?.id ?? allocation?.post_id ?? "")
  }

  function markOvertime(scheduleId: string) {
    updateOvertimeScheduleIds((current) => {
      const next = new Set(current)
      next.add(scheduleId)
      return next
    })
  }

  async function handleConfirmExit(
    schedule: ScheduleWithRelations,
    allocation: PostAllocation | null,
    operationalBreak?: OperationalBreak | null
  ) {
    const { overtimeMinutes } = scheduleEndState(schedule, nowMinutes)

    if (operationalBreak && ACTIVE_BREAK_STATUS_SET.has(operationalBreak.status)) {
      await returnEmployeeBreak.mutateAsync({
        break_id: operationalBreak.id,
        notes: "Retorno confirmado automaticamente na saída pelo controle PDV",
      })
    }

    await recordOperationalEvent.mutateAsync({
      branch_id: schedule.branch_id,
      employee_id: schedule.employee_id,
      schedule_id: schedule.id,
      event_type: "saida_confirmada",
      delay_minutes: overtimeMinutes,
      notes:
        overtimeMinutes > 0
          ? `Saída confirmada pelo controle PDV. Hora extra: ${formatDuration(overtimeMinutes)}.`
          : "Saída confirmada pelo controle PDV.",
    })

    if (allocation) {
      await finalizePostAllocation.mutateAsync({
        allocation_id: allocation.id,
        notes: "Posto liberado automaticamente na saída pelo controle PDV",
      })
    }

    updateHiddenScheduleIds((current) => {
      const next = new Set(current)
      next.add(schedule.id)
      return next
    })
    updateOvertimeScheduleIds((current) => {
      const next = new Set(current)
      next.delete(schedule.id)
      return next
    })

    if (selectedScheduleId === schedule.id) {
      setSelectedScheduleId(null)
      setSelectedPostId("")
    }
  }

  async function handleReleaseBreak(
    allocation: PostAllocation,
    breakType: OperationalBreakType
  ) {
    await releaseEmployeeBreak.mutateAsync({
      allocation_id: allocation.id,
      employee_id: allocation.employee_id,
      post_id: allocation.post_id,
      schedule_id: allocation.schedule_id,
      break_type: breakType,
      notes: `${breakTypeLabel[breakType]} liberado pelo controle PDV`,
    })
  }

  async function handleReturnBreak(item: OperationalBreak) {
    await returnEmployeeBreak.mutateAsync({
      break_id: item.id,
      notes: `${breakTypeLabel[item.break_type]} retornou pelo controle PDV`,
    })
  }

  async function handleConfirmBreakAlreadyDone(schedule: ScheduleWithRelations) {
    await recordBreakAlreadyDone.mutateAsync({
      branch_id: schedule.branch_id,
      employee_id: schedule.employee_id,
      schedule_id: schedule.id,
      notes: `Intervalo realizado no horario da escala (${formatTimeValue(
        schedule.break_start
      )} - ${formatTimeValue(schedule.break_end)}) confirmado pelo controle PDV.`,
    })
  }

  // A chegada é marcada por quem controla o PDV: grava o horário real e, se passou da
  // tolerância de atraso, registra quantos minutos o colaborador atrasou.
  async function handleMarkArrived(schedule: ScheduleWithRelations) {
    const startMin = timeToMinutes(schedule.start_time)
    const lateMinutes =
      startMin !== null && nowMinutes > startMin ? nowMinutes - startMin : 0
    const tolerance = settingsQuery.data?.late_tolerance_minutes ?? 5
    const arrivedAt = new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date())
    const isLate = lateMinutes > tolerance

    await recordOperationalEvent.mutateAsync({
      branch_id: schedule.branch_id,
      employee_id: schedule.employee_id,
      schedule_id: schedule.id,
      event_type: "entrada_confirmada",
      delay_minutes: isLate ? lateMinutes : 0,
      notes: isLate
        ? `Chegou às ${arrivedAt}, ${formatDuration(lateMinutes)} após o horário (${formatTimeValue(schedule.start_time)}).`
        : `Chegou às ${arrivedAt}, no horário.`,
    })
  }

  // Para quem assume o turno depois do horário de entrada dos colegas: confirma de uma vez
  // que todos os pendentes chegaram no horário (sem atraso), registrando que foi em lote.
  async function handleConfirmAllOnTime() {
    const targets = pendingArrivalSchedules
    if (targets.length === 0) return
    const confirmed = window.confirm(
      `Confirmar que ${targets.length} colaborador(es) chegaram no horário da escala?

Use apenas se ninguém atrasou nem faltou.`
    )
    if (!confirmed) return

    const confirmedAt = new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date())
    let done = 0
    for (const schedule of targets) {
      try {
        await recordOperationalEvent.mutateAsync({
          branch_id: schedule.branch_id,
          employee_id: schedule.employee_id,
          schedule_id: schedule.id,
          event_type: "entrada_confirmada",
          delay_minutes: 0,
          notes: `Chegou no horário (${formatTimeValue(schedule.start_time)}). Confirmado em lote às ${confirmedAt} pelo controle PDV.`,
          silent: true,
        })
        done += 1
      } catch {
        // segue para os demais; o total confirmado é mostrado ao final
      }
    }
    if (done === targets.length) {
      toast.success(`${done} chegada(s) confirmada(s) no horário.`)
    } else {
      toast.error(`${done} de ${targets.length} confirmadas. Tente novamente para as demais.`)
    }
  }

  async function handleMarkAbsent(schedule: ScheduleWithRelations) {
    await recordOperationalEvent.mutateAsync({
      branch_id: schedule.branch_id,
      employee_id: schedule.employee_id,
      schedule_id: schedule.id,
      event_type: "falta_detectada",
      delay_minutes: minutesSinceTimeValue(schedule.start_time, nowMinutes),
      notes: "Falta marcada pelo controle PDV.",
    })
  }

  async function handleCancelBreak(item: OperationalBreak) {
    await cancelEmployeeBreak.mutateAsync({
      break_id: item.id,
      notes: `${breakTypeLabel[item.break_type]} cancelado pelo controle PDV`,
    })
  }

  async function handleRescheduleBreak(item: OperationalBreak) {
    await rescheduleEmployeeBreak.mutateAsync({
      break_id: item.id,
      minutes: breakSettingsQuery.data?.lunch_stagger_minutes ?? 10,
      notes: `${breakTypeLabel[item.break_type]} reagendado pelo controle PDV`,
    })
  }

  async function handleRegisterBreakDelay(item: OperationalBreak) {
    await registerEmployeeBreakDelay.mutateAsync({
      break_id: item.id,
      notes: `${breakTypeLabel[item.break_type]} marcado como atraso pelo controle PDV`,
    })
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
      {tab === "overview" ? (
        <SectionPanel
          id="escala-real"
          title="Escala real do dia"
          variant="original"
          defaultOpen
          headerClassName="rounded-[24px] bg-[color:var(--bg-muted)] px-4 text-[color:var(--text-primary)]"
          contentClassName="rounded-[24px] bg-[color:var(--bg-surface)] p-3"
        >
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Buscar colaborador, setor, filial ou posto"
                className="h-9 rounded-full pl-9 text-sm"
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
                  className="h-8 rounded-full px-3 text-xs"
                  onClick={() => setStatusFilter(filter)}
                >
                  {labelMap[filter]}
                </Button>
              )
            })}
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-full px-3 text-xs"
              onClick={() => {
                setSearchText("")
                setStatusFilter("all")
              }}
            >
              Limpar
            </Button>
            {pendingArrivalSchedules.length > 0 ? (
              <Button
                size="sm"
                className="h-8 rounded-full px-3 text-xs"
                disabled={recordOperationalEvent.isPending}
                onClick={() => void handleConfirmAllOnTime()}
              >
                Todos chegaram no horário ({pendingArrivalSchedules.length})
              </Button>
            ) : null}
          </div>

          <div className="grid gap-2.5 lg:grid-cols-3">
            {visibleSchedules.map((schedule) => {
              const status = statusByScheduleId.get(schedule.id)
              const allocation = allocationByScheduleId.get(schedule.id) ?? null
              const operationalBreak =
                (allocation ? activeBreakByAllocationId.get(allocation.id) : null) ??
                activeBreakByScheduleId.get(schedule.id) ??
                null
              const tone = badgeTone(schedule, status, allocation, operationalBreak)
              const elapsed = allocation
                ? minutesSinceTimestamp(allocation.started_at, nowMs)
                : minutesSinceTimeValue(schedule.start_time, nowMinutes)
              const postName = allocation?.operational_posts?.name ?? "Sem posto"
              const { hasReachedEnd, overtimeMinutes } = scheduleEndState(
                schedule,
                nowMinutes
              )
              const isOvertime = overtimeScheduleIds.has(schedule.id)
              const hasOperationalEntry =
                Boolean(allocation) ||
                schedule.status === "working" ||
                schedule.status === "on_break" ||
                schedule.status === "returned" ||
                Boolean(status && WORK_STARTED_STATUS_SET.has(status.current_status))
              const canMarkAbsent =
                hasStartTimeArrived(schedule.start_time, nowMinutes) &&
                !allocation &&
                !operationalBreak &&
                !NON_WORKING_SCHEDULE_STATUS_SET.has(schedule.status) &&
                status?.current_status !== "finalizado" &&
                status?.current_status !== "folga"
              const awaitingArrival =
                !hasOperationalEntry &&
                !allocation &&
                !operationalBreak &&
                !NON_WORKING_SCHEDULE_STATUS_SET.has(schedule.status) &&
                status?.current_status !== "finalizado" &&
                status?.current_status !== "folga"
              const startArrived = hasStartTimeArrived(schedule.start_time, nowMinutes)
              const arrivalLateMinutes = startArrived
                ? minutesSinceTimeValue(schedule.start_time, nowMinutes)
                : 0
              const arrivalIsLate =
                arrivalLateMinutes > (settingsQuery.data?.late_tolerance_minutes ?? 5)
              const intervalNotice = intervalNoticeState(
                schedule,
                operationalBreak,
                nowMs,
                nowMinutes,
                hasOperationalEntry
              )

              return (
                <div
                  key={schedule.id}
                  role="button"
                  tabIndex={0}
                  className={cn(
                    "rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] p-3 text-left shadow-sm transition hover:border-[color:var(--border-strong)] hover:shadow-md",
                    hasReachedEnd && "border-amber-200 dark:border-amber-500/30 bg-amber-50/30 dark:bg-amber-500/10"
                  )}
                  onClick={() => openScheduleControl(schedule, allocation)}
                  onKeyDown={(event) => {
                    if (event.currentTarget !== event.target) return
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      openScheduleControl(schedule, allocation)
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
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
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px]",
                        tone.className
                      )}
                    >
                      {tone.label}
                    </Badge>
                  </div>

                  <div className="mt-2.5 grid gap-2 text-xs sm:grid-cols-2">
                    <div className="rounded-xl bg-[color:var(--bg-surface-soft)] px-2.5 py-1.5">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Jornada
                      </div>
                      <div className="mt-0.5 truncate font-medium text-[color:var(--text-primary)]">
                        {schedule.start_time ?? "--:--"} → {schedule.end_time ?? "--:--"}
                      </div>
                    </div>
                    <div className="rounded-xl bg-[color:var(--bg-surface-soft)] px-2.5 py-1.5">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Tempo
                      </div>
                      <div className="mt-0.5 truncate font-medium text-[color:var(--text-primary)]">
                        {formatDuration(elapsed)}
                      </div>
                    </div>
                    <div className="rounded-xl bg-[color:var(--bg-surface-soft)] px-2.5 py-1.5 sm:col-span-2">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Posto
                      </div>
                      <div className="mt-0.5 truncate font-medium text-[color:var(--text-primary)]">
                        {postName}
                      </div>
                    </div>
                  </div>

                  <p className="mt-2 truncate text-xs text-muted-foreground">
                    {currentStatusText(schedule, status, allocation, operationalBreak)}
                  </p>

                  {awaitingArrival ? (
                    <div
                      className={cn(
                        "mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs",
                        startArrived && arrivalIsLate
                          ? "border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
                          : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
                      )}
                    >
                      <div className="min-w-0">
                        <div className="font-semibold">Aguardando chegada</div>
                        <div className="mt-0.5">
                          {!startArrived
                            ? `Entrada às ${formatTimeValue(schedule.start_time)}.`
                            : arrivalLateMinutes === 0
                              ? "Horário de entrada agora."
                              : `${formatDuration(arrivalLateMinutes)} após o horário de entrada.`}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 rounded-full"
                          disabled={recordOperationalEvent.isPending}
                          onClick={(event) => {
                            event.stopPropagation()
                            void handleMarkArrived(schedule)
                          }}
                        >
                          {recordOperationalEvent.isPending ? "Marcando..." : "Chegou"}
                        </Button>
                        {canMarkAbsent ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            className="h-8 rounded-full"
                            disabled={recordOperationalEvent.isPending}
                            onClick={(event) => {
                              event.stopPropagation()
                              void handleMarkAbsent(schedule)
                            }}
                          >
                            Faltou
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {intervalNotice ? (
                    <div
                      className={cn(
                        "mt-3 rounded-xl border px-3 py-2 text-xs",
                        intervalNoticeClassName(intervalNotice.tone)
                      )}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold">
                            {intervalNotice.title}
                          </div>
                          <div className="mt-0.5">
                            {intervalNotice.detail}
                          </div>
                        </div>

                        {intervalNotice.action === "release" && allocation ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="default"
                            className="h-8 rounded-full"
                            disabled={isBreakMutationPending}
                            onClick={(event) => {
                              event.stopPropagation()
                              void handleReleaseBreak(allocation, "intervalo")
                            }}
                          >
                            {isBreakMutationPending ? "Liberando..." : "Liberar intervalo"}
                          </Button>
                        ) : null}

                        {intervalNotice.action === "return" && operationalBreak ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="default"
                            className="h-8 rounded-full"
                            disabled={isBreakMutationPending}
                            onClick={(event) => {
                              event.stopPropagation()
                              void handleReturnBreak(operationalBreak)
                            }}
                          >
                            {isBreakMutationPending ? "Registrando..." : "Confirmar retorno"}
                          </Button>
                        ) : null}

                        {intervalNotice.action === "confirmDone" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 rounded-full bg-white"
                            disabled={isBreakMutationPending}
                            onClick={(event) => {
                              event.stopPropagation()
                              void handleConfirmBreakAlreadyDone(schedule)
                            }}
                          >
                            {isBreakMutationPending
                              ? "Registrando..."
                              : "Confirmar intervalo realizado"}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {hasReachedEnd ? (
                    <div
                      className={cn(
                        "mt-3 rounded-xl border px-3 py-2 text-xs",
                        isOvertime
                          ? "border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-red-800 dark:text-red-300"
                          : "border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300"
                      )}
                    >
                      {isOvertime ? (
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="font-semibold">
                              Hora extra em andamento
                            </div>
                            <div className="mt-0.5">
                              Tempo extra: {formatDuration(overtimeMinutes)}
                            </div>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            className="h-8 rounded-full"
                            disabled={isExitMutationPending}
                            onClick={(event) => {
                              event.stopPropagation()
                              void handleConfirmExit(
                                schedule,
                                allocation,
                                operationalBreak
                              )
                            }}
                          >
                            {isExitMutationPending ? "Registrando..." : "Liberar saída"}
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div>
                            <div className="font-semibold">
                              Horário de saída atingido
                            </div>
                            <div className="mt-0.5">
                              O colaborador já saiu ou ficará em hora extra?
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="default"
                              className="h-8 rounded-full"
                              disabled={isExitMutationPending}
                              onClick={(event) => {
                                event.stopPropagation()
                                void handleConfirmExit(
                                  schedule,
                                  allocation,
                                  operationalBreak
                                )
                              }}
                            >
                              {isExitMutationPending ? "Registrando..." : "Já saiu"}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8 rounded-full bg-white"
                              disabled={isExitMutationPending}
                              onClick={(event) => {
                                event.stopPropagation()
                                markOvertime(schedule.id)
                              }}
                            >
                              Hora extra
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </SectionPanel>

      ) : (
        <SectionPanel
          id="liberacoes-pdv"
          title="Liberações operacionais"
          variant="original"
          defaultOpen
          headerClassName="rounded-[24px] bg-[color:var(--bg-muted)] px-4 text-[color:var(--text-primary)]"
          contentClassName="rounded-[28px] bg-[color:var(--bg-surface)] p-4"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
              {[
                {
                  label: "Café",
                  value: `${breakSettingsQuery.data?.coffee_duration_minutes ?? 10} min`,
                },
                {
                  label: "Intervalo da escala",
                  value: intervalDurationSummary,
                },
                {
                  label: "Intervalo entre cafés",
                  value: `${breakSettingsQuery.data?.coffee_interval_minutes ?? 10} min`,
                },
                {
                  label: "Cobertura mínima",
                  value: breakSettingsQuery.data?.minimum_active_operators ?? 4,
                },
                {
                  label: "Tolerância de atraso",
                  value: `${breakSettingsQuery.data?.delay_tolerance_minutes ?? 5} min`,
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-lg border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-soft)] px-2.5 py-1.5"
                >
                  <div className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
                    {item.label}
                  </div>
                  <div className="truncate text-sm font-semibold leading-snug text-[color:var(--text-primary)]">
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            <div className="overflow-hidden rounded-2xl border border-[color:var(--border-soft)]">
              <div className="hidden grid-cols-[150px_140px_minmax(220px,1fr)_130px_minmax(260px,1.2fr)] gap-3 bg-[color:var(--bg-muted)] px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground xl:grid">
                <div>Horário</div>
                <div>Tipo</div>
                <div>Colaborador</div>
                <div>Status</div>
                <div>Ações</div>
              </div>

              <div className="divide-y divide-[color:var(--border-soft)]">
                {activeBreaks.map((item) => {
                  const timerState = breakTimerState(item, nowMs)
                  const displayStatus =
                    timerState.isOverdue && item.status !== "atrasado"
                      ? "atrasado"
                      : item.status

                  return (
                    <div
                      key={item.id}
                      className="grid gap-3 px-4 py-4 xl:grid-cols-[150px_140px_minmax(220px,1fr)_130px_minmax(260px,1.2fr)] xl:items-center"
                    >
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground xl:hidden">
                          Horário
                        </div>
                        <div className="text-sm font-medium text-[color:var(--text-primary)]">
                          {formatTimeBR(item.planned_start)} - {formatTimeBR(item.planned_end)}
                        </div>
                        <div
                          className={cn(
                            "mt-0.5 text-xs",
                            timerState.isOverdue ? "text-red-600 dark:text-red-300" : "text-muted-foreground"
                          )}
                        >
                          {timerState.label}
                        </div>
                      </div>

                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground xl:hidden">
                          Tipo
                        </div>
                        <Badge
                          variant="outline"
                          className="rounded-full border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-300"
                        >
                          {breakTypeLabel[item.break_type]}
                        </Badge>
                      </div>

                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground xl:hidden">
                          Colaborador
                        </div>
                        <div className="truncate text-sm font-semibold text-[color:var(--text-primary)]">
                          {item.employees?.name ?? "Colaborador"}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {item.operational_posts?.name ?? "Posto"} ·{" "}
                          {item.employees?.sectors?.name ?? "Sem setor"}
                        </div>
                      </div>

                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground xl:hidden">
                          Status
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs",
                            breakStatusClassName(displayStatus)
                          )}
                        >
                          {breakStatusLabel[displayStatus]}
                        </Badge>
                        <div
                          className={cn(
                            "mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                            timerState.isOverdue
                              ? "border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300"
                              : "border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          )}
                        >
                          <Clock3 className="mr-1 size-3" />
                          {timerState.label}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="default"
                          className="rounded-full"
                          disabled={isBreakMutationPending}
                          onClick={() => void handleReturnBreak(item)}
                        >
                          <CheckCircle2 className="mr-1 size-3.5" />
                          Confirmar retorno
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="rounded-full"
                          disabled={isBreakMutationPending}
                          onClick={() => void handleRescheduleBreak(item)}
                        >
                          <RotateCcw className="mr-1 size-3.5" />
                          Reagendar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="rounded-full"
                          disabled={isBreakMutationPending || item.status === "atrasado"}
                          onClick={() => void handleRegisterBreakDelay(item)}
                        >
                          <Clock3 className="mr-1 size-3.5" />
                          Registrar atraso
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          className="rounded-full"
                          disabled={isBreakMutationPending}
                          onClick={() => void handleCancelBreak(item)}
                        >
                          <Ban className="mr-1 size-3.5" />
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )
                })}

                {releaseCandidates.map((candidate) => {
                  const {
                    allocation,
                    schedule,
                    breakStart,
                    breakEnd,
                    coffeeWindowOpen,
                    intervalWindowOpen,
                    availableBreakTypes,
                  } = candidate
                  const windowLabels = [
                    coffeeWindowOpen
                      ? timeWindowLabel(
                          "Café",
                          settingsQuery.data?.coffee_window_start,
                          settingsQuery.data?.coffee_window_end
                        )
                      : null,
                    intervalWindowOpen
                      ? timeWindowLabel("Intervalo", breakStart, breakEnd)
                      : null,
                  ].filter(Boolean)

                  return (
                    <div
                      key={`candidate-${allocation.id}`}
                      className="grid gap-3 bg-[color:var(--bg-surface)] px-4 py-4 xl:grid-cols-[150px_140px_minmax(220px,1fr)_130px_minmax(260px,1.2fr)] xl:items-center"
                    >
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground xl:hidden">
                          Horário
                        </div>
                        <div className="text-sm font-medium text-[color:var(--text-primary)]">
                          {windowLabels[0] ?? "Janela atual"}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {windowLabels[1] ??
                            `Jornada ${formatTimeValue(
                              schedule?.start_time ?? allocation.schedules?.start_time
                            )} - ${formatTimeValue(
                              schedule?.end_time ?? allocation.schedules?.end_time
                            )}`}
                        </div>
                      </div>

                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground xl:hidden">
                          Tipo
                        </div>
                        <Badge
                          variant="outline"
                          className="rounded-full border-sky-200 dark:border-sky-500/30 bg-sky-50 dark:bg-sky-500/10 px-2 py-0.5 text-xs text-sky-700 dark:text-sky-300"
                        >
                          {breakTypeSummary(availableBreakTypes)}
                        </Badge>
                      </div>

                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground xl:hidden">
                          Colaborador
                        </div>
                        <div className="truncate text-sm font-semibold text-[color:var(--text-primary)]">
                          {allocation.employees?.name ?? "Colaborador"}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {allocation.operational_posts?.name ?? "Posto"} ·{" "}
                          {allocation.employees?.sectors?.name ?? "Sem setor"}
                        </div>
                      </div>

                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground xl:hidden">
                          Status
                        </div>
                        <Badge
                          variant="outline"
                          className="rounded-full border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-300"
                        >
                          Na janela
                        </Badge>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {availableBreakTypes.map((breakType) => (
                          <Button
                            key={breakType}
                            type="button"
                            size="sm"
                            variant={breakType === "intervalo" ? "default" : "outline"}
                            className="rounded-full"
                            disabled={isBreakMutationPending}
                            onClick={() => void handleReleaseBreak(allocation, breakType)}
                          >
                            {breakActionLabel(breakType)}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )
                })}

                {activeBreaks.length === 0 && releaseCandidates.length === 0 ? (
                  <div className="px-4 py-8">
                    <StateBlock
                      title="Nenhuma liberação para exibir"
                      description="Colaboradores aparecem aqui durante a janela de intervalo ou enquanto já estiverem liberados."
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </SectionPanel>
      )}

      <Dialog
        open={Boolean(selectedSchedule)}
        onOpenChange={(open) => {
          if (!open) closeScheduleControl()
        }}
      >
        <DialogContent className="sm:max-w-3xl">
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
                        selectedAllocation,
                        selectedOperationalBreak
                      ).className
                    )}
                  >
                    {badgeTone(
                      selectedSchedule,
                      selectedStatus ?? undefined,
                      selectedAllocation,
                      selectedOperationalBreak
                    ).label}
                  </Badge>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-2xl bg-white px-3 py-2 dark:bg-slate-800/70">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Entrada
                    </div>
                    <div className="mt-1 text-sm font-medium text-[color:var(--text-primary)]">
                      {formatTimeValue(selectedSchedule.start_time)}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white px-3 py-2 dark:bg-slate-800/70">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Intervalo
                    </div>
                    <div className="mt-1 text-sm font-medium text-[color:var(--text-primary)]">
                      {selectedSchedule.break_start && selectedSchedule.break_end
                        ? `${formatTimeValue(selectedSchedule.break_start)} – ${formatTimeValue(selectedSchedule.break_end)}`
                        : "Sem intervalo"}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white px-3 py-2 dark:bg-slate-800/70">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Saída
                    </div>
                    <div className="mt-1 text-sm font-medium text-[color:var(--text-primary)]">
                      {formatTimeValue(selectedSchedule.end_time)}
                    </div>
                  </div>
                </div>
              </div>

              {selectedAwaitingArrival ? (
                <div
                  className={cn(
                    "flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4",
                    selectedArrivalStarted && selectedArrivalIsLate
                      ? "border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
                      : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
                  )}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">Aguardando chegada</div>
                    <div className="mt-0.5 text-sm">
                      {!selectedArrivalStarted
                        ? `Entrada às ${formatTimeValue(selectedSchedule.start_time)}.`
                        : selectedArrivalLateMinutes === 0
                          ? "Horário de entrada agora."
                          : `${formatDuration(selectedArrivalLateMinutes)} após o horário de entrada.`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      disabled={recordOperationalEvent.isPending}
                      onClick={() => void handleMarkArrived(selectedSchedule)}
                    >
                      {recordOperationalEvent.isPending ? "Marcando..." : "Chegou"}
                    </Button>
                    {selectedArrivalStarted ? (
                      <Button
                        type="button"
                        variant="destructive"
                        disabled={recordOperationalEvent.isPending}
                        onClick={() => void handleMarkAbsent(selectedSchedule)}
                      >
                        Faltou
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <div
                  className={cn(
                    "rounded-2xl border border-[color:var(--border-soft)] p-4",
                    selectedWorkingWithoutPost &&
                      "border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10"
                  )}
                >
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Posto atual
                  </div>
                  <div className="mt-1 text-base font-semibold text-[color:var(--text-primary)]">
                    {selectedAllocation?.operational_posts?.name ?? "Sem posto"}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {selectedAllocation
                      ? `Alocado há ${formatDuration(
                          minutesSinceTimestamp(selectedAllocation.started_at, nowMs)
                        )}`
                      : selectedWorkingWithoutPost
                        ? `Trabalhando sem posto há ${formatDuration(
                            minutesSinceTimeValue(selectedSchedule.start_time, nowMinutes)
                          )}.`
                        : "Nenhuma alocação em andamento."}
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
                    {currentStatusText(
                      selectedSchedule,
                      selectedStatus ?? undefined,
                      selectedAllocation,
                      selectedOperationalBreak
                    )}
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
                      {selectedOperationalBreak
                        ? "Confirme o retorno antes de alocar este colaborador."
                        : "Escolha um posto livre para este colaborador."}
                    </div>
                  </div>
                  <div className="flex min-w-0 flex-1 gap-2 sm:max-w-md">
                    <Select
                      aria-label="Posto para alocar"
                      className="h-10 min-w-0 flex-1 rounded-full"
                      value={selectedPostId}
                      onValueChange={setSelectedPostId}
                      disabled={Boolean(selectedOperationalBreak)}
                      placeholder="Selecione um posto"
                      options={[
                        { value: "", label: "Selecione um posto" },
                        ...freePosts.map((post) => ({ value: post.id, label: post.name })),
                        ...(selectedAllocation
                          ? [
                              {
                                value: selectedAllocation.post_id,
                                label: selectedAllocation.operational_posts?.name ?? "Posto atual",
                              },
                            ]
                          : []),
                      ]}
                    />
                    <Button
                      type="button"
                      variant="default"
                      disabled={
                        allocatePost.isPending ||
                        !selectedPostId ||
                        Boolean(selectedOperationalBreak) ||
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
                      {selectedOperationalBreak
                        ? "Posto pausado por café. Confirme o retorno antes de liberar ou mover."
                        : "Para mover este operador, libere o posto atual primeiro."}
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={
                        finalizePostAllocation.isPending ||
                        Boolean(selectedOperationalBreak)
                      }
                      onClick={() => openTimeEdit("exit", hhmmFromIso(new Date().toISOString()))}
                    >
                      {finalizePostAllocation.isPending ? "Liberando..." : "Liberar posto"}
                    </Button>
                  </div>
                ) : null}
              </div>

              {selectedAllocation ? (
                <div className="space-y-3 rounded-2xl border border-[color:var(--border-soft)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        Tempo no posto
                      </div>
                      <div className="text-sm text-[color:var(--text-primary)]">
                        Desde {formatTimeBR(selectedAllocation.started_at)} ·{" "}
                        {formatDuration(minutesSinceTimestamp(selectedAllocation.started_at, nowMs))}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          openTimeEdit("start", hhmmFromIso(selectedAllocation.started_at))
                        }
                      >
                        Ajustar horário de início
                      </Button>
                      {!selectedOperationalBreak ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => openTimeEdit("break", hhmmFromIso(new Date().toISOString()))}
                        >
                          Liberar intervalo/café
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  {timeEditMode ? (
                    <div className="space-y-3 rounded-2xl bg-[color:var(--bg-surface-soft)] p-3">
                      <div className="text-sm font-medium text-[color:var(--text-primary)]">
                        {timeEditMode === "start"
                          ? "Corrigir o horário em que entrou no posto"
                          : timeEditMode === "exit"
                            ? "Registrar a saída do posto"
                            : "Registrar a saída para intervalo ou café"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {timeEditMode === "start"
                          ? "O tempo no posto começa na entrada da escala. Só altere se o horário real for diferente; a mudança fica na auditoria."
                          : "Se o colaborador saiu antes de você registrar, informe o horário real. Deixe o horário atual para registrar agora."}
                      </div>
                      <div className="flex flex-wrap items-end gap-3">
                        <label className="space-y-1 text-xs">
                          <span className="font-medium">
                            {timeEditMode === "start" ? "Entrou no posto às" : "Saiu às"}
                          </span>
                          <Input
                            type="time"
                            className="w-32"
                            value={timeEditValue}
                            onChange={(event) => setTimeEditValue(event.target.value)}
                          />
                        </label>
                        {timeEditMode === "exit" ? (
                          <label className="min-w-48 flex-1 space-y-1 text-xs">
                            <span className="font-medium">Motivo</span>
                            <Select
                              value={exitReason}
                              onValueChange={setExitReason}
                              options={POST_EXIT_REASONS}
                            />
                          </label>
                        ) : null}
                        {timeEditMode === "break" ? (
                          <label className="min-w-48 flex-1 space-y-1 text-xs">
                            <span className="font-medium">Tipo</span>
                            <Select
                              value={breakTypeChoice}
                              onValueChange={(value) =>
                                setBreakTypeChoice(value as OperationalBreakType)
                              }
                              options={(Object.keys(breakTypeLabel) as OperationalBreakType[]).map(
                                (type) => ({ value: type, label: breakTypeLabel[type] })
                              )}
                            />
                          </label>
                        ) : null}
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={
                              adjustAllocationStart.isPending ||
                              finalizePostAllocation.isPending ||
                              releaseEmployeeBreak.isPending
                            }
                            onClick={() =>
                              void (timeEditMode === "start"
                                ? handleAdjustStart(selectedAllocation)
                                : timeEditMode === "exit"
                                  ? handleExitPost(selectedAllocation)
                                  : handleReleaseBreakAt(selectedAllocation))
                            }
                          >
                            {timeEditMode === "start"
                              ? "Confirmar alteração"
                              : timeEditMode === "exit"
                                ? "Confirmar saída do posto"
                                : "Confirmar liberação"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setTimeEditMode(null)}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="rounded-2xl border border-dashed border-[color:var(--border-soft)] p-4 text-sm text-muted-foreground">
                Horário de trabalho em andamento:{" "}
                {selectedAllocation
                  ? formatDuration(minutesSinceTimestamp(selectedAllocation.started_at, nowMs))
                  : formatDuration(minutesSinceTimeValue(selectedSchedule.start_time, nowMinutes))}
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeScheduleControl}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
