import { useMemo, useState } from "react"
import type { FormEvent } from "react"
import {
  AlertTriangle,
  Clock,
  Gauge,
  Plus,
  Timer,
  UserRoundX,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type {
  CashSession,
  OperationalPost,
  OperationalQueueSeverity,
  OperationalQueueSignal,
  OperationalQueueType,
  OperationalStatusRecord,
  PostAllocation,
  ScheduleWithRelations,
} from "@/types/domain"
import type { OperationalQueueInput } from "@/services/unyxApi"
import { formatTime } from "@/lib/format"
import {
  FLOW_REAL_WORKING_STATUSES,
  formatDuration,
  timeToMinutes,
} from "../utils"

const queueTypeLabel: Record<OperationalQueueType, string> = {
  checkout: "Caixa",
  self_checkout: "Autoatendimento",
  service: "Atendimento",
  delivery: "Delivery",
  support: "Apoio",
  closing: "Fechamento",
  other: "Outro",
}

interface FiscalFlowPanelProps {
  activePosts: OperationalPost[]
  activeAllocations: PostAllocation[]
  schedulesToArrive: ScheduleWithRelations[]
  queueSignals: OperationalQueueSignal[]
  cashSessions: CashSession[]
  schedulesInTurn: ScheduleWithRelations[]
  statusByScheduleId: Map<string, OperationalStatusRecord>
  currentMinutes: number
  breakToleranceMinutes: number
  queueAttentionThreshold: number
  queueCriticalThreshold: number
  cashCountAlertAmount: number
  isLoading: boolean
  isPending: boolean
  onCreateQueueSignal: (input: OperationalQueueInput) => void
}

function resolveSeverity(params: {
  customerCount: number
  waitMinutes: number
  attentionThreshold: number
  criticalThreshold: number
}): OperationalQueueSeverity {
  if (
    params.customerCount >= params.criticalThreshold ||
    params.waitMinutes >= 15
  ) {
    return "critical"
  }
  if (
    params.customerCount >= params.attentionThreshold ||
    params.waitMinutes >= 8
  ) {
    return "attention"
  }
  return "normal"
}

function openCashSessionAmount(session: CashSession) {
  return Math.max(session.expected_amount ?? 0, session.final_amount ?? 0)
}

function employeeLabel(schedule: ScheduleWithRelations) {
  return schedule.employees?.name ?? "Colaborador"
}

export function FiscalFlowPanel({
  activePosts,
  activeAllocations,
  schedulesToArrive,
  queueSignals,
  cashSessions,
  schedulesInTurn,
  statusByScheduleId,
  currentMinutes,
  breakToleranceMinutes,
  queueAttentionThreshold,
  queueCriticalThreshold,
  cashCountAlertAmount,
  isLoading,
  isPending,
  onCreateQueueSignal,
}: FiscalFlowPanelProps) {
  const [queueType, setQueueType] = useState<OperationalQueueType>("checkout")
  const [postId, setPostId] = useState("")
  const [customerCount, setCustomerCount] = useState(0)
  const [waitMinutes, setWaitMinutes] = useState(0)
  const [notes, setNotes] = useState("")
  const [queueFormOpen, setQueueFormOpen] = useState(false)

  const openQueues = useMemo(
    () => queueSignals.filter((signal) => signal.status === "open" || signal.status === "monitoring"),
    [queueSignals]
  )
  const occupiedPostIds = useMemo(
    () => new Set(activeAllocations.map((allocation) => allocation.post_id)),
    [activeAllocations]
  )
  const openCashSessions = useMemo(
    () => cashSessions.filter((session) => session.status === "open"),
    [cashSessions]
  )
  const cashAlerts = useMemo(
    () =>
      openCashSessions.filter(
        (session) => openCashSessionAmount(session) >= cashCountAlertAmount
      ),
    [cashCountAlertAmount, openCashSessions]
  )
  const averageWait =
    openQueues.length > 0
      ? Math.round(
          openQueues.reduce((sum, signal) => sum + signal.wait_minutes, 0) /
            openQueues.length
        )
      : 0

  const lateArrivals = useMemo(
    () =>
      schedulesToArrive.filter((schedule) => {
        const start = timeToMinutes(schedule.start_time)
        return start !== null && currentMinutes > start
      }),
    [currentMinutes, schedulesToArrive]
  )
  const overdueBreaks = useMemo(
    () =>
      schedulesInTurn.filter((schedule) => {
        const status = statusByScheduleId.get(schedule.id)?.current_status
        const breakEnd = timeToMinutes(schedule.break_end)
        return (
          status === "em_intervalo" &&
          breakEnd !== null &&
          currentMinutes > breakEnd + breakToleranceMinutes
        )
      }),
    [breakToleranceMinutes, currentMinutes, schedulesInTurn, statusByScheduleId]
  )
  const breaksWaitingRelease = useMemo(
    () =>
      schedulesInTurn.filter((schedule) => {
        const status = statusByScheduleId.get(schedule.id)?.current_status
        const breakStart = timeToMinutes(schedule.break_start)
        const lunchDone = schedule.notes?.includes("lunch_done") || status === "voltou"
        return (
          status !== undefined &&
          FLOW_REAL_WORKING_STATUSES.has(status) &&
          !lunchDone &&
          breakStart !== null &&
          currentMinutes > breakStart + breakToleranceMinutes
        )
      }),
    [breakToleranceMinutes, currentMinutes, schedulesInTurn, statusByScheduleId]
  )

  const totalPending =
    lateArrivals.length +
    overdueBreaks.length +
    breaksWaitingRelease.length +
    openQueues.length

  const queueSeverity = resolveSeverity({
    customerCount,
    waitMinutes,
    attentionThreshold: queueAttentionThreshold,
    criticalThreshold: queueCriticalThreshold,
  })

  const selectedPost = activePosts.find((post) => post.id === postId)
  const autoTitle =
    queueType === "closing"
      ? "Fechamento operacional"
      : `Fila ${queueTypeLabel[queueType]}${selectedPost ? ` - ${selectedPost.name}` : ""}`

  const recommendation = (() => {
    if (openQueues.some((signal) => signal.severity === "critical")) {
      return "Abrir cobertura ou mover apoio para a fila critica."
    }
    if (cashAlerts.length > 0) {
      return "Priorizar sangria dos caixas com valor alto antes de liberar intervalo."
    }
    if (overdueBreaks.length > 0 || breaksWaitingRelease.length > 0) {
      return "Liberar intervalos pendentes antes de distribuir novas tarefas."
    }
    if (lateArrivals.length > 0) {
      return "Confirmar as entradas atrasadas e reequilibrar a escala."
    }
    return "Fluxo controlado; manter monitoramento dos sinais do turno."
  })()

  const priorityGroups = [
    {
      key: "late-arrivals",
      title: "Entradas atrasadas",
      count: lateArrivals.length,
      Icon: UserRoundX,
      tone: "text-orange-700",
      empty: "Nenhum colaborador atrasado para entrada.",
      items: lateArrivals
        .slice(0, 2)
        .map((schedule) => `${employeeLabel(schedule)} - entrada ${formatTime(schedule.start_time)}`),
    },
    {
      key: "overdue-breaks",
      title: "Intervalos vencidos",
      count: overdueBreaks.length,
      Icon: Clock,
      tone: "text-red-700",
      empty: "Nenhum intervalo vencido.",
      items: overdueBreaks
        .slice(0, 2)
        .map((schedule) => `${employeeLabel(schedule)} - retorno ${formatTime(schedule.break_end)}`),
    },
    {
      key: "breaks-waiting-release",
      title: "Intervalos a liberar",
      count: breaksWaitingRelease.length,
      Icon: Timer,
      tone: "text-amber-700",
      empty: "Nenhum intervalo aguardando liberacao.",
      items: breaksWaitingRelease
        .slice(0, 2)
        .map((schedule) => `${employeeLabel(schedule)} - previsto ${formatTime(schedule.break_start)}`),
    },
    {
      key: "queue-signals",
      title: "Filas operacionais",
      count: openQueues.length,
      Icon: AlertTriangle,
      tone: "text-red-700",
      empty: "Nenhuma fila operacional aberta.",
      items: openQueues
        .slice(0, 2)
        .map(
          (signal) =>
            `${signal.title} - ${signal.customer_count} cliente(s), ${signal.wait_minutes}min`
        ),
    },
  ] as const

  function submitQueueSignal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!activePosts[0]?.branch_id) return

    onCreateQueueSignal({
      branch_id: selectedPost?.branch_id ?? activePosts[0].branch_id,
      post_id: postId || null,
      sector_id: selectedPost?.sector_id ?? null,
      queue_type: queueType,
      severity: queueSeverity,
      title: autoTitle,
      customer_count: customerCount,
      wait_minutes: waitMinutes,
      active_posts: occupiedPostIds.size,
      required_posts: activePosts.length,
      notes: notes.trim() || null,
    })

    setCustomerCount(0)
    setWaitMinutes(0)
    setNotes("")
    setQueueFormOpen(false)
  }

  return (
    <Card className="border bg-white shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-base">
          <span className="flex min-w-48 items-center gap-2">
            <Gauge className="size-5" />
            Centro do fiscal
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline">{openQueues.length} filas</Badge>
            {cashAlerts.length > 0 ? (
              <Badge variant="destructive">{cashAlerts.length} sangria</Badge>
            ) : null}
            {breaksWaitingRelease.length > 0 ? (
              <Badge variant="destructive">{breaksWaitingRelease.length} intervalos</Badge>
            ) : null}
          </div>
          <Button
            type="button"
            size="sm"
            variant={queueFormOpen ? "secondary" : "outline"}
            onClick={() => setQueueFormOpen((open) => !open)}
            disabled={isLoading || activePosts.length === 0}
          >
            <Plus className="size-4" />
            Fila
          </Button>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Pendencias prioritarias
              </p>
              <div className="mt-1 flex items-end gap-2">
                <span className="text-4xl font-bold tracking-tight tabular-nums text-slate-950">
                  {totalPending}
                </span>
                <span className="pb-1 text-sm text-slate-500">
                  sinais ativos no turno
                </span>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Badge variant={cashAlerts.length > 0 ? "destructive" : "outline"}>
                {cashAlerts.length} sangria
              </Badge>
              <Badge variant={breaksWaitingRelease.length > 0 ? "destructive" : "outline"}>
                {breaksWaitingRelease.length} intervalos
              </Badge>
              <Badge variant={openQueues.length > 0 ? "destructive" : "outline"}>
                {openQueues.length} filas
              </Badge>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {priorityGroups.map(({ key, title, count, Icon, tone, empty, items }) => (
              <div
                key={key}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <Icon className={`size-4 ${tone}`} />
                  <div className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">
                    {title}
                  </div>
                  <Badge variant={count > 0 ? "destructive" : "outline"}>{count}</Badge>
                </div>
                <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                  {items.length > 0 ? (
                    items.map((item) => (
                      <div key={item} className="truncate">
                        {item}
                      </div>
                    ))
                  ) : (
                    <div>{empty}</div>
                  )}
                  {title === "Filas operacionais" ? (
                    <div className="text-slate-500">Espera media: {formatDuration(averageWait)}</div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-800 shadow-sm">
          {recommendation}
        </div>

        {queueFormOpen ? (
          <form
            className="grid gap-2 rounded-2xl border border-slate-200 p-3 md:grid-cols-[1fr_1fr_0.8fr_0.8fr_auto]"
            onSubmit={submitQueueSignal}
          >
            <select
              className="h-9 rounded-lg border bg-white px-2 text-sm outline-none"
              value={queueType}
              onChange={(event) => setQueueType(event.target.value as OperationalQueueType)}
              disabled={isPending}
            >
              {Object.entries(queueTypeLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              className="h-9 rounded-lg border bg-white px-2 text-sm outline-none"
              value={postId}
              onChange={(event) => setPostId(event.target.value)}
              disabled={isPending}
            >
              <option value="">Posto geral</option>
              {activePosts.map((post) => (
                <option key={post.id} value={post.id}>
                  {post.name}
                </option>
              ))}
            </select>
            <Input
              type="number"
              min={0}
              value={customerCount}
              onChange={(event) => setCustomerCount(Number(event.target.value) || 0)}
              placeholder="Clientes"
              disabled={isPending}
            />
            <Input
              type="number"
              min={0}
              value={waitMinutes}
              onChange={(event) => setWaitMinutes(Number(event.target.value) || 0)}
              placeholder="Espera"
              disabled={isPending}
            />
            <Button type="submit" disabled={isPending || isLoading || activePosts.length === 0}>
              <Plus className="size-4" />
              Registrar
            </Button>
            <Input
              className="md:col-span-5"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Observacao do fiscal"
              disabled={isPending}
            />
          </form>
        ) : null}
      </CardContent>
    </Card>
  )
}
