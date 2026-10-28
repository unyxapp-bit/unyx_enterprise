// Encomendas de clientes: o atendente anota os dados do cliente, o que foi pedido, quando o pedido
// foi feito e quando o cliente vai retirar. Valores (total e sinal) são opcionais, em centavos.

export type CustomerOrderStatus = "pendente" | "pronta" | "retirada" | "cancelada"

export const CUSTOMER_ORDER_STATUS_LABEL: Record<CustomerOrderStatus, string> = {
  pendente: "Aguardando",
  pronta: "Pronta para retirar",
  retirada: "Retirada",
  cancelada: "Cancelada",
}

/** Unidades de medida do pedido: a quantidade varia entre unidades, peso e fardos. */
export type OrderUnit = "un" | "kg" | "g" | "fardo"

export const ORDER_UNITS: Array<{ value: OrderUnit; label: string }> = [
  { value: "un", label: "Unid." },
  { value: "kg", label: "Kg" },
  { value: "g", label: "g" },
  { value: "fardo", label: "Fardo" },
]

export const DEFAULT_ORDER_UNIT: OrderUnit = "un"

/** Pedidos antigos ou valores inesperados caem em "unidade". */
export function sanitizeUnit(value: unknown): OrderUnit {
  return ORDER_UNITS.some((unit) => unit.value === value) ? (value as OrderUnit) : DEFAULT_ORDER_UNIT
}

const unitLabel = (unit: OrderUnit) => ORDER_UNITS.find((item) => item.value === unit)?.label ?? "Unid."

/** Uma linha do pedido: a quantidade (aceita vírgula, ex.: "1,5"), a unidade e o que foi pedido. */
export interface CustomerOrderItem {
  quantity: string
  unit: OrderUnit
  description: string
}

export interface CustomerOrderRecord {
  id: string
  organization_id: string
  branch_id: string | null
  created_by: string | null
  customer_name: string
  customer_phone: string | null
  /** Quando o pedido foi feito (ISO). */
  ordered_at: string
  /** Quando o cliente vai retirar (ISO). */
  pickup_at: string
  items: CustomerOrderItem[]
  notes: string | null
  total_cents: number | null
  /** Sinal (entrada) já pago. */
  paid_cents: number
  attendant_name: string | null
  status: CustomerOrderStatus
  status_at: string | null
  created_at: string
  updated_at: string
}

/** Dados que o formulário envia para criar ou corrigir uma encomenda. */
export interface CustomerOrderInput {
  branch_id: string | null
  customer_name: string
  customer_phone?: string | null
  ordered_at: string
  pickup_at: string
  items: CustomerOrderItem[]
  notes?: string | null
  total_cents: number | null
  paid_cents: number
  attendant_name?: string | null
}

/** Pedidos em andamento: ainda não foram retirados nem cancelados. */
export const OPEN_ORDER_STATUSES: CustomerOrderStatus[] = ["pendente", "pronta"]

export function isOrderOpen(order: Pick<CustomerOrderRecord, "status">) {
  return OPEN_ORDER_STATUSES.includes(order.status)
}

/** Código curto da encomenda (8 caracteres), para achar o pedido na retirada. */
export function orderCode(id: string) {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase()
}

/** Limpa as linhas digitadas: tira espaços e descarta as sem descrição. */
export function cleanItems(items: Array<Partial<CustomerOrderItem>>): CustomerOrderItem[] {
  return items
    .map((item) => ({
      quantity: (item.quantity ?? "").trim(),
      unit: sanitizeUnit(item.unit),
      description: (item.description ?? "").trim(),
    }))
    .filter((item) => item.description !== "")
}

/** Aceita o que veio do banco (jsonb) com segurança. */
export function parseItems(value: unknown): CustomerOrderItem[] {
  if (!Array.isArray(value)) return []
  return cleanItems(
    value.map((item) => {
      const row = (item ?? {}) as Record<string, unknown>
      return {
        quantity: typeof row.quantity === "string" ? row.quantity : String(row.quantity ?? ""),
        unit: sanitizeUnit(row.unit),
        description: typeof row.description === "string" ? row.description : "",
      }
    })
  )
}

/** "40 Unid. · mini pães de sal" (sem quantidade, só a descrição). */
export function itemLine(item: CustomerOrderItem) {
  return item.quantity ? `${item.quantity} ${unitLabel(item.unit)} · ${item.description}` : item.description
}

/** Quanto falta pagar (total − sinal); sem total combinado não há saldo. */
export function remainingCents(total: number | null | undefined, paid: number | null | undefined) {
  if (total == null || total <= 0) return null
  return Math.max(0, total - Math.max(0, paid ?? 0))
}

const pad = (value: number) => String(value).padStart(2, "0")

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"]

/** "Sábado, 03/10/2026 às 16:00" */
export function formatPickup(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  return `${WEEKDAYS[date.getDay()]}, ${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} às ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`
}

const dayKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

export type PickupState = "atrasada" | "hoje" | "amanha" | "futura" | "encerrada"

/** Onde a retirada está em relação a agora; pedidos já retirados/cancelados ficam "encerrada". */
export function pickupState(
  order: Pick<CustomerOrderRecord, "status" | "pickup_at">,
  now: Date = new Date()
): PickupState {
  if (!isOrderOpen(order)) return "encerrada"
  const pickup = new Date(order.pickup_at)
  if (pickup.getTime() < now.getTime()) return "atrasada"
  const today = dayKey(now)
  if (dayKey(pickup) === today) return "hoje"
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  if (dayKey(pickup) === dayKey(tomorrow)) return "amanha"
  return "futura"
}

/** Mais urgente primeiro: pedidos em andamento por hora de retirada; os encerrados depois. */
export function compareOrders(a: CustomerOrderRecord, b: CustomerOrderRecord) {
  const openA = isOrderOpen(a)
  const openB = isOrderOpen(b)
  if (openA !== openB) return openA ? -1 : 1
  const diff = new Date(a.pickup_at).getTime() - new Date(b.pickup_at).getTime()
  return openA ? diff : -diff
}

/** Busca por nome, telefone, código ou item do pedido. */
export function orderMatches(order: CustomerOrderRecord, query: string) {
  const text = query.trim().toLowerCase()
  if (!text) return true
  const digits = text.replace(/\D/g, "")
  if (digits.length >= 3 && (order.customer_phone ?? "").replace(/\D/g, "").includes(digits)) return true
  return (
    order.customer_name.toLowerCase().includes(text) ||
    orderCode(order.id).toLowerCase().includes(text) ||
    order.items.some((item) => item.description.toLowerCase().includes(text))
  )
}
