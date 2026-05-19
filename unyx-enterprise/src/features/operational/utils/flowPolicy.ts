import type {
  OperationalStatus,
  OperationalStatusRecord,
  ScheduleWithRelations,
} from "@/types/domain"

import {
  CRITICAL_BREAK_TOLERANCE_MINUTES,
  DEFAULT_BREAK_TOLERANCE_MINUTES,
  timeToMinutes,
} from "./operationalCalculations"

export type OperationalFlowStage =
  | "pre_entry"
  | "working"
  | "cash_control"
  | "coverage_change"
  | "break"
  | "returning"
  | "closing"
  | "done"
  | "alert"

export type OperationalFlowSignalSeverity = "normal" | "attention" | "critical"

export interface OperationalFlowSignal {
  key: string
  label: string
  severity: OperationalFlowSignalSeverity
  score: number
}

export const FLOW_ENTERED_STATUSES = new Set<OperationalStatus>([
  "trabalhando",
  "voltou",
  "em_intervalo",
  "aguardando_sangria",
  "troca_de_caixa",
  "deve_sair",
  "alerta_critico",
])

export const FLOW_REAL_WORKING_STATUSES = new Set<OperationalStatus>([
  "trabalhando",
  "voltou",
  "aguardando_sangria",
  "troca_de_caixa",
  "deve_sair",
])

const statusStage: Record<OperationalStatus, OperationalFlowStage> = {
  aguardando_evento: "pre_entry",
  trabalhando: "working",
  deve_sair: "closing",
  aguardando_sangria: "cash_control",
  troca_de_caixa: "coverage_change",
  em_intervalo: "break",
  voltou: "returning",
  folga: "done",
  finalizado: "done",
  alerta_critico: "alert",
}

const statusBasePriority: Record<OperationalStatus, number> = {
  alerta_critico: 120,
  aguardando_sangria: 90,
  troca_de_caixa: 82,
  deve_sair: 76,
  em_intervalo: 70,
  trabalhando: 30,
  voltou: 22,
  aguardando_evento: 10,
  finalizado: 0,
  folga: 0,
}

export function operationalStageForStatus(
  status: OperationalStatus | null | undefined
): OperationalFlowStage {
  return status ? statusStage[status] ?? "pre_entry" : "pre_entry"
}

export function isFlowEnteredStatus(
  status: OperationalStatus | null | undefined
) {
  return Boolean(status && FLOW_ENTERED_STATUSES.has(status))
}

export function isFlowWorkingStatus(
  status: OperationalStatus | null | undefined
) {
  return Boolean(status && FLOW_REAL_WORKING_STATUSES.has(status))
}

export function canFlowStartEntry(status: OperationalStatus | null | undefined) {
  return !status || status === "aguardando_evento"
}

export function canFlowStartBreak(status: OperationalStatus | null | undefined) {
  return status === "trabalhando" || status === "voltou" || status === "deve_sair"
}

export function canFlowReturnFromBreak(status: OperationalStatus | null | undefined) {
  return status === "em_intervalo"
}

export function canFlowStartCafe(status: OperationalStatus | null | undefined) {
  return status === "voltou" || status === "trabalhando"
}

export function canFlowStartExit(status: OperationalStatus | null | undefined) {
  return (
    isFlowEnteredStatus(status) &&
    status !== "em_intervalo" &&
    status !== "aguardando_sangria" &&
    status !== "troca_de_caixa"
  )
}

export function buildOperationalFlowSignals(params: {
  schedule: ScheduleWithRelations
  status?: OperationalStatusRecord
  currentMinutes: number
  breakToleranceMinutes?: number
}) {
  const {
    schedule,
    status,
    currentMinutes,
    breakToleranceMinutes = DEFAULT_BREAK_TOLERANCE_MINUTES,
  } = params
  const currentStatus = status?.current_status ?? "aguardando_evento"
  const signals: OperationalFlowSignal[] = []
  const startMin = timeToMinutes(schedule.start_time)
  const breakStartMin = timeToMinutes(schedule.break_start)
  const breakEndMin = timeToMinutes(schedule.break_end)
  const endMin = timeToMinutes(schedule.end_time)
  const lunchDone = schedule.notes?.includes("lunch_done") || currentStatus === "voltou"

  if ((status?.delay_minutes ?? 0) > 0) {
    signals.push({
      key: "delay",
      label: `${status?.delay_minutes ?? 0}min de atraso`,
      severity: (status?.delay_minutes ?? 0) >= 30 ? "critical" : "attention",
      score: Math.min(45, status?.delay_minutes ?? 0),
    })
  }

  if (currentStatus === "aguardando_evento" && startMin !== null && currentMinutes > startMin) {
    const minutesLate = currentMinutes - startMin
    signals.push({
      key: "entry-overdue",
      label: `entrada atrasada ${minutesLate}min`,
      severity: minutesLate >= 30 ? "critical" : "attention",
      score: 70 + Math.min(40, minutesLate),
    })
  }

  if (
    isFlowWorkingStatus(currentStatus) &&
    !lunchDone &&
    breakStartMin !== null &&
    currentMinutes > breakStartMin + breakToleranceMinutes
  ) {
    const minutesOver = currentMinutes - breakStartMin
    signals.push({
      key: "break-release-overdue",
      label: `intervalo aguardando liberacao ha ${minutesOver}min`,
      severity:
        minutesOver >= breakToleranceMinutes + CRITICAL_BREAK_TOLERANCE_MINUTES
          ? "critical"
          : "attention",
      score: 35 + Math.min(40, minutesOver - breakToleranceMinutes),
    })
  }

  if (
    currentStatus === "em_intervalo" &&
    breakEndMin !== null &&
    currentMinutes > breakEndMin + breakToleranceMinutes
  ) {
    const minutesOver = currentMinutes - breakEndMin
    signals.push({
      key: "break-return-overdue",
      label: `retorno do intervalo atrasado ${minutesOver}min`,
      severity:
        minutesOver >= CRITICAL_BREAK_TOLERANCE_MINUTES ? "critical" : "attention",
      score: 45 + Math.min(45, minutesOver),
    })
  }

  if (isFlowEnteredStatus(currentStatus) && endMin !== null && currentMinutes > endMin) {
    signals.push({
      key: "exit-overdue",
      label: "saida prevista ja passou",
      severity: "attention",
      score: 30 + Math.min(30, currentMinutes - endMin),
    })
  }

  if (isFlowWorkingStatus(currentStatus) && startMin !== null && currentMinutes > startMin) {
    const minutesWorking = currentMinutes - startMin
    signals.push({
      key: "time-in-operation",
      label: `${minutesWorking}min em operacao`,
      severity: "normal",
      score: Math.min(24, Math.floor(minutesWorking / 30)),
    })
  }

  return signals
}

export function getOperationalFlowPriority(params: {
  schedule: ScheduleWithRelations
  status?: OperationalStatusRecord
  currentMinutes: number
  breakToleranceMinutes?: number
}) {
  const status = params.status?.current_status ?? "aguardando_evento"
  const base = statusBasePriority[status]
  const signalScore = buildOperationalFlowSignals(params).reduce(
    (total, signal) => total + signal.score,
    0
  )

  return base + signalScore
}
