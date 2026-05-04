import { useMemo, useState } from "react"
import type { FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import {
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
  Plus,
  Power,
  RefreshCw,
  ShieldAlert,
  Store,
  UserRoundCheck,
  Wand2,
} from "lucide-react"
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
import {
  useAllocatePost,
  useAllocationHistory,
  useBranches,
  useCashMovements,
  useConfirmCashMovement,
  useCreateOperationalPost,
  useEmployees,
  useFinalizePostAllocation,
  useOperationalPosts,
  useOperationalSettings,
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
import {
  SEGMENT_DEFAULT_POSTS,
  SEGMENT_DEFAULT_SECTORS,
  SEGMENT_LABELS,
  SEGMENT_PANEL_ALERTS,
  SEGMENT_POST_TYPES,
} from "@/lib/segmentConfig"
import { formatDateTimeBR, formatTime, todayISO } from "@/lib/format"
import { useAppStore } from "@/store/useAppStore"
import type {
  CashMovementType,
  EmployeeWithRelations,
  OperationalPost,
  OperationalPostType,
  OperationalSettings,
  PostAllocation,
  ScheduleWithRelations,
  Sector,
} from "@/types/domain"

const fieldClass =
  "h-8 w-full rounded-lg border bg-white px-2.5 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"

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

type CoffeeSlot = { start: string; end: string }

function minToTime(min: number): string {
  const h = Math.floor(min / 60) % 24
  const m = min % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

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

  // Include everyone who is or was working today
  // Exclude day_off / cancelled / absent — they won't take coffee
  const eligible = scheduleList.filter(
    (s) => !["day_off", "cancelled", "absent"].includes(s.status)
  )

  // Sort based on configured order
  let sorted: ScheduleWithRelations[]
  if (order === "inverse") {
    // Latest lunch → first coffee slot
    sorted = [...eligible].sort(
      (a, b) => (timeToMinutes(b.break_start) ?? 0) - (timeToMinutes(a.break_start) ?? 0)
    )
  } else if (order === "same") {
    // Earliest lunch → first coffee slot
    sorted = [...eligible].sort(
      (a, b) => (timeToMinutes(a.break_start) ?? 0) - (timeToMinutes(b.break_start) ?? 0)
    )
  } else {
    // "none" — assign in original schedule data order
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

function emptyPostForm(branchId = ""): PostFormState {
  return {
    branch_id: branchId,
    sector_id: "",
    name: "",
    type: "cashier",
    active: true,
  }
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

export function AllocationPage() {
  const selectedBranchId = useAppStore((state) => state.selectedBranchId)
  const branches = useBranches()
  const sectors = useSectors(null)
  const employees = useEmployees(null)
  const posts = useOperationalPosts()
  const allocations = usePostAllocations()
  const history = useAllocationHistory()
  const cashMovements = useCashMovements()
  const [date, setDate] = useState(todayISO())
  const schedules = useSchedules(date, null)
  const coffeeSettings = useOperationalSettings(null)

  const createPost = useCreateOperationalPost()
  const updatePost = useUpdateOperationalPost()
  const togglePost = useToggleOperationalPost()
  const allocate = useAllocatePost()
  const transfer = useTransferPostAllocation()
  const finalize = useFinalizePostAllocation()
  const confirmCash = useConfirmCashMovement()

  const [postOpen, setPostOpen] = useState(false)
  const [editingPost, setEditingPost] = useState<OperationalPost | null>(null)
  const [postForm, setPostForm] = useState<PostFormState>(emptyPostForm())
  const [postError, setPostError] = useState<string | null>(null)
  const [allocationAction, setAllocationAction] =
    useState<AllocationAction | null>(null)
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

  const navigate = useNavigate()
  const updateSchedule = useUpdateSchedule()
  const recordEvent = useRecordOperationalEvent()

  const org = useOrganization()
  const setupDefaults = useSetupSegmentDefaults()
  const segment = org.data?.segment ?? "other"
  const sortedPostTypes = SEGMENT_POST_TYPES[segment]
  const panelAlerts = SEGMENT_PANEL_ALERTS[segment]

  const defaultBranchId = selectedBranchId ?? branches.data?.[0]?.id ?? ""
  const allPosts = useMemo(() => posts.data ?? [], [posts.data])
  const activePosts = useMemo(
    () => allPosts.filter((post) => post.active),
    [allPosts]
  )
  const activeAllocations = useMemo(
    () => allocations.data ?? [],
    [allocations.data]
  )
  const allocationByPostId = useMemo(() => {
    const map = new Map<string, PostAllocation>()
    for (const allocationItem of activeAllocations) {
      if (!allocationItem.ended_at) map.set(allocationItem.post_id, allocationItem)
    }
    return map
  }, [activeAllocations])
  const coveredPosts = activePosts.filter((post) => allocationByPostId.has(post.id))
  const uncoveredPosts = activePosts.filter(
    (post) => !allocationByPostId.has(post.id)
  )
  const sangriasToday = (cashMovements.data ?? []).filter(
    (movement) =>
      movement.confirmed_at.slice(0, 10) === date &&
      movement.movement_type === "sangria_confirmada"
  ).length
  const postTypeOrder: OperationalPostType[] = [
    "cashier", "self_checkout", "counter", "service_desk",
    "delivery", "stock", "kitchen", "reception", "other",
  ]

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

  const visiblePosts = effectiveTab ? (activePostsByType.get(effectiveTab) ?? []) : activePosts

  const busyEmployeeIds = useMemo(
    () => new Set(activeAllocations.map((allocationItem) => allocationItem.employee_id)),
    [activeAllocations]
  )
  const coffeeTimes = useMemo(
    () => calcCoffeeTimes(schedules.data ?? [], coffeeSettings.data),
    [schedules.data, coffeeSettings.data]
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
    return activeAllocations.filter((allocation) => {
      if (allocation.ended_at) return false
      const schedule = allocation.schedule_id
        ? scheduleById.get(allocation.schedule_id)
        : scheduleByEmployeeId.get(allocation.employee_id)
      if (!schedule?.end_time) return false
      const endMin = timeToMinutes(schedule.end_time)
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
        (employee) =>
          employee.active &&
          employee.branch_id === allocationAction.post.branch_id &&
          scheduledEmployeeIds.has(employee.id) &&
          !busyEmployeeIds.has(employee.id)
      )
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [allocationAction, busyEmployeeIds, employees.data, schedules.data])

  const allocationSchedules = useMemo(() => {
    if (!allocationAction || !allocationForm.employee_id) return []

    return (schedules.data ?? []).filter(
      (schedule) =>
        schedule.branch_id === allocationAction.post.branch_id &&
        schedule.employee_id === allocationForm.employee_id &&
        !["day_off", "cancelled", "finished", "absent"].includes(schedule.status)
    )
  }, [allocationAction, allocationForm.employee_id, schedules.data])

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
    setAllocationForm({
      employee_id: "",
      schedule_id: "",
      notes: "",
    })
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

      // If employee was on break or returned, restore schedule to "working"
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
          // non-critical — allocation already created
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
    for (const allocation of overdueAllocations) {
      try {
        await finalize.mutateAsync({
          allocation_id: allocation.id,
          notes: "Saida por horario excedido",
        })
      } catch (_e) {
        // individual errors are surfaced by mutation toasts
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
    const now = new Date()
    const nowMin = now.getHours() * 60 + now.getMinutes()
    const breakStartMin =
      schedule?.break_start ? timeToMinutes(schedule.break_start) : null
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
    const now = new Date()
    const nowMin = now.getHours() * 60 + now.getMinutes()
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
    // Coffee: keep allocation active (post stays with employee), just mark schedule on_break
    try {
      if (schedule) {
        await updateSchedule.mutateAsync({
          scheduleId: schedule.id,
          values: { status: "on_break" },
        })
        // Sync to operational_status_records (non-critical)
        recordEvent.mutate({
          branch_id: schedule.branch_id,
          employee_id: schedule.employee_id,
          schedule_id: schedule.id,
          event_type: "intervalo_iniciado",
          notes: "Pausa cafe via alocacao",
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
        // Sync to operational_status_records (non-critical)
        recordEvent.mutate({
          branch_id: schedule.branch_id,
          employee_id: schedule.employee_id,
          schedule_id: schedule.id,
          event_type: "intervalo_iniciado",
          notes: "Intervalo via alocacao",
        })
      }
      setBreakAction(null)
      navigate("/app/intervals")
    } catch (_e) {
      // errors surfaced by mutation toasts
    }
  }

  const isLoading =
    posts.isLoading ||
    allocations.isLoading ||
    branches.isLoading ||
    employees.isLoading ||
    schedules.isLoading

  const pageError =
    posts.error ??
    allocations.error ??
    branches.error ??
    employees.error ??
    schedules.error

  return (
    <>
      <PageHeader
        title="Unyx Allocation"
        description="Postos, PDVs, cobertura, trocas e sangrias."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="w-40"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                void posts.refetch()
                void allocations.refetch()
                void cashMovements.refetch()
              }}
              aria-label="Atualizar alocacao"
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
        {isLoading ? (
          <StateBlock type="loading" title="Carregando alocacao operacional" />
        ) : pageError ? (
          <StateBlock
            type="error"
            title="Erro ao carregar Unyx Allocation"
            description={`${pageError.message}. Rode supabase/onboarding_first_access.sql no SQL Editor se o modulo ainda nao existir.`}
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Postos ativos", value: activePosts.length, Icon: Store, extra: "" },
                { label: "Cobertos", value: coveredPosts.length, Icon: CheckCircle2, extra: "" },
                {
                  label: "Sem cobertura",
                  value: uncoveredPosts.length,
                  Icon: ShieldAlert,
                  extra: uncoveredPosts.length > 0 ? "border-red-200 bg-red-50" : "",
                },
                { label: "Sangrias hoje", value: sangriasToday, Icon: Banknote, extra: "" },
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
                    {overdueAllocations.map((allocation) => {
                      const schedule = allocation.schedule_id
                        ? scheduleById.get(allocation.schedule_id)
                        : scheduleByEmployeeId.get(allocation.employee_id)
                      return (
                        <div
                          key={allocation.id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-orange-200 bg-white p-3"
                        >
                          <div>
                            <div className="font-medium">
                              {allocation.employees?.name ?? "Colaborador"}
                            </div>
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              {allocation.operational_posts?.name ?? "Posto"} · saida prevista{" "}
                              {formatTime(schedule?.end_time)}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={finalize.isPending}
                            onClick={() => setFinalizeAction(allocation)}
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

            <div className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
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
                  {activePosts.length === 0 ? (
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
                        // Coffee break: allocation still active + schedule on_break → post stays with employee
                        const isOnCoffeeBreak = Boolean(
                          allocation && employeeSchedule?.status === "on_break"
                        )
                        // Lunch done: confirmed via notes marker or "returned" status (reliable, not time-based)
                        const breakAlreadyDone =
                          (employeeSchedule?.notes?.includes("lunch_done") ?? false) ||
                          employeeSchedule?.status === "returned"
                        // Coffee done: marked in notes when employee returns from coffee in BreakRoomPage
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
                                <div className={`rounded-lg border p-3 ${isOnCoffeeBreak ? "border-amber-200 bg-white/60" : "bg-white/70"}`}>
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
                                        onClick={() => handleCoffeeBadgeClick(allocation, employeeSchedule, coffeeSlot)}
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
                                      onClick={() => handleBreakClick(allocation, employeeSchedule)}
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

              <div className="space-y-4">
                <Card className="border bg-white shadow-sm">
                  <CardHeader
                    className="cursor-pointer select-none"
                    onClick={() => setHistoryOpen((v) => !v)}
                  >
                    <CardTitle className="flex items-center gap-2">
                      <History className="size-5" />
                      <span className="flex-1">Historico recente</span>
                      <ChevronDown className={`size-4 text-muted-foreground transition-transform duration-200 ${historyOpen ? "rotate-180" : ""}`} />
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
                      <ChevronDown className={`size-4 text-muted-foreground transition-transform duration-200 ${cashMovOpen ? "rotate-180" : ""}`} />
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

            <Card className="border bg-white shadow-sm">
              <CardHeader
                className="cursor-pointer select-none"
                onClick={() => setPostsOpen((v) => !v)}
              >
                <CardTitle className="flex items-center gap-2">
                  <Store className="size-5" />
                  <span className="flex-1">Postos cadastrados</span>
                  <ChevronDown className={`size-4 text-muted-foreground transition-transform duration-200 ${postsOpen ? "rotate-180" : ""}`} />
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
                              togglePost.mutate({
                                postId: post.id,
                                active: !post.active,
                              })
                            }
                            aria-label={
                              post.active ? `Desativar ${post.name}` : `Ativar ${post.name}`
                            }
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
          </>
        )}
      </div>

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
                  setPostForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium">Filial</span>
                <select
                  className={fieldClass}
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
                  className={fieldClass}
                  value={postForm.sector_id}
                  onChange={(event) =>
                    setPostForm((current) => ({
                      ...current,
                      sector_id: event.target.value,
                    }))
                  }
                >
                  <option value="">Sem setor</option>
                  {sectorOptionsForBranch(
                    sectors.data ?? [],
                    postForm.branch_id
                  ).map((sector) => (
                    <option key={sector.id} value={sector.id}>
                      {sector.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium">Tipo</span>
                <select
                  className={fieldClass}
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
                  className={fieldClass}
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
              <Button
                type="submit"
                disabled={createPost.isPending || updatePost.isPending}
              >
                {editingPost ? "Salvar posto" : "Criar posto"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(allocationAction)}
        onOpenChange={(open) => {
          if (!open) setAllocationAction(null)
        }}
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
                className={fieldClass}
                value={allocationForm.employee_id}
                onChange={(event) =>
                  setAllocationForm((current) => ({
                    ...current,
                    employee_id: event.target.value,
                    schedule_id: "",
                  }))
                }
                required
              >
                <option value="">Selecione</option>
                {allocationEmployees.map((employee) => {
                  const empSched = scheduleByEmployeeId.get(employee.id)
                  const breakNote =
                    empSched?.status === "returned"
                      ? " ✓ retornou"
                      : empSched?.status === "on_break"
                        ? " ● intervalo"
                        : ""
                  return (
                    <option key={employee.id} value={employee.id}>
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
                className={fieldClass}
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
                    Este colaborador ja realizou o intervalo hoje. Ao confirmar, a escala volta automaticamente para &quot;trabalhando&quot;.
                  </div>
                )
              }
              if (empSched?.status === "on_break") {
                return (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    Atencao: este colaborador esta em intervalo agora. A escala sera restaurada para &quot;trabalhando&quot; ao confirmar.
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
              <Button type="submit" disabled={allocate.isPending || transfer.isPending}>
                {allocationAction?.type === "transfer"
                  ? "Confirmar troca"
                  : "Confirmar alocacao"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
                className={fieldClass}
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
                  setCashForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
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
              <Button type="submit" variant="destructive" disabled={finalize.isPending}>
                Finalizar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
                Este colaborador nao tem horario de intervalo definido na escala
                de hoje. Deseja iniciar o intervalo agora mesmo?
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

      <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Configurar {SEGMENT_LABELS[segment]}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              Cria os setores e postos operacionais padrao para{" "}
              <strong>{SEGMENT_LABELS[segment]}</strong>. Registros ja existentes
              com o mesmo nome sao ignorados — a operacao e segura para repetir.
            </p>
            <div>
              <p className="mb-1.5 font-medium">Setores ({SEGMENT_DEFAULT_SECTORS[segment].length})</p>
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
