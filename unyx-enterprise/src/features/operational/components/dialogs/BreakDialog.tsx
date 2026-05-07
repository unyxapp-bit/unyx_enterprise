/**
 * BreakDialog - Diálogo para liberar intervalo (com lógica de atraso)
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
import { Input } from "@/components/ui/input"
import type { ScheduleWithRelations } from "@/types/domain"
import { isLateForBreak, timeToMinutes } from "../../utils"

interface BreakDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  schedule: ScheduleWithRelations | null
  breakDialogMode: "question" | "late_input"
  onModeChange: (mode: "question" | "late_input") => void
  breakLateTime: string
  onLateTimeChange: (time: string) => void
  currentMinutes: number
  isPending: boolean
  onConfirm: (actualStartTime: string) => void
}

function EmployeeInfoBlock({ schedule }: { schedule: ScheduleWithRelations | null }) {
  if (!schedule) return null
  return (
    <div className="rounded-lg border bg-slate-50 p-3 text-sm">
      <div className="font-semibold">{schedule.employees?.name ?? "Colaborador"}</div>
      <div className="mt-0.5 text-muted-foreground">
        {[schedule.employees?.role, schedule.employees?.sectors?.name]
          .filter(Boolean)
          .join(" · ")}
      </div>
    </div>
  )
}

export const BreakDialog = React.memo(
  ({
    isOpen,
    onOpenChange,
    schedule,
    breakDialogMode,
    onModeChange,
    breakLateTime,
    onLateTimeChange,
    currentMinutes,
    isPending,
    onConfirm,
  }: BreakDialogProps) => {
    if (!schedule) return null

    const pad = (v: number) => String(v).padStart(2, "0")
    const nowStr = `${pad(Math.floor(currentMinutes / 60))}:${pad(currentMinutes % 60)}`

    const scheduledStartMin = timeToMinutes(schedule.break_start)
    const scheduledEndStr = schedule.break_end ?? ""
    const plannedDuration =
      scheduledStartMin !== null && timeToMinutes(schedule.break_end) !== null
        ? timeToMinutes(schedule.break_end)! - scheduledStartMin
        : 60

    const isLate = isLateForBreak(scheduledStartMin, currentMinutes)

    const durationLabel = (min: number) =>
      min >= 60
        ? `${Math.floor(min / 60)}h${min % 60 > 0 ? ` ${min % 60}min` : ""}`
        : `${min}min`

    // No scheduled break times
    if (!schedule.break_start) {
      return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Liberar para intervalo</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <EmployeeInfoBlock schedule={schedule} />
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                Sem horário de intervalo definido na escala. O intervalo será registrado a partir de agora ({nowStr}).
              </div>
              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancelar
                </Button>
                <Button
                  disabled={isPending}
                  onClick={() => onConfirm(nowStr)}
                >
                  {isPending ? "Liberando..." : "Confirmar intervalo"}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      )
    }

    // Late: ask if left on time or entered actual time
    if (isLate) {
      if (breakDialogMode === "question") {
        return (
          <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Liberar para intervalo</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <EmployeeInfoBlock schedule={schedule} />
                <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2.5 text-sm text-orange-800">
                  Este colaborador deveria ter saído para intervalo às{" "}
                  <span className="font-semibold">{schedule.break_start}</span>.
                  Ele saiu no horário?
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    className="h-auto flex-col gap-1 py-3"
                    disabled={isPending}
                    onClick={() => onConfirm(schedule.break_start!)}
                  >
                    <span className="text-sm font-semibold">Sim</span>
                    <span className="text-xs text-slate-500">
                      Saiu às {schedule.break_start}
                    </span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-auto flex-col gap-1 py-3"
                    onClick={() => {
                      onModeChange("late_input")
                      onLateTimeChange(nowStr)
                    }}
                  >
                    <span className="text-sm font-semibold">Não</span>
                    <span className="text-xs text-slate-500">Saiu depois</span>
                  </Button>
                </div>
                <DialogFooter>
                  <Button
                    variant="ghost"
                    onClick={() => onOpenChange(false)}
                  >
                    Cancelar
                  </Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>
        )
      }

      // late_input mode
      const lateStartMin = timeToMinutes(breakLateTime)
      const schedEndMin = timeToMinutes(schedule.break_end)
      const effectiveDuration =
        lateStartMin !== null && schedEndMin !== null
          ? Math.max(0, schedEndMin - lateStartMin)
          : plannedDuration

      return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Liberar para intervalo</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <EmployeeInfoBlock schedule={schedule} />
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Horário que o colaborador saiu
                </label>
                <Input
                  type="time"
                  value={breakLateTime}
                  onChange={(e) => onLateTimeChange(e.target.value)}
                  className="w-full"
                />
              </div>
              {breakLateTime ? (
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="rounded-lg border bg-slate-50 p-2 text-center">
                    <p className="text-[10px] text-slate-400">Saída</p>
                    <p className="font-bold text-slate-800">{breakLateTime}</p>
                  </div>
                  <div className="rounded-lg border bg-violet-50 p-2 text-center">
                    <p className="text-[10px] text-violet-400">
                      Duração efetiva
                    </p>
                    <p className="font-bold text-violet-800">
                      {durationLabel(effectiveDuration)}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-emerald-50 p-2 text-center">
                    <p className="text-[10px] text-emerald-400">Retorno</p>
                    <p className="font-bold text-emerald-800">
                      {scheduledEndStr || "—"}
                    </p>
                  </div>
                </div>
              ) : null}
              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => onModeChange("question")}
                >
                  Voltar
                </Button>
                <Button
                  disabled={!breakLateTime || isPending}
                  onClick={() => onConfirm(breakLateTime)}
                >
                  {isPending ? "Liberando..." : "Confirmar intervalo"}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      )
    }

    // On time or early
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Liberar para intervalo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <EmployeeInfoBlock schedule={schedule} />
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="rounded-lg border bg-slate-50 p-2 text-center">
                <p className="text-[10px] text-slate-400">Saída</p>
                <p className="font-bold text-slate-800">
                  {schedule.break_start}
                </p>
              </div>
              <div className="rounded-lg border bg-violet-50 p-2 text-center">
                <p className="text-[10px] text-violet-400">Duração</p>
                <p className="font-bold text-violet-800">
                  {durationLabel(plannedDuration)}
                </p>
              </div>
              <div className="rounded-lg border bg-emerald-50 p-2 text-center">
                <p className="text-[10px] text-emerald-400">Retorno</p>
                <p className="font-bold text-emerald-800">
                  {scheduledEndStr || "—"}
                </p>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                disabled={isPending}
                onClick={() => onConfirm(schedule.break_start ?? nowStr)}
              >
                {isPending ? "Liberando..." : "Confirmar intervalo"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    )
  }
)

BreakDialog.displayName = "BreakDialog"
