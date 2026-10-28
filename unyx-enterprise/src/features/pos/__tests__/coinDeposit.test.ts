import { describe, expect, it } from "vitest"

import {
  depositCode,
  formatDateTimeFull,
  formatPhone,
  localInputToIso,
  phoneDigits,
  toLocalInputValue,
} from "../coinDeposit"

describe("formatPhone", () => {
  it("aplica a máscara de celular e de fixo", () => {
    expect(formatPhone("11987654321")).toBe("(11) 98765-4321")
    expect(formatPhone("1134567890")).toBe("(11) 3456-7890")
    expect(formatPhone("(11) 98765-4321")).toBe("(11) 98765-4321")
  })

  it("formata enquanto digita e ignora o que não é número", () => {
    expect(formatPhone("1")).toBe("(1")
    expect(formatPhone("119")).toBe("(11) 9")
    expect(formatPhone("1198765")).toBe("(11) 9876-5")
    expect(formatPhone("abc")).toBe("")
    expect(phoneDigits("(11) 98765-4321 99")).toBe("11987654321")
  })
})

describe("depositCode", () => {
  it("usa os 8 primeiros caracteres do id, em maiúsculas", () => {
    expect(depositCode("3f2a9c1e-1234-4abc-8def-001122334455")).toBe("3F2A9C1E")
  })
})

describe("data e hora", () => {
  it("formata em dd/mm/aaaa hh:mm", () => {
    expect(formatDateTimeFull(new Date(2026, 9, 27, 14, 5).toISOString())).toBe("27/10/2026 14:05")
    expect(formatDateTimeFull("não é data")).toBe("—")
  })

  it("converte entre o campo datetime-local e o ISO sem mudar o horário", () => {
    const local = new Date(2026, 9, 27, 9, 30)
    const input = toLocalInputValue(local)
    expect(input).toBe("2026-10-27T09:30")
    expect(localInputToIso(input)).toBe(local.toISOString())
    expect(localInputToIso("")).toBeNull()
  })
})
