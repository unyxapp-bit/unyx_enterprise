/**
 * OperationalMetrics - Dashboard de KPIs operacionais
 */

import React from "react"
import { TrendingUp, Users, Clock, AlertCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ScheduleWithRelations, OperationalStatusRecord } from "@/types/domain"

interface OperationalMetricsProps {
  emTurnoCount: number
  aChEgarCount: number
  statusByScheduleId: Map<string, OperationalStatusRecord>
  schedules: ScheduleWithRelations[]
}

export const OperationalMetrics = React.memo(
  ({
    emTurnoCount,
    aChEgarCount,
    statusByScheduleId,
    schedules,
  }: OperationalMetricsProps) => {
    // Calculate metrics
    const occupancyRate = aChEgarCount > 0
      ? Math.round((emTurnoCount / (emTurnoCount + aChEgarCount)) * 100)
      : 0

    const lateCount = schedules.filter((s) => {
      const status = statusByScheduleId.get(s.id)
      return status && status.delay_minutes > 0
    }).length

    const averageDelay = schedules.length > 0
      ? Math.round(
          Array.from(statusByScheduleId.values()).reduce(
            (sum, s) => sum + (s.delay_minutes || 0),
            0
          ) / schedules.length
        )
      : 0

    return (
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {/* Ocupação */}
        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-emerald-900">
              <Users className="size-4" />
              Ocupação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700">
              {occupancyRate}%
            </div>
            <p className="text-xs text-emerald-600 mt-1">
              {emTurnoCount} de {emTurnoCount + aChEgarCount}
            </p>
          </CardContent>
        </Card>

        {/* Atrasados */}
        <Card className={`bg-gradient-to-br ${
          lateCount > 0
            ? "from-orange-50 to-orange-100/50"
            : "from-emerald-50 to-emerald-100/50"
        }`}>
          <CardHeader className="pb-2">
            <CardTitle className={`flex items-center gap-2 text-sm font-medium ${
              lateCount > 0 ? "text-orange-900" : "text-emerald-900"
            }`}>
              <AlertCircle className="size-4" />
              Atrasados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${
              lateCount > 0 ? "text-orange-700" : "text-emerald-700"
            }`}>
              {lateCount}
            </div>
            <p className={`text-xs mt-1 ${
              lateCount > 0 ? "text-orange-600" : "text-emerald-600"
            }`}>
              {lateCount === 0 ? "Todos no horário" : `${lateCount} colaboradores`}
            </p>
          </CardContent>
        </Card>

        {/* Atraso Médio */}
        <Card className="bg-gradient-to-br from-violet-50 to-violet-100/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-violet-900">
              <Clock className="size-4" />
              Atraso Médio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-violet-700">
              {averageDelay}
            </div>
            <p className="text-xs text-violet-600 mt-1">
              minutos
            </p>
          </CardContent>
        </Card>

        {/* A Chegar */}
        <Card className="bg-gradient-to-br from-slate-50 to-slate-100/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-900">
              <TrendingUp className="size-4" />
              A Chegar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-700">
              {aChEgarCount}
            </div>
            <p className="text-xs text-slate-600 mt-1">
              pendentes
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }
)

OperationalMetrics.displayName = "OperationalMetrics"
