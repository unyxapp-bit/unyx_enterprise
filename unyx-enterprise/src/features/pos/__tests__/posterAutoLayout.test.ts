import { describe, expect, it } from "vitest"

import { buildAutoLayout, detectLayoutRegions } from "../posterAutoLayout"

type Rect = { top: number; bottom: number; left: number; right: number; rgb: [number, number, number] }

// Folha 100x140 (proporção A4) com retângulos coloridos em % sobre o fundo.
function sheet(background: [number, number, number], rects: Rect[]) {
  const width = 100
  const height = 140
  const pixels = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let rgb = background
      for (const rect of rects) {
        if (
          y >= (rect.top / 100) * height &&
          y < (rect.bottom / 100) * height &&
          x >= (rect.left / 100) * width &&
          x < (rect.right / 100) * width
        ) {
          rgb = rect.rgb
        }
      }
      const i = (y * width + x) * 4
      pixels[i] = rgb[0]
      pixels[i + 1] = rgb[1]
      pixels[i + 2] = rgb[2]
      pixels[i + 3] = 255
    }
  }
  return { pixels, width, height }
}

describe("detectLayoutRegions", () => {
  it("acha cabeçalho, pincelada e fundo claro", () => {
    const { pixels, width, height } = sheet([255, 255, 255], [
      { top: 0, bottom: 20, left: 0, right: 100, rgb: [40, 120, 40] },
      { top: 62, bottom: 82, left: 8, right: 92, rgb: [255, 210, 0] },
    ])
    const regions = detectLayoutRegions(pixels, width, height)

    expect(regions.background).toBe("light")
    expect(regions.headerEnd).toBeGreaterThan(18)
    expect(regions.headerEnd).toBeLessThan(23)
    expect(regions.brush).not.toBeNull()
    expect(regions.brush!.top).toBeGreaterThan(60)
    expect(regions.brush!.top).toBeLessThan(65)
    expect(regions.brush!.bottom).toBeGreaterThan(80)
    expect(regions.brush!.left).toBeLessThan(12)
    expect(regions.brush!.right).toBeGreaterThan(88)
    expect(regions.brush!.luminance).toBeGreaterThan(140)
    expect(regions.footerStart).toBe(100)
  })

  it("sem pincelada nem cabeçalho devolve regiões vazias", () => {
    const { pixels, width, height } = sheet([255, 255, 255], [])
    const regions = detectLayoutRegions(pixels, width, height)
    expect(regions.headerEnd).toBe(0)
    expect(regions.brush).toBeNull()
  })

  it("reconhece fundo escuro", () => {
    const { pixels, width, height } = sheet([10, 15, 30], [])
    expect(detectLayoutRegions(pixels, width, height).background).toBe("dark")
  })
})

describe("buildAutoLayout", () => {
  it("coloca textos entre cabeçalho e pincelada e o preço no centro da pincelada", () => {
    const layout = buildAutoLayout(
      {
        headerEnd: 20,
        footerStart: 100,
        brush: { top: 62, bottom: 82, left: 8, right: 92, luminance: 200 },
        background: "light",
      },
      1000,
      1414
    )

    expect(layout.produto.y).toBeGreaterThan(20)
    expect(layout.produto.y).toBeLessThan(layout.descricao.y)
    expect(layout.descricao.y).toBeLessThan(62)
    expect(layout.preco_reais.y).toBe(72)
    expect(layout.preco_reais.x).toBeLessThan(50)
    expect(layout.preco_reais.color).toBe("#111111")
    expect(layout.validade.y).toBeGreaterThan(82)
    expect(layout.observacao.y).toBeGreaterThan(layout.validade.y)
  })

  it("usa texto claro em fundo escuro e preço claro sobre pincelada escura", () => {
    const layout = buildAutoLayout(
      {
        headerEnd: 0,
        footerStart: 100,
        brush: { top: 60, bottom: 80, left: 10, right: 90, luminance: 60 },
        background: "dark",
      },
      1000,
      1414
    )
    expect(layout.produto.color).toBe("#FFFFFF")
    expect(layout.preco_reais.color).toBe("#FFFFFF")
  })
})
