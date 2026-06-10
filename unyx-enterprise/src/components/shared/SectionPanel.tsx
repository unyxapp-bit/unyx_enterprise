import { useState, type ReactNode } from "react"
import { CircleMinus, CirclePlus } from "lucide-react"

import { cn } from "@/lib/utils"

type SectionPanelVariant = "original" | "primary" | "secondary"

const headerVariantClass: Record<SectionPanelVariant, string> = {
  original:
    "bg-[color:var(--bg-surface-soft)] text-[color:var(--text-primary)] border border-[color:var(--border-soft)]",
  primary:
    "bg-[color-mix(in_srgb,var(--primary)_12%,var(--bg-surface))] text-[color:var(--text-primary)] border border-[color-mix(in_srgb,var(--primary)_22%,var(--border-soft))]",
  secondary:
    "bg-[color:var(--bg-surface)] text-[color:var(--text-primary)] border border-[color:var(--border-soft)]",
}

const iconVariantClass: Record<SectionPanelVariant, string> = {
  original: "text-[color:var(--text-primary)]",
  primary: "text-[color:var(--text-primary)]",
  secondary: "text-[color:var(--text-primary)]",
}

type SectionPanelProps = {
  id?: string
  title: string
  children: ReactNode
  actions?: ReactNode
  defaultOpen?: boolean
  variant?: SectionPanelVariant
  className?: string
  headerClassName?: string
  contentClassName?: string
}

export function SectionPanel({
  id,
  title,
  children,
  actions,
  defaultOpen = true,
  variant = "original",
  className,
  headerClassName,
  contentClassName,
}: SectionPanelProps) {
  const [open, setOpen] = useState(defaultOpen)
  const Icon = open ? CircleMinus : CirclePlus
  const actionLabel = open ? `Recolher ${title}` : `Expandir ${title}`

  return (
    <section id={id} className={cn("scroll-mt-20 space-y-3", className)}>
      <div
        className={cn(
          "flex min-h-10 items-center gap-3 rounded-2xl px-3 shadow-sm",
          headerVariantClass[variant],
          headerClassName
        )}
      >
        <button
          type="button"
          className="flex min-h-10 min-w-0 flex-1 items-center justify-center px-2 text-center text-sm font-semibold outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring/40"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          aria-label={actionLabel}
        >
          <span className="truncate">{title}</span>
        </button>

        <div className="flex shrink-0 items-center gap-2">
          {actions}
          <button
            type="button"
          className={cn(
            "inline-flex size-7 items-center justify-center rounded-full outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring/40",
            iconVariantClass[variant]
          )}
            onClick={() => setOpen((current) => !current)}
            aria-expanded={open}
            aria-label={actionLabel}
            title={actionLabel}
          >
            <Icon className="size-5" />
          </button>
        </div>
      </div>

      {open ? (
        <div
          className={cn(
            "rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] p-4 text-card-foreground shadow-sm",
            contentClassName
          )}
        >
          {children}
        </div>
      ) : null}
    </section>
  )
}
