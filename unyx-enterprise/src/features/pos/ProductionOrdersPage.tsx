import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import {
  CheckCircle2,
  ClipboardList,
  Clock3,
  PackageCheck,
  Printer,
  RefreshCw,
  Search,
  ShoppingCart,
  Trash2,
  Utensils,
  XCircle,
} from "lucide-react"

import { PageHeader } from "@/components/shared/PageHeader"
import { StateBlock } from "@/components/shared/StateBlock"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  useBranches,
  useCreateProductionOrder,
  useCustomers,
  useDeleteProductionOrder,
  useProductCategories,
  useProductVariants,
  useProductionOrders,
  useProducts,
  useUpdateProductionOrderStatus,
} from "@/hooks/useUnyxData"
import { formatDateTimeBR, todayISO } from "@/lib/format"
import { useAppStore } from "@/store/useAppStore"
import type {
  Branch,
  Customer,
  Product,
  ProductCategory,
  ProductVariant,
  ProductionOrder,
  ProductionOrderPriority,
  ProductionOrderStatus,
} from "@/types/domain"

const fieldClass =
  "h-8 w-full rounded-lg border bg-white px-2.5 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"

const statusLabel: Record<ProductionOrderStatus, string> = {
  pending: "Aberto",
  in_production: "Em producao",
  ready: "Pronto",
  delivered: "Entregue",
  cancelled: "Cancelado",
}

const priorityLabel: Record<ProductionOrderPriority, string> = {
  normal: "Normal",
  high: "Alta",
  urgent: "Urgente",
}

type ProductionItemOption = {
  key: string
  product: Product
  variant: ProductVariant | null
  name: string
  category: string
  stock_quantity: number
}

type ProductionCartItem = {
  key: string
  product_id: string | null
  variant_id: string | null
  name: string
  quantity: number
  notes: string
  half_and_half?: {
    first_name: string
    second_name: string
  } | null
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function productCategory(product: Product, category: ProductCategory | undefined) {
  return category?.name ?? product.product_categories?.name ?? product.category ?? "Sem categoria"
}

function sellableName(product: Product, variant: ProductVariant | null) {
  return variant ? `${product.name} - ${variant.name}` : product.name
}

function formatProductionQuantity(value: number) {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")
}

function isProductionProduct(product: Product, category: ProductCategory | undefined) {
  const text = normalizeText(
    [
      product.name,
      product.category,
      category?.name,
      product.description,
      product.brand,
      product.size_label,
    ]
      .filter(Boolean)
      .join(" ")
  )

  return (
    product.product_kind === "food" ||
    category?.segment === "restaurant" ||
    product.product_categories?.segment === "restaurant" ||
    text.includes("pizza") ||
    text.includes("pizzaria") ||
    text.includes("cozinha") ||
    text.includes("padaria") ||
    text.includes("lanche") ||
    text.includes("prato") ||
    text.includes("salgado")
  )
}

function isPizzaOption(item: ProductionItemOption) {
  const text = normalizeText(
    [
      item.name,
      item.category,
      item.product.name,
      item.product.description,
      item.product.size_label,
    ]
      .filter(Boolean)
      .join(" ")
  )

  return text.includes("pizza") || text.includes("pizzaria")
}

function isPast(value: string | null | undefined) {
  if (!value) return false
  return new Date(value).getTime() < Date.now()
}

function statusVariant(status: ProductionOrderStatus) {
  if (status === "cancelled") return "destructive"
  if (status === "ready" || status === "delivered") return "default"
  if (status === "in_production") return "secondary"
  return "outline"
}

function nextStatus(status: ProductionOrderStatus): ProductionOrderStatus | null {
  if (status === "pending") return "in_production"
  if (status === "in_production") return "ready"
  if (status === "ready") return "delivered"
  return null
}

function branchName(branches: Branch[], branchId: string | null | undefined) {
  return branches.find((branch) => branch.id === branchId)?.name ?? "Filial"
}

function customerLabel(customer: Customer) {
  return `${customer.customer_code} - ${customer.name}${customer.phone ? ` (${customer.phone})` : ""}`
}

function PrintableProductionOrder({ order }: { order: ProductionOrder }) {
  const items = order.production_order_items ?? []
  const branch = order.branches?.name ?? "Filial"

  return (
    <div className="fiscal-print-root">
      <div className="fiscal-coupon">
        <div className="fiscal-coupon-center fiscal-coupon-strong">
          PEDIDO DE PRODUCAO
        </div>
        <div className="fiscal-coupon-center">{branch}</div>
        <div className="fiscal-coupon-separator" />
        <div>Pedido: {order.order_code}</div>
        <div>Status: {statusLabel[order.status]}</div>
        <div>Prioridade: {priorityLabel[order.priority]}</div>
        <div>Entrada: {formatDateTimeBR(order.ordered_at)}</div>
        {order.promised_at ? (
          <div>Promessa: {formatDateTimeBR(order.promised_at)}</div>
        ) : null}
        <div>Cliente: {order.customer_name}</div>
        {order.customer_phone ? <div>Telefone: {order.customer_phone}</div> : null}
        <div className="fiscal-coupon-separator" />
        <div className="fiscal-coupon-strong">Itens para produzir</div>
        {items.map((item) => (
          <div key={item.id} className="fiscal-coupon-item">
            <div className="production-coupon-product">
              {formatProductionQuantity(item.quantity)}x {item.product_name}
            </div>
            {item.notes ? (
              <div className="production-coupon-note">OBS: {item.notes}</div>
            ) : null}
          </div>
        ))}
        {order.notes ? (
          <>
            <div className="fiscal-coupon-separator" />
            <div className="production-coupon-note">OBS. PEDIDO: {order.notes}</div>
          </>
        ) : null}
        <div className="fiscal-coupon-separator" />
        <div className="fiscal-coupon-center">
          Cupom interno para cozinha/producao.
        </div>
      </div>
    </div>
  )
}

export function ProductionOrdersPage({ embedded = false }: { embedded?: boolean } = {}) {
  const [searchParams] = useSearchParams()
  const focus = searchParams.get("focus")
  const lastAppliedFocusRef = useRef<string | null>(null)
  const onlyOverdueProduction = focus === "overdue-production"
  const selectedBranchId = useAppStore((state) => state.selectedBranchId)
  const [date, setDate] = useState(todayISO())
  const [statusFilter, setStatusFilter] = useState<ProductionOrderStatus | "all">("all")
  const [branchId, setBranchId] = useState("")
  const [customerId, setCustomerId] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [priority, setPriority] = useState<ProductionOrderPriority>("normal")
  const [promisedAt, setPromisedAt] = useState("")
  const [notes, setNotes] = useState("")
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [cart, setCart] = useState<ProductionCartItem[]>([])
  const [formError, setFormError] = useState<string | null>(null)
  const [printOrder, setPrintOrder] = useState<ProductionOrder | null>(null)
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)
  const [halfAndHalfDialogOpen, setHalfAndHalfDialogOpen] = useState(false)
  const [halfAndHalfFirstKey, setHalfAndHalfFirstKey] = useState("")
  const [halfAndHalfSecondKey, setHalfAndHalfSecondKey] = useState("")
  const [halfAndHalfNotes, setHalfAndHalfNotes] = useState("")

  const branches = useBranches()
  const products = useProducts(branchId || selectedBranchId || null)
  const categories = useProductCategories(branchId || selectedBranchId || null)
  const variants = useProductVariants()
  const customers = useCustomers(branchId || selectedBranchId || null, { optional: true })
  const orders = useProductionOrders(date, "all")
  const visibleOrders = useMemo(
    () =>
      (orders.data ?? []).filter((order) => {
        const matchesStatus = statusFilter === "all" || order.status === statusFilter
        const matchesOverdue =
          !onlyOverdueProduction ||
          (!["ready", "delivered", "cancelled"].includes(order.status) &&
            isPast(order.promised_at))

        return matchesStatus && matchesOverdue
      }),
    [onlyOverdueProduction, orders.data, statusFilter]
  )
  const createOrder = useCreateProductionOrder()
  const updateStatus = useUpdateProductionOrderStatus()
  const deleteOrder = useDeleteProductionOrder()

  const activeBranches = useMemo(
    () => (branches.data ?? []).filter((branch) => branch.active),
    [branches.data]
  )

  const defaultBranchId =
    branchId || selectedBranchId || activeBranches[0]?.id || ""

  const customerOptions = useMemo(
    () => (customers.data ?? []).filter((customer) => customer.status !== "blocked"),
    [customers.data]
  )

  const variantsByProduct = useMemo(() => {
    const grouped = new Map<string, ProductVariant[]>()
    ;(variants.data ?? [])
      .filter((variant) => variant.active)
      .forEach((variant) => {
        grouped.set(variant.product_id, [
          ...(grouped.get(variant.product_id) ?? []),
          variant,
        ])
      })
    return grouped
  }, [variants.data])

  const categoryById = useMemo(() => {
    return new Map((categories.data ?? []).map((category) => [category.id, category]))
  }, [categories.data])

  const itemOptions = useMemo(() => {
    return (products.data ?? [])
      .filter(
        (product) =>
          product.active &&
          (embedded ||
            isProductionProduct(product, categoryById.get(product.category_id ?? "")))
      )
      .flatMap((product): ProductionItemOption[] => {
        const productVariants = variantsByProduct.get(product.id) ?? []
        const category = productCategory(product, categoryById.get(product.category_id ?? ""))
        if (productVariants.length > 0) {
          return productVariants.map((variant) => ({
            key: `${product.id}:${variant.id}`,
            product,
            variant,
            name: sellableName(product, variant),
            category,
            stock_quantity: variant.stock_quantity,
          }))
        }

        return [
          {
            key: `${product.id}:base`,
            product,
            variant: null,
            name: product.name,
            category,
            stock_quantity: product.stock_quantity,
          },
        ]
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [categoryById, embedded, products.data, variantsByProduct])

  const categoryOptions = useMemo(() => {
    return Array.from(new Set(itemOptions.map((item) => item.category))).sort((a, b) =>
      a.localeCompare(b)
    )
  }, [itemOptions])

  const filteredItems = useMemo(() => {
    const q = normalizeText(search)
    return itemOptions
      .filter((item) => {
        const categoryMatches =
          categoryFilter === "all" || item.category === categoryFilter
        const text = normalizeText(
          [item.name, item.category, item.product.description].filter(Boolean).join(" ")
        )
        return categoryMatches && (!q || text.includes(q))
      })
      .slice(0, 60)
  }, [categoryFilter, itemOptions, search])

  const halfAndHalfOptions = useMemo(() => {
    return itemOptions.filter(isPizzaOption).sort((a, b) => a.name.localeCompare(b.name))
  }, [itemOptions])

  const canUseHalfAndHalf = halfAndHalfOptions.length >= 2

  useEffect(() => {
    if (!printOrder) return
    const clearPrintedOrder = () => setPrintOrder(null)
    window.addEventListener("afterprint", clearPrintedOrder)
    window.setTimeout(() => window.print(), 150)
    return () => {
      window.removeEventListener("afterprint", clearPrintedOrder)
    }
  }, [printOrder])

  function applyCustomer(nextCustomerId: string) {
    setCustomerId(nextCustomerId)
    const customer = customerOptions.find((item) => item.id === nextCustomerId)
    if (!customer) return
    setCustomerName(customer.name)
    setCustomerPhone(customer.phone ?? "")
  }

  function addItem(option: ProductionItemOption) {
    setFormError(null)
    setCart((current) => {
      const existing = current.findIndex((item) => item.key === option.key)
      if (existing >= 0) {
        const next = [...current]
        next[existing] = { ...next[existing], quantity: next[existing].quantity + 1 }
        return next
      }

      return [
        ...current,
        {
          key: option.key,
          product_id: option.product.id,
          variant_id: option.variant?.id ?? null,
          name: option.name,
          quantity: 1,
          notes: "",
        },
      ]
    })
  }

  function openHalfAndHalfDialog() {
    setFormError(null)
    if (halfAndHalfOptions.length < 2) {
      setFormError("Cadastre pelo menos dois sabores/produtos de pizza.")
      return
    }

    setHalfAndHalfFirstKey(halfAndHalfOptions[0]?.key ?? "")
    setHalfAndHalfSecondKey(halfAndHalfOptions[1]?.key ?? "")
    setHalfAndHalfNotes("")
    setHalfAndHalfDialogOpen(true)
  }

  function addHalfAndHalfItem() {
    const first = halfAndHalfOptions.find((item) => item.key === halfAndHalfFirstKey)
    const second = halfAndHalfOptions.find((item) => item.key === halfAndHalfSecondKey)

    if (!first || !second) {
      setFormError("Selecione os dois sabores.")
      return
    }
    if (first.key === second.key) {
      setFormError("Escolha dois sabores diferentes para o meio a meio.")
      return
    }

    const sortedKeys = [first.key, second.key].sort()
    const key = `half:${sortedKeys[0]}:${sortedKeys[1]}`
    const flavorNote = `1/2 ${first.name}\n1/2 ${second.name}`
    const extraNotes = halfAndHalfNotes.trim()
    const notes = extraNotes ? `${flavorNote}\n${extraNotes}` : flavorNote

    setCart((current) => {
      const existing = current.findIndex((item) => item.key === key)
      if (existing >= 0) {
        const next = [...current]
        next[existing] = {
          ...next[existing],
          quantity: next[existing].quantity + 1,
          notes: next[existing].notes || notes,
        }
        return next
      }

      return [
        ...current,
        {
          key,
          product_id: null,
          variant_id: null,
          name: `PIZZA MEIO A MEIO: ${first.name} / ${second.name}`,
          quantity: 1,
          notes,
          half_and_half: {
            first_name: first.name,
            second_name: second.name,
          },
        },
      ]
    })

    setHalfAndHalfDialogOpen(false)
    setHalfAndHalfNotes("")
  }

  function updateItemQuantity(key: string, quantity: number) {
    setCart((current) =>
      current.map((item) =>
        item.key === key ? { ...item, quantity: Math.max(1, Math.round(quantity || 1)) } : item
      )
    )
  }

  function updateItemNotes(key: string, value: string) {
    setCart((current) =>
      current.map((item) => (item.key === key ? { ...item, notes: value } : item))
    )
  }

  function removeItem(key: string) {
    setCart((current) => current.filter((item) => item.key !== key))
  }

  function resetForm() {
    setCustomerId("")
    setCustomerName("")
    setCustomerPhone("")
    setPriority("normal")
    setPromisedAt("")
    setNotes("")
    setCart([])
    setSearch("")
    setCategoryFilter("all")
  }

  async function handleCreateOrder() {
    setFormError(null)
    const effectiveBranchId = defaultBranchId
    if (!effectiveBranchId) {
      setFormError("Selecione uma filial para o pedido.")
      return
    }
    if (!customerName.trim()) {
      setFormError("Informe o nome do cliente.")
      return
    }
    if (cart.length === 0) {
      setFormError("Adicione pelo menos um item para producao.")
      return
    }

    try {
      const order = await createOrder.mutateAsync({
        branch_id: effectiveBranchId,
        customer_id: customerId || null,
        customer_name: customerName,
        customer_phone: customerPhone || null,
        priority,
        promised_at: promisedAt || null,
        notes: notes || null,
        items: cart.map((item) => ({
          product_id: item.product_id,
          variant_id: item.variant_id,
          product_name: item.name,
          quantity: item.quantity,
          notes: item.notes || null,
        })),
      })
      resetForm()
      setPrintOrder(order)
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Nao foi possivel criar o pedido."
      )
    }
  }

  function handleStatus(order: ProductionOrder) {
    const status = nextStatus(order.status)
    if (!status) return
    void updateStatus.mutateAsync({ orderId: order.id, status })
  }

  function handleCancel(order: ProductionOrder) {
    if (!window.confirm(`Cancelar o pedido ${order.order_code}?`)) return
    void updateStatus.mutateAsync({ orderId: order.id, status: "cancelled" })
  }

  function handleDelete(order: ProductionOrder) {
    if (!window.confirm(`Excluir o pedido ${order.order_code}?`)) return
    void deleteOrder.mutateAsync(order.id)
  }

  const isLoading = products.isLoading || categories.isLoading || variants.isLoading || orders.isLoading
  const loadError = products.error || categories.error || variants.error || orders.error
  const pendingCount = (orders.data ?? []).filter((order) => order.status === "pending").length
  const productionCount = (orders.data ?? []).filter((order) => order.status === "in_production").length
  const readyCount = (orders.data ?? []).filter((order) => order.status === "ready").length
  const formFieldClass = `${fieldClass} ${
    embedded ? "border-gray-700 bg-gray-800 text-white" : ""
  }`
  const formInputClass = embedded
    ? "border-gray-700 bg-gray-800 text-white placeholder:text-gray-500"
    : ""
  const productionControls = (
    <div className="flex flex-wrap items-center gap-2">
      {!embedded ? (
        <Button asChild variant="outline">
          <Link to="/app/pos/sell">
            <ShoppingCart className="size-4" />
            PDV
          </Link>
        </Button>
      ) : null}
      <Input
        className={`w-40 ${
          embedded
            ? "border-gray-700 bg-gray-800 text-white"
            : ""
        }`}
        type="date"
        value={date}
        onChange={(event) => setDate(event.target.value)}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={
          embedded
            ? "border-gray-700 bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white"
            : ""
        }
        onClick={() => void orders.refetch()}
        aria-label="Atualizar pedidos"
      >
        <RefreshCw className="size-4" />
      </Button>
    </div>
  )

  useEffect(() => {
    if (focus !== "overdue-production" || lastAppliedFocusRef.current === focus) return
    lastAppliedFocusRef.current = focus
    setStatusFilter("all")

    window.requestAnimationFrame(() => {
      document.getElementById("pedidos-producao")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
    })
  }, [focus])

  const catalogLoading = products.isLoading || categories.isLoading || variants.isLoading
  const catalogError = products.error || categories.error || variants.error
  const halfAndHalfDialog = (
    <Dialog
      open={halfAndHalfDialogOpen}
      onOpenChange={(open) => {
        setHalfAndHalfDialogOpen(open)
        if (!open) {
          setHalfAndHalfNotes("")
          setFormError(null)
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Utensils className="size-5" />
            Pizza meio a meio
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium">Primeiro sabor</span>
              <select
                className={fieldClass}
                value={halfAndHalfFirstKey}
                onChange={(event) => setHalfAndHalfFirstKey(event.target.value)}
              >
                {halfAndHalfOptions.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Segundo sabor</span>
              <select
                className={fieldClass}
                value={halfAndHalfSecondKey}
                onChange={(event) => setHalfAndHalfSecondKey(event.target.value)}
              >
                {halfAndHalfOptions.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="space-y-1 text-sm">
            <span className="font-bold uppercase text-amber-900">
              Observacao da producao
            </span>
            <textarea
              className="min-h-24 w-full rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-sm font-semibold text-amber-950 outline-none transition-colors placeholder:text-amber-700/60 focus:border-amber-400 focus:ring-3 focus:ring-amber-200"
              value={halfAndHalfNotes}
              onChange={(event) => setHalfAndHalfNotes(event.target.value)}
              placeholder="Borda, ponto da massa, retirar ingrediente..."
            />
          </label>
          {formError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setHalfAndHalfDialogOpen(false)}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={addHalfAndHalfItem}>
            Adicionar pizza
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  if (embedded) {
    const queueStatusFilters: Array<{
      label: string
      value: ProductionOrderStatus | "all"
    }> = [
      { label: "Todos", value: "all" },
      { label: statusLabel.pending, value: "pending" },
      { label: statusLabel.in_production, value: "in_production" },
      { label: statusLabel.ready, value: "ready" },
      { label: statusLabel.delivered, value: "delivered" },
    ]

    return (
      <>
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-gray-950 text-white">
          <div className="shrink-0 border-b border-gray-800 px-3 py-3">
            <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
              <div className="grid flex-1 gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  aria-pressed={statusFilter === "pending"}
                  onClick={() =>
                    setStatusFilter(statusFilter === "pending" ? "all" : "pending")
                  }
                  className={`flex min-h-16 items-center justify-between rounded-lg border px-4 py-2 text-left transition-colors ${
                    statusFilter === "pending"
                      ? "border-yellow-500 bg-yellow-900/35"
                      : "border-gray-800 bg-yellow-950/25 hover:border-yellow-700"
                  }`}
                >
                  <span className="text-xs text-gray-300">Abertos</span>
                  <span className="text-2xl font-black text-yellow-300">
                    {pendingCount}
                  </span>
                </button>
                <button
                  type="button"
                  aria-pressed={statusFilter === "in_production"}
                  onClick={() =>
                    setStatusFilter(
                      statusFilter === "in_production" ? "all" : "in_production"
                    )
                  }
                  className={`flex min-h-16 items-center justify-between rounded-lg border px-4 py-2 text-left transition-colors ${
                    statusFilter === "in_production"
                      ? "border-blue-500 bg-blue-900/35"
                      : "border-gray-800 bg-blue-950/25 hover:border-blue-700"
                  }`}
                >
                  <span className="text-xs text-gray-300">Em producao</span>
                  <span className="text-2xl font-black text-blue-300">
                    {productionCount}
                  </span>
                </button>
                <button
                  type="button"
                  aria-pressed={statusFilter === "ready"}
                  onClick={() =>
                    setStatusFilter(statusFilter === "ready" ? "all" : "ready")
                  }
                  className={`flex min-h-16 items-center justify-between rounded-lg border px-4 py-2 text-left transition-colors ${
                    statusFilter === "ready"
                      ? "border-green-500 bg-green-900/35"
                      : "border-gray-800 bg-green-950/25 hover:border-green-700"
                  }`}
                >
                  <span className="text-xs text-gray-300">Prontos</span>
                  <span className="text-2xl font-black text-green-300">
                    {readyCount}
                  </span>
                </button>
              </div>
              <div className="flex flex-col gap-2 2xl:items-end">
                {productionControls}
                <div className="flex flex-wrap gap-1.5">
                  {queueStatusFilters.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setStatusFilter(item.value)}
                      className={`h-7 rounded-md px-2.5 text-xs font-semibold transition-colors ${
                        statusFilter === item.value
                          ? "bg-orange-500 text-white"
                          : "bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-white"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_23rem] 2xl:grid-cols-[minmax(0,1fr)_25rem]">
            <div
              id="pedidos-producao"
              className="min-h-0 scroll-mt-20 overflow-y-auto p-3"
            >
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-semibold">
                    <ClipboardList className="size-4 text-orange-300" />
                    {onlyOverdueProduction ? "Pedidos atrasados" : "Fila do dia"}
                  </h2>
                  <p className="text-xs text-gray-500">
                    {visibleOrders.length} pedido(s) no filtro atual.
                  </p>
                </div>
                <select
                  className="h-8 rounded-lg border border-gray-700 bg-gray-900 px-2.5 text-sm text-white outline-none focus:border-orange-500"
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as ProductionOrderStatus | "all")
                  }
                >
                  <option value="all">Todos status</option>
                  {(Object.keys(statusLabel) as ProductionOrderStatus[]).map((status) => (
                    <option key={status} value={status}>
                      {statusLabel[status]}
                    </option>
                  ))}
                </select>
              </div>

              {orders.error ? (
                <div className="rounded-lg border border-red-900 bg-red-950/60 p-4 text-sm text-red-200">
                  {orders.error.message}
                </div>
              ) : orders.isLoading ? (
                <div className="rounded-lg border border-dashed border-gray-800 bg-gray-900 px-4 py-12 text-center text-sm text-gray-500">
                  Carregando pedidos de producao...
                </div>
              ) : visibleOrders.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-800 bg-gray-900 px-4 py-12 text-center">
                  <ClipboardList className="mx-auto mb-2 size-7 text-gray-600" />
                  <div className="text-sm font-semibold text-gray-300">
                    Nenhum pedido encontrado
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    Ajuste o filtro ou gere um pedido no painel ao lado.
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {visibleOrders.map((order) => {
                    const expanded = expandedOrderId === order.id
                    const nextOrderStatus = nextStatus(order.status)
                    const orderItems = order.production_order_items ?? []

                    return (
                      <article
                        key={order.id}
                        className={`overflow-hidden rounded-lg border bg-gray-900 transition-colors ${
                          expanded ? "border-orange-500" : "border-gray-800"
                        }`}
                      >
                        <button
                          type="button"
                          className="flex w-full flex-col gap-3 px-3 py-3 text-left transition-colors hover:bg-gray-800/70 sm:flex-row sm:items-center"
                          onClick={() =>
                            setExpandedOrderId((current) =>
                              current === order.id ? null : order.id
                            )
                          }
                        >
                          <div className="w-24 shrink-0">
                            <div className="font-mono text-xs text-gray-500">
                              {order.order_code}
                            </div>
                            <div className="mt-1 text-[11px] text-gray-600">
                              {formatDateTimeBR(order.ordered_at)}
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-bold text-white">
                              {order.priority !== "normal" ? (
                                <span
                                  className={
                                    order.priority === "urgent"
                                      ? "text-red-300"
                                      : "text-yellow-300"
                                  }
                                >
                                  {priorityLabel[order.priority]} -{" "}
                                </span>
                              ) : null}
                              {order.customer_name}
                            </div>
                            <div className="mt-0.5 truncate text-xs text-gray-500">
                              {branchName(activeBranches, order.branch_id)} -{" "}
                              {orderItems.length} item(ns)
                            </div>
                          </div>
                          <div className="flex min-w-24 shrink-0 items-center justify-between gap-2 sm:block sm:text-center">
                            <span className="text-xs text-gray-500">Promessa</span>
                            <div className="text-sm font-bold text-gray-100">
                              {order.promised_at
                                ? formatDateTimeBR(order.promised_at)
                                : "--"}
                            </div>
                          </div>
                          <Badge
                            className="shrink-0 self-start sm:self-center"
                            variant={statusVariant(order.status)}
                          >
                            {statusLabel[order.status]}
                          </Badge>
                        </button>

                        {expanded ? (
                          <div className="space-y-3 border-t border-gray-800 px-3 py-3">
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
                              {order.customer_phone ? (
                                <span>Telefone {order.customer_phone}</span>
                              ) : null}
                              <span>Prioridade {priorityLabel[order.priority]}</span>
                            </div>
                            <div className="space-y-1.5">
                              {orderItems.map((item) => (
                                <div
                                  key={item.id}
                                  className="rounded-lg border border-gray-800 bg-gray-950 px-3 py-2"
                                >
                                  <div className="text-sm font-bold uppercase text-white">
                                    {formatProductionQuantity(item.quantity)}x{" "}
                                    {item.product_name}
                                  </div>
                                  {item.notes ? (
                                    <div className="mt-1 whitespace-pre-wrap rounded-md bg-yellow-950/45 px-2 py-1.5 text-xs font-semibold text-yellow-200">
                                      {item.notes}
                                    </div>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                            {order.notes ? (
                              <div className="rounded-lg border border-orange-900/80 bg-orange-950/35 px-3 py-2 text-xs text-orange-200">
                                {order.notes}
                              </div>
                            ) : null}
                            <div className="flex flex-wrap gap-2">
                              {nextOrderStatus ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  className="bg-blue-600 text-white hover:bg-blue-500"
                                  onClick={() => handleStatus(order)}
                                >
                                  <CheckCircle2 className="size-4" />
                                  {statusLabel[nextOrderStatus]}
                                </Button>
                              ) : null}
                              <Button
                                type="button"
                                size="icon-sm"
                                variant="outline"
                                className="border-gray-700 bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white"
                                onClick={() => setPrintOrder(order)}
                                aria-label="Imprimir pedido"
                              >
                                <Printer className="size-4" />
                              </Button>
                              {order.status !== "cancelled" &&
                              order.status !== "delivered" ? (
                                <Button
                                  type="button"
                                  size="icon-sm"
                                  variant="outline"
                                  className="border-yellow-800 bg-yellow-950/45 text-yellow-200 hover:bg-yellow-900 hover:text-white"
                                  onClick={() => handleCancel(order)}
                                  aria-label="Cancelar pedido"
                                >
                                  <XCircle className="size-4" />
                                </Button>
                              ) : null}
                              <Button
                                type="button"
                                size="icon-sm"
                                variant="destructive"
                                onClick={() => handleDelete(order)}
                                aria-label="Excluir pedido"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </div>
                        ) : null}
                      </article>
                    )
                  })}
                </div>
              )}
            </div>

            <aside className="flex min-h-0 flex-col border-l border-gray-800 bg-gray-900">
              <div className="shrink-0 border-b border-gray-800 px-3 py-3">
                <h2 className="flex items-center gap-2 text-sm font-bold text-orange-300">
                  <PackageCheck className="size-4" />
                  Novo pedido de producao
                </h2>
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
                <label className="block space-y-1 text-xs text-gray-400">
                  <span>Filial</span>
                  <select
                    className={formFieldClass}
                    value={branchId || selectedBranchId || ""}
                    onChange={(event) => setBranchId(event.target.value)}
                  >
                    <option value="">Selecione</option>
                    {activeBranches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-1 text-xs text-gray-400">
                  <span>Cliente cadastrado</span>
                  <select
                    className={formFieldClass}
                    value={customerId}
                    onChange={(event) => applyCustomer(event.target.value)}
                  >
                    <option value="">Cliente avulso</option>
                    {customerOptions.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customerLabel(customer)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-1 text-xs text-gray-400">
                  <span>Cliente / comanda</span>
                  <Input
                    className={formInputClass}
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    placeholder="Nome para identificar o pedido"
                  />
                </label>

                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="block space-y-1 text-xs text-gray-400">
                    <span>Telefone</span>
                    <Input
                      className={formInputClass}
                      value={customerPhone}
                      onChange={(event) => setCustomerPhone(event.target.value)}
                      placeholder="(00) 00000-0000"
                    />
                  </label>
                  <label className="block space-y-1 text-xs text-gray-400">
                    <span>Prioridade</span>
                    <select
                      className={formFieldClass}
                      value={priority}
                      onChange={(event) =>
                        setPriority(event.target.value as ProductionOrderPriority)
                      }
                    >
                      {(Object.keys(priorityLabel) as ProductionOrderPriority[]).map(
                        (item) => (
                          <option key={item} value={item}>
                            {priorityLabel[item]}
                          </option>
                        )
                      )}
                    </select>
                  </label>
                </div>

                <label className="block space-y-1 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <Clock3 className="size-3.5" />
                    Horario prometido
                  </span>
                  <Input
                    className={formInputClass}
                    type="datetime-local"
                    value={promisedAt}
                    onChange={(event) => setPromisedAt(event.target.value)}
                  />
                </label>

                <div className="space-y-2 rounded-lg border border-gray-800 bg-gray-950/60 p-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-gray-300">
                      Adicionar itens
                    </span>
                    {canUseHalfAndHalf ? (
                      <Button
                        type="button"
                        size="sm"
                        className="bg-purple-700 text-white hover:bg-purple-600"
                        onClick={openHalfAndHalfDialog}
                      >
                        <Utensils className="size-4" />
                        Meio a meio
                      </Button>
                    ) : null}
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-gray-500" />
                    <Input
                      className="border-gray-700 bg-gray-800 pl-8 text-white placeholder:text-gray-500"
                      placeholder="Buscar produto real..."
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </div>
                  <select
                    className="h-8 w-full rounded-lg border border-gray-700 bg-gray-800 px-2.5 text-sm text-white outline-none focus:border-orange-500"
                    value={categoryFilter}
                    onChange={(event) => setCategoryFilter(event.target.value)}
                  >
                    <option value="all">Todas categorias</option>
                    {categoryOptions.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                  <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
                    {catalogError ? (
                      <div className="rounded-md border border-red-900 bg-red-950/60 px-2 py-2 text-xs text-red-200">
                        {catalogError.message}
                      </div>
                    ) : catalogLoading ? (
                      <div className="rounded-md border border-dashed border-gray-800 px-2 py-3 text-center text-xs text-gray-500">
                        Carregando catalogo...
                      </div>
                    ) : filteredItems.length === 0 ? (
                      <div className="rounded-md border border-dashed border-gray-800 px-2 py-3 text-center text-xs text-gray-500">
                        Nenhum produto ativo encontrado.
                      </div>
                    ) : (
                      filteredItems.slice(0, 10).map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => addItem(item)}
                          className="flex w-full items-center justify-between gap-2 rounded-md border border-gray-800 bg-gray-900 px-2.5 py-2 text-left text-xs transition-colors hover:border-orange-500 hover:bg-gray-800"
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-semibold text-gray-100">
                              {item.name}
                            </span>
                            <span className="block truncate text-gray-500">
                              {item.category}
                            </span>
                          </span>
                          <span className="shrink-0 text-base font-bold text-orange-300">
                            +
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                <div className="space-y-2 rounded-lg border border-gray-800 bg-gray-950/60 p-2.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-gray-300">Itens</span>
                    <span className="text-gray-500">{cart.length} selecionado(s)</span>
                  </div>
                  {cart.length === 0 ? (
                    <div className="rounded-md border border-dashed border-gray-800 px-3 py-4 text-center text-xs text-gray-500">
                      Clique em um produto para adicionar.
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {cart.map((item) => (
                        <div
                          key={item.key}
                          className="rounded-lg border border-gray-800 bg-gray-900 p-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-xs font-semibold text-white">
                                {item.name}
                              </div>
                              {item.half_and_half ? (
                                <span className="mt-1 inline-block rounded bg-purple-950 px-1.5 py-0.5 text-[11px] text-purple-200">
                                  Meio a meio
                                </span>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              className="rounded p-1 text-gray-500 transition-colors hover:bg-red-950 hover:text-red-300"
                              onClick={() => removeItem(item.key)}
                              aria-label="Remover item"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                          <div className="mt-2 flex items-center gap-1.5">
                            <button
                              type="button"
                              className="size-6 rounded bg-gray-800 text-xs text-gray-200 transition-colors hover:bg-gray-700"
                              onClick={() =>
                                updateItemQuantity(item.key, item.quantity - 1)
                              }
                            >
                              -
                            </button>
                            <Input
                              className="h-6 w-14 border-gray-700 bg-gray-800 px-1 text-center text-xs text-white"
                              type="number"
                              min={1}
                              step={1}
                              value={item.quantity}
                              onChange={(event) =>
                                updateItemQuantity(item.key, Number(event.target.value))
                              }
                            />
                            <button
                              type="button"
                              className="size-6 rounded bg-gray-800 text-xs text-gray-200 transition-colors hover:bg-gray-700"
                              onClick={() =>
                                updateItemQuantity(item.key, item.quantity + 1)
                              }
                            >
                              +
                            </button>
                          </div>
                          <Input
                            className="mt-2 border-gray-700 bg-gray-800 text-xs text-white placeholder:text-gray-500"
                            value={item.notes}
                            onChange={(event) =>
                              updateItemNotes(item.key, event.target.value)
                            }
                            placeholder="Observacao do item"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <label className="block space-y-1 text-xs text-gray-400">
                  <span>Observacoes do pedido</span>
                  <textarea
                    className="min-h-16 w-full rounded-lg border border-gray-700 bg-gray-800 px-2.5 py-2 text-sm text-white outline-none placeholder:text-gray-500 focus:border-orange-500"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Observacoes gerais"
                  />
                </label>

                {formError ? (
                  <div className="rounded-lg border border-red-900 bg-red-950/60 px-3 py-2 text-xs text-red-200">
                    {formError}
                  </div>
                ) : null}
              </div>

              <div className="shrink-0 border-t border-gray-800 p-3">
                <Button
                  type="button"
                  className="h-11 w-full bg-orange-600 font-black text-white hover:bg-orange-500"
                  disabled={createOrder.isPending}
                  onClick={() => void handleCreateOrder()}
                >
                  <Printer className="size-4" />
                  {createOrder.isPending ? "Gerando..." : "Gerar pedido e imprimir"}
                </Button>
              </div>
            </aside>
          </div>
        </section>

        {halfAndHalfDialog}
        {printOrder ? <PrintableProductionOrder order={printOrder} /> : null}
      </>
    )
  }

  return (
    <>
      {embedded ? (
        <div className="flex flex-col gap-2 border-b border-gray-800 bg-gray-950 px-4 py-3 text-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold">Fila de producao</div>
            <div className="text-xs text-gray-500">
              Pedidos e comandas internas do mesmo posto.
            </div>
          </div>
          {productionControls}
        </div>
      ) : (
        <PageHeader
          title="Pedidos de producao"
          description="Lance pedidos para cozinha, padaria e pizzaria sem fluxo financeiro."
          action={productionControls}
        />
      )}

      <div
        className={`grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px] 2xl:grid-cols-[minmax(0,1fr)_420px] ${
          embedded
            ? "min-h-0 flex-1 bg-gray-950 p-3 text-white"
            : "p-4 lg:min-h-[calc(100dvh-8.5rem)] xl:p-4"
        }`}
      >
        <div
          className={`min-h-0 space-y-4 lg:grid lg:gap-4 lg:space-y-0 ${
            embedded
              ? "lg:grid-rows-[auto_minmax(28rem,1fr)]"
              : "lg:grid-rows-[auto_minmax(21rem,0.9fr)_minmax(24rem,1.1fr)]"
          }`}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <button
              type="button"
              aria-pressed={statusFilter === "pending"}
              onClick={() =>
                setStatusFilter(statusFilter === "pending" ? "all" : "pending")
              }
              className={`rounded-xl border p-4 text-left transition-colors ${
                embedded
                  ? "border-gray-800 bg-yellow-900/20 hover:border-yellow-600 hover:bg-yellow-900/30"
                  : "bg-white shadow-sm hover:border-slate-400 hover:bg-slate-50"
              } ${
                statusFilter === "pending"
                  ? embedded
                    ? "border-yellow-500"
                    : "border-amber-400 bg-amber-50"
                  : ""
              }`}
            >
              <div className={`text-xs ${embedded ? "text-gray-400" : "text-muted-foreground"}`}>Abertos</div>
              <div className={`text-2xl font-semibold ${embedded ? "text-yellow-300" : "text-amber-700"}`}>{pendingCount}</div>
            </button>
            <button
              type="button"
              aria-pressed={statusFilter === "in_production"}
              onClick={() =>
                setStatusFilter(
                  statusFilter === "in_production" ? "all" : "in_production"
                )
              }
              className={`rounded-xl border p-4 text-left transition-colors ${
                embedded
                  ? "border-gray-800 bg-blue-900/20 hover:border-blue-600 hover:bg-blue-900/30"
                  : "bg-white shadow-sm hover:border-slate-400 hover:bg-slate-50"
              } ${
                statusFilter === "in_production"
                  ? embedded
                    ? "border-blue-500"
                    : "border-sky-400 bg-sky-50"
                  : ""
              }`}
            >
              <div className={`text-xs ${embedded ? "text-gray-400" : "text-muted-foreground"}`}>Em producao</div>
              <div className={`text-2xl font-semibold ${embedded ? "text-blue-300" : "text-sky-700"}`}>
                {productionCount}
              </div>
            </button>
            <button
              type="button"
              aria-pressed={statusFilter === "ready"}
              onClick={() =>
                setStatusFilter(statusFilter === "ready" ? "all" : "ready")
              }
              className={`rounded-xl border p-4 text-left transition-colors ${
                embedded
                  ? "border-gray-800 bg-green-900/20 hover:border-green-600 hover:bg-green-900/30"
                  : "bg-white shadow-sm hover:border-slate-400 hover:bg-slate-50"
              } ${
                statusFilter === "ready"
                  ? embedded
                    ? "border-green-500"
                    : "border-emerald-400 bg-emerald-50"
                  : ""
              }`}
            >
              <div className={`text-xs ${embedded ? "text-gray-400" : "text-muted-foreground"}`}>Prontos</div>
              <div className={`text-2xl font-semibold ${embedded ? "text-green-300" : "text-emerald-700"}`}>{readyCount}</div>
            </button>
          </div>

          {!embedded ? (
          <Card className="flex min-h-0 flex-col border bg-white shadow-sm">
            <CardHeader className="space-y-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Utensils className="size-5" />
                  Itens para producao
                </CardTitle>
                <div className="flex flex-wrap gap-2">
                  {canUseHalfAndHalf ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={openHalfAndHalfDialog}
                    >
                      <Utensils className="size-4" />
                      Pizza meio a meio
                    </Button>
                  ) : null}
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="w-56 pl-8"
                      placeholder="Buscar pizza, lanche, prato..."
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </div>
                  <select
                    className={`${fieldClass} w-44`}
                    value={categoryFilter}
                    onChange={(event) => setCategoryFilter(event.target.value)}
                  >
                    <option value="all">Todas categorias</option>
                    {categoryOptions.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-y-auto">
              {loadError ? (
                <StateBlock
                  type="error"
                  title="Nao foi possivel carregar a producao"
                  description={loadError.message}
                />
              ) : isLoading ? (
                <StateBlock type="loading" title="Carregando itens" />
              ) : filteredItems.length === 0 ? (
                <StateBlock
                  title="Nenhum item de producao encontrado"
                  description="Cadastre produtos de alimento, pizza, padaria ou cozinha no catalogo."
                />
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredItems.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      className="min-h-28 rounded-lg border bg-white p-3 text-left transition-colors hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-ring"
                      onClick={() => addItem(item)}
                    >
                      <div className="line-clamp-2 text-sm font-semibold">{item.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {item.category}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1">
                        <Badge variant="outline">{item.product.unit}</Badge>
                        {item.product.preparation_time_minutes ? (
                          <Badge variant="secondary">
                            {item.product.preparation_time_minutes} min
                          </Badge>
                        ) : null}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          ) : null}

          <Card
            id="pedidos-producao"
            className={`flex min-h-0 scroll-mt-20 flex-col ${
              embedded
                ? "rounded-xl border-gray-800 bg-gray-900 text-white shadow-none"
                : "border bg-white shadow-sm"
            }`}
          >
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="size-5" />
                  {onlyOverdueProduction ? "Pedidos atrasados" : "Pedidos do dia"}
                </CardTitle>
                <select
                  className={`${fieldClass} w-44 ${
                    embedded ? "border-gray-700 bg-gray-800 text-white" : ""
                  }`}
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as ProductionOrderStatus | "all")
                  }
                >
                  <option value="all">Todos status</option>
                  {(Object.keys(statusLabel) as ProductionOrderStatus[]).map((status) => (
                    <option key={status} value={status}>
                      {statusLabel[status]}
                    </option>
                  ))}
                </select>
              </div>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-y-auto">
              {visibleOrders.length === 0 ? (
                <StateBlock title="Nenhum pedido de producao" />
              ) : (
                <div className="space-y-2">
                  {visibleOrders.map((order) => (
                    <div
                      key={order.id}
                      className={`rounded-lg border p-3 ${
                        embedded ? "border-gray-800 bg-gray-950" : ""
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="font-semibold">{order.order_code}</div>
                            <Badge variant={statusVariant(order.status)}>
                              {statusLabel[order.status]}
                            </Badge>
                            <Badge variant={order.priority === "urgent" ? "destructive" : "outline"}>
                              {priorityLabel[order.priority]}
                            </Badge>
                          </div>
                          <div className={`mt-1 text-sm ${embedded ? "text-gray-400" : "text-muted-foreground"}`}>
                            {order.customer_name} - {branchName(activeBranches, order.branch_id)}
                          </div>
                          <div className={`mt-1 flex flex-wrap gap-2 text-xs ${embedded ? "text-gray-500" : "text-muted-foreground"}`}>
                            <span>Entrada {formatDateTimeBR(order.ordered_at)}</span>
                            {order.promised_at ? (
                              <span>Promessa {formatDateTimeBR(order.promised_at)}</span>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="outline"
                            onClick={() => setPrintOrder(order)}
                            aria-label="Imprimir pedido"
                          >
                            <Printer className="size-4" />
                          </Button>
                          {nextStatus(order.status) ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleStatus(order)}
                            >
                              <CheckCircle2 className="size-4" />
                              {statusLabel[nextStatus(order.status)!]}
                            </Button>
                          ) : null}
                          {order.status !== "cancelled" && order.status !== "delivered" ? (
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="outline"
                              onClick={() => handleCancel(order)}
                              aria-label="Cancelar pedido"
                            >
                              <XCircle className="size-4" />
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="destructive"
                            onClick={() => handleDelete(order)}
                            aria-label="Excluir pedido"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                      <div className={`mt-3 space-y-2 rounded-lg p-2 ${embedded ? "bg-gray-900" : "bg-slate-50"}`}>
                        {(order.production_order_items ?? []).map((item) => (
                          <div
                            key={item.id}
                            className={`rounded-lg border border-l-4 p-3 ${
                              embedded
                                ? "border-gray-800 border-l-orange-500 bg-gray-800"
                                : "border-slate-200 border-l-slate-900 bg-white"
                            }`}
                          >
                            <div className={`text-base font-extrabold uppercase leading-snug ${embedded ? "text-white" : "text-slate-950"}`}>
                              {formatProductionQuantity(item.quantity)}x {item.product_name}
                            </div>
                            {item.notes ? (
                              <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-amber-950">
                                <div className="text-[11px] font-bold uppercase">
                                  Observacao
                                </div>
                                <div className="whitespace-pre-wrap text-sm font-semibold leading-snug">
                                  {item.notes}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="min-h-0">
          <Card
            className={`lg:sticky lg:top-4 lg:flex lg:max-h-[calc(100dvh-9.5rem)] lg:flex-col ${
              embedded
                ? "rounded-xl border-gray-800 bg-gray-900 text-white shadow-none"
                : "border bg-white shadow-sm"
            }`}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PackageCheck className="size-5" />
                Novo pedido
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
              <div className="grid gap-2">
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Filial</span>
                  <select
                    className={formFieldClass}
                    value={branchId || selectedBranchId || ""}
                    onChange={(event) => setBranchId(event.target.value)}
                  >
                    <option value="">Selecione</option>
                    {activeBranches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-medium">Cliente cadastrado</span>
                  <select
                    className={formFieldClass}
                    value={customerId}
                    onChange={(event) => applyCustomer(event.target.value)}
                  >
                    <option value="">Cliente avulso</option>
                    {customerOptions.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customerLabel(customer)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-medium">Nome do cliente</span>
                  <Input
                    className={formInputClass}
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    placeholder="Nome para identificar o pedido"
                  />
                </label>

                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Telefone</span>
                    <Input
                      className={formInputClass}
                      value={customerPhone}
                      onChange={(event) => setCustomerPhone(event.target.value)}
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Prioridade</span>
                    <select
                      className={formFieldClass}
                      value={priority}
                      onChange={(event) =>
                        setPriority(event.target.value as ProductionOrderPriority)
                      }
                    >
                      {(Object.keys(priorityLabel) as ProductionOrderPriority[]).map(
                        (item) => (
                          <option key={item} value={item}>
                            {priorityLabel[item]}
                          </option>
                        )
                      )}
                    </select>
                  </label>
                </div>

                <label className="space-y-1 text-sm">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Clock3 className="size-4" />
                    Horario prometido
                  </span>
                  <Input
                    className={formInputClass}
                    type="datetime-local"
                    value={promisedAt}
                    onChange={(event) => setPromisedAt(event.target.value)}
                  />
                </label>
              </div>

              {embedded ? (
                <div className="space-y-2 rounded-xl border border-gray-800 bg-gray-950/70 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-semibold">Adicionar itens</div>
                    {canUseHalfAndHalf ? (
                      <Button
                        type="button"
                        size="sm"
                        className="bg-purple-700 text-white hover:bg-purple-600"
                        onClick={openHalfAndHalfDialog}
                      >
                        <Utensils className="size-4" />
                        Meio a meio
                      </Button>
                    ) : null}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem]">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-gray-500" />
                      <Input
                        className="border-gray-700 bg-gray-800 pl-8 text-white placeholder:text-gray-500"
                        placeholder="Buscar pizza, lanche, prato..."
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                      />
                    </div>
                    <select
                      className="h-8 w-full rounded-lg border border-gray-700 bg-gray-800 px-2.5 text-sm text-white outline-none focus:border-orange-500"
                      value={categoryFilter}
                      onChange={(event) => setCategoryFilter(event.target.value)}
                    >
                      <option value="all">Categorias</option>
                      {categoryOptions.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
                    {filteredItems.slice(0, 8).map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => addItem(item)}
                        className="flex w-full items-center justify-between gap-2 rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-left text-sm transition-colors hover:border-orange-500 hover:bg-gray-800"
                      >
                        <span className="min-w-0 truncate">{item.name}</span>
                        <span className="shrink-0 text-orange-300">+</span>
                      </button>
                    ))}
                    {!isLoading && filteredItems.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-gray-800 px-3 py-3 text-center text-xs text-gray-500">
                        Nenhum item encontrado.
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="space-y-2 rounded-lg border p-3">
                <div className="text-sm font-medium">Itens</div>
                {cart.length === 0 ? (
                  <div className="rounded-lg border border-dashed bg-slate-50 p-4 text-center text-sm text-muted-foreground">
                    Clique nos itens de producao para adicionar.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {cart.map((item) => (
                      <div
                        key={item.key}
                        className="rounded-lg border border-slate-200 border-l-4 border-l-slate-900 bg-white p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-base font-extrabold uppercase leading-snug text-slate-950">
                              {item.name}
                            </div>
                            {item.half_and_half ? (
                              <Badge variant="secondary" className="mt-1">
                                Meio a meio
                              </Badge>
                            ) : null}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => removeItem(item.key)}
                            aria-label="Remover item"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                        <div className="mt-3 grid gap-2">
                          <label className="grid grid-cols-[90px_1fr] items-center gap-2 text-sm">
                            <span className="font-medium">Qtd.</span>
                            <Input
                              type="number"
                              min={1}
                              step={1}
                              value={item.quantity}
                              onChange={(event) =>
                                updateItemQuantity(item.key, Number(event.target.value))
                              }
                            />
                          </label>
                          <label className="space-y-1 text-sm">
                            <span className="font-bold uppercase text-amber-900">
                              Observacao da producao
                            </span>
                            <textarea
                              className="min-h-20 w-full rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-sm font-semibold text-amber-950 outline-none transition-colors placeholder:text-amber-700/60 focus:border-amber-400 focus:ring-3 focus:ring-amber-200"
                              value={item.notes}
                              onChange={(event) =>
                                updateItemNotes(item.key, event.target.value)
                              }
                              placeholder="Sem cebola, bem assada, retirar borda..."
                            />
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <label className="space-y-1 text-sm">
                <span className="font-bold uppercase text-amber-900">
                  Observacoes do pedido
                </span>
                <textarea
                  className="min-h-20 w-full rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-sm font-semibold text-amber-950 outline-none transition-colors focus:border-amber-400 focus:ring-3 focus:ring-amber-200"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </label>

              {formError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {formError}
                </div>
              ) : null}

              <Button
                type="button"
                className="w-full"
                disabled={createOrder.isPending}
                onClick={() => void handleCreateOrder()}
              >
                <Printer className="size-4" />
                {createOrder.isPending ? "Gerando..." : "Gerar e imprimir pedido"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog
        open={halfAndHalfDialogOpen}
        onOpenChange={(open) => {
          setHalfAndHalfDialogOpen(open)
          if (!open) {
            setHalfAndHalfNotes("")
            setFormError(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Utensils className="size-5" />
              Pizza meio a meio
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium">Primeiro sabor</span>
                <select
                  className={fieldClass}
                  value={halfAndHalfFirstKey}
                  onChange={(event) => setHalfAndHalfFirstKey(event.target.value)}
                >
                  {halfAndHalfOptions.map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Segundo sabor</span>
                <select
                  className={fieldClass}
                  value={halfAndHalfSecondKey}
                  onChange={(event) => setHalfAndHalfSecondKey(event.target.value)}
                >
                  {halfAndHalfOptions.map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="space-y-1 text-sm">
              <span className="font-bold uppercase text-amber-900">
                Observacao da producao
              </span>
              <textarea
                className="min-h-24 w-full rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-sm font-semibold text-amber-950 outline-none transition-colors placeholder:text-amber-700/60 focus:border-amber-400 focus:ring-3 focus:ring-amber-200"
                value={halfAndHalfNotes}
                onChange={(event) => setHalfAndHalfNotes(event.target.value)}
                placeholder="Borda, ponto da massa, retirar ingrediente..."
              />
            </label>
            {formError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {formError}
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setHalfAndHalfDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={addHalfAndHalfItem}>
              Adicionar pizza
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {printOrder ? <PrintableProductionOrder order={printOrder} /> : null}
    </>
  )
}
