import { useEffect, useMemo, useState } from "react"
import { ArrowRightLeft, CheckCircle2, FileDown, Printer, RotateCcw, Save, XCircle } from "lucide-react"
import { toast } from "sonner"

import { useAuth } from "@/app/providers/auth-context"
import { StateBlock } from "@/components/shared/StateBlock"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { printHtml } from "@/features/frontstore/formPrint"
import {
  COIN_DEPOSIT_STATUS_LABEL,
  depositCode,
  ESTIMATE_UNKNOWN_LABEL,
  formatDateTimeFull,
  formatPhone,
  localInputToIso,
  toLocalInputValue,
  type CoinDepositRecord,
} from "@/features/pos/coinDeposit"
import { buildCoinDepositHtml, buildCoinDepositPdf } from "@/features/pos/coinDepositPrint"
import { centsToReais, parseMoneyToCents } from "@/features/pos/coinExchange"
import { readStorage, writeStorage } from "@/features/pos/coinStorage"
import {
  useCoinDeposits,
  useCreateCoinDeposit,
  useUpdateCoinDepositStatus,
} from "@/hooks/useUnyxData"
import { formatCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/store/useAppStore"

const money = (cents: number) => formatCurrency(centsToReais(cents))

interface DepositDraft {
  customer: string
  phone: string
  leftAt: string
  estimated: string
  /** O cliente não sabe o valor estimado das moedas. */
  unknown: boolean
  notes: string
}

function loadDraft(key: string): DepositDraft {
  const stored = readStorage(key) as Partial<DepositDraft> | null
  const text = (value: unknown) => (typeof value === "string" ? value : "")
  return {
    customer: text(stored?.customer),
    phone: text(stored?.phone),
    leftAt: text(stored?.leftAt) || toLocalInputValue(new Date()),
    estimated: text(stored?.estimated),
    unknown: stored?.unknown === true,
    notes: text(stored?.notes),
  }
}

const STATUS_TONE: Record<CoinDepositRecord["status"], string> = {
  pendente:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
  concluida:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300",
  cancelada:
    "border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-300",
}

/**
 * Moedas que o cliente deixa para trocar depois: dados do cliente, hora, valor estimado e o
 * fiscal que recebeu. Imprime (ou baixa em PDF) um comprovante com a via do cliente e a do
 * fiscal no mesmo arquivo.
 */
export function CoinDepositsPanel({
  onStartExchange,
}: {
  /** Abre a aba de troca com o nome e o telefone deste cliente já preenchidos. */
  onStartExchange: (deposit: CoinDepositRecord) => void
}) {
  const { profile } = useAuth()
  const selectedBranchId = useAppStore((state) => state.selectedBranchId)
  const createDeposit = useCreateCoinDeposit()
  const updateStatus = useUpdateCoinDepositStatus()

  const draftKey = `unyx-coin-deposit-draft:${profile?.id ?? "anon"}`
  const fiscalKey = `unyx-coin-exchange-fiscal:${profile?.id ?? "anon"}`
  const [draft] = useState(() => loadDraft(draftKey))
  const [customer, setCustomer] = useState(draft.customer)
  const [phone, setPhone] = useState(draft.phone)
  const [leftAt, setLeftAt] = useState(draft.leftAt)
  const [estimated, setEstimated] = useState(draft.estimated)
  const [unknownValue, setUnknownValue] = useState(draft.unknown)
  const [notes, setNotes] = useState(draft.notes)
  const [fiscalEdit, setFiscalEdit] = useState<string | null>(() => {
    const stored = readStorage(fiscalKey)
    return typeof stored === "string" ? stored : null
  })
  const [onlyPending, setOnlyPending] = useState(true)

  const fiscalName = fiscalEdit ?? profile?.name ?? ""
  // Sem valor (cliente não sabe) grava 0: a ficha sai "A conferir na contagem".
  const estimatedCents = unknownValue ? 0 : parseMoneyToCents(estimated)
  const leftAtIso = localInputToIso(leftAt)
  // É preciso informar o valor ou marcar que o cliente não sabe (evita esquecer o campo).
  const canSubmit =
    customer.trim().length >= 2 &&
    leftAtIso !== null &&
    fiscalName.trim() !== "" &&
    (unknownValue || estimatedCents > 0)

  const deposits = useCoinDeposits(onlyPending)

  useEffect(() => {
    const empty =
      customer.trim() === "" &&
      phone === "" &&
      estimated.trim() === "" &&
      !unknownValue &&
      notes.trim() === ""
    writeStorage(draftKey, empty ? null : { customer, phone, leftAt, estimated, unknown: unknownValue, notes })
  }, [customer, draftKey, estimated, leftAt, notes, phone, unknownValue])

  useEffect(() => {
    writeStorage(fiscalKey, fiscalEdit)
  }, [fiscalEdit, fiscalKey])

  // Total estimado dos que aguardam troca; os sem valor informado só são contados à parte.
  const pending = useMemo(() => {
    const waiting = (deposits.data ?? []).filter((item) => item.status === "pendente")
    return {
      total: waiting.reduce((sum, item) => sum + item.estimated_cents, 0),
      unknown: waiting.filter((item) => item.estimated_cents <= 0).length,
      count: waiting.length,
    }
  }, [deposits.data])

  const reset = () => {
    setCustomer("")
    setPhone("")
    setLeftAt(toLocalInputValue(new Date()))
    setEstimated("")
    setUnknownValue(false)
    setNotes("")
  }

  const downloadPdf = async (deposit: CoinDepositRecord) => {
    try {
      const blob = await buildCoinDepositPdf(deposit)
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `moedas_deixadas_${depositCode(deposit.id)}.pdf`
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
    } catch {
      toast.error("Não foi possível gerar o PDF do comprovante.")
    }
  }

  const register = async (thenPrint: boolean) => {
    if (!canSubmit || !leftAtIso) return
    try {
      const saved = await createDeposit.mutateAsync({
        id: crypto.randomUUID(),
        branch_id: selectedBranchId,
        customer_name: customer,
        customer_phone: phone,
        left_at: leftAtIso,
        estimated_cents: estimatedCents,
        fiscal_name: fiscalName,
        notes,
      })
      reset()
      if (thenPrint) printHtml(buildCoinDepositHtml(saved))
    } catch {
      // O hook já mostra o erro em toast.
    }
  }

  const confirmCancel = (deposit: CoinDepositRecord) => {
    if (!window.confirm(`Cancelar o recebimento de ${deposit.customer_name}? As moedas voltam ao cliente.`)) {
      return
    }
    updateStatus.mutate({ id: deposit.id, status: "cancelada" })
  }

  return (
    <div className="space-y-5 p-6">
      <div className="grid gap-4 lg:grid-cols-[420px_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Receber moedas para troca</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Cliente</span>
              <Input
                value={customer}
                onChange={(event) => setCustomer(event.target.value)}
                placeholder="Nome do cliente"
                autoComplete="off"
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Telefone</span>
              <Input
                inputMode="tel"
                value={phone}
                onChange={(event) => setPhone(formatPhone(event.target.value))}
                placeholder="(00) 00000-0000"
                autoComplete="off"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1 text-sm">
                <span className="font-medium">Deixou em</span>
                <Input
                  type="datetime-local"
                  value={leftAt}
                  onChange={(event) => setLeftAt(event.target.value)}
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="font-medium">Valor estimado</span>
                <div
                  className={cn(
                    "flex h-8 items-center gap-1 rounded-2xl border border-input bg-transparent px-3 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30",
                    unknownValue && "opacity-50"
                  )}
                >
                  <span className="text-xs text-muted-foreground">R$</span>
                  <input
                    inputMode="decimal"
                    aria-label="Valor estimado das moedas"
                    className="min-w-0 flex-1 bg-transparent text-sm tabular-nums outline-none placeholder:text-muted-foreground"
                    placeholder="0,00"
                    value={unknownValue ? "" : estimated}
                    disabled={unknownValue}
                    onChange={(event) => setEstimated(event.target.value)}
                  />
                </div>
              </label>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-[color:var(--primary)]"
                checked={unknownValue}
                onChange={(event) => {
                  setUnknownValue(event.target.checked)
                  if (event.target.checked) setEstimated("")
                }}
              />
              O cliente não sabe o valor estimado
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Fiscal que recebeu</span>
              <Input
                value={fiscalName}
                onChange={(event) => setFiscalEdit(event.target.value)}
                placeholder="Nome do fiscal"
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Observação (opcional)</span>
              <Input value={notes} onChange={(event) => setNotes(event.target.value)} />
            </label>

            <Button
              className="h-11 w-full text-base"
              disabled={!canSubmit || createDeposit.isPending}
              onClick={() => void register(true)}
            >
              <Printer className="size-4" />
              {createDeposit.isPending ? "Registrando..." : "Registrar e imprimir vias"}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                disabled={!canSubmit || createDeposit.isPending}
                onClick={() => void register(false)}
              >
                <Save className="size-4" />
                Só registrar
              </Button>
              <Button variant="outline" onClick={reset}>
                <RotateCcw className="size-4" />
                Limpar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Informe nome e fiscal, e o valor estimado ou marque que o cliente não sabe: a ficha sai
              com &ldquo;{ESTIMATE_UNKNOWN_LABEL}&rdquo;. O comprovante leva a via do cliente e a via do
              fiscal na mesma folha.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-2">
            <CardTitle className="text-base">Moedas deixadas</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={onlyPending ? "default" : "outline"}
                className="h-8 rounded-full px-3 text-xs"
                onClick={() => setOnlyPending(true)}
              >
                Aguardando troca
              </Button>
              <Button
                size="sm"
                variant={onlyPending ? "outline" : "default"}
                className="h-8 rounded-full px-3 text-xs"
                onClick={() => setOnlyPending(false)}
              >
                Todas
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {deposits.isLoading ? (
              <StateBlock type="loading" title="Carregando recebimentos" />
            ) : deposits.isError ? (
              <StateBlock
                type="error"
                title="Não foi possível carregar os recebimentos"
                description={deposits.error.message}
              />
            ) : (deposits.data ?? []).length === 0 ? (
              <StateBlock
                title={onlyPending ? "Nenhuma troca aguardando" : "Nenhum recebimento registrado"}
                description="Os recebimentos aparecem aqui assim que forem registrados."
              />
            ) : (
              <>
                {pending.count > 0 ? (
                  <div className="rounded-lg border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-soft)] px-3 py-1.5 text-sm">
                    Aguardando troca: {pending.count}{" "}
                    {pending.count === 1 ? "cliente" : "clientes"}
                    {pending.total > 0 ? (
                      <>
                        {" · "}
                        <span className="font-semibold tabular-nums">{money(pending.total)}</span> em valor
                        estimado
                      </>
                    ) : null}
                    {pending.unknown > 0 ? (
                      <span className="text-muted-foreground">
                        {" "}
                        ({pending.unknown} sem valor informado)
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[color:var(--border-soft)] text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="py-2 pr-3 font-medium">Código</th>
                        <th className="px-3 py-2 font-medium">Cliente</th>
                        <th className="px-3 py-2 font-medium">Deixou em</th>
                        <th className="px-3 py-2 text-right font-medium">Estimado</th>
                        <th className="px-3 py-2 font-medium">Fiscal</th>
                        <th className="px-3 py-2 font-medium">Situação</th>
                        <th className="py-2 pl-3 text-right font-medium">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(deposits.data ?? []).map((item) => (
                        <tr
                          key={item.id}
                          className="border-b border-[color:var(--border-soft)] last:border-0"
                        >
                          <td className="py-2 pr-3 font-mono text-xs tracking-wider">{depositCode(item.id)}</td>
                          <td className="px-3 py-2">
                            <div className="font-medium text-[color:var(--text-primary)]">{item.customer_name}</div>
                            {item.customer_phone ? (
                              <div className="text-xs text-muted-foreground">{item.customer_phone}</div>
                            ) : null}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2">{formatDateTimeFull(item.left_at)}</td>
                          <td className="px-3 py-2 text-right font-semibold tabular-nums">
                            {item.estimated_cents > 0 ? (
                              money(item.estimated_cents)
                            ) : (
                              <span className="text-xs font-medium text-muted-foreground">A conferir</span>
                            )}
                          </td>
                          <td className="px-3 py-2">{item.fiscal_name || item.user_profiles?.name || "—"}</td>
                          <td className="px-3 py-2">
                            <Badge variant="outline" className={cn("rounded-full", STATUS_TONE[item.status])}>
                              {COIN_DEPOSIT_STATUS_LABEL[item.status]}
                            </Badge>
                          </td>
                          <td className="py-2 pl-3">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-8"
                                aria-label={`Imprimir comprovante de ${item.customer_name}`}
                                title="Imprimir as duas vias"
                                onClick={() => printHtml(buildCoinDepositHtml(item))}
                              >
                                <Printer className="size-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-8"
                                aria-label={`Baixar PDF de ${item.customer_name}`}
                                title="Baixar em PDF"
                                onClick={() => void downloadPdf(item)}
                              >
                                <FileDown className="size-4" />
                              </Button>
                              {item.status === "pendente" ? (
                                <>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="size-8 text-primary"
                                    aria-label={`Fazer a troca de ${item.customer_name}`}
                                    title="Fazer a troca (abre com o cliente preenchido)"
                                    onClick={() => onStartExchange(item)}
                                  >
                                    <ArrowRightLeft className="size-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="size-8 text-emerald-600"
                                    aria-label={`Marcar troca de ${item.customer_name} como concluída`}
                                    title="Troca concluída"
                                    disabled={updateStatus.isPending}
                                    onClick={() => updateStatus.mutate({ id: item.id, status: "concluida" })}
                                  >
                                    <CheckCircle2 className="size-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="size-8 text-red-600"
                                    aria-label={`Cancelar recebimento de ${item.customer_name}`}
                                    title="Cancelar recebimento"
                                    disabled={updateStatus.isPending}
                                    onClick={() => confirmCancel(item)}
                                  >
                                    <XCircle className="size-4" />
                                  </Button>
                                </>
                              ) : null}
                            </div>
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
