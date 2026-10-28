import { useEffect, useMemo, useState } from "react"
import { ClipboardCheck, Coins, FileDown, Link2Off, Pencil, Printer, RotateCcw, Save } from "lucide-react"
import { toast } from "sonner"

import { useAuth } from "@/app/providers/auth-context"
import { PageHeader } from "@/components/shared/PageHeader"
import { StateBlock } from "@/components/shared/StateBlock"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  calculateCoinExchange,
  centsToReais,
  COIN_DENOMINATIONS,
  DEFAULT_COIN_RATES,
  parseMoneyToCents,
  sanitizeRate,
  sanitizeRates,
  type CoinId,
} from "@/features/pos/coinExchange"
import { printHtml } from "@/features/frontstore/formPrint"
import { CoinDepositsPanel } from "@/features/pos/CoinDepositsPanel"
import { depositCode, formatPhone, type CoinDepositRecord } from "@/features/pos/coinDeposit"
import { readStorage, writeStorage } from "@/features/pos/coinStorage"
import {
  buildCoinCustomerHtml,
  buildCoinExchangePdf,
  buildCoinSheetHtml,
} from "@/features/pos/coinSheetPrint"
import {
  useCoinExchanges,
  useCoinRates,
  useCreateCoinExchange,
  useSaveCoinRates,
  useUpdateCoinDepositStatus,
} from "@/hooks/useUnyxData"
import { formatCurrency, formatDateTimeBR, todayISO } from "@/lib/format"
import { useAppStore } from "@/store/useAppStore"
import { cn } from "@/lib/utils"

const money = (cents: number) => formatCurrency(centsToReais(cents))
const percent = (value: number) => `${String(value).replace(".", ",")}%`

const emptyAmountTexts = (): Record<CoinId, string> => ({ c5: "", c10: "", c25: "", c50: "", r1: "" })

// Rascunho da troca em andamento: sobrevive a recarregar a página até registrar ou limpar.
interface LinkedDeposit {
  id: string
  customer_name: string
  customer_phone: string | null
  estimated_cents: number
}

interface CoinDraft {
  amounts: Record<CoinId, string>
  customer: string
  phone: string
  notes: string
  /** Recebimento de moedas de onde esta troca veio. */
  linked: LinkedDeposit | null
}

function loadDraft(key: string): CoinDraft {
  const stored = readStorage(key) as Partial<CoinDraft> | null
  const amounts = emptyAmountTexts()
  for (const coin of COIN_DENOMINATIONS) {
    const value = stored?.amounts?.[coin.id]
    if (typeof value === "string") amounts[coin.id] = value
  }
  const linked = stored?.linked
  return {
    amounts,
    customer: typeof stored?.customer === "string" ? stored.customer : "",
    phone: typeof stored?.phone === "string" ? stored.phone : "",
    notes: typeof stored?.notes === "string" ? stored.notes : "",
    linked:
      linked && typeof linked.id === "string" && typeof linked.customer_name === "string"
        ? {
            id: linked.id,
            customer_name: linked.customer_name,
            customer_phone: typeof linked.customer_phone === "string" ? linked.customer_phone : null,
            estimated_cents: Number(linked.estimated_cents) || 0,
          }
        : null,
  }
}

function parseRateInput(value: string, fallback: number) {
  return sanitizeRate(value.replace(",", "."), fallback)
}

export function CoinExchangePage() {
  const { profile } = useAuth()
  const selectedBranchId = useAppStore((state) => state.selectedBranchId)
  const ratesQuery = useCoinRates()
  const saveRates = useSaveCoinRates()
  const createExchange = useCreateCoinExchange()
  const updateDepositStatus = useUpdateCoinDepositStatus()

  // O que se digita é o VALOR em reais de cada tipo de moeda (ex.: 1,00 em moedas de 10 centavos).
  const viewKey = `unyx-coin-view:${profile?.id ?? "anon"}`
  const [view, setView] = useState<"troca" | "deixadas">(() =>
    readStorage(viewKey) === "deixadas" ? "deixadas" : "troca"
  )
  const changeView = (next: "troca" | "deixadas") => {
    setView(next)
    writeStorage(viewKey, next)
  }
  const draftKey = `unyx-coin-exchange-draft:${profile?.id ?? "anon"}`
  const fiscalKey = `unyx-coin-exchange-fiscal:${profile?.id ?? "anon"}`
  const [draft] = useState(() => loadDraft(draftKey))
  const [amountTexts, setAmountTexts] = useState<Record<CoinId, string>>(draft.amounts)
  const [customerName, setCustomerName] = useState(draft.customer)
  const [notes, setNotes] = useState(draft.notes)
  const [customerPhone, setCustomerPhone] = useState(draft.phone)
  const [linked, setLinked] = useState<LinkedDeposit | null>(draft.linked)
  const [detailsOpen, setDetailsOpen] = useState(
    Boolean(draft.notes)
  )
  // Fiscal da ficha: começa com quem está logado, mas pode ser trocado (ex.: troca feita por outro).
  const [fiscalEdit, setFiscalEdit] = useState<string | null>(() => {
    const stored = readStorage(fiscalKey)
    return typeof stored === "string" ? stored : null
  })
  const fiscalName = fiscalEdit ?? profile?.name ?? ""
  // Enquanto edita os percentuais, o cálculo mostra uma prévia com os valores digitados.
  const [rateDraft, setRateDraft] = useState<Record<CoinId, string> | null>(null)
  const [historyDate, setHistoryDate] = useState(todayISO())

  useEffect(() => {
    const empty =
      COIN_DENOMINATIONS.every((coin) => amountTexts[coin.id].trim() === "") &&
      customerName.trim() === "" &&
      customerPhone === "" &&
      notes.trim() === "" &&
      linked === null
    writeStorage(
      draftKey,
      empty
        ? null
        : { amounts: amountTexts, customer: customerName, phone: customerPhone, notes, linked }
    )
  }, [amountTexts, customerName, customerPhone, draftKey, linked, notes])

  useEffect(() => {
    writeStorage(fiscalKey, fiscalEdit)
  }, [fiscalEdit, fiscalKey])

  const savedRates = useMemo(() => sanitizeRates(ratesQuery.data), [ratesQuery.data])
  const rates = useMemo(() => {
    if (!rateDraft) return savedRates
    const parsed = { ...DEFAULT_COIN_RATES }
    for (const coin of COIN_DENOMINATIONS) {
      parsed[coin.id] = parseRateInput(rateDraft[coin.id], savedRates[coin.id])
    }
    return parsed
  }, [rateDraft, savedRates])

  const result = useMemo(() => {
    const amounts = Object.fromEntries(
      COIN_DENOMINATIONS.map((coin) => [coin.id, parseMoneyToCents(amountTexts[coin.id])])
    ) as Record<CoinId, number>
    return calculateCoinExchange(amounts, rates)
  }, [amountTexts, rates])
  const history = useCoinExchanges(historyDate)

  const dayTotals = useMemo(() => {
    const list = history.data ?? []
    return {
      count: list.length,
      coins: list.reduce((sum, item) => sum + item.coin_count, 0),
      face: list.reduce((sum, item) => sum + item.face_cents, 0),
      bonus: list.reduce((sum, item) => sum + item.bonus_cents, 0),
      total: list.reduce((sum, item) => sum + item.total_cents, 0),
    }
  }, [history.data])

  const editingRates = rateDraft !== null

  const startEditingRates = () =>
    setRateDraft(
      Object.fromEntries(
        COIN_DENOMINATIONS.map((coin) => [coin.id, String(savedRates[coin.id]).replace(".", ",")])
      ) as Record<CoinId, string>
    )

  const handleSaveRates = async () => {
    try {
      await saveRates.mutateAsync(rates)
      setRateDraft(null)
    } catch {
      // O hook já mostra o erro em toast.
    }
  }

  const reset = () => {
    setAmountTexts(emptyAmountTexts())
    setCustomerName("")
    setCustomerPhone("")
    setNotes("")
    setLinked(null)
  }

  // Vindo de "Moedas deixadas": abre a troca com o nome e o telefone do cliente já preenchidos.
  const startExchangeFor = (deposit: CoinDepositRecord) => {
    const hasWork =
      COIN_DENOMINATIONS.some((coin) => amountTexts[coin.id].trim() !== "") ||
      customerName.trim() !== "" ||
      linked !== null
    if (
      hasWork &&
      !window.confirm("Há uma troca em andamento. Substituir pelos dados de " + deposit.customer_name + "?")
    ) {
      changeView("troca")
      return
    }
    setAmountTexts(emptyAmountTexts())
    setNotes("")
    setCustomerName(deposit.customer_name)
    setCustomerPhone(deposit.customer_phone ?? "")
    setLinked({
      id: deposit.id,
      customer_name: deposit.customer_name,
      customer_phone: deposit.customer_phone,
      estimated_cents: deposit.estimated_cents,
    })
    setDetailsOpen(true)
    changeView("troca")
  }

  // A ficha do fiscal não leva o nome do cliente; a conferência do cliente leva nome e telefone.
  const sheetInfo = () => ({
    fiscal: fiscalName,
    dateLabel: new Date().toLocaleDateString("pt-BR"),
    notes,
    customerName,
    customerPhone,
  })

  const printSheet = () => {
    if (result.totalCents <= 0) return
    printHtml(buildCoinSheetHtml(result, sheetInfo()))
  }

  // A conferência e o PDF levam o nome do cliente: se estiver vazio, confirma antes de imprimir.
  const confirmWithoutCustomer = () =>
    customerName.trim() !== "" ||
    window.confirm("O nome do cliente está vazio e vai sair como \"—\" na conferência. Imprimir mesmo assim?")

  const printCustomerSheet = () => {
    if (result.totalCents <= 0 || !confirmWithoutCustomer()) return
    printHtml(buildCoinCustomerHtml(result, sheetInfo()))
  }

  const downloadSheet = async () => {
    if (result.totalCents <= 0 || !confirmWithoutCustomer()) return
    try {
      const blob = await buildCoinExchangePdf(result, sheetInfo())
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `troca_moedas_${new Date().toLocaleDateString("pt-BR").replaceAll("/", "-")}.pdf`
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
    } catch {
      toast.error("Não foi possível gerar o PDF da ficha.")
    }
  }

  const handleRegister = async () => {
    if (result.totalCents <= 0 || editingRates || !result.allExact) return
    try {
      await createExchange.mutateAsync({
        branch_id: selectedBranchId,
        customer_name: customerName,
        customer_phone: customerPhone,
        deposit_id: linked?.id ?? null,
        fiscal_name: fiscalName,
        notes,
        result,
      })
      // A troca feita a partir de um recebimento conclui esse recebimento.
      if (linked) updateDepositStatus.mutate({ id: linked.id, status: "concluida" })
      reset()
    } catch {
      // O hook já mostra o erro em toast.
    }
  }

  return (
    <div>
      <PageHeader
        large
        title="Troca de moedas"
        description={
          view === "troca"
            ? "Informe o valor em cada tipo de moeda e veja quanto pagar, com o acréscimo de cada tipo."
            : "Receba as moedas que o cliente deixa para trocar depois e entregue o comprovante."
        }
        action={
          view !== "troca" ? null : editingRates ? (
            <>
              <Button variant="outline" onClick={() => setRateDraft(null)}>
                Cancelar
              </Button>
              <Button onClick={() => void handleSaveRates()} disabled={saveRates.isPending}>
                <Save className="size-4" />
                {saveRates.isPending ? "Salvando..." : "Salvar percentuais"}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={startEditingRates} disabled={ratesQuery.isLoading}>
              <Pencil className="size-4" />
              Editar percentuais
            </Button>
          )
        }
      />

      <div className="px-6 pt-4">
        <div
          role="tablist"
          aria-label="Seções da troca de moedas"
          className="inline-flex gap-1 rounded-full border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] p-1"
        >
          {(
            [
              { key: "deixadas", label: "Moedas deixadas pelo cliente" },
              { key: "troca", label: "Troca de moedas" },
            ] as const
          ).map((tab) => (
            <Button
              key={tab.key}
              role="tab"
              aria-selected={view === tab.key}
              size="sm"
              variant={view === tab.key ? "default" : "ghost"}
              className="rounded-full"
              onClick={() => changeView(tab.key)}
            >
              {tab.label}
            </Button>
          ))}
        </div>
      </div>

      {view === "deixadas" ? <CoinDepositsPanel onStartExchange={startExchangeFor} /> : null}

      <div className={cn("space-y-5 p-6", view !== "troca" && "hidden")}>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Coins className="size-4 text-amber-500" />
                Valor entregue em cada tipo de moeda
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[color:var(--border-soft)] text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">Moeda</th>
                      <th className="px-3 py-2 font-medium">Valor entregue</th>
                      <th className="px-3 py-2 font-medium">Pacotes</th>
                      <th className="px-3 py-2 text-right font-medium">Acréscimo</th>
                      <th className="py-2 pl-3 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.lines.map((line) => {
                      const filled = line.faceCents > 0
                      return (
                        <tr
                          key={line.id}
                          className="border-b border-[color:var(--border-soft)] last:border-0"
                        >
                          <td className="whitespace-nowrap py-1.5 pr-3 align-middle font-semibold tabular-nums text-[color:var(--text-primary)]">
                            <div>{line.label}</div>
                            <div className="text-[11px] font-normal text-muted-foreground">
                              pacote de {money(line.packCents)}
                            </div>
                          </td>
                          <td className="px-3 py-1.5 align-middle">
                            <label
                              className={cn(
                                "flex h-9 w-32 cursor-text items-center gap-1 rounded-2xl border bg-transparent px-3 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30",
                                line.exact ? "border-input" : "border-destructive"
                              )}
                            >
                              <span className="text-xs text-muted-foreground">R$</span>
                              <input
                                inputMode="decimal"
                                aria-label={`Valor em moedas de ${line.label}`}
                                aria-invalid={!line.exact}
                                className="min-w-0 flex-1 bg-transparent text-sm tabular-nums outline-none placeholder:text-muted-foreground"
                                placeholder="0,00"
                                value={amountTexts[line.id]}
                                onChange={(event) =>
                                  setAmountTexts((current) => ({
                                    ...current,
                                    [line.id]: event.target.value,
                                  }))
                                }
                              />
                            </label>
                            {!line.exact ? (
                              <div className="mt-1 text-[11px] text-red-600 dark:text-red-400">
                                Não fecha em moedas de {line.label}.
                              </div>
                            ) : null}
                          </td>
                          <td
                            className="px-3 py-1.5 align-middle text-sm tabular-nums"
                            title={line.quantity > 0 ? `${line.quantity} moedas` : undefined}
                          >
                            <div>
                              {!filled ? (
                                <span className="text-muted-foreground">—</span>
                              ) : (
                                <>
                                  {line.packs > 0 ? (
                                    <span className="font-semibold text-[color:var(--text-primary)]">
                                      {line.packs} {line.packs === 1 ? "pacote" : "pacotes"}
                                    </span>
                                  ) : null}
                                  {line.looseCents > 0 ? (
                                    <span className="block text-xs text-muted-foreground">
                                      {line.packs > 0 ? "+ " : ""}
                                      {money(line.looseCents)} soltos
                                    </span>
                                  ) : null}
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-1.5 text-right align-middle">
                            {editingRates && rateDraft ? (
                              <div className="inline-flex items-center gap-1">
                                <Input
                                  inputMode="decimal"
                                  aria-label={`Percentual de acréscimo de ${line.label}`}
                                  className="h-9 w-20 text-right tabular-nums"
                                  value={rateDraft[line.id]}
                                  onChange={(event) =>
                                    setRateDraft((current) =>
                                      current ? { ...current, [line.id]: event.target.value } : current
                                    )
                                  }
                                />
                                <span className="text-muted-foreground">%</span>
                              </div>
                            ) : (
                              <div>
                                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                                  +{percent(line.rate)}
                                </span>
                                <div
                                  className={cn(
                                    "text-sm tabular-nums",
                                    filled
                                      ? "text-emerald-700 dark:text-emerald-300"
                                      : "text-muted-foreground"
                                  )}
                                >
                                  {filled ? money(line.bonusCents) : "—"}
                                </div>
                              </div>
                            )}
                          </td>
                          <td
                            className={cn(
                              "py-1.5 pl-3 text-right align-middle text-base font-semibold tabular-nums",
                              filled ? "text-[color:var(--text-primary)]" : "text-muted-foreground"
                            )}
                          >
                            <div>{filled ? money(line.totalCents) : "—"}</div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {editingRates ? (
                <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                  Editando percentuais: o cálculo acima é uma prévia. Salve para valer em todas as
                  próximas trocas; o registro de trocas fica bloqueado até lá.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="h-fit lg:sticky lg:top-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Resumo da troca</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {linked ? (
                <div className="rounded-xl border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        Troca de moedas deixadas · {depositCode(linked.id)}
                      </div>
                      <div className="truncate font-semibold text-[color:var(--text-primary)]">
                        {linked.customer_name}
                        {linked.customer_phone ? ` · ${linked.customer_phone}` : ""}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {linked.estimated_cents > 0
                          ? `Valor estimado no recebimento: ${money(linked.estimated_cents)}`
                          : "Valor estimado: não informado (a conferir na contagem)"}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0"
                      aria-label="Desvincular do recebimento"
                      title="Desvincular (não conclui o recebimento ao registrar)"
                      onClick={() => setLinked(null)}
                    >
                      <Link2Off className="size-4" />
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="flex items-end gap-3">
                <label className="block min-w-0 flex-1 space-y-1 text-sm">
                  <span className="font-medium">Fiscal</span>
                  <Input
                    value={fiscalName}
                    onChange={(event) => setFiscalEdit(event.target.value)}
                    placeholder="Nome do fiscal"
                  />
                </label>
                <div className="pb-2 text-xs text-muted-foreground">
                  Data
                  <div className="text-sm font-medium text-[color:var(--text-primary)]">
                    {new Date().toLocaleDateString("pt-BR")}
                  </div>
                </div>
              </div>

              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Valor das moedas</dt>
                  <dd className="font-medium tabular-nums">{money(result.faceCents)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Acréscimo</dt>
                  <dd className="font-medium tabular-nums text-emerald-700 dark:text-emerald-300">
                    + {money(result.bonusCents)}
                  </dd>
                </div>
              </dl>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                <div className="text-xs uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                  Valor a pagar ao cliente
                </div>
                <div
                  className="mt-1 text-3xl font-semibold tabular-nums text-emerald-900 dark:text-emerald-100"
                  aria-live="polite"
                  data-testid="coin-total"
                >
                  {money(result.totalCents)}
                </div>
                <div className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80">
                  já com os percentuais de acréscimo
                </div>
              </div>

              {/* Só os fiscais usam: como separar as moedas em pacotes para os trocos dos caixas. */}
              <dl className="space-y-1 rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-soft)] px-3 py-2 text-sm">
                {result.bonusByRate.map((group) => (
                  <div key={group.rate} className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">
                      Acréscimo de {percent(group.rate)}
                      <span className="block text-[11px]">sobre {money(group.faceCents)}</span>
                    </dt>
                    <dd className="font-medium tabular-nums text-emerald-700 dark:text-emerald-300">
                      {money(group.bonusCents)}
                    </dd>
                  </div>
                ))}
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Pacotes fechados</dt>
                  <dd className="font-medium tabular-nums">{result.packCount}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Moedas soltas</dt>
                  <dd className="font-medium tabular-nums">{money(result.looseCents)}</dd>
                </div>
              </dl>

              {/* Vindo de um recebimento, o quadro acima já mostra nome e telefone do cliente. */}
              {linked ? null : (
                <div className="space-y-3">
                  <label className="block space-y-1 text-sm">
                    <span className="font-medium">Cliente</span>
                    <Input
                      value={customerName}
                      onChange={(event) => setCustomerName(event.target.value)}
                      placeholder="Nome do cliente (sai na conferência)"
                      autoComplete="off"
                    />
                  </label>
                  <label className="block space-y-1 text-sm">
                    <span className="font-medium">Telefone (opcional)</span>
                    <Input
                      inputMode="tel"
                      value={customerPhone}
                      onChange={(event) => setCustomerPhone(formatPhone(event.target.value))}
                      placeholder="Telefone do cliente"
                      autoComplete="off"
                    />
                  </label>
                  <details
                    open={detailsOpen}
                    onToggle={(event) => setDetailsOpen(event.currentTarget.open)}
                    className="group rounded-xl border border-[color:var(--border-soft)] px-3 py-2"
                  >
                    <summary className="cursor-pointer text-sm text-muted-foreground">
                      Adicionar observação (opcional)
                    </summary>
                    <div className="mt-3">
                      <Input
                        aria-label="Observação"
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                      />
                    </div>
                  </details>
                </div>
              )}

              {!result.allExact ? (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-800 dark:bg-red-500/10 dark:text-red-300">
                  Algum valor não fecha em moedas inteiras. Corrija os campos marcados para registrar.
                </p>
              ) : null}

              <Button
                className="h-11 w-full text-base"
                disabled={
                  result.totalCents <= 0 || editingRates || !result.allExact || createExchange.isPending
                }
                onClick={() => void handleRegister()}
              >
                {createExchange.isPending ? "Registrando..." : "Registrar troca"}
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={printSheet}
                  disabled={result.totalCents <= 0}
                  title="Imprimir a ficha do fiscal (sem o nome do cliente)"
                >
                  <Printer className="size-4" />
                  Ficha do fiscal
                </Button>
                <Button
                  variant="outline"
                  onClick={printCustomerSheet}
                  disabled={result.totalCents <= 0}
                  title="Imprimir a conferência para o cliente"
                >
                  <ClipboardCheck className="size-4" />
                  Conferência do cliente
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void downloadSheet()}
                  disabled={result.totalCents <= 0}
                  title="Baixar um PDF com a ficha do fiscal e a conferência do cliente"
                >
                  <FileDown className="size-4" />
                  PDF (fiscal + cliente)
                </Button>
                <Button variant="outline" onClick={reset} title="Limpar valores">
                  <RotateCcw className="size-4" />
                  Limpar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
            <CardTitle className="text-base">Trocas registradas</CardTitle>
            <Input
              type="date"
              aria-label="Data do histórico de trocas"
              className="w-44"
              value={historyDate}
              onChange={(event) => event.target.value && setHistoryDate(event.target.value)}
            />
          </CardHeader>
          <CardContent className="space-y-3">
            {history.isLoading ? (
              <StateBlock type="loading" title="Carregando trocas" />
            ) : history.isError ? (
              <StateBlock
                type="error"
                title="Não foi possível carregar as trocas"
                description={history.error.message}
              />
            ) : (history.data ?? []).length === 0 ? (
              <StateBlock
                title="Nenhuma troca neste dia"
                description="As trocas registradas aparecem aqui, com o total do dia."
              />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  {[
                    { label: "Trocas", value: String(dayTotals.count) },
                    { label: "Moedas", value: String(dayTotals.coins) },
                    { label: "Valor das moedas", value: money(dayTotals.face) },
                    { label: "Pago (com acréscimo)", value: money(dayTotals.total) },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-lg border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-soft)] px-3 py-1.5"
                    >
                      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {item.label}
                      </div>
                      <div className="text-base font-semibold tabular-nums">{item.value}</div>
                    </div>
                  ))}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[color:var(--border-soft)] text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="py-2 pr-3 font-medium">Horário</th>
                        <th className="px-3 py-2 font-medium">Cliente</th>
                        <th className="px-3 py-2 font-medium">Fiscal</th>
                        <th className="px-3 py-2 text-right font-medium">Moedas</th>
                        <th className="px-3 py-2 text-right font-medium">Valor das moedas</th>
                        <th className="px-3 py-2 text-right font-medium">Acréscimo</th>
                        <th className="py-2 pl-3 text-right font-medium">Pago</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(history.data ?? []).map((item) => (
                        <tr
                          key={item.id}
                          className="border-b border-[color:var(--border-soft)] last:border-0"
                        >
                          <td className="py-2 pr-3 whitespace-nowrap">{formatDateTimeBR(item.created_at)}</td>
                          <td className="px-3 py-2">
                            {item.customer_name || <span className="text-muted-foreground">—</span>}
                            {item.customer_phone ? (
                              <div className="text-xs text-muted-foreground">{item.customer_phone}</div>
                            ) : null}
                            {item.notes ? (
                              <div className="text-xs text-muted-foreground">{item.notes}</div>
                            ) : null}
                          </td>
                          <td className="px-3 py-2">{item.fiscal_name || item.user_profiles?.name || "—"}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{item.coin_count}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{money(item.face_cents)}</td>
                          <td className={cn("px-3 py-2 text-right tabular-nums", "text-emerald-700 dark:text-emerald-300")}>
                            {money(item.bonus_cents)}
                          </td>
                          <td className="py-2 pl-3 text-right font-semibold tabular-nums">
                            {money(item.total_cents)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
