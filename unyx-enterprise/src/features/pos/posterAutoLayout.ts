// Layout automático de templates: lê a imagem do cartaz, descobre onde ficam o cabeçalho, a
// pincelada (faixa colorida do preço) e o rodapé, e devolve posições, tamanhos e cores para os
// campos do cartaz. Posições em % da folha; tamanhos de fonte na largura lógica do editor.

export type LayoutRegions = {
  /** Fim do cabeçalho (% da altura); 0 se o template não tem cabeçalho. */
  headerEnd: number
  /** Início do rodapé decorado (% da altura); 100 se não há. */
  footerStart: number
  /** Faixa colorida do preço (% da folha) e a cor média dela; null se não há. */
  brush: { top: number; bottom: number; left: number; right: number; luminance: number } | null
  /** Fundo claro ou escuro, para escolher a cor do texto. */
  background: "light" | "dark"
}

export type AutoFieldStyle = {
  x: number
  y: number
  fontSize: number
  color: string
  stroke: string
  strokeWidth: number
}

export type AutoLayoutPreset = {
  produto: AutoFieldStyle
  descricao: AutoFieldStyle
  preco_reais: AutoFieldStyle
  validade: AutoFieldStyle
  observacao: AutoFieldStyle
  /** Centro horizontal (%) do grupo de preço (inteiro + centavos). */
  priceCenterX: number
}

const luminanceOf = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b

/**
 * Analisa os pixels (RGBA) e separa fundo, cabeçalho, pincelada e rodapé.
 * `pixels` tem 4 bytes por pixel, linha a linha.
 */
export function detectLayoutRegions(
  pixels: ArrayLike<number>,
  width: number,
  height: number
): LayoutRegions {
  const at = (x: number, y: number) => {
    const i = (y * width + x) * 4
    const alpha = pixels[i + 3] / 255
    // Transparente conta como branco.
    return [
      pixels[i] * alpha + 255 * (1 - alpha),
      pixels[i + 1] * alpha + 255 * (1 - alpha),
      pixels[i + 2] * alpha + 255 * (1 - alpha),
    ]
  }

  // Cor de fundo: mediana dos pixels das bordas laterais, na faixa central da folha.
  const samples: number[][] = []
  for (let y = Math.floor(height * 0.35); y < Math.floor(height * 0.65); y += 2) {
    samples.push(at(1, y), at(width - 2, y))
  }
  const channel = (index: number) =>
    samples.map((sample) => sample[index]).sort((a, b) => a - b)[Math.floor(samples.length / 2)] ?? 255
  const bg = [channel(0), channel(1), channel(2)]
  const background: LayoutRegions["background"] =
    luminanceOf(bg[0], bg[1], bg[2]) < 110 ? "dark" : "light"

  const isContent = (x: number, y: number) => {
    const [r, g, b] = at(x, y)
    return Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2]) > 90
  }

  const rowFraction: number[] = []
  const columnCount: number[] = new Array(width).fill(0)
  const contentMask: boolean[][] = []
  for (let y = 0; y < height; y += 1) {
    let count = 0
    const row: boolean[] = []
    for (let x = 0; x < width; x += 1) {
      const content = isContent(x, y)
      row.push(content)
      if (content) {
        count += 1
        columnCount[x] += 1
      }
    }
    contentMask.push(row)
    rowFraction.push(count / width)
  }

  // Cabeçalho: linhas do topo quase todas preenchidas (tolera pequenas falhas).
  let headerRows = 0
  let gap = 0
  for (let y = 0; y < Math.floor(height * 0.5); y += 1) {
    if (rowFraction[y] > 0.3) {
      headerRows = y + 1
      gap = 0
    } else {
      gap += 1
      if (gap > 2) break
    }
  }
  const headerEnd = headerRows > 0 ? (headerRows / height) * 100 : 0

  // Rodapé decorado: linhas do fim quase todas preenchidas.
  let footerRows = 0
  gap = 0
  for (let y = height - 1; y > Math.floor(height * 0.6); y -= 1) {
    if (rowFraction[y] > 0.3) {
      footerRows = height - y
      gap = 0
    } else {
      gap += 1
      if (gap > 2) break
    }
  }
  const footerStart = footerRows > 0 ? ((height - footerRows) / height) * 100 : 100

  // Pincelada: maior trecho de linhas com conteúdo entre cabeçalho e rodapé.
  const from = headerRows
  const to = height - footerRows
  let best: { start: number; end: number } | null = null
  let runStart = -1
  let missing = 0
  for (let y = from; y <= to; y += 1) {
    const filled = y < to && rowFraction[y] > 0.12
    if (filled) {
      if (runStart < 0) runStart = y
      missing = 0
    } else if (runStart >= 0) {
      missing += 1
      if (missing > 2 || y === to) {
        const end = y - missing
        if (!best || end - runStart > best.end - best.start) best = { start: runStart, end }
        runStart = -1
        missing = 0
      }
    }
  }

  let brush: LayoutRegions["brush"] = null
  if (best && best.end - best.start >= height * 0.06) {
    let left = width
    let right = 0
    let sumLum = 0
    let counted = 0
    for (let y = best.start; y <= best.end; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (!contentMask[y][x]) continue
        if (x < left) left = x
        if (x > right) right = x
        const [r, g, b] = at(x, y)
        sumLum += luminanceOf(r, g, b)
        counted += 1
      }
    }
    if (counted > 0 && right > left) {
      brush = {
        top: (best.start / height) * 100,
        bottom: ((best.end + 1) / height) * 100,
        left: (left / width) * 100,
        right: ((right + 1) / width) * 100,
        luminance: sumLum / counted,
      }
    }
  }

  return { headerEnd, footerStart, brush, background }
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const round1 = (value: number) => Math.round(value * 10) / 10

/**
 * Monta posições, tamanhos e cores dos campos a partir das regiões detectadas.
 * `logicalWidth/Height` são as dimensões lógicas do editor (largura 1000).
 */
export function buildAutoLayout(
  regions: LayoutRegions,
  logicalWidth: number,
  logicalHeight: number
): AutoLayoutPreset {
  const { headerEnd, footerStart, brush, background } = regions
  const darkBackground = background === "dark"
  const textColor = darkBackground ? "#FFFFFF" : "#111111"
  const softTextColor = darkBackground ? "#E5E7EB" : "#374151"
  const pxPerPct = logicalHeight / 100

  const zoneTop = headerEnd > 0 ? headerEnd + 3 : 8
  const zoneBottom = brush ? brush.top - 3 : Math.min(58, footerStart - 20)
  const zoneHeight = Math.max(zoneBottom - zoneTop, 12)
  const zonePx = zoneHeight * pxPerPct

  const produtoSize = clamp(zonePx * 0.18, 56, 104)
  const descricaoSize = clamp(produtoSize * 0.5, 30, 52)

  const brushHeightPx = brush ? (brush.bottom - brush.top) * pxPerPct : 0
  const brushCenterX = brush ? (brush.left + brush.right) / 2 : 50
  const brushCenterY = brush ? (brush.top + brush.bottom) / 2 : 66
  const reaisSize = brush ? clamp(brushHeightPx * 0.85, 140, 400) : 260

  // Preço escuro sobre pincelada clara; claro sobre pincelada escura (ou sem pincelada, pelo fundo).
  const onLightSurface = brush ? brush.luminance > 140 : !darkBackground
  const priceColor = onLightSurface ? "#111111" : "#FFFFFF"

  const below = brush ? brush.bottom : brushCenterY + 12
  const belowSpace = footerStart - below
  void logicalWidth

  return {
    priceCenterX: round1(brushCenterX),
    produto: {
      x: 50,
      y: round1(zoneTop + zoneHeight * 0.32),
      fontSize: Math.round(produtoSize),
      color: textColor,
      stroke: "none",
      strokeWidth: 0,
    },
    descricao: {
      x: 50,
      y: round1(zoneTop + zoneHeight * 0.74),
      fontSize: Math.round(descricaoSize),
      color: softTextColor,
      stroke: "none",
      strokeWidth: 0,
    },
    preco_reais: {
      // Um pouco à esquerda do centro: os centavos ficam à direita do inteiro.
      x: round1(clamp(brushCenterX - 9, 20, 80)),
      y: round1(brushCenterY),
      fontSize: Math.round(reaisSize),
      color: priceColor,
      stroke: "none",
      strokeWidth: 0,
    },
    validade: {
      x: 50,
      y: round1(clamp(below + belowSpace * 0.35, 40, 96)),
      fontSize: 30,
      color: textColor,
      stroke: "none",
      strokeWidth: 0,
    },
    observacao: {
      x: 50,
      y: round1(clamp(footerStart - 2.5, 50, 97)),
      fontSize: 20,
      color: darkBackground ? "#9CA3AF" : "#6B7280",
      stroke: "none",
      strokeWidth: 0,
    },
  }
}

/** Carrega a imagem do template e devolve o layout sugerido; null se não for possível ler. */
export async function analyzeTemplateImage(
  dataUrl: string,
  logicalWidth: number,
  logicalHeight: number
): Promise<AutoLayoutPreset | null> {
  try {
    const image = new Image()
    image.decoding = "async"
    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error("imagem"))
    })
    image.src = dataUrl
    await loaded

    // Reduz para ~160 px de largura mantendo a proporção da folha do editor.
    const width = 160
    const height = Math.round((width * logicalHeight) / logicalWidth)
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext("2d", { willReadFrequently: true })
    if (!context) return null
    context.drawImage(image, 0, 0, width, height)
    const { data } = context.getImageData(0, 0, width, height)
    return buildAutoLayout(detectLayoutRegions(data, width, height), logicalWidth, logicalHeight)
  } catch {
    return null
  }
}
