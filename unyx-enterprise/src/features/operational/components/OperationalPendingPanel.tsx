import React, { useMemo } from "react"
import {
  AlertTriangle,
  Clock,
  Link2Off,
  MapPinned,
  Truck,
  UserRoundX,
  Utensils,
  Wallet,
} from "lucide-react"

import { SectionPanel } from "@/components/shared/SectionPanel"
import { Badge } from "@/components/ui/badge"
import { formatTime } from "@/lib/format"
import type {
  CashSession,
  DeliveryOrder,
  OperationalPost,
  OperationalQueueSignal,
  OperationalStatusRecord,
  PostAllocation,
  ProductionOrder,
  ScheduleWithRelations,
} from "@/types/domain"

import { DEFAULT_BREAK_TOLERANCE_MINUTES, timeToMinutes } from "../utils"

interface OperationalPendingPanelProps {
  schedulesToArrive: ScheduleWithRelations[]
  schedulesInTurn: ScheduleWithRelations[]
  statusByScheduleId: Map<string, OperationalStatusRecord>
  activePosts: OperationalPost[]
  occupiedPostIds: Set<string>
  activeAllocations: PostAllocation[]
  cashSessions: CashSession[]
  deliveryOrders: DeliveryOrder[]
  productionOrders: ProductionOrder[]
  queueSignals: OperationalQueueSignal[]
  currentMinutes: number
  breakToleranceMinutes?: number
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

function isPast(value: string | null | undefined) {
  if (!value) return false
  return new Date(value).getTime() < Date.now()
}

function cashSessionLabel(session: CashSession) {
  return [
    session.operational_posts?.name ?? "Caixa",
    session.employees?.name ?? session.user_profiles?.name,
  ].filter(Boolean).join(" - ")
}

function deliveryLabel(order: DeliveryOrder) {
  const due = order.estimated_delivery_at ?? order.scheduled_for
  return `${order.customer_name} - entrega ${due ? new Date(due).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }) : "sem horario"}`
}

function productionLabel(order: ProductionOrder) {
  return `${order.order_code} - ${order.customer_name}`
}

export const OperationalPendingPanel = React.memo(
  ({
    schedulesToArrive,
    schedulesInTurn,
    statusByScheduleId,
    activePosts,
    occupiedPostIds,
    activeAllocations,
    cashSessions,
    deliveryOrders,
    productionOrders,
    queueSignals,
    currentMinutes,
    breakToleranceMinutes = DEFAULT_BREAK_TOLERANCE_MINUTES,
  }: OperationalPendingPanelProps) => {
    const pendingGroups = useMemo(() => {
      const lateArrivals = schedulesToArrive.filter((schedule) => {
        const start = timeToMinutes(schedule.start_time)
        return start !== null && currentMinutes > start
      })

      const overdueBreaks = schedulesInTurn.filter((schedule) => {
        const status = statusByScheduleId.get(schedule.id)?.current_status
        const breakEnd = timeToMinutes(schedule.break_end)
        return (
          status === "em_intervalo" &&
          breakEnd !== null &&
          currentMinutes > breakEnd + breakToleranceMinutes
        )
      })

      const breaksWaitingRelease = schedulesInTurn.filter((schedule) => {
        const status = statusByScheduleId.get(schedule.id)?.current_status
        const breakStart = timeToMinutes(schedule.break_start)
        const lunchDone = schedule.notes?.includes("lunch_done") || status === "voltou"
        return (
          !lunchDone &&
          breakStart !== null &&
          currentMinutes > breakStart + breakToleranceMinutes &&
          [
            "trabalhando",
            "deve_sair",
            "aguardando_sangria",
            "troca_de_caixa",
            "pico",
            "apoio_operacional",
            "fechamento",
          ].includes(status ?? "")
        )
      })

      const uncoveredPosts = activePosts.filter(
        (post) => !occupiedPostIds.has(post.id)
      )

      const allocationsWithoutSchedule = activeAllocations.filter(
        (allocation) => !allocation.schedule_id
      )

      const openCashSessions = cashSessions.filter(
        (session) => session.status === "open"
      )

      const overdueDeliveries = deliveryOrders.filter((order) => {
        if (["delivered", "failed", "cancelled"].includes(order.status)) return false
        const due = order.estimated_delivery_at ?? order.scheduled_for
        return isPast(due)
      })

      const overdueProduction = productionOrders.filter((order) => {
        if (["ready", "delivered", "cancelled"].includes(order.status)) return false
        return isPast(order.promised_at)
      })

      const openQueueSignals = queueSignals.filter(
        (signal) => signal.status === "open" || signal.status === "monitoring"
      )

      return [
        {
          key: "late-arrivals",
          title: "Entradas atrasadas",
          count: lateArrivals.length,
          alert: true,
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
          alert: true,
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
          key: "breaks-waiting-release",
          title: "Intervalos a liberar",
          count: breaksWaitingRelease.length,
          alert: true,
          Icon: Clock,
          tone: "text-amber-700",
          empty: "Nenhum intervalo aguardando liberacao.",
          items: breaksWaitingRelease
            .slice(0, 3)
            .map(
              (schedule) =>
                `${employeeLabel(schedule)} - previsto ${formatTime(schedule.break_start)}`
            ),
        },
        {
          key: "queue-signals",
          title: "Filas operacionais",
          count: openQueueSignals.length,
          alert: true,
          Icon: AlertTriangle,
          tone: "text-red-700",
          empty: "Nenhuma fila operacional aberta.",
          items: openQueueSignals
            .slice(0, 3)
            .map(
              (signal) =>
                `${signal.title} - ${signal.customer_count} cliente(s), ${signal.wait_minutes}min`
            ),
        },
        {
          key: "uncovered-posts",
          title: "Postos sem cobertura",
          count: uncoveredPosts.length,
          alert: true,
          Icon: MapPinned,
          tone: "text-sky-700",
          empty: "Todos os postos ativos estao cobertos.",
          items: uncoveredPosts.slice(0, 3).map(postLabel),
        },
        {
          key: "allocations-without-schedule",
          title: "Alocados sem escala",
          count: allocationsWithoutSchedule.length,
          alert: true,
          Icon: Link2Off,
          tone: "text-amber-700",
          empty: "Todas as alocacoes ativas estao vinculadas a uma escala.",
          items: allocationsWithoutSchedule.slice(0, 3).map(allocationLabel),
        },
        {
          key: "open-cash-sessions",
          title: "Caixas abertos",
          count: openCashSessions.length,
          alert: false,
          Icon: Wallet,
          tone: "text-emerald-700",
          empty: "Nenhum caixa aberto agora.",
          items: openCashSessions.slice(0, 3).map(cashSessionLabel),
        },
        {
          key: "overdue-deliveries",
          title: "Entregas atrasadas",
          count: overdueDeliveries.length,
          alert: true,
          Icon: Truck,
          tone: "text-red-700",
          empty: "Nenhuma entrega atrasada.",
          items: overdueDeliveries.slice(0, 3).map(deliveryLabel),
        },
        {
          key: "overdue-production",
          title: "Producao atrasada",
          count: overdueProduction.length,
          alert: true,
          Icon: Utensils,
          tone: "text-orange-700",
          empty: "Nenhum pedido de producao atrasado.",
          items: overdueProduction.slice(0, 3).map(productionLabel),
        },
      ]
    }, [
      activeAllocations,
      activePosts,
      breakToleranceMinutes,
      cashSessions,
      currentMinutes,
      deliveryOrders,
      occupiedPostIds,
      productionOrders,
      queueSignals,
      schedulesInTurn,
      schedulesToArrive,
      statusByScheduleId,
    ])

    const totalPending = pendingGroups.reduce(
      (total, group) => total + (group.alert ? group.count : 0),
      0
    )

    return (
      <SectionPanel
        title="Pendencias operacionais"
        variant="secondary"
        actions={
          <Badge
            variant={totalPending > 0 ? "destructive" : "outline"}
            className={totalPending > 0 ? "" : "border-lime-300/40 text-lime-200"}
          >
            {totalPending}
          </Badge>
        }
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {pendingGroups.map(({ key, title, count, alert, Icon, tone, empty, items }) => (
            <div key={key} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center gap-2">
                <Icon className={`size-4 ${tone}`} />
                <div className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {title}
                </div>
                <Badge variant={alert && count > 0 ? "destructive" : "outline"}>
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
      </SectionPanel>
    )
  }
)

OperationalPendingPanel.displayName = "OperationalPendingPanel"
