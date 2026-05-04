import { useEffect, useState } from "react"
import { CheckCircle2, Clock, Coffee, RotateCcw } from "lucide-react"

import { useSchedules, useUpdateSchedule } from "@/hooks/useUnyxData"
import { StateBlock } from "@/components/shared/StateBlock"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { ScheduleWithRelations } from "@/types/domain"

function timeToMinutes(t: string | null | undefined): number {
  if (!t) return 0
  const [h, m] = t.split(":").map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

function formatElapsed(startMin: number, nowMin: number): string {
  let diff = nowMin - startMin
  if (diff < 0) diff += 24 * 60
  const h = Math.floor(diff / 60)
  const m = diff % 60
  if (h > 0) return `${h}h ${m}min`
  return `${m}min`
}

function BreakCard({
  schedule,
  nowMin,
  onConfirmReturn,
  isPending,
}: {
  schedule: ScheduleWithRelations
  nowMin: number
  onConfirmReturn: (id: string) => void
  isPending: boolean
}) {
  const isReturned = schedule.status === "returned"
  const breakStartMin = timeToMinutes(schedule.break_start)
  const breakEndMin = schedule.break_end ? timeToMinutes(schedule.break_end) : null
  const elapsed = formatElapsed(breakStartMin, nowMin)
  const remaining = breakEndMin !== null ? breakEndMin - nowMin : null
  const isOverdue = remaining !== null && remaining < 0

  return (
    <div
      className={`flex items-start gap-4 rounded-lg border bg-white p-4 shadow-sm ${isReturned ? "opacity-55" : ""}`}
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
        <Coffee className="size-5 text-amber-600" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">
            {schedule.employees?.name ?? "—"}
          </span>
          {isReturned ? (
            <Badge
              variant="outline"
              className="border-green-300 bg-green-50 text-xs text-green-700"
            >
              Retornou
            </Badge>
          ) : isOverdue ? (
            <Badge variant="destructive" className="text-xs">
              Atrasado {Math.abs(remaining!)}min
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="border-amber-300 bg-amber-50 text-xs text-amber-700"
            >
              Em intervalo
            </Badge>
          )}
        </div>

        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {schedule.branches?.name && <span>{schedule.branches.name}</span>}
          {schedule.employees?.sectors?.name && (
            <span>{schedule.employees.sectors.name}</span>
          )}
        </div>

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {schedule.break_start && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Clock className="size-3" />
              Saiu {schedule.break_start}
            </span>
          )}
          {!isReturned && (
            <span className="text-slate-600">Decorrido: {elapsed}</span>
          )}
          {!isReturned && remaining !== null && (
            <span
              className={
                isOverdue ? "font-medium text-red-600" : "text-slate-600"
              }
            >
              {isOverdue
                ? `${Math.abs(remaining)}min de atraso`
                : `${remaining}min restantes`}
            </span>
          )}
          {isReturned && schedule.break_end && (
            <span className="text-green-700">Retornou {schedule.break_end}</span>
          )}
        </div>
      </div>

      {!isReturned && (
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 text-xs"
          disabled={isPending}
          onClick={() => onConfirmReturn(schedule.id)}
        >
          <CheckCircle2 className="mr-1 size-3.5" />
          Confirmar retorno
        </Button>
      )}
    </div>
  )
}

export function BreakRoomPage() {
  const today = new Date().toISOString().slice(0, 10)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  const nowMin = now.getHours() * 60 + now.getMinutes()

  const schedulesQuery = useSchedules(today, null)
  const updateSchedule = useUpdateSchedule()

  const onBreak = (schedulesQuery.data ?? []).filter(
    (s) => s.status === "on_break"
  )
  const returned = (schedulesQuery.data ?? []).filter(
    (s) => s.status === "returned"
  )

  function handleConfirmReturn(scheduleId: string) {
    const now_time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
    updateSchedule.mutate({
      scheduleId,
      values: { status: "returned", break_end: now_time },
    })
  }

  if (schedulesQuery.isLoading) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <StateBlock type="loading" title="Carregando intervalos" />
      </main>
    )
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-3">
          <Coffee className="size-6 text-amber-500" />
          <div>
            <h1 className="text-xl font-semibold">Intervalo / Café</h1>
            <p className="text-sm text-muted-foreground">
              Colaboradores em pausa agora
            </p>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="ml-auto"
            onClick={() => void schedulesQuery.refetch()}
            disabled={schedulesQuery.isFetching}
          >
            <RotateCcw
              className={`size-4 ${schedulesQuery.isFetching ? "animate-spin" : ""}`}
            />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-3 rounded-lg border bg-white px-4 py-3 shadow-sm">
            <Coffee className="size-4 shrink-0 text-amber-500" />
            <div>
              <div className="text-xl font-bold leading-none">
                {onBreak.length}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                Em intervalo
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border bg-white px-4 py-3 shadow-sm">
            <CheckCircle2 className="size-4 shrink-0 text-green-500" />
            <div>
              <div className="text-xl font-bold leading-none">
                {returned.length}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                Retornaram
              </div>
            </div>
          </div>
        </div>

        {onBreak.length === 0 && returned.length === 0 ? (
          <StateBlock
            type="empty"
            title="Nenhum colaborador em intervalo"
            description="Quando alguém sair para o intervalo, aparecerá aqui."
          />
        ) : (
          <>
            {onBreak.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Em intervalo
                </p>
                {onBreak.map((s) => (
                  <BreakCard
                    key={s.id}
                    schedule={s}
                    nowMin={nowMin}
                    onConfirmReturn={handleConfirmReturn}
                    isPending={updateSchedule.isPending}
                  />
                ))}
              </div>
            )}

            {returned.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Retornaram hoje
                </p>
                {returned.map((s) => (
                  <BreakCard
                    key={s.id}
                    schedule={s}
                    nowMin={nowMin}
                    onConfirmReturn={handleConfirmReturn}
                    isPending={updateSchedule.isPending}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
