type ScheduleDateLike = {
  work_date: string
}

function toDateInput(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function parseLocalDate(date: string) {
  return new Date(`${date}T12:00:00`)
}

export function getScheduleLookbackRange(targetDate: string, days = 30) {
  const end = parseLocalDate(targetDate)
  end.setDate(end.getDate() - 1)

  const start = parseLocalDate(targetDate)
  start.setDate(start.getDate() - days)

  return {
    dateFrom: toDateInput(start),
    dateTo: toDateInput(end),
  }
}

export function findLatestScheduleSourceDate<T extends ScheduleDateLike>(
  schedules: T[],
  targetDate: string
) {
  const dates = schedules
    .map((schedule) => schedule.work_date)
    .filter((date) => date && date < targetDate)
    .sort((a, b) => b.localeCompare(a))

  return dates[0] ?? null
}

export function countSchedulesForDate<T extends ScheduleDateLike>(
  schedules: T[],
  workDate: string | null
) {
  if (!workDate) return 0
  return schedules.filter((schedule) => schedule.work_date === workDate).length
}
