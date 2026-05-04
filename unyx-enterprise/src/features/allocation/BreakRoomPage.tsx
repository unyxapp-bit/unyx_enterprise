import { useEffect, useMemo, useRef, useState } from "react"
import { CheckCircle2, Clock, Coffee, RotateCcw, Timer } from "lucide-react"

import {
  useOperationalSettings,
  usePostAllocations,
  useSchedules,
  useUpdateSchedule,
} from "@/hooks/useUnyxData"
import { StateBlock } from "@/components/shared/StateBlock"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { PostAllocation, ScheduleWithRelations } from "@/types/domain"

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

function addNoteMarker(current: string | null, marker: string): string {
  if (!current) return marker
  if (current.includes(marker)) return current
  return `${current},${marker}`
}

function CoffeeCard({
  schedule,
  now,
  durationMinutes,
  onReturn,
  isPending,
}: {
  schedule: ScheduleWithRelations
  now: Date
  durationMinutes: number
  onReturn: (schedule: ScheduleWithRelations) => void
  isPending: boolean
}) {
  const startMs = new Date(schedule.updated_at).getTime()
  const elapsedMs = now.getTime() - startMs
  const remainingMs = durationMinutes * 60_000 - elapsedMs
  const remainingMin = Math.max(0, Math.ceil(remainingMs / 60_000))
  const isDone = remainingMs <= 0

  return (
    <div className="flex items-start gap-4 rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
        <Coffee className="size-5 text-amber-600" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">
            {schedule.employees?.name ?? "—"}
          </span>
          {isDone ? (
            <Badge variant="destructive" className="text-xs">
              Tempo esgotado
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="border-amber-300 bg-amber-100 text-xs text-amber-700"
            >
              Pausa cafe
            </Badge>
          )}
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
          {schedule.branches?.name && <span>{schedule.branches.name}</span>}
          {schedule.employees?.sectors?.name && (
            <span>{schedule.employees.sectors.name}</span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 text-xs">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Timer className="size-3" />
            {durationMinutes}min de pausa
          </span>
          {isDone ? (
            <span className="font-medium text-red-600">
              Retornar ao posto
            </span>
          ) : (
            <span
              className={
                remainingMin <= 1 ? "font-medium text-amber-700" : "text-slate-600"
              }
            >
              {remainingMin}min restante{remainingMin !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>
      <Button
        size="sm"
        variant={isDone ? "default" : "outline"}
        className="shrink-0 text-xs"
        disabled={isPending}
        onClick={() => onReturn(schedule)}
      >
        <CheckCircle2 className="mr-1 size-3.5" />
        {isDone ? "Retornar" : "Retornar do cafe"}
      </Button>
    </div>
  )
}

function LunchCard({
  schedule,
  nowMin,
  onConfirmReturn,
  isPending,
}: {
  schedule: ScheduleWithRelations
  nowMin: number
  onConfirmReturn: (schedule: ScheduleWithRelations) => void
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
      className={`flex items-start gap-4 rounded-lg border bg-white p-4 shadow-sm ${
        isReturned ? "opacity-55" : ""
      }`}
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
        <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
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
          onClick={() => onConfirmReturn(schedule)}
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
    const id = setInterval(() => setNow(new Date()), 15_000)
    return () => clearInterval(id)
  }, [])

  const nowMin = now.getHours() * 60 + now.getMinutes()

  const schedulesQuery = useSchedules(today, null)
  const allocationsQuery = usePostAllocations()
  const coffeeSettings = useOperationalSettings(null)
  const updateSchedule = useUpdateSchedule()

  const coffeeDuration = coffeeSettings.data?.coffee_break_duration_minutes ?? 10

  const activeAllocationEmployeeIds = useMemo(() => {
    const set = new Set<string>()
    for (const alloc of (allocationsQuery.data ?? []) as PostAllocation[]) {
      if (!alloc.ended_at) set.add(alloc.employee_id)
    }
    return set
  }, [allocationsQuery.data])

  const allOnBreak = (schedulesQuery.data ?? []).filter(
    (s) => s.status === "on_break"
  )
  const returned = (schedulesQuery.data ?? []).filter(
    (s) => s.status === "returned"
  )

  // Coffee = on_break + allocation still active (post not freed)
  const onCoffee = allOnBreak.filter((s) =>
    activeAllocationEmployeeIds.has(s.employee_id)
  )
  // Lunch = on_break + no active allocation (post was freed via finalize)
  const onLunch = allOnBreak.filter(
    (s) => !activeAllocationEmployeeIds.has(s.employee_id)
  )

  // Auto-return coffee employees when timer expires
  const autoReturnedRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    for (const s of onCoffee) {
      if (autoReturnedRef.current.has(s.id)) continue
      const startMs = new Date(s.updated_at).getTime()
      const elapsed = (now.getTime() - startMs) / 60_000
      if (elapsed >= coffeeDuration) {
        autoReturnedRef.current.add(s.id)
        const notes = addNoteMarker(s.notes, "cafe_done")
        updateSchedule.mutate({
          scheduleId: s.id,
          values: { status: "working", notes },
        })
      }
    }
  }, [now, onCoffee, coffeeDuration, updateSchedule])

  function handleCoffeeReturn(schedule: ScheduleWithRelations) {
    const notes = addNoteMarker(schedule.notes, "cafe_done")
    updateSchedule.mutate({
      scheduleId: schedule.id,
      values: { status: "working", notes },
    })
  }

  function handleLunchReturn(schedule: ScheduleWithRelations) {
    const nowTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
    const notes = addNoteMarker(schedule.notes, "lunch_done")
    updateSchedule.mutate({
      scheduleId: schedule.id,
      values: { status: "returned", break_end: nowTime, notes },
    })
  }

  if (schedulesQuery.isLoading) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <StateBlock type="loading" title="Carregando intervalos" />
      </main>
    )
  }

  const totalActive = onCoffee.length + onLunch.length

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
            onClick={() => {
              void schedulesQuery.refetch()
              void allocationsQuery.refetch()
            }}
            disabled={schedulesQuery.isFetching}
          >
            <RotateCcw
              className={`size-4 ${schedulesQuery.isFetching ? "animate-spin" : ""}`}
            />
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="flex items-center gap-3 rounded-lg border bg-white px-4 py-3 shadow-sm">
            <Coffee className="size-4 shrink-0 text-amber-500" />
            <div>
              <div className="text-xl font-bold leading-none">{onCoffee.length}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">Pausa cafe</div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border bg-white px-4 py-3 shadow-sm">
            <Clock className="size-4 shrink-0 text-amber-500" />
            <div>
              <div className="text-xl font-bold leading-none">{onLunch.length}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">Em intervalo</div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border bg-white px-4 py-3 shadow-sm">
            <CheckCircle2 className="size-4 shrink-0 text-green-500" />
            <div>
              <div className="text-xl font-bold leading-none">{returned.length}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">Retornaram</div>
            </div>
          </div>
        </div>

        {totalActive === 0 && returned.length === 0 ? (
          <StateBlock
            type="empty"
            title="Nenhum colaborador em pausa"
            description="Quando alguem sair para o intervalo ou cafe, aparecera aqui."
          />
        ) : (
          <>
            {onCoffee.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Pausa / Cafe ({coffeeDuration}min)
                </p>
                {onCoffee.map((s) => (
                  <CoffeeCard
                    key={s.id}
                    schedule={s}
                    now={now}
                    durationMinutes={coffeeDuration}
                    onReturn={handleCoffeeReturn}
                    isPending={updateSchedule.isPending}
                  />
                ))}
              </div>
            )}

            {onLunch.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Em intervalo
                </p>
                {onLunch.map((s) => (
                  <LunchCard
                    key={s.id}
                    schedule={s}
                    nowMin={nowMin}
                    onConfirmReturn={handleLunchReturn}
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
                  <LunchCard
                    key={s.id}
                    schedule={s}
                    nowMin={nowMin}
                    onConfirmReturn={handleLunchReturn}
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
