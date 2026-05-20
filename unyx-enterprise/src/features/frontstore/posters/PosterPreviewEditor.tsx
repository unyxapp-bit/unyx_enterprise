import { useRef, useState } from "react"
import type { PointerEvent } from "react"

import { cn } from "@/lib/utils"
import {
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

function fieldHasContent(form: PosterForm, field: OperationalPosterLayoutField) {
  if (field === "subtitle") return Boolean(form.subtitle.trim())
  if (field === "product") return Boolean(form.product_name.trim() || form.title.trim())
  if (field === "description") {
    return Boolean(form.product_description.trim() || form.body.trim())
  }
  if (field === "price") return Boolean(form.price_text.trim())
  if (field === "unit") return Boolean(form.sale_unit.trim())
  return Boolean(form.footer.trim())
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
  data,
  form,
  onPositionChange,
}: {
  data: PosterCanvasData
  form: PosterForm
  onPositionChange: (
    field: OperationalPosterLayoutField,
    axis: PosterPositionAxis,
    value: string
  ) => void
}) {
  const boundsRef = useRef<HTMLDivElement | null>(null)
  const [activeField, setActiveField] =
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
    setActiveField(field)
    moveField(event, field)
  }

  function stopDrag(event: PointerEvent<HTMLButtonElement>) {
    event.currentTarget.releasePointerCapture(event.pointerId)
    setActiveField(null)
  }

  return (
    <div ref={boundsRef} className="relative touch-none select-none">
      <PosterCanvas data={data} showPlaceholders />
      <div className="absolute inset-0 z-10">
        {positionFields
          .filter(({ field }) => fieldHasContent(form, field))
          .map(({ field, label }) => {
            const x = getFormPositionValue(form, field, "x")
            const y = getFormPositionValue(form, field, "y")
            const active = activeField === field

            return (
              <button
                key={field}
                type="button"
                aria-label={`Mover ${label}`}
                title={`${label}: X ${x}% / Y ${y}%`}
                className={cn(
                  "absolute z-20 flex -translate-x-1/2 -translate-y-1/2 cursor-grab items-center gap-1 rounded-full border border-slate-950/20 bg-white/90 px-1.5 py-1 text-[10px] font-semibold text-slate-950 shadow-sm backdrop-blur transition hover:border-slate-950 hover:bg-white active:cursor-grabbing",
                  active && "border-slate-950 bg-lime-300 shadow-md"
                )}
                style={{ left: `${x}%`, top: `${y}%` }}
                onPointerDown={(event) => startDrag(event, field)}
                onPointerMove={(event) => {
                  if (activeField === field) moveField(event, field)
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
  )
}
