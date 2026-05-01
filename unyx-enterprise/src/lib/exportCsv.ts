type Row = Record<string, string | number | boolean | null | undefined>

function escapeCsv(value: string | number | boolean | null | undefined): string {
  if (value == null) return ""
  const str = String(value)
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

export function buildCsv(rows: Row[], headers: { key: string; label: string }[]): string {
  const headerRow = headers.map((h) => escapeCsv(h.label)).join(",")
  const dataRows = rows.map((row) =>
    headers.map((h) => escapeCsv(row[h.key])).join(",")
  )
  return [headerRow, ...dataRows].join("\r\n")
}

export function downloadCsv(csv: string, filename: string) {
  const bom = "﻿"
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
