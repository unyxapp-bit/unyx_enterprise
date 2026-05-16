/**
 * EmployeeCard - Card de colaborador com ações
 */

import React, { useMemo } from "react"
import { Coffee, LogIn, LogOut, MapPinned, Timer } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/bento/StatusBadge"
import type {
  OperationalStatusRecord,
  PostAllocation,
  ScheduleWithRelations,
} from "@/types/domain"
import {
  avatarClassByStatus,
  canReturnFromBreak,
  canStartBreak,
  canStartCafe,
  canStartEntry,
  canStartExit,
  isCafeBreak,
  isDone,
  getInitials,
} from "../utils"
import {
  calculateBreakProgress,
  calculateTimeUntilBreak,
  calculateTimeWorked,
  formatDuration,
  isBreakDone,
  timeToMinutes,
} from "../utils"
import type { OperationalTab } from "../utils"

interface EmployeeCardProps {
  schedule: ScheduleWithRelations
  statusRecord: OperationalStatusRecord | undefined
  postAllocation?: PostAllocation
  currentMinutes: number
  activeTab: OperationalTab
  isPending: boolean
  onEntry: () => void
  onBreak: () => void
  onReturn: () => void
  onCafe: () => void
  onExit: () => void
}

export const EmployeeCard = React.memo(
  ({
    schedule,
    statusRecord,
    postAllocation,
    currentMinutes,
    activeTab,
    isPending,
    onEntry,
    onBreak,
    onReturn,
    onCafe,
    onExit,
  }: EmployeeCardProps) => {
    const currentStatus = statusRecord?.current_status

    const timeWorked = useMemo(() => {
      const startMin = timeToMinutes(schedule.start_time)
      return calculateTimeWorked(startMin, currentMinutes, currentStatus !== null && currentStatus !== "aguardando_evento")
    }, [schedule.start_time, currentMinutes, currentStatus])

    const breakDone = useMemo(
      () => isBreakDone(timeToMinutes(schedule.break_end), currentMinutes, schedule.notes),
      [schedule.break_end, currentMinutes, schedule.notes]
    )

    const timeUntilBreak = useMemo(() => {
      const breakStartMin = timeToMinutes(schedule.break_start)
      return calculateTimeUntilBreak(breakStartMin, currentMinutes, breakDone)
    }, [schedule.break_start, currentMinutes, breakDone])

    const isOnBreak = currentStatus === "em_intervalo"
    const isCafe = isCafeBreak(schedule.notes)
    const cardIsDone = isDone(currentStatus)

    const breakProgress = useMemo(() => {
      if (!isOnBreak) return null
      const breakStartMin = timeToMinutes(schedule.break_start)
      const breakEndMin = timeToMinutes(schedule.break_end)
      return calculateBreakProgress(breakStartMin, breakEndMin, currentMinutes)
    }, [isOnBreak, schedule.break_start, schedule.break_end, currentMinutes])

    const startMin = timeToMinutes(schedule.start_time)
    const isLate =
      activeTab === "a_chegar" &&
      startMin !== null &&
      currentMinutes > startMin &&
      (!currentStatus || currentStatus === "aguardando_evento")
    const lateMinutes = isLate ? currentMinutes - (startMin ?? 0) : 0

    const cardBorderClass = isLate
      ? "border-orange-300 bg-orange-50/40"
      : "border-slate-200 bg-white"

    const canEntrada = canStartEntry(currentStatus)
    const canIntervalo = canStartBreak(currentStatus)
    const canRetorno = canReturnFromBreak(currentStatus)
    const canCafeStart = canStartCafe(currentStatus)
    const canSaida = canStartExit(currentStatus)

    const avatarClass = avatarClassByStatus[currentStatus ?? "aguardando_evento"] ?? "bg-slate-200 text-slate-700"

    return (
      <div
        className={`flex flex-col rounded-lg border p-4 shadow-sm transition-opacity ${cardBorderClass} ${
          cardIsDone ? "opacity-60" : ""
        }`}
      >
        {/* Header: avatar + status */}
        <div className="flex items-start justify-between gap-2">
          <div
            className={`flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${avatarClass}`}
            aria-label={`Avatar de ${schedule.employees?.name}`}
          >
            {getInitials(schedule.employees?.name ?? "?")}
          </div>
          <div className="flex flex-col items-end gap-1">
            <StatusBadge status={currentStatus ?? "aguardando_evento"} />
            {isLate ? (
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700">
                {formatDuration(lateMinutes)} atrasado
              </span>
            ) : null}
          </div>
        </div>

        {/* Name + role/sector */}
        <div className="mt-3">
          <div className="text-sm font-semibold leading-tight">
            {schedule.employees?.name ?? "Colaborador"}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {[
              schedule.employees?.role,
              schedule.employees?.sectors?.name ?? "Sem setor",
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>

        {/* Schedule times */}
        <div className="mt-2 text-xs text-muted-foreground">
          {schedule.start_time && schedule.end_time ? (
            <>
              {schedule.start_time} → {schedule.end_time}
              {schedule.break_start ? (
                <span className="ml-2 text-slate-400">
                  · int. {schedule.break_start}
                </span>
              ) : null}
            </>
          ) : null}
        </div>

        {postAllocation ? (
          <div className="mt-2 flex items-center gap-1.5 rounded-md border border-sky-100 bg-sky-50 px-2.5 py-1.5 text-xs text-sky-700">
            <MapPinned className="size-3.5 shrink-0" />
            <span className="truncate">
              {postAllocation.operational_posts?.name ?? "Posto alocado"}
            </span>
            <Badge
              variant="outline"
              className="ml-auto h-5 shrink-0 border-sky-200 bg-white px-1.5 text-[10px] text-sky-700"
            >
              alocado
            </Badge>
          </div>
        ) : activeTab === "em_turno" ? (
          <div className="mt-2 flex items-center gap-1.5 rounded-md border border-amber-100 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700">
            <MapPinned className="size-3.5 shrink-0" />
            <span className="truncate">Sem posto alocado</span>
          </div>
        ) : null}

        {/* Break progress bar */}
        {isOnBreak && breakProgress ? (
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-violet-700">
                {isCafe
                  ? `☕ Café — ${formatDuration(breakProgress.elapsed)}`
                  : `${formatDuration(breakProgress.elapsed)} de intervalo`}
              </span>
              <span
                className={
                  breakProgress.isOverdue
                    ? "font-semibold text-red-600"
                    : "text-slate-400"
                }
              >
                {breakProgress.isOverdue
                  ? `+${formatDuration(breakProgress.elapsed - breakProgress.duration)} além`
                  : `${formatDuration(breakProgress.duration)} total`}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  breakProgress.percentage >= 100
                    ? "bg-red-500"
                    : breakProgress.percentage >= 80
                      ? "bg-orange-400"
                      : "bg-violet-500"
                }`}
                style={{ width: `${breakProgress.percentage}%` }}
              />
            </div>
          </div>
        ) : null}

        {/* Time worked + time until break */}
        {activeTab === "em_turno" && !isOnBreak && (timeWorked || timeUntilBreak) ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {timeWorked ? (
              <span className="flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                <Timer className="size-3" />
                {formatDuration(timeWorked)} trabalhando
              </span>
            ) : null}
            {timeUntilBreak ? (
              <span className="flex items-center gap-1 rounded-md bg-violet-50 px-2 py-0.5 text-xs text-violet-700">
                <Coffee className="size-3" />
                int. em {formatDuration(timeUntilBreak)}
              </span>
            ) : null}
          </div>
        ) : null}

        {/* Delay badge */}
        {statusRecord && statusRecord.delay_minutes > 0 ? (
          <div className="mt-2">
            <Badge variant="destructive">
              {statusRecord.delay_minutes < 60
                ? `${statusRecord.delay_minutes}min atraso`
                : `${Math.floor(statusRecord.delay_minutes / 60)}h atraso`}
            </Badge>
          </div>
        ) : null}

        {/* Last event reason */}
        {statusRecord?.status_reason ? (
          <div className="mt-1.5 text-xs text-muted-foreground">
            {statusRecord.status_reason}
          </div>
        ) : null}

        {/* Action buttons */}
        <div className="mt-auto pt-4">
          {activeTab === "a_chegar" ? (
            <Button
              size="sm"
              variant="outline"
              className="flex w-full items-center justify-center gap-1.5 text-xs"
              disabled={!canEntrada || isPending}
              onClick={onEntry}
              aria-label={`Confirmar entrada de ${schedule.employees?.name}`}
            >
              <LogIn className="size-3.5" />
              Confirmar entrada
            </Button>
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              <Button
                size="sm"
                variant="outline"
                className="flex flex-col gap-0.5 h-auto py-2 text-xs"
                disabled={!canEntrada || isPending}
                onClick={onEntry}
                aria-label="Confirmar entrada"
              >
                <LogIn className="size-3.5" />
                Entrada
              </Button>
              {canRetorno ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex flex-col gap-0.5 h-auto py-2 text-xs border-violet-300 text-violet-700 hover:bg-violet-50"
                  disabled={isPending}
                  onClick={onReturn}
                  aria-label="Confirmar retorno"
                >
                  <LogIn className="size-3.5" />
                  Retorno
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex flex-col gap-0.5 h-auto py-2 text-xs"
                  disabled={!canIntervalo || isPending}
                  onClick={onBreak}
                  aria-label="Iniciar intervalo"
                >
                  <Timer className="size-3.5" />
                  Intervalo
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="flex flex-col gap-0.5 h-auto py-2 text-xs"
                disabled={!canCafeStart || isPending}
                onClick={onCafe}
                aria-label="Iniciar café"
              >
                <Coffee className="size-3.5" />
                Café
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex flex-col gap-0.5 h-auto py-2 text-xs"
                disabled={!canSaida || isPending}
                onClick={onExit}
                aria-label="Confirmar saída"
              >
                <LogOut className="size-3.5" />
                Saída
              </Button>
            </div>
          )}
        </div>
      </div>
    )
  },
  (prev, next) => {
    // Custom comparison to avoid unnecessary re-renders
    return (
      prev.schedule.id === next.schedule.id &&
      prev.statusRecord?.current_status === next.statusRecord?.current_status &&
      prev.currentMinutes === next.currentMinutes &&
      prev.activeTab === next.activeTab &&
      prev.isPending === next.isPending
    )
  }
)

EmployeeCard.displayName = "EmployeeCard"
