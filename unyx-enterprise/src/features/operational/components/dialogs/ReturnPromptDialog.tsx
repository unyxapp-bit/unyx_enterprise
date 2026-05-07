/**
 * ReturnPromptDialog - Diálogo de confirmação de retorno do intervalo
 */

import React from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { ScheduleWithRelations } from "@/types/domain"
import { formatDuration, isCafeBreak, timeToMinutes } from "../utils"

interface ReturnPromptDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  schedule: ScheduleWithRelations | null
  currentMinutes: number
  isPending: boolean
  onReturnYes: () => void
  onReturnNo: () => void
}

function EmployeeInfoBlock({ schedule }: { schedule: ScheduleWithRelations | null }) {
  if (!schedule) return null
  return (
    <div className="rounded-lg border bg-slate-50 p-3 text-sm">
      <div className="font-medium">
        {schedule.employees?.name ?? "Colaborador"}
      </div>
      <div className="mt-1 text-muted-foreground">
        {schedule.employees?.sectors?.name ?? "Sem setor"} ·{" "}
        {schedule.branches?.name ?? "Filial"}
      </div>
    </div>
  )
}

export const ReturnPromptDialog = React.memo(
  ({
    isOpen,
    onOpenChange,
    schedule,
    currentMinutes,
    isPending,
    onReturnYes,
    onReturnNo,
  }: ReturnPromptDialogProps) => {
    if (!schedule) {
      return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Intervalo encerrado</DialogTitle>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      )
    }

    const isCafe = isCafeBreak(schedule.notes)
    const endMin = timeToMinutes(schedule.break_end)
    const overtime = endMin !== null ? Math.max(0, currentMinutes - endMin) : 0

    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isCafe ? "☕ Café encerrado" : "Intervalo encerrado"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <EmployeeInfoBlock schedule={schedule} />
            {overtime > 0 ? (
              <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-800">
                Está há{" "}
                <span className="font-semibold">{formatDuration(overtime)}</span>{" "}
                além do {isCafe ? "café" : "intervalo"} previsto.
              </div>
            ) : (
              <p className="text-sm text-slate-600">
                {isCafe
                  ? "O café de 10min encerrou. O colaborador já retornou ao posto?"
                  : "O intervalo encerrou agora. O colaborador já retornou ao posto?"}
              </p>
            )}
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                className="border-red-200 text-red-700 hover:bg-red-50"
                disabled={isPending}
                onClick={onReturnNo}
              >
                Não retornou — marcar atraso
              </Button>
              <Button disabled={isPending} onClick={onReturnYes}>
                Sim, retornou
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    )
  }
)

ReturnPromptDialog.displayName = "ReturnPromptDialog"
