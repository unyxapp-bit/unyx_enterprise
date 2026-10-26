export interface TextMetricsStyle {
  fontFamily: string
  fontWeight: string
  fontStyle: string
  letterSpacing: number
}

const widthCache = new Map<string, number>()
let measureContext: CanvasRenderingContext2D | null | undefined

function context() {
  if (measureContext !== undefined) return measureContext
  measureContext =
    typeof document === "undefined"
      ? null
      : document.createElement("canvas").getContext("2d")
  return measureContext
}

// Estimativa usada quando não há canvas (testes/SSR) ou a fonte ainda não carregou.
function estimatedWidth(value: string, fontSize: number, letterSpacing: number) {
  const count = Math.max(1, Array.from(value).length)
  return count * fontSize * 0.62 + Math.max(0, count - 1) * letterSpacing
}

// Distância (em "em") do topo dos algarismos até a linha central onde o SVG ancora o texto
// (dominant-baseline: middle = meia altura do "x" acima da linha de base).
export function digitTopOffset(fontSize: number, style: TextMetricsStyle) {
  const ctx = context()
  if (!ctx) return 0.456
  ctx.font = `${style.fontStyle} ${style.fontWeight} ${fontSize}px "${style.fontFamily}"`
  const digits = ctx.measureText("0123456789").actualBoundingBoxAscent
  const xHeight = ctx.measureText("x").actualBoundingBoxAscent
  if (!digits || !xHeight) return 0.456
  return (digits - xHeight / 2) / fontSize
}

// Altura do "x" em "em": define onde fica a linha de base em relação ao centro (middle).
export function xHeightEm(fontSize: number, style: TextMetricsStyle) {
  const ctx = context()
  if (!ctx) return 0.52
  ctx.font = `${style.fontStyle} ${style.fontWeight} ${fontSize}px "${style.fontFamily}"`
  const xHeight = ctx.measureText("x").actualBoundingBoxAscent
  return xHeight ? xHeight / fontSize : 0.52
}

// Largura real do texto com a fonte, o peso e o espaçamento usados no cartaz.
// O cartaz usa 0,58 * tamanho por letra na estimativa antiga; fontes largas como a
// Arial Black passam disso e o texto saía da caixa.
export function measureTextWidth(value: string, fontSize: number, style: TextMetricsStyle) {
  if (!value) return 0
  const key = `${style.fontStyle}|${style.fontWeight}|${style.fontFamily}|${fontSize}|${style.letterSpacing}|${value}`
  const cached = widthCache.get(key)
  if (cached !== undefined) return cached

  const ctx = context()
  let width: number
  if (ctx) {
    ctx.font = `${style.fontStyle} ${style.fontWeight} ${fontSize}px "${style.fontFamily}"`
    width =
      ctx.measureText(value).width +
      Math.max(0, Array.from(value).length - 1) * style.letterSpacing
  } else {
    width = estimatedWidth(value, fontSize, style.letterSpacing)
  }

  if (widthCache.size > 2000) widthCache.clear()
  widthCache.set(key, width)
  return width
}
