// Escala "do papel": o texto copiado de uma planilha, Word ou PDF no formato em que a escala chega —
// um bloco por dia, com o título do dia, o setor (CAIXA, FISCAL, PACOTE...) e uma linha por colaborador
// com ENTRADA, INTERVALO, RETORNO e SAÍDA (ou FOLGA).

export interface PaperRow {
  /** Linha do texto colado, para apontar problemas. */
  line: number
  /** yyyy-mm-dd */
  date: string
  section: string
  rawName: string
  /** Nome(s) candidatos: "VITORIA / ÍRIS" vira ["VITORIA", "ÍRIS"]. */
  candidates: string[]
  /** Marcações da escala, como "Cx" (fiscal no caixa) ou "Self". */
  note: string | null
  dayOff: boolean
  start: string
  breakStart: string
  breakEnd: string
  end: string
}

export interface PaperParseResult {
  rows: PaperRow[]
  warnings: string[]
}

const MONTHS: Record<string, number> = {
  janeiro: 1,
  fevereiro: 2,
  marco: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
}

const KNOWN_SECTIONS = new Set([
  "caixa",
  "fiscal",
  "pacote",
  "self",
  "padaria",
  "acougue",
  "hortifruti",
  "deposito",
  "estoque",
  "limpeza",
  "atendimento",
])

const HEADER_WORDS = new Set(["horario", "entrada", "intervalo", "retorno", "saida"])
const NOTE_MARKERS = new Set(["cx", "self"])

export function stripAccents(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "")
}

export function normalizeName(value: string) {
  return stripAccents(value).toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim()
}

/** "1120", "11:20", "11.20", "11h20", "8" ou "830" -> "HH:MM"; vazio -> ""; inválido -> null. */
export function parseTimeInput(text: string): string | null {
  const value = text.trim().toLowerCase()
  if (!value) return ""
  let hours: number
  let minutes: number
  const separated = /^(\d{1,2})[:h.](\d{2})$/.exec(value)
  const digits = /^\d{1,4}$/.exec(value)
  if (separated) {
    hours = Number(separated[1])
    minutes = Number(separated[2])
  } else if (digits) {
    if (value.length <= 2) {
      hours = Number(value)
      minutes = 0
    } else {
      hours = Number(value.slice(0, value.length - 2))
      minutes = Number(value.slice(-2))
    }
  } else {
    return null
  }
  if (hours > 23 || minutes > 59) return null
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
}

const isTimeToken = (token: string) => /^\d{1,2}[:h.]\d{2}$/i.test(token)
const isFolgaToken = (token: string) => normalizeName(token) === "folga"

function parseDayHeader(line: string): string | null {
  const match = /(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})/.exec(stripAccents(line).toLowerCase())
  if (!match) return null
  const month = MONTHS[match[2]]
  if (!month) return null
  return `${match[3]}-${String(month).padStart(2, "0")}-${match[1].padStart(2, "0")}`
}

function splitName(rawName: string) {
  const candidates: string[] = []
  const notes: string[] = []
  for (const part of rawName.split("/")) {
    const words = part.trim().split(/\s+/).filter(Boolean)
    while (words.length > 1 && NOTE_MARKERS.has(normalizeName(words[words.length - 1]))) {
      notes.unshift(words.pop()!)
    }
    if (words.length > 0) candidates.push(words.join(" "))
  }
  return { candidates, note: notes.length > 0 ? notes.join(" ") : null }
}

export function parsePaperSchedule(text: string): PaperParseResult {
  const rows: PaperRow[] = []
  const warnings: string[] = []
  let date = ""
  let section = ""

  text.split(/\r?\n/).forEach((rawLine, index) => {
    const line = rawLine.trim()
    const lineNumber = index + 1
    if (!line) return

    const header = parseDayHeader(line)
    if (header) {
      date = header
      section = ""
      return
    }

    let tokens = line.split(/\s+/).filter(Boolean)
    const notWorking = /nao\s+trabalhar/.test(stripAccents(line).toLowerCase())

    if (notWorking) {
      const cut = tokens.findIndex((token) => normalizeName(token) === "nao")
      tokens = tokens.slice(0, Math.max(0, cut))
    }

    const tail: string[] = []
    if (!notWorking) {
      while (
        tokens.length > 0 &&
        tail.length < 4 &&
        (isTimeToken(tokens[tokens.length - 1]) || isFolgaToken(tokens[tokens.length - 1]))
      ) {
        tail.unshift(tokens.pop()!)
      }
    }

    // Títulos de coluna ("HORARIO ENTRADA INTERVALO RETORNO SAIDA") não são colaboradores.
    const nameTokens = tokens.filter((token) => !HEADER_WORDS.has(normalizeName(token)))
    if (nameTokens.length === 0) return

    const rawName = nameTokens.join(" ")
    if (tail.length === 0 && !notWorking) {
      if (KNOWN_SECTIONS.has(normalizeName(rawName))) {
        section = rawName.toUpperCase()
      } else {
        warnings.push(`Linha ${lineNumber}: "${rawName}" sem horários; ignorada.`)
      }
      return
    }

    if (!date) {
      warnings.push(`Linha ${lineNumber}: "${rawName}" antes de qualquer título de dia; ignorada.`)
      return
    }

    const { candidates, note } = splitName(rawName)
    const base = { line: lineNumber, date, section, rawName, candidates }
    const dayOff = notWorking || (tail.length > 0 && tail.every(isFolgaToken))

    if (dayOff) {
      rows.push({
        ...base,
        note: notWorking ? [note, "Não trabalhar"].filter(Boolean).join(" · ") : note,
        dayOff: true,
        start: "",
        breakStart: "",
        breakEnd: "",
        end: "",
      })
      return
    }

    const times = tail.map((token) => parseTimeInput(token) ?? "")
    if (tail.some(isFolgaToken) || (times.length !== 4 && times.length !== 2)) {
      warnings.push(`Linha ${lineNumber}: "${rawName}" com horários incompletos; confira.`)
    }
    if (times.length === 2) {
      rows.push({ ...base, note, dayOff: false, start: times[0], breakStart: "", breakEnd: "", end: times[1] })
    } else {
      rows.push({
        ...base,
        note,
        dayOff: false,
        start: times[0] ?? "",
        breakStart: times[1] ?? "",
        breakEnd: times[2] ?? "",
        end: times[3] ?? "",
      })
    }
  })

  return { rows, warnings }
}

export interface EmployeeLite {
  id: string
  name: string
  branch_id: string
  active: boolean
}

export interface EmployeeMatch {
  /** Escolhido automaticamente quando há uma única possibilidade; vazio se precisa decidir. */
  employeeId: string
  /** Todos os colaboradores possíveis, para sugerir na escolha manual. */
  options: string[]
}

/** Casa o nome da escala (muitas vezes só o primeiro nome) com o cadastro da filial. */
export function matchEmployee(candidates: string[], employees: EmployeeLite[]): EmployeeMatch {
  const found: string[] = []
  let firstUnique = ""
  for (const candidate of candidates) {
    const wanted = normalizeName(candidate)
    if (!wanted) continue
    const exact = employees.filter((employee) => normalizeName(employee.name) === wanted)
    const matches =
      exact.length > 0
        ? exact
        : employees.filter((employee) => {
            const name = normalizeName(employee.name)
            return name.startsWith(`${wanted} `) || wanted.startsWith(`${name} `)
          })
    for (const employee of matches) if (!found.includes(employee.id)) found.push(employee.id)
    if (!firstUnique && matches.length === 1) firstUnique = matches[0].id
  }
  if (found.length === 1) return { employeeId: found[0], options: found }
  // "A / B" com os dois cadastrados: assume o primeiro nome e deixa a troca a um clique.
  if (candidates.length > 1 && firstUnique) return { employeeId: firstUnique, options: found }
  return { employeeId: "", options: found }
}

const toMinutes = (value: string) => {
  const [hours, minutes] = value.split(":").map(Number)
  return hours * 60 + minutes
}

/** Mesma regra do cadastro: entrada < saída p/ intervalo < retorno < saída. */
export function validateTimes(row: {
  dayOff: boolean
  start: string
  breakStart: string
  breakEnd: string
  end: string
}): string | null {
  if (row.dayOff) return null
  if (!row.start || !row.end) return "Informe a entrada e a saída."
  if (Boolean(row.breakStart) !== Boolean(row.breakEnd)) {
    return "Informe a saída e o retorno do intervalo, ou nenhum."
  }
  const ordered = [row.start, row.breakStart, row.breakEnd, row.end].filter(Boolean).map(toMinutes)
  for (let index = 1; index < ordered.length; index += 1) {
    if (ordered[index] <= ordered[index - 1]) return "Os horários precisam estar em ordem crescente."
  }
  return null
}
