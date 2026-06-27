import { useMemo, useState } from "react"
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { StateBlock } from "@/components/shared/StateBlock"
import { formatDateTimeBR } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { OperationalBreak, OperationalPost, PostAllocation } from "@/types/domain"
import { formatDuration, postTypeLabel } from "../utils"

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

  const nowMs = Date.now()

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
        description="Cadastre postos para visualizar a ocupacao da operacao."
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700">
          <span className="size-2 rounded-full bg-emerald-500" />
          Ocupado
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-700">
          <span className="size-2 rounded-full bg-amber-500" />
          Pausado
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-sky-700">
          <span className="size-2 rounded-full bg-sky-500" />
          Livre
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-1 text-zinc-600">
          <span className="size-2 rounded-full bg-zinc-400" />
          Inativo
        </span>
      </div>

      <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
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
              <CardContent className="space-y-2 p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold text-[color:var(--text-primary)]">
                      {post.name}
                    </div>
                    <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
                      {postTypeLabel[post.type] ?? post.type} ·{" "}
                      {post.sectors?.name ?? "Sem setor"}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <Badge
                      variant="outline"
                      className={cn("h-5 rounded-full px-1.5 py-0 text-[9px]", config.badgeClass)}
                    >
                      <StatusIcon className="mr-1 size-2.5" />
                      {config.label}
                    </Badge>
                    {!post.active ? (
                      <Badge
                        variant="outline"
                        className="h-5 rounded-full border-zinc-200 bg-white px-1.5 py-0 text-[9px] text-zinc-600"
                      >
                        Desativado
                      </Badge>
                    ) : null}
                    {post.sector_id ? null : (
                      <Badge
                        variant="outline"
                        className="h-5 rounded-full border-amber-200 bg-amber-50 px-1.5 py-0 text-[9px] text-amber-700"
                      >
                        Sem setor
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-dashed border-[color:var(--border-soft)] bg-[color:var(--bg-surface-soft)] px-2.5 py-1.5 text-[11px] text-muted-foreground">
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
                        <Coffee className="size-3 shrink-0 text-amber-600" />
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
                      <Unlock className="size-3 shrink-0 text-sky-600" />
                      <span>Disponivel para alocacao.</span>
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
                    className="h-7 w-full rounded-lg text-[11px]"
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalhes do posto</DialogTitle>
          </DialogHeader>

          {selectedCard ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-soft)] p-4">
                <div className="text-sm font-semibold text-[color:var(--text-primary)]">
                  {selectedCard.post.name}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {postTypeLabel[selectedCard.post.type] ?? selectedCard.post.type}
                  {" · "}
                  {selectedCard.post.sectors?.name ?? "Sem setor"}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {selectedCard.post.branches?.name ?? "Filial"}
                </div>
              </div>

              {(selectedCard.status === "occupied" || selectedCard.status === "paused") &&
              selectedCard.allocation ? (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-[color:var(--border-soft)] p-4">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        {selectedCard.status === "paused" ? "Pausado ha" : "Em uso ha"}
                      </div>
                      <div className="mt-1 text-2xl font-semibold text-[color:var(--text-primary)]">
                        {formatDuration(selectedMinutes)}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-[color:var(--border-soft)] p-4">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        {selectedCard.status === "paused" ? "Previsao retorno" : "Desde"}
                      </div>
                      <div className="mt-1 text-sm font-medium text-[color:var(--text-primary)]">
                        {selectedCard.status === "paused"
                          ? formatTimeBR(selectedCard.operationalBreak?.planned_end)
                          : formatDateTimeBR(selectedCard.allocation.started_at)}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[color:var(--border-soft)] p-4">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Colaborador
                    </div>
                    <div className="mt-1 text-sm font-medium text-[color:var(--text-primary)]">
                      {selectedCard.allocation.employees?.name ?? "Colaborador"}
                    </div>
                  </div>
                </div>
              ) : selectedCard.status === "free" ? (
                <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800">
                  Este posto esta livre e pronto para receber uma nova alocacao.
                </div>
              ) : (
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                  Este posto esta inativo no momento.
                </div>
              )}

              {selectedCard.status === "occupied" &&
              selectedCard.allocation &&
              onReleaseAllocation ? (
                <DialogFooter>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={async () => {
                      try {
                        await onReleaseAllocation(selectedCard.allocation!)
                        setSelectedCard(null)
                      } catch {
                        // The mutation hook already shows the error toast.
                      }
                    }}
                    disabled={isReleasePending}
                  >
                    {releaseActionLabel(selectedCard.post, isReleasePending)}
                  </Button>
                </DialogFooter>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

OperationalPostsMapBoard.displayName = "OperationalPostsMapBoard"
