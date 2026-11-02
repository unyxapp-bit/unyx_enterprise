import { scheduleEndDate, timeToMinutes } from "@/features/operational/utils"
import type { AttendanceEvent, OperationalBreak, RecordSource, Schedule } from "@/types/domain"

// Conferência conforme a escala: o que a escala previa e ninguém registrou é confirmado no horário da
// escala; o fiscal corrige depois só o que fugiu dela. Estas funções montam o que a tela mostra.

/** Folga antes de confirmar o dia de hoje: quem está na loja ainda pode registrar na hora. */
export const AUTO_CONFIRM_GRACE_TODAY_MINUTES = 120
/** Quantos dias para trás a abertura do mapa confere. */
export const RECONCILE_DAYS_BACK = 7

export type RecordOrigin = RecordSource | "pendente"

export interface ReconciliationCell {
  /** "HH:MM" no fuso do navegador, ou null se não há registro. */
  time: string | null
  origin: RecordOrigin
}

export interface ReconciliationRow {
  absent: boolean
  arrival: ReconciliationCell
  breakStart: ReconciliationCell
  breakEnd: ReconciliationCell
  exit: ReconciliationCell
  /** Minutos de atraso na chegada em relação à escala. */
  delayMinutes: number
}

export const originLabel: Record<RecordOrigin, string> = {
  manual: "Registrado",
  escala: "Conforme escala",
  retroativo: "Informado depois",
  pendente: "Sem registro",
}

export function hhmm(iso: string | null | undefined) {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function trimTime(value: string | null | undefined) {
  return value ? value.slice(0, 5) : ""
}

function atTime(workDate: string, time: string | null | undefined) {
  const minutes = timeToMinutes(time)
  if (minutes === null) return null
  const [year, month, day] = workDate.split("-").map(Number)
  return new Date(year, month - 1, day, Math.floor(minutes / 60), minutes % 60)
}

function cellFromEvent(event: AttendanceEvent | undefined): ReconciliationCell {
  if (!event) return { time: null, origin: "pendente" }
  return { time: hhmm(event.event_time), origin: event.source ?? "manual" }
}

function lastEvent(events: AttendanceEvent[], type: AttendanceEvent["event_type"]) {
  return events.filter((event) => event.event_type === type).at(-1)
}

export function deriveReconciliationRow(
  schedule: Pick<Schedule, "id" | "work_date" | "start_time" | "status">,
  events: AttendanceEvent[],
  breaks: OperationalBreak[]
): ReconciliationRow {
  const own = events.filter((event) => event.schedule_id === schedule.id)
  const arrivalEvent = lastEvent(own, "entrada_confirmada")
  const exitEvent = lastEvent(own, "saida_confirmada")
  const breakRow = breaks
    .filter(
      (item) =>
        item.schedule_id === schedule.id &&
        item.break_type === "intervalo" &&
        item.status !== "cancelado"
    )
    .at(-1)

  const breakStart: ReconciliationCell = breakRow?.actual_start
    ? { time: hhmm(breakRow.actual_start), origin: breakRow.source ?? "manual" }
    : cellFromEvent(lastEvent(own, "intervalo_iniciado"))
  const breakEnd: ReconciliationCell = breakRow?.actual_end
    ? { time: hhmm(breakRow.actual_end), origin: breakRow.source ?? "manual" }
    : cellFromEvent(lastEvent(own, "retorno_confirmado"))

  const arrival = cellFromEvent(arrivalEvent)
  const scheduledStart = atTime(schedule.work_date, schedule.start_time)
  const delayMinutes =
    arrivalEvent && scheduledStart
      ? Math.max(
          0,
          Math.round((new Date(arrivalEvent.event_time).getTime() - scheduledStart.getTime()) / 60_000)
        )
      : 0

  return {
    absent: schedule.status === "absent",
    arrival,
    breakStart,
    breakEnd,
    exit: cellFromEvent(exitEvent),
    delayMinutes,
  }
}

export interface CorrectionFormState {
  outcome: "compareceu" | "faltou"
  arrival: string
  breakStart: string
  breakEnd: string
  exit: string
}

/** Valores iniciais da correção: o que consta no sistema; na falta de registro, o da escala. */
export function defaultCorrectionForm(
  schedule: Pick<Schedule, "start_time" | "break_start" | "break_end" | "end_time">,
  row: ReconciliationRow
): CorrectionFormState {
  return {
    outcome: row.absent ? "faltou" : "compareceu",
    arrival: row.arrival.time ?? trimTime(schedule.start_time),
    breakStart: row.breakStart.time ?? trimTime(schedule.break_start),
    breakEnd: row.breakEnd.time ?? trimTime(schedule.break_end),
    exit: row.exit.time ?? trimTime(schedule.end_time),
  }
}

const NON_WORKING = new Set(["cancelled", "day_off", "banked_hours", "absent"])

/**
 * Quando a escala do dia termina (a última saída prevista). O relatório do dia só é gerado depois disso.
 * Sem ninguém escalado trabalhando, o dia não tem o que esperar.
 */
export function dayClosure(
  schedules: Array<Pick<Schedule, "work_date" | "start_time" | "end_time" | "status">>,
  now: Date
) {
  let closesAt: Date | null = null
  for (const schedule of schedules) {
    if (NON_WORKING.has(schedule.status)) continue
    const end = scheduleEndDate(schedule)
    if (end && (!closesAt || end > closesAt)) closesAt = end
  }
  return { closesAt, closed: closesAt === null || now >= closesAt }
}

export function summarizeReconciliation(result: {
  arrivals: number
  breaks: number
  returns: number
  exits: number
}) {
  const parts: string[] = []
  const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`
  if (result.arrivals) parts.push(plural(result.arrivals, "entrada", "entradas"))
  if (result.breaks) parts.push(plural(result.breaks, "intervalo", "intervalos"))
  if (result.returns) parts.push(plural(result.returns, "retorno", "retornos"))
  if (result.exits) parts.push(plural(result.exits, "saída", "saídas"))
  return parts.join(", ")
}
