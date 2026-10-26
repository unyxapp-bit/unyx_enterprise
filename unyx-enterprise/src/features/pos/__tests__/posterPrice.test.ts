import { describe, expect, it } from "vitest"

import { centsDisplay, formatPrice, linkedCentsStyle, parsePrice } from "../posterPrice"

const base = {
  x: 40,
  y: 70,
  fontSize: 300,
  fontFamily: "Arial Black",
  fontWeight: "900",
  fontStyle: "normal",
  textAlign: "middle",
  letterSpacing: 0,
  maxWidth: 90,
  strokeWidth: 6,
  shadowBlur: 0,
  shadowX: 0,
  shadowY: 0,
  rotation: 0,
}

describe("poster price", () => {
  it("splits a typed price into reais and centavos", () => {
    expect(parsePrice("8,99")).toEqual({ reais: "8", centavos: "99" })
    expect(parsePrice("24.5")).toEqual({ reais: "24", centavos: "5" })
    expect(parsePrice("1299")).toEqual({ reais: "1299", centavos: "" })
    expect(parsePrice("R$ 7,999")).toEqual({ reais: "7", centavos: "99" })
    expect(formatPrice("8", "99")).toBe("8,99")
    expect(formatPrice("8", "")).toBe("8")
  })

  it("shows the comma in front of the centavos", () => {
    expect(centsDisplay("99")).toBe(",99")
    expect(centsDisplay("")).toBe("")
  })

  it("places reduced centavos at half size, top aligned, to the right of the reais", () => {
    const cents = linkedCentsStyle(base, "8", 1000, 1400, true)
    expect(cents.fontSize).toBe(150)
    expect(cents.textAlign).toBe("start")
    expect(cents.strokeWidth).toBe(3)
    expect(cents.x).toBeGreaterThan(base.x)
    expect(cents.y).toBeLessThan(base.y)
  })

  it("keeps full size centavos on the same line", () => {
    const cents = linkedCentsStyle(base, "8", 1000, 1400, false)
    expect(cents.fontSize).toBe(300)
    expect(cents.y).toBeCloseTo(base.y, 5)
  })
})
