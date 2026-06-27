import JsBarcode from "jsbarcode"

export type CustomElementKind = "text" | "image" | "shape" | "badge" | "barcode"
export type CustomShape = "rectangle" | "ellipse" | "star"

export type PosterCustomElement = {
  id: string
  kind: CustomElementKind
  name: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
  visible: boolean
  locked: boolean
  value: string
  src: string
  shape: CustomShape
  fill: string
  stroke: string
  strokeWidth: number
  fontFamily: string
  fontSize: number
  fontWeight: "400" | "700" | "900"
  fontStyle: "normal" | "italic"
  textAlign: "start" | "middle" | "end"
  color: string
  letterSpacing: number
  lineHeight: number
  borderRadius: number
}

type CustomElementOverrides = Partial<Omit<PosterCustomElement, "id" | "kind">>

const barcodeCache = new Map<string, string>()

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export function createCustomElement(
  kind: CustomElementKind,
  overrides: CustomElementOverrides = {}
): PosterCustomElement {
  const common: PosterCustomElement = {
    id: `custom:${crypto.randomUUID()}`,
    kind,
    name: "Elemento",
    x: 50,
    y: 50,
    width: 34,
    height: 12,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    value: "NOVO TEXTO",
    src: "",
    shape: "rectangle",
    fill: "#EF4444",
    stroke: "#FFFFFF",
    strokeWidth: 0,
    fontFamily: "Arial Black",
    fontSize: 42,
    fontWeight: "900",
    fontStyle: "normal",
    textAlign: "middle",
    color: "#FFFFFF",
    letterSpacing: 0,
    lineHeight: 1.1,
    borderRadius: 6,
  }

  const defaults: Record<CustomElementKind, CustomElementOverrides> = {
    text: {
      name: "Texto livre",
      fill: "transparent",
      stroke: "none",
      color: "#111827",
    },
    image: {
      name: "Imagem",
      width: 32,
      height: 24,
      value: "",
      fill: "transparent",
      stroke: "none",
    },
    shape: {
      name: "Forma",
      width: 28,
      height: 16,
      value: "",
      stroke: "#FFFFFF",
      strokeWidth: 1,
    },
    badge: {
      name: "Selo",
      width: 28,
      height: 12,
      value: "OFERTA",
      fill: "#EF4444",
      stroke: "#FFFFFF",
      strokeWidth: 2,
      borderRadius: 16,
      fontSize: 34,
    },
    barcode: {
      name: "Codigo de barras",
      width: 38,
      height: 18,
      value: "7891234567895",
      fill: "#FFFFFF",
      stroke: "none",
      color: "#111827",
    },
  }

  return { ...common, ...defaults[kind], ...overrides }
}

export function barcodeDataUrl(value: string, color: string, background: string) {
  const normalizedValue = value.replace(/[^\x20-\x7E]/g, "").trim() || "0000000000000"
  const cacheKey = `${normalizedValue}|${color}|${background}`
  const cached = barcodeCache.get(cacheKey)
  if (cached) return cached

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
  JsBarcode(svg, normalizedValue, {
    format: "CODE128",
    lineColor: color,
    background,
    displayValue: true,
    font: "Arial",
    fontSize: 18,
    height: 64,
    margin: 8,
  })
  const markup = new XMLSerializer().serializeToString(svg)
  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`
  barcodeCache.set(cacheKey, dataUrl)
  return dataUrl
}

function starPath(width: number, height: number) {
  const centerX = width / 2
  const centerY = height / 2
  const outerRadius = Math.min(width, height) / 2
  const innerRadius = outerRadius * 0.46
  const points = Array.from({ length: 10 }, (_, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI) / 5
    const radius = index % 2 === 0 ? outerRadius : innerRadius
    return `${centerX + Math.cos(angle) * radius},${centerY + Math.sin(angle) * radius}`
  })
  return `M ${points.join(" L ")} Z`
}

function customTextLines(element: PosterCustomElement) {
  const lines = element.value.replace(/\r/g, "").split("\n")
  return lines.length > 0 ? lines : [""]
}

export function customElementSvg(
  element: PosterCustomElement,
  canvasWidth: number,
  canvasHeight: number
) {
  if (!element.visible) return ""
  const x = (element.x / 100) * canvasWidth
  const y = (element.y / 100) * canvasHeight
  const width = (element.width / 100) * canvasWidth
  const height = (element.height / 100) * canvasHeight
  const left = -width / 2
  const top = -height / 2
  const transform = `translate(${x} ${y}) rotate(${element.rotation})`
  const stroke =
    element.stroke !== "none" && element.strokeWidth > 0
      ? `stroke="${xmlEscape(element.stroke)}" stroke-width="${element.strokeWidth}"`
      : ""
  let content: string

  if (element.kind === "image" && element.src) {
    content = `<image href="${xmlEscape(element.src)}" x="${left}" y="${top}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet"/>`
  } else if (element.kind === "barcode") {
    const source = barcodeDataUrl(element.value, element.color, element.fill)
    content = `<image href="${xmlEscape(source)}" x="${left}" y="${top}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet"/>`
  } else if (element.kind === "shape") {
    if (element.shape === "ellipse") {
      content = `<ellipse cx="0" cy="0" rx="${width / 2}" ry="${height / 2}" fill="${xmlEscape(element.fill)}" ${stroke}/>`
    } else if (element.shape === "star") {
      content = `<path d="${starPath(width, height)}" transform="translate(${left} ${top})" fill="${xmlEscape(element.fill)}" ${stroke}/>`
    } else {
      content = `<rect x="${left}" y="${top}" width="${width}" height="${height}" rx="${element.borderRadius}" fill="${xmlEscape(element.fill)}" ${stroke}/>`
    }
  } else {
    const lines = customTextLines(element)
    const fittedFontSize = Math.max(
      4,
      Math.min(
        element.fontSize,
        height / Math.max(1, lines.length * element.lineHeight),
        width / Math.max(1, ...lines.map((line) => line.length * 0.58))
      )
    )
    const firstY = -((lines.length - 1) * fittedFontSize * element.lineHeight) / 2
    const textAnchor = element.textAlign
    const textX = element.textAlign === "start" ? left : element.textAlign === "end" ? -left : 0
    const background =
      element.kind === "badge"
        ? `<rect x="${left}" y="${top}" width="${width}" height="${height}" rx="${element.borderRadius}" fill="${xmlEscape(element.fill)}" ${stroke}/>`
        : ""
    const tspans = lines
      .map(
        (line, index) =>
          `<tspan x="${textX}" y="${firstY + index * fittedFontSize * element.lineHeight}">${xmlEscape(line)}</tspan>`
      )
      .join("")
    content = `${background}<text text-anchor="${textAnchor}" dominant-baseline="middle" font-family="${xmlEscape(element.fontFamily)}" font-size="${fittedFontSize}" font-weight="${element.fontWeight}" font-style="${element.fontStyle}" letter-spacing="${element.letterSpacing}" fill="${xmlEscape(element.color)}" ${stroke} paint-order="stroke fill" stroke-linejoin="round">${tspans}</text>`
  }

  return `<g transform="${transform}" opacity="${element.opacity}">${content}</g>`
}
