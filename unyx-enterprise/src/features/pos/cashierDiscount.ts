// Ficha de desconto no caixa: o fiscal autoriza vender um produto abaixo do preço do sistema
// (preço errado na etiqueta, produto avariado etc.). O valor do desconto é a diferença entre o
// preço do sistema e o preço de venda, vezes a quantidade. Contas em centavos inteiros.

export type DiscountReason = "preco_errado" | "outro"

export const DISCOUNT_REASON_LABEL: Record<DiscountReason, string> = {
  preco_errado: "Preço errado",
  outro: "Outro motivo",
}

export const MAX_DISCOUNT_QUANTITY = 9999

export interface DiscountCalculation {
  /** Diferença por unidade (preço do sistema − preço de venda), em centavos. */
  unitCents: number
  quantity: number
  /** Desconto total: diferença por unidade × quantidade. */
  totalCents: number
  /** Há desconto de fato (venda abaixo do sistema). */
  valid: boolean
  /** Preço de venda acima do sistema: não é desconto, é erro de digitação. */
  saleAboveSystem: boolean
}

export function sanitizeQuantity(value: unknown) {
  const number = Math.floor(Number(value))
  if (!Number.isFinite(number) || number < 1) return 1
  return Math.min(number, MAX_DISCOUNT_QUANTITY)
}

export function calculateDiscount(input: {
  systemCents: number
  saleCents: number
  quantity: number
}): DiscountCalculation {
  const quantity = sanitizeQuantity(input.quantity)
  const system = Math.max(0, Math.round(input.systemCents))
  const sale = Math.max(0, Math.round(input.saleCents))
  const unitCents = Math.max(0, system - sale)
  return {
    unitCents,
    quantity,
    totalCents: unitCents * quantity,
    valid: system > 0 && unitCents > 0,
    saleAboveSystem: sale > system,
  }
}

/** "Batata pringles 104G original (3X)": a quantidade vai junto da descrição quando é maior que 1. */
export function productLine(name: string, quantity: number) {
  const trimmed = name.trim()
  return quantity > 1 ? `${trimmed} (${quantity}X)` : trimmed
}

/** Desconto registrado (tabela cashier_discounts). */
export interface CashierDiscountRecord {
  id: string
  organization_id: string
  branch_id: string | null
  created_by: string | null
  product_id: string | null
  product_name: string
  product_code: string | null
  quantity: number
  system_price_cents: number
  sale_price_cents: number
  discount_cents: number
  reason: DiscountReason
  reason_description: string | null
  fiscal_name: string | null
  /** Caixa (PDV) e operador (OP) da venda. */
  pdv: string | null
  operator_name: string | null
  created_at: string
  /** Preenchidos quando o desconto foi cancelado; o registro continua no histórico. */
  canceled_at?: string | null
  canceled_by?: string | null
  canceled_by_name?: string | null
  cancel_reason?: string | null
  user_profiles?: { name: string } | null
}

export const MIN_CANCEL_REASON_LENGTH = 3

/** Um desconto cancelado não conta nos totais do dia. */
export function isDiscountCanceled(item: Pick<CashierDiscountRecord, "canceled_at">) {
  return Boolean(item.canceled_at)
}
