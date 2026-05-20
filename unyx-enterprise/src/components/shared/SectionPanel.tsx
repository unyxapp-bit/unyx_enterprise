import { useState, type ReactNode } from "react"
import { CircleMinus, CirclePlus } from "lucide-react"

import { cn } from "@/lib/utils"

type SectionPanelVariant = "original" | "primary" | "secondary"

const headerVariantClass: Record<SectionPanelVariant, string> = {
  original: "bg-zinc-200 text-zinc-950",
  primary: "bg-lime-300 text-zinc-950",
  secondary: "bg-zinc-900 text-lime-300",
}

const iconVariantClass: Record<SectionPanelVariant, string> = {
  original: "text-zinc-950",
  primary: "text-zinc-950",
  secondary: "text-lime-300",
}

type SectionPanelProps = {
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
    <section className={cn("space-y-3", className)}>
      <div
        className={cn(
          "flex min-h-10 items-center gap-3 rounded-md px-3 shadow-sm",
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
            "rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm",
            contentClassName
          )}
        >
          {children}
        </div>
      ) : null}
    </section>
  )
}
