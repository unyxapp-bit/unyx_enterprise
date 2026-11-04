import { useMemo, useState } from "react"
import { ClipboardPaste, ListPlus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
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
import { Select } from "@/components/ui/select"
import { useApplyScheduleChanges, useSchedulesRange } from "@/hooks/useUnyxData"
import { formatDateBR } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { ScheduleImportInput } from "@/services/unyxApi"
import type {
  Branch,
  EmployeeWithRelations,
  ScheduleStatus,
  ScheduleWithRelations,
} from "@/types/domain"

import { matchEmployee, parsePaperSchedule, validateTimes } from "../utils/paperSchedule"

interface DraftRow {
  key: string
  date: string
  section: string
  rawName: string
  note: string | null
  employeeId: string
  suggestions: string[]
  dayOff: boolean
  start: string
  breakStart: string
  breakEnd: string
  end: string
}

const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"]
const DAY_OFF_STATUSES: ScheduleStatus[] = ["day_off", "banked_hours", "cancelled"]

const textareaClass =
  "h-44 w-full resize-y rounded-lg border bg-[color:var(--bg-surface)] px-3 py-2 font-mono text-xs outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"

const trim = (value: string | null | undefined) => (value ? value.slice(0, 5) : "")

function weekdayLabel(date: string) {
  const [year, month, day] = date.split("-").map(Number)
  return WEEKDAYS[new Date(year, month - 1, day).getDay()]
}

export function PaperScheduleDialog({
  branches,
  employees,
  selectedBranchId,
  currentDate,
}: {
  branches: Branch[]
  employees: EmployeeWithRelations[]
  selectedBranchId: string | null
  currentDate: string
}) {
  const activeBranches = useMemo(() => branches.filter((branch) => branch.active), [branches])
  const [open, setOpen] = useState(false)
  const [branchId, setBranchId] = useState("")
  const [text, setText] = useState("")
  const [rows, setRows] = useState<DraftRow[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [blankDate, setBlankDate] = useState(currentDate)
  const [errors, setErrors] = useState<string[]>([])
  const apply = useApplyScheduleChanges()

  const effectiveBranchId =
    branchId ||
    (selectedBranchId && activeBranches.some((branch) => branch.id === selectedBranchId)
      ? selectedBranchId
      : activeBranches[0]?.id ?? "")

  const branchEmployees = useMemo(
    () =>
      employees
        .filter((employee) => employee.active && employee.branch_id === effectiveBranchId)
        .sort((left, right) => left.name.localeCompare(right.name, "pt-BR")),
    [effectiveBranchId, employees]
  )

  const dates = useMemo(() => rows.map((row) => row.date).sort(), [rows])
  const existingQuery = useSchedulesRange(dates[0] ?? "", dates[dates.length - 1] ?? "", {
    enabled: rows.length > 0,
  })
  const existingByKey = useMemo(() => {
    const map = new Map<string, ScheduleWithRelations>()
    for (const schedule of existingQuery.data ?? []) {
      if (schedule.branch_id === effectiveBranchId) {
        map.set(`${schedule.employee_id}:${schedule.work_date}`, schedule)
      }
    }
    return map
  }, [effectiveBranchId, existingQuery.data])

  function readText(value: string, branch = effectiveBranchId) {
    setText(value)
    setErrors([])
    if (!value.trim()) {
      setRows([])
      setWarnings([])
      return
    }
    const parsed = parsePaperSchedule(value)
    const pool = employees.filter((employee) => employee.active && employee.branch_id === branch)
    setRows(
      parsed.rows.map((row) => {
        const match = matchEmployee(row.candidates, pool)
        return {
          key: `${row.line}`,
          date: row.date,
          section: row.section,
          rawName: row.rawName,
          note: row.note,
          employeeId: match.employeeId,
          suggestions: match.options,
          dayOff: row.dayOff,
          start: row.start,
          breakStart: row.breakStart,
          breakEnd: row.breakEnd,
          end: row.end,
        }
      })
    )
    setWarnings(parsed.warnings)
  }

  function changeBranch(value: string) {
    setBranchId(value)
    if (text.trim()) readText(text, value)
    else setRows((current) => current.map((row) => ({ ...row, employeeId: "", suggestions: [] })))
  }

  function addAllEmployees() {
    if (!blankDate) return
    const present = new Set(rows.filter((row) => row.date === blankDate).map((row) => row.employeeId))
    const added: DraftRow[] = branchEmployees
      .filter((employee) => !present.has(employee.id))
      .map((employee) => ({
        key: `new-${blankDate}-${employee.id}`,
        date: blankDate,
        section: employee.sectors?.name?.toUpperCase() ?? "",
        rawName: employee.name,
        note: null,
        employeeId: employee.id,
        suggestions: [employee.id],
        dayOff: false,
        start: "",
        breakStart: "",
        breakEnd: "",
        end: "",
      }))
    setRows((current) => [...current, ...added])
  }

  function patchRow(key: string, patch: Partial<DraftRow>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  const analyzed = useMemo(
    () =>
      rows.map((row) => {
        const existing = row.employeeId
          ? existingByKey.get(`${row.employeeId}:${row.date}`) ?? null
          : null
        const error = row.employeeId ? validateTimes(row) : null
        const sameAsExisting =
          existing !== null &&
          (row.dayOff
            ? DAY_OFF_STATUSES.includes(existing.status)
            : !DAY_OFF_STATUSES.includes(existing.status) &&
              trim(existing.start_time) === row.start &&
              trim(existing.break_start) === row.breakStart &&
              trim(existing.break_end) === row.breakEnd &&
              trim(existing.end_time) === row.end)
        const action = !row.employeeId
          ? "ignore"
          : error
            ? "error"
            : existing
              ? sameAsExisting
                ? "same"
                : "update"
              : "create"
        return { row, existing, error, action } as const
      }),
    [existingByKey, rows]
  )

  const counts = useMemo(() => {
    const result = { create: 0, update: 0, same: 0, ignore: 0, error: 0 }
    for (const item of analyzed) result[item.action] += 1
    return result
  }, [analyzed])

  const groups = useMemo(() => {
    const map = new Map<string, typeof analyzed>()
    for (const item of analyzed) {
      map.set(item.row.date, [...(map.get(item.row.date) ?? []), item])
    }
    return [...map.entries()].sort(([left], [right]) => left.localeCompare(right))
  }, [analyzed])

  async function save() {
    const create: ScheduleImportInput[] = []
    const update: Array<{
      id: string
      label: string
      values: Pick<ScheduleImportInput, "start_time" | "break_start" | "break_end" | "end_time" | "status" | "notes">
    }> = []

    for (const { row, existing, action } of analyzed) {
      if (action !== "create" && action !== "update") continue
      const times = row.dayOff
        ? { start_time: null, break_start: null, break_end: null, end_time: null }
        : {
            start_time: row.start || null,
            break_start: row.breakStart || null,
            break_end: row.breakEnd || null,
            end_time: row.end || null,
          }
      if (action === "create") {
        create.push({
          branch_id: effectiveBranchId,
          employee_id: row.employeeId,
          work_date: row.date,
          status: row.dayOff ? "day_off" : "scheduled",
          notes: row.note,
          ...times,
        })
      } else if (existing) {
        // Quem já está trabalhando/finalizado no sistema mantém a situação; só folga troca de status.
        const status: ScheduleStatus = row.dayOff
          ? "day_off"
          : DAY_OFF_STATUSES.includes(existing.status)
            ? "scheduled"
            : existing.status
        update.push({
          id: existing.id,
          label: `${formatDateBR(row.date)} ${row.rawName}`,
          values: { ...times, status, notes: row.note ?? existing.notes },
        })
      }
    }

    const result = await apply.mutateAsync({ create, update })
    setErrors(result.errors)
    if (result.errors.length === 0) {
      setRows([])
      setText("")
      setWarnings([])
      setOpen(false)
    }
  }

  const savable = counts.create + counts.update

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <ClipboardPaste className="size-4" />
          Escala do papel
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>Montar escala da semana</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            {activeBranches.length > 1 ? (
              <label className="space-y-1 text-sm">
                <span className="font-medium">Filial</span>
                <Select
                  aria-label="Filial da escala"
                  className="w-48"
                  value={effectiveBranchId}
                  onValueChange={changeBranch}
                  options={activeBranches.map((branch) => ({ value: branch.id, label: branch.name }))}
                />
              </label>
            ) : null}
            <label className="space-y-1 text-sm">
              <span className="font-medium">Montar um dia do zero</span>
              <div className="flex gap-2">
                <Input
                  aria-label="Dia para montar"
                  type="date"
                  className="w-40"
                  value={blankDate}
                  onChange={(event) => setBlankDate(event.target.value)}
                />
                <Button type="button" variant="outline" onClick={addAllEmployees} disabled={!blankDate}>
                  <ListPlus className="size-4" />
                  Listar todos os colaboradores
                </Button>
              </div>
            </label>
          </div>

          <label className="block space-y-1 text-sm">
            <span className="font-medium">Colar a escala (copiada da planilha, Word ou PDF)</span>
            <textarea
              aria-label="Texto da escala"
              className={textareaClass}
              placeholder={
                "segunda-feira, 2 de novembro de 2026\nCAIXA\nFRANCIELLY\t07:40\t11:20\t13:20\t16:40\nWESLEY\t07:40\t11:20\t13:20\t16:40\nFISCAL\nMARCO\t07:40\t11:40\t13:40\t16:40\nLANNA\tFOLGA\tFOLGA\tFOLGA\tFOLGA"
              }
              value={text}
              onChange={(event) => readText(event.target.value)}
            />
            <span className="text-xs text-muted-foreground">
              Reconhece o título de cada dia, o setor (CAIXA, FISCAL, PACOTE...), os quatro horários,
              FOLGA e "NÃO TRABALHAR". Confira e corrija abaixo antes de salvar.
            </span>
          </label>

          {warnings.length > 0 ? (
            <div className="max-h-28 overflow-auto rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              {warnings.slice(0, 8).map((warning) => (
                <div key={warning}>{warning}</div>
              ))}
              {warnings.length > 8 ? <div>...mais {warnings.length - 8}</div> : null}
            </div>
          ) : null}

          {rows.length > 0 ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">{counts.create} novas</Badge>
                <Badge variant="outline">{counts.update} atualizam uma escala existente</Badge>
                <Badge variant="outline">{counts.same} já iguais</Badge>
                <Badge variant="outline" className={cn(counts.ignore > 0 && "border-amber-300 text-amber-800")}>
                  {counts.ignore} sem colaborador
                </Badge>
                {counts.error > 0 ? (
                  <Badge variant="outline" className="border-red-300 text-red-700">
                    {counts.error} com erro
                  </Badge>
                ) : null}
              </div>

              {groups.map(([date, items]) => (
                <section key={date} className="overflow-x-auto rounded-xl border border-[color:var(--border-soft)]">
                  <div className="bg-[color:var(--bg-muted)] px-3 py-2 text-sm font-semibold">
                    {formatDateBR(date)} · {weekdayLabel(date)}
                  </div>
                  <table className="w-full min-w-[56rem] text-sm">
                    <thead className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-1.5">Na escala</th>
                        <th className="px-2 py-1.5">Colaborador</th>
                        <th className="px-2 py-1.5">Folga</th>
                        <th className="px-2 py-1.5">Entrada</th>
                        <th className="px-2 py-1.5">Intervalo</th>
                        <th className="px-2 py-1.5">Retorno</th>
                        <th className="px-2 py-1.5">Saída</th>
                        <th className="px-3 py-1.5">Situação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[color:var(--border-soft)]">
                      {items.map(({ row, error, action }) => (
                        <tr key={row.key} className={cn(action === "error" && "bg-red-50/60 dark:bg-red-500/10")}>
                          <td className="px-3 py-1.5">
                            <div className="font-medium">{row.rawName}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {[row.section, row.note].filter(Boolean).join(" · ")}
                            </div>
                          </td>
                          <td className="px-2 py-1.5">
                            <Select
                              aria-label={`Colaborador de ${row.rawName} em ${formatDateBR(row.date)}`}
                              className="w-52"
                              value={row.employeeId}
                              onValueChange={(value) => patchRow(row.key, { employeeId: value })}
                              options={[
                                { value: "", label: "Ignorar esta linha" },
                                ...[
                                  ...branchEmployees.filter((employee) => row.suggestions.includes(employee.id)),
                                  ...branchEmployees.filter((employee) => !row.suggestions.includes(employee.id)),
                                ].map((employee) => ({ value: employee.id, label: employee.name })),
                              ]}
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="checkbox"
                              aria-label={`Folga de ${row.rawName} em ${formatDateBR(row.date)}`}
                              className="size-4"
                              checked={row.dayOff}
                              onChange={(event) => patchRow(row.key, { dayOff: event.target.checked })}
                            />
                          </td>
                          {(
                            [
                              ["start", "Entrada"],
                              ["breakStart", "Saída para intervalo"],
                              ["breakEnd", "Retorno"],
                              ["end", "Saída"],
                            ] as const
                          ).map(([field, label]) => (
                            <td key={field} className="px-2 py-1.5">
                              <Input
                                type="time"
                                className="w-24"
                                aria-label={`${label} de ${row.rawName} em ${formatDateBR(row.date)}`}
                                disabled={row.dayOff}
                                value={row[field]}
                                onChange={(event) => patchRow(row.key, { [field]: event.target.value })}
                              />
                            </td>
                          ))}
                          <td className="px-3 py-1.5 text-xs">
                            {action === "create" ? (
                              <span className="text-emerald-700 dark:text-emerald-300">Nova</span>
                            ) : action === "update" ? (
                              <span className="text-sky-700 dark:text-sky-300">Atualiza a existente</span>
                            ) : action === "same" ? (
                              <span className="text-muted-foreground">Já igual</span>
                            ) : action === "error" ? (
                              <span className="text-red-700 dark:text-red-300">{error}</span>
                            ) : (
                              <span className="text-amber-700 dark:text-amber-300">Escolha o colaborador</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              ))}
            </div>
          ) : null}

          {errors.length > 0 ? (
            <div className="max-h-32 overflow-auto rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
              {errors.slice(0, 10).map((error) => (
                <div key={error}>{error}</div>
              ))}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button disabled={savable === 0 || apply.isPending} onClick={() => void save()}>
            {apply.isPending
              ? "Salvando..."
              : `Salvar escala (${counts.create} novas, ${counts.update} atualizadas)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
