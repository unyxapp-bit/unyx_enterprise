/**
 * ReturnPromptDialog - Diálogo de confirmação de retorno do intervalo
 */

import React from "react"
import { CheckCircle2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { ScheduleWithRelations } from "@/types/domain"
import { formatDuration, isCafeBreak, timeToMinutes } from "../../utils"

interface ReturnPromptDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  schedule: ScheduleWithRelations | null
  currentMinutes: number
  isPending: boolean
  feedback: "idle" | "saving" | "success" | "error"
  feedbackMessage?: string | null
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
    feedback,
    feedbackMessage,
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
    const isSaving = feedback === "saving"
    const showSuccess = feedback === "success"
    const showError = feedback === "error"

    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isCafe ? "☕ Retorno do café" : "Retorno do intervalo"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <EmployeeInfoBlock schedule={schedule} />
            {isSaving ? (
              <div className="flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
                <Loader2 className="size-4 animate-spin" />
                Registrando retorno no sistema...
              </div>
            ) : null}
            {showSuccess ? (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                <CheckCircle2 className="size-4" />
                {feedbackMessage ?? "Retorno confirmado. O painel esta sendo atualizado."}
              </div>
            ) : null}
            {showError && feedbackMessage ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {feedbackMessage}
              </div>
            ) : null}
            {overtime > 0 ? (
              <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-800">
                Está há{" "}
                <span className="font-semibold">{formatDuration(overtime)}</span>{" "}
                além do {isCafe ? "café" : "intervalo"} previsto.
              </div>
            ) : (
              <p className="text-sm text-slate-600">
                {isCafe
                  ? "O café encerrou. O colaborador já voltou ao posto?"
                  : "O intervalo encerrou. O colaborador já voltou ao posto?"}
              </p>
            )}
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {isCafe
                ? "Se marcar que nao retornou, o sistema registra atraso do café e mantém o alerta em aberto."
                : "Se marcar que nao retornou, o sistema registra atraso do intervalo e abre alerta operacional."}
            </div>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                className="border-red-200 text-red-700 hover:bg-red-50"
                disabled={isPending || isSaving || showSuccess}
                onClick={onReturnNo}
              >
                Registrar atraso
              </Button>
              <Button disabled={isPending || isSaving || showSuccess} onClick={onReturnYes}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Registrando...
                  </>
                ) : showSuccess ? (
                  <>
                    <CheckCircle2 className="mr-2 size-4" />
                    Confirmado
                  </>
                ) : (
                  "Sim, retornou"
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    )
  }
)

ReturnPromptDialog.displayName = "ReturnPromptDialog"
