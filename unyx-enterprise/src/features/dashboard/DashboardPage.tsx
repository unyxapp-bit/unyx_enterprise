import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Coffee,
  DoorOpen,
  Edit3,
  Gauge,
  Plus,
  ShieldAlert,
  ShieldCheck,
  StickyNote,
  Store,
  Trash2,
  Users,
  Utensils,
  X,
} from "lucide-react"
import type { FormEvent, ReactNode } from "react"
import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"

import { useAuth } from "@/app/providers/auth-context"
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
import type { DashboardMetricKey } from "@/features/ops/modes/modeUiConfig"
import { modeUiConfig } from "@/features/ops/modes/modeUiConfig"
import {
  getOperationalMode,
} from "@/features/ops/modes/operationalModes"
import { MissingSchedulesPrompt } from "@/features/schedules/components/MissingSchedulesPrompt"
import {
  getPriorityByMode,
  isCashierContext,
  isResponsibleContext,
  sortDashboardRowsByMode,
} from "@/features/ops/modes/priorityRules"
import {
  useAttendanceEvents,
  useChecklistProcedures,
  useChecklistRuns,
  useDashboardRows,
  useCreateOperationalNote,
  useDeleteOperationalNote,
  useOperationalSettings,
  useOperationalNotes,
  useOperationalStatuses,
  useOrganization,
  usePostAllocations,
  useSchedules,
  useUpdateOperationalNote,
} from "@/hooks/useUnyxData"
import { formatDateBR, formatDateTimeBR, minutesLabel } from "@/lib/format"
import { operationalStatuses, statusMeta } from "@/lib/status"
import { localDateKey, operationalMinutesForDate } from "@/features/operational/utils"
import { useAppStore } from "@/store/useAppStore"
import type {
  DashboardRow,
  ChecklistProcedure,
  OperationalNote,
  OperationalStatus,
  OperationalStatusRecord,
  PostAllocation,
  ScheduleWithRelations,
} from "@/types/domain"

const quickNoteTextareaClass =
  "min-h-16 w-full resize-none rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] px-3 py-2 text-sm text-[color:var(--text-primary)] outline-none transition-colors placeholder:text-[color:var(--text-muted)] focus:border-ring focus:ring-3 focus:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-70"

const QUICK_NOTE_CATEGORY = "Lembrete rapido"

const STATUS_COLORS: Record<string, string> = {
  alerta_critico: "#e11d48",
  aguardando_sangria: "#f59e0b",
  troca_de_caixa: "#0f766e",
  deve_sair: "#f97316",
  em_intervalo: "#8b5cf6",
  voltou: "#14b8a6",
  pico: "#dc2626",
  apoio_operacional: "#4f46e5",
  fechamento: "#2563eb",
  trabalhando: "#10b981",
  aguardando_evento: "#94a3b8",
  finalizado: "#64748b",
  folga: "#94a3b8",
}

const METRIC_TONES = {
  blue: {
    card: "border-slate-200 bg-white/90 dark:border-slate-700 dark:bg-slate-900/40",
    icon: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200",
    value: "text-slate-950 dark:text-slate-100",
    label: "text-blue-600 dark:text-blue-300",
    detail: "text-slate-500 dark:text-slate-300/70",
    ring: "ring-blue-200 dark:ring-blue-500/30",
  },
  teal: {
    card: "border-slate-200 bg-white/90 dark:border-slate-700 dark:bg-slate-900/40",
    icon: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-200",
    value: "text-slate-950 dark:text-slate-100",
    label: "text-teal-500 dark:text-teal-300",
    detail: "text-slate-500 dark:text-slate-300/70",
    ring: "ring-teal-200 dark:ring-teal-500/30",
  },
  amber: {
    card: "border-slate-200 bg-white/90 dark:border-slate-700 dark:bg-slate-900/40",
    icon: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
    value: "text-slate-950 dark:text-slate-100",
    label: "text-amber-500 dark:text-amber-300",
    detail: "text-slate-500 dark:text-slate-300/70",
    ring: "ring-amber-200 dark:ring-amber-500/30",
  },
  rose: {
    card: "border-slate-200 bg-white/90 dark:border-slate-700 dark:bg-slate-900/40",
    icon: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200",
    value: "text-slate-950 dark:text-slate-100",
    label: "text-rose-500 dark:text-rose-300",
    detail: "text-slate-500 dark:text-slate-300/70",
    ring: "ring-rose-200 dark:ring-rose-500/30",
  },
  slate: {
    card: "border-slate-200 bg-white/90 dark:border-slate-700 dark:bg-slate-900/40",
    icon: "bg-slate-100 text-slate-600 dark:bg-slate-700/60 dark:text-slate-200",
    value: "text-slate-950 dark:text-slate-100",
    label: "text-slate-500 dark:text-slate-300",
    detail: "text-slate-500/90 dark:text-slate-300/70",
    ring: "ring-slate-200 dark:ring-slate-500/30",
  },
} as const

const ACTIVE_STATUSES: OperationalStatus[] = [
  "trabalhando",
  "voltou",
  "pico",
  "apoio_operacional",
  "fechamento",
]

const ACTIVE_ALLOCATION_STATUSES = new Set<PostAllocation["status"]>([
  "alocado",
  "aguardando_troca",
  "em_troca",
])

const REAL_WORKING_STATUSES = new Set<OperationalStatus>([
  "trabalhando",
  "voltou",
  "aguardando_sangria",
  "troca_de_caixa",
  "deve_sair",
  "pico",
  "apoio_operacional",
  "fechamento",
])

const RISK_STATUSES: OperationalStatus[] = [
  "alerta_critico",
  "deve_sair",
  "em_intervalo",
  "aguardando_sangria",
  "troca_de_caixa",
  "pico",
  "apoio_operacional",
  "fechamento",
]

const NON_OPERATIONAL_SCHEDULE_STATUSES = new Set([
  "day_off",
  "banked_hours",
  "cancelled",
])

const SECONDARY_STATUSES: OperationalStatus[] = [
  "deve_sair",
  "aguardando_sangria",
  "troca_de_caixa",
  "em_intervalo",
  "pico",
  "apoio_operacional",
  "fechamento",
]

function getInitials(name: string): string {
  const parts = (name ?? "").trim().split(" ").filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return (parts[0][0] ?? "?").toUpperCase()
  return ((parts[0][0] ?? "") + (parts[parts.length - 1][0] ?? "")).toUpperCase()
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

function dateStartISO(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number)
  return new Date(year, month - 1, day, 0, 0, 0, 0).toISOString()
}

function checklistDueDateForDate(
  procedure: Pick<ChecklistProcedure, "due_time">,
  dateKey: string
) {
  if (!procedure.due_time) return null
  const [hours, minutes] = procedure.due_time.slice(0, 5).split(":").map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  const [year, month, day] = dateKey.split("-").map(Number)
  return new Date(year, month - 1, day, hours, minutes, 0, 0)
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

function isAbsenceRow(row: Pick<DashboardRow, "current_status" | "status_reason">) {
  return (
    row.current_status === "alerta_critico" &&
    normalize(row.status_reason).includes("falta")
  )
}

function isFinishedRow(row: Pick<DashboardRow, "current_status">) {
  return row.current_status === "finalizado"
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

function getNextAction(row: DashboardRow) {
  if (row.current_status === "alerta_critico") {
    return "Resolver alerta critico"
  }
  if (row.current_status === "aguardando_sangria") {
    return "Confirmar sangria"
  }
  if (row.current_status === "troca_de_caixa") {
    return "Concluir troca"
  }
  if (row.current_status === "deve_sair") {
    return "Confirmar saida ou cobertura"
  }
  if (row.current_status === "em_intervalo") {
    return "Monitorar retorno"
  }
  if (row.current_status === "pico") {
    return "Reforcar cobertura"
  }
  if (row.current_status === "apoio_operacional") {
    return "Reavaliar setor de apoio"
  }
  if (row.current_status === "fechamento") {
    return "Concluir fechamento"
  }
  if (row.current_status === "aguardando_evento") {
    return "Confirmar entrada"
  }
  if (row.delay_minutes > 0) {
    return "Tratar atraso"
  }
  return "Acompanhar"
}

function getPendingGroup(status: OperationalStatus) {
  const groups: Partial<Record<OperationalStatus, string>> = {
    aguardando_sangria: "Sangria",
    em_intervalo: "Intervalo",
    troca_de_caixa: "Troca",
    deve_sair: "Saida",
    pico: "Pico",
    apoio_operacional: "Apoio",
    fechamento: "Fechamento",
  }

  return groups[status] ?? statusMeta[status].label
}

function allocationBelongsToDate(allocation: PostAllocation, date: string) {
  if (allocation.schedules?.work_date) {
    return allocation.schedules.work_date === date
  }

  return allocation.started_at.slice(0, 10) === date
}

function allocationMatchesDashboardFilters(
  allocation: PostAllocation,
  sectorFilter: string,
  searchText: string
) {
  if (
    sectorFilter &&
    allocation.employees?.sectors?.name !== sectorFilter &&
    allocation.operational_posts?.sectors?.name !== sectorFilter
  ) {
    return false
  }

  const query = normalize(searchText)
  if (!query) return true

  return [
    allocation.employees?.name,
    allocation.employees?.role,
    allocation.employees?.sectors?.name,
    allocation.operational_posts?.name,
    allocation.operational_posts?.sectors?.name,
    allocation.operational_posts?.branches?.name,
  ].some((value) => normalize(value).includes(query))
}

function getPostLabel(allocation?: PostAllocation) {
  if (!allocation?.operational_posts) return "Sem posto alocado"
  return allocation.operational_posts.name
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

function getMetricTone(
  key: DashboardMetricKey,
  danger?: boolean
): keyof typeof METRIC_TONES {
  if (danger) return "rose"

  const tones: Partial<Record<DashboardMetricKey, keyof typeof METRIC_TONES>> = {
    scheduled: "blue",
    working: "teal",
    critical: "rose",
    breaks: "amber",
    delay: "amber",
    cashierCoverage: "rose",
    activeSectors: "blue",
    sectorAlerts: "rose",
    present: "teal",
    absences: "rose",
    currentShift: "blue",
    minimumTeam: "amber",
    nextPeak: "amber",
    criticalFunctions: "rose",
    responsiblePresence: "teal",
    serviceCoverage: "teal",
    occurrences: "rose",
  }

  return tones[key] ?? "slate"
}

function buildMetric(key: DashboardMetricKey, data: MetricData) {
  const { rows, schedules, statusSource, occurrencesCount, minimumTeamSize } = data
  const critical = statusSource.filter(
    (row) => row.current_status === "alerta_critico"
  ).length
  const working = statusSource.filter((row) =>
    ACTIVE_STATUSES.includes(row.current_status)
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

function emptyQuickNoteForm() {
  return {
    content: "",
    due_at: localDateKey(),
  }
}

function quickNoteDueAt(dateKey: string | null) {
  if (!dateKey) return null

  const [year, month, day] = dateKey.split("-").map(Number)
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null
  }

  return new Date(year, month - 1, day, 23, 59, 0, 0).toISOString()
}

function buildQuickNoteTitle(content: string) {
  const firstLine = content
    .trim()
    .split(/\r?\n/)
    .find((line) => line.trim())
    ?.trim()

  if (!firstLine) return "Lembrete rapido"
  return firstLine.length > 80 ? `${firstLine.slice(0, 77)}...` : firstLine
}

function isQuickNote(note: OperationalNote) {
  return normalize(note.category) === normalize(QUICK_NOTE_CATEGORY)
}

function isQuickNoteDone(note: OperationalNote) {
  return note.status === "resolved" || note.status === "archived"
}

function isQuickNoteOverdue(note: OperationalNote, nowMs: number) {
  return Boolean(
    note.due_at &&
      !isQuickNoteDone(note) &&
      new Date(note.due_at).getTime() < nowMs
  )
}

function quickNoteScopeLabel(note: OperationalNote) {
  if (note.sectors?.name) return note.sectors.name
  if (note.branches?.name) return note.branches.name
  return "Toda empresa"
}

function DashboardQuickNotesPanel({ nowMs }: { nowMs: number }) {
  const { profile } = useAuth()
  const selectedBranchId = useAppStore((state) => state.selectedBranchId)
  const notes = useOperationalNotes("all")
  const createNote = useCreateOperationalNote()
  const updateNote = useUpdateOperationalNote()
  const deleteNote = useDeleteOperationalNote()
  const [form, setForm] = useState(() => emptyQuickNoteForm())
  const [editing, setEditing] = useState<OperationalNote | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<OperationalNote | null>(null)
  const [viewingNote, setViewingNote] = useState<OperationalNote | null>(null)

  const quickNotes = useMemo(() => {
    return (notes.data ?? [])
      .filter(isQuickNote)
      .sort((a, b) => {
        const aDone = isQuickNoteDone(a)
        const bDone = isQuickNoteDone(b)
        if (aDone !== bDone) return aDone ? 1 : -1

        const aOverdue = isQuickNoteOverdue(a, nowMs)
        const bOverdue = isQuickNoteOverdue(b, nowMs)
        if (aOverdue !== bOverdue) return aOverdue ? -1 : 1

        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
  }, [notes.data, nowMs])

  const visibleQuickNotes = quickNotes.slice(0, 4)
  const openQuickNotes = quickNotes.filter((note) => !isQuickNoteDone(note)).length
  const isSaving = createNote.isPending || updateNote.isPending

  function resetQuickNoteForm() {
    setForm(emptyQuickNoteForm())
    setEditing(null)
  }

  async function handleQuickNoteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const content = form.content.trim()
    if (!content) return

    const title = buildQuickNoteTitle(content)
    const values = {
      title,
      content,
      category: QUICK_NOTE_CATEGORY,
      due_at: quickNoteDueAt(form.due_at),
    }

    if (editing) {
      await updateNote.mutateAsync({
        noteId: editing.id,
        values,
      })
    } else {
      await createNote.mutateAsync({
        ...values,
        branch_id: selectedBranchId ?? profile?.branch_id ?? null,
        sector_id: null,
        priority: "normal",
        status: "open",
      })
    }

    resetQuickNoteForm()
  }

  function startEditingQuickNote(note: OperationalNote) {
    setViewingNote(null)
    setEditing(note)
    setForm({
      content: note.content,
      due_at: note.due_at ? note.due_at.slice(0, 10) : localDateKey(),
    })
  }

  async function toggleQuickNoteDone(note: OperationalNote) {
    const updated = await updateNote.mutateAsync({
      noteId: note.id,
      values: {
        status: isQuickNoteDone(note) ? "open" : "resolved",
      },
    })
    setViewingNote((current) => (current?.id === note.id ? updated : current))
  }

  async function confirmDeleteQuickNote() {
    if (!deleteTarget) return

    const deletedId = deleteTarget.id
    await deleteNote.mutateAsync(deletedId)
    if (editing?.id === deletedId) resetQuickNoteForm()
    if (viewingNote?.id === deletedId) setViewingNote(null)
    setDeleteTarget(null)
  }

  const mutationError = createNote.error || updateNote.error || deleteNote.error
  const currentTimeLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(nowMs)),
    [nowMs]
  )

  return (
    <>
      <Card className="border border-slate-200 bg-white/90 shadow-sm dark:border-slate-700 dark:bg-slate-900/40">
        <CardContent className="p-4">
          <div className="grid gap-4 xl:grid-cols-2">
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <StickyNote className="size-4 text-amber-500 dark:text-amber-300" />
                  Notas rapidas
                </CardTitle>
                <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-slate-700 dark:border-slate-700 dark:bg-slate-950/30 dark:text-slate-100">
                  <Clock className="size-4 text-amber-500 dark:text-amber-300" />
                  <span className="text-lg font-semibold tabular-nums leading-none">
                    {currentTimeLabel}
                  </span>
                </div>
              </div>

              <form className="space-y-3" onSubmit={handleQuickNoteSubmit}>
                <textarea
                  className={quickNoteTextareaClass}
                  placeholder="Nota rapida ou lembrete..."
                  value={form.content}
                  disabled={isSaving}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, content: event.target.value }))
                  }
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    className="h-9 w-full rounded-xl sm:w-40"
                    type="date"
                    value={form.due_at}
                    disabled={isSaving}
                    aria-label="Data do lembrete"
                    onChange={(event) =>
                      setForm((current) => ({ ...current, due_at: event.target.value }))
                    }
                  />
                  <div className="flex flex-1 gap-2 sm:flex-none">
                    <Button
                      type="submit"
                      className="flex-1 sm:flex-none"
                      disabled={isSaving || !form.content.trim()}
                    >
                      {editing ? <Edit3 className="size-4" /> : <Plus className="size-4" />}
                      {isSaving ? "Salvando..." : editing ? "Salvar" : "Adicionar"}
                    </Button>
                    {editing ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label="Cancelar edicao"
                        onClick={resetQuickNoteForm}
                      >
                        <X className="size-4" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              </form>
            </section>

            <section className="space-y-3 border-t border-slate-200 pt-3 dark:border-slate-700 xl:border-t-0 xl:border-l xl:pt-0 xl:pl-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{openQuickNotes} abertas</Badge>
                  {quickNotes.length > visibleQuickNotes.length ? (
                    <span className="text-xs text-slate-500 dark:text-slate-300/70">
                      {visibleQuickNotes.length} de {quickNotes.length}
                    </span>
                  ) : null}
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link to="/app/notes">Ver todas</Link>
                </Button>
              </div>

              {notes.isLoading ? (
                <div className="flex min-h-28 items-center justify-center rounded-2xl border border-dashed border-slate-200 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-300/70">
                  Carregando lembretes
                </div>
              ) : notes.isError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                  {notes.error.message}
                </div>
              ) : visibleQuickNotes.length === 0 ? (
                <div className="flex min-h-28 items-center justify-center rounded-2xl border border-dashed border-slate-200 text-sm font-medium text-slate-500 dark:border-slate-700 dark:text-slate-300/70">
                  Nenhum lembrete rapido
                </div>
              ) : (
                <div className="grid max-h-56 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                  {visibleQuickNotes.map((note) => {
                    const done = isQuickNoteDone(note)
                    const overdue = isQuickNoteOverdue(note, nowMs)
                    const hasLongContent =
                      note.content.length > 90 || note.content.includes("\n")

                    return (
                      <div
                        key={note.id}
                        className={`rounded-2xl border p-2.5 ${
                          overdue
                            ? "border-amber-200 bg-amber-50/80 dark:border-amber-500/30 dark:bg-amber-500/10"
                            : "border-slate-200 bg-white/90 dark:border-slate-700 dark:bg-slate-950/30"
                        } ${done ? "opacity-70" : ""}`}
                      >
                        <div className="flex items-start gap-2.5">
                          <button
                            type="button"
                            className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border transition ${
                              done
                                ? "border-emerald-500 bg-emerald-500 text-white"
                                : "border-slate-300 text-slate-400 hover:border-emerald-500 hover:text-emerald-600 dark:border-slate-600"
                            }`}
                            aria-label={done ? "Reabrir lembrete" : "Concluir lembrete"}
                            onClick={() => void toggleQuickNoteDone(note)}
                            disabled={updateNote.isPending}
                          >
                            <CheckCircle2 className="size-4" />
                          </button>
                          <div className="min-w-0 flex-1">
                            <button
                              type="button"
                              className={`block w-full max-h-16 overflow-hidden whitespace-pre-wrap text-left text-sm leading-5 text-slate-800 outline-none transition hover:text-slate-950 focus-visible:rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 dark:text-slate-100 dark:hover:text-white ${done ? "line-through" : ""}`}
                              onClick={() => setViewingNote(note)}
                            >
                              {note.content}
                            </button>
                            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-300/70">
                              <span>{quickNoteScopeLabel(note)}</span>
                              {note.due_at ? (
	                                <Badge variant={overdue ? "secondary" : "outline"}>
	                                  {formatDateBR(note.due_at)}
	                                </Badge>
                              ) : (
                                <span>{formatDateTimeBR(note.created_at)}</span>
                              )}
                              {hasLongContent ? <span>Abrir</span> : null}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Editar lembrete"
                              onClick={() => startEditingQuickNote(note)}
                            >
                              <Edit3 className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon-sm"
                              aria-label="Excluir lembrete"
                              onClick={() => setDeleteTarget(note)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {mutationError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                  {mutationError.message}
                </div>
              ) : null}
            </section>
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => {
        if (!open) setDeleteTarget(null)
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir lembrete</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Deseja excluir este lembrete?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={deleteNote.isPending}
              onClick={() => void confirmDeleteQuickNote()}
            >
              {deleteNote.isPending ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(viewingNote)} onOpenChange={(open) => {
        if (!open) setViewingNote(null)
      }}>
        <DialogContent className="top-0 right-0 left-auto h-dvh max-h-dvh w-full max-w-md translate-x-0 translate-y-0 overflow-y-auto rounded-none rounded-l-[1.5rem] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Lembrete</DialogTitle>
          </DialogHeader>
          {viewingNote ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-300/70">
                <Badge variant={isQuickNoteDone(viewingNote) ? "default" : "outline"}>
                  {isQuickNoteDone(viewingNote) ? "Concluido" : "Aberto"}
                </Badge>
                <span>{quickNoteScopeLabel(viewingNote)}</span>
                <span>{formatDateTimeBR(viewingNote.created_at)}</span>
                {viewingNote.due_at ? (
	                  <Badge
	                    variant={isQuickNoteOverdue(viewingNote, nowMs) ? "secondary" : "outline"}
	                  >
	                    {formatDateBR(viewingNote.due_at)}
	                  </Badge>
                ) : null}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-sm leading-6 text-slate-800 dark:border-slate-700 dark:bg-slate-950/30 dark:text-slate-100">
                <p className="whitespace-pre-wrap">{viewingNote.content}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void toggleQuickNoteDone(viewingNote)}
                  disabled={updateNote.isPending}
                >
                  <CheckCircle2 className="size-4" />
                  {isQuickNoteDone(viewingNote) ? "Reabrir" : "Concluir"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => startEditingQuickNote(viewingNote)}
                >
                  <Edit3 className="size-4" />
                  Editar
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    setDeleteTarget(viewingNote)
                    setViewingNote(null)
                  }}
                >
                  <Trash2 className="size-4" />
                  Excluir
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
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
  const [statusFilter, setStatusFilter] = useState("")
  const [showAllPrimary, setShowAllPrimary] = useState(false)
  const [showAllSecondary, setShowAllSecondary] = useState(false)
  const [currentTimeMs, setCurrentTimeMs] = useState(() => Date.now())
  const date = localDateKey(new Date(currentTimeMs))
  const searchText = ""
  const sectorFilter = ""
  const dashboard = useDashboardRows(date)
  const schedules = useSchedules(date)
  const statuses = useOperationalStatuses()
  const organization = useOrganization()
  const operationalSettings = useOperationalSettings()
  const attendanceEvents = useAttendanceEvents()
  const postAllocations = usePostAllocations()
  const checklistProcedures = useChecklistProcedures()
  const checklistRuns = useChecklistRuns(dateStartISO(date))

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setCurrentTimeMs(Date.now())
    }, 60_000)

    return () => window.clearInterval(timerId)
  }, [])

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
  const activePostAllocations = useMemo(() => {
    return (postAllocations.data ?? []).filter(
      (allocation) =>
        !allocation.ended_at &&
        ACTIVE_ALLOCATION_STATUSES.has(allocation.status) &&
        allocationBelongsToDate(allocation, date)
    )
  }, [date, postAllocations.data])

  const statusByScheduleId = useMemo(() => {
    const map = new Map<string, OperationalStatusRecord>()
    for (const status of liveStatuses) {
      if (status.schedule_id && status.schedules?.work_date === date) {
        map.set(status.schedule_id, status)
      }
    }
    return map
  }, [date, liveStatuses])

  const statusByEmployeeId = useMemo(() => {
    const map = new Map<string, OperationalStatusRecord>()
    for (const status of liveStatuses) {
      if (status.schedules?.work_date && status.schedules.work_date !== date) {
        continue
      }
      map.set(status.employee_id, status)
    }
    return map
  }, [date, liveStatuses])

  const realWorkingPostAllocations = useMemo(() => {
    return activePostAllocations.filter((allocation) => {
      const status =
        (allocation.schedule_id
          ? statusByScheduleId.get(allocation.schedule_id)
          : undefined) ?? statusByEmployeeId.get(allocation.employee_id)

      return status && REAL_WORKING_STATUSES.has(status.current_status)
    })
  }, [activePostAllocations, statusByEmployeeId, statusByScheduleId])

  const allocationByEmployeeId = useMemo(() => {
    return new Map(
      activePostAllocations.map((allocation) => [
        allocation.employee_id,
        allocation,
      ])
    )
  }, [activePostAllocations])

  const filteredRows = useMemo(() => {
    let list = sectorFilter
      ? rows.filter((r) => r.sector_name === sectorFilter)
      : rows

    list = list.filter((row) => rowMatchesSearch(row, searchText))
    list = list.filter((row) => rowMatchesStatusFilter(row, statusFilter))

    return sortDashboardRowsByMode(mode, list)
  }, [mode, rows, searchText, sectorFilter, statusFilter])
  const postAllocationsInScope = useMemo(() => {
    return realWorkingPostAllocations.filter((allocation) =>
      allocationMatchesDashboardFilters(allocation, sectorFilter, searchText)
    )
  }, [realWorkingPostAllocations, searchText, sectorFilter])

  const filteredSchedules = useMemo(() => {
    return scheduledToday.filter((schedule) => {
      if (NON_OPERATIONAL_SCHEDULE_STATUSES.has(schedule.status)) {
        return false
      }

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

  const checklistSummary = useMemo(() => {
    const checklistRows = (checklistProcedures.data ?? []).filter(
      (procedure) => procedure.checklist_items.length > 0
    )
    const checklistIds = new Set(checklistRows.map((procedure) => procedure.id))
    const runsForDate = (checklistRuns.data ?? []).filter(
      (run) =>
        checklistIds.has(run.procedure_id) &&
        (run.completed_at ?? run.created_at).slice(0, 10) === date
    )
    const completedProcedureIds = new Set(runsForDate.map((run) => run.procedure_id))
    const dailyProcedures = checklistRows.filter(
      (procedure) => procedure.frequency === "daily"
    )
    const pendingProcedures = dailyProcedures.filter(
      (procedure) => !completedProcedureIds.has(procedure.id)
    )
    const today = localDateKey()
    const overdue = pendingProcedures.filter((procedure) => {
      const dueAt = checklistDueDateForDate(procedure, date)
      if (!dueAt) return false
      return date < today || (date === today && dueAt.getTime() < currentTimeMs)
    }).length
    const approvals = (checklistRuns.data ?? []).filter(
      (run) =>
        checklistIds.has(run.procedure_id) && run.approval_status === "pending"
    ).length

    return {
      approvals,
      completed: runsForDate.length,
      overdue,
      pending: pendingProcedures.length,
    }
  }, [checklistProcedures.data, checklistRuns.data, currentTimeMs, date])

  const toMin = (t: string | null) => {
    if (!t) return null
    const [h, m] = t.split(":").map(Number)
    return h * 60 + m
  }

  const liveRows = useMemo(() => {
    const today = localDateKey()
    if (date !== today) {
      return filteredRows.filter(
        (row) => !["folga", "finalizado"].includes(row.current_status)
      )
    }

    const nowMin = operationalMinutesForDate(date)
    return filteredRows.filter((row) => {
      if (["folga", "finalizado"].includes(row.current_status)) return false
      const startMin = toMin(row.start_time)
      const endMin = toMin(row.end_time)
      if (startMin !== null && nowMin < startMin) return false
      if (endMin !== null && nowMin > endMin) return false
      return true
    })
  }, [date, filteredRows])

  const allocatedWorkingCount = new Set(
    postAllocationsInScope.map((allocation) => allocation.employee_id)
  ).size

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
  const pendingGroupStats = SECONDARY_STATUSES.map((status) => ({
    status,
    label: getPendingGroup(status),
    total: secondaryRows.filter((row) => row.current_status === status).length,
  })).filter((item) => item.total > 0)

  const visiblePrimaryRows = showAllPrimary ? primaryRows : primaryRows.slice(0, 5)
  const visibleSecondaryRows = showAllSecondary
    ? secondaryRows
    : secondaryRows.slice(0, 5)

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

  const workingCount = allocatedWorkingCount
  const scheduledCount = filteredSchedules.length || filteredRows.length
  const finishedCount = filteredRows.filter(isFinishedRow).length
  const activeScheduleRows = liveRows.filter(
    (row) =>
      !isFinishedRow(row) &&
      !isAbsenceRow(row) &&
      row.current_status !== "folga"
  )
  const activeScheduleCount = Math.max(activeScheduleRows.length, workingCount)
  const pendingCount = activeScheduleRows.filter(
    (row) =>
      row.current_status !== "em_intervalo" &&
      !allocationByEmployeeId.has(row.employee_id)
  ).length
  const criticalCount = statusSource.filter(
    (row) => row.current_status === "alerta_critico"
  ).length
  const presencePct =
    activeScheduleCount > 0
      ? Math.min(100, Math.round((workingCount / activeScheduleCount) * 100))
      : finishedCount > 0
        ? 100
        : 0

  const refetchDashboardScreen = () => {
    void dashboard.refetch()
    void schedules.refetch()
    void statuses.refetch()
    void attendanceEvents.refetch()
    void postAllocations.refetch()
  }

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
      />

      <div className="space-y-5 p-6">
        <MissingSchedulesPrompt
          date={date}
          currentScheduleCount={scheduledToday.length}
          isLoading={schedules.isLoading}
          onCopied={() => {
            refetchDashboardScreen()
          }}
        />

        <DashboardQuickNotesPanel nowMs={currentTimeMs} />

        {/* Row 1: Hero gauge + status breakdown */}
        <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">

          {/* Hero: half-donut gauge + KPI sub-cards */}
          <Card className="border border-slate-200 bg-white/90 shadow-sm dark:border-slate-700 dark:bg-slate-900/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Equipe hoje</CardTitle>
            </CardHeader>
            <CardContent>
              {dashboard.isLoading ? (
                <StateBlock type="loading" title="Carregando" />
              ) : (
                <div className="grid gap-5 xl:grid-cols-[minmax(20rem,1.25fr)_minmax(16rem,0.75fr)] xl:items-start">
                  <div className="space-y-4">
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          Cobertura do turno
                        </p>
                        <p className="mt-1 text-5xl font-bold tracking-tight tabular-nums text-slate-950 dark:text-slate-100">
                          {presencePct}%
                        </p>
                      </div>
                      <div className="text-right text-xs text-slate-500 dark:text-slate-400">
                        <p className="font-medium text-slate-900 dark:text-slate-100">
                          {workingCount} ativos
                        </p>
                        <p>de {activeScheduleCount} em turno</p>
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-full bg-slate-100 shadow-inner dark:bg-slate-800">
                      <div className="flex h-4 w-full">
                        <div
                          className="h-full bg-teal-500 transition-all"
                          style={{ width: `${presencePct}%` }}
                        />
                        <div
                          className="h-full bg-slate-300 transition-all dark:bg-slate-600"
                          style={{ width: `${Math.max(0, 100 - presencePct)}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-slate-200 bg-white/90 p-3 dark:border-slate-700 dark:bg-slate-950/30">
                        <p className="text-[11px] font-medium text-blue-600 dark:text-blue-300">
                          Escalados
                        </p>
                        <p className="mt-1 text-2xl font-bold tabular-nums text-slate-950 dark:text-slate-100">
                          {scheduledCount}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white/90 p-3 dark:border-slate-700 dark:bg-slate-950/30">
                        <p className="text-[11px] font-medium text-teal-600 dark:text-teal-300">
                          Ativos
                        </p>
                        <p className="mt-1 text-2xl font-bold tabular-nums text-slate-950 dark:text-slate-100">
                          {workingCount}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white/90 p-3 dark:border-slate-700 dark:bg-slate-950/30">
                        <p className="text-[11px] font-medium text-amber-600 dark:text-amber-300">
                          Pendentes
                        </p>
                        <p className="mt-1 text-2xl font-bold tabular-nums text-slate-950 dark:text-slate-100">
                          {pendingCount}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white/90 p-3 dark:border-slate-700 dark:bg-slate-950/30">
                        <p className="text-[11px] font-medium text-rose-600 dark:text-rose-300">
                          Críticos
                        </p>
                        <p className="mt-1 text-2xl font-bold tabular-nums text-slate-950 dark:text-slate-100">
                          {criticalCount}
                        </p>
                      </div>
                    </div>

                    <Link
                      to="/app/checklists"
                      className="block rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-sm transition hover:border-indigo-200 hover:shadow-md dark:border-slate-700 dark:bg-slate-950/30"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-100">
                          <ClipboardCheck className="size-4 text-indigo-500" />
                          Rotinas de checklist
                        </div>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          ver detalhes
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div>
                          <p className="text-[11px] text-emerald-600 dark:text-emerald-300">
                            Feitos
                          </p>
                          <p className="mt-0.5 text-lg font-bold tabular-nums text-slate-950 dark:text-slate-100">
                            {checklistSummary.completed}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-amber-600 dark:text-amber-300">
                            Pend.
                          </p>
                          <p className="mt-0.5 text-lg font-bold tabular-nums text-slate-950 dark:text-slate-100">
                            {checklistSummary.pending}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-rose-600 dark:text-rose-300">
                            Atras.
                          </p>
                          <p className="mt-0.5 text-lg font-bold tabular-nums text-slate-950 dark:text-slate-100">
                            {checklistSummary.overdue}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-indigo-600 dark:text-indigo-300">
                            Aprov.
                          </p>
                          <p className="mt-0.5 text-lg font-bold tabular-nums text-slate-950 dark:text-slate-100">
                            {checklistSummary.approvals}
                          </p>
                        </div>
                      </div>
                    </Link>

                    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-950/30 dark:text-slate-300/70">
                      <span className="flex flex-wrap gap-x-3 gap-y-1">
                        <span>{pendingCount} em turno ainda nao alocados</span>
                        {finishedCount > 0 ? (
                          <span>{finishedCount} ja sairam</span>
                        ) : null}
                      </span>
                      {lastUpdated ? <span>atualizado as {lastUpdated}</span> : null}
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {modeConfig.dashboardCards.map((key) => {
                      const metric = buildMetric(key, {
                        rows: filteredRows,
                        schedules: filteredSchedules,
                        statusSource,
                        occurrencesCount,
                        minimumTeamSize: modeConfig.minimumTeamSize,
                      })
                      const tone = METRIC_TONES[getMetricTone(key, metric.danger)]
                      const metricFilter = getMetricStatusFilter(key)
                      const isMetricFilterActive =
                        metricFilter.length > 0 && statusFilter === metricFilter
                      return (
                        <button
                          key={key}
                          type="button"
                          className={`flex min-h-24 flex-col justify-between rounded-2xl border border-slate-200 bg-white/90 p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 dark:bg-slate-950/30 ${isMetricFilterActive ? `ring-2 ${tone.ring}` : ""}`}
                          onClick={() => {
                            if (!metricFilter) return
                            setStatusFilter((current) =>
                              current === metricFilter ? "" : metricFilter
                            )
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-[11px] font-medium leading-tight ${tone.label}`}>
                              {metric.title}
                            </p>
                            <div className={`shrink-0 rounded-xl p-1.5 ${tone.icon}`}>
                              <div className="[&_svg]:size-3.5">{getMetricIcon(key)}</div>
                            </div>
                          </div>
                          <div>
                            <p className={`text-2xl font-bold tracking-tight tabular-nums ${tone.value}`}>
                              {metric.value}
                            </p>
                            <p className={`mt-0.5 text-[10px] leading-tight ${tone.detail}`}>
                              {metric.detail}
                            </p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Status breakdown with progress bars */}
          <Card className="border border-slate-200 bg-white/90 shadow-sm dark:border-slate-700 dark:bg-slate-900/40">
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
                        <p className="text-3xl font-bold tracking-tight tabular-nums text-teal-950 dark:text-teal-100">
                          {statusSource.length}
                        </p>
                        <p className="text-xs text-teal-600 dark:text-teal-300">
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

                    <div className="flex h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
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
                      <div key={entry.status} className="rounded-2xl border border-slate-200 bg-white/90 p-2.5 dark:border-slate-700 dark:bg-slate-950/30">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="size-2 shrink-0 rounded-full"
                              style={{ backgroundColor: STATUS_COLORS[entry.status] ?? "#94a3b8" }}
                            />
                            <span className="text-xs text-slate-600 dark:text-slate-300">{entry.label}</span>
                          </div>
                          <span className="text-xs font-semibold tabular-nums text-slate-900 dark:text-slate-100">
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

        {shouldShowCoverageRisk ? (
          <div className="flex items-start gap-3 rounded-[1.25rem] border border-slate-200 bg-white/90 p-4 dark:border-slate-700 dark:bg-slate-900/40">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-300" />
            <div className="text-sm text-slate-700 dark:text-slate-200">
              <span className="font-medium">Risco de cobertura:</span>{" "}
              {coverageRisk} de {coverageTotal} colaboradores ({coverageRiskPct}%)
              estao em situacao que pode impactar a operacao.
            </div>
          </div>
        ) : null}

        {/* Row 3: High priority + secondary */}
        <div className="grid gap-4 xl:grid-cols-2">
          <Card className="border border-slate-200 bg-white/90 shadow-sm dark:border-slate-700 dark:bg-slate-900/40">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="size-4 text-rose-500" />
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
                    const allocation = allocationByEmployeeId.get(row.employee_id)
                    const priority = getPriority(row, mode)
                    return (
                      <div key={row.id} className="rounded-2xl border border-slate-200 bg-white/90 p-3 dark:border-slate-700 dark:bg-slate-950/30">
                        <div className="flex items-center gap-3">
                        <div className="w-1 self-stretch shrink-0 rounded-full bg-rose-400" />
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-rose-100 text-xs font-bold text-rose-700 dark:bg-rose-500/15 dark:text-rose-200">
                          {initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-950 dark:text-slate-100">{row.employee_name}</p>
                          <p className="truncate text-xs text-rose-600 dark:text-rose-300">
                            {row.status_reason ?? "Prioridade operacional alta"}
                          </p>
                          <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-300/70">
                            {[row.sector_name, row.branch_name].filter(Boolean).join(" - ")}
                          </p>
                        </div>
                        <StatusBadge status={row.current_status} />
                        </div>
                        <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
                          <div className="rounded-2xl bg-slate-50/70 px-2.5 py-2 dark:bg-slate-950/30">
                            <p className="text-slate-500">Acao</p>
                            <p className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">
                              {getNextAction(row)}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-slate-50/70 px-2.5 py-2 dark:bg-slate-950/30">
                            <p className="text-slate-500">Prioridade</p>
                            <p className="mt-0.5 font-medium tabular-nums text-slate-900 dark:text-slate-100">
                              {priority}
                              {row.delay_minutes > 0
                                ? ` - ${minutesLabel(row.delay_minutes)}`
                                : ""}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-slate-50/70 px-2.5 py-2 dark:bg-slate-950/30">
                            <p className="text-slate-500">Posto</p>
                            <p className="mt-0.5 truncate font-medium text-slate-900 dark:text-slate-100">
                              {getPostLabel(allocation)}
                            </p>
                          </div>
                        </div>
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
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link to="/app/allocation">Abrir mapa de postos</Link>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border border-slate-200 bg-white/90 shadow-sm dark:border-slate-700 dark:bg-slate-900/40">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <DoorOpen className="size-4 text-amber-500 dark:text-amber-300" />
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
                  {pendingGroupStats.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {pendingGroupStats.map((item) => (
                        <div key={item.status} className="rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 dark:border-slate-700 dark:bg-slate-950/30">
                          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-300">
                            {item.label}
                          </p>
                          <p className="mt-0.5 text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
                            {item.total}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {visibleSecondaryRows.map((row) => {
                  const initials = getInitials(row.employee_name)
                  const allocation = allocationByEmployeeId.get(row.employee_id)
                  return (
                    <div key={row.id} className="rounded-2xl border border-slate-200 bg-white/90 p-3 dark:border-slate-700 dark:bg-slate-950/30">
                      <div className="flex items-center gap-3">
                      <div className="w-1 self-stretch shrink-0 rounded-full bg-amber-400" />
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-200">
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-950 dark:text-slate-100">{row.employee_name}</p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-300/70">
                          {row.sector_name ?? "Sem setor"} - {row.branch_name}
                        </p>
                      </div>
                      <StatusBadge status={row.current_status} />
                      </div>
                      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
                        <div className="rounded-2xl bg-slate-50/70 px-2.5 py-2 dark:bg-slate-950/30">
                          <p className="text-slate-500">Tipo</p>
                          <p className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">
                            {getPendingGroup(row.current_status)}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-slate-50/70 px-2.5 py-2 dark:bg-slate-950/30">
                          <p className="text-slate-500">Proxima acao</p>
                          <p className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">
                            {getNextAction(row)}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-slate-50/70 px-2.5 py-2 dark:bg-slate-950/30">
                          <p className="text-slate-500">Posto</p>
                          <p className="mt-0.5 truncate font-medium text-slate-900 dark:text-slate-100">
                            {getPostLabel(allocation)}
                          </p>
                        </div>
                      </div>
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
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link to="/app/allocation">Abrir mapa de postos</Link>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Row 4: Branch summary (multi-branch only) */}
        {(() => {
          const branchMap = new Map<string, { name: string; working: number; critical: number; total: number }>()
          for (const row of rows) {
            const key = row.branch_id ?? row.branch_name ?? "–"
            if (!branchMap.has(key)) {
              branchMap.set(key, { name: row.branch_name ?? key, working: 0, critical: 0, total: 0 })
            }
            const entry = branchMap.get(key)!
            entry.total++
            if (row.current_status === "alerta_critico") entry.critical++
          }
          for (const allocation of realWorkingPostAllocations) {
            const key =
              allocation.branch_id ??
              allocation.operational_posts?.branch_id ??
              allocation.operational_posts?.branches?.name ??
              "â€“"
            if (!branchMap.has(key)) {
              branchMap.set(key, {
                name: allocation.operational_posts?.branches?.name ?? key,
                working: 0,
                critical: 0,
                total: 0,
              })
            }
            branchMap.get(key)!.working++
          }
          if (branchMap.size <= 1) return null
          return (
            <Card className="border border-slate-200 bg-white/90 shadow-sm dark:border-slate-700 dark:bg-slate-900/40">
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
                      className={`rounded-2xl border p-3 ${
                        branch.critical > 0
                          ? "border-rose-200 bg-rose-50/50 dark:border-rose-900/40 dark:bg-rose-950/20"
                          : "border-slate-200 bg-slate-50/60 dark:border-slate-700 dark:bg-slate-950/30"
                      }`}
                    >
                      <p className="font-semibold text-[color:var(--text-primary)]">{branch.name}</p>
                      <div className="mt-1.5 flex gap-3 text-sm text-[color:var(--text-muted)]">
                        <span>{branch.working} alocados trab.</span>
                        <span>{branch.total} total</span>
                        {branch.critical > 0 ? (
                          <span className="font-medium text-rose-600 dark:text-rose-300">
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
