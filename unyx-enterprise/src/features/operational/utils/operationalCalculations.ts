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

export function nowMinutes(): number {
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes()
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
