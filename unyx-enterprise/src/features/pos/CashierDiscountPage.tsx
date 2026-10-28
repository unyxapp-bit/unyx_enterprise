import { useEffect, useMemo, useState } from "react"
import { FileDown, Printer, RotateCcw, Save } from "lucide-react"

import { useAuth } from "@/app/providers/auth-context"
import { PageHeader } from "@/components/shared/PageHeader"
import { StateBlock } from "@/components/shared/StateBlock"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Combobox } from "@/components/ui/select"
import {
  calculateDiscount,
  DISCOUNT_REASON_LABEL,
  productLine,
  sanitizeQuantity,
  type CashierDiscountRecord,
  type DiscountReason,
} from "@/features/pos/cashierDiscount"
import {
  buildDiscountHtml,
  buildDiscountPdf,
  type DiscountSlip,
} from "@/features/pos/cashierDiscountPrint"
import { centsToReais, parseMoneyToCents } from "@/features/pos/coinExchange"
import { readStorage, writeStorage } from "@/features/pos/coinStorage"
import { MoneyField } from "@/features/pos/MoneyField"
import { printHtml } from "@/features/frontstore/formPrint"
import {
  useCashierDiscounts,
  useCreateCashierDiscount,
  useEmployees,
  useOperationalPosts,
  useProducts,
} from "@/hooks/useUnyxData"
import { formatCurrency, todayISO } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/store/useAppStore"
import type { Product } from "@/types/domain"

const money = (cents: number) => formatCurrency(centsToReais(cents))
const minuteStartIso = () => new Date(Math.floor(Date.now() / 60_000) * 60_000).toISOString()
const centsToText = (cents: number) => (cents / 100).toFixed(2).replace(".", ",")

interface DiscountDraft {
  product: string
  productId: string | null
  code: string
  quantity: string
  system: string
  sale: string
  reason: DiscountReason
  description: string
  pdv: string
  operator: string
}

function loadDraft(key: string): DiscountDraft {
  const stored = readStorage(key) as Partial<DiscountDraft> | null
  const text = (value: unknown, fallback = "") => (typeof value === "string" ? value : fallback)
  return {
    product: text(stored?.product),
    productId: typeof stored?.productId === "string" ? stored.productId : null,
    code: text(stored?.code),
    quantity: text(stored?.quantity, "1") || "1",
    system: text(stored?.system),
    sale: text(stored?.sale),
    reason: stored?.reason === "outro" ? "outro" : "preco_errado",
    description: text(stored?.description),
    pdv: text(stored?.pdv),
    operator: text(stored?.operator),
  }
}

const textareaClass =
  "min-h-20 w-full resize-y rounded-2xl border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"

const timeBR = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false }).format(
    new Date(iso)
  )

/**
 * Descontos no caixa: o fiscal informa o produto, o preço do sistema e o preço de venda; o app
 * calcula o desconto (diferença × quantidade), registra e imprime a ficha igual à de papel.
 */
export function CashierDiscountPage() {
  const { profile } = useAuth()
  const selectedBranchId = useAppStore((state) => state.selectedBranchId)
  const createDiscount = useCreateCashierDiscount()
  const products = useProducts()
  const posts = useOperationalPosts()
  const employees = useEmployees()

  const draftKey = `unyx-discount-draft:${profile?.id ?? "anon"}`
  // O mesmo nome de fiscal vale para as telas de moedas e de descontos.
  const fiscalKey = `unyx-coin-exchange-fiscal:${profile?.id ?? "anon"}`
  const [draft] = useState(() => loadDraft(draftKey))
  const [product, setProduct] = useState(draft.product)
  const [productId, setProductId] = useState<string | null>(draft.productId)
  const [code, setCode] = useState(draft.code)
  const [quantity, setQuantity] = useState(draft.quantity)
  const [system, setSystem] = useState(draft.system)
  const [sale, setSale] = useState(draft.sale)
  const [reason, setReason] = useState<DiscountReason>(draft.reason)
  const [description, setDescription] = useState(draft.description)
  const [pdv, setPdv] = useState(draft.pdv)
  const [operator, setOperator] = useState(draft.operator)
  const [fiscalEdit, setFiscalEdit] = useState<string | null>(() => {
    const stored = readStorage(fiscalKey)
    return typeof stored === "string" ? stored : null
  })
  const [historyDate, setHistoryDate] = useState(todayISO())
  // Hora da prévia em minutos, atualizada por um relógio: um valor que muda a cada milissegundo
  // recriaria o iframe a cada atualização da tela, roubando o foco dos campos.
  const [previewTime, setPreviewTime] = useState(minuteStartIso)
  useEffect(() => {
    const timer = window.setInterval(() => setPreviewTime(minuteStartIso()), 15_000)
    return () => window.clearInterval(timer)
  }, [])

  const fiscalName = fiscalEdit ?? profile?.name ?? ""
  const catalog = useMemo(() => products.data ?? [], [products.data])
  const suggestions = useMemo(() => catalog.map((item) => item.name), [catalog])
  // Sugestões do cadastro (postos ativos e colaboradores ativos); o campo também aceita texto livre.
  const pdvSuggestions = useMemo(
    () => (posts.data ?? []).filter((post) => post.active).map((post) => post.name),
    [posts.data]
  )
  const operatorSuggestions = useMemo(
    () => (employees.data ?? []).filter((employee) => employee.active).map((employee) => employee.name),
    [employees.data]
  )
  const history = useCashierDiscounts(historyDate)

  const systemCents = parseMoneyToCents(system)
  const saleCents = parseMoneyToCents(sale)
  const qty = sanitizeQuantity(quantity)
  const calc = calculateDiscount({ systemCents, saleCents, quantity: qty })
  const descriptionMissing = reason === "outro" && description.trim().length < 3
  const canSubmit =
    product.trim().length >= 2 && calc.valid && fiscalName.trim() !== "" && !descriptionMissing

  useEffect(() => {
    const empty =
      product.trim() === "" &&
      code.trim() === "" &&
      system.trim() === "" &&
      sale.trim() === "" &&
      description.trim() === "" &&
      pdv.trim() === "" &&
      operator.trim() === "" &&
      quantity === "1" &&
      reason === "preco_errado"
    writeStorage(
      draftKey,
      empty
        ? null
        : { product, productId, code, quantity, system, sale, reason, description, pdv, operator }
    )
  }, [code, description, draftKey, operator, pdv, product, productId, quantity, reason, sale, system])

  useEffect(() => {
    writeStorage(fiscalKey, fiscalEdit)
  }, [fiscalEdit, fiscalKey])

  const applyProduct = (item: Product) => {
    setProduct(item.name)
    setProductId(item.id)
    setCode(item.sku || item.barcode || "")
    setSystem(centsToText(Math.round(item.price * 100)))
  }

  // Escolher um produto do catálogo (pelo nome ou pelo código) já traz o código e o preço do sistema.
  const handleProductChange = (value: string) => {
    setProduct(value)
    setProductId(null)
    const match = catalog.find((item) => item.name.toLowerCase() === value.trim().toLowerCase())
    if (match) applyProduct(match)
  }

  const handleCodeChange = (value: string) => {
    setCode(value)
    const typed = value.trim()
    if (typed.length < 3 || product.trim() !== "") return
    const match = catalog.find((item) => item.sku === typed || item.barcode === typed)
    if (match) applyProduct(match)
  }

  const reset = () => {
    setProduct("")
    setProductId(null)
    setCode("")
    setQuantity("1")
    setSystem("")
    setSale("")
    setReason("preco_errado")
    setDescription("")
    setPdv("")
    setOperator("")
  }

  const slipPreview: DiscountSlip = {
    product_name: product || "Produto",
    product_code: code,
    quantity: qty,
    system_price_cents: systemCents,
    sale_price_cents: saleCents,
    discount_cents: calc.totalCents,
    reason,
    reason_description: description,
    fiscal_name: fiscalName,
    pdv,
    operator_name: operator,
    created_at: previewTime,
  }

  const downloadPdf = async (slip: DiscountSlip, name: string) => {
    const { toast } = await import("sonner")
    try {
      const blob = await buildDiscountPdf(slip)
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = name
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
    } catch {
      toast.error("Não foi possível gerar o PDF da ficha.")
    }
  }

  const register = async (thenPrint: boolean) => {
    if (!canSubmit) return
    try {
      const saved = await createDiscount.mutateAsync({
        id: crypto.randomUUID(),
        branch_id: selectedBranchId,
        product_id: productId,
        product_name: productLine(product, 1),
        product_code: code,
        quantity: qty,
        system_price_cents: systemCents,
        sale_price_cents: saleCents,
        discount_cents: calc.totalCents,
        reason,
        reason_description: description,
        fiscal_name: fiscalName,
        pdv,
        operator_name: operator,
      })
      reset()
      if (thenPrint) printHtml(buildDiscountHtml(saved))
    } catch {
      // O hook já mostra o erro em toast.
    }
  }

  const dayTotals = useMemo(() => {
    const list = history.data ?? []
    return {
      count: list.length,
      total: list.reduce((sum, item) => sum + item.discount_cents, 0),
      wrongPrice: list.filter((item) => item.reason === "preco_errado").length,
    }
  }, [history.data])

  return (
    <div>
      <PageHeader
        large
        title="Descontos no caixa"
        description="Informe o produto e os preços: o app calcula o desconto, registra e imprime a ficha."
      />

      <div className="space-y-5 p-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Dados do desconto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px_90px]">
                <label className="block space-y-1 text-sm">
                  <span className="font-medium">Produto</span>
                  <Combobox
                    value={product}
                    onValueChange={handleProductChange}
                    suggestions={suggestions}
                    placeholder="Descrição do produto"
                  />
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="font-medium">Cód. produto</span>
                  <Input
                    value={code}
                    onChange={(event) => handleCodeChange(event.target.value)}
                    placeholder="Código"
                    inputMode="numeric"
                    autoComplete="off"
                  />
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="font-medium">Qtd.</span>
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                    aria-label="Quantidade"
                  />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1 text-sm">
                  <span className="font-medium">Preço no sistema (unitário)</span>
                  <MoneyField
                    value={system}
                    onChange={setSystem}
                    ariaLabel="Preço no sistema"
                  />
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="font-medium">Preço de venda (unitário)</span>
                  <MoneyField
                    value={sale}
                    onChange={setSale}
                    ariaLabel="Preço de venda"
                    invalid={calc.saleAboveSystem}
                  />
                </label>
              </div>
              {calc.saleAboveSystem ? (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-800 dark:bg-red-500/10 dark:text-red-300">
                  O preço de venda está acima do preço do sistema: isso não é desconto. Confira os valores.
                </p>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1 text-sm">
                  <span className="font-medium">Caixa (PDV)</span>
                  <Combobox
                    value={pdv}
                    onValueChange={setPdv}
                    suggestions={pdvSuggestions}
                    placeholder="Ex.: Caixa 108"
                  />
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="font-medium">Operador (OP)</span>
                  <Combobox
                    value={operator}
                    onValueChange={setOperator}
                    suggestions={operatorSuggestions}
                    placeholder="Nome do operador"
                  />
                </label>
              </div>

              <div className="space-y-1.5 text-sm">
                <span className="font-medium">Motivo</span>
                <div className="flex gap-2">
                  {(Object.keys(DISCOUNT_REASON_LABEL) as DiscountReason[]).map((key) => (
                    <Button
                      key={key}
                      type="button"
                      variant={reason === key ? "default" : "outline"}
                      aria-pressed={reason === key}
                      className="rounded-full"
                      onClick={() => setReason(key)}
                    >
                      {DISCOUNT_REASON_LABEL[key]}
                    </Button>
                  ))}
                </div>
              </div>

              <label className="block space-y-1 text-sm">
                <span className="font-medium">
                  Descrição {reason === "outro" ? "(obrigatória)" : "(opcional)"}
                </span>
                <textarea
                  className={cn(textareaClass, descriptionMissing && description !== "" && "border-destructive")}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder={
                    reason === "outro" ? "Explique o motivo do desconto" : "Ex.: etiqueta com preço antigo"
                  }
                />
              </label>

              <label className="block max-w-sm space-y-1 text-sm">
                <span className="font-medium">Fiscal</span>
                <Input
                  value={fiscalName}
                  onChange={(event) => setFiscalEdit(event.target.value)}
                  placeholder="Nome do fiscal"
                />
              </label>
            </CardContent>
          </Card>

          <Card className="h-fit lg:sticky lg:top-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Ficha de desconto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className={cn(
                  "rounded-2xl border p-4",
                  calc.valid
                    ? "border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10"
                    : "border-[color:var(--border-soft)] bg-[color:var(--bg-surface-soft)]"
                )}
              >
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Desconto</div>
                <div
                  className="mt-1 text-3xl font-semibold tabular-nums text-[color:var(--text-primary)]"
                  data-testid="discount-total"
                  aria-live="polite"
                >
                  {money(calc.totalCents)}
                </div>
                {calc.valid ? (
                  <div className="text-xs text-muted-foreground">
                    {money(calc.unitCents)} de diferença{qty > 1 ? ` × ${qty} unidades` : ""}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">
                    Informe o preço do sistema e um preço de venda menor.
                  </div>
                )}
              </div>

              <iframe
                title="Prévia da ficha de desconto"
                srcDoc={buildDiscountHtml(slipPreview)}
                className="h-[520px] w-full rounded-xl border border-[color:var(--border-soft)] bg-white"
              />

              <Button
                className="h-11 w-full text-base"
                disabled={!canSubmit || createDiscount.isPending}
                onClick={() => void register(true)}
              >
                <Printer className="size-4" />
                {createDiscount.isPending ? "Registrando..." : "Registrar e imprimir ficha"}
              </Button>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  disabled={!canSubmit || createDiscount.isPending}
                  onClick={() => void register(false)}
                >
                  <Save className="size-4" />
                  Registrar
                </Button>
                <Button
                  variant="outline"
                  disabled={!calc.valid}
                  title="Baixar a ficha em PDF sem registrar"
                  onClick={() => void downloadPdf(slipPreview, "desconto.pdf")}
                >
                  <FileDown className="size-4" />
                  PDF
                </Button>
                <Button variant="outline" onClick={reset}>
                  <RotateCcw className="size-4" />
                  Limpar
                </Button>
              </div>
              {descriptionMissing ? (
                <p className="text-xs text-muted-foreground">
                  Para &ldquo;Outro motivo&rdquo; a descrição é obrigatória.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
            <CardTitle className="text-base">Descontos registrados</CardTitle>
            <Input
              type="date"
              aria-label="Data do histórico de descontos"
              className="w-44"
              value={historyDate}
              onChange={(event) => event.target.value && setHistoryDate(event.target.value)}
            />
          </CardHeader>
          <CardContent className="space-y-3">
            {history.isLoading ? (
              <StateBlock type="loading" title="Carregando descontos" />
            ) : history.isError ? (
              <StateBlock
                type="error"
                title="Não foi possível carregar os descontos"
                description={history.error.message}
              />
            ) : (history.data ?? []).length === 0 ? (
              <StateBlock
                title="Nenhum desconto neste dia"
                description="Os descontos registrados aparecem aqui, com o total do dia."
              />
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Descontos", value: String(dayTotals.count) },
                    { label: "Preço errado", value: String(dayTotals.wrongPrice) },
                    { label: "Total concedido", value: money(dayTotals.total) },
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
                        <th className="py-2 pr-3 font-medium">Hora</th>
                        <th className="px-3 py-2 font-medium">Produto</th>
                        <th className="px-3 py-2 text-right font-medium">Sistema</th>
                        <th className="px-3 py-2 text-right font-medium">Venda</th>
                        <th className="px-3 py-2 text-right font-medium">Desconto</th>
                        <th className="px-3 py-2 font-medium">Caixa / Operador</th>
                        <th className="px-3 py-2 font-medium">Motivo</th>
                        <th className="px-3 py-2 font-medium">Fiscal</th>
                        <th className="py-2 pl-3 text-right font-medium">Ficha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(history.data ?? []).map((item) => (
                        <HistoryRow key={item.id} item={item} onPdf={downloadPdf} />
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

function HistoryRow({
  item,
  onPdf,
}: {
  item: CashierDiscountRecord
  onPdf: (slip: DiscountSlip, name: string) => Promise<void>
}) {
  return (
    <tr className="border-b border-[color:var(--border-soft)] last:border-0">
      <td className="whitespace-nowrap py-2 pr-3 tabular-nums">{timeBR(item.created_at)}</td>
      <td className="px-3 py-2">
        <div className="font-medium text-[color:var(--text-primary)]">
          {productLine(item.product_name, item.quantity)}
        </div>
        {item.product_code ? (
          <div className="text-xs text-muted-foreground">Cód. {item.product_code}</div>
        ) : null}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{money(item.system_price_cents)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{money(item.sale_price_cents)}</td>
      <td className="px-3 py-2 text-right font-semibold tabular-nums">{money(item.discount_cents)}</td>
      <td className="px-3 py-2">
        <div className="font-medium text-[color:var(--text-primary)]">{item.pdv || "—"}</div>
        <div className="text-xs text-muted-foreground">{item.operator_name || "—"}</div>
      </td>
      <td className="px-3 py-2">
        <Badge variant="outline" className="rounded-full">
          {DISCOUNT_REASON_LABEL[item.reason]}
        </Badge>
        {item.reason_description ? (
          <div className="max-w-52 truncate text-xs text-muted-foreground" title={item.reason_description}>
            {item.reason_description}
          </div>
        ) : null}
      </td>
      <td className="px-3 py-2">{item.fiscal_name || item.user_profiles?.name || "—"}</td>
      <td className="py-2 pl-3">
        <div className="flex items-center justify-end gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="size-8"
            aria-label={`Imprimir ficha de ${item.product_name}`}
            title="Imprimir a ficha"
            onClick={() => printHtml(buildDiscountHtml(item))}
          >
            <Printer className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-8"
            aria-label={`Baixar PDF da ficha de ${item.product_name}`}
            title="Baixar em PDF"
            onClick={() => void onPdf(item, `desconto_${item.id.slice(0, 8)}.pdf`)}
          >
            <FileDown className="size-4" />
          </Button>
        </div>
      </td>
    </tr>
  )
}
