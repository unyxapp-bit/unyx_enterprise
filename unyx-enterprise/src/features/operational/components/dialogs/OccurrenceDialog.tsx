/**
 * OccurrenceDialog - Diálogo para registrar ocorrência
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

interface OccurrenceDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  schedule: ScheduleWithRelations | null
  note: string
  onNoteChange: (note: string) => void
  error: string | null
  isPending: boolean
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}

export const OccurrenceDialog = React.memo(
  ({
    isOpen,
    onOpenChange,
    schedule,
    note,
    onNoteChange,
    error,
    isPending,
    onSubmit,
  }: OccurrenceDialogProps) => {
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar ocorrência</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="rounded-lg border bg-slate-50 p-3 text-sm">
              <div className="font-medium">
                {schedule?.employees?.name ?? "Colaborador"}
              </div>
              <div className="mt-1 text-muted-foreground">
                {schedule?.employees?.sectors?.name ?? "Sem setor"} ·{" "}
                {schedule?.branches?.name ?? "Filial"}
              </div>
            </div>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Descrição da ocorrência</span>
              <textarea
                className="min-h-28 w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"
                value={note}
                onChange={(e) => onNoteChange(e.target.value)}
                placeholder="Ex.: colaborador precisou cobrir outro setor por falta inesperada."
              />
            </label>
            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Registrando..." : "Registrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    )
  }
)

OccurrenceDialog.displayName = "OccurrenceDialog"
