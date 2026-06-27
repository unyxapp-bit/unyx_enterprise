export type PaperPreset = "a5" | "a4" | "a3"
export type PaperOrientation = "portrait" | "landscape"
export type BackgroundFit = "cover" | "contain" | "stretch"

export type PosterDocumentSettings = {
  paper: PaperPreset
  orientation: PaperOrientation
  bleedMm: number
  safeMarginMm: number
  dpi: 150 | 300
  showGuides: boolean
  showGrid: boolean
  showRulers: boolean
  includeCropMarks: boolean
  backgroundFit: BackgroundFit
  backgroundOpacity: number
  backgroundBrightness: number
  backgroundContrast: number
  backgroundScale: number
  backgroundOffsetX: number
  backgroundOffsetY: number
  snapToGrid: boolean
}

export const PAPER_SIZES_MM: Record<PaperPreset, { width: number; height: number; label: string }> = {
  a5: { width: 148, height: 210, label: "A5" },
  a4: { width: 210, height: 297, label: "A4" },
  a3: { width: 297, height: 420, label: "A3" },
}

export const DEFAULT_DOCUMENT_SETTINGS: PosterDocumentSettings = {
  paper: "a4",
  orientation: "portrait",
  bleedMm: 3,
  safeMarginMm: 8,
  dpi: 300,
  showGuides: true,
  showGrid: false,
  showRulers: true,
  includeCropMarks: true,
  backgroundFit: "cover",
  backgroundOpacity: 1,
  backgroundBrightness: 1,
  backgroundContrast: 1,
  backgroundScale: 1,
  backgroundOffsetX: 0,
  backgroundOffsetY: 0,
  snapToGrid: true,
}

export type PosterGeometry = {
  paperWidthMm: number
  paperHeightMm: number
  totalWidthMm: number
  totalHeightMm: number
  logicalWidth: number
  logicalHeight: number
  trimX: number
  trimY: number
  trimWidth: number
  trimHeight: number
  safeX: number
  safeY: number
  safeWidth: number
  safeHeight: number
  mmToLogical: number
}

export function documentGeometry(
  settings: PosterDocumentSettings,
  logicalWidth = 1000
): PosterGeometry {
  const preset = PAPER_SIZES_MM[settings.paper]
  const paperWidthMm =
    settings.orientation === "portrait" ? preset.width : preset.height
  const paperHeightMm =
    settings.orientation === "portrait" ? preset.height : preset.width
  const bleedMm = Math.max(0, settings.bleedMm)
  const safeMarginMm = Math.max(0, settings.safeMarginMm)
  const totalWidthMm = paperWidthMm + bleedMm * 2
  const totalHeightMm = paperHeightMm + bleedMm * 2
  const mmToLogical = logicalWidth / totalWidthMm
  const logicalHeight = totalHeightMm * mmToLogical
  const trimX = bleedMm * mmToLogical
  const trimY = bleedMm * mmToLogical
  const trimWidth = paperWidthMm * mmToLogical
  const trimHeight = paperHeightMm * mmToLogical
  const safeInset = safeMarginMm * mmToLogical

  return {
    paperWidthMm,
    paperHeightMm,
    totalWidthMm,
    totalHeightMm,
    logicalWidth,
    logicalHeight,
    trimX,
    trimY,
    trimWidth,
    trimHeight,
    safeX: trimX + safeInset,
    safeY: trimY + safeInset,
    safeWidth: Math.max(1, trimWidth - safeInset * 2),
    safeHeight: Math.max(1, trimHeight - safeInset * 2),
    mmToLogical,
  }
}

export function rasterDimensions(settings: PosterDocumentSettings) {
  const geometry = documentGeometry(settings)
  return {
    width: Math.round((geometry.totalWidthMm / 25.4) * settings.dpi),
    height: Math.round((geometry.totalHeightMm / 25.4) * settings.dpi),
  }
}

export function logicalPxToPt(
  value: number,
  geometry: PosterGeometry
) {
  return (value / geometry.mmToLogical / 25.4) * 72
}

export function ptToLogicalPx(value: number, geometry: PosterGeometry) {
  return (value / 72) * 25.4 * geometry.mmToLogical
}

function concatBytes(parts: Uint8Array[]) {
  const length = parts.reduce((sum, part) => sum + part.length, 0)
  const result = new Uint8Array(length)
  let offset = 0
  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }
  return result
}

function jpegBytes(dataUrl: string) {
  const base64 = dataUrl.split(",")[1]
  if (!base64) throw new Error("Imagem JPEG invalida para o PDF.")
  const binary = atob(base64)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

export function createImagePdf(input: {
  jpegDataUrl: string
  imageWidth: number
  imageHeight: number
  pageWidthMm: number
  pageHeightMm: number
}) {
  const encoder = new TextEncoder()
  const image = jpegBytes(input.jpegDataUrl)
  const pageWidthPt = (input.pageWidthMm / 25.4) * 72
  const pageHeightPt = (input.pageHeightMm / 25.4) * 72
  const content = `q\n${pageWidthPt.toFixed(3)} 0 0 ${pageHeightPt.toFixed(
    3
  )} 0 0 cm\n/Im0 Do\nQ\n`
  const objects: Uint8Array[] = [
    encoder.encode("<< /Type /Catalog /Pages 2 0 R >>"),
    encoder.encode("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    encoder.encode(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidthPt.toFixed(
        3
      )} ${pageHeightPt.toFixed(
        3
      )}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`
    ),
    concatBytes([
      encoder.encode(
        `<< /Type /XObject /Subtype /Image /Width ${input.imageWidth} /Height ${input.imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n`
      ),
      image,
      encoder.encode("\nendstream"),
    ]),
    encoder.encode(`<< /Length ${encoder.encode(content).length} >>\nstream\n${content}endstream`),
  ]

  const chunks: Uint8Array[] = [encoder.encode("%PDF-1.4\n%UNYX\n")]
  const offsets = [0]
  let offset = chunks[0].length
  objects.forEach((object, index) => {
    offsets.push(offset)
    const chunk = concatBytes([
      encoder.encode(`${index + 1} 0 obj\n`),
      object,
      encoder.encode("\nendobj\n"),
    ])
    chunks.push(chunk)
    offset += chunk.length
  })

  const xrefOffset = offset
  const xref = ["xref", `0 ${objects.length + 1}`, "0000000000 65535 f "]
  offsets.slice(1).forEach((objectOffset) => {
    xref.push(`${String(objectOffset).padStart(10, "0")} 00000 n `)
  })
  xref.push(
    "trailer",
    `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    "startxref",
    String(xrefOffset),
    "%%EOF"
  )
  chunks.push(encoder.encode(`${xref.join("\n")}\n`))

  return new Blob([concatBytes(chunks)], { type: "application/pdf" })
}
