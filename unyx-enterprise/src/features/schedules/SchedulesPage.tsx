import { useMemo, useState } from "react"
import type { FormEvent } from "react"
import { CalendarPlus, Pencil, Trash2 } from "lucide-react"

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
  useCreateSchedule,
  useDeleteSchedule,
  useEmployees,
  useSchedules,
  useUpdateSchedule,
} from "@/hooks/useUnyxData"
import { formatDateBR, formatTime, todayISO } from "@/lib/format"
import { scheduleStatusLabel } from "@/lib/status"
import { useAppStore } from "@/store/useAppStore"
import type { ScheduleStatus, ScheduleWithRelations } from "@/types/domain"

const fieldClass =
  "h-8 w-full rounded-lg border bg-white px-2.5 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"

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
                    {
                      {
                        start_time: "Entrada",
                        break_start: "Intervalo",
                        break_end: "Retorno",
                        end_time: "Saída",
                      }[field]
                    }
                  </span>
                  <Input
                    type="time"
                    value={form[field]}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        [field]: event.target.value,
                      }))
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
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  status: event.target.value as ScheduleStatus,
                }))
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
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
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

export function SchedulesPage() {
  const selectedBranchId = useAppStore((state) => state.selectedBranchId)
  const [date, setDate] = useState(todayISO())
  const [open, setOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [form, setForm] = useState<ScheduleFormState>({
    branch_id: selectedBranchId ?? "",
    employee_id: "",
    work_date: date,
    start_time: "08:00",
    break_start: "12:00",
    break_end: "13:00",
    end_time: "17:00",
    status: "scheduled",
    notes: "",
  })
  const schedules = useSchedules(date)
  const employees = useEmployees(form.branch_id || selectedBranchId)
  const branches = useBranches()
  const createSchedule = useCreateSchedule()

  const activeEmployees = useMemo(
    () => (employees.data ?? []).filter((employee) => employee.active),
    [employees.data]
  )

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

    setDate(form.work_date)
    setOpen(false)
  }

  return (
    <>
      <PageHeader
        title="Escalas"
        description={`Escala planejada para ${formatDateBR(date)}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="w-40"
              type="date"
              value={date}
              onChange={(event) => {
                setDate(event.target.value)
                setForm((current) => ({
                  ...current,
                  work_date: event.target.value,
                }))
              }}
            />
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <CalendarPlus className="size-4" />
                  Nova escala
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cadastrar escala</DialogTitle>
                </DialogHeader>
                <form className="space-y-4" onSubmit={handleSubmit}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">Filial</span>
                      <select
                        className={fieldClass}
                        value={form.branch_id}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            branch_id: event.target.value,
                            employee_id: "",
                          }))
                        }
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
                      <span className="font-medium">Colaborador</span>
                      <select
                        className={fieldClass}
                        value={form.employee_id}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            employee_id: event.target.value,
                          }))
                        }
                      >
                        <option value="">Selecione</option>
                        {activeEmployees.map((employee) => (
                          <option key={employee.id} value={employee.id}>
                            {employee.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">Data</span>
                      <Input
                        type="date"
                        value={form.work_date}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            work_date: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">Status</span>
                      <select
                        className={fieldClass}
                        value={form.status}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            status: event.target.value as ScheduleStatus,
                          }))
                        }
                      >
                        {Object.entries(scheduleStatusLabel).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-4">
                    {(["start_time", "break_start", "break_end", "end_time"] as const).map(
                      (field) => (
                        <label className="space-y-1 text-sm" key={field}>
                          <span className="font-medium">
                            {
                              {
                                start_time: "Entrada",
                                break_start: "Intervalo",
                                break_end: "Retorno",
                                end_time: "Saída",
                              }[field]
                            }
                          </span>
                          <Input
                            type="time"
                            value={form[field]}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                [field]: event.target.value,
                              }))
                            }
                          />
                        </label>
                      )
                    )}
                  </div>

                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Observações</span>
                    <Input
                      value={form.notes}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          notes: event.target.value,
                        }))
                      }
                    />
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

      <div className="p-6">
        {schedules.isLoading ? (
          <StateBlock type="loading" title="Carregando escala" />
        ) : schedules.isError ? (
          <StateBlock
            type="error"
            title="Erro ao carregar escala"
            description={schedules.error.message}
          />
        ) : (schedules.data ?? []).length === 0 ? (
          <StateBlock
            title="Nenhuma escala para esta data"
            description="Cadastre a escala do dia para iniciar a operação."
          />
        ) : (
          <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-slate-50 text-xs uppercase text-muted-foreground">
                <tr>
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
                {(schedules.data ?? []).map((schedule) => (
                  <tr key={schedule.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">
                      {schedule.employees?.name ?? "-"}
                    </td>
                    <td className="px-4 py-3">
                      {schedule.employees?.sectors?.name ?? "-"}
                    </td>
                    <td className="px-4 py-3">{formatTime(schedule.start_time)}</td>
                    <td className="px-4 py-3">{formatTime(schedule.break_start)}</td>
                    <td className="px-4 py-3">{formatTime(schedule.break_end)}</td>
                    <td className="px-4 py-3">{formatTime(schedule.end_time)}</td>
                    <td className="px-4 py-3">
                      {scheduleStatusLabel[schedule.status]}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <ScheduleEditDialog schedule={schedule} />
                        <ScheduleDeleteDialog schedule={schedule} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
