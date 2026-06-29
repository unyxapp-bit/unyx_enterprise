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
    <div className="border-b border-[color:var(--border-soft)] bg-[color:var(--bg-surface)]/96 px-4 py-2 shadow-[0_1px_0_rgba(15,23,42,0.03)] backdrop-blur supports-[backdrop-filter]:bg-[color:var(--bg-surface)]/88">
      <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
          <h1 className="truncate text-sm font-semibold tracking-tight text-[color:var(--text-primary)]">
            {title}
          </h1>
          {description ? (
            <p className="min-w-0 truncate text-[11px] leading-4 text-[color:var(--text-muted)]">
              {description}
            </p>
          ) : null}
        </div>
        {action ? (
          <div className="flex min-w-0 flex-wrap items-center gap-1.5 xl:justify-end [&_button]:h-7 [&_button]:text-xs [&_input]:h-7 [&_select]:h-7">
            {action}
          </div>
        ) : null}
      </div>
    </div>
  )
}
