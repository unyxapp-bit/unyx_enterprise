import { describe, expect, it } from "vitest"

import {
  createImagePdf,
  DEFAULT_DOCUMENT_SETTINGS,
  documentGeometry,
  logicalPxToPt,
  ptToLogicalPx,
  rasterDimensions,
} from "../posterEditorCore"

describe("poster editor print geometry", () => {
  it("creates an A4 document with bleed and safe margin", () => {
    const geometry = documentGeometry(DEFAULT_DOCUMENT_SETTINGS)

    expect(geometry.paperWidthMm).toBe(210)
    expect(geometry.paperHeightMm).toBe(297)
    expect(geometry.totalWidthMm).toBe(216)
    expect(geometry.totalHeightMm).toBe(303)
    expect(geometry.safeX).toBeGreaterThan(geometry.trimX)
    expect(geometry.safeWidth).toBeLessThan(geometry.trimWidth)
  })

  it("uses print DPI for raster dimensions", () => {
    expect(rasterDimensions(DEFAULT_DOCUMENT_SETTINGS)).toEqual({
      width: 2551,
      height: 3579,
    })
  })

  it("converts logical font sizes to points and back", () => {
    const geometry = documentGeometry(DEFAULT_DOCUMENT_SETTINGS)
    const points = logicalPxToPt(72, geometry)

    expect(ptToLogicalPx(points, geometry)).toBeCloseTo(72)
  })

  it("swaps paper dimensions in landscape orientation", () => {
    const geometry = documentGeometry({
      ...DEFAULT_DOCUMENT_SETTINGS,
      paper: "a3",
      orientation: "landscape",
    })

    expect(geometry.paperWidthMm).toBe(420)
    expect(geometry.paperHeightMm).toBe(297)
  })

  it("creates a valid single-page PDF from a JPEG", async () => {
    const pdf = createImagePdf({
      jpegDataUrl: "data:image/jpeg;base64,/9j/2Q==",
      imageWidth: 1,
      imageHeight: 1,
      pageWidthMm: 210,
      pageHeightMm: 297,
    })
    const bytes = new Uint8Array(await pdf.arrayBuffer())
    const header = new TextDecoder().decode(bytes.slice(0, 8))

    expect(pdf.type).toBe("application/pdf")
    expect(header).toBe("%PDF-1.4")
    expect(bytes.length).toBeGreaterThan(300)
  })
})
