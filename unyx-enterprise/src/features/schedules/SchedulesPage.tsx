import { useMemo, useState } from "react"
import type { FormEvent } from "react"
import {
  CalendarCog,
  CalendarDays,
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

type RawScheduleRow = {
  branchName: string
  document: string
  employeeName: string
  dateRaw: unknown
  startRaw: unknown
  breakStartRaw: unknown
  breakEndRaw: unknown
  endRaw: unknown
  statusRaw: string
  notesRaw: string
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
  const [inputMode, setInputMode] = useState<"file" | "paste">("file")
  const [rows, setRows] = useState<ScheduleImportInput[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [fileName, setFileName] = useState("")
  const [pasteText, setPasteText] = useState("")
  const [dateRange, setDateRange] = useState<{ min: string; max: string } | null>(null)
  const importSchedules = useImportSchedules()

  const activeBranches = useMemo(
    () => branches.filter((branch) => branch.active),
    [branches]
  )

  function processRawRows(rawRows: RawScheduleRow[], lineOffset = 2) {
    const branchByName = new Map(
      activeBranches.map((branch) => [normalizeLookup(branch.name), branch.id])
    )
    const employeeByDocument = new Map(
      employees
        .filter((e) => e.active && e.document)
        .map((e) => [
          `${e.branch_id}:${cellToText(e.document).replace(/\D/g, "")}`,
          e.id,
        ])
    )
    const activeEmployees = employees.filter((e) => e.active)
    const employeeByBranchAndName = new Map(
      activeEmployees.map((e) => [
        `${e.branch_id}:${normalizeLookup(e.name)}`,
        e.id,
      ])
    )
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
      selectedBranchId && activeBranches.some((b) => b.id === selectedBranchId)
        ? selectedBranchId
        : activeBranches[0]?.id ?? ""

    const nextRows: ScheduleImportInput[] = []
    const nextErrors: string[] = []

    rawRows.forEach(
      (
        { branchName, document, employeeName, dateRaw, startRaw, breakStartRaw, breakEndRaw, endRaw, statusRaw, notesRaw },
        index
      ) => {
        const lineNum = index + lineOffset
        const branchId = branchName
          ? branchByName.get(normalizeLookup(branchName)) ?? ""
          : fallbackBranchId
        const cleanDoc = document.replace(/\D/g, "")
        const employeeId = cleanDoc
          ? employeeByDocument.get(`${branchId}:${cleanDoc}`) ?? ""
          : employeeByBranchAndName.get(`${branchId}:${normalizeLookup(employeeName)}`) ||
            findEmployeeByPartialName(branchId, employeeName)
        const status = scheduleStatusFromText(statusRaw || "scheduled")

        if (!branchId) {
          nextErrors.push(`Linha ${lineNum}: filial nao encontrada.`)
          return
        }
        if (!employeeId) {
          nextErrors.push(`Linha ${lineNum}: colaborador "${employeeName}" nao encontrado na filial.`)
          return
        }

        const work_date = cellToDate(dateRaw, currentDate)
        const diffDays = Math.abs(
          (new Date(work_date + "T12:00:00").getTime() -
            new Date(currentDate + "T12:00:00").getTime()) /
            (1000 * 60 * 60 * 24)
        )
        if (diffDays > 90) {
          nextErrors.push(
            `Linha ${lineNum}: data ${formatDateBR(work_date)} parece incorreta (muito distante de hoje). Verifique se o formato e DD/MM/AAAA.`
          )
          return
        }

        nextRows.push({
          branch_id: branchId,
          employee_id: employeeId,
          work_date,
          start_time: cellToTime(startRaw) || null,
          break_start: cellToTime(breakStartRaw) || null,
          break_end: cellToTime(breakEndRaw) || null,
          end_time: cellToTime(endRaw) || null,
          status,
          notes: notesRaw || null,
        })
      }
    )

    return { nextRows, nextErrors }
  }

  function applyResult(nextRows: ScheduleImportInput[], nextErrors: string[]) {
    if (nextRows.length > 0) {
      const dates = nextRows.map((r) => r.work_date).sort()
      setDateRange({ min: dates[0], max: dates[dates.length - 1] })
    } else {
      setDateRange(null)
    }
    setRows(nextRows)
    setErrors(nextErrors)
  }

  async function handleFile(file: File | null) {
    setRows([])
    setErrors([])
    setFileName(file?.name ?? "")
    setDateRange(null)
    if (!file) return

    try {
      const parsed = await parseSpreadsheet(file)
      const rawRows: RawScheduleRow[] = parsed.map((row) => ({
        branchName: cellToText(getCell(row, ["filial", "loja", "unidade"])),
        document: cellToText(getCell(row, ["documento", "cpf", "cpf_documento"])),
        employeeName: cellToText(getCell(row, ["colaborador", "funcionario", "nome"])),
        dateRaw: getCell(row, ["data", "dia"]),
        startRaw: getCell(row, ["entrada", "inicio"]),
        breakStartRaw: getCell(row, ["intervalo", "saida_intervalo"]),
        breakEndRaw: getCell(row, ["retorno", "fim_intervalo"]),
        endRaw: getCell(row, ["saida", "fim"]),
        statusRaw: cellToText(getCell(row, ["status", "situacao"])),
        notesRaw: cellToText(getCell(row, ["observacoes", "obs", "notas"])),
      }))
      const { nextRows, nextErrors } = processRawRows(rawRows)
      applyResult(nextRows, nextErrors)
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Nao foi possivel ler a planilha."])
    }
  }

  function handlePasteChange(text: string) {
    setPasteText(text)
    setRows([])
    setErrors([])
    setDateRange(null)
    if (!text.trim()) return

    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
    const rawRows: RawScheduleRow[] = lines.map((line) => {
      const cols = line.split("\t")
      const get = (i: number) => {
        const v = (cols[i] ?? "").trim()
        return v === "null" ? "" : v
      }
      return {
        employeeName: get(0),
        document: get(1),
        branchName: get(2),
        dateRaw: get(3),
        startRaw: get(4),
        breakStartRaw: get(5),
        breakEndRaw: get(6),
        endRaw: get(7),
        statusRaw: get(8),
        notesRaw: get(9),
      }
    })
    const { nextRows, nextErrors } = processRawRows(rawRows, 1)
    applyResult(nextRows, nextErrors)
  }

  async function handleImport() {
    const result = await importSchedules.mutateAsync(rows)
    setErrors(result.errors)
    if (result.created > 0) {
      setRows([])
      setFileName("")
      setPasteText("")
      if (result.errors.length === 0) setOpen(false)
    }
  }

  const tabClass = (active: boolean) =>
    `flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
      active ? "bg-white shadow-sm" : "text-muted-foreground hover:text-foreground"
    }`

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
          <div className="flex gap-1 rounded-lg border bg-slate-100 p-1">
            <button
              className={tabClass(inputMode === "file")}
              onClick={() => { setInputMode("file"); setRows([]); setErrors([]); setDateRange(null); setPasteText("") }}
            >
              Arquivo
            </button>
            <button
              className={tabClass(inputMode === "paste")}
              onClick={() => { setInputMode("paste"); setRows([]); setErrors([]); setDateRange(null); setFileName("") }}
            >
              Colar texto
            </button>
          </div>

          {inputMode === "file" ? (
            <>
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
            </>
          ) : (
            <>
              <div className="rounded-lg border bg-slate-50 p-3 text-sm text-slate-700">
                Cole o texto copiado da planilha. Colunas esperadas (separadas por tabulacao):{" "}
                <span className="font-medium">nome, documento, filial, data, entrada, inicio intervalo, fim intervalo, saida, status, observacoes</span>.
              </div>
              <textarea
                className="h-40 w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50 resize-none font-mono"
                placeholder={"JOAO\tnull\tloja principal\t05/05/2026\t07:40\t12:30\t14:30\t17:40\tTrabalhando\tnull"}
                value={pasteText}
                onChange={(e) => handlePasteChange(e.target.value)}
              />
              {pasteText.trim() ? (
                <div className="text-sm text-muted-foreground">
                  {rows.length} linha(s) validas de {pasteText.split(/\r?\n/).filter((l) => l.trim()).length} coladas.
                </div>
              ) : null}
            </>
          )}

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

const PT_MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]

function getScheduleInitials(name: string): string {
  const parts = name.trim().split(" ").filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return (parts[0][0] ?? "?").toUpperCase()
  return ((parts[0][0] ?? "") + (parts[parts.length - 1][0] ?? "")).toUpperCase()
}

function MonthCalendarView({
  calendarMonth,
  onMonthChange,
  onDaySelect,
  schedulesByDate,
  selectedDay,
  today,
}: {
  calendarMonth: string
  onMonthChange: (month: string) => void
  onDaySelect: (day: string | null) => void
  schedulesByDate: Map<string, ScheduleWithRelations[]>
  selectedDay: string | null
  today: string
}) {
  const [yearNum, monthNum] = calendarMonth.split("-").map(Number)

  function prevMonth() {
    const d = new Date(yearNum, monthNum - 2, 1)
    onMonthChange(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    )
    onDaySelect(null)
  }

  function nextMonth() {
    const d = new Date(yearNum, monthNum, 1)
    onMonthChange(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    )
    onDaySelect(null)
  }

  const firstDay = new Date(yearNum, monthNum - 1, 1)
  const daysInMonth = new Date(yearNum, monthNum, 0).getDate()
  const startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1

  const cells: (number | null)[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const selectedDaySchedules = selectedDay
    ? (schedulesByDate.get(selectedDay) ?? [])
    : []

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      {/* Monthly calendar */}
      <div className="rounded-lg border bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-800">
            {PT_MONTHS[monthNum - 1]} {yearNum}
          </span>
          <div className="flex gap-0.5">
            <button
              onClick={prevMonth}
              className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              onClick={nextMonth}
              className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>

        {/* Week day headers */}
        <div className="mb-1 grid grid-cols-7">
          {["S", "T", "Q", "Q", "S", "S", "D"].map((d, i) => (
            <div
              key={i}
              className="flex items-center justify-center py-1 text-xs font-medium text-muted-foreground"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-y-0.5">
          {cells.map((day, i) => {
            if (!day) return <div key={`empty-${i}`} />
            const dateISO = `${calendarMonth}-${String(day).padStart(2, "0")}`
            const isToday = dateISO === today
            const isSelected = dateISO === selectedDay
            const hasSchedules = schedulesByDate.has(dateISO)

            return (
              <button
                key={dateISO}
                onClick={() => onDaySelect(isSelected ? null : dateISO)}
                className={cn(
                  "relative flex h-9 w-full flex-col items-center justify-center rounded-full text-sm transition-colors",
                  isSelected
                    ? "bg-slate-900 font-semibold text-white"
                    : isToday
                    ? "font-semibold text-blue-600 hover:bg-blue-50"
                    : "text-slate-700 hover:bg-slate-100"
                )}
              >
                {day}
                {hasSchedules && !isSelected ? (
                  <span className="absolute bottom-1 h-1 w-1 rounded-full bg-indigo-400" />
                ) : null}
              </button>
            )
          })}
        </div>
      </div>

      {/* Schedule list for selected day */}
      <div className="rounded-lg border bg-white p-5 shadow-sm">
        {selectedDay ? (
          <>
            <h3 className="mb-4 text-base font-semibold text-slate-800">
              Escala de {formatDateBR(selectedDay)}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {selectedDaySchedules.length} escala(s)
              </span>
            </h3>
            {selectedDaySchedules.length === 0 ? (
              <StateBlock title="Nenhuma escala neste dia" />
            ) : (
              <div className="space-y-2">
                {selectedDaySchedules.map((schedule) => {
                  const incomplete = isScheduleIncomplete(schedule)
                  return (
                    <div
                      key={schedule.id}
                      className="flex items-center gap-3 rounded-lg border border-slate-100 p-3 transition-colors hover:bg-slate-50"
                    >
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
                        {getScheduleInitials(schedule.employees?.name ?? "?")}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-indigo-600">
                            {schedule.employees?.name ?? "-"}
                          </span>
                          {incomplete ? (
                            <span className="inline-flex h-4 items-center rounded border border-amber-200 bg-amber-50 px-1.5 text-[10px] font-medium text-amber-700">
                              Incompleta
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {schedule.status === "day_off"
                            ? "Folga"
                            : schedule.status === "cancelled"
                            ? "Cancelado"
                            : `${formatTime(schedule.start_time)} – ${formatTime(schedule.end_time)}`}
                          {schedule.employees?.sectors?.name ? (
                            <span className="ml-2 text-slate-400">
                              · {schedule.employees.sectors.name}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <ScheduleEditDialog schedule={schedule} />
                        <ScheduleDeleteDialog schedule={schedule} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        ) : (
          <div className="flex h-full min-h-64 items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-slate-400">
              <CalendarDays className="size-8" />
              <span className="text-sm">Clique em um dia para ver as escalas</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function addDays(dateISO: string, n: number): string {
  const d = new Date(dateISO + "T12:00:00")
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

export function SchedulesPage() {
  const selectedBranchId = useAppStore((state) => state.selectedBranchId)
  const [viewMode, setViewMode] = useState<"range" | "calendar">("calendar")
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [calendarMonth, setCalendarMonth] = useState(() => todayISO().slice(0, 7))
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

  const monthStart = calendarMonth + "-01"
  const monthEnd = useMemo(() => {
    const [yearStr, monthStr] = calendarMonth.split("-")
    const lastDay = new Date(Number(yearStr), Number(monthStr), 0).getDate()
    return `${calendarMonth}-${String(lastDay).padStart(2, "0")}`
  }, [calendarMonth])
  const rangeQuery = useSchedulesRange(rangeFrom, rangeTo)
  const monthQuery = useSchedulesRange(monthStart, monthEnd)
  const currentQuery = viewMode === "range" ? rangeQuery : monthQuery

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
      viewMode === "range"
        ? `escala_periodo_${rangeFrom}_${rangeTo}.csv`
        : `escala_mes_${calendarMonth}.csv`
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
    setOpen(false)
  }

  const rangeLabel = `${formatDateBR(rangeFrom)} — ${formatDateBR(rangeTo)}`

  return (
    <>
      <PageHeader
        title="Escalas"
        description={
          viewMode === "range"
            ? `Período: ${rangeLabel}`
            : undefined
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            {/* View toggle */}
            <div className="flex overflow-hidden rounded-lg border">
              <button
                type="button"
                onClick={() => setViewMode("calendar")}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium transition-colors",
                  viewMode === "calendar" ? "bg-slate-950 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
                )}
              >
                Calendário
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
            {viewMode === "range" ? (
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
            ) : null}

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
              currentDate={todayISO()}
              employees={allEmployees.data ?? []}
              selectedBranchId={selectedBranchId}
            />
            <CopyDayDialog
              branches={branches.data ?? []}
              currentDate={todayISO()}
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
        ) : viewMode === "calendar" ? (
          <MonthCalendarView
            calendarMonth={calendarMonth}
            onMonthChange={setCalendarMonth}
            schedulesByDate={schedulesByDate}
            selectedDay={selectedDay}
            today={todayISO()}
            onDaySelect={setSelectedDay}
          />
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
                  <th className="px-4 py-3">Data</th>
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
                {filteredSchedules.map((schedule) => {
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
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {formatDateBR(schedule.work_date)}
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
