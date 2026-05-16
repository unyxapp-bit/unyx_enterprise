/**
 * EntryDialog - Diálogo para confirmar entrada e selecionar posto
 */

import React, { useMemo } from "react"
import { CheckCircle2, Clock3, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { OperationalPost } from "@/types/domain"
import { postTypeLabel } from "../../utils"

interface EntryDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  employeeName: string
  employeeRole: string | null | undefined
  employeeSector: string | null | undefined
  startTime: string | null | undefined
  breakStartTime: string | null | undefined
  breakEndTime: string | null | undefined
  endTime: string | null | undefined
  shouldAskBreakAlreadyDone: boolean
  breakAlreadyDone: boolean | null
  onBreakAlreadyDoneChange: (value: boolean | null) => void
  availablePosts: OperationalPost[]
  occupiedPostIds: Set<string>
  selectedPostId: string | null
  onSelectedPostIdChange: (postId: string | null) => void
  isPending: boolean
  onConfirm: (withPost: boolean, breakAlreadyDone: boolean) => void
}

export const EntryDialog = React.memo(
  ({
    isOpen,
    onOpenChange,
    employeeName,
    employeeRole,
    employeeSector,
    startTime,
    breakStartTime,
    breakEndTime,
    endTime,
    shouldAskBreakAlreadyDone,
    breakAlreadyDone,
    onBreakAlreadyDoneChange,
    availablePosts,
    occupiedPostIds,
    selectedPostId,
    onSelectedPostIdChange,
    isPending,
    onConfirm,
  }: EntryDialogProps) => {
    const freePosts = useMemo(
      () => availablePosts.filter((post) => !occupiedPostIds.has(post.id)),
      [availablePosts, occupiedPostIds]
    )

    React.useEffect(() => {
      if (
        selectedPostId &&
        !freePosts.some((post) => post.id === selectedPostId)
      ) {
        onSelectedPostIdChange(null)
      }
    }, [freePosts, onSelectedPostIdChange, selectedPostId])

    const postsBySector = useMemo(() => {
      const map = new Map<string, OperationalPost[]>()
      for (const p of freePosts) {
        const key = p.sectors?.name ?? "Sem setor"
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push(p)
      }
      return map
    }, [freePosts])
    const canConfirm = !shouldAskBreakAlreadyDone || breakAlreadyDone !== null

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

          {shouldAskBreakAlreadyDone ? (
            <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-start gap-2 text-sm text-amber-900">
                <Clock3 className="mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="font-semibold">Intervalo previsto ja passou</p>
                  <p className="mt-0.5 text-amber-800">
                    Antes de confirmar a entrada/alocacao, informe se o colaborador ja realizou o intervalo
                    {breakStartTime && breakEndTime
                      ? ` (${breakStartTime} - ${breakEndTime})`
                      : ""}.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={breakAlreadyDone === true ? "default" : "outline"}
                  className="h-auto flex-col gap-1 py-3"
                  onClick={() => onBreakAlreadyDoneChange(true)}
                >
                  <CheckCircle2 className="size-4" />
                  <span>Sim, ja fez</span>
                </Button>
                <Button
                  type="button"
                  variant={breakAlreadyDone === false ? "default" : "outline"}
                  className="h-auto flex-col gap-1 py-3"
                  onClick={() => onBreakAlreadyDoneChange(false)}
                >
                  <Clock3 className="size-4" />
                  <span>Ainda nao fez</span>
                </Button>
              </div>
            </div>
          ) : null}

          {/* Post selection */}
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">
              Selecionar posto de trabalho
            </p>
            {freePosts.length === 0 ? (
              <div className="rounded-lg border border-dashed bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
                Nenhum posto livre. Libere um posto ou confirme a entrada sem posto.
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
                            <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                              Livre
                            </span>
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
              onClick={() => onConfirm(false, breakAlreadyDone === true)}
              disabled={isPending || !canConfirm}
            >
              Entrar sem posto
            </Button>
            <Button
              disabled={isPending || !canConfirm}
              onClick={() => onConfirm(!!selectedPostId, breakAlreadyDone === true)}
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
