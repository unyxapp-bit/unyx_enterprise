import { describe, expect, it } from "vitest"

import { createCustomElement, customElementSvg } from "../posterEditorElements"

describe("poster editor custom elements", () => {
  it("creates transformable text elements with safe defaults", () => {
    const element = createCustomElement("text", { value: "R$", rotation: 15 })

    expect(element.id).toMatch(/^custom:/)
    expect(element.value).toBe("R$")
    expect(element.rotation).toBe(15)
    expect(element.visible).toBe(true)
    expect(element.locked).toBe(false)
  })

  it("exports shapes with their transform and opacity", () => {
    const element = createCustomElement("shape", {
      shape: "ellipse",
      x: 25,
      y: 40,
      rotation: 30,
      opacity: 0.75,
    })
    const markup = customElementSvg(element, 800, 1100)

    expect(markup).toContain('transform="translate(200 440) rotate(30)"')
    expect(markup).toContain('opacity="0.75"')
    expect(markup).toContain("<ellipse")
  })

  it("fits large custom text inside its box during export", () => {
    const element = createCustomElement("text", {
      value: "OFERTA MUITO ESPECIAL",
      width: 20,
      height: 5,
      fontSize: 900,
    })
    const markup = customElementSvg(element, 800, 1100)
    const exportedFontSize = Number(markup.match(/font-size="([\d.]+)"/)?.[1])

    expect(exportedFontSize).toBeGreaterThan(0)
    expect(exportedFontSize).toBeLessThan(900)
  })
})
