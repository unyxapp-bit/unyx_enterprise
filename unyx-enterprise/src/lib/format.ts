export function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export function formatDateBR(value: string | null | undefined) {
  if (!value) return "-"

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`))
}

export function formatDateTimeBR(value: string | null | undefined) {
  if (!value) return "-"

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

export function formatTime(value: string | null | undefined) {
  if (!value) return "-"

  return value.slice(0, 5)
}

export function minutesLabel(value: number) {
  if (value === 0) return "0 min"
  return `${value} min`
}
