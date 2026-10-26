import { digitTopOffset, measureTextWidth, xHeightEm } from "./textMetrics"

export interface PriceStyle {
  x: number
  y: number
  fontSize: number
  fontFamily: string
  fontWeight: string
  fontStyle: string
  textAlign: string
  letterSpacing: number
  maxWidth: number
  strokeWidth: number
  shadowBlur: number
  shadowX: number
  shadowY: number
  rotation: number
}

// "8,99" -> { reais: "8", centavos: "99" }. Aceita vírgula ou ponto e no máximo 2 casas.
export function parsePrice(input: string) {
  const cleaned = input.replace(/[^\d,.]/g, "")
  const separator = cleaned.search(/[,.]/)
  if (separator === -1) return { reais: cleaned.slice(0, 5), centavos: "" }
  return {
    reais: cleaned.slice(0, separator).slice(0, 5),
    centavos: cleaned.slice(separator + 1).replace(/[^\d]/g, "").slice(0, 2),
  }
}

export function formatPrice(reais: string, centavos: string) {
  return centavos ? `${reais},${centavos}` : reais
}

// Texto exibido nos centavos: sempre com a vírgula na frente.
export function centsDisplay(centavos: string) {
  return centavos ? `,${centavos}` : ""
}

export interface CentsRun {
  text: string
  x: number
  y: number
  fontSize: number
}

// Os centavos aparecem como ",99": a vírgula tem metade do tamanho dos algarismos e
// apoia na mesma linha de base. Devolve as duas partes já posicionadas (coordenadas do
// cartaz), ou null quando o texto não começa com vírgula.
export function centsRuns(
  value: string,
  style: PriceStyle & { textAlign: string },
  fontSize: number,
  x: number,
  y: number
): CentsRun[] | null {
  if (!value.startsWith(",") || value.length < 2) return null
  const digits = value.slice(1)
  const commaSize = fontSize * 0.5
  const commaWidth = measureTextWidth(",", commaSize, style) + style.letterSpacing
  const digitsWidth = measureTextWidth(digits, fontSize, style)
  const total = commaWidth + digitsWidth
  const left = style.textAlign === "end" ? x - total : style.textAlign === "middle" ? x - total / 2 : x
  // "middle" ancora no meio do "x": a linha de base dos algarismos fica meio "x" abaixo de y.
  // A vírgula, menor, precisa do mesmo apoio: sua linha de base = a dos algarismos.
  const xh = xHeightEm(fontSize, style)
  const baseline = y + (xh * fontSize) / 2
  const commaY = baseline - (xHeightEm(commaSize, style) * commaSize) / 2
  return [
    { text: ",", x: left, y: commaY, fontSize: commaSize },
    { text: digits, x: left + commaWidth, y, fontSize },
  ]
}

// Tamanho dos centavos a 50% do "R$ inteiro" (fonte, contorno, sombra e espaçamento).
export function reducedCentsSize<S extends PriceStyle>(reais: S) {
  return {
    fontSize: Math.max(8, reais.fontSize * 0.5),
    letterSpacing: reais.letterSpacing * 0.5,
    strokeWidth: reais.strokeWidth * 0.5,
    shadowBlur: reais.shadowBlur * 0.5,
    shadowX: reais.shadowX * 0.5,
    shadowY: reais.shadowY * 0.5,
  }
}

// Estilo dos centavos derivado do estilo de "R$ inteiro": mesma fonte, cor e contorno,
// ancorado à direita do valor inteiro. Com `reduced`, fica em 50% do tamanho e alinhado
// ao topo dos algarismos; sem ele, tem o mesmo tamanho na mesma linha.
export function linkedCentsStyle<S extends PriceStyle>(
  reais: S,
  reaisText: string,
  canvasWidth: number,
  canvasHeight: number,
  reduced: boolean
): S {
  const scale = reduced ? 0.5 : 1
  const fontSize = Math.max(8, reais.fontSize * scale)
  const reaisWidth = Math.min(
    measureTextWidth(reaisText, reais.fontSize, reais),
    (reais.maxWidth / 100) * canvasWidth
  )
  const shift =
    reais.textAlign === "start" ? reaisWidth / 2 : reais.textAlign === "end" ? -reaisWidth / 2 : 0
  const centerX = (reais.x / 100) * canvasWidth + shift
  const centerY = (reais.y / 100) * canvasHeight
  const gap = reais.fontSize * 0.012
  // Alinha o topo dos algarismos dos centavos ao topo do valor inteiro.
  const capOffset = digitTopOffset(reais.fontSize, reais) * (reais.fontSize - fontSize)

  const dx = reaisWidth / 2 + gap
  const dy = -capOffset
  const angle = (reais.rotation * Math.PI) / 180
  const x = centerX + dx * Math.cos(angle) - dy * Math.sin(angle)
  const y = centerY + dx * Math.sin(angle) + dy * Math.cos(angle)

  return {
    ...reais,
    x: (x / canvasWidth) * 100,
    y: (y / canvasHeight) * 100,
    fontSize,
    textAlign: "start",
    maxWidth: 100,
    letterSpacing: reais.letterSpacing * scale,
    strokeWidth: reais.strokeWidth * scale,
    shadowBlur: reais.shadowBlur * scale,
    shadowX: reais.shadowX * scale,
    shadowY: reais.shadowY * scale,
  }
}
