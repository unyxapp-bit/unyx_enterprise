import { useMemo, useState } from "react"
import type { FormEvent } from "react"
import { Activity, History } from "lucide-react"

import { StatusBadge } from "@/components/bento/StatusBadge"
import { PageHeader } from "@/components/shared/PageHeader"
import { StateBlock } from "@/components/shared/StateBlock"
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
  useAttendanceEvents,
  useOperationalStatuses,
  useRecordOperationalEvent,
  useSchedules,
} from "@/hooks/useUnyxData"
import { formatDateTimeBR, formatTime, todayISO } from "@/lib/format"
import { eventLabel, operationalActions } from "@/lib/status"
import type {
  AttendanceEventType,
  OperationalStatusRecord,
  ScheduleWithRelations,
} from "@/types/domain"

export function OperationsPage() {
  const [date, setDate] = useState(todayISO())
  const [occurrenceSchedule, setOccurrenceSchedule] =
    useState<ScheduleWithRelations | null>(null)
  const [occurrenceNote, setOccurrenceNote] = useState("")
  const [occurrenceError, setOccurrenceError] = useState<string | null>(null)
  const schedules = useSchedules(date)
  const statuses = useOperationalStatuses()
  const events = useAttendanceEvents()
  const recordEvent = useRecordOperationalEvent()

  const statusByScheduleId = useMemo(() => {
    const map = new Map<string, OperationalStatusRecord>()

    for (const status of statuses.data ?? []) {
      if (status.schedule_id) map.set(status.schedule_id, status)
    }

    return map
  }, [statuses.data])

  async function handleAction(
    schedule: ScheduleWithRelations,
    eventType: AttendanceEventType
  ) {
    await recordEvent.mutateAsync({
      branch_id: schedule.branch_id,
      employee_id: schedule.employee_id,
      schedule_id: schedule.id,
      event_type: eventType,
      notes: eventLabel[eventType],
    })
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
        title="Operação do Dia"
        description="Registro real de eventos e status dos colaboradores."
        action={
          <Input
            className="w-40"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
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
            {schedules.isLoading || statuses.isLoading ? (
              <StateBlock type="loading" title="Carregando operação" />
            ) : schedules.isError ? (
              <StateBlock
                type="error"
                title="Erro ao carregar operação"
                description={schedules.error.message}
              />
            ) : (schedules.data ?? []).length === 0 ? (
              <StateBlock
                title="Sem escala para operar"
                description="Cadastre a escala do dia antes de registrar eventos."
              />
            ) : (
              <div className="grid gap-3">
                {(schedules.data ?? []).map((schedule) => {
                  const status = statusByScheduleId.get(schedule.id)

                  return (
                    <div
                      key={schedule.id}
                      className="rounded-lg border bg-white p-4 shadow-sm"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="text-base font-medium">
                            {schedule.employees?.name ?? "Colaborador"}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {schedule.employees?.sectors?.name ?? "Sem setor"} ·{" "}
                            {schedule.branches?.name ?? "Filial"}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                            <span>Entrada {formatTime(schedule.start_time)}</span>
                            <span>Intervalo {formatTime(schedule.break_start)}</span>
                            <span>Retorno {formatTime(schedule.break_end)}</span>
                            <span>Saída {formatTime(schedule.end_time)}</span>
                          </div>
                        </div>
                        {status ? (
                          <StatusBadge status={status.current_status} />
                        ) : (
                          <span className="inline-flex h-5 w-fit items-center rounded-full border border-slate-200 bg-slate-50 px-2 text-xs font-medium text-slate-600">
                            Aguardando evento
                          </span>
                        )}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {operationalActions
                          .filter(
                            (action) =>
                              action.eventType !== "ocorrencia_registrada"
                          )
                          .map((action) => (
                          <Button
                            key={action.eventType}
                            variant={
                              action.eventType === "atraso_detectado" ||
                              action.eventType === "falta_detectada"
                                ? "destructive"
                                : "outline"
                            }
                            size="sm"
                            disabled={recordEvent.isPending}
                            onClick={() => void handleAction(schedule, action.eventType)}
                          >
                            {action.label}
                          </Button>
                        ))}
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={recordEvent.isPending}
                          onClick={() => setOccurrenceSchedule(schedule)}
                        >
                          Ocorrência
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
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
