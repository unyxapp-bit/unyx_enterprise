import { useRef, useState } from "react"
import type { PointerEvent } from "react"

import { cn } from "@/lib/utils"
import {
  getPosterTemplate,
  positionFields,
  type PosterPositionAxis,
} from "@/features/frontstore/posters/posterConfig"
import { PosterCanvas } from "@/features/frontstore/posters/PosterCanvas"
import {
  clamp,
  getFormPositionValue,
  type PosterCanvasData,
  type PosterForm,
} from "@/features/frontstore/posters/posterModel"
import type { OperationalPosterLayoutField } from "@/types/domain"

function formatPosition(value: number) {
  return String(Math.round(value * 10) / 10)
}

function fieldHasContent(
  form: PosterForm,
  data: PosterCanvasData,
  field: OperationalPosterLayoutField
) {
  const template = getPosterTemplate(data.template_key)
  if (field === "subtitle") {
    return template.kind === "guided" || Boolean(form.subtitle.trim())
  }
  if (field === "product") return Boolean(form.product_name.trim() || form.title.trim())
  if (field === "description") {
    return Boolean(form.product_description.trim() || form.body.trim())
  }
  if (field === "price") return Boolean(form.price_text.trim())
  if (field === "unit") return Boolean(form.sale_unit.trim())
  return template.kind === "guided" || Boolean(form.footer.trim())
}

function shortLabel(label: string) {
  return label
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

export function PosterPreviewEditor({
  className,
  data,
  form,
  selectedField,
  stageWidth,
  textScale,
  onPositionChange,
  onSelectedFieldChange,
}: {
  className?: string
  data: PosterCanvasData
  form: PosterForm
  selectedField: OperationalPosterLayoutField | null
  stageWidth: number
  textScale: number
  onPositionChange: (
    field: OperationalPosterLayoutField,
    axis: PosterPositionAxis,
    value: string
  ) => void
  onSelectedFieldChange: (field: OperationalPosterLayoutField) => void
}) {
  const boundsRef = useRef<HTMLDivElement | null>(null)
  const [draggingField, setDraggingField] =
    useState<OperationalPosterLayoutField | null>(null)

  function moveField(event: PointerEvent, field: OperationalPosterLayoutField) {
    const bounds = boundsRef.current?.getBoundingClientRect()
    if (!bounds) return

    const x = clamp(((event.clientX - bounds.left) / bounds.width) * 100, 0, 100)
    const y = clamp(((event.clientY - bounds.top) / bounds.height) * 100, 0, 100)

    onPositionChange(field, "x", formatPosition(x))
    onPositionChange(field, "y", formatPosition(y))
  }

  function startDrag(event: PointerEvent<HTMLButtonElement>, field: OperationalPosterLayoutField) {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    onSelectedFieldChange(field)
    setDraggingField(field)
    moveField(event, field)
  }

  function stopDrag(event: PointerEvent<HTMLButtonElement>) {
    event.currentTarget.releasePointerCapture(event.pointerId)
    setDraggingField(null)
  }

  const selectedX = selectedField ? getFormPositionValue(form, selectedField, "x") : null
  const selectedY = selectedField ? getFormPositionValue(form, selectedField, "y") : null

  return (
    <div
      className={cn(
        "h-full overflow-auto bg-[linear-gradient(45deg,#e5e7eb_25%,transparent_25%),linear-gradient(-45deg,#e5e7eb_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e5e7eb_75%),linear-gradient(-45deg,transparent_75%,#e5e7eb_75%)] bg-[length:24px_24px] bg-[position:0_0,0_12px,12px_-12px,-12px_0] p-6",
        className
      )}
    >
      <div className="flex min-h-full items-center justify-center">
        <div
          className="mx-auto"
          style={{
            width: `${stageWidth}px`,
            maxWidth: "none",
          }}
        >
        <div ref={boundsRef} className="relative touch-none select-none">
          <PosterCanvas data={data} showPlaceholders textScale={textScale} />

          {selectedField && selectedX && selectedY ? (
            <div className="pointer-events-none absolute inset-0 z-10">
              <div
                className="absolute inset-y-0 w-px bg-lime-400/80"
                style={{ left: `${selectedX}%` }}
              />
              <div
                className="absolute inset-x-0 h-px bg-lime-400/80"
                style={{ top: `${selectedY}%` }}
              />
            </div>
          ) : null}

          <div className="absolute inset-0 z-20">
            {positionFields
              .filter(({ field }) => fieldHasContent(form, data, field))
              .map(({ field, label }) => {
                const x = getFormPositionValue(form, field, "x")
                const y = getFormPositionValue(form, field, "y")
                const selected = selectedField === field
                const dragging = draggingField === field

                return (
                  <button
                    key={field}
                    type="button"
                    aria-label={`Mover ${label}`}
                    title={`${label}: X ${x}% / Y ${y}%`}
                    className={cn(
                      "absolute z-20 flex -translate-x-1/2 -translate-y-1/2 cursor-grab items-center gap-1 rounded-full border border-slate-950/25 bg-white/95 px-2 py-1 text-[11px] font-semibold text-slate-950 shadow-md backdrop-blur transition hover:border-slate-950 hover:bg-white active:cursor-grabbing",
                      selected && "border-slate-950 bg-lime-300 ring-4 ring-lime-300/30",
                      dragging && "scale-105 shadow-lg"
                    )}
                    style={{ left: `${x}%`, top: `${y}%` }}
                    onClick={() => onSelectedFieldChange(field)}
                    onPointerDown={(event) => startDrag(event, field)}
                    onPointerMove={(event) => {
                      if (draggingField === field) moveField(event, field)
                    }}
                    onPointerUp={stopDrag}
                    onPointerCancel={stopDrag}
                  >
                    <span className="size-2 rounded-full bg-slate-950" />
                    {shortLabel(label)}
                  </button>
                )
              })}
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}
