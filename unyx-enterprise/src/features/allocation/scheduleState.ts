import { timeToMinutes } from "@/features/operational/utils"

// Regras únicas do estado de um colaborador escalado no Controle PDV: o card, os filtros, o
// painel "Agora" e o modal usam as mesmas funções, para nunca divergirem.

export const ACTIVE_STATUS_SET = new Set([
  "trabalhando",
  "voltou",
  "pico",
  "apoio_operacional",
  "fechamento",
])

export const WORK_STARTED_STATUS_SET = new Set([
  ...ACTIVE_STATUS_SET,
  "aguardando_sangria",
  "troca_de_caixa",
  "deve_sair",
  "em_intervalo",
])

export const NON_WORKING_SCHEDULE_STATUS_SET = new Set([
  "absent",
  "day_off",
  "banked_hours",
  "cancelled",
  "finished",
])

export interface ScheduleStateInput {
  scheduleStatus: string
  startTime: string | null | undefined
  /** current_status do status operacional (null/undefined se ainda não existe). */
  currentStatus: string | null | undefined
  hasAllocation: boolean
  hasActiveBreak: boolean
  nowMinutes: number
  lateToleranceMinutes: number
}

export interface ScheduleState {
  /** Já tem entrada registrada (alocado, em turno ou com status de trabalho). */
  hasEntry: boolean
  /** Fora de operação: falta, folga, saída já registrada, etc. */
  unavailable: boolean
  /** Horário de início ainda sem chegada marcada. */
  awaitingArrival: boolean
  /** Chegou, mas sem posto e sem intervalo. */
  workingWithoutPost: boolean
  startArrived: boolean
  arrivalLateMinutes: number
  arrivalIsLate: boolean
  /** Pode ser marcado como falta (passou o horário e ninguém chegou). */
  canMarkAbsent: boolean
}

function minutesSinceStart(startTime: string | null | undefined, nowMinutes: number) {
  const start = timeToMinutes(startTime)
  if (start === null) return 0
  const elapsed = nowMinutes - start
  return elapsed < 0 ? elapsed + 24 * 60 : elapsed
}

export function deriveScheduleState(input: ScheduleStateInput): ScheduleState {
  const start = timeToMinutes(input.startTime)
  const startArrived = start !== null && input.nowMinutes >= start

  const hasEntry =
    input.hasAllocation ||
    input.scheduleStatus === "working" ||
    input.scheduleStatus === "on_break" ||
    input.scheduleStatus === "returned" ||
    Boolean(input.currentStatus && WORK_STARTED_STATUS_SET.has(input.currentStatus))

  const unavailable =
    NON_WORKING_SCHEDULE_STATUS_SET.has(input.scheduleStatus) ||
    input.currentStatus === "finalizado" ||
    input.currentStatus === "folga"

  const free = !input.hasAllocation && !input.hasActiveBreak && !unavailable
  const awaitingArrival = free && !hasEntry
  const workingWithoutPost = free && hasEntry

  const arrivalLateMinutes = startArrived ? minutesSinceStart(input.startTime, input.nowMinutes) : 0

  return {
    hasEntry,
    unavailable,
    awaitingArrival,
    workingWithoutPost,
    startArrived,
    arrivalLateMinutes,
    arrivalIsLate: arrivalLateMinutes > input.lateToleranceMinutes,
    canMarkAbsent: startArrived && free,
  }
}

/** Menor número = mais urgente; usado para ordenar a lista do Controle PDV. */
export function scheduleUrgency(
  state: ScheduleState,
  flags: {
    returnPending: boolean
    releasePending: boolean
    exitPending: boolean
    critical: boolean
  }
) {
  if (state.awaitingArrival && state.startArrived && state.arrivalIsLate) return 0
  if (flags.critical) return 1
  if (flags.returnPending) return 2
  if (state.workingWithoutPost) return 3
  if (flags.releasePending) return 4
  if (flags.exitPending) return 5
  if (state.awaitingArrival && state.startArrived) return 6
  return 7
}

export interface CoverageInfo {
  /** Operadores em posto agora (sem intervalo). */
  active: number
  minimum: number
  /** Se um operador sair agora, a cobertura mínima ainda é respeitada. */
  canLeave: boolean
}

/** Cobertura mínima de operadores: orienta quem pode sair para o intervalo. */
export function coverageInfo(
  allocationsInPost: number,
  allocationsOnBreak: number,
  minimum: number
): CoverageInfo {
  const active = Math.max(0, allocationsInPost - allocationsOnBreak)
  return { active, minimum, canLeave: active - 1 >= minimum }
}
