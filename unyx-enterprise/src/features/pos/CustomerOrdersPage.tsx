import { useEffect, useMemo, useState } from "react"
import {
  Ban,
  FileDown,
  PackageCheck,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { useAuth } from "@/app/providers/auth-context"
import { PageHeader } from "@/components/shared/PageHeader"
import { StateBlock } from "@/components/shared/StateBlock"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { printHtml } from "@/features/frontstore/formPrint"
import {
  formatDateTimeFull,
  formatPhone,
  localInputToIso,
  toLocalInputValue,
} from "@/features/pos/coinDeposit"
import { centsToReais, parseMoneyToCents } from "@/features/pos/coinExchange"
import { readStorage, writeStorage } from "@/features/pos/coinStorage"
import {
  CUSTOMER_ORDER_STATUS_LABEL,
  ORDER_UNITS,
  cleanItems,
  compareOrders,
  formatPickup,
  isOrderOpen,
  itemLine,
  orderCode,
  orderMatches,
  pickupState,
  remainingCents,
  sanitizeUnit,
  type CustomerOrderRecord,
  type CustomerOrderStatus,
  type OrderUnit,
  type PickupState,
} from "@/features/pos/customerOrder"
import { buildCustomerOrderHtml, buildCustomerOrderPdf } from "@/features/pos/customerOrderPrint"
import { MoneyField } from "@/features/pos/MoneyField"
import {
  useCreateCustomerOrder,
  useCustomerOrders,
  useUpdateCustomerOrder,
  useUpdateCustomerOrderStatus,
} from "@/hooks/useUnyxData"
import { formatCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/store/useAppStore"

const money = (cents: number) => formatCurrency(centsToReais(cents))
const centsToText = (cents: number) => (cents / 100).toFixed(2).replace(".", ",")

interface ItemRow {
  key: string
  quantity: string
  unit: OrderUnit
  description: string
}

const newRow = (quantity = "", description = "", unit: OrderUnit = "un"): ItemRow => ({
  key: crypto.randomUUID(),
  quantity,
  unit,
  description,
})

interface OrderDraft {
  customer: string
  phone: string
  orderedAt: string
  pickupAt: string
  items: Array<{ quantity: string; unit: OrderUnit; description: string }>
  total: string
  paid: string
  notes: string
}

function loadDraft(key: string): OrderDraft {
  const stored = readStorage(key) as Partial<OrderDraft> | null
  const text = (value: unknown) => (typeof value === "string" ? value : "")
  const items = Array.isArray(stored?.items)
    ? stored.items.map((item) => ({
        quantity: text(item?.quantity),
        unit: sanitizeUnit(item?.unit),
        description: text(item?.description),
      }))
    : []
  return {
    customer: text(stored?.customer),
    phone: text(stored?.phone),
    orderedAt: text(stored?.orderedAt) || toLocalInputValue(new Date()),
    pickupAt: text(stored?.pickupAt),
    items,
    total: text(stored?.total),
    paid: text(stored?.paid),
    notes: text(stored?.notes),
  }
}

const textareaClass =
  "min-h-20 w-full resize-y rounded-2xl border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"

const STATUS_TONE: Record<CustomerOrderStatus, string> = {
  pendente:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
  pronta:
    "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300",
  retirada:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300",
  cancelada:
    "border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-300",
}

const PICKUP_BADGE: Partial<Record<PickupState, { label: string; className: string }>> = {
  atrasada: {
    label: "Atrasada",
    className: "border-red-300 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300",
  },
  hoje: {
    label: "Hoje",
    className:
      "border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-500/40 dark:bg-orange-500/10 dark:text-orange-300",
  },
  amanha: {
    label: "Amanhã",
    className: "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300",
  },
}

type Filter = "abertas" | "hoje" | "retiradas" | "canceladas" | "todas"

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "abertas", label: "Em aberto" },
  { id: "hoje", label: "Retirada hoje" },
  { id: "retiradas", label: "Retiradas" },
  { id: "canceladas", label: "Canceladas" },
  { id: "todas", label: "Todas" },
]

const sameDay = (iso: string, now: Date) => {
  const date = new Date(iso)
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )
}

/**
 * Encomendas de clientes: o atendente anota os dados do cliente, o que foi pedido, quando o pedido
 * foi feito e quando será retirado. Imprime (ou baixa em PDF) o comprovante com a via do cliente
 * e a via da produção no mesmo arquivo.
 */
export function CustomerOrdersPage() {
  const { profile } = useAuth()
  const selectedBranchId = useAppStore((state) => state.selectedBranchId)
  const createOrder = useCreateCustomerOrder()
  const updateOrder = useUpdateCustomerOrder()
  const updateStatus = useUpdateCustomerOrderStatus()
  const orders = useCustomerOrders()

  const draftKey = `unyx-customer-order-draft:${profile?.id ?? "anon"}`
  // O mesmo nome vale para as telas de moedas, descontos e encomendas.
  const attendantKey = `unyx-coin-exchange-fiscal:${profile?.id ?? "anon"}`
  const [draft] = useState(() => loadDraft(draftKey))
  const [customer, setCustomer] = useState(draft.customer)
  const [phone, setPhone] = useState(draft.phone)
  const [orderedAt, setOrderedAt] = useState(draft.orderedAt)
  const [pickupAt, setPickupAt] = useState(draft.pickupAt)
  const [items, setItems] = useState<ItemRow[]>(() =>
    draft.items.length > 0
      ? draft.items.map((item) => newRow(item.quantity, item.description, item.unit))
      : [newRow()]
  )
  const [total, setTotal] = useState(draft.total)
  const [paid, setPaid] = useState(draft.paid)
  const [notes, setNotes] = useState(draft.notes)
  const [attendantEdit, setAttendantEdit] = useState<string | null>(() => {
    const stored = readStorage(attendantKey)
    return typeof stored === "string" ? stored : null
  })
  const [editing, setEditing] = useState<CustomerOrderRecord | null>(null)
  const [filter, setFilter] = useState<Filter>("abertas")
  const [search, setSearch] = useState("")
  // Relógio da tela: marca "atrasada" e "hoje" sem recarregar a lista.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const attendant = attendantEdit ?? profile?.name ?? ""
  const cleaned = useMemo(() => cleanItems(items), [items])
  const orderedIso = localInputToIso(orderedAt)
  const pickupIso = localInputToIso(pickupAt)
  const totalCents = parseMoneyToCents(total)
  const paidCents = parseMoneyToCents(paid)
  const pickupBeforeOrder =
    orderedIso !== null && pickupIso !== null && new Date(pickupIso).getTime() < new Date(orderedIso).getTime()
  const paidAboveTotal = totalCents > 0 && paidCents > totalCents
  const remaining = remainingCents(totalCents, paidCents)
  const canSubmit =
    customer.trim().length >= 2 &&
    cleaned.length > 0 &&
    orderedIso !== null &&
    pickupIso !== null &&
    !pickupBeforeOrder &&
    !paidAboveTotal &&
    attendant.trim() !== ""
  const saving = createOrder.isPending || updateOrder.isPending

  // Rascunho do formulário: sobrevive a atualizar a tela. Não grava enquanto edita uma encomenda.
  useEffect(() => {
    if (editing) return
    const empty =
      customer.trim() === "" &&
      phone === "" &&
      pickupAt === "" &&
      cleaned.length === 0 &&
      total.trim() === "" &&
      paid.trim() === "" &&
      notes.trim() === ""
    writeStorage(
      draftKey,
      empty
        ? null
        : {
            customer,
            phone,
            orderedAt,
            pickupAt,
            items: items.map(({ quantity, unit, description }) => ({ quantity, unit, description })),
            total,
            paid,
            notes,
          }
    )
  }, [cleaned.length, customer, draftKey, editing, items, notes, orderedAt, paid, phone, pickupAt, total])

  useEffect(() => {
    if (editing) return
    writeStorage(attendantKey, attendantEdit)
  }, [attendantEdit, attendantKey, editing])

  const clearForm = () => {
    setCustomer("")
    setPhone("")
    setOrderedAt(toLocalInputValue(new Date()))
    setPickupAt("")
    setItems([newRow()])
    setTotal("")
    setPaid("")
    setNotes("")
  }

  const startEdit = (order: CustomerOrderRecord) => {
    setEditing(order)
    setCustomer(order.customer_name)
    setPhone(order.customer_phone ?? "")
    setOrderedAt(toLocalInputValue(new Date(order.ordered_at)))
    setPickupAt(toLocalInputValue(new Date(order.pickup_at)))
    setItems(order.items.length > 0 ? order.items.map((item) => newRow(item.quantity, item.description, item.unit)) : [newRow()])
    setTotal(order.total_cents ? centsToText(order.total_cents) : "")
    setPaid(order.paid_cents > 0 ? centsToText(order.paid_cents) : "")
    setNotes(order.notes ?? "")
    setAttendantEdit(order.attendant_name ?? attendant)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const stopEdit = () => {
    setEditing(null)
    clearForm()
    const stored = readStorage(attendantKey)
    setAttendantEdit(typeof stored === "string" ? stored : null)
  }

  const updateItem = (key: string, patch: Partial<ItemRow>) =>
    setItems((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)))

  const removeItem = (key: string) =>
    setItems((current) => (current.length <= 1 ? [newRow()] : current.filter((row) => row.key !== key)))

  const addItem = () => setItems((current) => [...current, newRow()])

  const downloadPdf = async (order: CustomerOrderRecord) => {
    try {
      const blob = await buildCustomerOrderPdf(order)
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `encomenda_${orderCode(order.id)}.pdf`
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
    } catch {
      toast.error("Não foi possível gerar o PDF da encomenda.")
    }
  }

  const save = async (thenPrint: boolean) => {
    if (!canSubmit || !orderedIso || !pickupIso) return
    const input = {
      branch_id: selectedBranchId,
      customer_name: customer,
      customer_phone: phone,
      ordered_at: orderedIso,
      pickup_at: pickupIso,
      items: cleaned,
      notes,
      total_cents: totalCents > 0 ? totalCents : null,
      paid_cents: paidCents,
      attendant_name: attendant,
    }
    try {
      const saved = editing
        ? await updateOrder.mutateAsync({ ...input, id: editing.id })
        : await createOrder.mutateAsync({ ...input, id: crypto.randomUUID() })
      if (editing) stopEdit()
      else clearForm()
      if (thenPrint) printHtml(buildCustomerOrderHtml(saved))
    } catch {
      // O hook já mostra o erro em toast.
    }
  }

  const confirmCancel = (order: CustomerOrderRecord) => {
    if (!window.confirm(`Cancelar a encomenda de ${order.customer_name}?`)) return
    updateStatus.mutate({ id: order.id, status: "cancelada" })
  }

  const all = useMemo(() => orders.data ?? [], [orders.data])
  const summary = useMemo(() => {
    const open = all.filter(isOrderOpen)
    return {
      open: open.length,
      today: open.filter((order) => sameDay(order.pickup_at, now)).length,
      late: open.filter((order) => pickupState(order, now) === "atrasada").length,
    }
  }, [all, now])

  const visible = useMemo(() => {
    return all
      .filter((order) => {
        if (filter === "abertas") return isOrderOpen(order)
        if (filter === "hoje") return order.status !== "cancelada" && sameDay(order.pickup_at, now)
        if (filter === "retiradas") return order.status === "retirada"
        if (filter === "canceladas") return order.status === "cancelada"
        return true
      })
      .filter((order) => orderMatches(order, search))
      .sort(compareOrders)
  }, [all, filter, now, search])

  return (
    <div>
      <PageHeader
        large
        title="Encomendas"
        description="Anote o pedido do cliente com a data e a hora da retirada e imprima o comprovante."
      />

      <div className="space-y-5 p-6">
        <div className="grid gap-4 lg:grid-cols-[460px_minmax(0,1fr)]">
          <Card className="h-fit">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between gap-2 text-base">
                {editing ? `Editando a encomenda ${orderCode(editing.id)}` : "Nova encomenda"}
                {editing ? (
                  <Button size="sm" variant="ghost" onClick={stopEdit}>
                    <X className="size-4" />
                    Cancelar edição
                  </Button>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
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
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1 text-sm">
                  <span className="font-medium">Pedido feito em</span>
                  <Input
                    type="datetime-local"
                    aria-label="Pedido feito em"
                    value={orderedAt}
                    onChange={(event) => setOrderedAt(event.target.value)}
                  />
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="font-medium">Retirada em</span>
                  <Input
                    type="datetime-local"
                    aria-label="Retirada em"
                    value={pickupAt}
                    onChange={(event) => setPickupAt(event.target.value)}
                    className={cn(pickupBeforeOrder && "border-destructive")}
                  />
                </label>
              </div>
              {pickupBeforeOrder ? (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-800 dark:bg-red-500/10 dark:text-red-300">
                  A retirada está antes do horário do pedido. Confira as datas.
                </p>
              ) : null}

              <div className="space-y-1.5 text-sm">
                <span className="font-medium">Pedido</span>
                <div className="space-y-2">
                  {items.map((row, index) => (
                    <div key={row.key} className="flex items-center gap-2">
                      <Input
                        className="w-20 shrink-0"
                        value={row.quantity}
                        onChange={(event) => updateItem(row.key, { quantity: event.target.value })}
                        placeholder="Qtd."
                        inputMode="decimal"
                        aria-label={`Quantidade do item ${index + 1}`}
                        autoComplete="off"
                      />
                      <Select
                        className="w-[5.5rem] shrink-0"
                        value={row.unit}
                        onValueChange={(unit) => updateItem(row.key, { unit: sanitizeUnit(unit) })}
                        options={ORDER_UNITS}
                        aria-label={`Unidade do item ${index + 1}`}
                      />
                      <Input
                        value={row.description}
                        onChange={(event) => updateItem(row.key, { description: event.target.value })}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && index === items.length - 1 && row.description.trim()) {
                            event.preventDefault()
                            addItem()
                          }
                        }}
                        placeholder="Ex.: mini pães de sal"
                        aria-label={`Descrição do item ${index + 1}`}
                        autoComplete="off"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-8 shrink-0"
                        aria-label={`Remover item ${index + 1}`}
                        onClick={() => removeItem(row.key)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button type="button" size="sm" variant="outline" onClick={addItem}>
                  <Plus className="size-4" />
                  Adicionar item
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1 text-sm">
                  <span className="font-medium">Valor total (opcional)</span>
                  <MoneyField value={total} onChange={setTotal} ariaLabel="Valor total" />
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="font-medium">Sinal pago (opcional)</span>
                  <MoneyField value={paid} onChange={setPaid} ariaLabel="Sinal pago" invalid={paidAboveTotal} />
                </label>
              </div>
              {paidAboveTotal ? (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-800 dark:bg-red-500/10 dark:text-red-300">
                  O sinal é maior que o valor total. Confira os valores.
                </p>
              ) : remaining != null ? (
                <p className="text-xs text-muted-foreground">
                  Falta pagar na retirada: <b className="text-foreground">{money(remaining)}</b>
                </p>
              ) : null}

              <label className="block space-y-1 text-sm">
                <span className="font-medium">Observação (opcional)</span>
                <textarea
                  className={textareaClass}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Ex.: sem lactose, escrever parabéns no bolo"
                />
              </label>

              <label className="block max-w-xs space-y-1 text-sm">
                <span className="font-medium">Atendente</span>
                <Input
                  value={attendant}
                  onChange={(event) => setAttendantEdit(event.target.value)}
                  placeholder="Nome do atendente"
                />
              </label>

              <div className="space-y-2 pt-1">
                <Button
                  className="h-11 w-full text-base"
                  disabled={!canSubmit || saving}
                  onClick={() => void save(true)}
                >
                  <Printer className="size-4" />
                  {saving ? "Salvando..." : editing ? "Salvar e imprimir" : "Registrar e imprimir"}
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" disabled={!canSubmit || saving} onClick={() => void save(false)}>
                    <Save className="size-4" />
                    {editing ? "Salvar alterações" : "Registrar"}
                  </Button>
                  <Button variant="outline" onClick={editing ? stopEdit : clearForm}>
                    <RotateCcw className="size-4" />
                    Limpar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="space-y-3 pb-2">
              <CardTitle className="text-base">Encomendas registradas</CardTitle>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Em aberto", value: summary.open },
                  { label: "Retirada hoje", value: summary.today },
                  { label: "Atrasadas", value: summary.late },
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
              <div className="flex flex-wrap items-center gap-2">
                {FILTERS.map((option) => (
                  <Button
                    key={option.id}
                    type="button"
                    size="sm"
                    variant={filter === option.id ? "default" : "outline"}
                    aria-pressed={filter === option.id}
                    className="rounded-full"
                    onClick={() => setFilter(option.id)}
                  >
                    {option.label}
                  </Button>
                ))}
                <div className="relative ml-auto w-full sm:w-56">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar cliente, código ou item"
                    aria-label="Buscar encomenda"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {orders.isLoading ? (
                <StateBlock type="loading" title="Carregando encomendas" />
              ) : orders.isError ? (
                <StateBlock
                  type="error"
                  title="Não foi possível carregar as encomendas"
                  description={orders.error.message}
                />
              ) : visible.length === 0 ? (
                <StateBlock
                  title="Nenhuma encomenda aqui"
                  description="As encomendas registradas aparecem aqui, da retirada mais próxima para a mais distante."
                />
              ) : (
                <ul className="divide-y divide-[color:var(--border-soft)]">
                  {visible.map((order) => (
                    <OrderRow
                      key={order.id}
                      order={order}
                      now={now}
                      editing={editing?.id === order.id}
                      onPrint={() => printHtml(buildCustomerOrderHtml(order))}
                      onPdf={() => void downloadPdf(order)}
                      onEdit={() => startEdit(order)}
                      onStatus={(status) => updateStatus.mutate({ id: order.id, status })}
                      onCancel={() => confirmCancel(order)}
                    />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function OrderRow({
  order,
  now,
  editing,
  onPrint,
  onPdf,
  onEdit,
  onStatus,
  onCancel,
}: {
  order: CustomerOrderRecord
  now: Date
  editing: boolean
  onPrint: () => void
  onPdf: () => void
  onEdit: () => void
  onStatus: (status: CustomerOrderStatus) => void
  onCancel: () => void
}) {
  const state = pickupState(order, now)
  const badge = PICKUP_BADGE[state]
  const open = isOrderOpen(order)
  const remaining = remainingCents(order.total_cents, order.paid_cents)
  return (
    <li className={cn("space-y-2 py-3", editing && "rounded-xl bg-[color:var(--bg-surface-soft)] px-3")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold text-[color:var(--text-primary)]">
              {formatPickup(order.pickup_at)}
            </span>
            {badge ? (
              <Badge variant="outline" className={cn("rounded-full", badge.className)}>
                {badge.label}
              </Badge>
            ) : null}
            <Badge variant="outline" className={cn("rounded-full", STATUS_TONE[order.status])}>
              {CUSTOMER_ORDER_STATUS_LABEL[order.status]}
            </Badge>
          </div>
          <div className="mt-0.5 text-sm">
            <span className="font-medium">{order.customer_name}</span>
            {order.customer_phone ? (
              <span className="text-muted-foreground"> · {order.customer_phone}</span>
            ) : null}
          </div>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <div className="font-mono tracking-wider">Nº {orderCode(order.id)}</div>
          <div>Pedido em {formatDateTimeFull(order.ordered_at)}</div>
        </div>
      </div>

      <ul className="space-y-0.5 rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-soft)] px-3 py-2 text-sm">
        {order.items.map((item, index) => (
          <li key={index}>{itemLine(item)}</li>
        ))}
      </ul>
      {order.notes ? <p className="text-xs text-muted-foreground">Obs.: {order.notes}</p> : null}
      {order.total_cents ? (
        <p className="text-xs text-muted-foreground">
          Total {money(order.total_cents)}
          {order.paid_cents > 0 ? ` · sinal ${money(order.paid_cents)}` : ""}
          {remaining != null ? ` · falta ${money(remaining)}` : ""}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-1.5">
        {order.status === "pendente" ? (
          <Button size="sm" variant="outline" onClick={() => onStatus("pronta")}>
            <PackageCheck className="size-4" />
            Marcar pronta
          </Button>
        ) : null}
        {open ? (
          <Button size="sm" onClick={() => onStatus("retirada")}>
            Marcar retirada
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => onStatus("pendente")}>
            <RotateCcw className="size-4" />
            Reabrir
          </Button>
        )}
        <div className="ml-auto flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="size-8"
            aria-label={`Imprimir encomenda de ${order.customer_name}`}
            title="Imprimir o comprovante"
            onClick={onPrint}
          >
            <Printer className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-8"
            aria-label={`Baixar PDF da encomenda de ${order.customer_name}`}
            title="Baixar em PDF"
            onClick={onPdf}
          >
            <FileDown className="size-4" />
          </Button>
          {open ? (
            <>
              <Button
                size="icon"
                variant="ghost"
                className="size-8"
                aria-label={`Editar encomenda de ${order.customer_name}`}
                title="Corrigir a encomenda"
                onClick={onEdit}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="size-8 text-red-600 hover:text-red-700"
                aria-label={`Cancelar encomenda de ${order.customer_name}`}
                title="Cancelar a encomenda"
                onClick={onCancel}
              >
                <Ban className="size-4" />
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </li>
  )
}
