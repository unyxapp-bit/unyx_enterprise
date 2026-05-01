import type { BusinessSegment } from "@/types/domain"

export type OperationalMode = BusinessSegment

export interface OperationalModeDefaults {
  late_tolerance_minutes: number
  break_tolerance_minutes: number
  require_cashier_cash_count: boolean
  require_coverage_before_break: boolean
  block_break_on_peak_hours: boolean
  require_responsible_presence: boolean
}

export const operationalModeNames: Record<OperationalMode, string> = {
  supermarket: "Supermercado",
  retail_store: "Atacado / Varejo",
  restaurant: "Restaurante",
  pharmacy: "Farmacia",
  other: "Outro",
}

export const operationalModeDescriptions: Record<OperationalMode, string> = {
  supermarket:
    "Prioriza frente de caixa, sangria, cobertura, intervalos e atrasos criticos.",
  retail_store:
    "Prioriza cobertura por setor, faltas, atrasos por area e realocacao.",
  restaurant:
    "Prioriza equipe minima por turno, horarios de pico e funcoes criticas.",
  pharmacy:
    "Prioriza responsavel obrigatorio, atendimento e rastreabilidade operacional.",
  other: "Mantem a operacao generica com foco em atrasos, intervalos e alertas.",
}

export const operationalModeDefaults: Record<
  OperationalMode,
  OperationalModeDefaults
> = {
  supermarket: {
    late_tolerance_minutes: 10,
    break_tolerance_minutes: 10,
    require_cashier_cash_count: true,
    require_coverage_before_break: true,
    block_break_on_peak_hours: false,
    require_responsible_presence: false,
  },
  retail_store: {
    late_tolerance_minutes: 15,
    break_tolerance_minutes: 10,
    require_cashier_cash_count: false,
    require_coverage_before_break: true,
    block_break_on_peak_hours: false,
    require_responsible_presence: false,
  },
  restaurant: {
    late_tolerance_minutes: 10,
    break_tolerance_minutes: 10,
    require_cashier_cash_count: false,
    require_coverage_before_break: true,
    block_break_on_peak_hours: true,
    require_responsible_presence: false,
  },
  pharmacy: {
    late_tolerance_minutes: 10,
    break_tolerance_minutes: 10,
    require_cashier_cash_count: false,
    require_coverage_before_break: true,
    block_break_on_peak_hours: false,
    require_responsible_presence: true,
  },
  other: {
    late_tolerance_minutes: 15,
    break_tolerance_minutes: 10,
    require_cashier_cash_count: false,
    require_coverage_before_break: true,
    block_break_on_peak_hours: false,
    require_responsible_presence: false,
  },
}

export function getOperationalMode(segment?: BusinessSegment | null): OperationalMode {
  return segment ?? "other"
}

export function getOperationalModeDefaults(mode: OperationalMode) {
  return operationalModeDefaults[mode] ?? operationalModeDefaults.other
}
