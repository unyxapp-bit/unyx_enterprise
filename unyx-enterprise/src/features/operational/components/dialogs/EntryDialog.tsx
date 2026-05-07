/**
 * EntryDialog - Diálogo para confirmar entrada e selecionar posto
 */

import React, { useMemo } from "react"
import { MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { OperationalPost } from "@/types/domain"
import { postTypeLabel } from "../utils"

interface EntryDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  employeeName: string
  employeeRole: string | null | undefined
  employeeSector: string | null | undefined
  startTime: string | null | undefined
  endTime: string | null | undefined
  availablePosts: OperationalPost[]
  occupiedPostIds: Set<string>
  employeeByAllocation: Map<string, string>
  selectedPostId: string | null
  onSelectedPostIdChange: (postId: string | null) => void
  isPending: boolean
  onConfirm: (withPost: boolean) => void
}

export const EntryDialog = React.memo(
  ({
    isOpen,
    onOpenChange,
    employeeName,
    employeeRole,
    employeeSector,
    startTime,
    endTime,
    availablePosts,
    occupiedPostIds,
    employeeByAllocation,
    selectedPostId,
    onSelectedPostIdChange,
    isPending,
    onConfirm,
  }: EntryDialogProps) => {
    const postsBySector = useMemo(() => {
      const map = new Map<string, OperationalPost[]>()
      for (const p of availablePosts) {
        const key = p.sectors?.name ?? "Sem setor"
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push(p)
      }
      return map
    }, [availablePosts])

    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirmar entrada</DialogTitle>
          </DialogHeader>

          {/* Employee info */}
          <div className="rounded-lg border bg-slate-50 p-3 text-sm">
            <div className="font-semibold">{employeeName ?? "Colaborador"}</div>
            <div className="mt-0.5 text-muted-foreground">
              {[employeeRole, employeeSector]
                .filter(Boolean)
                .join(" · ")}
              {" · "}
              {startTime} → {endTime}
            </div>
          </div>

          {/* Post selection */}
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">
              Selecionar posto de trabalho
            </p>
            {availablePosts.length === 0 ? (
              <div className="rounded-lg border border-dashed bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
                Nenhum posto cadastrado. O colaborador será marcado como trabalhando sem posto.
              </div>
            ) : (
              <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
                {Array.from(postsBySector.entries()).map(([sector, posts]) => (
                  <div key={sector}>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      {sector}
                    </p>
                    <div className="space-y-1">
                      {posts.map((post) => {
                        const isOccupied = occupiedPostIds.has(post.id)
                        const occupiedBy = employeeByAllocation.get(post.id)
                        const isSelected = selectedPostId === post.id
                        return (
                          <button
                            key={post.id}
                            onClick={() =>
                              onSelectedPostIdChange(isSelected ? null : post.id)
                            }
                            className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                              isSelected
                                ? "border-indigo-400 bg-indigo-50 text-indigo-900"
                                : "border-slate-200 bg-white hover:bg-slate-50"
                            }`}
                          >
                            <MapPin
                              className={`size-4 shrink-0 ${
                                isSelected
                                  ? "text-indigo-500"
                                  : "text-slate-400"
                              }`}
                            />
                            <div className="min-w-0 flex-1">
                              <span className="font-medium">{post.name}</span>
                              <span className="ml-2 text-xs text-slate-400">
                                {postTypeLabel[post.type] ?? post.type}
                              </span>
                            </div>
                            {isOccupied ? (
                              <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                                {occupiedBy
                                  ? occupiedBy.split(" ")[0]
                                  : "Ocupado"}
                              </span>
                            ) : (
                              <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                                Livre
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              className="text-slate-500"
              onClick={() => onConfirm(false)}
              disabled={isPending}
            >
              Entrar sem posto
            </Button>
            <Button
              disabled={isPending}
              onClick={() => onConfirm(!!selectedPostId)}
            >
              {isPending
                ? "Confirmando..."
                : selectedPostId
                  ? "Confirmar com posto"
                  : "Confirmar entrada"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }
)

EntryDialog.displayName = "EntryDialog"
