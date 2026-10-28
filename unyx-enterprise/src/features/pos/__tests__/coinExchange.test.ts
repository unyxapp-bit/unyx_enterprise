import { describe, expect, it } from "vitest"

import {
  calculateCoinExchange,
  DEFAULT_COIN_RATES,
  parseMoneyToCents,
  sanitizeCents,
  sanitizeRates,
} from "../coinExchange"

describe("calculateCoinExchange", () => {
  it("aplica 10% em 5 e 10 centavos e 5% em 25, 50 centavos e 1 real, sobre o valor informado", () => {
    // Valores em reais por tipo de moeda: R$ 5, 10, 25, 50 e 100.
    const result = calculateCoinExchange(
      { c5: 500, c10: 1000, c25: 2500, c50: 5000, r1: 10000 },
      DEFAULT_COIN_RATES
    )
    const byId = Object.fromEntries(result.lines.map((line) => [line.id, line]))

    expect(byId.c5.bonusCents).toBe(50)
    expect(byId.c5.totalCents).toBe(550)
    expect(byId.c10.totalCents).toBe(1100)
    expect(byId.c25.bonusCents).toBe(125)
    expect(byId.c25.totalCents).toBe(2625)
    expect(byId.c50.totalCents).toBe(5250)
    expect(byId.r1.totalCents).toBe(10500)

    expect(result.faceCents).toBe(19000)
    expect(result.bonusCents).toBe(1025)
    expect(result.totalCents).toBe(20025)
  })

  it("confere com a ficha de papel da loja (27/10/2026): vale de R$ 53,96", () => {
    // Esquerda (10%): 0,05 = 75,40 e 0,10 = 139,10. Direita (5%): 0,25 = 255,25; 0,50 = 305,00; 1,00 = 90,00.
    const result = calculateCoinExchange(
      { c5: 7540, c10: 13910, c25: 25525, c50: 30500, r1: 9000 },
      DEFAULT_COIN_RATES
    )
    expect(result.bonusByRate).toEqual([
      { rate: 10, faceCents: 21450, bonusCents: 2145 },
      { rate: 5, faceCents: 65025, bonusCents: 3251 },
    ])
    expect(result.bonusCents).toBe(5396)
  })

  it("soma o acréscimo separado por percentual (10% e 5%)", () => {
    // 10%: R$ 5 + R$ 10 = R$ 15 -> R$ 1,50. 5%: R$ 25 + R$ 50 + R$ 100 = R$ 175 -> R$ 8,75.
    const result = calculateCoinExchange(
      { c5: 500, c10: 1000, c25: 2500, c50: 5000, r1: 10000 },
      DEFAULT_COIN_RATES
    )
    expect(result.bonusByRate).toEqual([
      { rate: 10, faceCents: 1500, bonusCents: 150 },
      { rate: 5, faceCents: 17500, bonusCents: 875 },
    ])
    expect(result.bonusByRate.reduce((sum, group) => sum + group.bonusCents, 0)).toBe(
      result.bonusCents
    )
    // Sem valor informado, não há grupos; percentuais iguais se juntam.
    expect(calculateCoinExchange({}, DEFAULT_COIN_RATES).bonusByRate).toEqual([])
    const same = calculateCoinExchange({ c5: 100, r1: 100 }, { ...DEFAULT_COIN_RATES, r1: 10 })
    expect(same.bonusByRate).toEqual([{ rate: 10, faceCents: 200, bonusCents: 20 }])
  })

  it("R$ 1,00 em moedas de 10 centavos rende R$ 1,10 e equivale a 10 moedas", () => {
    const result = calculateCoinExchange({ c10: 100 }, DEFAULT_COIN_RATES)
    const line = result.lines.find((item) => item.id === "c10")!
    expect(line.quantity).toBe(10)
    expect(line.exact).toBe(true)
    expect(result.totalCents).toBe(110)
    expect(result.coinCount).toBe(10)
  })

  it("separa em pacotes: R$ 20,60 em moedas de 10 centavos = 4 pacotes de R$ 5,00 + R$ 0,60", () => {
    const result = calculateCoinExchange({ c10: 2060 }, DEFAULT_COIN_RATES)
    const line = result.lines.find((item) => item.id === "c10")!
    expect(line.packCents).toBe(500)
    expect(line.packs).toBe(4)
    expect(line.looseCents).toBe(60)
    expect(line.quantity).toBe(206)
  })

  it("usa o pacote de cada tipo: 2,50 / 5,00 / 5,00 / 10,00 / 20,00", () => {
    const result = calculateCoinExchange(
      { c5: 250, c10: 500, c25: 500, c50: 1000, r1: 2000 },
      DEFAULT_COIN_RATES
    )
    expect(result.lines.map((line) => line.packs)).toEqual([1, 1, 1, 1, 1])
    expect(result.packCount).toBe(5)
    expect(result.looseCents).toBe(0)
    // Metade de um pacote fica toda solta.
    const half = calculateCoinExchange({ r1: 1000 }, DEFAULT_COIN_RATES)
    expect(half.packCount).toBe(0)
    expect(half.looseCents).toBe(1000)
  })

  it("avisa quando o valor não fecha em moedas inteiras", () => {
    // R$ 1,05 em moedas de 10 centavos: 10 moedas e sobram 5 centavos.
    const result = calculateCoinExchange({ c10: 105 }, DEFAULT_COIN_RATES)
    const line = result.lines.find((item) => item.id === "c10")!
    expect(line.exact).toBe(false)
    expect(line.quantity).toBe(10)
    expect(result.allExact).toBe(false)
  })

  it("arredonda o acréscimo ao centavo por tipo de moeda", () => {
    // R$ 0,15 em moedas de 5c; 10% = 1,5c -> 2c
    const result = calculateCoinExchange({ c5: 15 }, DEFAULT_COIN_RATES)
    expect(result.bonusCents).toBe(2)
    expect(result.totalCents).toBe(17)
  })

  it("sem valores o total é zero e tudo fecha", () => {
    const result = calculateCoinExchange({}, DEFAULT_COIN_RATES)
    expect(result.coinCount).toBe(0)
    expect(result.totalCents).toBe(0)
    expect(result.allExact).toBe(true)
  })

  it("percentuais personalizados e valores negativos são tratados", () => {
    const result = calculateCoinExchange({ c50: 500, r1: -400 }, { ...DEFAULT_COIN_RATES, c50: 20 })
    expect(result.lines.find((line) => line.id === "c50")?.totalCents).toBe(600)
    expect(result.lines.find((line) => line.id === "r1")?.faceCents).toBe(0)
  })
})

describe("parseMoneyToCents", () => {
  it("aceita vírgula, ponto, milhar e prefixo R$", () => {
    expect(parseMoneyToCents("1,50")).toBe(150)
    expect(parseMoneyToCents("1.50")).toBe(150)
    expect(parseMoneyToCents("1.234,56")).toBe(123456)
    expect(parseMoneyToCents("1.500")).toBe(150000)
    expect(parseMoneyToCents("R$ 10")).toBe(1000)
    expect(parseMoneyToCents("0,1")).toBe(10)
  })

  it("vazio ou inválido vira zero", () => {
    expect(parseMoneyToCents("")).toBe(0)
    expect(parseMoneyToCents("abc")).toBe(0)
    expect(parseMoneyToCents(",")).toBe(0)
  })
})

describe("sanitize", () => {
  it("centavos viram inteiros não negativos", () => {
    expect(sanitizeCents(12.4)).toBe(12)
    expect(sanitizeCents("abc")).toBe(0)
    expect(sanitizeCents(-3)).toBe(0)
  })

  it("percentuais ausentes ou inválidos voltam ao padrão e ficam entre 0 e 100", () => {
    expect(sanitizeRates(null)).toEqual(DEFAULT_COIN_RATES)
    expect(sanitizeRates({ c5: "abc", c10: 250, c25: -5, c50: 7.5 })).toEqual({
      c5: 10,
      c10: 100,
      c25: 0,
      c50: 7.5,
      r1: 5,
    })
  })
})
