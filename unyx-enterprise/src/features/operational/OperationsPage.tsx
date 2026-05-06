import { useEffect, useMemo, useState } from "react"
import type { FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import {
  Activity,
  AlertCircle,
  ArrowRightLeft,
  Banknote,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock,
  Coffee,
  HelpCircle,
  History,
  MapPinned,
  Pencil,
  Phone,
  Plus,
  Power,
  RefreshCw,
  ShieldAlert,
  Store,
  UserRoundCheck,
  Wand2,
} from "lucide-react"

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
  useAllocatePost,
  useAllocationHistory,
  useAttendanceEvents,
  useBranches,
  useCashMovements,
  useConfirmCashMovement,
  useCreateOperationalPost,
  useEmployees,
  useFinalizePostAllocation,
  useOperationalPosts,
  useOperationalSettings,
  useOperationalStatuses,
  useOrganization,
  usePostAllocations,
  useRecordOperationalEvent,
  useSchedules,
  useSectors,
  useSetupSegmentDefaults,
  useToggleOperationalPost,
  useTransferPostAllocation,
  useUpdateOperationalPost,
  useUpdateSchedule,
} from "@/hooks/useUnyxData"
import { formatDateTimeBR, formatTime, minutesLabel, todayISO } from "@/lib/format"
import {
  SEGMENT_DEFAULT_POSTS,
  SEGMENT_DEFAULT_SECTORS,
  SEGMENT_LABELS,
  SEGMENT_PANEL_ALERTS,
  SEGMENT_POST_TYPES,
} from "@/lib/segmentConfig"
import { eventLabel, operationalActions, statusMeta } from "@/lib/status"
import { useAppStore } from "@/store/useAppStore"
import type {
  AttendanceEventType,
  CashMovementType,
  EmployeeWithRelations,
  OperationalPost,
  OperationalPostType,
  OperationalSettings,
  OperationalStatus,
  OperationalStatusRecord,
  PostAllocation,
  ScheduleWithRelations,
  Sector,
} from "@/types/domain"

// ─── helpers ─────────────────────────────────────────────────────────────────

function addNoteMarker(current: string | null, marker: string): string {
  if (!current) return marker
  if (current.includes(marker)) return current
  return `${current},${marker}`
}

function timeToMinutes(time: string | null): number | null {
  if (!time) return null
  const [h, m] = time.split(":").map(Number)
  return h * 60 + m
}

function formatMinuteDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}min`
  return m === 0 ? `${h}h` : `${h}h ${m}min`
}

function minToTime(min: number): string {
  const h = Math.floor(min / 60) % 24
  const m = min % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

function formatHHMM(isoString: string) {
  return new Date(isoString).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

function getInitials(name: string): string {
  const parts = name.trim().split(" ").filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return (parts[0][0] ?? "?").toUpperCase()
  return ((parts[0][0] ?? "") + (parts[parts.length - 1][0] ?? "")).toUpperCase()
}

function getScheduleLabel(schedule: ScheduleWithRelations) {
  return [
    formatTime(schedule.start_time),
    formatTime(schedule.break_start),
    formatTime(schedule.break_end),
    formatTime(schedule.end_time),
  ].join(" / ")
}

function scheduleStatusNote(status: string): string {
  if (status === "returned") return " — Retornou do intervalo"
  if (status === "on_break") return " — Em intervalo"
  if (status === "working") return " — Trabalhando"
  if (status === "scheduled") return " — Aguardando entrada"
  return ""
}

function getEmployeeSubtitle(employee: EmployeeWithRelations) {
  return [employee.role, employee.sectors?.name].filter(Boolean).join(" - ")
}

function sectorOptionsForBranch(sectors: Sector[], branchId: string) {
  return sectors.filter((sector) => sector.branch_id === branchId && sector.active)
}

// ─── constants ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 12

const fieldClass =
  "h-8 rounded-lg border bg-white px-2.5 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"

const fieldClassFull =
  "h-8 w-full rounded-lg border bg-white px-2.5 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"

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

const REQUIRES_CONFIRM = new Set<AttendanceEventType>([
  "atraso_detectado",
  "falta_detectada",
])

const ACTION_LABEL_OVERRIDE: Partial<Record<AttendanceEventType, string>> = {
  intervalo_iniciado: "Iniciar intervalo",
  troca_caixa_confirmada: "Troca de caixa",
}

const postTypeLabel: Record<OperationalPostType, string> = {
  cashier: "Caixa",
  self_checkout: "Self-checkout",
  counter: "Balcao",
  service_desk: "Atendimento",
  delivery: "Delivery",
  stock: "Estoque",
  kitchen: "Cozinha",
  reception: "Recepcao",
  other: "Outro",
}

const cashMovementLabel: Record<CashMovementType, string> = {
  sangria_confirmada: "Sangria confirmada",
  abertura_caixa: "Abertura de caixa",
  fechamento_caixa: "Fechamento de caixa",
  troco_reforco: "Reforco de troco",
}

const postTypeOrder: OperationalPostType[] = [
  "cashier", "self_checkout", "counter", "service_desk",
  "delivery", "stock", "kitchen", "reception", "other",
]

// ─── types ───────────────────────────────────────────────────────────────────

type PendingConfirm = {
  scheduleId: string
  eventType: AttendanceEventType
}

type ContextBadge = {
  label: string
  warning: boolean
}

type CoffeeSlot = { start: string; end: string }

type PostFormState = {
  branch_id: string
  sector_id: string
  name: string
  type: OperationalPostType
  active: boolean
}

type AllocationAction =
  | { type: "allocate"; post: OperationalPost }
  | { type: "transfer"; post: OperationalPost; allocation: PostAllocation }

// ─── sub-components ──────────────────────────────────────────────────────────

function emptyPostForm(branchId = ""): PostFormState {
  return { branch_id: branchId, sector_id: "", name: "", type: "cashier", active: true }
}

function CashierScheduleInfo({ schedule }: { schedule: ScheduleWithRelations }) {
  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const startMin = timeToMinutes(schedule.start_time)
  const breakStartMin = timeToMinutes(schedule.break_start)
  const breakEndMin = timeToMinutes(schedule.break_end)
  const endMin = timeToMinutes(schedule.end_time)

  const shiftDuration =
    startMin !== null && endMin !== null
      ? endMin -
        startMin -
        (breakStartMin !== null && breakEndMin !== null ? breakEndMin - breakStartMin : 0)
      : null

  let lunchStatus: string | null = null
  if (breakStartMin !== null) {
    if (nowMin < breakStartMin) {
      lunchStatus = `em ${formatMinuteDuration(breakStartMin - nowMin)}`
    } else if (breakEndMin !== null && nowMin <= breakEndMin) {
      lunchStatus = "Em almoco"
    } else {
      lunchStatus = "Concluido"
    }
  }

  const items = [
    schedule.start_time ? { label: "Entrada", value: formatTime(schedule.start_time) } : null,
    shiftDuration !== null ? { label: "Jornada", value: formatMinuteDuration(shiftDuration) } : null,
    lunchStatus ? { label: "Almoco", value: lunchStatus } : null,
  ].filter((item): item is { label: string; value: string } => item !== null)

  if (items.length === 0) return null

  return (
    <div className="mt-2 flex flex-wrap gap-4 rounded-lg border bg-white/60 px-3 py-2">
      {items.map((item) => (
        <div key={item.label} className="text-xs">
          <div className="text-muted-foreground">{item.label}</div>
          <div className="font-medium tabular-nums">{item.value}</div>
        </div>
      ))}
    </div>
  )
}

// ─── logic helpers ───────────────────────────────────────────────────────────

function calcCoffeeTimes(
  scheduleList: ScheduleWithRelations[],
  settings: OperationalSettings | null | undefined
): Map<string, CoffeeSlot> {
  const result = new Map<string, CoffeeSlot>()
  if (!settings?.coffee_break_enabled) return result

  const windowStart = timeToMinutes(settings.coffee_window_start)
  const windowEnd = timeToMinutes(settings.coffee_window_end)
  const duration = settings.coffee_break_duration_minutes ?? 10
  const order = settings.coffee_order ?? "inverse"
  if (windowStart === null || windowEnd === null) return result

  const eligible = scheduleList.filter(
    (s) => !["day_off", "cancelled", "absent"].includes(s.status)
  )

  let sorted: ScheduleWithRelations[]
  if (order === "inverse") {
    sorted = [...eligible].sort(
      (a, b) => (timeToMinutes(b.break_start) ?? 0) - (timeToMinutes(a.break_start) ?? 0)
    )
  } else if (order === "same") {
    sorted = [...eligible].sort(
      (a, b) => (timeToMinutes(a.break_start) ?? 0) - (timeToMinutes(b.break_start) ?? 0)
    )
  } else {
    sorted = eligible
  }

  sorted.forEach((schedule, index) => {
    const coffeeStart = windowStart + index * duration
    const coffeeEnd = coffeeStart + duration
    if (coffeeEnd > windowEnd) return
    result.set(schedule.employee_id, {
      start: minToTime(coffeeStart),
      end: minToTime(coffeeEnd),
    })
  })

  return result
}

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
    badges.push({ label: "Pico protege intervalo", warning: onBreak })
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

// ─── page ────────────────────────────────────────────────────────────────────

export function OperationsPage() {
  const navigate = useNavigate()
  const selectedBranchId = useAppStore((state) => state.selectedBranchId)

  // ── ops state ──
  const [date, setDate] = useState(todayISO())
  const [sectorFilter, setSectorFilter] = useState("")
  const [pageIndex, setPageIndex] = useState(0)
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null)
  const [occurrenceSchedule, setOccurrenceSchedule] =
    useState<ScheduleWithRelations | null>(null)
  const [occurrenceNote, setOccurrenceNote] = useState("")
  const [occurrenceError, setOccurrenceError] = useState<string | null>(null)

  // ── allocation state ──
  const [postOpen, setPostOpen] = useState(false)
  const [editingPost, setEditingPost] = useState<OperationalPost | null>(null)
  const [postForm, setPostForm] = useState<PostFormState>(emptyPostForm())
  const [postError, setPostError] = useState<string | null>(null)
  const [allocationAction, setAllocationAction] = useState<AllocationAction | null>(null)
  const [allocationForm, setAllocationForm] = useState({
    employee_id: "",
    schedule_id: "",
    notes: "",
  })
  const [allocationError, setAllocationError] = useState<string | null>(null)
  const [cashAction, setCashAction] = useState<PostAllocation | null>(null)
  const [cashForm, setCashForm] = useState({
    movement_type: "sangria_confirmada" as CashMovementType,
    notes: "",
  })
  const [cashError, setCashError] = useState<string | null>(null)
  const [finalizeAction, setFinalizeAction] = useState<PostAllocation | null>(null)
  const [finalizeNote, setFinalizeNote] = useState("")
  const [finalizeError, setFinalizeError] = useState<string | null>(null)
  const [setupOpen, setSetupOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [cashMovOpen, setCashMovOpen] = useState(false)
  const [postsOpen, setPostsOpen] = useState(false)
  const [activePostType, setActivePostType] = useState<OperationalPostType | null>(null)
  const [breakAction, setBreakAction] = useState<{
    allocation: PostAllocation
    schedule: ScheduleWithRelations | null
  } | null>(null)
  const [coffeeAction, setCoffeeAction] = useState<{
    allocation: PostAllocation
    schedule: ScheduleWithRelations | null
    slot: CoffeeSlot
  } | null>(null)

  // ── hooks ──
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

  const branches = useBranches()
  const employees = useEmployees(null)
  const posts = useOperationalPosts()
  const history = useAllocationHistory()
  const cashMovements = useCashMovements()
  const createPost = useCreateOperationalPost()
  const updatePost = useUpdateOperationalPost()
  const togglePost = useToggleOperationalPost()
  const allocate = useAllocatePost()
  const transfer = useTransferPostAllocation()
  const confirmCash = useConfirmCashMovement()
  const setupDefaults = useSetupSegmentDefaults()

  const org = useOrganization()
  const segment = org.data?.segment ?? "other"
  const sortedPostTypes = SEGMENT_POST_TYPES[segment]
  const panelAlerts = SEGMENT_PANEL_ALERTS[segment]
  const defaultBranchId = selectedBranchId ?? branches.data?.[0]?.id ?? ""

  // ── ops derived ──
  const mode = getOperationalMode(
    operationalSettings.data?.mode ?? organization.data?.segment
  )
  const modeConfig = modeUiConfig[mode]

  const activeAllocationByEmployeeId = useMemo(() => {
    const map = new Map<string, PostAllocation>()
    for (const alloc of (allocations.data ?? []) as PostAllocation[]) {
      if (!alloc.ended_at) map.set(alloc.employee_id, alloc)
    }
    return map
  }, [allocations.data])

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

  // ── allocation derived ──
  const allPosts = useMemo(() => posts.data ?? [], [posts.data])
  const activePosts = useMemo(() => allPosts.filter((p) => p.active), [allPosts])
  const activeAllocations = useMemo(() => allocations.data ?? [], [allocations.data])

  const allocationByPostId = useMemo(() => {
    const map = new Map<string, PostAllocation>()
    for (const alloc of activeAllocations) {
      if (!alloc.ended_at) map.set(alloc.post_id, alloc)
    }
    return map
  }, [activeAllocations])

  const coveredPosts = activePosts.filter((p) => allocationByPostId.has(p.id))
  const uncoveredPosts = activePosts.filter((p) => !allocationByPostId.has(p.id))
  const sangriasToday = (cashMovements.data ?? []).filter(
    (m) => m.confirmed_at.slice(0, 10) === date && m.movement_type === "sangria_confirmada"
  ).length

  const activePostsByType = useMemo(() => {
    const map = new Map<OperationalPostType, typeof activePosts>()
    for (const post of activePosts) {
      if (!map.has(post.type)) map.set(post.type, [])
      map.get(post.type)!.push(post)
    }
    return map
  }, [activePosts])

  const availableTabs = useMemo(
    () => postTypeOrder.filter((type) => activePostsByType.has(type)),
    [activePostsByType]
  )

  const effectiveTab: OperationalPostType | null =
    availableTabs.length > 1
      ? activePostType && availableTabs.includes(activePostType)
        ? activePostType
        : availableTabs[0]
      : null

  const visiblePosts = effectiveTab
    ? (activePostsByType.get(effectiveTab) ?? [])
    : activePosts

  const busyEmployeeIds = useMemo(
    () => new Set(activeAllocations.map((a) => a.employee_id)),
    [activeAllocations]
  )

  const coffeeTimes = useMemo(
    () => calcCoffeeTimes(schedules.data ?? [], operationalSettings.data),
    [schedules.data, operationalSettings.data]
  )

  const scheduleById = useMemo(() => {
    const map = new Map<string, ScheduleWithRelations>()
    for (const s of schedules.data ?? []) map.set(s.id, s)
    return map
  }, [schedules.data])

  const scheduleByEmployeeId = useMemo(() => {
    const map = new Map<string, ScheduleWithRelations>()
    for (const s of schedules.data ?? []) {
      if (!map.has(s.employee_id)) map.set(s.employee_id, s)
    }
    return map
  }, [schedules.data])

  const overdueAllocations = useMemo(() => {
    const now = new Date()
    const nowMin = now.getHours() * 60 + now.getMinutes()
    return activeAllocations.filter((alloc) => {
      if (alloc.ended_at) return false
      const endTime =
        alloc.schedules?.end_time ??
        (alloc.schedule_id
          ? scheduleById.get(alloc.schedule_id)?.end_time
          : scheduleByEmployeeId.get(alloc.employee_id)?.end_time) ??
        null
      if (!endTime) return false
      const endMin = timeToMinutes(endTime)
      return endMin !== null && nowMin > endMin
    })
  }, [activeAllocations, scheduleById, scheduleByEmployeeId])

  const allocationEmployees = useMemo(() => {
    if (!allocationAction) return []

    const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
    const scheduledEmployeeIds = new Set(
      (schedules.data ?? [])
        .filter((s) => {
          if (s.branch_id !== allocationAction.post.branch_id) return false
          if (["day_off", "cancelled", "finished", "absent"].includes(s.status)) return false
          const endMin = timeToMinutes(s.end_time)
          if (endMin !== null && nowMin > endMin) return false
          return true
        })
        .map((s) => s.employee_id)
    )

    return (employees.data ?? [])
      .filter(
        (emp) =>
          emp.active &&
          emp.branch_id === allocationAction.post.branch_id &&
          scheduledEmployeeIds.has(emp.id) &&
          !busyEmployeeIds.has(emp.id)
      )
      .sort((a, b) => {
        const aStart = scheduleByEmployeeId.get(a.id)?.start_time ?? null
        const bStart = scheduleByEmployeeId.get(b.id)?.start_time ?? null
        if (aStart && bStart) return aStart.localeCompare(bStart)
        if (aStart) return -1
        if (bStart) return 1
        return a.name.localeCompare(b.name)
      })
  }, [allocationAction, busyEmployeeIds, employees.data, schedules.data, scheduleByEmployeeId])

  const allocationSchedules = useMemo(() => {
    if (!allocationAction || !allocationForm.employee_id) return []
    return (schedules.data ?? []).filter(
      (s) =>
        s.branch_id === allocationAction.post.branch_id &&
        s.employee_id === allocationForm.employee_id &&
        !["day_off", "cancelled", "finished", "absent"].includes(s.status)
    )
  }, [allocationAction, allocationForm.employee_id, schedules.data])

  // ── ops handlers ──

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

    const activeAlloc = activeAllocationByEmployeeId.get(schedule.employee_id)

    if (eventType === "entrada_confirmada") {
      updateSchedule.mutate({ scheduleId: schedule.id, values: { status: "working" } })
    }

    if (eventType === "intervalo_iniciado") {
      if (activeAlloc) {
        finalize.mutate({ allocation_id: activeAlloc.id, notes: "Intervalo via operacao" })
      }
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
      if (activeAlloc) {
        finalize.mutate({ allocation_id: activeAlloc.id, notes: "Saida confirmada" })
      }
      updateSchedule.mutate({ scheduleId: schedule.id, values: { status: "finished" } })
    }
  }

  function handleAction(schedule: ScheduleWithRelations, eventType: AttendanceEventType) {
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
      // keep confirm visible
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

  // ── allocation handlers ──

  function openCreatePost() {
    setEditingPost(null)
    setPostError(null)
    setPostForm(emptyPostForm(defaultBranchId))
    setPostOpen(true)
  }

  function openEditPost(post: OperationalPost) {
    setEditingPost(post)
    setPostError(null)
    setPostForm({
      branch_id: post.branch_id,
      sector_id: post.sector_id ?? "",
      name: post.name,
      type: post.type,
      active: post.active,
    })
    setPostOpen(true)
  }

  function openAllocationDialog(action: AllocationAction) {
    setAllocationAction(action)
    setAllocationError(null)
    setAllocationForm({ employee_id: "", schedule_id: "", notes: "" })
  }

  async function handlePostSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPostError(null)
    try {
      if (editingPost) {
        await updatePost.mutateAsync({
          postId: editingPost.id,
          values: {
            name: postForm.name,
            type: postForm.type,
            sector_id: postForm.sector_id || null,
            active: postForm.active,
          },
        })
      } else {
        await createPost.mutateAsync({
          branch_id: postForm.branch_id,
          sector_id: postForm.sector_id || null,
          name: postForm.name,
          type: postForm.type,
          active: postForm.active,
        })
      }
      setPostOpen(false)
    } catch (error) {
      setPostError(error instanceof Error ? error.message : "Nao foi possivel salvar.")
    }
  }

  async function handleAllocationSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!allocationAction) return
    setAllocationError(null)

    if (!allocationForm.employee_id) {
      setAllocationError("Selecione um colaborador.")
      return
    }

    try {
      if (allocationAction.type === "allocate") {
        await allocate.mutateAsync({
          post_id: allocationAction.post.id,
          employee_id: allocationForm.employee_id,
          schedule_id: allocationForm.schedule_id || null,
          notes: allocationForm.notes.trim() || null,
        })
      } else {
        await transfer.mutateAsync({
          allocation_id: allocationAction.allocation.id,
          next_employee_id: allocationForm.employee_id,
          next_schedule_id: allocationForm.schedule_id || null,
          notes: allocationForm.notes.trim() || null,
        })
      }

      const linkedSchedule = allocationForm.schedule_id
        ? scheduleById.get(allocationForm.schedule_id)
        : scheduleByEmployeeId.get(allocationForm.employee_id)
      if (linkedSchedule && ["returned", "on_break"].includes(linkedSchedule.status)) {
        try {
          await updateSchedule.mutateAsync({
            scheduleId: linkedSchedule.id,
            values: { status: "working" },
          })
        } catch (_e) {
          // non-critical
        }
      }

      setAllocationAction(null)
    } catch (error) {
      setAllocationError(
        error instanceof Error ? error.message : "Nao foi possivel concluir."
      )
    }
  }

  async function handleCashSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!cashAction) return
    setCashError(null)
    try {
      await confirmCash.mutateAsync({
        allocation_id: cashAction.id,
        movement_type: cashForm.movement_type,
        notes: cashForm.notes.trim() || null,
      })
      setCashAction(null)
      setCashForm({ movement_type: "sangria_confirmada", notes: "" })
    } catch (error) {
      setCashError(error instanceof Error ? error.message : "Nao foi possivel confirmar.")
    }
  }

  async function handleFinalizeAll() {
    for (const alloc of overdueAllocations) {
      try {
        await finalize.mutateAsync({ allocation_id: alloc.id, notes: "Saida por horario excedido" })
      } catch (_e) {
        // individual errors surfaced by toasts
      }
    }
  }

  async function handleFinalizeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!finalizeAction) return
    setFinalizeError(null)
    try {
      await finalize.mutateAsync({
        allocation_id: finalizeAction.id,
        notes: finalizeNote.trim() || null,
      })
      setFinalizeAction(null)
      setFinalizeNote("")
    } catch (error) {
      setFinalizeError(error instanceof Error ? error.message : "Nao foi possivel finalizar.")
    }
  }

  function handleBreakClick(
    allocation: PostAllocation,
    schedule: ScheduleWithRelations | null
  ) {
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
    const breakStartMin = schedule?.break_start ? timeToMinutes(schedule.break_start) : null
    if (breakStartMin !== null && nowMin >= breakStartMin) {
      void doBreak(allocation, schedule)
    } else {
      setBreakAction({ allocation, schedule })
    }
  }

  function handleCoffeeBadgeClick(
    allocation: PostAllocation,
    schedule: ScheduleWithRelations | null,
    slot: CoffeeSlot
  ) {
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
    const slotStart = timeToMinutes(slot.start) ?? 0
    if (nowMin >= slotStart) {
      void doCoffeeBreak(allocation, schedule)
    } else {
      setCoffeeAction({ allocation, schedule, slot })
    }
  }

  async function doCoffeeBreak(
    _allocation: PostAllocation,
    schedule: ScheduleWithRelations | null
  ) {
    try {
      if (schedule) {
        await updateSchedule.mutateAsync({
          scheduleId: schedule.id,
          values: { status: "on_break" },
        })
        recordEvent.mutate({
          branch_id: schedule.branch_id,
          employee_id: schedule.employee_id,
          schedule_id: schedule.id,
          event_type: "intervalo_iniciado",
          notes: "Pausa cafe via operacao",
        })
      }
      setCoffeeAction(null)
      navigate("/app/intervals")
    } catch (_e) {
      // errors handled by mutation toasts
    }
  }

  async function doBreak(
    allocation: PostAllocation,
    schedule: ScheduleWithRelations | null
  ) {
    const now = new Date()
    const currentTimeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
    try {
      await finalize.mutateAsync({ allocation_id: allocation.id, notes: "Intervalo" })
      if (schedule) {
        await updateSchedule.mutateAsync({
          scheduleId: schedule.id,
          values: { status: "on_break", break_start: currentTimeStr },
        })
        recordEvent.mutate({
          branch_id: schedule.branch_id,
          employee_id: schedule.employee_id,
          schedule_id: schedule.id,
          event_type: "intervalo_iniciado",
          notes: "Intervalo via operacao",
        })
      }
      setBreakAction(null)
      navigate("/app/intervals")
    } catch (_e) {
      // errors surfaced by mutation toasts
    }
  }

  // ─── render ─────────────────────────────────────────────────────────────────

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
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                void posts.refetch()
                void allocations.refetch()
                void cashMovements.refetch()
              }}
              aria-label="Atualizar"
            >
              <RefreshCw className="size-4" />
            </Button>
            <Button
              variant="outline"
              onClick={() => setSetupOpen(true)}
              disabled={!defaultBranchId}
            >
              <Wand2 className="size-4" />
              Configurar {SEGMENT_LABELS[segment]}
            </Button>
            <Button onClick={openCreatePost} disabled={!defaultBranchId}>
              <Plus className="size-4" />
              Novo posto
            </Button>
          </div>
        }
      />

      <div className="space-y-6 p-6">

        {/* ── Allocation KPI row ── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Postos ativos",   value: activePosts.length,   Icon: Store,       extra: "" },
            { label: "Cobertos",        value: coveredPosts.length,  Icon: CheckCircle2, extra: "" },
            {
              label: "Sem cobertura",
              value: uncoveredPosts.length,
              Icon: ShieldAlert,
              extra: uncoveredPosts.length > 0 ? "border-red-200 bg-red-50" : "",
            },
            { label: "Sangrias hoje",   value: sangriasToday,        Icon: Banknote,    extra: "" },
          ].map(({ label, value, Icon, extra }) => (
            <div
              key={label}
              className={`flex items-center gap-3 rounded-lg border bg-white px-4 py-3 shadow-sm ${extra}`}
            >
              <Icon className="size-4 shrink-0 text-muted-foreground" />
              <div>
                <div className="text-xl font-bold leading-none">{value}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Overdue allocations ── */}
        {overdueAllocations.length > 0 ? (
          <Card className="border border-orange-200 bg-orange-50 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-orange-800">
                  <Clock className="size-5" />
                  Colaboradores alem do horario de saida ({overdueAllocations.length})
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={finalize.isPending}
                  onClick={() => void handleFinalizeAll()}
                >
                  Finalizar todos
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {overdueAllocations.map((alloc) => {
                  const sched = alloc.schedule_id
                    ? scheduleById.get(alloc.schedule_id)
                    : scheduleByEmployeeId.get(alloc.employee_id)
                  return (
                    <div
                      key={alloc.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-orange-200 bg-white p-3"
                    >
                      <div>
                        <div className="font-medium">
                          {alloc.employees?.name ?? "Colaborador"}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {alloc.operational_posts?.name ?? "Posto"} · saida prevista{" "}
                          {formatTime(sched?.end_time)}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={finalize.isPending}
                        onClick={() => setFinalizeAction(alloc)}
                      >
                        Finalizar
                      </Button>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* ── Main 2-col: employee panel + coverage panel ── */}
        <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">

          {/* Employee operational panel */}
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
                  <Badge key={rule} variant="outline">{rule}</Badge>
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
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
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
                          <div className="flex items-start justify-between gap-2">
                            <div
                              className={`flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${avatarClass}`}
                            >
                              {getInitials(schedule.employees?.name ?? "?")}
                            </div>
                            <StatusBadge status={currentStatus ?? "aguardando_evento"} />
                          </div>

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

                          <div className="mt-2 text-xs text-muted-foreground">
                            {formatTime(schedule.start_time)} → {formatTime(schedule.end_time)}
                            {schedule.break_start ? (
                              <span className="ml-2 text-slate-400">
                                · intervalo {formatTime(schedule.break_start)}
                              </span>
                            ) : null}
                          </div>

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
                                            REQUIRES_CONFIRM.has(eventType)
                                              ? "destructive"
                                              : "ghost"
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

          {/* Coverage panel */}
          <Card className="border bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPinned className="size-5" />
                Painel de cobertura
              </CardTitle>
            </CardHeader>
            <CardContent>
              {panelAlerts.length > 0 && uncoveredPosts.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-2">
                  {panelAlerts
                    .filter((a) => a.severity === "critical")
                    .slice(0, 3)
                    .map((alert) => (
                      <div
                        key={alert.label}
                        className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs text-red-700"
                      >
                        <span className="font-medium">{alert.label}</span>
                        {" — "}
                        {alert.description}
                      </div>
                    ))}
                </div>
              )}

              {posts.isLoading || allocations.isLoading ? (
                <StateBlock type="loading" title="Carregando postos" />
              ) : activePosts.length === 0 ? (
                <StateBlock
                  title="Nenhum posto ativo"
                  description="Cadastre caixas, balcoes ou pontos de atendimento para acompanhar cobertura."
                />
              ) : (
                <>
                  {availableTabs.length > 1 ? (
                    <div className="mb-4 flex flex-wrap gap-1.5">
                      {availableTabs.map((type) => {
                        const typePosts = activePostsByType.get(type) ?? []
                        const uncoveredCount = typePosts.filter(
                          (p) => !allocationByPostId.has(p.id)
                        ).length
                        const isActive = type === effectiveTab
                        return (
                          <button
                            key={type}
                            onClick={() => setActivePostType(type)}
                            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                              isActive
                                ? "bg-slate-950 text-white"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                          >
                            {postTypeLabel[type]}
                            <span
                              className={`rounded-full px-1.5 text-xs tabular-nums ${
                                isActive
                                  ? "bg-white/20 text-white"
                                  : "bg-slate-200 text-slate-500"
                              }`}
                            >
                              {typePosts.length}
                            </span>
                            {uncoveredCount > 0 ? (
                              <span className="rounded-full bg-red-500 px-1.5 text-xs tabular-nums text-white">
                                {uncoveredCount}
                              </span>
                            ) : null}
                          </button>
                        )
                      })}
                    </div>
                  ) : null}

                  <div className="grid gap-3 lg:grid-cols-2">
                    {visiblePosts.map((post) => {
                      const allocation = allocationByPostId.get(post.id)
                      const employeeSchedule: ScheduleWithRelations | null = allocation
                        ? (allocation.schedule_id
                            ? scheduleById.get(allocation.schedule_id)
                            : scheduleByEmployeeId.get(allocation.employee_id)) ?? null
                        : null
                      const cashierSchedule =
                        allocation && post.type === "cashier" ? employeeSchedule : null
                      const coffeeSlot = allocation
                        ? (coffeeTimes.get(allocation.employee_id) ?? null)
                        : null
                      const nowMinCard = new Date().getHours() * 60 + new Date().getMinutes()
                      const isOnCoffeeBreak = Boolean(
                        allocation && employeeSchedule?.status === "on_break"
                      )
                      const breakAlreadyDone =
                        (employeeSchedule?.notes?.includes("lunch_done") ?? false) ||
                        employeeSchedule?.status === "returned"
                      const coffeeWasDone =
                        employeeSchedule?.notes?.includes("cafe_done") ?? false
                      const isAtendimentoFiscal =
                        post.type === "service_desk" &&
                        (post.sectors?.name ?? "").toLowerCase().includes("fiscal")

                      return (
                        <div
                          key={post.id}
                          className={`rounded-lg border p-4 ${
                            isOnCoffeeBreak
                              ? "border-amber-200 bg-amber-50"
                              : allocation
                                ? "border-emerald-200 bg-emerald-50"
                                : "border-red-200 bg-red-50"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-medium">{post.name}</div>
                              <div className="mt-1 text-sm text-muted-foreground">
                                {postTypeLabel[post.type]} -{" "}
                                {post.sectors?.name ?? "Sem setor"}
                              </div>
                            </div>
                            {isOnCoffeeBreak ? (
                              <Badge
                                variant="outline"
                                className="border-amber-300 bg-amber-100 text-amber-700"
                              >
                                Em cafe
                              </Badge>
                            ) : (
                              <Badge variant={allocation ? "default" : "destructive"}>
                                {allocation ? "Coberto" : "Sem cobertura"}
                              </Badge>
                            )}
                          </div>

                          {allocation ? (
                            <div className="mt-4 space-y-3">
                              <div
                                className={`rounded-lg border p-3 ${
                                  isOnCoffeeBreak
                                    ? "border-amber-200 bg-white/60"
                                    : "bg-white/70"
                                }`}
                              >
                                <div className="text-sm font-medium">
                                  {allocation.employees?.name ?? "Colaborador"}
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                  Desde {formatDateTimeBR(allocation.started_at)}
                                </div>
                                {cashierSchedule && !isOnCoffeeBreak ? (
                                  <CashierScheduleInfo schedule={cashierSchedule} />
                                ) : null}
                                {isOnCoffeeBreak ? (
                                  <div className="mt-2 flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-100 px-2.5 py-1.5 text-xs font-medium text-amber-800">
                                    <Coffee className="size-3 shrink-0" />
                                    Em pausa de cafe — acompanhe em Intervalo / Cafe
                                  </div>
                                ) : coffeeWasDone ? (
                                  <div className="mt-2 flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-400">
                                    <Coffee className="size-3 shrink-0" />
                                    Cafe feito
                                    {coffeeSlot ? ` (${coffeeSlot.start})` : ""}
                                  </div>
                                ) : coffeeSlot ? (() => {
                                  const slotStart = timeToMinutes(coffeeSlot.start) ?? 0
                                  const slotEnd = timeToMinutes(coffeeSlot.end) ?? 0
                                  const active = nowMinCard >= slotStart && nowMinCard < slotEnd
                                  return (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleCoffeeBadgeClick(
                                          allocation,
                                          employeeSchedule,
                                          coffeeSlot
                                        )
                                      }
                                      className={`mt-2 flex w-full items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors ${
                                        active
                                          ? "border-amber-400 bg-amber-100 font-medium text-amber-800 hover:bg-amber-200"
                                          : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                                      }`}
                                    >
                                      <Coffee className="size-3 shrink-0" />
                                      <span className="flex-1">
                                        {active
                                          ? `Cafe agora — ate ${coffeeSlot.end}`
                                          : `Cafe: ${coffeeSlot.start} — ${coffeeSlot.end}`}
                                      </span>
                                      <span className="text-[10px] opacity-60">
                                        {active ? "Liberar" : "Iniciar"}
                                      </span>
                                    </button>
                                  )
                                })() : null}
                              </div>
                              {!isOnCoffeeBreak && (
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      openAllocationDialog({
                                        type: "transfer",
                                        post,
                                        allocation,
                                      })
                                    }
                                  >
                                    <ArrowRightLeft className="size-4" />
                                    Trocar
                                  </Button>
                                  {breakAlreadyDone ? (
                                    <Button size="sm" variant="outline" disabled>
                                      <CheckCircle2 className="size-4 text-emerald-500" />
                                      Intervalo feito
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        handleBreakClick(allocation, employeeSchedule)
                                      }
                                    >
                                      <Clock className="size-4" />
                                      Intervalo
                                    </Button>
                                  )}
                                  {isAtendimentoFiscal ? (
                                    <>
                                      <Button size="sm" variant="outline">
                                        <AlertCircle className="size-4" />
                                        Ocorrencias
                                      </Button>
                                      <Button size="sm" variant="outline">
                                        <HelpCircle className="size-4" />
                                        Ajuda
                                      </Button>
                                      <Button size="sm" variant="outline">
                                        <ClipboardCheck className="size-4" />
                                        Checklists
                                      </Button>
                                    </>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setCashAction(allocation)}
                                    >
                                      <Banknote className="size-4" />
                                      Sangria
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => setFinalizeAction(allocation)}
                                  >
                                    Finalizar
                                  </Button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="mt-4">
                              <Button
                                size="sm"
                                onClick={() =>
                                  openAllocationDialog({ type: "allocate", post })
                                }
                              >
                                <UserRoundCheck className="size-4" />
                                Alocar colaborador
                              </Button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Timeline + History + Cash movements ── */}
        <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">

          {/* Timeline */}
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

          {/* History + Cash movements */}
          <div className="space-y-4">
            <Card className="border bg-white shadow-sm">
              <CardHeader
                className="cursor-pointer select-none"
                onClick={() => setHistoryOpen((v) => !v)}
              >
                <CardTitle className="flex items-center gap-2">
                  <History className="size-5" />
                  <span className="flex-1">Historico de alocacao</span>
                  <ChevronDown
                    className={`size-4 text-muted-foreground transition-transform duration-200 ${
                      historyOpen ? "rotate-180" : ""
                    }`}
                  />
                </CardTitle>
              </CardHeader>
              {historyOpen ? (
                <CardContent className="space-y-3">
                  {(history.data ?? []).slice(0, 6).length === 0 ? (
                    <StateBlock title="Sem trocas registradas" />
                  ) : (
                    (history.data ?? []).slice(0, 6).map((item) => (
                      <div key={item.id} className="rounded-lg border p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium">
                            {item.operational_posts?.name ?? "Posto"}
                          </div>
                          <Badge variant="outline">
                            {item.ended_at ? "Finalizado" : "Ativo"}
                          </Badge>
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {item.employees?.name ?? "Colaborador"} -{" "}
                          {formatDateTimeBR(item.started_at)}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              ) : null}
            </Card>

            <Card className="border bg-white shadow-sm">
              <CardHeader
                className="cursor-pointer select-none"
                onClick={() => setCashMovOpen((v) => !v)}
              >
                <CardTitle className="flex items-center gap-2">
                  <Banknote className="size-5" />
                  <span className="flex-1">Movimentos de caixa</span>
                  <ChevronDown
                    className={`size-4 text-muted-foreground transition-transform duration-200 ${
                      cashMovOpen ? "rotate-180" : ""
                    }`}
                  />
                </CardTitle>
              </CardHeader>
              {cashMovOpen ? (
                <CardContent className="space-y-3">
                  {(cashMovements.data ?? []).slice(0, 5).length === 0 ? (
                    <StateBlock title="Sem movimentos registrados" />
                  ) : (
                    (cashMovements.data ?? []).slice(0, 5).map((movement) => (
                      <div key={movement.id} className="rounded-lg border p-3">
                        <div className="font-medium">
                          {cashMovementLabel[movement.movement_type]}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {movement.operational_posts?.name ?? "Posto"} -{" "}
                          {movement.employees?.name ?? "Colaborador"}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              ) : null}
            </Card>
          </div>
        </div>

        {/* ── Posts list ── */}
        <Card className="border bg-white shadow-sm">
          <CardHeader
            className="cursor-pointer select-none"
            onClick={() => setPostsOpen((v) => !v)}
          >
            <CardTitle className="flex items-center gap-2">
              <Store className="size-5" />
              <span className="flex-1">Postos cadastrados</span>
              <ChevronDown
                className={`size-4 text-muted-foreground transition-transform duration-200 ${
                  postsOpen ? "rotate-180" : ""
                }`}
              />
            </CardTitle>
          </CardHeader>
          {postsOpen ? (
            <CardContent>
              {allPosts.length === 0 ? (
                <StateBlock title="Nenhum posto cadastrado" />
              ) : (
                <div className="space-y-3">
                  {allPosts.map((post) => (
                    <div
                      key={post.id}
                      className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{post.name}</span>
                          <Badge variant={post.active ? "outline" : "secondary"}>
                            {post.active ? "Ativo" : "Inativo"}
                          </Badge>
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {post.branches?.name ?? "Filial"} -{" "}
                          {post.sectors?.name ?? "Sem setor"} -{" "}
                          {postTypeLabel[post.type]}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => openEditPost(post)}
                          aria-label={`Editar ${post.name}`}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() =>
                            togglePost.mutate({ postId: post.id, active: !post.active })
                          }
                          aria-label={post.active ? `Desativar ${post.name}` : `Ativar ${post.name}`}
                        >
                          <Power className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          ) : null}
        </Card>
      </div>

      {/* ═══════════════════════════════════════ DIALOGS ══════════════════════ */}

      {/* Occurrence */}
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

      {/* Create / edit post */}
      <Dialog open={postOpen} onOpenChange={setPostOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPost ? "Editar posto operacional" : "Cadastrar posto"}
            </DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handlePostSubmit}>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Nome</span>
              <Input
                required
                value={postForm.name}
                onChange={(event) =>
                  setPostForm((current) => ({ ...current, name: event.target.value }))
                }
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium">Filial</span>
                <select
                  className={fieldClassFull}
                  value={postForm.branch_id}
                  disabled={Boolean(editingPost)}
                  onChange={(event) =>
                    setPostForm((current) => ({
                      ...current,
                      branch_id: event.target.value,
                      sector_id: "",
                    }))
                  }
                  required
                >
                  <option value="">Selecione</option>
                  {(branches.data ?? []).map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Setor</span>
                <select
                  className={fieldClassFull}
                  value={postForm.sector_id}
                  onChange={(event) =>
                    setPostForm((current) => ({ ...current, sector_id: event.target.value }))
                  }
                >
                  <option value="">Sem setor</option>
                  {sectorOptionsForBranch(sectors.data ?? [], postForm.branch_id).map(
                    (sector) => (
                      <option key={sector.id} value={sector.id}>
                        {sector.name}
                      </option>
                    )
                  )}
                </select>
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium">Tipo</span>
                <select
                  className={fieldClassFull}
                  value={postForm.type}
                  onChange={(event) =>
                    setPostForm((current) => ({
                      ...current,
                      type: event.target.value as OperationalPostType,
                    }))
                  }
                >
                  {sortedPostTypes.map((type) => (
                    <option key={type} value={type}>
                      {postTypeLabel[type]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Status</span>
                <select
                  className={fieldClassFull}
                  value={postForm.active ? "active" : "inactive"}
                  onChange={(event) =>
                    setPostForm((current) => ({
                      ...current,
                      active: event.target.value === "active",
                    }))
                  }
                >
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                </select>
              </label>
            </div>
            {postError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {postError}
              </div>
            ) : null}
            <DialogFooter>
              <Button type="submit" disabled={createPost.isPending || updatePost.isPending}>
                {editingPost ? "Salvar posto" : "Criar posto"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Allocate / transfer */}
      <Dialog
        open={Boolean(allocationAction)}
        onOpenChange={(open) => { if (!open) setAllocationAction(null) }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {allocationAction?.type === "transfer"
                ? "Trocar colaborador"
                : "Alocar colaborador"}
            </DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleAllocationSubmit}>
            <div className="rounded-lg border bg-slate-50 p-3 text-sm">
              <div className="font-medium">{allocationAction?.post.name}</div>
              <div className="mt-1 text-muted-foreground">
                {allocationAction
                  ? postTypeLabel[allocationAction.post.type]
                  : "Posto operacional"}
              </div>
            </div>

            <label className="space-y-1 text-sm">
              <span className="font-medium">Colaborador</span>
              <select
                className={fieldClassFull}
                value={allocationForm.employee_id}
                onChange={(event) => {
                  const empId = event.target.value
                  const empSchedules = (schedules.data ?? []).filter(
                    (s) =>
                      s.branch_id === allocationAction?.post.branch_id &&
                      s.employee_id === empId &&
                      !["day_off", "cancelled", "finished", "absent"].includes(s.status)
                  )
                  const autoSchedule =
                    empSchedules.find((s) =>
                      ["working", "returned", "scheduled", "on_break"].includes(s.status)
                    ) ??
                    empSchedules[0] ??
                    null
                  setAllocationForm((current) => ({
                    ...current,
                    employee_id: empId,
                    schedule_id: autoSchedule?.id ?? "",
                  }))
                }}
                required
              >
                <option value="">Selecione</option>
                {allocationEmployees.map((employee) => {
                  const empSched = scheduleByEmployeeId.get(employee.id)
                  const startLabel = empSched?.start_time
                    ? formatTime(empSched.start_time)
                    : null
                  const breakNote =
                    empSched?.status === "returned"
                      ? " ✓ retornou"
                      : empSched?.status === "on_break"
                        ? " ● intervalo"
                        : ""
                  return (
                    <option key={employee.id} value={employee.id}>
                      {startLabel ? `${startLabel} — ` : ""}
                      {employee.name}
                      {getEmployeeSubtitle(employee)
                        ? ` - ${getEmployeeSubtitle(employee)}`
                        : ""}
                      {breakNote}
                    </option>
                  )
                })}
              </select>
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium">Escala do dia</span>
              <select
                className={fieldClassFull}
                value={allocationForm.schedule_id}
                onChange={(event) =>
                  setAllocationForm((current) => ({
                    ...current,
                    schedule_id: event.target.value,
                  }))
                }
              >
                <option value="">Sem vincular escala</option>
                {allocationSchedules.map((schedule) => (
                  <option key={schedule.id} value={schedule.id}>
                    {getScheduleLabel(schedule)}
                    {scheduleStatusNote(schedule.status)}
                  </option>
                ))}
              </select>
            </label>

            {(() => {
              const empSched = allocationForm.employee_id
                ? scheduleByEmployeeId.get(allocationForm.employee_id)
                : null
              if (empSched?.status === "returned") {
                return (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                    Este colaborador ja realizou o intervalo hoje. Ao confirmar, a escala
                    volta automaticamente para &quot;trabalhando&quot;.
                  </div>
                )
              }
              if (empSched?.status === "on_break") {
                return (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    Atencao: este colaborador esta em intervalo agora. A escala sera
                    restaurada para &quot;trabalhando&quot; ao confirmar.
                  </div>
                )
              }
              return null
            })()}

            <label className="space-y-1 text-sm">
              <span className="font-medium">Observacao</span>
              <Input
                value={allocationForm.notes}
                onChange={(event) =>
                  setAllocationForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
              />
            </label>

            {allocationError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {allocationError}
              </div>
            ) : null}

            <DialogFooter>
              <Button
                type="submit"
                disabled={allocate.isPending || transfer.isPending}
              >
                {allocationAction?.type === "transfer"
                  ? "Confirmar troca"
                  : "Confirmar alocacao"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Cash movement */}
      <Dialog
        open={Boolean(cashAction)}
        onOpenChange={(open) => {
          if (!open) { setCashAction(null); setCashError(null) }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar movimento de caixa</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleCashSubmit}>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Movimento</span>
              <select
                className={fieldClassFull}
                value={cashForm.movement_type}
                onChange={(event) =>
                  setCashForm((current) => ({
                    ...current,
                    movement_type: event.target.value as CashMovementType,
                  }))
                }
              >
                {Object.entries(cashMovementLabel).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Observacao</span>
              <Input
                value={cashForm.notes}
                onChange={(event) =>
                  setCashForm((current) => ({ ...current, notes: event.target.value }))
                }
              />
            </label>
            {cashError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {cashError}
              </div>
            ) : null}
            <DialogFooter>
              <Button type="submit" disabled={confirmCash.isPending}>
                Confirmar movimento
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Finalize allocation */}
      <Dialog
        open={Boolean(finalizeAction)}
        onOpenChange={(open) => {
          if (!open) { setFinalizeAction(null); setFinalizeError(null) }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finalizar alocacao</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleFinalizeSubmit}>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Esta acao libera o posto para receber outro colaborador.
            </div>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Observacao</span>
              <Input
                value={finalizeNote}
                onChange={(event) => setFinalizeNote(event.target.value)}
              />
            </label>
            {finalizeError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {finalizeError}
              </div>
            ) : null}
            <DialogFooter>
              <Button
                type="submit"
                variant="destructive"
                disabled={finalize.isPending}
              >
                Finalizar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm break */}
      <Dialog
        open={Boolean(breakAction)}
        onOpenChange={(open) => { if (!open) setBreakAction(null) }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar intervalo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="rounded-lg border bg-slate-50 p-3">
              <div className="font-medium">
                {breakAction?.allocation.employees?.name ?? "Colaborador"}
              </div>
            </div>
            {breakAction?.schedule?.break_start ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">
                O intervalo previsto e{" "}
                <strong>{breakAction.schedule.break_start}</strong>
                {breakAction.schedule.break_end
                  ? ` — ${breakAction.schedule.break_end}`
                  : ""}
                . Deseja antecipar e iniciar o intervalo agora?
              </div>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">
                Este colaborador nao tem horario de intervalo definido na escala de hoje.
                Deseja iniciar o intervalo agora mesmo?
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setBreakAction(null)}>
              Nao
            </Button>
            <Button
              disabled={finalize.isPending || updateSchedule.isPending}
              onClick={() => {
                if (breakAction)
                  void doBreak(breakAction.allocation, breakAction.schedule)
              }}
            >
              <Coffee className="size-4" />
              Sim, iniciar intervalo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm coffee break */}
      <Dialog
        open={Boolean(coffeeAction)}
        onOpenChange={(open) => { if (!open) setCoffeeAction(null) }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar cafe</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="rounded-lg border bg-slate-50 p-3">
              <div className="font-medium">
                {coffeeAction?.allocation.employees?.name ?? "Colaborador"}
              </div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">
              O horario de cafe esta previsto para{" "}
              <strong>{coffeeAction?.slot.start}</strong>
              {coffeeAction?.slot.end ? ` — ${coffeeAction.slot.end}` : ""}.
              Deseja antecipar e liberar para o cafe agora?
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCoffeeAction(null)}>
              Nao
            </Button>
            <Button
              disabled={finalize.isPending || updateSchedule.isPending}
              onClick={() => {
                if (coffeeAction)
                  void doCoffeeBreak(coffeeAction.allocation, coffeeAction.schedule)
              }}
            >
              <Coffee className="size-4" />
              Sim, liberar para o cafe
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Segment setup */}
      <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configurar {SEGMENT_LABELS[segment]}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              Cria os setores e postos operacionais padrao para{" "}
              <strong>{SEGMENT_LABELS[segment]}</strong>. Registros ja existentes com o
              mesmo nome sao ignorados — a operacao e segura para repetir.
            </p>
            <div>
              <p className="mb-1.5 font-medium">
                Setores ({SEGMENT_DEFAULT_SECTORS[segment].length})
              </p>
              <ul className="space-y-0.5 text-muted-foreground">
                {SEGMENT_DEFAULT_SECTORS[segment].map((s) => (
                  <li key={s}>• {s}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1.5 font-medium">
                Postos ({SEGMENT_DEFAULT_POSTS[segment].length})
              </p>
              <ul className="space-y-0.5 text-muted-foreground">
                {SEGMENT_DEFAULT_POSTS[segment].map((p) => (
                  <li key={p.name}>
                    • {p.name}{" "}
                    <span className="text-xs">
                      ({postTypeLabel[p.type]} — {p.sector_name})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={setupDefaults.isPending || !defaultBranchId}
              onClick={() => {
                void setupDefaults.mutateAsync({
                  branch_id: defaultBranchId,
                  sector_names: SEGMENT_DEFAULT_SECTORS[segment],
                  post_definitions: SEGMENT_DEFAULT_POSTS[segment],
                })
                setSetupOpen(false)
              }}
            >
              <Wand2 className="size-4" />
              Configurar agora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
