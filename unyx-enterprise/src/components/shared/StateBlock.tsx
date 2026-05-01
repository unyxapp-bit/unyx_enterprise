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
        "flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed bg-white px-6 py-10 text-center",
        className
      )}
    >
      <Icon
        className={cn(
          "mb-3 size-7 text-muted-foreground",
          type === "loading" && "animate-spin"
        )}
      />
      <h3 className="text-sm font-medium">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
  )
}
