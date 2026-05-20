/**
 * useOperationalActions - Hook para gerenciar ações de colaboradores
 */

import { useCallback } from "react"
import type { PostAllocation, ScheduleWithRelations } from "@/types/domain"
import {
  useAllocatePost,
  useConfirmCashMovement,
  useRecordBreakAlreadyDone,
  useRecordOperationalEvent,
  useUpdateSchedule,
} from "@/hooks/useUnyxData"
import { eventLabel } from "@/lib/status"
import { addNoteMarker, removeNoteMarker } from "../utils/operationalCalculations"

export function useOperationalActions() {
  const recordEvent = useRecordOperationalEvent()
  const recordBreakDone = useRecordBreakAlreadyDone()
  const updateSchedule = useUpdateSchedule()
  const allocatePost = useAllocatePost()
  const confirmCashMovement = useConfirmCashMovement()

  const fireAction = useCallback(
    async (schedule: ScheduleWithRelations, eventType: "entrada_confirmada" | "retorno_confirmado" | "saida_confirmada") => {
      const now = new Date()
      const nowTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`

      await recordEvent.mutateAsync({
        branch_id: schedule.branch_id,
        employee_id: schedule.employee_id,
        schedule_id: schedule.id,
        event_type: eventType,
        notes: eventLabel[eventType],
      })

      if (eventType === "entrada_confirmada") {
        await updateSchedule.mutateAsync({ scheduleId: schedule.id, values: { status: "working" } })
      }

      if (eventType === "retorno_confirmado") {
        const notes = addNoteMarker(schedule.notes, "lunch_done")
        await updateSchedule.mutateAsync({
          scheduleId: schedule.id,
          values: { status: "returned", break_end: nowTime, notes },
        })
      }

      if (eventType === "saida_confirmada") {
        await updateSchedule.mutateAsync({ scheduleId: schedule.id, values: { status: "finished" } })
      }
    },
    [recordEvent, updateSchedule]
  )

  const handleBreakAlreadyDone = useCallback(
    async (schedule: ScheduleWithRelations) => {
      const notes = addNoteMarker(schedule.notes, "lunch_done")
      const breakLabel =
        schedule.break_start && schedule.break_end
          ? `${schedule.break_start} - ${schedule.break_end}`
          : "horario planejado"

      await recordBreakDone.mutateAsync({
        branch_id: schedule.branch_id,
        employee_id: schedule.employee_id,
        schedule_id: schedule.id,
        notes: `Intervalo ja realizado no ${breakLabel}.`,
      })

      await updateSchedule.mutateAsync({
        scheduleId: schedule.id,
        values: {
          status: "returned",
          break_start: schedule.break_start,
          break_end: schedule.break_end,
          notes,
        },
      })
    },
    [recordBreakDone, updateSchedule]
  )

  const handleEntryConfirm = useCallback(
    async (
      schedule: ScheduleWithRelations,
      selectedPostId: string | null,
      breakAlreadyDone = false
    ) => {
      await fireAction(schedule, "entrada_confirmada")
      if (selectedPostId) {
        await allocatePost.mutateAsync({
          post_id: selectedPostId,
          employee_id: schedule.employee_id,
          schedule_id: schedule.id,
        })
      }
      if (breakAlreadyDone) {
        await handleBreakAlreadyDone(schedule)
      }
    },
    [allocatePost, fireAction, handleBreakAlreadyDone]
  )

  const handlePostAllocation = useCallback(
    async (schedule: ScheduleWithRelations, postId: string) => {
      await allocatePost.mutateAsync({
        post_id: postId,
        employee_id: schedule.employee_id,
        schedule_id: schedule.id,
        notes: "Alocado pela frente de caixa em tempo real",
      })
    },
    [allocatePost]
  )

  const handleBreakConfirm = useCallback(
    async (schedule: ScheduleWithRelations, actualStartStr: string) => {
      const pad = (v: number) => String(v).padStart(2, "0")

      // Scheduled return time stays fixed
      const breakEndToUse = schedule.break_end ?? (() => {
        const startMin = parseInt(actualStartStr.split(":")[0]) * 60 + parseInt(actualStartStr.split(":")[1])
        const endMin = startMin + 60
        return `${pad(Math.floor(endMin / 60) % 24)}:${pad(endMin % 60)}`
      })()

      const plannedStart = schedule.break_start ? parseInt(schedule.break_start.split(":")[0]) * 60 + parseInt(schedule.break_start.split(":")[1]) : null
      const plannedEnd = schedule.break_end ? parseInt(schedule.break_end.split(":")[0]) * 60 + parseInt(schedule.break_end.split(":")[1]) : null
      const duration =
        plannedStart !== null && plannedEnd !== null && plannedEnd > plannedStart
          ? plannedEnd - plannedStart
          : 60

      await recordEvent.mutateAsync({
        branch_id: schedule.branch_id,
        employee_id: schedule.employee_id,
        schedule_id: schedule.id,
        event_type: "intervalo_iniciado",
        notes: `Intervalo de ${duration}min — saída ${actualStartStr}, retorno ${breakEndToUse}`,
      })

      updateSchedule.mutate({
        scheduleId: schedule.id,
        values: { status: "on_break", break_start: actualStartStr, break_end: breakEndToUse },
      })
    },
    [recordEvent, updateSchedule]
  )

  const handleCafeStart = useCallback(
    async (schedule: ScheduleWithRelations) => {
      const n = new Date()
      const pad = (v: number) => String(v).padStart(2, "0")
      const nowStr = `${pad(n.getHours())}:${pad(n.getMinutes())}`
      const endMin = n.getHours() * 60 + n.getMinutes() + 10
      const endStr = `${pad(Math.floor(endMin / 60) % 24)}:${pad(endMin % 60)}`

      await recordEvent.mutateAsync({
        branch_id: schedule.branch_id,
        employee_id: schedule.employee_id,
        schedule_id: schedule.id,
        event_type: "intervalo_iniciado",
        notes: "Café (10min)",
      })

      updateSchedule.mutate({
        scheduleId: schedule.id,
        values: {
          status: "on_break",
          break_start: nowStr,
          break_end: endStr,
          notes: addNoteMarker(schedule.notes, "cafe_active"),
        },
      })
    },
    [recordEvent, updateSchedule]
  )

  const handleCashMovementConfirm = useCallback(
    async (allocation: PostAllocation) => {
      await confirmCashMovement.mutateAsync({
        allocation_id: allocation.id,
        movement_type: "sangria_confirmada",
        notes: allocation.operational_posts?.name
          ? `Sangria confirmada em ${allocation.operational_posts.name}`
          : "Sangria confirmada",
      })
    },
    [confirmCashMovement]
  )

  const handleCashierSwapConfirm = useCallback(
    async (schedule: ScheduleWithRelations) => {
      await recordEvent.mutateAsync({
        branch_id: schedule.branch_id,
        employee_id: schedule.employee_id,
        schedule_id: schedule.id,
        event_type: "troca_caixa_confirmada",
        notes: eventLabel["troca_caixa_confirmada"],
      })
    },
    [recordEvent]
  )

  const handleReturnAnswer = useCallback(
    async (schedule: ScheduleWithRelations, returned: boolean, isCafe: boolean) => {
      const n = new Date()
      const pad = (v: number) => String(v).padStart(2, "0")
      const nowTime = `${pad(n.getHours())}:${pad(n.getMinutes())}`

      if (returned) {
        if (isCafe) {
          const notes = removeNoteMarker(schedule.notes, "cafe_active")
          await recordEvent.mutateAsync({
            branch_id: schedule.branch_id,
            employee_id: schedule.employee_id,
            schedule_id: schedule.id,
            event_type: "entrada_confirmada",
            notes: "Retorno do café",
          })
          updateSchedule.mutate({
            scheduleId: schedule.id,
            values: { status: "working", notes },
          })
        } else {
          const notes = addNoteMarker(schedule.notes, "lunch_done")
          await recordEvent.mutateAsync({
            branch_id: schedule.branch_id,
            employee_id: schedule.employee_id,
            schedule_id: schedule.id,
            event_type: "retorno_confirmado",
            notes: eventLabel["retorno_confirmado"],
          })
          updateSchedule.mutate({
            scheduleId: schedule.id,
            values: { status: "returned", break_end: nowTime, notes },
          })
        }
      } else {
        await recordEvent.mutateAsync({
          branch_id: schedule.branch_id,
          employee_id: schedule.employee_id,
          schedule_id: schedule.id,
          event_type: "atraso_detectado",
          notes: isCafe
            ? "Não retornou do café no prazo"
            : "Não retornou do intervalo no prazo",
        })
      }
    },
    [recordEvent, updateSchedule]
  )

  const handleOccurrenceSubmit = useCallback(
    async (schedule: ScheduleWithRelations, note: string) => {
      if (!note.trim()) {
        throw new Error("Descreva a ocorrência.")
      }

      await recordEvent.mutateAsync({
        branch_id: schedule.branch_id,
        employee_id: schedule.employee_id,
        schedule_id: schedule.id,
        event_type: "ocorrencia_registrada",
        notes: note.trim(),
      })
    },
    [recordEvent]
  )

  return {
    fireAction,
    handleEntryConfirm,
    handlePostAllocation,
    handleBreakConfirm,
    handleBreakAlreadyDone,
    handleCashMovementConfirm,
    handleCashierSwapConfirm,
    handleCafeStart,
    handleReturnAnswer,
    handleOccurrenceSubmit,
    isPending:
      recordEvent.isPending ||
      recordBreakDone.isPending ||
      updateSchedule.isPending ||
      allocatePost.isPending ||
      confirmCashMovement.isPending,
  }
}
