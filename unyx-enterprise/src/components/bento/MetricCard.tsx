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
    <Card className={cn("border bg-white shadow-sm", className)}>
      <CardHeader className="flex-row items-center justify-between gap-2 pb-1 pt-3 px-4">
        <CardTitle className="text-xs text-muted-foreground">{title}</CardTitle>
        {icon ? <div className="text-muted-foreground [&_svg]:size-4">{icon}</div> : null}
      </CardHeader>
      <CardContent className="px-4 pb-3 pt-0">
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
        {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
      </CardContent>
    </Card>
  )
}
