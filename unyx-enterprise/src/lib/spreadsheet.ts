import { readSheet } from "read-excel-file/browser"

export type SpreadsheetRow = Record<string, unknown>

type CellValue = string | number | boolean | Date | null

export function normalizeColumn(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

function parseCsvLine(line: string) {
  const cells: string[] = []
  let current = ""
  let quoted = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]

    if (char === '"' && quoted && next === '"') {
      current += '"'
      index += 1
      continue
    }

    if (char === '"') {
      quoted = !quoted
      continue
    }

    if ((char === "," || char === ";") && !quoted) {
      cells.push(current.trim())
      current = ""
      continue
    }

    current += char
  }

  cells.push(current.trim())
  return cells
}

function rowsFromMatrix(matrix: CellValue[][]) {
  const [headerRow, ...bodyRows] = matrix

  if (!headerRow) return []

  const headers = headerRow.map((cell) => normalizeColumn(String(cell ?? "")))

  return bodyRows
    .map((row) => {
      const record: SpreadsheetRow = {}
      headers.forEach((header, index) => {
        if (header) record[header] = row[index] ?? ""
      })
      return record
    })
    .filter((row) =>
      Object.values(row).some((value) => String(value ?? "").trim().length > 0)
    )
}

export async function parseSpreadsheet(file: File) {
  const lowerName = file.name.toLowerCase()

  if (lowerName.endsWith(".csv")) {
    const text = await file.text()
    const matrix = text
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .map(parseCsvLine)

    return rowsFromMatrix(matrix)
  }

  if (lowerName.endsWith(".xlsx")) {
    const matrix = (await readSheet(file)) as CellValue[][]
    return rowsFromMatrix(matrix)
  }

  throw new Error("Formato nao suportado. Use .xlsx ou .csv.")
}

export function getCell(row: SpreadsheetRow, aliases: string[]) {
  for (const alias of aliases) {
    const value = row[normalizeColumn(alias)]
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value
    }
  }

  return ""
}

export function cellToText(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value ?? "").trim()
}

export function cellToDate(value: unknown, fallback: string) {
  if (!value) return fallback

  if (value instanceof Date) return value.toISOString().slice(0, 10)

  const text = cellToText(value)
  if (!text) return fallback

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) return isoMatch[0]

  const brMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (brMatch) {
    const [, day, month, year] = brMatch
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
  }

  return fallback
}

export function cellToTime(value: unknown) {
  if (value === null || value === undefined || value === "") return ""

  if (value instanceof Date) {
    return value.toTimeString().slice(0, 5)
  }

  if (typeof value === "number") {
    const totalMinutes = Math.round(value * 24 * 60)
    const hours = Math.floor(totalMinutes / 60) % 24
    const minutes = totalMinutes % 60
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
  }

  const text = cellToText(value)
  const match = text.match(/^(\d{1,2}):(\d{2})/)
  if (!match) return text

  const [, hours, minutes] = match
  return `${hours.padStart(2, "0")}:${minutes}`
}
