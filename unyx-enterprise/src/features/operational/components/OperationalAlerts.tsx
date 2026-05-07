/**
 * OperationalAlerts - Sistema de alertas em tempo real
 */

import React, { useMemo } from "react"
import { AlertCircle, AlertTriangle, Info, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ScheduleWithRelations, OperationalStatusRecord } from "@/types/domain"

interface Alert {
  id: string
  type: "warning" | "critical" | "info"
  title: string
  message: string
  action?: {
    label: string
    onClick: () => void
  }
}

interface OperationalAlertsProps {
  schedules: ScheduleWithRelations[]
  statusByScheduleId: Map<string, OperationalStatusRecord>
  sectors: Array<{ id: string; name: string }> | undefined
  dismissedAlerts: Set<string>
  onDismissAlert: (id: string) => void
}

export const OperationalAlerts = React.memo(
  ({
    schedules,
    statusByScheduleId,
    sectors,
    dismissedAlerts,
    onDismissAlert,
  }: OperationalAlertsProps) => {
    const alerts = useMemo((): Alert[] => {
      const list: Alert[] = []
      const sectorMap = new Map(
        (sectors ?? []).map((s) => [s.id, s.name])
      )

      // Check for critical delays (> 1h)
      const criticalDelays = schedules.filter((s) => {
        const status = statusByScheduleId.get(s.id)
        return status && status.delay_minutes > 60
      })

      if (criticalDelays.length > 0) {
        list.push({
          id: "critical-delays",
          type: "critical",
          title: "Atrasos críticos detectados",
          message: `${criticalDelays.length} colaborador(es) com atraso superior a 1 hora.`,
        })
      }

      // Check for missing employees (no entry by start time + 30min)
      const now = new Date()
      const nowMinutes = now.getHours() * 60 + now.getMinutes()

      const missingEntries = schedules.filter((s) => {
        const status = statusByScheduleId.get(s.id)
        if (status && status.current_status && status.current_status !== "aguardando_evento") {
          return false
        }
        const startTime = s.start_time?.split(":").map(Number)
        if (!startTime) return false
        const startMinutes = startTime[0] * 60 + startTime[1]
        return nowMinutes > startMinutes + 30
      })

      if (missingEntries.length > 0) {
        list.push({
          id: "missing-entries",
          type: "warning",
          title: "Entradas não confirmadas",
          message: `${missingEntries.length} colaborador(es) ainda não confirmaram entrada`,
        })
      }

      // Check for empty sectors
      const occupiedSectors = new Set(
        schedules
          .filter((s) => {
            const status = statusByScheduleId.get(s.id)
            return status && status.current_status && status.current_status !== "aguardando_evento"
          })
          .flatMap((s) => s.employees?.sector_id ?? [])
      )

      const emptySectors = (sectors ?? [])
        .filter((s) => !occupiedSectors.has(s.id))
        .map((s) => s.name)

      if (emptySectors.length > 0) {
        list.push({
          id: "empty-sectors",
          type: "info",
          title: "Setores sem cobertura",
          message: `${emptySectors.join(", ")} sem colaboradores em turno.`,
        })
      }

      return list.filter((alert) => !dismissedAlerts.has(alert.id))
    }, [schedules, statusByScheduleId, sectors, dismissedAlerts])

    if (alerts.length === 0) return null

    return (
      <div className="space-y-2">
        {alerts.map((alert) => {
          const bgColor =
            alert.type === "critical"
              ? "bg-red-50 border-red-200"
              : alert.type === "warning"
                ? "bg-orange-50 border-orange-200"
                : "bg-blue-50 border-blue-200"

          const textColor =
            alert.type === "critical"
              ? "text-red-800"
              : alert.type === "warning"
                ? "text-orange-800"
                : "text-blue-800"

          const Icon =
            alert.type === "critical"
              ? AlertTriangle
              : alert.type === "warning"
                ? AlertCircle
                : Info

          return (
            <div
              key={alert.id}
              className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${bgColor}`}
            >
              <Icon className={`size-5 shrink-0 mt-0.5 ${textColor}`} />
              <div className="flex-1 min-w-0">
                <h4 className={`font-semibold text-sm ${textColor}`}>
                  {alert.title}
                </h4>
                <p className={`text-sm mt-1 ${textColor} opacity-90`}>
                  {alert.message}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 shrink-0"
                onClick={() => onDismissAlert(alert.id)}
                aria-label="Fechar alerta"
              >
                <X className="size-4" />
              </Button>
            </div>
          )
        })}
      </div>
    )
  }
)

OperationalAlerts.displayName = "OperationalAlerts"
