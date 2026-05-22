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
  const [halfAndHalfDialogOpen, setHalfAndHalfDialogOpen] = useState(false)
  const [halfAndHalfFirstKey, setHalfAndHalfFirstKey] = useState("")
  const [halfAndHalfSecondKey, setHalfAndHalfSecondKey] = useState("")
  const [halfAndHalfNotes, setHalfAndHalfNotes] = useState("")

  const branches = useBranches()
  const products = useProducts(branchId || selectedBranchId || null)
  const categories = useProductCategories(branchId || selectedBranchId || null)
  const variants = useProductVariants()
  const customers = useCustomers(branchId || selectedBranchId || null, { optional: true })
  const orders = useProductionOrders(date, statusFilter)
  const visibleOrders = useMemo(
    () =>
      (orders.data ?? []).filter(
        (order) =>
          !onlyOverdueProduction ||
          (!["ready", "delivered", "cancelled"].includes(order.status) &&
            isPast(order.promised_at))
      ),
    [onlyOverdueProduction, orders.data]
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
      .filter((product) => product.active && isProductionProduct(product, categoryById.get(product.category_id ?? "")))
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
  }, [categoryById, products.data, variantsByProduct])

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
        className="w-40"
        type="date"
        value={date}
        onChange={(event) => setDate(event.target.value)}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
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

  return (
    <>
      {embedded ? (
        <div className="flex flex-col gap-2 border-b border-slate-200 bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-950">Fila de producao</div>
            <div className="text-xs text-muted-foreground">
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
            ? "bg-slate-100 p-3 lg:min-h-[calc(100dvh-14.5rem)]"
            : "p-4 lg:min-h-[calc(100dvh-8.5rem)] xl:p-4"
        }`}
      >
        <div className="min-h-0 space-y-4 lg:grid lg:grid-rows-[auto_minmax(21rem,0.9fr)_minmax(24rem,1.1fr)] lg:gap-4 lg:space-y-0">
          <div className="grid gap-3 sm:grid-cols-3">
            <button
              type="button"
              aria-pressed={statusFilter === "pending"}
              onClick={() =>
                setStatusFilter(statusFilter === "pending" ? "all" : "pending")
              }
              className={`rounded-lg border bg-white p-4 text-left shadow-sm transition-colors hover:border-slate-400 hover:bg-slate-50 ${
                statusFilter === "pending" ? "border-amber-400 bg-amber-50" : ""
              }`}
            >
              <div className="text-xs text-muted-foreground">Abertos</div>
              <div className="text-2xl font-semibold text-amber-700">{pendingCount}</div>
            </button>
            <button
              type="button"
              aria-pressed={statusFilter === "in_production"}
              onClick={() =>
                setStatusFilter(
                  statusFilter === "in_production" ? "all" : "in_production"
                )
              }
              className={`rounded-lg border bg-white p-4 text-left shadow-sm transition-colors hover:border-slate-400 hover:bg-slate-50 ${
                statusFilter === "in_production" ? "border-sky-400 bg-sky-50" : ""
              }`}
            >
              <div className="text-xs text-muted-foreground">Em producao</div>
              <div className="text-2xl font-semibold text-sky-700">
                {productionCount}
              </div>
            </button>
            <button
              type="button"
              aria-pressed={statusFilter === "ready"}
              onClick={() =>
                setStatusFilter(statusFilter === "ready" ? "all" : "ready")
              }
              className={`rounded-lg border bg-white p-4 text-left shadow-sm transition-colors hover:border-slate-400 hover:bg-slate-50 ${
                statusFilter === "ready" ? "border-emerald-400 bg-emerald-50" : ""
              }`}
            >
              <div className="text-xs text-muted-foreground">Prontos</div>
              <div className="text-2xl font-semibold text-emerald-700">{readyCount}</div>
            </button>
          </div>

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

          <Card
            id="pedidos-producao"
            className="flex min-h-0 scroll-mt-20 flex-col border bg-white shadow-sm"
          >
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="size-5" />
                  {onlyOverdueProduction ? "Pedidos atrasados" : "Pedidos do dia"}
                </CardTitle>
                <select
                  className={`${fieldClass} w-44`}
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
                    <div key={order.id} className="rounded-lg border p-3">
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
                          <div className="mt-1 text-sm text-muted-foreground">
                            {order.customer_name} - {branchName(activeBranches, order.branch_id)}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
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
                      <div className="mt-3 space-y-2 rounded-lg bg-slate-50 p-2">
                        {(order.production_order_items ?? []).map((item) => (
                          <div
                            key={item.id}
                            className="rounded-lg border border-slate-200 border-l-4 border-l-slate-900 bg-white p-3"
                          >
                            <div className="text-base font-extrabold uppercase leading-snug text-slate-950">
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
          <Card className="border bg-white shadow-sm lg:sticky lg:top-4 lg:flex lg:max-h-[calc(100dvh-9.5rem)] lg:flex-col">
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
                    className={fieldClass}
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
                    className={fieldClass}
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
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    placeholder="Nome para identificar o pedido"
                  />
                </label>

                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Telefone</span>
                    <Input
                      value={customerPhone}
                      onChange={(event) => setCustomerPhone(event.target.value)}
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Prioridade</span>
                    <select
                      className={fieldClass}
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
                    type="datetime-local"
                    value={promisedAt}
                    onChange={(event) => setPromisedAt(event.target.value)}
                  />
                </label>
              </div>

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
