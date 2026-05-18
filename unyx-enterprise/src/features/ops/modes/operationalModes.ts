import type { BusinessSegment } from "@/types/domain"

export type OperationalMode = BusinessSegment

export interface OperationalModeDefaults {
  late_tolerance_minutes: number
  break_tolerance_minutes: number
  require_cashier_cash_count: boolean
  require_coverage_before_break: boolean
  block_break_on_peak_hours: boolean
  require_responsible_presence: boolean
  coffee_break_enabled: boolean
  coffee_break_duration_minutes: number
  coffee_window_start: string
  coffee_window_end: string
  coffee_order: "inverse" | "same" | "none"
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
    "Prioriza frente de caixa, cobertura, intervalos e atrasos criticos.",
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
    require_cashier_cash_count: false,
    require_coverage_before_break: true,
    block_break_on_peak_hours: false,
    require_responsible_presence: false,
    coffee_break_enabled: false,
    coffee_break_duration_minutes: 10,
    coffee_window_start: "15:00",
    coffee_window_end: "17:30",
    coffee_order: "inverse",
  },
  retail_store: {
    late_tolerance_minutes: 15,
    break_tolerance_minutes: 10,
    require_cashier_cash_count: false,
    require_coverage_before_break: true,
    block_break_on_peak_hours: false,
    require_responsible_presence: false,
    coffee_break_enabled: false,
    coffee_break_duration_minutes: 10,
    coffee_window_start: "15:00",
    coffee_window_end: "17:30",
    coffee_order: "inverse",
  },
  restaurant: {
    late_tolerance_minutes: 10,
    break_tolerance_minutes: 10,
    require_cashier_cash_count: false,
    require_coverage_before_break: true,
    block_break_on_peak_hours: true,
    require_responsible_presence: false,
    coffee_break_enabled: false,
    coffee_break_duration_minutes: 10,
    coffee_window_start: "15:00",
    coffee_window_end: "17:30",
    coffee_order: "inverse",
  },
  pharmacy: {
    late_tolerance_minutes: 10,
    break_tolerance_minutes: 10,
    require_cashier_cash_count: false,
    require_coverage_before_break: true,
    block_break_on_peak_hours: false,
    require_responsible_presence: true,
    coffee_break_enabled: false,
    coffee_break_duration_minutes: 10,
    coffee_window_start: "15:00",
    coffee_window_end: "17:30",
    coffee_order: "inverse",
  },
  other: {
    late_tolerance_minutes: 15,
    break_tolerance_minutes: 10,
    require_cashier_cash_count: false,
    require_coverage_before_break: true,
    block_break_on_peak_hours: false,
    require_responsible_presence: false,
    coffee_break_enabled: false,
    coffee_break_duration_minutes: 10,
    coffee_window_start: "15:00",
    coffee_window_end: "17:30",
    coffee_order: "inverse",
  },
}

export function getOperationalMode(segment?: BusinessSegment | null): OperationalMode {
  return segment ?? "other"
}

export function getOperationalModeDefaults(mode: OperationalMode) {
  return operationalModeDefaults[mode] ?? operationalModeDefaults.other
}
