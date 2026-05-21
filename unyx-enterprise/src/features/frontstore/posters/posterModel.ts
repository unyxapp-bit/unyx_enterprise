import {
  getPosterTemplate,
  positionFields,
  type PosterArea,
  type PosterPositionAxis,
  type PosterTemplate,
} from "@/features/frontstore/posters/posterConfig"
import type {
  OperationalPoster,
  OperationalPosterFormat,
  OperationalPosterLayoutConfig,
  OperationalPosterLayoutField,
  OperationalPosterTextStyleConfig,
  OperationalPosterTone,
} from "@/types/domain"

export type PosterCanvasData = {
  template_key: string | null
  title: string
  subtitle: string | null
  body: string
  footer: string | null
  product_name: string | null
  product_description: string | null
  price_text: string | null
  sale_unit: string | null
  subtitle_size: number
  product_name_size: number
  description_size: number
  price_size: number
  sale_unit_size: number
  footer_size: number
  price_cents_scale: number
  layout_config: OperationalPosterLayoutConfig | null
  tone: OperationalPosterTone
  format: OperationalPosterFormat
}

export const emptyPosterForm = {
  branch_id: "",
  sector_id: "",
  template_key: "super-oferta-guiada",
  title: "",
  subtitle: "",
  body: "",
  footer: "",
  product_name: "",
  product_description: "",
  price_text: "",
  sale_unit: "unid",
  subtitle_size: "34",
  product_name_size: "54",
  description_size: "24",
  price_size: "112",
  sale_unit_size: "30",
  footer_size: "24",
  price_cents_scale: "100",
  subtitle_x: "",
  subtitle_y: "",
  product_x: "",
  product_y: "",
  description_x: "",
  description_y: "",
  price_x: "",
  price_y: "",
  unit_x: "",
  unit_y: "",
  footer_x: "",
  footer_y: "",
  tone: "attention" as OperationalPosterTone,
  format: "a4" as OperationalPosterFormat,
}

export type PosterForm = typeof emptyPosterForm

export const posterTextSizeLimits = {
  subtitle: { min: 10, max: 64, fallback: 34 },
  product: { min: 18, max: 112, fallback: 54 },
  description: { min: 10, max: 64, fallback: 24 },
  price: { min: 36, max: 170, fallback: 112 },
  unit: { min: 10, max: 58, fallback: 30 },
  footer: { min: 10, max: 48, fallback: 24 },
} as const satisfies Record<
  OperationalPosterLayoutField,
  { min: number; max: number; fallback: number }
>

export function clampPosterTextSize(
  field: OperationalPosterLayoutField,
  value: string | number | null | undefined
) {
  const limit = posterTextSizeLimits[field]
  return clamp(toNumber(value, limit.fallback), limit.min, limit.max)
}

export const positionFormKeys = {
  subtitle: { x: "subtitle_x", y: "subtitle_y" },
  product: { x: "product_x", y: "product_y" },
  description: { x: "description_x", y: "description_y" },
  price: { x: "price_x", y: "price_y" },
  unit: { x: "unit_x", y: "unit_y" },
  footer: { x: "footer_x", y: "footer_y" },
} as const satisfies Record<
  OperationalPosterLayoutField,
  Record<PosterPositionAxis, keyof PosterForm>
>

export type PositionFormKey =
  (typeof positionFormKeys)[OperationalPosterLayoutField][PosterPositionAxis]

export function scopeLabel(poster: OperationalPoster) {
  const branch = poster.branches?.name ?? "Toda empresa"
  return poster.sectors?.name ? `${branch} - ${poster.sectors.name}` : branch
}

export function toNumber(value: string | number | null | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function formatDecimal(value: number) {
  return String(Math.round(value * 10) / 10)
}

export function percentNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? clamp(value, 0, 100) : null
  }
  if (typeof value === "string") {
    const parsed = Number(value.replace("%", "").trim())
    return Number.isFinite(parsed) ? clamp(parsed, 0, 100) : null
  }
  return null
}

function formatPercentValue(value: number) {
  return formatDecimal(clamp(value, 0, 100))
}

function styleNumber(value: unknown, min: number, max: number) {
  const parsed = typeof value === "string" ? Number(value) : value
  return typeof parsed === "number" && Number.isFinite(parsed) && parsed > 0
    ? clamp(parsed, min, max)
    : null
}

function centsScaleNumber(value: unknown) {
  const parsed = typeof value === "string" ? Number(value) : value
  if (typeof parsed !== "number" || !Number.isFinite(parsed) || parsed <= 0) return null

  const scale = parsed > 1 ? parsed / 100 : parsed
  return clamp(scale, 0.35, 1)
}

function priceCentsScaleFromForm(value: string) {
  return value === "50" ? 0.5 : 1
}

function normalizeTextStyle(
  value: OperationalPosterTextStyleConfig | null | undefined
): OperationalPosterTextStyleConfig | null {
  const subtitleSize = styleNumber(value?.subtitle_size, 8, 120)
  const footerSize = styleNumber(value?.footer_size, 8, 120)
  const priceCentsScale = centsScaleNumber(value?.price_cents_scale)
  const next: OperationalPosterTextStyleConfig = {}

  if (subtitleSize !== null) next.subtitle_size = subtitleSize
  if (footerSize !== null) next.footer_size = footerSize
  if (priceCentsScale !== null && priceCentsScale < 0.99) {
    next.price_cents_scale = priceCentsScale
  }

  return Object.keys(next).length > 0 ? next : null
}

function textStyleSize(
  layoutConfig: OperationalPosterLayoutConfig | null,
  key: "subtitle_size" | "footer_size",
  fallback: number
) {
  return styleNumber(layoutConfig?.text_style?.[key], 8, 120) ?? fallback
}

function textStylePriceCentsScale(layoutConfig: OperationalPosterLayoutConfig | null) {
  return centsScaleNumber(layoutConfig?.text_style?.price_cents_scale) ?? 1
}

function areaPercent(area: PosterArea, axis: PosterPositionAxis) {
  return percentNumber(axis === "x" ? area.left : area.top) ?? 0
}

function aspectRatioNumbers(aspectRatio: string) {
  const [rawWidth, rawHeight] = aspectRatio.split("/").map((value) => Number(value.trim()))
  if (
    !Number.isFinite(rawWidth) ||
    !Number.isFinite(rawHeight) ||
    rawWidth <= 0 ||
    rawHeight <= 0
  ) {
    return { width: 210, height: 297 }
  }

  return { width: rawWidth, height: rawHeight }
}

function fieldText(form: PosterForm, field: OperationalPosterLayoutField) {
  if (field === "subtitle") return form.subtitle || "OFERTA"
  if (field === "product") return form.product_name || form.title || "PRODUTO"
  if (field === "description") return form.product_description || form.body || "DESCRICAO"
  if (field === "price") return form.price_text || "0,00"
  if (field === "unit") return form.sale_unit || "UNID"
  return form.footer || "UNYX"
}

function fieldSize(form: PosterForm, field: OperationalPosterLayoutField) {
  if (field === "subtitle") return clampPosterTextSize(field, form.subtitle_size)
  if (field === "product") return clampPosterTextSize(field, form.product_name_size)
  if (field === "description") return clampPosterTextSize(field, form.description_size)
  if (field === "price") return clampPosterTextSize(field, form.price_size)
  if (field === "unit") return clampPosterTextSize(field, form.sale_unit_size)
  return clampPosterTextSize(field, form.footer_size)
}

function estimatedLineCount(
  form: PosterForm,
  field: OperationalPosterLayoutField,
  area: PosterArea
) {
  const text = fieldText(form, field)
  if (field === "price" || field === "unit" || field === "footer" || field === "subtitle") {
    return Math.max(1, text.split(/\n/).filter(Boolean).length)
  }

  const widthPercent = percentNumber(area.width) ?? 100
  const widthPx = Math.max(120, (620 * widthPercent) / 100)
  const fontSize = fieldSize(form, field)
  const charsPerLine = Math.max(6, Math.floor(widthPx / Math.max(fontSize * 0.58, 1)))

  return Math.max(
    1,
    text
      .split(/\n/)
      .filter(Boolean)
      .reduce((total, line) => total + Math.max(1, Math.ceil(line.length / charsPerLine)), 0)
  )
}

function estimatedFieldHeightPercent(
  form: PosterForm,
  field: OperationalPosterLayoutField,
  area: PosterArea
) {
  const template = getPosterTemplate(form.template_key)
  const ratio = aspectRatioNumbers(template.aspectRatio)
  const canvasHeight = 620 * (ratio.height / ratio.width)
  const size = fieldSize(form, field)
  const lines = estimatedLineCount(form, field, area)
  const lineHeightByField: Record<OperationalPosterLayoutField, number> = {
    subtitle: 1.1,
    product: 0.94,
    description: 1.12,
    price: 0.92,
    unit: 1,
    footer: 1.15,
  }
  const extraHeightByField: Record<OperationalPosterLayoutField, number> = {
    subtitle: 16,
    product: 4,
    description: 4,
    price: template.kind === "guided" ? 28 : 4,
    unit: 4,
    footer: 4,
  }
  const fieldHeight =
    field === "price" && template.kind === "guided"
      ? Math.max(size * 0.92, 92) + extraHeightByField.price
      : size * lineHeightByField[field] * lines + extraHeightByField[field]

  return clamp((fieldHeight / canvasHeight) * 100, 1, 96)
}

export function getFieldPositionBounds(
  form: PosterForm,
  field: OperationalPosterLayoutField
) {
  const template = getPosterTemplate(form.template_key)
  const area = template.layout[field]
  const margin = 3
  const width = percentNumber(area.width) ?? 100
  const halfWidth = Math.min(width / 2, 50 - margin)
  const halfHeight = Math.min(estimatedFieldHeightPercent(form, field, area) / 2, 50 - margin)
  const xMin = clamp(margin + halfWidth, 0, 100)
  const xMax = clamp(100 - margin - halfWidth, xMin, 100)
  const yMin = clamp(margin + halfHeight, 0, 100)
  const yMax = clamp(100 - margin - halfHeight, yMin, 100)

  return {
    x: { min: formatDecimal(xMin), max: formatDecimal(xMax) },
    y: { min: formatDecimal(yMin), max: formatDecimal(yMax) },
  }
}

export function clampFieldPositionValue(
  form: PosterForm,
  field: OperationalPosterLayoutField,
  axis: PosterPositionAxis,
  value: string | number | null | undefined
) {
  const parsed = percentNumber(value)
  const bounds = getFieldPositionBounds(form, field)[axis]
  const min = Number(bounds.min)
  const max = Number(bounds.max)
  const fallback = areaDefaultPosition(getPosterTemplate(form.template_key).layout[field], axis)

  return formatDecimal(clamp(parsed ?? fallback, min, max))
}

export function areaDefaultPosition(area: PosterArea, axis: PosterPositionAxis) {
  if (axis === "y") return areaPercent(area, "y")

  const left = percentNumber(area.left) ?? 0
  const width = percentNumber(area.width) ?? 0
  return clamp(left + width / 2, 0, 100)
}

function cssPercent(value: number) {
  return `${formatPercentValue(value)}%`
}

function layoutPositionValue(
  layoutConfig: OperationalPosterLayoutConfig | null | undefined,
  field: OperationalPosterLayoutField,
  axis: PosterPositionAxis,
  fallbackArea: PosterArea
) {
  const value = percentNumber(layoutConfig?.[field]?.[axis])

  if (value === null) return formatPercentValue(areaDefaultPosition(fallbackArea, axis))

  if (axis === "x" && layoutConfig?.mode !== "center") {
    const width = percentNumber(fallbackArea.width) ?? 0
    return formatPercentValue(clamp(value + width / 2, 0, 100))
  }

  return formatPercentValue(value)
}

export function normalizeLayoutConfig(
  value: OperationalPosterLayoutConfig | null | undefined
): OperationalPosterLayoutConfig | null {
  const next: OperationalPosterLayoutConfig = value?.mode === "center" ? { mode: "center" } : {}
  const textStyle = normalizeTextStyle(value?.text_style)

  for (const { field } of positionFields) {
    const x = percentNumber(value?.[field]?.x)
    const y = percentNumber(value?.[field]?.y)
    if (x !== null || y !== null) {
      next[field] = {
        ...(x !== null ? { x } : {}),
        ...(y !== null ? { y } : {}),
      }
    }
  }

  if (textStyle) next.text_style = textStyle

  return positionFields.some(({ field }) => Boolean(next[field])) || textStyle ? next : null
}

function layoutConfigPosition(
  layoutConfig: OperationalPosterLayoutConfig | null,
  field: OperationalPosterLayoutField,
  area: PosterArea,
  axis: PosterPositionAxis
) {
  const value = percentNumber(layoutConfig?.[field]?.[axis])
  if (value === null) return areaDefaultPosition(area, axis)

  if (axis === "x" && layoutConfig?.mode !== "center") {
    const width = percentNumber(area.width) ?? 0
    return clamp(value + width / 2, 0, 100)
  }

  return value
}

function areaWithPosition(
  area: PosterArea,
  layoutConfig: OperationalPosterLayoutConfig | null,
  field: OperationalPosterLayoutField
): PosterArea {
  const width = percentNumber(area.width) ?? 0
  const centerX = layoutConfigPosition(layoutConfig, field, area, "x")
  const top = layoutConfigPosition(layoutConfig, field, area, "y")

  return {
    ...area,
    left: cssPercent(clamp(centerX - width / 2, 0, Math.max(0, 100 - width))),
    top: cssPercent(top),
  }
}

export function resolveTemplateLayout(
  layout: PosterTemplate["layout"],
  layoutConfig: OperationalPosterLayoutConfig | null
): PosterTemplate["layout"] {
  return {
    subtitle: areaWithPosition(layout.subtitle, layoutConfig, "subtitle"),
    product: areaWithPosition(layout.product, layoutConfig, "product"),
    description: areaWithPosition(layout.description, layoutConfig, "description"),
    price: areaWithPosition(layout.price, layoutConfig, "price"),
    unit: areaWithPosition(layout.unit, layoutConfig, "unit"),
    footer: areaWithPosition(layout.footer, layoutConfig, "footer"),
  }
}

export function buildLayoutConfigFromForm(form: PosterForm): OperationalPosterLayoutConfig | null {
  const template = getPosterTemplate(form.template_key)
  const next: OperationalPosterLayoutConfig = { mode: "center" }
  const unitSize = clampPosterTextSize("unit", form.sale_unit_size)
  const textStyle: OperationalPosterTextStyleConfig = {}

  for (const { field } of positionFields) {
    const xKey = positionFormKeys[field].x
    const yKey = positionFormKeys[field].y
    const area = template.layout[field]
    const rawX = percentNumber(form[xKey])
    const rawY = percentNumber(form[yKey])
    const x =
      rawX === null ? null : percentNumber(clampFieldPositionValue(form, field, "x", rawX))
    const y =
      rawY === null ? null : percentNumber(clampFieldPositionValue(form, field, "y", rawY))
    const defaultX =
      percentNumber(clampFieldPositionValue(form, field, "x", areaDefaultPosition(area, "x"))) ??
      areaDefaultPosition(area, "x")
    const defaultY =
      percentNumber(clampFieldPositionValue(form, field, "y", areaDefaultPosition(area, "y"))) ??
      areaDefaultPosition(area, "y")
    const fieldConfig: { x?: number; y?: number } = {}

    if (x !== null && Math.abs(x - defaultX) > 0.05) fieldConfig.x = x
    if (y !== null && Math.abs(y - defaultY) > 0.05) fieldConfig.y = y
    if (Object.keys(fieldConfig).length > 0) next[field] = fieldConfig
  }

  const subtitleSize = clampPosterTextSize("subtitle", form.subtitle_size)
  const footerSize = clampPosterTextSize("footer", form.footer_size)
  const priceCentsScale = priceCentsScaleFromForm(form.price_cents_scale)

  if (Math.abs(subtitleSize - unitSize) > 0.05) textStyle.subtitle_size = subtitleSize
  if (Math.abs(footerSize - unitSize) > 0.05) textStyle.footer_size = footerSize
  if (priceCentsScale < 0.99) textStyle.price_cents_scale = priceCentsScale
  if (Object.keys(textStyle).length > 0) next.text_style = textStyle

  return positionFields.some(({ field }) => Boolean(next[field])) ||
    Object.keys(textStyle).length > 0
    ? next
    : null
}

export function getFormPositionValue(
  form: PosterForm,
  field: OperationalPosterLayoutField,
  axis: PosterPositionAxis
) {
  const value = form[positionFormKeys[field][axis]]
  if (value !== "") return clampFieldPositionValue(form, field, axis, value)

  const template = getPosterTemplate(form.template_key)
  return clampFieldPositionValue(
    form,
    field,
    axis,
    layoutPositionValue(null, field, axis, template.layout[field])
  )
}

export function formPositionsFromLayoutConfig(
  layoutConfig: OperationalPosterLayoutConfig | null,
  templateKey: string | null
): Record<PositionFormKey, string> {
  const template = getPosterTemplate(templateKey)
  return {
    subtitle_x: layoutPositionValue(layoutConfig, "subtitle", "x", template.layout.subtitle),
    subtitle_y: layoutPositionValue(layoutConfig, "subtitle", "y", template.layout.subtitle),
    product_x: layoutPositionValue(layoutConfig, "product", "x", template.layout.product),
    product_y: layoutPositionValue(layoutConfig, "product", "y", template.layout.product),
    description_x: layoutPositionValue(
      layoutConfig,
      "description",
      "x",
      template.layout.description
    ),
    description_y: layoutPositionValue(
      layoutConfig,
      "description",
      "y",
      template.layout.description
    ),
    price_x: layoutPositionValue(layoutConfig, "price", "x", template.layout.price),
    price_y: layoutPositionValue(layoutConfig, "price", "y", template.layout.price),
    unit_x: layoutPositionValue(layoutConfig, "unit", "x", template.layout.unit),
    unit_y: layoutPositionValue(layoutConfig, "unit", "y", template.layout.unit),
    footer_x: layoutPositionValue(layoutConfig, "footer", "x", template.layout.footer),
    footer_y: layoutPositionValue(layoutConfig, "footer", "y", template.layout.footer),
  }
}

export function formToCanvasData(form: PosterForm): PosterCanvasData {
  const productName = form.product_name.trim()
  const productDescription = form.product_description.trim()
  const unitSize = clampPosterTextSize("unit", form.sale_unit_size)

  return {
    template_key: form.template_key === "blank" ? null : form.template_key,
    title: productName || form.title,
    subtitle: form.subtitle.trim() || null,
    body: productDescription || form.body,
    footer: form.footer.trim() || null,
    product_name: productName || null,
    product_description: productDescription || null,
    price_text: form.price_text.trim() || null,
    sale_unit: form.sale_unit.trim() || null,
    subtitle_size: clampPosterTextSize("subtitle", form.subtitle_size),
    product_name_size: clampPosterTextSize("product", form.product_name_size),
    description_size: clampPosterTextSize("description", form.description_size),
    price_size: clampPosterTextSize("price", form.price_size),
    sale_unit_size: unitSize,
    footer_size: clampPosterTextSize("footer", form.footer_size),
    price_cents_scale: priceCentsScaleFromForm(form.price_cents_scale),
    layout_config: buildLayoutConfigFromForm(form),
    tone: form.tone,
    format: form.format,
  }
}

export function posterToCanvasData(poster: OperationalPoster): PosterCanvasData {
  const layoutConfig = normalizeLayoutConfig(poster.layout_config)
  const unitSize = clampPosterTextSize("unit", poster.sale_unit_size)

  return {
    template_key: poster.template_key,
    title: poster.title,
    subtitle: poster.subtitle,
    body: poster.body,
    footer: poster.footer,
    product_name: poster.product_name,
    product_description: poster.product_description,
    price_text: poster.price_text,
    sale_unit: poster.sale_unit,
    subtitle_size: clampPosterTextSize(
      "subtitle",
      textStyleSize(layoutConfig, "subtitle_size", unitSize)
    ),
    product_name_size: clampPosterTextSize("product", poster.product_name_size),
    description_size: clampPosterTextSize("description", poster.description_size),
    price_size: clampPosterTextSize("price", poster.price_size),
    sale_unit_size: unitSize,
    footer_size: clampPosterTextSize(
      "footer",
      textStyleSize(layoutConfig, "footer_size", unitSize)
    ),
    price_cents_scale: textStylePriceCentsScale(layoutConfig),
    layout_config: layoutConfig,
    tone: poster.tone,
    format: poster.format,
  }
}

export function formToPosterPayload(form: PosterForm) {
  const productName = form.product_name.trim()
  const productDescription = form.product_description.trim()
  const priceText = form.price_text.trim()
  const saleUnit = form.sale_unit.trim()

  return {
    branch_id: form.branch_id || null,
    sector_id: form.sector_id || null,
    template_key: form.template_key === "blank" ? null : form.template_key,
    title: productName,
    subtitle: form.subtitle || null,
    body: productDescription,
    footer: form.footer || null,
    product_name: productName,
    product_description: productDescription,
    price_text: priceText,
    sale_unit: saleUnit,
    product_name_size: clampPosterTextSize("product", form.product_name_size),
    description_size: clampPosterTextSize("description", form.description_size),
    price_size: clampPosterTextSize("price", form.price_size),
    sale_unit_size: clampPosterTextSize("unit", form.sale_unit_size),
    layout_config: buildLayoutConfigFromForm(form),
    tone: form.tone,
    format: form.format,
  }
}

export function posterToForm(poster: OperationalPoster): PosterForm {
  const templateKey = poster.template_key ?? "blank"
  const layoutConfig = normalizeLayoutConfig(poster.layout_config)
  const unitSize = clampPosterTextSize("unit", poster.sale_unit_size)

  return {
    ...emptyPosterForm,
    branch_id: poster.branch_id ?? "",
    sector_id: poster.sector_id ?? "",
    template_key: templateKey,
    title: poster.title,
    subtitle: poster.subtitle ?? "",
    body: poster.body,
    footer: poster.footer ?? "",
    product_name: poster.product_name ?? poster.title,
    product_description: poster.product_description ?? poster.body,
    price_text: poster.price_text ?? "",
    sale_unit: poster.sale_unit ?? "unid",
    subtitle_size: String(
      clampPosterTextSize("subtitle", textStyleSize(layoutConfig, "subtitle_size", unitSize))
    ),
    product_name_size: String(clampPosterTextSize("product", poster.product_name_size)),
    description_size: String(clampPosterTextSize("description", poster.description_size)),
    price_size: String(clampPosterTextSize("price", poster.price_size)),
    sale_unit_size: String(unitSize),
    footer_size: String(
      clampPosterTextSize("footer", textStyleSize(layoutConfig, "footer_size", unitSize))
    ),
    price_cents_scale: textStylePriceCentsScale(layoutConfig) < 0.99 ? "50" : "100",
    ...formPositionsFromLayoutConfig(layoutConfig, templateKey),
    tone: poster.tone,
    format: poster.format,
  }
}

export function posterToDuplicatePayload(poster: OperationalPoster) {
  const form = posterToForm(poster)
  const baseName = form.product_name.trim() || form.title.trim() || "Cartaz"
  const copyName = `${baseName} copia`

  return formToPosterPayload({
    ...form,
    title: copyName,
    product_name: copyName,
  })
}
