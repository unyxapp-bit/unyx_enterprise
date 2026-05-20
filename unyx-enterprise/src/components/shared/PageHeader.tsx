import type { ReactNode } from "react"

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="border-b bg-white/95 px-4 py-3 shadow-[0_1px_0_rgba(15,23,42,0.03)]">
      <div className="flex flex-col gap-2 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-tight text-slate-950">
            {title}
          </h1>
          {description ? (
            <p className="mt-0.5 max-w-2xl text-xs leading-5 text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {action ? (
          <div className="flex min-w-0 flex-wrap items-center gap-1.5 xl:justify-end [&_button]:h-8 [&_button]:text-xs [&_input]:h-8 [&_select]:h-8">
            {action}
          </div>
        ) : null}
      </div>
    </div>
  )
}
