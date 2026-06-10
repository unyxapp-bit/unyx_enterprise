import type { ReactNode } from "react"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

export function MetricCard({
  title,
  value,
  detail,
  icon,
  className,
}: {
  title: string
  value: string | number
  detail?: string
  icon?: ReactNode
  className?: string
}) {
  return (
    <Card className={cn("border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] shadow-sm", className)}>
      <CardHeader className="flex-row items-center justify-between gap-2 px-4 pb-1 pt-3">
        <CardTitle className="text-xs text-[color:var(--text-muted)]">{title}</CardTitle>
        {icon ? <div className="text-[color:var(--text-muted)] [&_svg]:size-4">{icon}</div> : null}
      </CardHeader>
      <CardContent className="px-4 pb-3 pt-0">
        <div className="text-2xl font-semibold tracking-tight text-[color:var(--text-primary)]">{value}</div>
        {detail ? <p className="mt-1 text-xs text-[color:var(--text-muted)]">{detail}</p> : null}
      </CardContent>
    </Card>
  )
}
