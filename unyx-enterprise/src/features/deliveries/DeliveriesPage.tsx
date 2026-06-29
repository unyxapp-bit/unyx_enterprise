import { useEffect, useMemo, useRef, useState } from "react"
import type { DragEvent, FormEvent } from "react"
import { useSearchParams } from "react-router-dom"
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  GripVertical,
  MapPin,
  PackageCheck,
  PackageOpen,
  Pencil,
  Plus,
  RefreshCw,
  Route,
  Search,
  Trash2,
  Truck,
  XCircle,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { useAuth } from "@/app/providers/auth-context"
import { BentoGrid } from "@/components/bento/BentoGrid"
import { MetricCard } from "@/components/bento/MetricCard"
import { PageHeader } from "@/components/shared/PageHeader"
import { StateBlock } from "@/components/shared/StateBlock"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  useBranches,
  useCreateDeliveryOrder,
  useCustomers,
  useDeleteDeliveryOrder,
  useDeliveryOrders,
  useEmployees,
  useUpdateDeliveryOrder,
} from "@/hooks/useUnyxData"
import { formatCurrency, formatDateTimeBR } from "@/lib/format"
import { cn } from "@/lib/utils"
import { formatCep, lookupCep } from "@/services/viaCep"
import { useAppStore } from "@/store/useAppStore"
import type {
  Customer,
  DeliveryItem,
  DeliveryOrder,
  DeliveryPaymentStatus,
  DeliveryPriority,
  DeliverySource,
  DeliveryStatus,
  UserRole,
} from "@/types/domain"

const fieldClass =
  "h-8 w-full rounded-lg border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] px-2.5 text-sm text-[color:var(--text-primary)] outline-none transition-colors placeholder:text-[color:var(--text-muted)] focus:border-ring focus:ring-3 focus:ring-ring/50 disabled:cursor-not-allowed disabled:bg-[color:var(--bg-muted)] disabled:text-[color:var(--text-muted)] disabled:opacity-70"

const textareaClass =
  "min-h-20 w-full rounded-lg border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] px-2.5 py-2 text-sm text-[color:var(--text-primary)] outline-none transition-colors placeholder:text-[color:var(--text-muted)] focus:border-ring focus:ring-3 focus:ring-ring/50 disabled:cursor-not-allowed disabled:bg-[color:var(--bg-muted)] disabled:text-[color:var(--text-muted)] disabled:opacity-70"

const deliveryStatusLabel: Record<DeliveryStatus, string> = {
  pending: "Pendente",
  preparing: "Em preparo",
  ready_for_dispatch: "Pronta",
  out_for_delivery: "Em rota",
  delivered: "Entregue",
  failed: "Falhou",
  cancelled: "Cancelada",
}

const deliverySourceLabel: Record<DeliverySource, string> = {
  manual: "Manual",
  pos: "PDV",
}

const paymentStatusLabel: Record<DeliveryPaymentStatus, string> = {
  pending: "Pagamento pendente",
  paid: "Recebido",
  collect_on_delivery: "Cobrar na entrega",
}

const priorityLabel: Record<DeliveryPriority, string> = {
  normal: "Normal",
  urgent: "Urgente",
}

const statusOptions: DeliveryStatus[] = [
  "pending",
  "preparing",
  "ready_for_dispatch",
  "out_for_delivery",
  "delivered",
  "failed",
  "cancelled",
]

const sourceOptions: DeliverySource[] = ["manual", "pos"]
const priorityOptions: DeliveryPriority[] = ["normal", "urgent"]
const paymentOptions: DeliveryPaymentStatus[] = [
  "pending",
  "paid",
  "collect_on_delivery",
]

const deliveryColumns: Array<{
  status: DeliveryStatus
  title: string
  empty: string
  icon: LucideIcon
  badgeClass: string
}> = [
  {
    status: "pending",
    title: "Pendente",
    empty: "Entregas recebidas ou criadas manualmente entram aqui.",
    icon: PackageOpen,
    badgeClass:
      "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-500/30 dark:bg-slate-500/15 dark:text-slate-100",
  },
  {
    status: "preparing",
    title: "Em preparo",
    empty: "Arraste para esta coluna quando o pedido estiver sendo separado.",
    icon: Clock3,
    badgeClass:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-100",
  },
  {
    status: "ready_for_dispatch",
    title: "Pronta para saída",
    empty: "Pedidos prontos para sair com o entregador ficam aqui.",
    icon: PackageCheck,
    badgeClass:
      "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-100",
  },
  {
    status: "out_for_delivery",
    title: "Em rota",
    empty: "Entregas em trânsito para o cliente aparecem aqui.",
    icon: Truck,
    badgeClass:
      "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-100",
  },
  {
    status: "delivered",
    title: "Entregues",
    empty: "Pedidos concluídos e baixados com sucesso.",
    icon: CheckCircle2,
    badgeClass:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-100",
  },
  {
    status: "failed",
    title: "Falhadas",
    empty: "Falhas de entrega e retornos vão para esta coluna.",
    icon: AlertTriangle,
    badgeClass:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-100",
  },
  {
    status: "cancelled",
    title: "Canceladas",
    empty: "Cancelamentos ficam reunidos nesta coluna.",
    icon: XCircle,
    badgeClass:
      "border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-500/30 dark:bg-zinc-500/15 dark:text-zinc-200",
  },
]

const manageRoles: UserRole[] = ["owner", "admin", "branch_manager", "supervisor", "operator"]
const deleteRoles: UserRole[] = ["owner", "admin", "branch_manager", "supervisor"]

type DeliveryFormState = {
  branch_id: string
  customer_id: string
  assigned_employee_id: string
  source: DeliverySource
  status: DeliveryStatus
  priority: DeliveryPriority
  customer_name: string
  customer_phone: string
  postal_code: string
  address_line: string
  address_number: string
  complement: string
  neighborhood: string
  city: string
  state: string
  reference: string
  courier_name: string
  delivery_fee: string
  order_amount: string
  payment_status: DeliveryPaymentStatus
  scheduled_for: string
  estimated_delivery_at: string
  notes: string
  items: string
}

function canManage(role: UserRole | undefined) {
  return Boolean(role && manageRoles.includes(role))
}

function canDelete(role: UserRole | undefined) {
  return Boolean(role && deleteRoles.includes(role))
}

function statusBadgeClass(status: DeliveryStatus) {
  const classes: Record<DeliveryStatus, string> = {
    pending:
      "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-500/30 dark:bg-slate-500/15 dark:text-slate-100",
    preparing:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-100",
    ready_for_dispatch:
      "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-100",
    out_for_delivery:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-100",
    delivered:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-100",
    failed:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-100",
    cancelled:
      "border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-500/30 dark:bg-zinc-500/15 dark:text-zinc-200",
  }
  return classes[status]
}

function toDatetimeLocal(value: string | null | undefined) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 16)
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60_000)
  return local.toISOString().slice(0, 16)
}

function parseItems(value: string): DeliveryItem[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\d+(?:[.,]\d+)?)\s*x\s+(.+)$/i)
      if (!match) return { name: line, quantity: 1 }
      return {
        name: match[2].trim(),
        quantity: Number(match[1].replace(",", ".")) || 1,
      }
    })
}

function stringifyItems(items: DeliveryItem[]) {
  return items
    .map((item) => {
      const quantity = Number(item.quantity) || 1
      return `${quantity}x ${item.name}`
    })
    .join("\n")
}

function buildDefaultForm(branchId: string): DeliveryFormState {
  return {
    branch_id: branchId,
    customer_id: "",
    assigned_employee_id: "",
    source: "manual",
    status: "pending",
    priority: "normal",
    customer_name: "",
    customer_phone: "",
    postal_code: "",
    address_line: "",
    address_number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    reference: "",
    courier_name: "",
    delivery_fee: "",
    order_amount: "",
    payment_status: "pending",
    scheduled_for: "",
    estimated_delivery_at: "",
    notes: "",
    items: "",
  }
}

function buildFormFromDelivery(delivery: DeliveryOrder): DeliveryFormState {
  return {
    branch_id: delivery.branch_id,
    customer_id: delivery.customer_id ?? "",
    assigned_employee_id: delivery.assigned_employee_id ?? "",
    source: delivery.source,
    status: delivery.status,
    priority: delivery.priority,
    customer_name: delivery.customer_name,
    customer_phone: delivery.customer_phone ?? "",
    postal_code: delivery.postal_code ?? "",
    address_line: delivery.address_line,
    address_number: delivery.address_number ?? "",
    complement: delivery.complement ?? "",
    neighborhood: delivery.neighborhood ?? "",
    city: delivery.city ?? "",
    state: delivery.state ?? "",
    reference: delivery.reference ?? "",
    courier_name: delivery.courier_name ?? "",
    delivery_fee: String(delivery.delivery_fee || ""),
    order_amount: String(delivery.order_amount || ""),
    payment_status: delivery.payment_status,
    scheduled_for: toDatetimeLocal(delivery.scheduled_for),
    estimated_delivery_at: toDatetimeLocal(delivery.estimated_delivery_at),
    notes: delivery.notes ?? "",
    items: stringifyItems(delivery.items ?? []),
  }
}

function isOpenDelivery(status: DeliveryStatus) {
  return !["delivered", "failed", "cancelled"].includes(status)
}

function isPast(value: string | null | undefined) {
  if (!value) return false
  return new Date(value).getTime() < Date.now()
}

function nextStatus(status: DeliveryStatus): DeliveryStatus | null {
  const flow: Partial<Record<DeliveryStatus, DeliveryStatus>> = {
    pending: "preparing",
    preparing: "ready_for_dispatch",
    ready_for_dispatch: "out_for_delivery",
    out_for_delivery: "delivered",
  }
  return flow[status] ?? null
}

export function DeliveriesPage() {
  const [searchParams] = useSearchParams()
  const focus = searchParams.get("focus")
  const lastAppliedFocusRef = useRef<string | null>(null)
  const onlyOverdueDeliveries = focus === "overdue-deliveries"
  const { profile } = useAuth()
  const selectedBranchId = useAppStore((state) => state.selectedBranchId)
  const branches = useBranches()
  const deliveries = useDeliveryOrders()
  const customers = useCustomers(undefined, { optional: true })
  const createDelivery = useCreateDeliveryOrder()
  const updateDelivery = useUpdateDeliveryOrder()
  const deleteDelivery = useDeleteDeliveryOrder()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<DeliveryStatus | "all">("all")
  const [sourceFilter, setSourceFilter] = useState<DeliverySource | "all">("all")
  const [draggingDeliveryId, setDraggingDeliveryId] = useState<string | null>(null)
  const [dragOverStatus, setDragOverStatus] = useState<DeliveryStatus | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<DeliveryOrder | null>(null)
  const [cepLoading, setCepLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const fallbackBranchId =
    selectedBranchId ?? profile?.branch_id ?? branches.data?.[0]?.id ?? ""
  const [form, setForm] = useState<DeliveryFormState>(() =>
    buildDefaultForm(fallbackBranchId)
  )
  const employees = useEmployees(form.branch_id || fallbackBranchId || null)
  const customerOptions = (customers.data ?? []).filter(
    (customer) =>
      customer.status !== "blocked" &&
      (!form.branch_id || !customer.branch_id || customer.branch_id === form.branch_id)
  )
  const canManageDeliveries = canManage(profile?.role)
  const canDeleteDeliveries = canDelete(profile?.role)

  const filteredDeliveries = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (deliveries.data ?? []).filter((delivery) => {
      const matchesStatus = statusFilter === "all" || delivery.status === statusFilter
      const matchesSource = sourceFilter === "all" || delivery.source === sourceFilter
      const due = delivery.estimated_delivery_at ?? delivery.scheduled_for
      const matchesFocus =
        !onlyOverdueDeliveries || (isOpenDelivery(delivery.status) && isPast(due))
      const matchesSearch =
        !q ||
        delivery.customer_name.toLowerCase().includes(q) ||
        (delivery.customer_phone ?? "").toLowerCase().includes(q) ||
        delivery.address_line.toLowerCase().includes(q) ||
        (delivery.neighborhood ?? "").toLowerCase().includes(q) ||
        (delivery.courier_name ?? "").toLowerCase().includes(q)

      return matchesStatus && matchesSource && matchesFocus && matchesSearch
    })
  }, [deliveries.data, onlyOverdueDeliveries, search, sourceFilter, statusFilter])

  const deliveriesByStatus = useMemo(() => {
    return filteredDeliveries.reduce(
      (acc, delivery) => {
        acc[delivery.status].push(delivery)
        return acc
      },
      {
        pending: [],
        preparing: [],
        ready_for_dispatch: [],
        out_for_delivery: [],
        delivered: [],
        failed: [],
        cancelled: [],
      } as Record<DeliveryStatus, DeliveryOrder[]>
    )
  }, [filteredDeliveries])

  const visibleColumns = useMemo(() => {
    if (statusFilter === "all") return deliveryColumns
    return deliveryColumns.filter((column) => column.status === statusFilter)
  }, [statusFilter])

  useEffect(() => {
    if (focus !== "overdue-deliveries" || lastAppliedFocusRef.current === focus) return
    lastAppliedFocusRef.current = focus
    setStatusFilter("all")
    setSourceFilter("all")
    setSearch("")

    window.requestAnimationFrame(() => {
      document.getElementById("entregas-lista")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
    })
  }, [focus])

  const stats = useMemo(() => {
    const list = deliveries.data ?? []
    const today = new Date().toISOString().slice(0, 10)
    const open = list.filter((delivery) => isOpenDelivery(delivery.status)).length
    const inRoute = list.filter((delivery) => delivery.status === "out_for_delivery").length
    const deliveredToday = list.filter(
      (delivery) => delivery.delivered_at?.slice(0, 10) === today
    ).length
    const urgent = list.filter(
      (delivery) => delivery.priority === "urgent" && isOpenDelivery(delivery.status)
    ).length

    return { open, inRoute, deliveredToday, urgent }
  }, [deliveries.data])

  function openCreateDialog() {
    setEditing(null)
    setForm(buildDefaultForm(fallbackBranchId))
    setFormError(null)
    setDialogOpen(true)
  }

  function openEditDialog(delivery: DeliveryOrder) {
    setEditing(delivery)
    setForm(buildFormFromDelivery(delivery))
    setFormError(null)
    setDialogOpen(true)
  }

  function applyCustomer(customerId: string) {
    const customer = (customers.data ?? []).find((item) => item.id === customerId)
    if (!customer) {
      setForm((current) => ({ ...current, customer_id: "" }))
      return
    }

    setForm((current) => ({
      ...current,
      customer_id: customer.id,
      customer_name: customer.name,
      customer_phone: customer.phone ?? "",
      postal_code: customer.postal_code ?? current.postal_code,
      address_line: customer.address_line ?? current.address_line,
      address_number: customer.address_number ?? current.address_number,
      complement: customer.complement ?? current.complement,
      neighborhood: customer.neighborhood ?? current.neighborhood,
      city: customer.city ?? current.city,
      state: customer.state ?? current.state,
      reference: customer.reference ?? current.reference,
    }))
  }

  async function fillAddressFromCep() {
    setFormError(null)
    setCepLoading(true)
    try {
      const address = await lookupCep(form.postal_code)
      setForm((current) => ({
        ...current,
        postal_code: address.cep,
        address_line: address.logradouro || current.address_line,
        complement: current.complement || address.complemento || "",
        neighborhood: address.bairro || current.neighborhood,
        city: address.localidade || current.city,
        state: address.uf || current.state,
      }))
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Nao foi possivel buscar o CEP.")
    } finally {
      setCepLoading(false)
    }
  }

  function formToPayload() {
    return {
      branch_id: form.branch_id,
      sale_id: editing?.sale_id ?? null,
      customer_id: form.customer_id || null,
      assigned_employee_id: form.assigned_employee_id || null,
      source: form.source,
      status: form.status,
      priority: form.priority,
      customer_name: form.customer_name,
      customer_phone: form.customer_phone || null,
      postal_code: form.postal_code || null,
      address_line: form.address_line,
      address_number: form.address_number || null,
      complement: form.complement || null,
      neighborhood: form.neighborhood || null,
      city: form.city || null,
      state: form.state || null,
      reference: form.reference || null,
      courier_name: form.courier_name || null,
      delivery_fee: Number(form.delivery_fee) || 0,
      order_amount: Number(form.order_amount) || 0,
      payment_status: form.payment_status,
      scheduled_for: form.scheduled_for || null,
      estimated_delivery_at: form.estimated_delivery_at || null,
      notes: form.notes || null,
      items: parseItems(form.items),
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    const payload = formToPayload()

    try {
      if (editing) {
        await updateDelivery.mutateAsync({
          deliveryId: editing.id,
          values: payload,
        })
      } else {
        await createDelivery.mutateAsync(payload)
      }

      setDialogOpen(false)
      setEditing(null)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Nao foi possivel salvar a entrega.")
    }
  }

  async function handleDelete(delivery: DeliveryOrder) {
    const confirmed = window.confirm(`Excluir entrega de ${delivery.customer_name}?`)
    if (!confirmed) return
    await deleteDelivery.mutateAsync(delivery.id)
  }

  async function advanceDelivery(delivery: DeliveryOrder) {
    const next = nextStatus(delivery.status)
    if (!next) return
    await updateDelivery.mutateAsync({
      deliveryId: delivery.id,
      values: { status: next },
    })
  }

  async function setDeliveryStatus(delivery: DeliveryOrder, status: DeliveryStatus) {
    if (delivery.status === status) return
    await updateDelivery.mutateAsync({
      deliveryId: delivery.id,
      values: { status },
    })
  }

  function handleDragStart(event: DragEvent<HTMLElement>, delivery: DeliveryOrder) {
    if (!canManageDeliveries) return
    setDraggingDeliveryId(delivery.id)
    event.dataTransfer.effectAllowed = "move"
    event.dataTransfer.setData("text/plain", delivery.id)
  }

  function handleDragEnd() {
    setDraggingDeliveryId(null)
    setDragOverStatus(null)
  }

  function handleDragLeave(event: DragEvent<HTMLElement>, status: DeliveryStatus) {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
    setDragOverStatus((current) => (current === status ? null : current))
  }

  function handleDragOver(event: DragEvent<HTMLElement>, status: DeliveryStatus) {
    if (!canManageDeliveries) return
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
    setDragOverStatus(status)
  }

  function handleDrop(event: DragEvent<HTMLElement>, status: DeliveryStatus) {
    if (!canManageDeliveries) return
    event.preventDefault()
    const deliveryId = event.dataTransfer.getData("text/plain") || draggingDeliveryId
    const delivery = (deliveries.data ?? []).find((item) => item.id === deliveryId)
    setDraggingDeliveryId(null)
    setDragOverStatus(null)
    if (!delivery) return
    void setDeliveryStatus(delivery, status)
  }

  return (
    <>
      <PageHeader
        title="Controle de Entregas"
        description="Acompanhe entregas vindas do PDV e pedidos criados manualmente por filial."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => void deliveries.refetch()}
              aria-label="Atualizar entregas"
            >
              <RefreshCw className="size-4" />
            </Button>
            {canManageDeliveries ? (
              <Button onClick={openCreateDialog}>
                <Plus className="size-4" />
                Nova entrega
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="space-y-6 p-6">
        {deliveries.isLoading ? (
          <StateBlock type="loading" title="Carregando entregas" />
        ) : deliveries.isError ? (
          <StateBlock
            type="error"
            title="Erro ao carregar entregas"
            description={deliveries.error.message}
          />
        ) : (
          <>
            <BentoGrid>
              <MetricCard
                title="Em aberto"
                value={stats.open}
                detail="Aguardando conclusao"
                icon={<PackageOpen className="size-5" />}
              />
              <MetricCard
                title="Em rota"
                value={stats.inRoute}
                detail="Saiu para entrega"
                icon={<Truck className="size-5" />}
              />
              <MetricCard
                title="Entregues hoje"
                value={stats.deliveredToday}
                detail="Baixas do dia"
                icon={<PackageCheck className="size-5" />}
              />
              <MetricCard
                title="Urgentes"
                value={stats.urgent}
                detail="Prioridade alta aberta"
                icon={<Clock3 className="size-5" />}
              />
            </BentoGrid>

            <section
              id="entregas-lista"
              className="scroll-mt-20 overflow-hidden rounded-[1.25rem] border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] shadow-sm"
            >
              <div className="flex flex-col gap-3 border-b border-[color:var(--border-soft)] px-4 py-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex min-w-0 items-start gap-2">
                  <Route className="mt-0.5 size-5 shrink-0 text-[color:var(--text-muted)]" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[color:var(--text-primary)]">
                      {onlyOverdueDeliveries ? "Entregas atrasadas" : "Entregas"}
                    </div>
                    <div className="text-xs text-[color:var(--text-muted)]">
                      Arraste os cards entre as colunas para acompanhar cada status da entrega.
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative w-full min-w-[16rem] flex-1 xl:w-72 xl:flex-none">
                    <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[color:var(--text-muted)]" />
                    <Input
                      className="h-8 pl-9 text-xs"
                      placeholder="Buscar cliente, telefone, endereco ou entregador"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </div>
                  <select
                    className={cn(fieldClass, "w-40 text-xs")}
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(event.target.value as DeliveryStatus | "all")
                    }
                  >
                    <option value="all">Todos os status</option>
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {deliveryStatusLabel[status]}
                      </option>
                    ))}
                  </select>
                  <select
                    className={cn(fieldClass, "w-36 text-xs")}
                    value={sourceFilter}
                    onChange={(event) =>
                      setSourceFilter(event.target.value as DeliverySource | "all")
                    }
                  >
                    <option value="all">Todas as origens</option>
                    {sourceOptions.map((source) => (
                      <option key={source} value={source}>
                        {deliverySourceLabel[source]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-3">
                {filteredDeliveries.length === 0 ? (
                  <StateBlock
                    title="Nenhuma entrega encontrada"
                    description="Crie uma entrega manualmente ou marque entrega no fechamento da venda do PDV."
                  />
                ) : (
                  <div className="grid auto-cols-[minmax(18rem,18rem)] grid-flow-col gap-3 overflow-x-auto pb-2">
                    {visibleColumns.map((column) => {
                      const Icon = column.icon
                      const columnDeliveries = deliveriesByStatus[column.status]

                      return (
                        <section
                          key={column.status}
                          className={cn(
                            "flex min-h-[34rem] w-[18rem] flex-col overflow-hidden rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-soft)] shadow-sm transition",
                            dragOverStatus === column.status &&
                              "border-ring/70 bg-[color:var(--bg-surface)] shadow-md"
                          )}
                          onDragOver={(event) => handleDragOver(event, column.status)}
                          onDragLeave={(event) => handleDragLeave(event, column.status)}
                          onDrop={(event) => handleDrop(event, column.status)}
                        >
                          <div className="flex items-center justify-between gap-2 border-b border-[color:var(--border-soft)] px-3 py-2.5">
                            <div className="flex min-w-0 items-center gap-2">
                              <span
                                className={cn(
                                  "flex size-8 shrink-0 items-center justify-center rounded-lg border text-xs",
                                  column.badgeClass
                                )}
                              >
                                <Icon className="size-4" />
                              </span>
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-[color:var(--text-primary)]">
                                  {column.title}
                                </div>
                                <div className="text-[11px] text-[color:var(--text-muted)]">
                                  {columnDeliveries.length} entrega(s)
                                </div>
                              </div>
                            </div>
                            <Badge variant="outline">{columnDeliveries.length}</Badge>
                          </div>

                          <div className="flex flex-1 flex-col gap-3 p-3">
                            {columnDeliveries.length === 0 ? (
                              <div className="flex min-h-40 flex-1 items-center justify-center rounded-xl border border-dashed border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] px-3 py-6 text-center text-xs text-[color:var(--text-muted)]">
                                {column.empty}
                              </div>
                            ) : (
                              columnDeliveries.map((delivery) => {
                                const next = nextStatus(delivery.status)

                                return (
                                  <article
                                    key={delivery.id}
                                    draggable={canManageDeliveries}
                                    onDragStart={(event) => handleDragStart(event, delivery)}
                                    onDragEnd={handleDragEnd}
                                    className={cn(
                                      "cursor-grab rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] p-3 shadow-sm transition hover:border-[color:var(--border-strong)] active:cursor-grabbing",
                                      draggingDeliveryId === delivery.id && "opacity-60"
                                    )}
                                  >
                                    <div className="flex items-start gap-2">
                                      {canManageDeliveries ? (
                                        <GripVertical className="mt-1 size-4 shrink-0 text-[color:var(--text-muted)]" />
                                      ) : null}
                                      <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                          <div className="truncate text-sm font-semibold text-[color:var(--text-primary)]">
                                            {delivery.customer_name}
                                          </div>
                                          {delivery.priority === "urgent" ? (
                                            <Badge variant="destructive">Urgente</Badge>
                                          ) : null}
                                        </div>
                                        <div className="mt-1 flex flex-wrap gap-1.5">
                                          <span
                                            className={cn(
                                              "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                                              statusBadgeClass(delivery.status)
                                            )}
                                          >
                                            {deliveryStatusLabel[delivery.status]}
                                          </span>
                                          <Badge variant="outline">
                                            {deliverySourceLabel[delivery.source]}
                                          </Badge>
                                          <Badge variant="secondary">
                                            {paymentStatusLabel[delivery.payment_status]}
                                          </Badge>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[color:var(--text-muted)]">
                                      <span>{delivery.customer_phone ?? "Sem telefone"}</span>
                                      <span>{delivery.branches?.name ?? "Filial"}</span>
                                      {delivery.sale_id ? <span>Venda PDV vinculada</span> : null}
                                    </div>

                                    <div className="mt-2 flex items-start gap-2 text-xs text-[color:var(--text-secondary)]">
                                      <MapPin className="mt-0.5 size-4 shrink-0 text-[color:var(--text-muted)]" />
                                      <span className="break-words">
                                        {delivery.address_line}
                                        {delivery.address_number ? `, ${delivery.address_number}` : ""}
                                        {delivery.complement ? `, ${delivery.complement}` : ""}
                                        {delivery.neighborhood ? `, ${delivery.neighborhood}` : ""}
                                        {delivery.city ? ` - ${delivery.city}` : ""}
                                        {delivery.state ? `/${delivery.state}` : ""}
                                        {delivery.postal_code ? ` - CEP ${formatCep(delivery.postal_code)}` : ""}
                                        {delivery.reference ? ` (${delivery.reference})` : ""}
                                      </span>
                                    </div>

                                    <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-soft)] p-2 text-[11px]">
                                      <div className="min-w-0">
                                        <div className="text-[color:var(--text-muted)]">Pedido</div>
                                        <div className="truncate font-medium text-[color:var(--text-primary)]">
                                          {formatCurrency(delivery.order_amount)}
                                        </div>
                                      </div>
                                      <div className="min-w-0">
                                        <div className="text-[color:var(--text-muted)]">Taxa</div>
                                        <div className="truncate font-medium text-[color:var(--text-primary)]">
                                          {formatCurrency(delivery.delivery_fee)}
                                        </div>
                                      </div>
                                      <div className="min-w-0">
                                        <div className="text-[color:var(--text-muted)]">Total</div>
                                        <div className="truncate font-medium text-[color:var(--text-primary)]">
                                          {formatCurrency(delivery.total_amount)}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[color:var(--text-muted)]">
                                      <span>
                                        Entregador:{" "}
                                        {delivery.employees?.name ??
                                          delivery.courier_name ??
                                          "Nao definido"}
                                      </span>
                                      {delivery.estimated_delivery_at ? (
                                        <span>
                                          Previsto {formatDateTimeBR(delivery.estimated_delivery_at)}
                                        </span>
                                      ) : null}
                                    </div>

                                    {delivery.items.length > 0 ? (
                                      <div className="mt-2 flex flex-wrap gap-1.5">
                                        {delivery.items.slice(0, 3).map((item, index) => (
                                          <Badge key={`${item.name}-${index}`} variant="outline">
                                            {item.quantity}x {item.name}
                                          </Badge>
                                        ))}
                                        {delivery.items.length > 3 ? (
                                          <Badge variant="outline">
                                            +{delivery.items.length - 3} item(ns)
                                          </Badge>
                                        ) : null}
                                      </div>
                                    ) : null}

                                    <div className="mt-3 flex flex-wrap gap-1.5">
                                      {next && canManageDeliveries ? (
                                        <Button
                                          size="sm"
                                          className="h-7 gap-1 px-2 text-xs"
                                          onClick={() => void advanceDelivery(delivery)}
                                          disabled={updateDelivery.isPending}
                                        >
                                          <CheckCircle2 className="size-4" />
                                          {deliveryStatusLabel[next]}
                                        </Button>
                                      ) : null}
                                      {canManageDeliveries ? (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-7 gap-1 px-2 text-xs"
                                          onClick={() => openEditDialog(delivery)}
                                        >
                                          <Pencil className="size-4" />
                                          Editar
                                        </Button>
                                      ) : null}
                                      {canDeleteDeliveries ? (
                                        <Button
                                          variant="destructive"
                                          size="sm"
                                          className="h-7 gap-1 px-2 text-xs"
                                          onClick={() => void handleDelete(delivery)}
                                          disabled={deleteDelivery.isPending}
                                        >
                                          <Trash2 className="size-4" />
                                          Excluir
                                        </Button>
                                      ) : null}
                                    </div>
                                  </article>
                                )
                              })
                            )}
                          </div>
                        </section>
                      )
                    })}
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar entrega" : "Nova entrega"}</DialogTitle>
            <DialogDescription>
              Entregas manuais e entregas vindas do PDV usam o mesmo fluxo operacional.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
            <div className="grid gap-3 sm:grid-cols-4">
              <label className="space-y-1 text-sm">
                <span className="font-medium">Filial</span>
                <select
                  required
                  className={fieldClass}
                  value={form.branch_id}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      branch_id: event.target.value,
                      assigned_employee_id: "",
                      customer_id: "",
                    }))
                  }
                >
                  <option value="">Selecione</option>
                  {(branches.data ?? []).map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Origem</span>
                <select
                  className={fieldClass}
                  disabled={Boolean(editing?.sale_id)}
                  value={form.source}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      source: event.target.value as DeliverySource,
                    }))
                  }
                >
                  {sourceOptions.map((source) => (
                    <option key={source} value={source}>
                      {deliverySourceLabel[source]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Status</span>
                <select
                  className={fieldClass}
                  value={form.status}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      status: event.target.value as DeliveryStatus,
                    }))
                  }
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {deliveryStatusLabel[status]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Prioridade</span>
                <select
                  className={fieldClass}
                  value={form.priority}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      priority: event.target.value as DeliveryPriority,
                    }))
                  }
                >
                  {priorityOptions.map((priority) => (
                    <option key={priority} value={priority}>
                      {priorityLabel[priority]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="space-y-1 text-sm">
              <span className="font-medium">Cliente cadastrado</span>
              <select
                className={fieldClass}
                value={form.customer_id}
                onChange={(event) => applyCustomer(event.target.value)}
              >
                <option value="">Preencher manualmente</option>
                {customerOptions.map((customer: Customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.customer_code} - {customer.name}
                    {customer.phone ? ` (${customer.phone})` : ""}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium">Cliente</span>
                <Input
                  required
                  value={form.customer_name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      customer_name: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Telefone</span>
                <Input
                  value={form.customer_phone}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      customer_phone: event.target.value,
                    }))
                  }
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-[170px_1fr_auto]">
              <label className="space-y-1 text-sm">
                <span className="font-medium">CEP</span>
                <Input
                  value={form.postal_code}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      postal_code: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Endereco</span>
                <Input
                  required
                  value={form.address_line}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      address_line: event.target.value,
                    }))
                  }
                />
              </label>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void fillAddressFromCep()}
                  disabled={cepLoading}
                >
                  <MapPin className="size-4" />
                  Buscar CEP
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <label className="space-y-1 text-sm">
                <span className="font-medium">Numero</span>
                <Input
                  value={form.address_number}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      address_number: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Complemento</span>
                <Input
                  value={form.complement}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      complement: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Bairro</span>
                <Input
                  value={form.neighborhood}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      neighborhood: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Cidade</span>
                <Input
                  value={form.city}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, city: event.target.value }))
                  }
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
              <label className="space-y-1 text-sm">
                <span className="font-medium">UF</span>
                <Input
                  maxLength={2}
                  value={form.state}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, state: event.target.value }))
                  }
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Referencia</span>
                <Input
                  value={form.reference}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, reference: event.target.value }))
                  }
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-1 text-sm">
                <span className="font-medium">Entregador interno</span>
                <select
                  className={fieldClass}
                  value={form.assigned_employee_id}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      assigned_employee_id: event.target.value,
                    }))
                  }
                >
                  <option value="">Nao definido</option>
                  {(employees.data ?? []).map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Entregador externo</span>
                <Input
                  value={form.courier_name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      courier_name: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Pagamento</span>
                <select
                  className={fieldClass}
                  value={form.payment_status}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      payment_status: event.target.value as DeliveryPaymentStatus,
                    }))
                  }
                >
                  {paymentOptions.map((status) => (
                    <option key={status} value={status}>
                      {paymentStatusLabel[status]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <label className="space-y-1 text-sm">
                <span className="font-medium">Valor pedido</span>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.order_amount}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      order_amount: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Taxa entrega</span>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.delivery_fee}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      delivery_fee: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Agendada para</span>
                <Input
                  type="datetime-local"
                  value={form.scheduled_for}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      scheduled_for: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Previsao</span>
                <Input
                  type="datetime-local"
                  value={form.estimated_delivery_at}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      estimated_delivery_at: event.target.value,
                    }))
                  }
                />
              </label>
            </div>

            <label className="space-y-1 text-sm">
              <span className="font-medium">Itens</span>
              <textarea
                className={textareaClass}
                placeholder={"1x Pizza grande\n2x Refrigerante\nMedicamento controlado"}
                value={form.items}
                onChange={(event) =>
                  setForm((current) => ({ ...current, items: event.target.value }))
                }
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium">Observacoes</span>
              <textarea
                className={textareaClass}
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({ ...current, notes: event.target.value }))
                }
              />
            </label>

            {formError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                {formError}
              </div>
            ) : null}

            {(createDelivery.error || updateDelivery.error) ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                {createDelivery.error?.message ?? updateDelivery.error?.message}
              </div>
            ) : null}

            <DialogFooter>
              <Button
                type="submit"
                disabled={createDelivery.isPending || updateDelivery.isPending}
              >
                {editing ? "Salvar entrega" : "Criar entrega"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
