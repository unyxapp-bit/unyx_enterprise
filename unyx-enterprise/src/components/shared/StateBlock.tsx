import { AlertCircle, Inbox, Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

export function StateBlock({
  title,
  description,
  type = "empty",
  className,
}: {
  title: string
  description?: string
  type?: "empty" | "error" | "loading"
  className?: string
}) {
  const Icon = type === "loading" ? Loader2 : type === "error" ? AlertCircle : Inbox

  return (
    <div
      className={cn(
        "flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] px-6 py-10 text-center shadow-sm",
        className
      )}
    >
      <Icon
        className={cn(
          "mb-3 size-7 text-muted-foreground",
          type === "loading" && "animate-spin"
        )}
      />
      <h3 className="text-sm font-medium text-[color:var(--text-primary)]">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-md text-sm text-[color:var(--text-muted)]">{description}</p>
      ) : null}
    </div>
  )
}
