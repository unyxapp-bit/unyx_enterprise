import React, { useMemo } from "react"
import {
  AlertTriangle,
  Clock,
  Link2Off,
  MapPinned,
  UserRoundX,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatTime } from "@/lib/format"
import type {
  OperationalPost,
  OperationalStatusRecord,
  PostAllocation,
  ScheduleWithRelations,
} from "@/types/domain"

import { timeToMinutes } from "../utils"

interface OperationalPendingPanelProps {
  schedulesToArrive: ScheduleWithRelations[]
  schedulesInTurn: ScheduleWithRelations[]
  statusByScheduleId: Map<string, OperationalStatusRecord>
  activePosts: OperationalPost[]
  occupiedPostIds: Set<string>
  activeAllocations: PostAllocation[]
  currentMinutes: number
}

function employeeLabel(schedule: ScheduleWithRelations) {
  return schedule.employees?.name ?? "Colaborador"
}

function postLabel(post: OperationalPost) {
  return [post.name, post.sectors?.name].filter(Boolean).join(" - ")
}

function allocationLabel(allocation: PostAllocation) {
  return [
    allocation.employees?.name ?? "Colaborador",
    allocation.operational_posts?.name ?? "Posto",
  ].join(" - ")
}

export const OperationalPendingPanel = React.memo(
  ({
    schedulesToArrive,
    schedulesInTurn,
    statusByScheduleId,
    activePosts,
    occupiedPostIds,
    activeAllocations,
    currentMinutes,
  }: OperationalPendingPanelProps) => {
    const pendingGroups = useMemo(() => {
      const lateArrivals = schedulesToArrive.filter((schedule) => {
        const start = timeToMinutes(schedule.start_time)
        return start !== null && currentMinutes > start
      })

      const overdueBreaks = schedulesInTurn.filter((schedule) => {
        const status = statusByScheduleId.get(schedule.id)?.current_status
        const breakEnd = timeToMinutes(schedule.break_end)
        return status === "em_intervalo" && breakEnd !== null && currentMinutes > breakEnd
      })

      const uncoveredPosts = activePosts.filter(
        (post) => !occupiedPostIds.has(post.id)
      )

      const allocationsWithoutSchedule = activeAllocations.filter(
        (allocation) => !allocation.schedule_id
      )

      return [
        {
          key: "late-arrivals",
          title: "Entradas atrasadas",
          count: lateArrivals.length,
          Icon: UserRoundX,
          tone: "text-orange-700",
          empty: "Nenhum colaborador atrasado para entrada.",
          items: lateArrivals
            .slice(0, 3)
            .map(
              (schedule) =>
                `${employeeLabel(schedule)} - entrada ${formatTime(schedule.start_time)}`
            ),
        },
        {
          key: "overdue-breaks",
          title: "Intervalos vencidos",
          count: overdueBreaks.length,
          Icon: Clock,
          tone: "text-red-700",
          empty: "Nenhum intervalo vencido.",
          items: overdueBreaks
            .slice(0, 3)
            .map(
              (schedule) =>
                `${employeeLabel(schedule)} - retorno ${formatTime(schedule.break_end)}`
            ),
        },
        {
          key: "uncovered-posts",
          title: "Postos sem cobertura",
          count: uncoveredPosts.length,
          Icon: MapPinned,
          tone: "text-sky-700",
          empty: "Todos os postos ativos estao cobertos.",
          items: uncoveredPosts.slice(0, 3).map(postLabel),
        },
        {
          key: "allocations-without-schedule",
          title: "Alocados sem escala",
          count: allocationsWithoutSchedule.length,
          Icon: Link2Off,
          tone: "text-amber-700",
          empty: "Todas as alocacoes ativas estao vinculadas a uma escala.",
          items: allocationsWithoutSchedule.slice(0, 3).map(allocationLabel),
        },
      ]
    }, [
      activeAllocations,
      activePosts,
      currentMinutes,
      occupiedPostIds,
      schedulesInTurn,
      schedulesToArrive,
      statusByScheduleId,
    ])

    const totalPending = pendingGroups.reduce(
      (total, group) => total + group.count,
      0
    )

    return (
      <Card className="border bg-white shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="size-5 text-amber-600" />
            <span className="flex-1">Pendencias operacionais</span>
            <Badge variant={totalPending > 0 ? "destructive" : "outline"}>
              {totalPending}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {pendingGroups.map(({ key, title, count, Icon, tone, empty, items }) => (
              <div key={key} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center gap-2">
                  <Icon className={`size-4 ${tone}`} />
                  <div className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {title}
                  </div>
                  <Badge variant={count > 0 ? "destructive" : "outline"}>
                    {count}
                  </Badge>
                </div>
                <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                  {items.length > 0 ? (
                    items.map((item) => (
                      <div key={item} className="truncate">
                        {item}
                      </div>
                    ))
                  ) : (
                    <div>{empty}</div>
                  )}
                  {count > items.length ? (
                    <div className="font-medium text-slate-500">
                      +{count - items.length} pendencia(s)
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }
)

OperationalPendingPanel.displayName = "OperationalPendingPanel"
