/**
 * OccupiedPostsCard - Lista de postos operacionais ocupados
 */

import React from "react"
import { ChevronDown, Clock3, MapPinned, Unlock, UserRound } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StateBlock } from "@/components/shared/StateBlock"
import { formatDateTimeBR } from "@/lib/format"
import type { PostAllocation } from "@/types/domain"
import { postTypeLabel } from "../utils"

interface OccupiedPostsCardProps {
  allocations: PostAllocation[]
  isLoading: boolean
  isError: boolean
  error?: Error | null
  isReleasePending: boolean
  releasingAllocationId: string | null
  onReleasePost: (allocation: PostAllocation) => void
}

const allocationStatusLabel: Record<PostAllocation["status"], string> = {
  alocado: "Ocupado",
  aguardando_troca: "Aguardando troca",
  em_troca: "Em troca",
  finalizado: "Finalizado",
  sem_cobertura: "Sem cobertura",
}

export const OccupiedPostsCard = React.memo(
  ({
    allocations,
    isLoading,
    isError,
    error,
    isReleasePending,
    releasingAllocationId,
    onReleasePost,
  }: OccupiedPostsCardProps) => {
    const [isOpen, setIsOpen] = React.useState(true)

    return (
      <Card className="border bg-white shadow-sm">
        <CardHeader
          className="cursor-pointer select-none"
          onClick={() => setIsOpen((value) => !value)}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault()
              setIsOpen((value) => !value)
            }
          }}
          aria-expanded={isOpen}
        >
          <CardTitle className="flex items-center gap-2">
            <MapPinned className="size-5" />
            <span className="flex-1">Postos ocupados</span>
            <Badge variant="outline">{allocations.length}</Badge>
            <ChevronDown
              className={`size-4 text-muted-foreground transition-transform duration-200 ${
                isOpen ? "rotate-180" : ""
              }`}
            />
          </CardTitle>
        </CardHeader>
        {isOpen ? (
          <CardContent>
          {isLoading ? (
            <StateBlock
              type="loading"
              title="Carregando postos"
              className="min-h-32"
            />
          ) : isError ? (
            <StateBlock
              type="error"
              title="Erro ao carregar postos"
              description={error?.message}
              className="min-h-32"
            />
          ) : allocations.length === 0 ? (
            <StateBlock title="Nenhum posto ocupado" className="min-h-32" />
          ) : (
            <div className="space-y-2">
              {allocations.map((allocation) => {
                const post = allocation.operational_posts
                const postType = post?.type
                  ? postTypeLabel[post.type] ?? post.type
                  : null
                const details = [post?.sectors?.name ?? "Sem setor", postType]
                  .filter(Boolean)
                  .join(" - ")

                return (
                  <div
                    key={allocation.id}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900">
                          {post?.name ?? "Posto"}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">
                          {details}
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className="border-emerald-200 bg-emerald-50 text-emerald-700"
                      >
                        {allocationStatusLabel[allocation.status]}
                      </Badge>
                    </div>

                    <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <UserRound className="size-3.5 shrink-0" />
                        <span className="truncate">
                          {allocation.employees?.name ?? "Colaborador"}
                        </span>
                      </div>
                      <div className="flex min-w-0 items-center gap-1.5">
                        <Clock3 className="size-3.5 shrink-0" />
                        <span className="truncate">
                          Desde {formatDateTimeBR(allocation.started_at)}
                        </span>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3 flex w-full items-center justify-center gap-1.5 border-slate-300 text-xs"
                      disabled={isReleasePending}
                      onClick={() => onReleasePost(allocation)}
                    >
                      <Unlock className="size-3.5" />
                      {releasingAllocationId === allocation.id
                        ? "Liberando..."
                        : "Liberar posto"}
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
          </CardContent>
        ) : null}
      </Card>
    )
  }
)

OccupiedPostsCard.displayName = "OccupiedPostsCard"
