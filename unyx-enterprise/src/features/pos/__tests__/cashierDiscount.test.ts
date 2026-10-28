import { describe, expect, it } from "vitest"

import { calculateDiscount, productLine, sanitizeQuantity } from "../cashierDiscount"

describe("calculateDiscount", () => {
  it("confere com a ficha de papel: sistema 12,89, venda 11,90, 3 unidades = R$ 2,97", () => {
    const result = calculateDiscount({ systemCents: 1289, saleCents: 1190, quantity: 3 })
    expect(result.unitCents).toBe(99)
    expect(result.totalCents).toBe(297)
    expect(result.valid).toBe(true)
    expect(result.saleAboveSystem).toBe(false)
  })

  it("uma unidade: o desconto é só a diferença", () => {
    expect(calculateDiscount({ systemCents: 1000, saleCents: 850, quantity: 1 }).totalCents).toBe(150)
  })

  it("venda igual ou acima do sistema não é desconto", () => {
    const equal = calculateDiscount({ systemCents: 1000, saleCents: 1000, quantity: 2 })
    expect(equal.valid).toBe(false)
    expect(equal.totalCents).toBe(0)
    const above = calculateDiscount({ systemCents: 1000, saleCents: 1200, quantity: 2 })
    expect(above.valid).toBe(false)
    expect(above.saleAboveSystem).toBe(true)
    expect(above.totalCents).toBe(0)
  })

  it("sem preço do sistema não vale, e quantidade inválida vira 1", () => {
    expect(calculateDiscount({ systemCents: 0, saleCents: 0, quantity: 1 }).valid).toBe(false)
    expect(calculateDiscount({ systemCents: 500, saleCents: 400, quantity: 0 }).quantity).toBe(1)
    expect(sanitizeQuantity("abc")).toBe(1)
    expect(sanitizeQuantity(2.9)).toBe(2)
    expect(sanitizeQuantity(99999)).toBe(9999)
  })
})

describe("productLine", () => {
  it("acrescenta a quantidade quando passa de uma unidade", () => {
    expect(productLine("Batata pringles 104G original", 3)).toBe("Batata pringles 104G original (3X)")
    expect(productLine("  Arroz  ", 1)).toBe("Arroz")
  })
})
