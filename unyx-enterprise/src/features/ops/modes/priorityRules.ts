import type {
  DashboardRow,
  OperationalStatus,
  OperationalStatusRecord,
  ScheduleWithRelations,
} from "@/types/domain"

import type { OperationalMode } from "./operationalModes"

interface PriorityContext {
  delayMinutes?: number
  role?: string | null
  sectorName?: string | null
  reason?: string | null
}

const priorityRules: Record<OperationalMode, Record<OperationalStatus, number>> = {
  supermarket: {
    alerta_critico: 100,
    em_intervalo: 70,
    deve_sair: 65,
    aguardando_sangria: 60,
    troca_de_caixa: 55,
    trabalhando: 20,
    voltou: 15,
    folga: 0,
  },
  retail_store: {
    alerta_critico: 100,
    em_intervalo: 60,
    deve_sair: 55,
    aguardando_sangria: 35,
    troca_de_caixa: 35,
    trabalhando: 20,
    voltou: 15,
    folga: 0,
  },
  restaurant: {
    alerta_critico: 100,
    em_intervalo: 65,
    deve_sair: 50,
    aguardando_sangria: 35,
    troca_de_caixa: 35,
    trabalhando: 20,
    voltou: 15,
    folga: 0,
  },
  pharmacy: {
    alerta_critico: 100,
    em_intervalo: 55,
    deve_sair: 50,
    aguardando_sangria: 30,
    troca_de_caixa: 30,
    trabalhando: 20,
    voltou: 15,
    folga: 0,
  },
  other: {
    alerta_critico: 100,
    em_intervalo: 60,
    deve_sair: 50,
    aguardando_sangria: 40,
    troca_de_caixa: 35,
    trabalhando: 20,
    voltou: 15,
    folga: 0,
  },
}

function normalize(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

export function isCashierContext(context: PriorityContext) {
  const text = `${context.role ?? ""} ${context.sectorName ?? ""}`
  return /caixa|checkout|frente/.test(normalize(text))
}

export function isResponsibleContext(context: PriorityContext) {
  const text = `${context.role ?? ""} ${context.sectorName ?? ""}`
  return /farmaceut|responsavel|tecnico/.test(normalize(text))
}

export function getPriorityByMode(
  mode: OperationalMode,
  status: OperationalStatus,
  context: PriorityContext = {}
) {
  let priority = priorityRules[mode]?.[status] ?? priorityRules.other[status] ?? 0

  if ((context.delayMinutes ?? 0) > 0) {
    priority += Math.min(20, Math.ceil((context.delayMinutes ?? 0) / 5))
  }

  if (normalize(context.reason).includes("falta")) priority += 15
  if (normalize(context.reason).includes("atraso")) priority += 10

  if (mode === "supermarket" && isCashierContext(context)) {
    if (status === "alerta_critico") priority += 20
    if (status === "aguardando_sangria" || status === "troca_de_caixa") {
      priority += 15
    }
  }

  if (mode === "restaurant" && /cozinha|salao|delivery|caixa/.test(
    normalize(`${context.role ?? ""} ${context.sectorName ?? ""}`)
  )) {
    if (status === "alerta_critico") priority += 15
  }

  if (mode === "pharmacy" && isResponsibleContext(context)) {
    if (status === "alerta_critico") priority += 25
    if (status === "trabalhando") priority += 5
  }

  return priority
}

export function sortDashboardRowsByMode(
  mode: OperationalMode,
  rows: DashboardRow[]
) {
  return rows.slice().sort((a, b) => {
    const priorityA = getPriorityByMode(mode, a.current_status, {
      delayMinutes: a.delay_minutes,
      role: a.employee_role,
      sectorName: a.sector_name,
      reason: a.status_reason,
    })
    const priorityB = getPriorityByMode(mode, b.current_status, {
      delayMinutes: b.delay_minutes,
      role: b.employee_role,
      sectorName: b.sector_name,
      reason: b.status_reason,
    })

    return (
      priorityB - priorityA ||
      b.delay_minutes - a.delay_minutes ||
      a.employee_name.localeCompare(b.employee_name)
    )
  })
}

export function sortStatusesByMode(
  mode: OperationalMode,
  statuses: OperationalStatusRecord[]
) {
  return statuses.slice().sort((a, b) => {
    const priorityA = getPriorityByMode(mode, a.current_status, {
      delayMinutes: a.delay_minutes,
      role: a.employees?.role,
      sectorName: a.employees?.sectors?.name,
      reason: a.status_reason,
    })
    const priorityB = getPriorityByMode(mode, b.current_status, {
      delayMinutes: b.delay_minutes,
      role: b.employees?.role,
      sectorName: b.employees?.sectors?.name,
      reason: b.status_reason,
    })

    return (
      priorityB - priorityA ||
      b.delay_minutes - a.delay_minutes ||
      (a.employees?.name ?? "").localeCompare(b.employees?.name ?? "")
    )
  })
}

export function getSchedulePriorityByMode(
  mode: OperationalMode,
  schedule: ScheduleWithRelations,
  status?: OperationalStatusRecord
) {
  return getPriorityByMode(mode, status?.current_status ?? "trabalhando", {
    delayMinutes: status?.delay_minutes ?? 0,
    role: schedule.employees?.role,
    sectorName: schedule.employees?.sectors?.name,
    reason: status?.status_reason,
  })
}
