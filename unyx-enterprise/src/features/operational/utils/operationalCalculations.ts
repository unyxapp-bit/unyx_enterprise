/**
 * Operacional Calculations - Funções de cálculo de tempo e duração
 */

export const DEFAULT_BREAK_TOLERANCE_MINUTES = 15
export const CRITICAL_BREAK_TOLERANCE_MINUTES = 20

export function timeToMinutes(time: string | null | undefined): number | null {
  if (!time) return null
  const [h, m] = time.split(":").map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  const pad = (v: number) => String(v).padStart(2, "0")
  return `${pad(h)}:${pad(m)}`
}

export function ensureScheduleEndAfter(
  referenceTime: string,
  currentEndTime: string | null | undefined
): string {
  const referenceMin = timeToMinutes(referenceTime)
  if (referenceMin === null) {
    return currentEndTime ?? referenceTime
  }

  const endMin = timeToMinutes(currentEndTime)
  if (endMin !== null && endMin > referenceMin) {
    return currentEndTime ?? referenceTime
  }

  return minutesToTime(referenceMin + 1)
}

export function nowMinutes(): number {
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes()
}

/** "HH:MM" de um dia (yyyy-mm-dd) no fuso local -> ISO. */
export function isoFromDayAndTime(dateKey: string, hhmm: string): string {
  const [year, month, day] = dateKey.split("-").map(Number)
  const [hours, minutes] = hhmm.split(":").map(Number)
  return new Date(year, month - 1, day, hours, minutes).toISOString()
}

export function localDateKey(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function operationalMinutesForDate(
  selectedDate: string,
  currentMinutes = nowMinutes(),
  today = localDateKey()
): number {
  if (selectedDate > today) return -1
  if (selectedDate < today) return 24 * 60
  return currentMinutes
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h ${m}min`
}

export function calculateBreakProgress(
  breakStartMin: number | null,
  breakEndMin: number | null,
  currentMinutes: number
): {
  elapsed: number
  duration: number
  percentage: number
  isOverdue: boolean
} {
  if (breakStartMin === null || breakEndMin === null) {
    return { elapsed: 0, duration: 0, percentage: 0, isOverdue: false }
  }

  const duration = Math.max(0, breakEndMin - breakStartMin)
  const elapsed = Math.max(0, currentMinutes - breakStartMin)
  const percentage = Math.min(100, Math.round((elapsed / duration) * 100))
  const isOverdue = currentMinutes > breakEndMin

  return { elapsed, duration, percentage, isOverdue }
}

export function isLateForBreak(
  scheduledBreakStartMin: number | null,
  currentMinutes: number,
  toleranceMinutes = DEFAULT_BREAK_TOLERANCE_MINUTES
): boolean {
  if (scheduledBreakStartMin === null) return false
  return currentMinutes > scheduledBreakStartMin + toleranceMinutes
}

export function calculateTimeWorked(
  startTimeMin: number | null,
  currentMinutes: number,
  hasEntered: boolean
): number | null {
  if (!hasEntered || startTimeMin === null || currentMinutes <= startTimeMin) {
    return null
  }
  return currentMinutes - startTimeMin
}

export function calculateTimeUntilBreak(
  breakStartMin: number | null,
  currentMinutes: number,
  breakDone: boolean
): number | null {
  if (breakDone || breakStartMin === null || currentMinutes >= breakStartMin) {
    return null
  }
  return breakStartMin - currentMinutes
}

export function isBreakDone(
  breakEndMin: number | null,
  currentMinutes: number,
  notes: string | null
): boolean {
  if (notes?.includes("lunch_done")) return true
  if (breakEndMin === null) return false
  return currentMinutes > breakEndMin
}

export function addNoteMarker(current: string | null, marker: string): string {
  if (!current) return marker
  if (current.includes(marker)) return current
  return `${current},${marker}`
}

export function removeNoteMarker(current: string | null, marker: string): string | null {
  if (!current) return null
  const cleaned = current
    .split(",")
    .filter((m) => m.trim() !== marker)
    .join(",")
  return cleaned || null
}

interface ScheduleWindow {
  work_date?: string | null
  start_time?: string | null
  end_time?: string | null
}

/** Momento (hora local) em que a escala termina; considera turnos que passam da meia-noite. */
export function scheduleEndDate(schedule: ScheduleWindow | null | undefined): Date | null {
  if (!schedule?.work_date || !schedule.end_time) return null
  const [year, month, day] = schedule.work_date.split("-").map(Number)
  const end = timeToMinutes(schedule.end_time)
  if (!year || !month || !day || end === null) return null
  const start = timeToMinutes(schedule.start_time)
  const crossesMidnight = start !== null && end <= start
  return new Date(year, month - 1, day + (crossesMidnight ? 1 : 0), Math.floor(end / 60), end % 60)
}

/**
 * Minutos desde `startedAt`, sem passar do fim da escala: quem já tinha horário de saída e ainda não
 * foi registrado como "saiu" não continua acumulando tempo depois do horário da escala.
 */
export function minutesWorkedUntil(
  startedAt: string | null | undefined,
  schedule: ScheduleWindow | null | undefined,
  nowMs: number
): number {
  if (!startedAt) return 0
  const startedMs = new Date(startedAt).getTime()
  if (Number.isNaN(startedMs)) return 0
  const endMs = scheduleEndDate(schedule)?.getTime()
  const limit = endMs !== undefined && nowMs > endMs ? endMs : nowMs
  return Math.max(0, Math.floor((limit - startedMs) / 60_000))
}
