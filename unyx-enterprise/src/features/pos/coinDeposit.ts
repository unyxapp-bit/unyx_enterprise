// Moedas deixadas pelo cliente para trocar depois: o fiscal recebe as moedas, anota os dados do
// cliente e entrega uma via. Cada recebimento tem um código curto para achar a ficha depois.

export type CoinDepositStatus = "pendente" | "concluida" | "cancelada"

export const COIN_DEPOSIT_STATUS_LABEL: Record<CoinDepositStatus, string> = {
  pendente: "Aguardando troca",
  concluida: "Troca concluída",
  cancelada: "Cancelada",
}

export interface CoinDepositRecord {
  id: string
  organization_id: string
  branch_id: string | null
  created_by: string | null
  customer_name: string
  customer_phone: string | null
  /** Quando o cliente deixou as moedas (ISO). */
  left_at: string
  estimated_cents: number
  fiscal_name: string | null
  notes: string | null
  status: CoinDepositStatus
  completed_at: string | null
  created_at: string
  branches?: { name: string } | null
  user_profiles?: { name: string } | null
}

/** Texto do valor estimado: sem valor informado (0), o valor fica "a conferir" na contagem. */
export const ESTIMATE_UNKNOWN_LABEL = "A conferir na contagem"

/** Código curto da ficha, para o cliente e o fiscal acharem o recebimento (8 caracteres). */
export function depositCode(id: string) {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase()
}

/** Só os dígitos do telefone (máx. 11). */
export function phoneDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, 11)
}

/** (11) 98765-4321 ou (11) 3456-7890, conforme os dígitos digitados. */
export function formatPhone(value: string) {
  const digits = phoneDigits(value)
  if (digits.length === 0) return ""
  if (digits.length <= 2) return `(${digits}`
  const area = digits.slice(0, 2)
  const rest = digits.slice(2)
  if (digits.length <= 6) return `(${area}) ${rest}`
  if (digits.length <= 10) return `(${area}) ${rest.slice(0, 4)}-${rest.slice(4)}`
  return `(${area}) ${rest.slice(0, 5)}-${rest.slice(5)}`
}

const pad = (value: number) => String(value).padStart(2, "0")

/** 27/10/2026 14:35 (24h, sempre no padrão brasileiro). */
export function formatDateTimeFull(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`
}

/** Valor para o campo datetime-local ("yyyy-mm-ddThh:mm", fuso local). */
export function toLocalInputValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`
}

/** "yyyy-mm-ddThh:mm" (local) -> ISO; vazio/inválido -> null. */
export function localInputToIso(value: string) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}
