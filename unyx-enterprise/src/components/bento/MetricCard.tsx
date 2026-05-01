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
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
        {icon ? <div className="text-muted-foreground">{icon}</div> : null}
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold tracking-tight">{value}</div>
        {detail ? <p className="mt-2 text-sm text-muted-foreground">{detail}</p> : null}
      </CardContent>
    </Card>
  )
}
