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
  const lines: string[] = []

  for (const paragraph of text.split(/\n+/)) {
    const words = paragraph.split(/\s+/).filter(Boolean)
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
  }

  return lines.slice(0, 6)
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

function priceParts(value: string) {
  return value.replace(/^R\$\s*/i, "").trim() || value
}

function drawBrush(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const points: Array<[number, number]> = [
    [0.02, 0.25],
    [0.96, 0],
    [1, 0.18],
    [0.94, 0.28],
    [1, 0.45],
    [0.97, 0.75],
    [0.05, 1],
    [0, 0.8],
    [0.04, 0.65],
    [0, 0.5],
  ]

  context.save()
  context.translate(x + width / 2, y + height / 2)
  context.rotate((-4 * Math.PI) / 180)
  context.translate(-width / 2, -height / 2)
  context.beginPath()
  points.forEach(([px, py], index) => {
    const pointX = px * width
    const pointY = py * height
    if (index === 0) context.moveTo(pointX, pointY)
    else context.lineTo(pointX, pointY)
  })
  context.closePath()
  context.fillStyle = "#ffd900"
  context.fill()
  context.restore()
}

function drawGuidedBackground(
  context: CanvasRenderingContext2D,
  variant: "super-offer" | "yellow-offer",
  width: number,
  height: number
) {
  context.fillStyle = variant === "yellow-offer" ? "#ffe100" : "#ffffff"
  context.fillRect(0, 0, width, height)

  if (variant === "yellow-offer") {
    context.fillStyle = "#111827"
    context.fillRect(0, 0, width, height * 0.18)
    context.fillRect(0, height * 0.92, width, height * 0.08)
    context.save()
    context.translate(width / 2, height * 0.18)
    context.rotate((-3 * Math.PI) / 180)
    context.fillStyle = "#dc2626"
    context.fillRect(-width * 0.58, -height * 0.015, width * 1.16, height * 0.12)
    context.restore()
    context.save()
    context.translate(width / 2, height * 0.88)
    context.rotate((2 * Math.PI) / 180)
    context.fillStyle = "#dc2626"
    context.fillRect(-width * 0.55, -height * 0.025, width * 1.1, height * 0.05)
    context.restore()
    return
  }

  const topGradient = context.createLinearGradient(0, 0, width, 0)
  topGradient.addColorStop(0, "#f8fafc")
  topGradient.addColorStop(0.35, "#e2e8f0")
  topGradient.addColorStop(0.7, "#ffffff")
  topGradient.addColorStop(1, "#dbeafe")
  context.fillStyle = topGradient
  context.fillRect(0, 0, width, height * 0.15)

  for (let x = 0; x < width; x += 54) {
    context.fillStyle = x % 108 === 0 ? "rgba(219,234,254,0.7)" : "rgba(248,250,252,0.7)"
    context.fillRect(x, 0, 54, height * 0.15)
  }

  context.fillStyle = "#b40000"
  context.fillRect(0, height * 0.15, width, height * 0.024)

  const footerGradient = context.createLinearGradient(0, 0, width, 0)
  footerGradient.addColorStop(0, "#e5e7eb")
  footerGradient.addColorStop(0.5, "#ffffff")
  footerGradient.addColorStop(1, "#d1d5db")
  context.fillStyle = footerGradient
  context.fillRect(0, height * 0.925, width, height * 0.075)
  context.fillStyle = "#b40000"
  context.fillRect(0, height * 0.925, width, 26)
}

function drawGuidedPoster(
  context: CanvasRenderingContext2D,
  poster: ReturnType<typeof posterToCanvasData>,
  canvasWidth: number,
  canvasHeight: number
) {
  const template = getPosterTemplate(poster.template_key)
  const variant = template.guidedVariant ?? "super-offer"
  const isYellow = variant === "yellow-offer"
  const layout = resolveTemplateLayout(template.layout, poster.layout_config)
  const scale = canvasWidth / 620
  const textColor = template.textColor ?? "#111827"
  const priceColor = template.priceColor ?? "#c4282f"
  const subtitle = poster.subtitle || (isYellow ? "OFERTA" : "SUPER\nOFERTA")
  const product = poster.product_name || poster.title
  const description = poster.product_description || poster.body
  const price = poster.price_text
  const unit = poster.sale_unit

  drawGuidedBackground(context, variant, canvasWidth, canvasHeight)

  const subtitleRect = areaRect(layout.subtitle, canvasWidth, canvasHeight)
  const subtitleGradient = context.createLinearGradient(
    subtitleRect.left,
    subtitleRect.top,
    subtitleRect.left,
    subtitleRect.top + subtitleRect.width * 0.35
  )
  subtitleGradient.addColorStop(0, isYellow ? "#111827" : "#e62020")
  subtitleGradient.addColorStop(1, isYellow ? "#111827" : "#a00000")
  context.save()
  context.fillStyle = subtitleGradient
  context.shadowColor = "rgba(0,0,0,0.28)"
  context.shadowBlur = 10
  context.shadowOffsetY = 5
  context.beginPath()
  context.roundRect(
    subtitleRect.left,
    subtitleRect.top - subtitleRect.width * 0.11,
    subtitleRect.width,
    subtitleRect.width * 0.22,
    isYellow ? 999 : 24
  )
  context.fill()
  context.restore()
  drawPosterText({
    context,
    area: layout.subtitle,
    text: subtitle,
    fontSize: Math.max(poster.sale_unit_size, isYellow ? 24 : 32) * scale,
    color: isYellow ? "#ffe100" : "#ffd400",
    weight: 900,
    canvasWidth,
    canvasHeight,
  })

  if (product) {
    drawPosterText({
      context,
      area: layout.product,
      text: product,
      fontSize: poster.product_name_size * scale,
      color: textColor,
      weight: 900,
      canvasWidth,
      canvasHeight,
    })
  }

  if (description) {
    drawPosterText({
      context,
      area: layout.description,
      text: description,
      fontSize: poster.description_size * scale,
      color: textColor,
      weight: 900,
      canvasWidth,
      canvasHeight,
    })
  }

  if (price) {
    const priceRect = areaRect(layout.price, canvasWidth, canvasHeight)
    drawBrush(
      context,
      canvasWidth * 0.05,
      priceRect.top - canvasHeight * 0.04,
      canvasWidth * 0.9,
      Math.max(92 * scale, canvasHeight * 0.09)
    )

    context.save()
    context.font = `900 ${Math.max(poster.price_size * scale, 44)}px Arial Black, Arial, Helvetica, sans-serif`
    context.textAlign = "center"
    context.textBaseline = "middle"
    context.fillStyle = priceColor
    context.fillText(
      priceParts(price).toUpperCase(),
      priceRect.left + priceRect.width / 2,
      priceRect.top
    )
    context.font = `900 ${Math.max(poster.sale_unit_size * scale, 18)}px Arial Black, Arial, Helvetica, sans-serif`
    context.textAlign = "right"
    context.fillStyle = textColor
    context.fillText("R$", priceRect.left + priceRect.width * 0.06, priceRect.top + canvasHeight * 0.006)
    context.restore()
  }

  if (unit) {
    drawPosterText({
      context,
      area: layout.unit,
      text: unit,
      fontSize: poster.sale_unit_size * scale,
      color: textColor,
      weight: 900,
      canvasWidth,
      canvasHeight,
    })
  }

  drawPosterText({
    context,
    area: layout.footer,
    text: poster.footer || "UNYX",
    fontSize: poster.sale_unit_size * scale,
    color: isYellow ? "#ffffff" : "#d50000",
    weight: 900,
    canvasWidth,
    canvasHeight,
  })
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

  if (template.kind === "guided") {
    drawGuidedPoster(context, data, canvasWidth, canvasHeight)
    downloadCanvas(canvas, `${safeFileName(data.product_name || data.title || "cartaz")}.png`)
    return
  }

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
