/**
 * useOperationalDialogs - Hook centralizado para gerenciar diálogos
 */

import { useState } from "react"
import type { ScheduleWithRelations } from "@/types/domain"
import type { BreakDialogMode, OperationalDialogStates } from "../utils/types"

export function useOperationalDialogs() {
  const [entry, setEntry] = useState<OperationalDialogStates["entry"]>({
    schedule: null,
    selectedPostId: null,
  })

  const [breakDialog, setBreakDialog] = useState<OperationalDialogStates["break"]>({
    schedule: null,
    mode: "question",
    lateTime: "",
  })

  const [returnPrompt, setReturnPrompt] = useState<OperationalDialogStates["return"]>({
    schedule: null,
    dismissedIds: new Set(),
  })

  const [occurrence, setOccurrence] = useState<OperationalDialogStates["occurrence"]>({
    schedule: null,
    note: "",
    error: null,
  })

  // Entry dialog actions
  const openEntryDialog = (schedule: ScheduleWithRelations) => {
    setEntry({ schedule, selectedPostId: null })
  }

  const closeEntryDialog = () => {
    setEntry({ schedule: null, selectedPostId: null })
  }

  const setSelectedPost = (postId: string | null) => {
    setEntry((prev) => ({ ...prev, selectedPostId: postId }))
  }

  // Break dialog actions
  const openBreakDialog = (schedule: ScheduleWithRelations) => {
    setBreakDialog({ schedule, mode: "question", lateTime: "" })
  }

  const closeBreakDialog = () => {
    setBreakDialog({ schedule: null, mode: "question", lateTime: "" })
  }

  const setBreakMode = (mode: BreakDialogMode) => {
    setBreakDialog((prev) => ({ ...prev, mode }))
  }

  const setBreakLateTime = (time: string) => {
    setBreakDialog((prev) => ({ ...prev, lateTime: time }))
  }

  // Return prompt actions
  const openReturnPrompt = (schedule: ScheduleWithRelations) => {
    setReturnPrompt((prev) => ({ ...prev, schedule }))
  }

  const closeReturnPrompt = () => {
    setReturnPrompt({ schedule: null, dismissedIds: new Set() })
  }

  const dismissReturnPrompt = (scheduleId: string) => {
    setReturnPrompt((prev) => ({
      ...prev,
      dismissedIds: new Set([...prev.dismissedIds, scheduleId]),
    }))
  }

  // Occurrence dialog actions
  const openOccurrenceDialog = (schedule: ScheduleWithRelations) => {
    setOccurrence({ schedule, note: "", error: null })
  }

  const closeOccurrenceDialog = () => {
    setOccurrence({ schedule: null, note: "", error: null })
  }

  const setOccurrenceNote = (note: string) => {
    setOccurrence((prev) => ({ ...prev, note }))
  }

  const setOccurrenceError = (error: string | null) => {
    setOccurrence((prev) => ({ ...prev, error }))
  }

  return {
    // Entry
    entry,
    openEntryDialog,
    closeEntryDialog,
    setSelectedPost,

    // Break
    breakDialog,
    openBreakDialog,
    closeBreakDialog,
    setBreakMode,
    setBreakLateTime,

    // Return
    returnPrompt,
    openReturnPrompt,
    closeReturnPrompt,
    dismissReturnPrompt,

    // Occurrence
    occurrence,
    openOccurrenceDialog,
    closeOccurrenceDialog,
    setOccurrenceNote,
    setOccurrenceError,
  }
}
