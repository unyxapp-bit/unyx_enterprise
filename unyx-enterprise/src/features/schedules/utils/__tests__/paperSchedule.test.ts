import { describe, expect, it } from "vitest"

import { matchEmployee, parsePaperSchedule, parseTimeInput, validateTimes } from "../paperSchedule"

const sheet = [
  "segunda-feira, 2 de novembro de 2026\tHORARIO",
  "CAIXA\tENTRADA\tINTERVALO\tRETORNO\tSAIDA",
  "FRANCIELLY\t07:40\t11:20\t13:20\t16:40",
  "VITORIA / ÍRIS\t11:20\t13:20\t15:20\t20:20",
  "FISCAL\tENTRADA\tINTERVALO\tRETORNO\tSAIDA",
  "PEDRO\tNÃO TRABALHAR",
  "MARCO Cx\t07:40\t11:40\t13:40\t16:40",
  "terça-feira, 3 de novembro de 2026\tHORARIO",
  "CAIXA",
  "RENATA\tFOLGA\tFOLGA\tFOLGA\tFOLGA",
  "MARIA EDUARDA 12:20 16:30 17:30 21:20",
  "DOMINGO 07:50 13:20",
].join("\n")

describe("parsePaperSchedule", () => {
  const { rows, warnings } = parsePaperSchedule(sheet)

  it("lê o dia, o setor e os quatro horários de cada colaborador", () => {
    expect(rows[0]).toMatchObject({
      date: "2026-11-02",
      section: "CAIXA",
      rawName: "FRANCIELLY",
      start: "07:40",
      breakStart: "11:20",
      breakEnd: "13:20",
      end: "16:40",
      dayOff: false,
    })
  })

  it("guarda os nomes de substituição e as marcações da escala", () => {
    expect(rows[1].candidates).toEqual(["VITORIA", "ÍRIS"])
    const marco = rows.find((row) => row.rawName.startsWith("MARCO"))!
    expect(marco).toMatchObject({ candidates: ["MARCO"], note: "Cx", section: "FISCAL" })
  })

  it("trata FOLGA e NÃO TRABALHAR como folga", () => {
    const pedro = rows.find((row) => row.rawName === "PEDRO")!
    expect(pedro).toMatchObject({ dayOff: true, note: "Não trabalhar", date: "2026-11-02" })
    const renata = rows.find((row) => row.rawName === "RENATA")!
    expect(renata).toMatchObject({ dayOff: true, date: "2026-11-03", section: "CAIXA" })
  })

  it("aceita texto separado por espaços e nomes com mais de uma palavra", () => {
    const maria = rows.find((row) => row.rawName === "MARIA EDUARDA")!
    expect(maria).toMatchObject({ start: "12:20", breakStart: "16:30", end: "21:20", date: "2026-11-03" })
  })

  it("aceita entrada e saída sem intervalo", () => {
    const row = rows.find((item) => item.rawName === "DOMINGO")!
    expect(row).toMatchObject({ start: "07:50", end: "13:20", breakStart: "", breakEnd: "" })
  })

  it("ignora títulos de coluna e não gera aviso para eles", () => {
    expect(rows.some((row) => /horario|entrada/i.test(row.rawName))).toBe(false)
    expect(warnings).toEqual([])
  })

  it("avisa de linhas sem horário ou antes do primeiro dia", () => {
    const result = parsePaperSchedule(
      "JOAO 08:00 12:00 14:00 18:00\nsexta-feira, 6 de novembro de 2026\nSOZINHO"
    )
    expect(result.rows).toHaveLength(0)
    expect(result.warnings).toHaveLength(2)
  })
})

describe("parseTimeInput", () => {
  it.each([
    ["1120", "11:20"],
    ["830", "08:30"],
    ["8", "08:00"],
    ["11:20", "11:20"],
    ["7h40", "07:40"],
    ["", ""],
  ])("%s -> %s", (input, expected) => {
    expect(parseTimeInput(input)).toBe(expected)
  })

  it("rejeita horário inválido", () => {
    expect(parseTimeInput("2560")).toBeNull()
    expect(parseTimeInput("abc")).toBeNull()
  })
})

describe("matchEmployee", () => {
  const employees = [
    { id: "1", name: "FRANCIELLY SOUZA", branch_id: "b", active: true },
    { id: "2", name: "MARCO AURELIO", branch_id: "b", active: true },
    { id: "3", name: "IRIS LIMA", branch_id: "b", active: true },
    { id: "4", name: "JOAO SILVA", branch_id: "b", active: true },
    { id: "5", name: "JOAO PEDRO", branch_id: "b", active: true },
  ]

  it("casa o primeiro nome com o cadastro completo", () => {
    expect(matchEmployee(["FRANCIELLY"], employees)).toEqual({ employeeId: "1", options: ["1"] })
    expect(matchEmployee(["MARCO"], employees).employeeId).toBe("2")
  })

  it("ignora acentos e maiúsculas", () => {
    expect(matchEmployee(["Íris"], employees).employeeId).toBe("3")
  })

  it("deixa para escolher quando há mais de um com o mesmo nome", () => {
    expect(matchEmployee(["JOAO"], employees)).toEqual({ employeeId: "", options: ["4", "5"] })
  })

  it("não encontra quem não está no cadastro", () => {
    expect(matchEmployee(["OPERADOR CAXAMBU"], employees)).toEqual({ employeeId: "", options: [] })
  })

  it("em substituição 'A / B' usa o primeiro cadastrado", () => {
    expect(matchEmployee(["MARCO", "ÍRIS"], employees)).toEqual({
      employeeId: "2",
      options: ["2", "3"],
    })
  })
})

describe("validateTimes", () => {
  it("exige ordem crescente e intervalo completo", () => {
    expect(validateTimes({ dayOff: false, start: "08:00", breakStart: "11:20", breakEnd: "13:20", end: "17:00" })).toBeNull()
    expect(validateTimes({ dayOff: false, start: "08:00", breakStart: "", breakEnd: "", end: "17:00" })).toBeNull()
    expect(validateTimes({ dayOff: false, start: "08:00", breakStart: "11:20", breakEnd: "", end: "17:00" })).toMatch(/intervalo/)
    expect(validateTimes({ dayOff: false, start: "08:00", breakStart: "13:00", breakEnd: "12:00", end: "17:00" })).toMatch(/ordem/)
    expect(validateTimes({ dayOff: true, start: "", breakStart: "", breakEnd: "", end: "" })).toBeNull()
  })
})
