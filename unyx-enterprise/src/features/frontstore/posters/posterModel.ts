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
  product_name_size: number
  description_size: number
  price_size: number
  sale_unit_size: number
  layout_config: OperationalPosterLayoutConfig | null
  tone: OperationalPosterTone
  format: OperationalPosterFormat
}

export const emptyPosterForm = {
  branch_id: "",
  sector_id: "",
  template_key: "blank",
  title: "",
  subtitle: "",
  body: "",
  footer: "",
  product_name: "",
  product_description: "",
  price_text: "",
  sale_unit: "unid",
  product_name_size: "34",
  description_size: "18",
  price_size: "76",
  sale_unit_size: "20",
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
  return String(Math.round(clamp(value, 0, 100) * 10) / 10)
}

function areaPercent(area: PosterArea, axis: PosterPositionAxis) {
  return percentNumber(axis === "x" ? area.left : area.top) ?? 0
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

  return positionFields.some(({ field }) => Boolean(next[field])) ? next : null
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

  for (const { field } of positionFields) {
    const xKey = positionFormKeys[field].x
    const yKey = positionFormKeys[field].y
    const area = template.layout[field]
    const x = percentNumber(form[xKey])
    const y = percentNumber(form[yKey])
    const defaultX = areaDefaultPosition(area, "x")
    const defaultY = areaDefaultPosition(area, "y")
    const fieldConfig: { x?: number; y?: number } = {}

    if (x !== null && Math.abs(x - defaultX) > 0.05) fieldConfig.x = x
    if (y !== null && Math.abs(y - defaultY) > 0.05) fieldConfig.y = y
    if (Object.keys(fieldConfig).length > 0) next[field] = fieldConfig
  }

  return positionFields.some(({ field }) => Boolean(next[field])) ? next : null
}

export function getFormPositionValue(
  form: PosterForm,
  field: OperationalPosterLayoutField,
  axis: PosterPositionAxis
) {
  const value = form[positionFormKeys[field][axis]]
  if (value !== "") return value

  const template = getPosterTemplate(form.template_key)
  return layoutPositionValue(null, field, axis, template.layout[field])
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
    product_name_size: toNumber(form.product_name_size, 34),
    description_size: toNumber(form.description_size, 18),
    price_size: toNumber(form.price_size, 76),
    sale_unit_size: toNumber(form.sale_unit_size, 20),
    layout_config: buildLayoutConfigFromForm(form),
    tone: form.tone,
    format: form.format,
  }
}

export function posterToCanvasData(poster: OperationalPoster): PosterCanvasData {
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
    product_name_size: poster.product_name_size ?? 34,
    description_size: poster.description_size ?? 18,
    price_size: poster.price_size ?? 76,
    sale_unit_size: poster.sale_unit_size ?? 20,
    layout_config: normalizeLayoutConfig(poster.layout_config),
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
    product_name_size: toNumber(form.product_name_size, 34),
    description_size: toNumber(form.description_size, 18),
    price_size: toNumber(form.price_size, 76),
    sale_unit_size: toNumber(form.sale_unit_size, 20),
    layout_config: buildLayoutConfigFromForm(form),
    tone: form.tone,
    format: form.format,
  }
}

export function posterToForm(poster: OperationalPoster): PosterForm {
  const templateKey = poster.template_key ?? "blank"
  const layoutConfig = normalizeLayoutConfig(poster.layout_config)

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
    product_name_size: String(poster.product_name_size ?? 34),
    description_size: String(poster.description_size ?? 18),
    price_size: String(poster.price_size ?? 76),
    sale_unit_size: String(poster.sale_unit_size ?? 20),
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
