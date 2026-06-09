import { useMemo, useState } from "react"
import type { FormEvent } from "react"
import {
  Banknote,
  CheckCircle2,
  Gauge,
  LayoutGrid,
  ListChecks,
  Plus,
  Timer,
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

const severityClass: Record<OperationalQueueSeverity, string> = {
  normal: "border-slate-200 bg-slate-50 text-slate-700",
  attention: "border-amber-200 bg-amber-50 text-amber-700",
  critical: "border-red-200 bg-red-50 text-red-700",
}

interface FiscalFlowPanelProps {
  activePosts: OperationalPost[]
  activeAllocations: PostAllocation[]
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
  onResolveQueueSignal: (signalId: string) => void
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

export function FiscalFlowPanel({
  activePosts,
  activeAllocations,
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
  onResolveQueueSignal,
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
  const workingCount = useMemo(
    () =>
      schedulesInTurn.filter((schedule) => {
        const status = statusByScheduleId.get(schedule.id)?.current_status
        return status ? FLOW_REAL_WORKING_STATUSES.has(status) : false
      }).length,
    [schedulesInTurn, statusByScheduleId]
  )
  const breakPressure = useMemo(
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
      }).length,
    [breakToleranceMinutes, currentMinutes, schedulesInTurn, statusByScheduleId]
  )
  const closingPressure = useMemo(
    () =>
      schedulesInTurn.filter((schedule) => {
        const status = statusByScheduleId.get(schedule.id)?.current_status
        const endMin = timeToMinutes(schedule.end_time)
        return (
          status !== undefined &&
          FLOW_REAL_WORKING_STATUSES.has(status) &&
          endMin !== null &&
          currentMinutes >= endMin - 30
        )
      }).length,
    [currentMinutes, schedulesInTurn, statusByScheduleId]
  )

  const coverageRate =
    activePosts.length > 0
      ? Math.round((occupiedPostIds.size / activePosts.length) * 100)
      : 0
  const idlePosts = Math.max(0, activePosts.length - occupiedPostIds.size)
  const averageWait =
    openQueues.length > 0
      ? Math.round(
          openQueues.reduce((sum, signal) => sum + signal.wait_minutes, 0) /
            openQueues.length
        )
      : 0

  const severity = resolveSeverity({
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
    if (breakPressure > 0 && coverageRate >= 80) {
      return "Liberar intervalos pendentes por prioridade de tempo em operacao."
    }
    if (closingPressure > 0) {
      return "Iniciar reducao gradual e conferir postos para fechamento."
    }
    return "Operacao estavel; manter monitoramento de filas e cobertura."
  })()

  function submitQueueSignal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!activePosts[0]?.branch_id) return

    onCreateQueueSignal({
      branch_id: selectedPost?.branch_id ?? activePosts[0].branch_id,
      post_id: postId || null,
      sector_id: selectedPost?.sector_id ?? null,
      queue_type: queueType,
      severity,
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
        <CardTitle className="flex flex-wrap items-center gap-3 text-base">
          <span className="flex min-w-48 items-center gap-2">
            <Gauge className="size-5" />
            Centro do fiscal
          </span>
          <div className="flex flex-1 flex-wrap items-center gap-1.5">
            <Badge variant="outline">{workingCount} trabalhando</Badge>
            <Badge variant="outline">{coverageRate}% cobertura</Badge>
            <Badge variant={openQueues.length > 0 ? "destructive" : "outline"}>
              {openQueues.length} filas
            </Badge>
            <Badge variant={cashAlerts.length > 0 ? "destructive" : "outline"}>
              {cashAlerts.length} sangria
            </Badge>
            <Badge variant={breakPressure > 0 ? "destructive" : "outline"}>
              {breakPressure} intervalos
            </Badge>
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
      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <div className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-slate-50 text-slate-500">
              <LayoutGrid className="size-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold">{coverageRate}%</div>
              <p className="truncate text-xs text-slate-500">
                {occupiedPostIds.size}/{activePosts.length} postos
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-slate-50 text-slate-500">
              <ListChecks className="size-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold">{openQueues.length}</div>
              <p className="truncate text-xs text-slate-500">
                espera {formatDuration(averageWait)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-slate-50 text-slate-500">
              <Banknote className="size-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold">{cashAlerts.length}</div>
              <p className="truncate text-xs text-slate-500">sangria</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-slate-50 text-slate-500">
              <Timer className="size-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold">{breakPressure}</div>
              <p className="truncate text-xs text-slate-500">intervalos</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-slate-50 text-slate-500">
              <CheckCircle2 className="size-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold">{closingPressure}</div>
              <p className="truncate text-xs text-slate-500">fechamento</p>
            </div>
          </div>
        </div>

        <div className="rounded-md border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-800">
          {recommendation}
        </div>

        {queueFormOpen ? (
          <form
            className="grid gap-2 rounded-md border border-slate-200 p-3 md:grid-cols-[1fr_1fr_0.8fr_0.8fr_auto]"
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

        {openQueues.length > 0 ? (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {openQueues.slice(0, 6).map((signal) => (
              <div key={signal.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{signal.title}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {queueTypeLabel[signal.queue_type]} - {signal.customer_count} clientes - {formatDuration(signal.wait_minutes)}
                    </div>
                  </div>
                  <Badge className={severityClass[signal.severity]} variant="outline">
                    {signal.severity}
                  </Badge>
                </div>
                <div className="mt-3 flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => onResolveQueueSignal(signal.id)}
                  >
                    <CheckCircle2 className="size-3.5" />
                    Resolver
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {idlePosts > 0 ? (
          <div className="text-xs text-slate-500">
            {idlePosts} posto(s) ativo(s) sem colaborador alocado.
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
