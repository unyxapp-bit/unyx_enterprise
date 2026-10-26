import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { useAllocatePost, useSchedules } from "@/hooks/useUnyxData"
import type { OperationalBreak, OperationalPost, PostAllocation } from "@/types/domain"
import { isoFromDayAndTime, localDateKey, timeToMinutes } from "../utils"

const UNAVAILABLE_SCHEDULE_STATUS = new Set([
  "absent",
  "day_off",
  "banked_hours",
  "cancelled",
  "finished",
  "on_break",
])
const ACTIVE_BREAK_STATUS = new Set(["pendente", "liberado", "atrasado"])

const trimTime = (value: string | null | undefined) => (value ? value.slice(0, 5) : "--:--")

/**
 * Alocação a partir do posto livre: lista quem está na escala de hoje, já dentro do horário
 * de trabalho e ainda sem posto ativo. O tempo no posto passa a contar da entrada da escala.
 */
export function AllocateEmployeeToPost({
  post,
  allocations,
  operationalBreaks,
  nowMs,
  onAllocated,
}: {
  post: OperationalPost
  allocations: PostAllocation[]
  operationalBreaks: OperationalBreak[]
  nowMs: number
  onAllocated?: () => void
}) {
  const [scheduleId, setScheduleId] = useState("")
  const allocatePost = useAllocatePost()
  const today = localDateKey(new Date(nowMs))
  const branchId = post.branch_id
  const schedulesQuery = useSchedules(today, branchId)

  const candidates = useMemo(() => {
    const now = new Date(nowMs)
    const nowMin = now.getHours() * 60 + now.getMinutes()
    const busyEmployees = new Set(allocations.map((item) => item.employee_id))
    for (const item of operationalBreaks) {
      if (ACTIVE_BREAK_STATUS.has(item.status)) busyEmployees.add(item.employee_id)
    }

    return (schedulesQuery.data ?? [])
      .filter((schedule) => {
        if (schedule.branch_id !== branchId) return false
        if (UNAVAILABLE_SCHEDULE_STATUS.has(schedule.status)) return false
        if (busyEmployees.has(schedule.employee_id)) return false
        const start = timeToMinutes(schedule.start_time)
        const end = timeToMinutes(schedule.end_time)
        if (start === null || nowMin < start) return false
        if (end !== null && end > start && nowMin >= end) return false
        return true
      })
      .sort(
        (left, right) =>
          (timeToMinutes(left.start_time) ?? 0) - (timeToMinutes(right.start_time) ?? 0) ||
          (left.employees?.name ?? "").localeCompare(right.employees?.name ?? "", "pt-BR")
      )
  }, [allocations, branchId, nowMs, operationalBreaks, schedulesQuery.data])

  const selected = candidates.find((schedule) => schedule.id === scheduleId) ?? null

  const handleAllocate = async () => {
    if (!selected) return
    try {
      await allocatePost.mutateAsync({
        post_id: post.id,
        employee_id: selected.employee_id,
        schedule_id: selected.id,
        notes: "Alocação realizada pelo mapa de postos",
        started_at: selected.start_time
          ? isoFromDayAndTime(today, trimTime(selected.start_time))
          : null,
      })
      setScheduleId("")
      onAllocated?.()
    } catch {
      // O hook já mostra o erro em toast.
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-[color:var(--border-soft)] p-4">
      <div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          Alocar colaborador
        </div>
        <div className="text-sm text-muted-foreground">
          Escalados de hoje, já no horário de trabalho e sem posto.
        </div>
      </div>

      {schedulesQuery.isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando escala...</div>
      ) : candidates.length === 0 ? (
        <div className="rounded-xl bg-[color:var(--bg-surface-soft)] px-3 py-2 text-sm text-muted-foreground">
          Nenhum colaborador disponível: todos os escalados já estão em posto, em intervalo,
          fora do horário ou sem escala hoje.
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Select
            aria-label="Colaborador para alocar"
            className="min-w-0 flex-1"
            value={scheduleId}
            onValueChange={setScheduleId}
            placeholder="Selecione o colaborador"
            options={[
              { value: "", label: "Selecione o colaborador" },
              ...candidates.map((schedule) => ({
                value: schedule.id,
                label: `${schedule.employees?.name ?? "Colaborador"} · ${
                  schedule.employees?.sectors?.name ?? "Sem setor"
                } · ${trimTime(schedule.start_time)}–${trimTime(schedule.end_time)}`,
              })),
            ]}
          />
          <Button
            type="button"
            disabled={!selected || allocatePost.isPending}
            onClick={() => void handleAllocate()}
          >
            {allocatePost.isPending ? "Alocando..." : "Alocar"}
          </Button>
        </div>
      )}
    </div>
  )
}
