/**
 * Status Helpers - Funções relacionadas a status de operação
 */

import type { OperationalStatus } from "@/types/domain"
import {
  canFlowReturnFromBreak,
  canFlowStartBreak,
  canFlowStartCafe,
  canFlowStartEntry,
  canFlowStartExit,
  FLOW_ENTERED_STATUSES,
} from "./flowPolicy"

export function getInitials(name: string): string {
  const parts = name.trim().split(" ").filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return (parts[0][0] ?? "?").toUpperCase()
  return ((parts[0][0] ?? "") + (parts[parts.length - 1][0] ?? "")).toUpperCase()
}

export const avatarClassByStatus: Partial<Record<OperationalStatus, string>> = {
  aguardando_evento: "bg-slate-200 text-slate-700",
  trabalhando: "bg-emerald-100 text-emerald-700",
  deve_sair: "bg-amber-100 text-amber-700",
  aguardando_sangria: "bg-orange-100 text-orange-700",
  troca_de_caixa: "bg-sky-100 text-sky-700",
  em_intervalo: "bg-violet-100 text-violet-700",
  voltou: "bg-teal-100 text-teal-700",
  pico: "bg-red-100 text-red-700",
  apoio_operacional: "bg-blue-100 text-blue-700",
  fechamento: "bg-indigo-100 text-indigo-700",
  folga: "bg-zinc-200 text-zinc-600",
  finalizado: "bg-neutral-200 text-neutral-600",
  alerta_critico: "bg-red-100 text-red-700",
}

export const postTypeLabel: Record<string, string> = {
  cashier: "Caixa",
  self_checkout: "Autoatendimento",
  counter: "Balcão",
  service_desk: "Atendimento",
  delivery: "Delivery",
  support: "Apoio",
  closing: "Fechamento",
  stock: "Estoque",
  kitchen: "Cozinha",
}

// Statuses que significam que o colaborador já entrou (exclui finalizado)
export const ENTERED_STATUSES = FLOW_ENTERED_STATUSES

export function canStartEntry(status: OperationalStatus | null | undefined): boolean {
  return canFlowStartEntry(status)
}

export function canStartBreak(status: OperationalStatus | null | undefined): boolean {
  return canFlowStartBreak(status)
}

export function canReturnFromBreak(status: OperationalStatus | null | undefined): boolean {
  return canFlowReturnFromBreak(status)
}

export function canStartCafe(status: OperationalStatus | null | undefined): boolean {
  return canFlowStartCafe(status)
}

export function canStartExit(status: OperationalStatus | null | undefined): boolean {
  return canFlowStartExit(status)
}

export function isCafeBreak(notes: string | null | undefined): boolean {
  return notes?.includes("cafe_active") ?? false
}

export function isDone(status: OperationalStatus | null | undefined): boolean {
  return status === "finalizado" || status === "folga"
}
