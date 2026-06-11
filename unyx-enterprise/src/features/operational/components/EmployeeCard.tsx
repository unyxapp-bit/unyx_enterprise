/**
 * EmployeeCard - Card de colaborador com ações
 */

import React, { useMemo, useState } from "react"
import {
  ArrowRightLeft,
  Banknote,
  CheckCircle2,
  ChevronDown,
  Coffee,
  Flame,
  Handshake,
  LogIn,
  LogOut,
  MapPinned,
  Store,
  Timer,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { StatusBadge } from "@/components/bento/StatusBadge"
import type {
  OperationalPost,
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
  getInitials,
  isCafeBreak,
  isDone,
  postTypeLabel,
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
  activePosts: OperationalPost[]
  occupiedPostIds: Set<string>
  currentMinutes: number
  activeTab: OperationalTab
  isPending: boolean
  onAllocatePost: (post: OperationalPost) => void
  onTransferPost: () => void
  onEntry: () => void
  onBreak: () => void
  onBreakAlreadyDone: () => void
  onCashMovement: () => void
  onCashierSwap: () => void
  onReturn: () => void
  onCafe: () => void
  onPeak: () => void
  onSupport: () => void
  onClosing: () => void
  onNormal: () => void
  onExit: () => void
}

export const EmployeeCard = React.memo(
  ({
    schedule,
    statusRecord,
    postAllocation,
    activePosts,
    occupiedPostIds,
    currentMinutes,
    activeTab,
    isPending,
    onAllocatePost,
    onTransferPost,
    onEntry,
    onBreak,
    onBreakAlreadyDone,
    onCashMovement,
    onCashierSwap,
    onReturn,
    onCafe,
    onPeak,
    onSupport,
    onClosing,
    onNormal,
    onExit,
  }: EmployeeCardProps) => {
    const [detailsOpen, setDetailsOpen] = useState(false)
    const currentStatus = statusRecord?.current_status

    const freePosts = useMemo(
      () => activePosts.filter((post) => !occupiedPostIds.has(post.id)),
      [activePosts, occupiedPostIds]
    )

    const freePostsBySector = useMemo(() => {
      const map = new Map<string, OperationalPost[]>()
      for (const post of freePosts) {
        const sector = post.sectors?.name ?? "Sem setor"
        if (!map.has(sector)) map.set(sector, [])
        map.get(sector)!.push(post)
      }
      return map
    }, [freePosts])

    const timeWorked = useMemo(() => {
      const startMin = timeToMinutes(schedule.start_time)
      return calculateTimeWorked(
        startMin,
        currentMinutes,
        currentStatus !== null && currentStatus !== "aguardando_evento"
      )
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
    const isAwaitingCashMovement = currentStatus === "aguardando_sangria"
    const isAwaitingCashierSwap = currentStatus === "troca_de_caixa"
    const isPeak = currentStatus === "pico"
    const isSupport = currentStatus === "apoio_operacional"
    const isClosing = currentStatus === "fechamento"
    const isCafe = isCafeBreak(schedule.notes)
    const cardIsDone = isDone(currentStatus)
    const lunchAlreadyDone =
      schedule.notes?.includes("lunch_done") || currentStatus === "voltou"

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
    const breakEndMin = timeToMinutes(schedule.break_end)
    const shouldOfferBreakAlreadyDone =
      activeTab === "em_turno" &&
      !isOnBreak &&
      !lunchAlreadyDone &&
      breakEndMin !== null &&
      currentMinutes > breakEndMin &&
      [
        "trabalhando",
        "deve_sair",
        "aguardando_sangria",
        "troca_de_caixa",
        "pico",
        "apoio_operacional",
        "fechamento",
      ].includes(currentStatus ?? "")

    const cardBorderClass = isLate
      ? "border-orange-300 bg-orange-50/40"
      : "border-slate-200 bg-white"

    const canEntrada = canStartEntry(currentStatus)
    const canIntervalo = canStartBreak(currentStatus)
    const canRetorno = canReturnFromBreak(currentStatus)
    const canCafeStart = canStartCafe(currentStatus)
    const canSaida = canStartExit(currentStatus)
    const canFiscalFlow =
      activeTab === "em_turno" &&
      Boolean(currentStatus) &&
      currentStatus !== "aguardando_evento" &&
      !isOnBreak &&
      !cardIsDone

    const avatarClass =
      avatarClassByStatus[currentStatus ?? "aguardando_evento"] ??
      "bg-slate-200 text-slate-700"
    const allocationLabel = postAllocation
      ? postAllocation.operational_posts?.name ?? "Posto alocado"
      : "Sem posto alocado"

    const scheduleLine =
      schedule.start_time && schedule.end_time
        ? `${schedule.start_time} → ${schedule.end_time}`
        : "Sem horario definido"

    return (
      <>
        <div
          className={`flex flex-col rounded-xl border p-3 shadow-sm transition-opacity ${cardBorderClass} ${
            cardIsDone ? "opacity-60" : ""
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div
              className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${avatarClass}`}
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

          <div className="mt-2">
            <div className="truncate text-sm font-semibold leading-tight">
              {schedule.employees?.name ?? "Colaborador"}
            </div>
            <div className="mt-0.5 truncate text-xs text-muted-foreground">
              {[
                schedule.employees?.role,
                schedule.employees?.sectors?.name ?? "Sem setor",
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </div>

          <div className="mt-2 truncate text-xs text-muted-foreground">
            {scheduleLine}
          </div>

          <div className="mt-2 flex items-center gap-2">
            <Badge
              variant="outline"
              className="h-6 rounded-full border-sky-200 bg-sky-50 px-2 text-[10px] text-sky-700"
            >
              <MapPinned className="mr-1 size-3" />
              {allocationLabel}
            </Badge>
            {timeWorked ? (
              <Badge
                variant="outline"
                className="h-6 rounded-full border-emerald-200 bg-emerald-50 px-2 text-[10px] text-emerald-700"
              >
                <Timer className="mr-1 size-3" />
                {formatDuration(timeWorked)}
              </Badge>
            ) : null}
          </div>

          {timeUntilBreak ? (
            <div className="mt-2 flex items-center gap-1.5 rounded-md bg-violet-50 px-2 py-1 text-[11px] text-violet-700">
              <Coffee className="size-3.5" />
              int. em {formatDuration(timeUntilBreak)}
            </div>
          ) : null}

          {isOnBreak && breakProgress ? (
            <div className="mt-2">
              <div className="mb-1 flex items-center justify-between text-[11px]">
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

          {statusRecord?.status_reason ? (
            <div className="mt-2 line-clamp-2 text-xs text-muted-foreground">
              {statusRecord.status_reason}
            </div>
          ) : (
            <div className="mt-2 text-xs text-muted-foreground">Entrada confirmada</div>
          )}

          <div className="mt-3 flex items-center justify-between gap-2">
            {activeTab === "a_chegar" ? (
              <Button
                size="sm"
                variant="outline"
                className="h-8 flex-1 justify-center gap-1.5 text-xs"
                disabled={!canEntrada || isPending}
                onClick={onEntry}
                aria-label={`Confirmar entrada de ${schedule.employees?.name}`}
              >
                <LogIn className="size-3.5" />
                Confirmar entrada
              </Button>
            ) : (
              <div className="text-[11px] text-muted-foreground">
                Acoes e detalhes no modal
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 shrink-0 rounded-full px-3 text-[11px]"
              onClick={() => setDetailsOpen(true)}
            >
              Detalhes
            </Button>
          </div>
        </div>

        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Detalhes do colaborador</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-soft)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold">
                      {schedule.employees?.name ?? "Colaborador"}
                    </div>
                    <div className="mt-0.5 text-sm text-muted-foreground">
                      {[
                        schedule.employees?.role,
                        schedule.employees?.sectors?.name ?? "Sem setor",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                  <StatusBadge status={currentStatus ?? "aguardando_evento"} />
                </div>
                <div className="mt-3 text-sm text-muted-foreground">
                  {scheduleLine}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-[color:var(--border-soft)] p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Em turno
                  </div>
                  <div className="mt-1 text-lg font-semibold">
                    {timeWorked ? formatDuration(timeWorked) : "-"}
                  </div>
                </div>
                <div className="rounded-2xl border border-[color:var(--border-soft)] p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Proximo intervalo
                  </div>
                  <div className="mt-1 text-lg font-semibold">
                    {timeUntilBreak ? formatDuration(timeUntilBreak) : "-"}
                  </div>
                </div>
                <div className="rounded-2xl border border-[color:var(--border-soft)] p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Posto
                  </div>
                  <div className="mt-1 text-sm font-medium">{allocationLabel}</div>
                </div>
              </div>

              {statusRecord?.status_reason ? (
                <div className="rounded-2xl border border-[color:var(--border-soft)] p-4 text-sm text-muted-foreground">
                  {statusRecord.status_reason}
                </div>
              ) : null}

              {postAllocation && activeTab === "em_turno" ? (
                <div className="rounded-2xl border border-[color:var(--border-soft)] p-4">
                  <div className="mb-2 text-sm font-medium">Troca de posto</div>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 rounded-full"
                    disabled={isPending}
                    onClick={onTransferPost}
                  >
                    <ArrowRightLeft className="size-3.5" />
                    Trocar posto
                  </Button>
                </div>
              ) : null}

              {activeTab === "em_turno" && !postAllocation ? (
                <div className="rounded-2xl border border-[color:var(--border-soft)] p-4">
                  <div className="mb-2 text-sm font-medium">Alocar posto</div>
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 w-full justify-start gap-1.5 rounded-full border-amber-100 bg-amber-50 px-3 text-xs font-normal text-amber-700 hover:bg-amber-100 hover:text-amber-800"
                        disabled={isPending}
                      >
                        <MapPinned className="size-3.5 shrink-0" />
                        <span className="truncate">Selecionar posto disponivel</span>
                        <ChevronDown className="ml-auto size-3.5 shrink-0" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="w-[min(22rem,calc(100vw-2rem))] p-0"
                      onCloseAutoFocus={(event) => event.preventDefault()}
                    >
                      <div className="max-h-72 overflow-y-auto p-2">
                        <DropdownMenuLabel className="px-1.5 text-[11px] uppercase tracking-wide">
                          Postos/caixas disponiveis
                        </DropdownMenuLabel>
                        {freePosts.length === 0 ? (
                          <div className="rounded-md border border-dashed bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">
                            Nenhum posto ativo livre agora.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {Array.from(freePostsBySector.entries()).map(
                              ([sector, posts]) => (
                                <div key={sector} className="space-y-1">
                                  <p className="px-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                    {sector}
                                  </p>
                                  {posts.map((post) => (
                                    <DropdownMenuItem
                                      key={post.id}
                                      className="flex items-center gap-2 rounded-md border border-slate-100 bg-white px-2.5 py-2 text-xs"
                                      onSelect={() => onAllocatePost(post)}
                                    >
                                      <MapPinned className="size-3.5 shrink-0 text-slate-400" />
                                      <div className="min-w-0 flex-1">
                                        <p className="truncate font-medium text-slate-800">
                                          {post.name}
                                        </p>
                                        <p className="truncate text-[11px] text-slate-400">
                                          {postTypeLabel[post.type] ?? post.type}
                                        </p>
                                      </div>
                                      <Badge
                                        variant="outline"
                                        className="h-5 shrink-0 border-emerald-200 bg-emerald-50 px-1.5 text-[10px] text-emerald-700"
                                      >
                                        Livre
                                      </Badge>
                                    </DropdownMenuItem>
                                  ))}
                                </div>
                              )
                            )}
                          </div>
                        )}
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ) : null}

              <div className="grid gap-2 sm:grid-cols-2">
                {activeTab === "a_chegar" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full justify-center gap-1.5 text-xs"
                    disabled={!canEntrada || isPending}
                    onClick={onEntry}
                  >
                    <LogIn className="size-3.5" />
                    Confirmar entrada
                  </Button>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full justify-center gap-1.5 text-xs"
                      disabled={!canEntrada || isPending}
                      onClick={onEntry}
                    >
                      <LogIn className="size-3.5" />
                      Entrada
                    </Button>
                    {canRetorno ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full justify-center gap-1.5 text-xs border-violet-300 text-violet-700 hover:bg-violet-50"
                        disabled={isPending}
                        onClick={onReturn}
                      >
                        <LogIn className="size-3.5" />
                        Retorno
                      </Button>
                    ) : isAwaitingCashMovement ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full justify-center gap-1.5 text-xs border-orange-300 text-orange-700 hover:bg-orange-50"
                        disabled={isPending || !postAllocation}
                        onClick={onCashMovement}
                      >
                        <Banknote className="size-3.5" />
                        Sangria
                      </Button>
                    ) : isAwaitingCashierSwap ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full justify-center gap-1.5 text-xs border-sky-300 text-sky-700 hover:bg-sky-50"
                        disabled={isPending}
                        onClick={onCashierSwap}
                      >
                        <ArrowRightLeft className="size-3.5" />
                        Troca de caixa
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full justify-center gap-1.5 text-xs"
                        disabled={!canIntervalo || isPending}
                        onClick={onBreak}
                      >
                        <Timer className="size-3.5" />
                        Intervalo
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full justify-center gap-1.5 text-xs"
                      disabled={!canCafeStart || isPending}
                      onClick={onCafe}
                    >
                      <Coffee className="size-3.5" />
                      Café
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full justify-center gap-1.5 text-xs"
                      disabled={!canSaida || isPending}
                      onClick={onExit}
                    >
                      <LogOut className="size-3.5" />
                      Saída
                    </Button>
                    {shouldOfferBreakAlreadyDone ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full justify-center gap-1.5 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                        disabled={isPending}
                        onClick={onBreakAlreadyDone}
                      >
                        <CheckCircle2 className="size-3.5" />
                        Int. feito
                      </Button>
                    ) : null}
                  </>
                )}
              </div>

              {canFiscalFlow ? (
                <div className="grid gap-2 sm:grid-cols-4">
                  <Button
                    size="sm"
                    variant={isPeak ? "default" : "outline"}
                    className="h-8 px-1 text-xs"
                    disabled={isPending || isPeak}
                    onClick={onPeak}
                  >
                    <Flame className="size-3.5" />
                    Pico
                  </Button>
                  <Button
                    size="sm"
                    variant={isSupport ? "default" : "outline"}
                    className="h-8 px-1 text-xs"
                    disabled={isPending || isSupport}
                    onClick={onSupport}
                  >
                    <Handshake className="size-3.5" />
                    Apoio
                  </Button>
                  <Button
                    size="sm"
                    variant={isClosing ? "default" : "outline"}
                    className="h-8 px-1 text-xs"
                    disabled={isPending || isClosing}
                    onClick={onClosing}
                  >
                    <Store className="size-3.5" />
                    Fech.
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-1 text-xs"
                    disabled={
                      isPending ||
                      (!isPeak &&
                        !isSupport &&
                        !isClosing &&
                        currentStatus === "trabalhando")
                    }
                    onClick={onNormal}
                  >
                    <CheckCircle2 className="size-3.5" />
                    Normal
                  </Button>
                </div>
              ) : null}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDetailsOpen(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    )
  },
  (prev, next) => {
    return (
      prev.schedule.id === next.schedule.id &&
      prev.schedule.notes === next.schedule.notes &&
      prev.postAllocation?.id === next.postAllocation?.id &&
      prev.activePosts === next.activePosts &&
      prev.occupiedPostIds === next.occupiedPostIds &&
      prev.statusRecord?.current_status === next.statusRecord?.current_status &&
      prev.currentMinutes === next.currentMinutes &&
      prev.activeTab === next.activeTab &&
      prev.isPending === next.isPending
    )
  }
)

EmployeeCard.displayName = "EmployeeCard"
