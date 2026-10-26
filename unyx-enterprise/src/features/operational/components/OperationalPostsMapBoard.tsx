import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  Coffee,
  MapPinned,
  Unlock,
  type LucideIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { StateBlock } from "@/components/shared/StateBlock"
import { formatDateTimeBR } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { OperationalBreak, OperationalPost, PostAllocation } from "@/types/domain"
import { formatDuration, postTypeLabel, timeToMinutes } from "../utils"
import { AllocateEmployeeToPost } from "./AllocateEmployeeToPost"
import { AllocationTimeActions } from "./AllocationTimeActions"

type PostMapStatus = "occupied" | "paused" | "free" | "inactive"

interface OperationalPostsMapBoardProps {
  posts: OperationalPost[]
  allocations: PostAllocation[]
  operationalBreaks?: OperationalBreak[]
  isLoading: boolean
  isError: boolean
  error?: Error | null
  onReleaseAllocation?: (allocation: PostAllocation) => void | Promise<void>
  isReleasePending?: boolean
}

type PostCardModel = {
  post: OperationalPost
  allocation: PostAllocation | null
  operationalBreak: OperationalBreak | null
  status: PostMapStatus
}

const ACTIVE_BREAK_STATUS_SET = new Set(["pendente", "liberado", "atrasado"])

const statusConfig: Record<
  PostMapStatus,
  {
    label: string
    cardClass: string
    badgeClass: string
    icon: LucideIcon
  }
> = {
  occupied: {
    label: "Ocupado",
    cardClass:
      "border-emerald-200 bg-emerald-50/40 dark:!border-emerald-400/20 dark:!bg-[color:var(--bg-surface)]",
    badgeClass:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-300/20 dark:bg-emerald-500/15 dark:text-emerald-100",
    icon: MapPinned,
  },
  paused: {
    label: "Pausado",
    cardClass:
      "border-amber-200 bg-amber-50/45 dark:!border-amber-400/20 dark:!bg-[color:var(--bg-surface)]",
    badgeClass:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-300/20 dark:bg-amber-500/15 dark:text-amber-100",
    icon: Coffee,
  },
  free: {
    label: "Livre",
    cardClass:
      "border-sky-200 bg-sky-50/40 dark:!border-sky-400/20 dark:!bg-[color:var(--bg-surface)]",
    badgeClass:
      "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-300/20 dark:bg-sky-500/15 dark:text-sky-100",
    icon: Unlock,
  },
  inactive: {
    label: "Inativo",
    cardClass:
      "border-zinc-200 bg-zinc-50/70 dark:!border-zinc-700 dark:!bg-[color:var(--bg-surface-soft)]",
    badgeClass:
      "border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-300",
    icon: AlertTriangle,
  },
}

function buildCardModel(
  post: OperationalPost,
  allocation: PostAllocation | null,
  operationalBreak: OperationalBreak | null
): PostCardModel {
  if (!post.active) {
    return { post, allocation, operationalBreak, status: "inactive" }
  }
  if (allocation && operationalBreak) {
    return { post, allocation, operationalBreak, status: "paused" }
  }
  if (allocation) {
    return { post, allocation, operationalBreak: null, status: "occupied" }
  }
  return { post, allocation: null, operationalBreak: null, status: "free" }
}

function minutesSince(value: string | null | undefined, nowMs: number) {
  if (!value) return 0
  const startedAt = new Date(value).getTime()
  if (Number.isNaN(startedAt)) return 0
  return Math.max(0, Math.floor((nowMs - startedAt) / 60_000))
}

function trimTime(value: string | null | undefined) {
  return value ? value.slice(0, 5) : "--:--"
}

/** Situação do intervalo previsto na escala, para o fiscal decidir se libera agora. */
function scheduledBreakInfo(
  schedule: PostAllocation["schedules"],
  nowMs: number
): { text: string; tone: "info" | "open" | "late" } | null {
  const start = timeToMinutes(schedule?.break_start)
  const end = timeToMinutes(schedule?.break_end)
  if (start === null || end === null) return null
  const now = new Date(nowMs)
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const window = `${trimTime(schedule?.break_start)} – ${trimTime(schedule?.break_end)}`
  if (nowMin < start) {
    return { text: `Intervalo programado ${window} · faltam ${formatDuration(start - nowMin)}`, tone: "info" }
  }
  if (nowMin <= end) {
    return { text: `Janela de intervalo aberta (${window}) · há ${formatDuration(nowMin - start)}`, tone: "open" }
  }
  return {
    text: `Intervalo previsto ${window} já passou há ${formatDuration(nowMin - end)}. Confirme se foi feito.`,
    tone: "late",
  }
}

function releaseActionLabel(post: OperationalPost, pending: boolean) {
  if (pending) return "Liberando..."
  return post.type === "cashier" ? "Liberar caixa" : "Liberar posto"
}

function formatTimeBR(value: string | null | undefined) {
  if (!value) return "--:--"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "--:--"
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

export function OperationalPostsMapBoard({
  posts,
  allocations,
  operationalBreaks = [],
  isLoading,
  isError,
  error,
  onReleaseAllocation,
  isReleasePending = false,
}: OperationalPostsMapBoardProps) {
  const [selectedCard, setSelectedCard] = useState<PostCardModel | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const allocationByPostId = useMemo(() => {
    const map = new Map<string, PostAllocation>()
    for (const allocation of allocations) {
      map.set(allocation.post_id, allocation)
    }
    return map
  }, [allocations])

  const activeCoffeeBreakByAllocationId = useMemo(() => {
    const map = new Map<string, OperationalBreak>()
    for (const item of operationalBreaks) {
      if (
        item.allocation_id &&
        item.break_type !== "intervalo" &&
        ACTIVE_BREAK_STATUS_SET.has(item.status)
      ) {
        map.set(item.allocation_id, item)
      }
    }
    return map
  }, [operationalBreaks])

  const cards = useMemo(
    () =>
      posts
        .slice()
        .sort((a, b) => {
          const sectorCompare = (a.sectors?.name ?? "").localeCompare(
            b.sectors?.name ?? ""
          )
          if (sectorCompare !== 0) return sectorCompare

          return a.name.localeCompare(b.name)
        })
        .map((post) => {
          const allocation = allocationByPostId.get(post.id) ?? null
          const operationalBreak = allocation
            ? activeCoffeeBreakByAllocationId.get(allocation.id) ?? null
            : null
          return buildCardModel(post, allocation, operationalBreak)
        }),
    [activeCoffeeBreakByAllocationId, allocationByPostId, posts]
  )

  const selectedMinutes =
    selectedCard?.status === "paused"
      ? minutesSince(
          selectedCard.operationalBreak?.actual_start ??
            selectedCard.operationalBreak?.planned_start,
          nowMs
        )
      : selectedCard?.allocation
        ? minutesSince(selectedCard.allocation.started_at, nowMs)
        : 0

  if (isLoading) {
    return <StateBlock type="loading" title="Carregando mapa de postos" />
  }

  if (isError) {
    return (
      <StateBlock
        type="error"
        title="Erro ao carregar mapa de postos"
        description={error?.message}
      />
    )
  }

  if (posts.length === 0) {
    return (
      <StateBlock
        title="Nenhum posto cadastrado"
        description="Cadastre postos para visualizar a ocupação da operação."
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 text-emerald-700 dark:text-emerald-300">
          <span className="size-2 rounded-full bg-emerald-500" />
          Ocupado
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-2.5 py-1 text-amber-700 dark:text-amber-300">
          <span className="size-2 rounded-full bg-amber-500" />
          Pausado
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 dark:border-sky-500/30 bg-sky-50 dark:bg-sky-500/10 px-2.5 py-1 text-sky-700 dark:text-sky-300">
          <span className="size-2 rounded-full bg-sky-500" />
          Livre
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-1 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-300">
          <span className="size-2 rounded-full bg-zinc-400" />
          Inativo
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {cards.map(({ post, allocation, operationalBreak, status }) => {
          const config = statusConfig[status]
          const StatusIcon = config.icon

          return (
            <Card
              size="sm"
              key={post.id}
              className={cn(
                "rounded-[1rem] border shadow-sm transition-shadow hover:shadow-md",
                config.cardClass
              )}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedCard({ post, allocation, operationalBreak, status })}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  setSelectedCard({ post, allocation, operationalBreak, status })
                }
              }}
            >
              <CardContent className="space-y-1.5 p-2">
                <div className="flex items-center justify-between gap-1.5">
                  <div className="truncate text-xs font-semibold text-[color:var(--text-primary)]">
                    {post.name}
                  </div>
                  <Badge
                    variant="outline"
                    className={cn("h-4 shrink-0 rounded-full px-1.5 py-0 text-[9px]", config.badgeClass)}
                  >
                    <StatusIcon className="mr-0.5 size-2.5" />
                    {config.label}
                  </Badge>
                </div>
                <div className="-mt-1 truncate text-[10px] text-muted-foreground">
                  {postTypeLabel[post.type] ?? post.type} · {post.sectors?.name ?? "Sem setor"}
                </div>

                <div className="rounded-md border border-dashed border-[color:var(--border-soft)] bg-[color:var(--bg-surface-soft)] px-2 py-1 text-[10px] text-muted-foreground">
                  {status === "occupied" ? (
                    <div className="flex min-w-0 items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1.5 text-[color:var(--text-primary)]">
                        <MapPinned className="size-3 shrink-0" />
                        <span className="truncate font-medium">
                          {allocation?.employees?.name ?? "Colaborador"}
                        </span>
                      </div>
                      <div className="shrink-0 text-[11px]">
                        {formatDateTimeBR(allocation?.started_at)}
                      </div>
                    </div>
                  ) : status === "paused" ? (
                    <div className="flex min-w-0 items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1.5 text-[color:var(--text-primary)]">
                        <Coffee className="size-3 shrink-0 text-amber-600 dark:text-amber-300" />
                        <span className="truncate font-medium">
                          {allocation?.employees?.name ?? "Colaborador"}
                        </span>
                      </div>
                      <div className="shrink-0 text-[11px]">
                        Ate {formatTimeBR(operationalBreak?.planned_end)}
                      </div>
                    </div>
                  ) : status === "free" ? (
                    <div className="flex items-center gap-1.5 text-[color:var(--text-primary)]">
                      <Unlock className="size-3 shrink-0 text-sky-600 dark:text-sky-300" />
                      <span>Disponível para alocação.</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-[color:var(--text-primary)]">
                      <AlertTriangle className="size-3 shrink-0 text-zinc-500" />
                      <span>Posto fora de uso no momento.</span>
                    </div>
                  )}
                </div>

                {status === "occupied" && allocation && onReleaseAllocation ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="h-6 w-full rounded-md text-[10px]"
                    disabled={isReleasePending}
                    onClick={async (event) => {
                      event.stopPropagation()
                      try {
                        await onReleaseAllocation(allocation)
                      } catch {
                        // The mutation hook already shows the error toast.
                      }
                    }}
                  >
                    <Unlock className="size-3.5" />
                    {releaseActionLabel(post, isReleasePending)}
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Dialog
        open={Boolean(selectedCard)}
        onOpenChange={(open) => {
          if (!open) setSelectedCard(null)
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{selectedCard?.post.name ?? "Detalhes do posto"}</DialogTitle>
          </DialogHeader>

          {selectedCard ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Badge
                  variant="outline"
                  className={cn("rounded-full", statusConfig[selectedCard.status].badgeClass)}
                >
                  {statusConfig[selectedCard.status].label}
                </Badge>
                <span>
                  {[
                    postTypeLabel[selectedCard.post.type] ?? selectedCard.post.type,
                    selectedCard.post.sectors?.name &&
                    selectedCard.post.sectors.name !==
                      (postTypeLabel[selectedCard.post.type] ?? selectedCard.post.type)
                      ? selectedCard.post.sectors.name
                      : null,
                    selectedCard.post.branches?.name ?? "Filial",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>

              {(selectedCard.status === "occupied" || selectedCard.status === "paused") &&
              selectedCard.allocation ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-soft)] p-4">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        {selectedCard.status === "paused" ? "Pausado há" : "Em uso há"}
                      </div>
                      <div className="mt-1 text-3xl font-semibold text-[color:var(--text-primary)]">
                        {formatDuration(selectedMinutes)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        {selectedCard.status === "paused" ? "Retorno previsto" : "No posto desde"}
                      </div>
                      <div className="mt-1 text-lg font-semibold text-[color:var(--text-primary)]">
                        {selectedCard.status === "paused"
                          ? formatTimeBR(selectedCard.operationalBreak?.planned_end)
                          : formatTimeBR(selectedCard.allocation.started_at)}
                      </div>
                      {selectedCard.status === "occupied" ? (
                        <div className="text-xs text-muted-foreground">
                          {formatDateTimeBR(selectedCard.allocation.started_at)}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[color:var(--border-soft)] p-4">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Colaborador
                    </div>
                    <div className="mt-1 text-base font-semibold text-[color:var(--text-primary)]">
                      {selectedCard.allocation.employees?.name ?? "Colaborador"}
                    </div>
                    <div className="mt-0.5 text-sm text-muted-foreground">
                      {selectedCard.allocation.employees?.sectors?.name ?? "Sem setor"}
                      {selectedCard.allocation.schedules?.start_time
                        ? ` · Jornada ${trimTime(selectedCard.allocation.schedules.start_time)} → ${trimTime(selectedCard.allocation.schedules.end_time)}`
                        : ""}
                    </div>
                    {(() => {
                      const info = scheduledBreakInfo(selectedCard.allocation.schedules, nowMs)
                      if (!info || selectedCard.status === "paused") return null
                      return (
                        <div
                          className={cn(
                            "mt-3 rounded-xl border px-3 py-2 text-sm",
                            info.tone === "late"
                              ? "border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
                              : info.tone === "open"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                                : "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300"
                          )}
                        >
                          {info.text}
                        </div>
                      )
                    })()}
                  </div>

                  {selectedCard.status === "occupied" ? (
                    <AllocationTimeActions
                      allocation={
                        allocations.find((item) => item.id === selectedCard.allocation?.id) ??
                        selectedCard.allocation
                      }
                      hasActiveBreak={false}
                      nowMs={nowMs}
                      exitLabel={selectedCard.post.type === "cashier" ? "Liberar caixa" : "Liberar posto"}
                      onExited={() => setSelectedCard(null)}
                    />
                  ) : null}
                </div>
              ) : selectedCard.status === "free" ? (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-sky-200 dark:border-sky-500/30 bg-sky-50 dark:bg-sky-500/10 p-4 text-sm text-sky-800 dark:text-sky-300">
                    Este posto está livre e pronto para receber uma nova alocação.
                  </div>
                  <AllocateEmployeeToPost
                    post={selectedCard.post}
                    allocations={allocations}
                    operationalBreaks={operationalBreaks}
                    nowMs={nowMs}
                    onAllocated={() => setSelectedCard(null)}
                  />
                </div>
              ) : (
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300">
                  Este posto está inativo no momento.
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

OperationalPostsMapBoard.displayName = "OperationalPostsMapBoard"
