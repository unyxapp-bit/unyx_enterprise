import { timeToMinutes } from "@/features/operational/utils/operationalCalculations"

const DAY_MINUTES = 24 * 60

export interface ShiftTimes {
  start_time?: string | null
  break_start?: string | null
  break_end?: string | null
  end_time?: string | null
}

/** Minutos desde 00:00 do dia da escala. Valores a partir de 1440 já são do dia seguinte. */
export interface ShiftTimeline {
  start: number | null
  breakStart: number | null
  breakEnd: number | null
  end: number | null
}

/**
 * Coloca os horários da escala na ordem em que acontecem: entrada, intervalo, retorno e saída.
 * Todo horário que "volta" no relógio em relação ao anterior é do dia seguinte (soma 24h), então
 * um turno 18:00 → 02:00 com intervalo 00:30 funciona sem informar nenhuma outra data.
 */
export function shiftTimeline(shift: ShiftTimes | null | undefined): ShiftTimeline {
  const raw = [
    timeToMinutes(shift?.start_time),
    timeToMinutes(shift?.break_start),
    timeToMinutes(shift?.break_end),
    timeToMinutes(shift?.end_time),
  ]
  const start = raw[0]
  const result: Array<number | null> = []
  let previous: number | null = null

  raw.forEach((value, index) => {
    if (value === null) {
      result.push(null)
      return
    }
    let next = value
    if (previous !== null) {
      while (next < previous) next += DAY_MINUTES
      // Saída igual à entrada (sem outros horários no meio) é um turno de 24h.
      if (index === 3 && start !== null && value === start && previous === start) next += DAY_MINUTES
    }
    result.push(next)
    previous = next
  })

  return { start: result[0], breakStart: result[1], breakEnd: result[2], end: result[3] }
}

/** 0 = no próprio dia da escala; 1 = no dia seguinte. */
export function dayOffsetOf(minutes: number | null): number {
  return minutes === null ? 0 : Math.floor(minutes / DAY_MINUTES)
}

function parseDateKey(dateKey: string): Date | null {
  const [year, month, day] = dateKey.split("-").map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const base = parseDateKey(dateKey)
  if (!base) return dateKey
  base.setDate(base.getDate() + days)
  const month = String(base.getMonth() + 1).padStart(2, "0")
  const day = String(base.getDate()).padStart(2, "0")
  return `${base.getFullYear()}-${month}-${day}`
}

/** "04/11" do dia da escala somado ao deslocamento. */
export function shortDateLabel(workDate: string, offsetDays: number): string {
  const [, month, day] = addDaysToDateKey(workDate, offsetDays).split("-")
  return `${day}/${month}`
}

/** Minutos entre 00:00 do dia da escala e `now` (pode passar de 1440 depois da meia-noite). */
export function minutesSinceWorkDate(workDate: string, now: Date): number | null {
  const base = parseDateKey(workDate)
  if (!base) return null
  return Math.round((now.getTime() - base.getTime()) / 60_000)
}

/** A escala está em andamento? Sem horário de saída, vale a partir da entrada e até o fim do dia. */
export function isShiftRunning(
  shift: ShiftTimes | null | undefined,
  workDate: string | null | undefined,
  now: Date
): boolean {
  if (!workDate) return false
  const elapsed = minutesSinceWorkDate(workDate, now)
  if (elapsed === null) return false
  const { start, end } = shiftTimeline(shift)
  if (start !== null && elapsed < start) return false
  const limit = end ?? DAY_MINUTES
  return elapsed <= limit
}

/**
 * Turno do dia anterior que atravessou a meia-noite e ainda não terminou. Fica de fora quem
 * trabalhou só no dia anterior: esses não aparecem na operação de hoje.
 */
export function isOvernightStillRunning(
  shift: ShiftTimes | null | undefined,
  workDate: string | null | undefined,
  now: Date
): boolean {
  if (!workDate) return false
  const { end } = shiftTimeline(shift)
  if (end === null || end < DAY_MINUTES) return false
  return isShiftRunning(shift, workDate, now)
}
