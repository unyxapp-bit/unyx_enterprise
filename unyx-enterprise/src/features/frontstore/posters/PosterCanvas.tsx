import type { CSSProperties } from "react"

import {
  getPosterTemplate,
  paperAspectByFormat,
  printScaleByFormat,
  templateUrl,
  type PosterArea,
} from "@/features/frontstore/posters/posterConfig"
import {
  clamp,
  posterToCanvasData,
  resolveTemplateLayout,
  type PosterCanvasData,
} from "@/features/frontstore/posters/posterModel"
import type { OperationalPoster, OperationalPosterTone } from "@/types/domain"

function blankToneStyle(tone: OperationalPosterTone): CSSProperties {
  if (tone === "urgent") return { backgroundColor: "#fff1f2", borderColor: "#dc2626" }
  if (tone === "success") return { backgroundColor: "#ecfdf5", borderColor: "#059669" }
  if (tone === "info") return { backgroundColor: "#f0f9ff", borderColor: "#0284c7" }
  if (tone === "attention") return { backgroundColor: "#fffbeb", borderColor: "#f59e0b" }
  return { backgroundColor: "#ffffff", borderColor: "#111827" }
}

function areaStyle(
  area: PosterArea,
  size: number,
  scale: number,
  color: string,
  weight: number
): CSSProperties {
  return {
    position: "absolute",
    zIndex: 1,
    left: area.left,
    top: area.top,
    width: area.width,
    transform: "translateY(-50%)",
    color: area.color ?? color,
    fontFamily: "Arial Black, Arial, Helvetica, sans-serif",
    fontSize: `${clamp(size * scale, 8, 320)}px`,
    fontWeight: weight,
    letterSpacing: 0,
    lineHeight: 1,
    overflowWrap: "anywhere",
    textAlign: area.align ?? "center",
    textShadow: "0 1px 2px rgba(255,255,255,0.72)",
    textTransform: "uppercase",
  }
}

export function PosterCanvas({
  data,
  compact = false,
  print = false,
  showPlaceholders = false,
  textScale,
}: {
  data: PosterCanvasData
  compact?: boolean
  print?: boolean
  showPlaceholders?: boolean
  textScale?: number
}) {
  const template = getPosterTemplate(data.template_key)
  const hasTemplate = Boolean(template.file)
  const scale = textScale ?? (print ? printScaleByFormat[data.format] : compact ? 0.36 : 0.5)
  const textColor = template.textColor ?? "#111827"
  const priceColor = template.priceColor ?? textColor
  const layout = resolveTemplateLayout(template.layout, data.layout_config)
  const subtitleText =
    data.subtitle || (!hasTemplate && showPlaceholders ? "OFERTA" : "")
  const productName =
    data.product_name || data.title || (showPlaceholders ? "NOME DO PRODUTO" : "")
  const productDescription =
    data.product_description || data.body || (showPlaceholders ? "Descricao da oferta" : "")
  const priceText = data.price_text || (showPlaceholders ? "R$ 0,00" : "")
  const unitText = data.sale_unit || (showPlaceholders ? "unid" : "")

  return (
    <div
      className="poster-template-canvas relative isolate overflow-hidden rounded-lg border bg-white shadow-sm"
      style={{
        aspectRatio: print ? paperAspectByFormat[data.format] : template.aspectRatio,
        ...(hasTemplate ? {} : blankToneStyle(data.tone)),
      }}
    >
      {hasTemplate ? (
        <img
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 size-full object-fill"
          draggable={false}
          src={templateUrl(template)}
        />
      ) : null}

      {subtitleText ? (
        <div
          style={{
            ...areaStyle(layout.subtitle, Math.max(data.sale_unit_size, 18), scale, textColor, 900),
            zIndex: 2,
            borderBottom: !hasTemplate ? "4px solid currentColor" : undefined,
            paddingBottom: !hasTemplate ? "0.35rem" : undefined,
            lineHeight: 1.05,
          }}
        >
          {subtitleText}
        </div>
      ) : null}

      {productName ? (
        <div
          style={areaStyle(
            layout.product,
            data.product_name_size,
            scale,
            textColor,
            900
          )}
        >
          {productName}
        </div>
      ) : null}

      {productDescription ? (
        <div
          style={{
            ...areaStyle(
              layout.description,
              data.description_size,
              scale,
              textColor,
              800
            ),
            lineHeight: 1.12,
          }}
        >
          {productDescription}
        </div>
      ) : null}

      {priceText ? (
        <div
          style={{
            ...areaStyle(layout.price, data.price_size, scale, priceColor, 900),
            lineHeight: 0.92,
          }}
        >
          {priceText}
        </div>
      ) : null}

      {unitText ? (
        <div
          style={areaStyle(
            layout.unit,
            data.sale_unit_size,
            scale,
            textColor,
            900
          )}
        >
          {unitText}
        </div>
      ) : null}

      {data.footer ? (
        <div
          style={{
            ...areaStyle(layout.footer, data.sale_unit_size, scale, textColor, 900),
            lineHeight: 1.15,
          }}
        >
          {data.footer}
        </div>
      ) : null}
    </div>
  )
}

export function PrintablePoster({ poster }: { poster: OperationalPoster }) {
  return (
    <div className={`poster-print-root poster-tone-${poster.tone} poster-format-${poster.format}`}>
      <PosterCanvas data={posterToCanvasData(poster)} print />
    </div>
  )
}
