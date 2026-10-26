import { describe, expect, it } from "vitest"

import { colorLabel, colorName } from "../colorNames"

describe("colorNames", () => {
  it("names the editor palette colors", () => {
    expect(colorName("#FFFFFF")).toBe("Branco")
    expect(colorName("#ef4444")).toBe("Vermelho")
    expect(colorName("#16A34A")).toBe("Verde")
    expect(colorName("#2563EB")).toBe("Azul")
    expect(colorName("#7C3AED")).toBe("Roxo")
    expect(colorName("#F97316")).toBe("Laranja")
  })

  it("uses the nearest name for other colors", () => {
    expect(colorName("#FE0000")).toBe("Vermelho")
    expect(colorName("#0000FF")).toMatch(/Azul/)
    expect(colorName("#010101")).toBe("Preto")
  })

  it("handles empty colors and builds labels", () => {
    expect(colorName("none")).toBe("Sem cor")
    expect(colorLabel("#d90429")).toBe("Vermelho (#D90429)")
  })
})
