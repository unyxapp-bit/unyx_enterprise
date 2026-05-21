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
  percentNumber,
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
    whiteSpace: "pre-line",
  }
}

function priceParts(value: string) {
  const clean = value.replace(/^R\$\s*/i, "").trim()
  return {
    currency: value.trim().toUpperCase().startsWith("R$") ? "R$" : "R$",
    value: clean || value,
  }
}

function priceAmountParts(value: string) {
  const clean = value.trim()
  const match = clean.match(/^(.*?)([,.]\d{1,3})$/)

  if (!match) return { main: clean, cents: "" }

  return {
    main: match[1] || "0",
    cents: match[2],
  }
}

function priceJustify(area: PosterArea) {
  if (area.align === "left") return "flex-start"
  if (area.align === "right") return "flex-end"
  return "center"
}

function PriceAmount({
  centsScale,
  value,
}: {
  centsScale: number
  value: string
}) {
  const price = priceAmountParts(value)

  if (centsScale >= 0.99 || !price.cents) return <>{value}</>

  return (
    <>
      <span>{price.main}</span>
      <span style={{ fontSize: `${centsScale}em`, lineHeight: 1, marginTop: "0.04em" }}>
        {price.cents}
      </span>
    </>
  )
}

function posterAreaCenter(area: PosterArea, axis: "x" | "y") {
  if (axis === "y") return percentNumber(area.top) ?? 0
  const left = percentNumber(area.left) ?? 0
  const width = percentNumber(area.width) ?? 0
  return clamp(left + width / 2, 0, 100)
}

function guidedBrushStyle(area: PosterArea, scale: number): CSSProperties {
  const centerY = posterAreaCenter(area, "y")

  return {
    position: "absolute",
    zIndex: 1,
    left: "5%",
    top: `${clamp(centerY + 2, 0, 100)}%`,
    width: "90%",
    height: `${clamp(86 * scale, 42, 180)}px`,
    transform: "translateY(-50%) rotate(-4deg)",
    background: "#ffd900",
    clipPath:
      "polygon(2% 25%, 96% 0%, 100% 18%, 94% 28%, 100% 45%, 97% 75%, 5% 100%, 0% 80%, 4% 65%, 0% 50%)",
  }
}

function GuidedPosterCanvas({
  data,
  textScale,
  showPlaceholders,
}: {
  data: PosterCanvasData
  textScale: number
  showPlaceholders: boolean
}) {
  const template = getPosterTemplate(data.template_key)
  const layout = resolveTemplateLayout(template.layout, data.layout_config)
  const variant = template.guidedVariant ?? "super-offer"
  const isYellow = variant === "yellow-offer"
  const textColor = template.textColor ?? "#111827"
  const priceColor = template.priceColor ?? "#c4282f"
  const subtitleText =
    data.subtitle || (isYellow ? "OFERTA" : "SUPER\nOFERTA")
  const productName =
    data.product_name || data.title || (showPlaceholders ? "NOME DO PRODUTO" : "")
  const productDescription =
    data.product_description || data.body || (showPlaceholders ? "Descricao da oferta" : "")
  const priceText = data.price_text || (showPlaceholders ? "0,00" : "")
  const unitText = data.sale_unit || (showPlaceholders ? "unid" : "")
  const price = priceParts(priceText)

  return (
    <div
      className="poster-template-canvas relative isolate overflow-hidden rounded-lg border bg-white shadow-sm"
      style={{ aspectRatio: template.aspectRatio }}
    >
      {isYellow ? (
        <>
          <div className="absolute inset-0 bg-[#ffe100]" />
          <div className="absolute inset-x-0 top-0 h-[18%] bg-[#111827]" />
          <div className="absolute left-[-8%] top-[16%] h-[12%] w-[116%] -rotate-3 bg-[#dc2626]" />
          <div className="absolute inset-x-0 bottom-0 h-[8%] bg-[#111827]" />
          <div className="absolute bottom-[8%] left-[-5%] h-[5%] w-[110%] rotate-2 bg-[#dc2626]" />
        </>
      ) : (
        <>
          <div className="absolute inset-0 bg-white" />
          <div className="absolute inset-x-0 top-0 h-[15%] bg-[linear-gradient(90deg,#f8fafc,#e2e8f0,#ffffff,#dbeafe)]" />
          <div className="absolute inset-x-0 top-[15%] h-[2.4%] bg-[#b40000]" />
          <div className="absolute left-0 top-0 h-[15%] w-full opacity-60 [background:repeating-linear-gradient(90deg,#dbeafe_0_24px,#f8fafc_24px_48px)]" />
          <div className="absolute inset-x-0 bottom-0 h-[7.5%] border-t-[12px] border-[#b40000] bg-[linear-gradient(90deg,#e5e7eb,#ffffff,#d1d5db)]" />
        </>
      )}

      <div
        style={{
          ...areaStyle(
            layout.subtitle,
            Math.max(data.subtitle_size, isYellow ? 24 : 32),
            textScale,
            isYellow ? "#ffe100" : "#ffd400",
            900
          ),
          zIndex: 3,
          borderRadius: isYellow ? "999px" : "18px",
          background: isYellow
            ? "#111827"
            : "linear-gradient(#e62020, #a00000)",
          boxShadow: "0 5px 10px rgba(0,0,0,0.28)",
          color: isYellow ? "#ffe100" : "#ffd400",
          lineHeight: 0.92,
          padding: `${clamp(7 * textScale, 4, 18)}px ${clamp(22 * textScale, 10, 40)}px`,
          textShadow: isYellow ? "none" : "2px 3px 0 #7a0000",
        }}
      >
        {subtitleText}
      </div>

      {productName ? (
        <div
          style={{
            ...areaStyle(
              layout.product,
              data.product_name_size,
              textScale,
              textColor,
              900
            ),
            lineHeight: 0.9,
            textShadow: "none",
          }}
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
              textScale,
              textColor,
              900
            ),
            lineHeight: 1,
            textShadow: "none",
          }}
        >
          {productDescription}
        </div>
      ) : null}

      {priceText ? <div style={guidedBrushStyle(layout.price, textScale)} /> : null}

      {priceText ? (
        <div
          style={{
            position: "absolute",
            zIndex: 2,
            left: layout.price.left,
            top: layout.price.top,
            width: layout.price.width,
            transform: "translateY(-50%)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            color: priceColor,
            fontFamily: "Arial Black, Arial, Helvetica, sans-serif",
            lineHeight: 0.8,
            textTransform: "uppercase",
          }}
        >
          <span
            style={{
              marginRight: `${clamp(8 * textScale, 4, 18)}px`,
              color: textColor,
              fontSize: `${clamp(data.sale_unit_size * textScale, 18, 72)}px`,
              fontWeight: 900,
            }}
          >
            {price.currency}
          </span>
          <strong
            style={{
              color: priceColor,
              display: "inline-flex",
              alignItems: "flex-start",
              fontSize: `${clamp(data.price_size * textScale, 36, 220)}px`,
              fontWeight: 900,
              letterSpacing: 0,
            }}
          >
            <PriceAmount centsScale={data.price_cents_scale} value={price.value} />
          </strong>
        </div>
      ) : null}

      {unitText ? (
        <div
          style={{
            ...areaStyle(
              layout.unit,
              data.sale_unit_size,
              textScale,
              textColor,
              900
            ),
            textShadow: "none",
          }}
        >
          {unitText}
        </div>
      ) : null}

      <div
        style={{
          ...areaStyle(
            layout.footer,
            data.footer_size,
            textScale,
            isYellow ? "#ffffff" : "#d50000",
            900
          ),
          zIndex: 3,
          textShadow: "none",
        }}
      >
        {data.footer || "UNYX"}
      </div>
    </div>
  )
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
  if (template.kind === "guided") {
    const guidedScale =
      textScale ?? (print ? printScaleByFormat[data.format] : compact ? 0.36 : 0.82)
    return (
      <GuidedPosterCanvas
        data={data}
        textScale={guidedScale}
        showPlaceholders={showPlaceholders}
      />
    )
  }

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
            ...areaStyle(layout.subtitle, Math.max(data.subtitle_size, 18), scale, textColor, 900),
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
            alignItems: "flex-start",
            display: "flex",
            justifyContent: priceJustify(layout.price),
            lineHeight: 0.92,
          }}
        >
          <PriceAmount centsScale={data.price_cents_scale} value={priceText} />
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
            ...areaStyle(layout.footer, data.footer_size, scale, textColor, 900),
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
