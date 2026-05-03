import { useMemo, useState } from "react"
import type { FormEvent } from "react"
import {
  CalendarCog,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Pencil,
  Trash2,
} from "lucide-react"

import { PageHeader } from "@/components/shared/PageHeader"
import { StateBlock } from "@/components/shared/StateBlock"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  useBranches,
  useCopySchedules,
  useCreateSchedule,
  useDeleteSchedule,
  useDeleteSchedulesBulk,
  useEmployees,
  useImportSchedules,
  useSchedules,
  useSchedulesRange,
  useUpdateSchedule,
} from "@/hooks/useUnyxData"
import { buildCsv, downloadCsv } from "@/lib/exportCsv"
import { formatDateBR, formatTime, todayISO } from "@/lib/format"
import { scheduleStatusLabel } from "@/lib/status"
import { cn } from "@/lib/utils"
import {
  cellToDate,
  cellToText,
  cellToTime,
  getCell,
  normalizeColumn,
  parseSpreadsheet,
} from "@/lib/spreadsheet"
import { useAppStore } from "@/store/useAppStore"
import type { ScheduleImportInput } from "@/services/unyxApi"
import type {
  Branch,
  EmployeeWithRelations,
  ScheduleStatus,
  ScheduleWithRelations,
} from "@/types/domain"

const fieldClass =
  "h-8 w-full rounded-lg border bg-white px-2.5 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"

const filterClass =
  "h-8 rounded-lg border bg-white px-2.5 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"

interface ScheduleFormState {
  branch_id: string
  employee_id: string
  work_date: string
  start_time: string
  break_start: string
  break_end: string
  end_time: string
  status: ScheduleStatus
  notes: string
}

function normalizeLookup(value: string) {
  return normalizeColumn(value).replace(/_/g, " ")
}

function scheduleStatusFromText(value: string): ScheduleStatus {
  const normalized = normalizeLookup(value)

  if (normalized.includes("folga")) return "day_off"
  if (normalized.includes("feriado")) return "day_off"
  if (normalized.includes("falta")) return "absent"
  if (normalized.includes("cancel")) return "cancelled"
  if (normalized.includes("final")) return "finished"
  if (normalized.includes("interval")) return "on_break"
  if (normalized.includes("retorn")) return "returned"
  if (normalized.includes("trabalh")) return "working"

  return "scheduled"
}

function isScheduleIncomplete(schedule: ScheduleWithRelations) {
  if (schedule.status === "day_off" || schedule.status === "cancelled") return false
  if (!schedule.start_time || !schedule.end_time) return true
  return Boolean(
    (schedule.break_start && !schedule.break_end) ||
      (!schedule.break_start && schedule.break_end)
  )
}

function nextFormForStatus<
  T extends {
    status: ScheduleStatus
    start_time: string
    break_start: string
    break_end: string
    end_time: string
  },
>(
  current: T,
  status: ScheduleStatus
) {
  if (status !== "day_off") return { ...current, status }

  return {
    ...current,
    status,
    start_time: "",
    break_start: "",
    break_end: "",
    end_time: "",
  }
}

function ScheduleEditDialog({ schedule }: { schedule: ScheduleWithRelations }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    start_time: schedule.start_time ?? "",
    break_start: schedule.break_start ?? "",
    break_end: schedule.break_end ?? "",
    end_time: schedule.end_time ?? "",
    status: schedule.status,
    notes: schedule.notes ?? "",
  })
  const updateSchedule = useUpdateSchedule()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await updateSchedule.mutateAsync({
      scheduleId: schedule.id,
      values: {
        start_time: form.start_time || null,
        break_start: form.break_start || null,
        break_end: form.break_end || null,
        end_time: form.end_time || null,
        status: form.status,
        notes: form.notes.trim() || null,
      },
    })
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="size-4" />
          Editar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Editar escala — {schedule.employees?.name ?? "Colaborador"}
          </DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-3 sm:grid-cols-4">
            {(["start_time", "break_start", "break_end", "end_time"] as const).map(
              (field) => (
                <label className="space-y-1 text-sm" key={field}>
                  <span className="font-medium">
                    {{ start_time: "Entrada", break_start: "Intervalo", break_end: "Retorno", end_time: "Saída" }[field]}
                  </span>
                  <Input
                    type="time"
                    value={form[field]}
                    onChange={(e) =>
                      setForm((c) => ({ ...c, [field]: e.target.value }))
                    }
                  />
                </label>
              )
            )}
          </div>

          <label className="space-y-1 text-sm">
            <span className="font-medium">Status</span>
            <select
              className={fieldClass}
              value={form.status}
              onChange={(e) =>
                setForm((current) =>
                  nextFormForStatus(current, e.target.value as ScheduleStatus)
                )
              }
            >
              {Object.entries(scheduleStatusLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium">Observações</span>
            <Input
              value={form.notes}
              onChange={(e) => setForm((c) => ({ ...c, notes: e.target.value }))}
            />
          </label>

          {updateSchedule.error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {updateSchedule.error.message}
            </div>
          ) : null}

          <DialogFooter>
            <Button type="submit" disabled={updateSchedule.isPending}>
              {updateSchedule.isPending ? "Salvando..." : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ScheduleDeleteDialog({ schedule }: { schedule: ScheduleWithRelations }) {
  const [open, setOpen] = useState(false)
  const deleteSchedule = useDeleteSchedule()

  async function handleConfirm() {
    await deleteSchedule.mutateAsync(schedule.id)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Trash2 className="size-4" />
          Remover
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remover escala</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Deseja remover a escala de{" "}
          <span className="font-medium text-slate-950">
            {schedule.employees?.name ?? "Colaborador"}
          </span>{" "}
          do dia {formatDateBR(schedule.work_date)}? Esta ação não pode ser desfeita.
        </p>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={deleteSchedule.isPending}
            onClick={() => void handleConfirm()}
          >
            {deleteSchedule.isPending ? "Removendo..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CopyDayDialog({
  branches,
  currentDate,
  selectedBranchId,
}: {
  branches: Branch[]
  currentDate: string
  selectedBranchId: string | null
}) {
  const [open, setOpen] = useState(false)
  const [sourceDate, setSourceDate] = useState("")
  const [branchId, setBranchId] = useState(selectedBranchId ?? "")
  const copySchedules = useCopySchedules()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!sourceDate) return

    await copySchedules.mutateAsync({
      sourceDate,
      targetDate: currentDate,
      branchId: branchId || null,
    })
    setOpen(false)
    setSourceDate("")
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <CalendarCog className="size-4" />
          Copiar dia
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Copiar escalas de outro dia</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <p className="text-sm text-muted-foreground">
            Selecione a data de origem. Todas as escalas desse dia serão copiadas
            para <span className="font-medium text-slate-950">{formatDateBR(currentDate)}</span>.
          </p>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Escopo</span>
            <select
              className={fieldClass}
              value={branchId}
              onChange={(event) => setBranchId(event.target.value)}
            >
              <option value="">Todas as filiais</option>
              {branches
                .filter((branch) => branch.active)
                .map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Data de origem</span>
            <Input
              type="date"
              value={sourceDate}
              onChange={(e) => setSourceDate(e.target.value)}
            />
          </label>
          {copySchedules.error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {copySchedules.error.message}
            </div>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={copySchedules.isPending || !sourceDate}>
              {copySchedules.isPending ? "Copiando..." : "Copiar escalas"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function SchedulesImportDialog({
  branches,
  currentDate,
  employees,
  selectedBranchId,
}: {
  branches: Branch[]
  currentDate: string
  employees: EmployeeWithRelations[]
  selectedBranchId: string | null
}) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<ScheduleImportInput[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [fileName, setFileName] = useState("")
  const [dateRange, setDateRange] = useState<{ min: string; max: string } | null>(null)
  const importSchedules = useImportSchedules()

  const activeBranches = useMemo(
    () => branches.filter((branch) => branch.active),
    [branches]
  )

  async function handleFile(file: File | null) {
    setRows([])
    setErrors([])
    setFileName(file?.name ?? "")
    setDateRange(null)

    if (!file) return

    try {
      const parsed = await parseSpreadsheet(file)
      const branchByName = new Map(
        activeBranches.map((branch) => [normalizeLookup(branch.name), branch.id])
      )
      const employeeByDocument = new Map(
        employees
          .filter((employee) => employee.active && employee.document)
          .map((employee) => [
            `${employee.branch_id}:${cellToText(employee.document).replace(/\D/g, "")}`,
            employee.id,
          ])
      )
      const activeEmployees = employees.filter((e) => e.active)
      const employeeByBranchAndName = new Map(
        activeEmployees.map((employee) => [
          `${employee.branch_id}:${normalizeLookup(employee.name)}`,
          employee.id,
        ])
      )
      // fallback: match by first word(s) of name — handles truncated names in DB
      function findEmployeeByPartialName(branchId: string, schedName: string) {
        const norm = normalizeLookup(schedName)
        for (const emp of activeEmployees) {
          if (emp.branch_id !== branchId) continue
          const empNorm = normalizeLookup(emp.name)
          if (empNorm.startsWith(norm) || norm.startsWith(empNorm)) return emp.id
        }
        return ""
      }

      const fallbackBranchId =
        selectedBranchId && activeBranches.some((branch) => branch.id === selectedBranchId)
          ? selectedBranchId
          : activeBranches[0]?.id ?? ""
      const nextRows: ScheduleImportInput[] = []
      const nextErrors: string[] = []

      parsed.forEach((row, index) => {
        const branchName = cellToText(getCell(row, ["filial", "loja", "unidade"]))
        const branchId = branchName
          ? branchByName.get(normalizeLookup(branchName)) ?? ""
          : fallbackBranchId
        const document = cellToText(getCell(row, ["documento", "cpf", "cpf_documento"])).replace(/\D/g, "")
        const employeeName = cellToText(
          getCell(row, ["colaborador", "funcionario", "nome"])
        )
        const employeeId = document
          ? employeeByDocument.get(`${branchId}:${document}`) ?? ""
          : (employeeByBranchAndName.get(`${branchId}:${normalizeLookup(employeeName)}`) ||
             findEmployeeByPartialName(branchId, employeeName))
        const status = scheduleStatusFromText(
          cellToText(getCell(row, ["status", "situacao"])) || "scheduled"
        )

        if (!branchId) {
          nextErrors.push(`Linha ${index + 2}: filial nao encontrada.`)
          return
        }

        if (!employeeId) {
          nextErrors.push(`Linha ${index + 2}: colaborador "${employeeName}" nao encontrado na filial.`)
          return
        }

        const work_date = cellToDate(getCell(row, ["data", "dia"]), currentDate)
        const diffDays = Math.abs(
          (new Date(work_date + "T12:00:00").getTime() -
            new Date(currentDate + "T12:00:00").getTime()) /
          (1000 * 60 * 60 * 24)
        )
        if (diffDays > 90) {
          nextErrors.push(
            `Linha ${index + 2}: data ${formatDateBR(work_date)} parece incorreta (muito distante de hoje). Verifique se a planilha usa o formato DD/MM/AAAA.`
          )
          return
        }

        nextRows.push({
          branch_id: branchId,
          employee_id: employeeId,
          work_date,
          start_time: cellToTime(getCell(row, ["entrada", "inicio"])) || null,
          break_start: cellToTime(getCell(row, ["intervalo", "saida_intervalo"])) || null,
          break_end: cellToTime(getCell(row, ["retorno", "fim_intervalo"])) || null,
          end_time: cellToTime(getCell(row, ["saida", "fim"])) || null,
          status,
          notes: cellToText(getCell(row, ["observacoes", "obs", "notas"])) || null,
        })
      })

      if (nextRows.length > 0) {
        const dates = nextRows.map((r) => r.work_date).sort()
        setDateRange({ min: dates[0], max: dates[dates.length - 1] })
      }

      setRows(nextRows)
      setErrors(nextErrors)
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Nao foi possivel ler a planilha."])
    }
  }

  async function handleImport() {
    const result = await importSchedules.mutateAsync(rows)
    setErrors(result.errors)

    if (result.created > 0) {
      setRows([])
      setFileName("")
      if (result.errors.length === 0) setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileSpreadsheet className="size-4" />
          Importar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar escalas</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border bg-slate-50 p-3 text-sm text-slate-700">
            Colunas aceitas: colaborador, cpf/documento, filial, data, entrada,
            intervalo, retorno, saida, status e observacoes. Use .xlsx ou .csv.
          </div>
          <Input
            type="file"
            accept=".xlsx,.csv"
            onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
          />
          {fileName ? (
            <div className="text-sm text-muted-foreground">
              {fileName}: {rows.length} linha(s) validas.
            </div>
          ) : null}
          {dateRange ? (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
              Periodo detectado: <strong>{formatDateBR(dateRange.min)}</strong> a{" "}
              <strong>{formatDateBR(dateRange.max)}</strong>. Confirme que as datas
              estao corretas antes de importar.
            </div>
          ) : null}
          {errors.length > 0 ? (
            <div className="max-h-40 overflow-auto rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              {errors.slice(0, 12).map((error) => (
                <div key={error}>{error}</div>
              ))}
              {errors.length > 12 ? <div>...mais {errors.length - 12}</div> : null}
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            disabled={rows.length === 0 || importSchedules.isPending}
            onClick={() => void handleImport()}
          >
            {importSchedules.isPending ? "Importando..." : "Importar escalas"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function getWeekStart(dateISO: string): string {
  const d = new Date(dateISO + "T12:00:00")
  const day = d.getDay()
  const offset = day === 0 ? 6 : day - 1
  d.setDate(d.getDate() - offset)
  return d.toISOString().slice(0, 10)
}

function addDays(dateISO: string, n: number): string {
  const d = new Date(dateISO + "T12:00:00")
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

export function SchedulesPage() {
  const selectedBranchId = useAppStore((state) => state.selectedBranchId)
  const [viewMode, setViewMode] = useState<"day" | "week" | "range">("week")
  const [date, setDate] = useState(todayISO())
  const [weekStart, setWeekStart] = useState(() => getWeekStart(todayISO()))
  const [rangeFrom, setRangeFrom] = useState(() => addDays(todayISO(), -180))
  const [rangeTo, setRangeTo] = useState(() => addDays(todayISO(), 180))
  const [sectorFilter, setSectorFilter] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [open, setOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [form, setForm] = useState<ScheduleFormState>({
    branch_id: selectedBranchId ?? "",
    employee_id: "",
    work_date: todayISO(),
    start_time: "08:00",
    break_start: "12:00",
    break_end: "13:00",
    end_time: "17:00",
    status: "scheduled",
    notes: "",
  })

  const weekEnd = addDays(weekStart, 6)
  const dayQuery = useSchedules(date)
  const weekQuery = useSchedulesRange(weekStart, weekEnd)
  const rangeQuery = useSchedulesRange(rangeFrom, rangeTo)
  const currentQuery = viewMode === "week" ? weekQuery : viewMode === "range" ? rangeQuery : dayQuery
  const employees = useEmployees(form.branch_id || selectedBranchId)
  const allEmployees = useEmployees(null)
  const branches = useBranches()
  const activeBranches = useMemo(
    () => (branches.data ?? []).filter((b) => b.active),
    [branches.data]
  )
  const createSchedule = useCreateSchedule()
  const deleteSchedulesBulk = useDeleteSchedulesBulk()

  const sectorOptions = useMemo(() => {
    const names = new Set(
      (currentQuery.data ?? []).map((s) => s.employees?.sectors?.name).filter(Boolean) as string[]
    )
    return Array.from(names).sort()
  }, [currentQuery.data])

  const filteredSchedules = useMemo(() => {
    const all = currentQuery.data ?? []
    if (!sectorFilter) return all
    return all.filter((s) => s.employees?.sectors?.name === sectorFilter)
  }, [currentQuery.data, sectorFilter])

  const allFilteredIds = useMemo(() => filteredSchedules.map((s) => s.id), [filteredSchedules])
  const selectedCount = selectedIds.size
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedIds.has(id))

  const schedulesByDate = useMemo(() => {
    const map = new Map<string, ScheduleWithRelations[]>()
    for (const s of filteredSchedules) {
      if (!map.has(s.work_date)) map.set(s.work_date, [])
      map.get(s.work_date)!.push(s)
    }
    return map
  }, [filteredSchedules])

  const activeEmployees = useMemo(
    () => (employees.data ?? []).filter((e) => e.active),
    [employees.data]
  )

  function toggleAll(checked: boolean) {
    setSelectedIds(() => {
      const next = new Set<string>()
      if (checked) for (const id of allFilteredIds) next.add(id)
      return next
    })
  }

  function toggleOne(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function toggleDay(dayDate: string, checked: boolean) {
    const dayIds = (schedulesByDate.get(dayDate) ?? []).map((s) => s.id)
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const id of dayIds) {
        if (checked) next.add(id)
        else next.delete(id)
      }
      return next
    })
  }

  async function handleBulkDelete() {
    await deleteSchedulesBulk.mutateAsync(Array.from(selectedIds))
    setSelectedIds(new Set())
    setBulkDeleteOpen(false)
  }

  function handleExport() {
    const headers = [
      { key: "employee", label: "Colaborador" },
      { key: "sector", label: "Setor" },
      { key: "work_date", label: "Data" },
      { key: "start_time", label: "Entrada" },
      { key: "break_start", label: "Inicio intervalo" },
      { key: "break_end", label: "Fim intervalo" },
      { key: "end_time", label: "Saida" },
      { key: "status", label: "Status" },
      { key: "notes", label: "Observacoes" },
    ]
    const rows = filteredSchedules.map((s) => ({
      employee: s.employees?.name ?? "",
      sector: s.employees?.sectors?.name ?? "",
      work_date: s.work_date,
      start_time: s.start_time ?? "",
      break_start: s.break_start ?? "",
      break_end: s.break_end ?? "",
      end_time: s.end_time ?? "",
      status: scheduleStatusLabel[s.status as keyof typeof scheduleStatusLabel] ?? s.status,
      notes: s.notes ?? "",
    }))
    const filename =
      viewMode === "week"
        ? `escala_semana_${weekStart}.csv`
        : viewMode === "range"
        ? `escala_periodo_${rangeFrom}_${rangeTo}.csv`
        : `escala_${date}.csv`
    downloadCsv(buildCsv(rows, headers), filename)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    if (!form.branch_id || !form.employee_id) {
      setFormError("Selecione filial e colaborador.")
      return
    }
    await createSchedule.mutateAsync({
      branch_id: form.branch_id,
      employee_id: form.employee_id,
      work_date: form.work_date,
      start_time: form.start_time || null,
      break_start: form.break_start || null,
      break_end: form.break_end || null,
      end_time: form.end_time || null,
      status: form.status,
      notes: form.notes.trim() || null,
    })
    if (viewMode === "week") setWeekStart(getWeekStart(form.work_date))
    else setDate(form.work_date)
    setOpen(false)
  }

  const weekLabel = `${formatDateBR(weekStart)} — ${formatDateBR(weekEnd)}`
  const rangeLabel = `${formatDateBR(rangeFrom)} — ${formatDateBR(rangeTo)}`

  return (
    <>
      <PageHeader
        title="Escalas"
        description={
          viewMode === "week"
            ? `Semana de ${weekLabel}`
            : viewMode === "range"
            ? `Período: ${rangeLabel}`
            : `Escala de ${formatDateBR(date)}`
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            {/* View toggle */}
            <div className="flex overflow-hidden rounded-lg border">
              <button
                type="button"
                onClick={() => setViewMode("week")}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium transition-colors",
                  viewMode === "week" ? "bg-slate-950 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
                )}
              >
                Semana
              </button>
              <button
                type="button"
                onClick={() => setViewMode("day")}
                className={cn(
                  "border-l px-3 py-1.5 text-sm font-medium transition-colors",
                  viewMode === "day" ? "bg-slate-950 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
                )}
              >
                Dia
              </button>
              <button
                type="button"
                onClick={() => setViewMode("range")}
                className={cn(
                  "border-l px-3 py-1.5 text-sm font-medium transition-colors",
                  viewMode === "range" ? "bg-slate-950 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
                )}
              >
                Período
              </button>
            </div>

            {/* Navigation */}
            {viewMode === "week" ? (
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" onClick={() => setWeekStart(addDays(weekStart, -7))}>
                  <ChevronLeft className="size-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setWeekStart(getWeekStart(todayISO())); setDate(todayISO()) }}>
                  Hoje
                </Button>
                <Button variant="outline" size="icon" onClick={() => setWeekStart(addDays(weekStart, 7))}>
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            ) : viewMode === "range" ? (
              <div className="flex items-center gap-2">
                <Input
                  className="w-36"
                  type="date"
                  value={rangeFrom}
                  onChange={(e) => setRangeFrom(e.target.value)}
                />
                <span className="text-sm text-muted-foreground">até</span>
                <Input
                  className="w-36"
                  type="date"
                  value={rangeTo}
                  onChange={(e) => setRangeTo(e.target.value)}
                />
              </div>
            ) : (
              <Input
                className="w-40"
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value)
                  setForm((c) => ({ ...c, work_date: e.target.value }))
                }}
              />
            )}

            {sectorOptions.length > 0 ? (
              <select className={filterClass} value={sectorFilter} onChange={(e) => setSectorFilter(e.target.value)}>
                <option value="">Todos os setores</option>
                {sectorOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            ) : null}

            <Button variant="outline" size="sm" onClick={handleExport} disabled={filteredSchedules.length === 0}>
              <Download className="mr-1.5 size-4" />
              Exportar CSV
            </Button>
            <SchedulesImportDialog
              branches={branches.data ?? []}
              currentDate={viewMode === "week" ? weekStart : date}
              employees={allEmployees.data ?? []}
              selectedBranchId={selectedBranchId}
            />
            <CopyDayDialog
              branches={branches.data ?? []}
              currentDate={viewMode === "week" ? weekStart : date}
              selectedBranchId={selectedBranchId}
            />

            {/* Nova escala */}
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <CalendarPlus className="size-4" />
                  Nova escala
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Cadastrar escala</DialogTitle></DialogHeader>
                <form className="space-y-4" onSubmit={handleSubmit}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">Filial</span>
                      <select className={fieldClass} value={form.branch_id}
                        onChange={(e) => setForm((c) => ({ ...c, branch_id: e.target.value, employee_id: "" }))}>
                        <option value="">Selecione</option>
                        {activeBranches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">Colaborador</span>
                      <select className={fieldClass} value={form.employee_id}
                        onChange={(e) => setForm((c) => ({ ...c, employee_id: e.target.value }))}>
                        <option value="">Selecione</option>
                        {activeEmployees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">Data</span>
                      <Input type="date" value={form.work_date}
                        onChange={(e) => setForm((c) => ({ ...c, work_date: e.target.value }))} />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">Status</span>
                      <select className={fieldClass} value={form.status}
                        onChange={(e) => setForm((c) => nextFormForStatus(c, e.target.value as ScheduleStatus))}>
                        {Object.entries(scheduleStatusLabel).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-4">
                    {(["start_time", "break_start", "break_end", "end_time"] as const).map((field) => (
                      <label className="space-y-1 text-sm" key={field}>
                        <span className="font-medium">
                          {{ start_time: "Entrada", break_start: "Intervalo", break_end: "Retorno", end_time: "Saída" }[field]}
                        </span>
                        <Input type="time" disabled={form.status === "day_off"} value={form[field]}
                          onChange={(e) => setForm((c) => ({ ...c, [field]: e.target.value }))} />
                      </label>
                    ))}
                  </div>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Observações</span>
                    <Input value={form.notes} onChange={(e) => setForm((c) => ({ ...c, notes: e.target.value }))} />
                  </label>
                  {formError || createSchedule.error ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {formError ?? createSchedule.error?.message}
                    </div>
                  ) : null}
                  <DialogFooter>
                    <Button type="submit" disabled={createSchedule.isPending}>
                      {createSchedule.isPending ? "Salvando..." : "Salvar"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="space-y-4 p-6">
        {/* Barra de seleção */}
        {selectedCount > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-slate-50 px-3 py-2 text-sm">
            <span className="font-medium text-slate-700">{selectedCount} escala(s) selecionada(s)</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>Limpar seleção</Button>
              <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
                <DialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={deleteSchedulesBulk.isPending}>
                    <Trash2 className="size-4" />
                    Excluir selecionadas
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Excluir escalas</DialogTitle></DialogHeader>
                  <p className="text-sm text-muted-foreground">
                    Deseja excluir permanentemente {selectedCount} escala(s)? Esta ação não pode ser desfeita.
                  </p>
                  <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>Cancelar</Button>
                    <Button variant="destructive" disabled={deleteSchedulesBulk.isPending}
                      onClick={() => void handleBulkDelete()}>
                      {deleteSchedulesBulk.isPending ? "Excluindo..." : "Confirmar"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        ) : null}

        {/* Conteúdo */}
        {currentQuery.isLoading ? (
          <StateBlock type="loading" title="Carregando escalas" />
        ) : currentQuery.isError ? (
          <StateBlock type="error" title="Erro ao carregar escalas" description={currentQuery.error.message} />
        ) : filteredSchedules.length === 0 ? (
          <StateBlock
            title={(currentQuery.data ?? []).length === 0 ? "Nenhuma escala para este período" : "Nenhum resultado para o setor selecionado"}
            description={(currentQuery.data ?? []).length === 0 && viewMode !== "range" ? "Importe ou cadastre escalas para este período." : undefined}
          />
        ) : (
          <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-slate-50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-slate-300 accent-slate-950"
                      checked={allSelected}
                      onChange={(e) => toggleAll(e.target.checked)}
                      aria-label="Selecionar todas as escalas"
                    />
                  </th>
                  {viewMode === "week" && <th className="px-4 py-3">Data</th>}
                  <th className="px-4 py-3">Colaborador</th>
                  <th className="px-4 py-3">Setor</th>
                  <th className="px-4 py-3">Entrada</th>
                  <th className="px-4 py-3">Intervalo</th>
                  <th className="px-4 py-3">Retorno</th>
                  <th className="px-4 py-3">Saída</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {viewMode === "week"
                  ? Array.from(schedulesByDate.entries()).map(([dayDate, daySchedules]) => {
                      const dayAllIds = daySchedules.map((s) => s.id)
                      const dayAllSelected = dayAllIds.every((id) => selectedIds.has(id))
                      return (
                        <>
                          <tr key={`day-${dayDate}`} className="bg-slate-50">
                            <td className="px-4 py-2">
                              <input
                                type="checkbox"
                                className="size-4 rounded border-slate-300 accent-slate-950"
                                checked={dayAllSelected}
                                onChange={(e) => toggleDay(dayDate, e.target.checked)}
                                aria-label={`Selecionar ${dayDate}`}
                              />
                            </td>
                            <td colSpan={9} className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                              {formatDateBR(dayDate)} — {daySchedules.length} escala(s)
                            </td>
                          </tr>
                          {daySchedules.map((schedule) => {
                            const incomplete = isScheduleIncomplete(schedule)
                            return (
                              <tr key={schedule.id} className="hover:bg-slate-50">
                                <td className="px-4 py-3">
                                  <input
                                    type="checkbox"
                                    className="size-4 rounded border-slate-300 accent-slate-950"
                                    checked={selectedIds.has(schedule.id)}
                                    onChange={(e) => toggleOne(schedule.id, e.target.checked)}
                                  />
                                </td>
                                <td className="px-4 py-3 text-muted-foreground" />
                                <td className="px-4 py-3 font-medium">
                                  <div className="flex items-center gap-2">
                                    {schedule.employees?.name ?? "-"}
                                    {incomplete ? (
                                      <span className="inline-flex h-4 items-center rounded border border-amber-200 bg-amber-50 px-1.5 text-[10px] font-medium text-amber-700">
                                        Incompleta
                                      </span>
                                    ) : null}
                                  </div>
                                </td>
                                <td className="px-4 py-3">{schedule.employees?.sectors?.name ?? "-"}</td>
                                <td className="px-4 py-3">{formatTime(schedule.start_time)}</td>
                                <td className="px-4 py-3">{formatTime(schedule.break_start)}</td>
                                <td className="px-4 py-3">{formatTime(schedule.break_end)}</td>
                                <td className="px-4 py-3">{formatTime(schedule.end_time)}</td>
                                <td className="px-4 py-3">{scheduleStatusLabel[schedule.status]}</td>
                                <td className="px-4 py-3">
                                  <div className="flex justify-end gap-2">
                                    <ScheduleEditDialog schedule={schedule} />
                                    <ScheduleDeleteDialog schedule={schedule} />
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </>
                      )
                    })
                  : filteredSchedules.map((schedule) => {
                      const incomplete = isScheduleIncomplete(schedule)
                      return (
                        <tr key={schedule.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              className="size-4 rounded border-slate-300 accent-slate-950"
                              checked={selectedIds.has(schedule.id)}
                              onChange={(e) => toggleOne(schedule.id, e.target.checked)}
                            />
                          </td>
                          <td className="px-4 py-3 font-medium">
                            <div className="flex items-center gap-2">
                              {schedule.employees?.name ?? "-"}
                              {incomplete ? (
                                <span className="inline-flex h-4 items-center rounded border border-amber-200 bg-amber-50 px-1.5 text-[10px] font-medium text-amber-700">
                                  Incompleta
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-4 py-3">{schedule.employees?.sectors?.name ?? "-"}</td>
                          <td className="px-4 py-3">{formatTime(schedule.start_time)}</td>
                          <td className="px-4 py-3">{formatTime(schedule.break_start)}</td>
                          <td className="px-4 py-3">{formatTime(schedule.break_end)}</td>
                          <td className="px-4 py-3">{formatTime(schedule.end_time)}</td>
                          <td className="px-4 py-3">{scheduleStatusLabel[schedule.status]}</td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <ScheduleEditDialog schedule={schedule} />
                              <ScheduleDeleteDialog schedule={schedule} />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
