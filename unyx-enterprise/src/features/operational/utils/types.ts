/**
 * Types - Tipos específicos do módulo operacional
 */

import type { ScheduleWithRelations } from "@/types/domain"

export type OperationalTab = "em_turno" | "a_chegar"

export type BreakDialogMode = "question" | "late_input"

export interface EntryDialogState {
  schedule: ScheduleWithRelations | null
  selectedPostId: string | null
}

export interface BreakDialogState {
  schedule: ScheduleWithRelations | null
  mode: BreakDialogMode
  lateTime: string
}

export interface ReturnPromptState {
  schedule: ScheduleWithRelations | null
  dismissedIds: Set<string>
}

export interface OccurrenceDialogState {
  schedule: ScheduleWithRelations | null
  note: string
  error: string | null
}

export interface OperationalDialogStates {
  entry: EntryDialogState
  break: BreakDialogState
  return: ReturnPromptState
  occurrence: OccurrenceDialogState
}

export interface EmployeeCardProps {
  schedule: ScheduleWithRelations
  status: string | null
  currentMinutes: number
  isLate: boolean
  lateMinutes: number
  canEntrada: boolean
  canIntervalo: boolean
  canRetorno: boolean
  canCafe: boolean
  canSaida: boolean
  isPending: boolean
  onEntry: () => void
  onBreak: () => void
  onReturn: () => void
  onCafe: () => void
  onExit: () => void
}

export interface FilterOptions {
  sectorFilter: string
  searchText: string
  sortBy: "priority" | "name" | "time"
  dateFilter: string
}
