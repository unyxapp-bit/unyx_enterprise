import { useMemo, useState } from "react"
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
                        {operationalActions.map((action) => (
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
    </>
  )
}
