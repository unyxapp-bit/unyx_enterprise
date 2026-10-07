type Row = Record<string, string | number | boolean | null | undefined>

function escapeCsv(value: string | number | boolean | null | undefined, delimiter: string): string {
  if (value == null) return ""
  const str = String(value)
  if (str.includes(delimiter) || /["\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

export function buildCsv(
  rows: Row[],
  headers: { key: string; label: string }[],
  delimiter = ","
): string {
  const headerRow = headers.map((h) => escapeCsv(h.label, delimiter)).join(delimiter)
  const dataRows = rows.map((row) =>
    headers.map((h) => escapeCsv(row[h.key], delimiter)).join(delimiter)
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
