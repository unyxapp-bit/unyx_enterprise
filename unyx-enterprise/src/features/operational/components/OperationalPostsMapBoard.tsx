import { useMemo } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  MapPinned,
  Store,
  Unlock,
  type LucideIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { StateBlock } from "@/components/shared/StateBlock"
import { formatDateTimeBR } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { OperationalPost, PostAllocation } from "@/types/domain"
import { postTypeLabel } from "../utils"

type PostMapStatus = "occupied" | "free" | "inactive"

interface OperationalPostsMapBoardProps {
  posts: OperationalPost[]
  allocations: PostAllocation[]
  isLoading: boolean
  isError: boolean
  error?: Error | null
}

type PostCardModel = {
  post: OperationalPost
  allocation: PostAllocation | null
  status: PostMapStatus
}

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
    cardClass: "border-emerald-200 bg-emerald-50/40",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: MapPinned,
  },
  free: {
    label: "Livre",
    cardClass: "border-sky-200 bg-sky-50/40",
    badgeClass: "border-sky-200 bg-sky-50 text-sky-700",
    icon: CheckCircle2,
  },
  inactive: {
    label: "Inativo",
    cardClass: "border-zinc-200 bg-zinc-50/70",
    badgeClass: "border-zinc-200 bg-zinc-100 text-zinc-600",
    icon: AlertTriangle,
  },
}

function buildCardModel(post: OperationalPost, allocation: PostAllocation | null): PostCardModel {
  if (!post.active) {
    return { post, allocation, status: "inactive" }
  }
  if (allocation) {
    return { post, allocation, status: "occupied" }
  }
  return { post, allocation: null, status: "free" }
}

export function OperationalPostsMapBoard({
  posts,
  allocations,
  isLoading,
  isError,
  error,
}: OperationalPostsMapBoardProps) {
  const allocationByPostId = useMemo(() => {
    const map = new Map<string, PostAllocation>()
    for (const allocation of allocations) {
      map.set(allocation.post_id, allocation)
    }
    return map
  }, [allocations])

  const cards = useMemo(
    () =>
      posts
        .slice()
        .sort((a, b) => {
          const statusA = buildCardModel(a, allocationByPostId.get(a.id) ?? null).status
          const statusB = buildCardModel(b, allocationByPostId.get(b.id) ?? null).status
          const priority: Record<PostMapStatus, number> = {
            occupied: 0,
            free: 1,
            inactive: 2,
          }
          const statusCompare = priority[statusA] - priority[statusB]
          if (statusCompare !== 0) return statusCompare

          const sectorCompare = (a.sectors?.name ?? "").localeCompare(
            b.sectors?.name ?? ""
          )
          if (sectorCompare !== 0) return sectorCompare

          return a.name.localeCompare(b.name)
        })
        .map((post) => buildCardModel(post, allocationByPostId.get(post.id) ?? null)),
    [allocationByPostId, posts]
  )

  const summary = useMemo(() => {
    let occupied = 0
    let free = 0
    let inactive = 0
    let withoutSector = 0

    for (const post of posts) {
      const allocation = allocationByPostId.get(post.id)
      if (!post.sector_id) withoutSector += 1
      if (!post.active) {
        inactive += 1
        continue
      }
      if (allocation) occupied += 1
      else free += 1
    }

    return {
      total: posts.length,
      occupied,
      free,
      inactive,
      withoutSector,
    }
  }, [allocationByPostId, posts])

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
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "Total", value: summary.total, Icon: Store },
          { label: "Ocupados", value: summary.occupied, Icon: MapPinned },
          { label: "Livres", value: summary.free, Icon: CheckCircle2 },
          { label: "Inativos", value: summary.inactive, Icon: AlertTriangle },
          { label: "Sem setor", value: summary.withoutSector, Icon: Unlock },
        ].map(({ label, value, Icon }) => (
          <Card
            key={label}
            className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] shadow-sm"
          >
            <CardContent className="flex items-center gap-3 p-3.5">
              <div className="rounded-full border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-soft)] p-2 text-[color:var(--text-secondary)]">
                <Icon className="size-4" />
              </div>
              <div>
                <div className="text-lg font-semibold leading-none text-[color:var(--text-primary)]">
                  {value}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700">
          <span className="size-2 rounded-full bg-emerald-500" />
          Ocupado
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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {cards.map(({ post, allocation, status }) => {
          const config = statusConfig[status]
          const StatusIcon = config.icon

          return (
            <Card
              key={post.id}
              className={cn(
                "rounded-2xl border shadow-sm",
                config.cardClass
              )}
            >
              <CardContent className="space-y-3 p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-[color:var(--text-primary)]">
                      {post.name}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {postTypeLabel[post.type] ?? post.type}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {post.sectors?.name ?? "Sem setor"} ·{" "}
                      {post.branches?.name ?? "Filial"}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <Badge
                      variant="outline"
                      className={cn("rounded-full px-2 py-0.5 text-[10px]", config.badgeClass)}
                    >
                      <StatusIcon className="mr-1 size-3" />
                      {config.label}
                    </Badge>
                    {!post.active ? (
                      <Badge
                        variant="outline"
                        className="rounded-full border-zinc-200 bg-white px-2 py-0.5 text-[10px] text-zinc-600"
                      >
                        Posto desativado
                      </Badge>
                    ) : null}
                    {post.sector_id ? null : (
                      <Badge
                        variant="outline"
                        className="rounded-full border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700"
                      >
                        Sem setor
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-dashed border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] px-3 py-2 text-xs text-muted-foreground">
                  {status === "occupied" ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-[color:var(--text-primary)]">
                        <MapPinned className="size-3.5 shrink-0" />
                        <span className="font-medium">
                          {allocation?.employees?.name ?? "Colaborador"}
                        </span>
                      </div>
                      <div>
                        Alocado desde {formatDateTimeBR(allocation?.started_at)}
                      </div>
                    </div>
                  ) : status === "free" ? (
                    <div className="flex items-center gap-1.5 text-[color:var(--text-primary)]">
                      <CheckCircle2 className="size-3.5 shrink-0 text-sky-600" />
                      <span>Disponivel para alocacao.</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-[color:var(--text-primary)]">
                      <AlertTriangle className="size-3.5 shrink-0 text-zinc-500" />
                      <span>Posto fora de uso no momento.</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

OperationalPostsMapBoard.displayName = "OperationalPostsMapBoard"
