import { Badge } from "@/components/ui/badge"
import { statusMeta } from "@/lib/status"
import { cn } from "@/lib/utils"
import type { OperationalStatus } from "@/types/domain"

export function StatusBadge({
  status,
  className,
}: {
  status: OperationalStatus
  className?: string
}) {
  const meta = statusMeta[status]

  return (
    <Badge variant="outline" className={cn(meta.badgeClassName, className)}>
      <span className={cn("size-2 rounded-full", meta.dotClassName)} />
      {meta.label}
    </Badge>
  )
}
