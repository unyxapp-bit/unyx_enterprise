import {
  getPosterTemplate,
  templateUrl,
  type PosterArea,
} from "@/features/frontstore/posters/posterConfig"
import {
  clamp,
  percentNumber,
  posterToCanvasData,
  resolveTemplateLayout,
} from "@/features/frontstore/posters/posterModel"
import type { OperationalPoster, OperationalPosterTone } from "@/types/domain"

function blankToneStyle(tone: OperationalPosterTone) {
  if (tone === "urgent") return { backgroundColor: "#fff1f2", borderColor: "#dc2626" }
  if (tone === "success") return { backgroundColor: "#ecfdf5", borderColor: "#059669" }
  if (tone === "info") return { backgroundColor: "#f0f9ff", borderColor: "#0284c7" }
  if (tone === "attention") return { backgroundColor: "#fffbeb", borderColor: "#f59e0b" }
  return { backgroundColor: "#ffffff", borderColor: "#111827" }
}

function parseAspectRatio(aspectRatio: string) {
  const [rawWidth, rawHeight] = aspectRatio.split("/").map((value) => Number(value.trim()))
  if (!Number.isFinite(rawWidth) || !Number.isFinite(rawHeight) || rawWidth <= 0 || rawHeight <= 0) {
    return { width: 210, height: 297 }
  }
  return { width: rawWidth, height: rawHeight }
}

function areaRect(area: PosterArea, width: number, height: number) {
  const left = ((percentNumber(area.left) ?? 0) / 100) * width
  const top = ((percentNumber(area.top) ?? 0) / 100) * height
  const areaWidth = ((percentNumber(area.width) ?? 100) / 100) * width
  return { left, top, width: areaWidth }
}

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ""

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (context.measureText(candidate).width <= maxWidth || !current) {
      current = candidate
    } else {
      lines.push(current)
      current = word
    }
  }

  if (current) lines.push(current)
  return lines.slice(0, 4)
}

function drawPosterText({
  context,
  area,
  text,
  fontSize,
  color,
  weight,
  canvasWidth,
  canvasHeight,
}: {
  context: CanvasRenderingContext2D
  area: PosterArea
  text: string
  fontSize: number
  color: string
  weight: number
  canvasWidth: number
  canvasHeight: number
}) {
  const rect = areaRect(area, canvasWidth, canvasHeight)
  const size = clamp(fontSize, 16, 240)
  context.save()
  context.fillStyle = area.color ?? color
  context.font = `${weight} ${size}px Arial, Helvetica, sans-serif`
  context.textAlign = area.align === "left" ? "left" : area.align === "right" ? "right" : "center"
  context.textBaseline = "middle"
  context.shadowColor = "rgba(255,255,255,0.72)"
  context.shadowBlur = 2
  context.shadowOffsetY = 1

  const lines = wrapText(context, text.toUpperCase(), rect.width)
  const lineHeight = size * 1.05
  const startY = rect.top - ((lines.length - 1) * lineHeight) / 2
  const x =
    context.textAlign === "left"
      ? rect.left
      : context.textAlign === "right"
        ? rect.left + rect.width
        : rect.left + rect.width / 2

  lines.forEach((line, index) => {
    context.fillText(line, x, startY + index * lineHeight)
  })

  context.restore()
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = source
  })
}

function downloadCanvas(canvas: HTMLCanvasElement, fileName: string) {
  const anchor = document.createElement("a")
  anchor.download = fileName
  anchor.href = canvas.toDataURL("image/png")
  anchor.click()
}

function safeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
}

export async function downloadPosterAsPng(poster: OperationalPoster) {
  const data = posterToCanvasData(poster)
  const template = getPosterTemplate(data.template_key)
  const ratio = parseAspectRatio(template.aspectRatio)
  const canvasWidth = 1240
  const canvasHeight = Math.round(canvasWidth * (ratio.height / ratio.width))
  const canvas = document.createElement("canvas")
  canvas.width = canvasWidth
  canvas.height = canvasHeight
  const context = canvas.getContext("2d")

  if (!context) throw new Error("Nao foi possivel preparar a imagem.")

  if (template.file) {
    const image = await loadImage(templateUrl(template))
    context.drawImage(image, 0, 0, canvasWidth, canvasHeight)
  } else {
    const colors = blankToneStyle(data.tone)
    context.fillStyle = colors.backgroundColor
    context.fillRect(0, 0, canvasWidth, canvasHeight)
    context.strokeStyle = colors.borderColor
    context.lineWidth = 12
    context.strokeRect(6, 6, canvasWidth - 12, canvasHeight - 12)
  }

  const textColor = template.textColor ?? "#111827"
  const priceColor = template.priceColor ?? textColor
  const layout = resolveTemplateLayout(template.layout, data.layout_config)
  const scale = canvasWidth / 620

  const fields = [
    {
      area: layout.subtitle,
      text: data.subtitle,
      size: Math.max(data.sale_unit_size, 18) * scale,
      color: textColor,
      weight: 900,
    },
    {
      area: layout.product,
      text: data.product_name || data.title,
      size: data.product_name_size * scale,
      color: textColor,
      weight: 900,
    },
    {
      area: layout.description,
      text: data.product_description || data.body,
      size: data.description_size * scale,
      color: textColor,
      weight: 800,
    },
    {
      area: layout.price,
      text: data.price_text,
      size: data.price_size * scale,
      color: priceColor,
      weight: 900,
    },
    {
      area: layout.unit,
      text: data.sale_unit,
      size: data.sale_unit_size * scale,
      color: textColor,
      weight: 900,
    },
    {
      area: layout.footer,
      text: data.footer,
      size: data.sale_unit_size * scale,
      color: textColor,
      weight: 900,
    },
  ]

  fields.forEach((field) => {
    if (!field.text) return
    drawPosterText({
      context,
      area: field.area,
      text: field.text,
      fontSize: field.size,
      color: field.color,
      weight: field.weight,
      canvasWidth,
      canvasHeight,
    })
  })

  downloadCanvas(canvas, `${safeFileName(data.product_name || data.title || "cartaz")}.png`)
}
