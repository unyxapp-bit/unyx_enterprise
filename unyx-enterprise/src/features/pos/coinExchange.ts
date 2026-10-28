// Troca de moedas: o cliente entrega moedas e a loja paga o valor de face mais um acréscimo
// percentual que depende da moeda (as pequenas, mais escassas, rendem mais). Toda a conta é feita
// em centavos inteiros para não acumular erro de arredondamento.

export const COIN_DENOMINATIONS = [
  // packCents: valor de um pacote fechado, como as moedas são separadas para os trocos dos caixas.
  { id: "c5", cents: 5, label: "R$ 0,05", packCents: 250 },
  { id: "c10", cents: 10, label: "R$ 0,10", packCents: 500 },
  { id: "c25", cents: 25, label: "R$ 0,25", packCents: 500 },
  { id: "c50", cents: 50, label: "R$ 0,50", packCents: 1000 },
  { id: "r1", cents: 100, label: "R$ 1,00", packCents: 2000 },
] as const

export type CoinId = (typeof COIN_DENOMINATIONS)[number]["id"]
export type CoinRates = Record<CoinId, number>
/** Valor em moedas de cada tipo, em centavos (ex.: R$ 1,00 em moedas de 10 centavos = 100). */
export type CoinAmounts = Record<CoinId, number>

// Conforme a ficha de troca da loja: 5 e 10 centavos rendem 10%; 25, 50 centavos e 1 real rendem 5%.
export const DEFAULT_COIN_RATES: CoinRates = { c5: 10, c10: 10, c25: 5, c50: 5, r1: 5 }

export const EMPTY_COIN_AMOUNTS: CoinAmounts = { c5: 0, c10: 0, c25: 0, c50: 0, r1: 0 }

/** Limite de segurança por tipo de moeda: R$ 1.000.000,00. */
export const MAX_COIN_AMOUNT_CENTS = 100_000_000

export interface CoinExchangeLine {
  id: CoinId
  label: string
  /** Valor de uma moeda, em centavos. */
  unitCents: number
  /** Quantidade de moedas que esse valor representa (valor ÷ valor da moeda). */
  quantity: number
  /** Valor de um pacote fechado deste tipo de moeda. */
  packCents: number
  /** Pacotes fechados e o que sobra solto (em centavos): 20,60 em moedas de 10c = 4 pacotes + 0,60. */
  packs: number
  looseCents: number
  /** O valor informado fecha com moedas inteiras? (ex.: R$ 1,05 não fecha em moedas de 10c). */
  exact: boolean
  /** Percentual de acréscimo aplicado a esta moeda. */
  rate: number
  faceCents: number
  bonusCents: number
  totalCents: number
}

export interface CoinExchangeResult {
  lines: CoinExchangeLine[]
  coinCount: number
  /** Total de pacotes fechados, somando todos os tipos. */
  packCount: number
  /** Valor total que ficou solto (não fechou pacote), em centavos. */
  looseCents: number
  faceCents: number
  bonusCents: number
  /** O que a loja paga ao cliente: valor de face + acréscimo. */
  totalCents: number
  /** Todos os valores informados fecham com moedas inteiras. */
  allExact: boolean
  /** Acréscimo somado por percentual (ex.: tudo que rendeu 10% junto, tudo que rendeu 5% junto). */
  bonusByRate: Array<{ rate: number; faceCents: number; bonusCents: number }>
}

export function sanitizeCents(value: unknown) {
  const number = Math.round(Number(value))
  if (!Number.isFinite(number) || number < 0) return 0
  return Math.min(number, MAX_COIN_AMOUNT_CENTS)
}

/**
 * Texto digitado em reais -> centavos. Aceita "1,50", "1.50", "1.234,56" e "R$ 10".
 * Vazio ou inválido vira 0.
 */
export function parseMoneyToCents(text: string) {
  const cleaned = text.trim().replace(/[^\d.,]/g, "")
  if (!cleaned) return 0
  let normalized = cleaned
  if (cleaned.includes(",")) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".")
  } else if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    normalized = cleaned.replace(/\./g, "")
  }
  const value = Number.parseFloat(normalized)
  if (!Number.isFinite(value)) return 0
  return sanitizeCents(Math.round(value * 100))
}

export function sanitizeRate(value: unknown, fallback = 0) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(100, Math.max(0, Math.round(number * 100) / 100))
}

/** Percentuais vindos do banco ou de campos de texto: valores inválidos voltam ao padrão. */
export function sanitizeRates(value: unknown): CoinRates {
  const source = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>
  const rates = { ...DEFAULT_COIN_RATES }
  for (const coin of COIN_DENOMINATIONS) {
    if (source[coin.id] !== undefined) rates[coin.id] = sanitizeRate(source[coin.id], DEFAULT_COIN_RATES[coin.id])
  }
  return rates
}

/** Agrupa as linhas pelo percentual: maior percentual primeiro; só quem tem valor. */
function bonusByRate(lines: CoinExchangeLine[]) {
  const groups = new Map<number, { rate: number; faceCents: number; bonusCents: number }>()
  for (const line of lines) {
    if (line.faceCents === 0) continue
    const group = groups.get(line.rate) ?? { rate: line.rate, faceCents: 0, bonusCents: 0 }
    group.faceCents += line.faceCents
    group.bonusCents += line.bonusCents
    groups.set(line.rate, group)
  }
  return [...groups.values()].sort((a, b) => b.rate - a.rate)
}

export function calculateCoinExchange(
  amounts: Partial<CoinAmounts>,
  rates: CoinRates
): CoinExchangeResult {
  const lines: CoinExchangeLine[] = COIN_DENOMINATIONS.map((coin) => {
    const faceCents = sanitizeCents(amounts[coin.id] ?? 0)
    const rate = sanitizeRate(rates[coin.id], DEFAULT_COIN_RATES[coin.id])
    // O acréscimo é arredondado ao centavo por tipo de moeda, para o recibo fechar linha a linha.
    const bonusCents = Math.round((faceCents * rate) / 100)
    return {
      id: coin.id,
      label: coin.label,
      unitCents: coin.cents,
      quantity: Math.floor(faceCents / coin.cents),
      packCents: coin.packCents,
      packs: Math.floor(faceCents / coin.packCents),
      looseCents: faceCents % coin.packCents,
      exact: faceCents % coin.cents === 0,
      rate,
      faceCents,
      bonusCents,
      totalCents: faceCents + bonusCents,
    }
  })

  return {
    lines,
    coinCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    packCount: lines.reduce((sum, line) => sum + line.packs, 0),
    looseCents: lines.reduce((sum, line) => sum + line.looseCents, 0),
    faceCents: lines.reduce((sum, line) => sum + line.faceCents, 0),
    bonusCents: lines.reduce((sum, line) => sum + line.bonusCents, 0),
    totalCents: lines.reduce((sum, line) => sum + line.totalCents, 0),
    allExact: lines.every((line) => line.exact),
    bonusByRate: bonusByRate(lines),
  }
}

export const centsToReais = (cents: number) => cents / 100

/** Troca registrada no histórico (tabela coin_exchanges). */
export interface CoinExchangeRecord {
  id: string
  organization_id: string
  branch_id: string | null
  created_by: string | null
  customer_name: string | null
  customer_phone: string | null
  /** Recebimento de moedas (coin_deposits) de onde esta troca veio, se houver. */
  deposit_id: string | null
  fiscal_name: string | null
  notes: string | null
  items: Array<{
    id: CoinId
    quantity: number
    rate: number
    face_cents: number
    bonus_cents: number
  }>
  coin_count: number
  face_cents: number
  bonus_cents: number
  total_cents: number
  created_at: string
  user_profiles?: { name: string } | null
}
