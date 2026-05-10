import { useEffect, useMemo, useRef, useState } from "react"
import type { FormEvent, KeyboardEvent } from "react"
import {
  AlertTriangle,
  Ban,
  Barcode,
  Clock3,
  CreditCard,
  History,
  LockKeyhole,
  MapPin,
  Minus,
  PackageCheck,
  Pause,
  Percent,
  Pill,
  Plus,
  ReceiptText,
  RotateCcw,
  Search,
  ShieldCheck,
  ShoppingCart,
  Store,
  Trash2,
  UserPlus,
  Utensils,
  X,
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
  useCompleteSale,
  useCreateCustomer,
  useCreateDeliveryOrder,
  useCreateFiscalDocument,
  useCashSessions,
  useCustomers,
  useEmployees,
  useOrganization,
  useProductVariants,
  useProducts,
  useVerifyPosOperator,
} from "@/hooks/useUnyxData"
import {
  PrintableCoupon,
  type FiscalCouponPrintItem,
  type FiscalCouponPrintPayment,
} from "@/features/pos/FiscalDocumentsPage"
import { formatCurrency, formatDateTimeBR } from "@/lib/format"
import { setSelectedCashSessionId as persistSelectedCashSessionId } from "@/lib/posSession"
import { formatCep, lookupCep } from "@/services/viaCep"
import { useAppStore } from "@/store/useAppStore"
import type {
  BusinessSegment,
  CashSession,
  Customer,
  FiscalDocument,
  PaymentMethod,
  Product,
  ProductVariant,
} from "@/types/domain"

const fieldClass =
  "h-8 w-full rounded-lg border bg-white px-2.5 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50 disabled:cursor-not-allowed disabled:bg-slate-100"

const textareaClass =
  "min-h-16 w-full rounded-lg border bg-white px-2.5 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"

const heldSalesStorageKey = "unyx-pos-held-sales-v1"

const paymentMethodLabel: Record<PaymentMethod, string> = {
  cash: "Dinheiro",
  pix: "PIX",
  debit_card: "Cartao de debito",
  credit_card: "Cartao de credito",
  voucher: "Vale / voucher",
  other: "Outro",
}

const saleModeLabel: Record<BusinessSegment, string> = {
  retail_store: "Varejo",
  supermarket: "Supermercado",
  restaurant: "Restaurante",
  pharmacy: "Farmacia",
  other: "Geral",
}

const saleModeIcon: Record<BusinessSegment, typeof Store> = {
  retail_store: Store,
  supermarket: Barcode,
  restaurant: Utensils,
  pharmacy: Pill,
  other: PackageCheck,
}

type DeliveryFormState = {
  customer_id: string
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
  estimated_delivery_at: string
  notes: string
}

type QuickCustomerForm = {
  name: string
  phone: string
  document: string
  postal_code: string
  address_line: string
  address_number: string
  complement: string
  neighborhood: string
  city: string
  state: string
  reference: string
}

type CartItem = {
  key: string
  product: Product
  variant: ProductVariant | null
  quantity: number
  unit_price: number
  base_price: number
  discount: number
  notes: string
  prescription_checked: boolean
}

type SellableItem = {
  key: string
  product: Product
  variant: ProductVariant | null
  name: string
  barcode: string | null
  sku: string | null
  unit_price: number
  stock_quantity: number
  category: string
  segment: BusinessSegment | "all" | null
}

type PaymentEntry = {
  method: PaymentMethod
  amount: string
}

type HeldSale = {
  id: string
  branch_id: string
  session_id: string | null
  label: string
  created_at: string
  customer_name: string
  selected_customer_id: string
  cart_discount: string
  sale_mode: BusinessSegment
  delivery_enabled: boolean
  delivery_form: DeliveryFormState
  cart: CartItem[]
}

function emptyDeliveryForm(): DeliveryFormState {
  return {
    customer_id: "",
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
    estimated_delivery_at: "",
    notes: "",
  }
}

function emptyQuickCustomerForm(): QuickCustomerForm {
  return {
    name: "",
    phone: "",
    document: "",
    postal_code: "",
    address_line: "",
    address_number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    reference: "",
  }
}

function cartItemTotal(item: CartItem): number {
  return Math.max(0, item.quantity * item.unit_price - item.discount)
}

function cartSubtotal(cart: CartItem[]): number {
  return cart.reduce((sum, item) => sum + item.quantity * item.unit_price, 0)
}

function cartDiscount(cart: CartItem[]): number {
  return cart.reduce((sum, item) => sum + item.discount, 0)
}

function cartTotal(cart: CartItem[]): number {
  return Math.max(0, cartSubtotal(cart) - cartDiscount(cart))
}

function paymentTotal(payments: PaymentEntry[]): number {
  return payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0)
}

function cashChange(payments: PaymentEntry[], total: number): number {
  const paid = paymentTotal(payments)
  return Math.max(0, paid - total)
}

function cartItemName(item: CartItem) {
  return item.variant ? `${item.product.name} - ${item.variant.name}` : item.product.name
}

function sellableName(product: Product, variant: ProductVariant | null) {
  return variant ? `${product.name} - ${variant.name}` : product.name
}

function productCategory(product: Product) {
  return product.product_categories?.name ?? product.category ?? "Sem categoria"
}

function productSegment(product: Product): BusinessSegment | "all" | null {
  return product.product_categories?.segment ?? "all"
}

function tracksInventory(product: Product) {
  return product.track_inventory ?? true
}

function normalizeQuantity(product: Product, stock: number, value: number) {
  const min = product.allow_fractional_quantity ? 0.001 : 1
  const base = product.allow_fractional_quantity
    ? Math.max(min, Number(value) || min)
    : Math.max(1, Math.round(Number(value) || 1))
  if (!tracksInventory(product)) return base
  return Math.min(base, Math.max(min, stock))
}

function itemHasPrescriptionRule(item: CartItem) {
  return item.product.prescription_required || item.product.controlled_substance
}

function itemHasPriceChange(item: CartItem) {
  return Math.abs(item.unit_price - item.base_price) > 0.005
}

function readHeldSales(): HeldSale[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(heldSalesStorageKey)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as HeldSale[]) : []
  } catch {
    return []
  }
}

function writeHeldSales(sales: HeldSale[]) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(heldSalesStorageKey, JSON.stringify(sales.slice(0, 30)))
}

function heldSaleLabel(customerName: string, total: number) {
  const customer = customerName.trim() || "Cliente avulso"
  return `${customer} - ${formatCurrency(total)}`
}

function badgeForStock(item: SellableItem) {
  if (!tracksInventory(item.product)) return "Sem controle"
  if (item.stock_quantity <= 0) return "Sem estoque"
  if (item.stock_quantity <= (item.product.min_stock_quantity ?? 0)) return "Estoque baixo"
  return `${item.stock_quantity} ${item.product.unit}`
}

function formatQuantity(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")
}

function cashSessionTitle(session: CashSession) {
  return session.operational_posts?.name ?? "Caixa sem posto"
}

function cashSessionDescription(session: CashSession) {
  const operator = session.employees?.name ?? "Operador nao informado"
  return `${operator} - Aberto em ${formatDateTimeBR(session.opened_at)}`
}

export function PosSellPage() {
  const selectedBranchId = useAppStore((state) => state.selectedBranchId)
  const cashSessions = useCashSessions(selectedBranchId ?? null)
  const organization = useOrganization()
  const products = useProducts()
  const productVariants = useProductVariants()
  const customers = useCustomers(undefined, { optional: true })
  const createCustomer = useCreateCustomer()
  const completeSale = useCompleteSale()
  const createDelivery = useCreateDeliveryOrder()
  const createFiscalDocument = useCreateFiscalDocument()
  const verifyOperator = useVerifyPosOperator()

  const searchRef = useRef<HTMLInputElement>(null)
  const customerSelectRef = useRef<HTMLSelectElement>(null)
  const cartDiscountRef = useRef<HTMLInputElement>(null)
  const payFormRef = useRef<HTMLFormElement>(null)
  const firstPaymentAmountRef = useRef<HTMLInputElement>(null)
  const quantityInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const discountInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const shortcutHandlerRef = useRef<(event: globalThis.KeyboardEvent) => void>(
    () => undefined
  )
  const [selectedCashSessionIdOverride, setSelectedCashSessionIdOverride] = useState("")
  const openCashSessions = useMemo(
    () =>
      (cashSessions.data ?? []).filter(
        (cashSession) =>
          cashSession.status === "open" &&
          (!selectedBranchId || cashSession.branch_id === selectedBranchId)
      ),
    [cashSessions.data, selectedBranchId]
  )
  const selectedCashSessionId = useMemo(() => {
    if (
      selectedCashSessionIdOverride &&
      openCashSessions.some(
        (cashSession) => cashSession.id === selectedCashSessionIdOverride
      )
    ) {
      return selectedCashSessionIdOverride
    }

    return openCashSessions.length === 1 ? openCashSessions[0].id : ""
  }, [openCashSessions, selectedCashSessionIdOverride])
  const session =
    openCashSessions.find(
      (cashSession) => cashSession.id === selectedCashSessionId
    ) ?? null
  const branchId = selectedBranchId ?? session?.branch_id ?? ""
  const employees = useEmployees(branchId || null)
  const organizationMode = organization.data?.segment ?? "retail_store"

  const saleMode = organizationMode
  const ModeIcon = saleModeIcon[saleMode]

  const [search, setSearch] = useState("")
  const [productsExpanded, setProductsExpanded] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedCartItemKey, setSelectedCartItemKey] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [selectedCustomerId, setSelectedCustomerId] = useState("")
  const [cartDiscount_, setCartDiscount_] = useState("")
  const [managerAuthorization, setManagerAuthorization] = useState("")
  const [prescriptionConfirmed, setPrescriptionConfirmed] = useState(false)
  const [payDialogOpen, setPayDialogOpen] = useState(false)
  const [cashSessionDialogOpen, setCashSessionDialogOpen] = useState(false)
  const [quickCustomerOpen, setQuickCustomerOpen] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [autoPrintCoupon, setAutoPrintCoupon] = useState<{
    document: FiscalDocument
    items: FiscalCouponPrintItem[]
    payments: FiscalCouponPrintPayment[]
  } | null>(null)
  const [cancelReason, setCancelReason] = useState("")
  const [payments, setPayments] = useState<PaymentEntry[]>([
    { method: "cash", amount: "" },
  ])
  const [deliveryEnabled, setDeliveryEnabled] = useState(false)
  const [deliveryCepLoading, setDeliveryCepLoading] = useState(false)
  const [quickCepLoading, setQuickCepLoading] = useState(false)
  const [deliveryForm, setDeliveryForm] = useState<DeliveryFormState>(() =>
    emptyDeliveryForm()
  )
  const [quickCustomerForm, setQuickCustomerForm] = useState<QuickCustomerForm>(() =>
    emptyQuickCustomerForm()
  )
  const [heldSales, setHeldSales] = useState<HeldSale[]>(() => readHeldSales())
  const [saleError, setSaleError] = useState<string | null>(null)
  const [operatorUnlocked, setOperatorUnlocked] = useState(false)
  const [operatorSessionId, setOperatorSessionId] = useState("")
  const [operatorEmployeeId, setOperatorEmployeeId] = useState("")
  const [operatorPassword, setOperatorPassword] = useState("")
  const [operatorError, setOperatorError] = useState<string | null>(null)
  const [operatorDialogDismissedSessionId, setOperatorDialogDismissedSessionId] =
    useState("")

  const allProducts = useMemo(
    () => (products.data ?? []).filter((product) => product.active),
    [products.data]
  )
  const activeVariants = useMemo(
    () => (productVariants.data ?? []).filter((variant) => variant.active),
    [productVariants.data]
  )

  const customerOptions = useMemo(
    () =>
      (customers.data ?? []).filter(
        (customer) =>
          customer.status !== "blocked" &&
          (!branchId || !customer.branch_id || customer.branch_id === branchId)
      ),
    [branchId, customers.data]
  )

  const operatorOptions = useMemo(() => {
    const activeEmployees = (employees.data ?? []).filter(
      (employee) =>
        employee.active && (!branchId || employee.branch_id === branchId)
    )

    if (
      session?.employee_id &&
      !activeEmployees.some((employee) => employee.id === session.employee_id)
    ) {
      return [
        ...activeEmployees,
        {
          id: session.employee_id,
          name: session.employees?.name ?? "Operador do caixa",
          branch_id: session.branch_id,
          active: true,
        },
      ]
    }

    return activeEmployees
  }, [branchId, employees.data, session])

  const variantsByProduct = useMemo(() => {
    const grouped = new Map<string, ProductVariant[]>()
    activeVariants.forEach((variant) => {
      const current = grouped.get(variant.product_id) ?? []
      current.push(variant)
      grouped.set(variant.product_id, current)
    })
    return grouped
  }, [activeVariants])

  const sellableItems = useMemo<SellableItem[]>(() => {
    return allProducts.flatMap((product): SellableItem[] => {
      const variants = variantsByProduct.get(product.id) ?? []
      if (variants.length > 0) {
        return variants.map((variant) => ({
          key: `${product.id}:${variant.id}`,
          product,
          variant,
          name: sellableName(product, variant),
          barcode: variant.barcode ?? product.barcode,
          sku: variant.sku ?? product.sku,
          unit_price: variant.price,
          stock_quantity: variant.stock_quantity,
          category: productCategory(product),
          segment: productSegment(product),
        }))
      }
      return [
        {
          key: `${product.id}:base`,
          product,
          variant: null,
          name: product.name,
          barcode: product.barcode,
          sku: product.sku,
          unit_price: product.price,
          stock_quantity: product.stock_quantity,
          category: productCategory(product),
          segment: productSegment(product),
        },
      ]
    })
  }, [allProducts, variantsByProduct])

  const categoryOptions = useMemo(() => {
    const categories = new Set<string>()
    sellableItems.forEach((item) => {
      const matchesMode =
        item.segment === "all" || !item.segment || item.segment === saleMode
      if (matchesMode) categories.add(item.category)
    })
    return Array.from(categories).sort((a, b) => a.localeCompare(b))
  }, [saleMode, sellableItems])

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase()
    return sellableItems
      .filter((item) => {
        const matchesMode =
          item.segment === "all" || !item.segment || item.segment === saleMode
        const matchesCategory =
          categoryFilter === "all" || item.category === categoryFilter
        const searchText = [
          item.name,
          item.product.name,
          item.barcode,
          item.sku,
          item.category,
          item.product.brand,
          item.product.size_label,
          item.product.dosage,
          item.product.unit,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
        return matchesMode && matchesCategory && (!q || searchText.includes(q))
      })
      .slice(0, q ? 80 : 36)
  }, [categoryFilter, saleMode, search, sellableItems])

  const hasProductSearch = search.trim().length > 0
  const showProductList =
    productsExpanded || hasProductSearch || categoryFilter !== "all"

  const heldSalesForBranch = useMemo(
    () => heldSales.filter((sale) => sale.branch_id === branchId),
    [branchId, heldSales]
  )

  const extraDiscount = Number(cartDiscount_) || 0
  const subtotal = cartSubtotal(cart)
  const itemDiscount = cartDiscount(cart)
  const discountTotal = itemDiscount + extraDiscount
  const deliveryFee = deliveryEnabled ? Number(deliveryForm.delivery_fee) || 0 : 0
  const finalTotal = Math.max(0, cartTotal(cart) - extraDiscount + deliveryFee)
  const totalPaid = paymentTotal(payments)
  const change = cashChange(payments, finalTotal)
  const remaining = Math.max(0, finalTotal - totalPaid)
  const discountRate = subtotal > 0 ? discountTotal / subtotal : 0
  const hasPriceOverride = cart.some(itemHasPriceChange)
  const requiresAuthorization = hasPriceOverride || discountRate > 0.1
  const requiresPrescription = cart.some(itemHasPrescriptionRule)
  const totalUnits = cart.reduce((sum, item) => sum + item.quantity, 0)
  const operatorReady = operatorUnlocked && operatorSessionId === session?.id
  const selectedOperatorEmployeeId =
    operatorSessionId === session?.id && operatorEmployeeId
      ? operatorEmployeeId
      : session?.employee_id ?? ""
  const operatorDialogOpen =
    Boolean(session?.id) &&
    !operatorReady &&
    operatorDialogDismissedSessionId !== session?.id
  const selectedCartItem =
    cart.find((item) => item.key === selectedCartItemKey) ?? cart.at(-1) ?? null

  function focusSearch() {
    window.setTimeout(() => searchRef.current?.focus(), 0)
  }

  function focusAndSelect(input: HTMLInputElement | null | undefined) {
    window.setTimeout(() => {
      input?.focus()
      input?.select()
    }, 0)
  }

  function queueCouponPrint(coupon: {
    document: FiscalDocument
    items: FiscalCouponPrintItem[]
    payments: FiscalCouponPrintPayment[]
  }) {
    setAutoPrintCoupon(coupon)

    const clearPrintedCoupon = () => {
      setAutoPrintCoupon(null)
      window.removeEventListener("afterprint", clearPrintedCoupon)
    }

    window.addEventListener("afterprint", clearPrintedCoupon)
    window.setTimeout(() => window.print(), 150)
  }

  function chooseCashSession(cashSession: CashSession) {
    setSelectedCashSessionIdOverride(cashSession.id)
    persistSelectedCashSessionId(cashSession.branch_id, cashSession.id)
    setCashSessionDialogOpen(false)
    setOperatorUnlocked(false)
    setOperatorSessionId("")
    setOperatorEmployeeId("")
    setOperatorPassword("")
    setOperatorError(null)
    setOperatorDialogDismissedSessionId("")
    setSaleError(null)
    focusSearch()
  }

  function openOperatorDialog() {
    setOperatorDialogDismissedSessionId("")
  }

  function closeOperatorDialog() {
    setOperatorDialogDismissedSessionId(session?.id ?? "")
    setOperatorPassword("")
    setOperatorError(null)
  }

  function handleOperatorBack() {
    closeOperatorDialog()
    if (openCashSessions.length > 1) {
      setCashSessionDialogOpen(true)
    }
  }

  async function handleOperatorUnlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!session) {
      setOperatorError("Abra um caixa antes de liberar o PDV.")
      return
    }
    if (!session.employee_id) {
      setOperatorError("Este caixa foi aberto sem operador vinculado.")
      return
    }
    if (!selectedOperatorEmployeeId) {
      setOperatorError("Selecione o colaborador para acessar o PDV.")
      return
    }
    if (selectedOperatorEmployeeId !== session.employee_id) {
      setOperatorError("Este caixa foi aberto para outro colaborador.")
      return
    }
    if (!operatorPassword.trim()) {
      setOperatorError("Informe a senha do operador.")
      return
    }

    setOperatorError(null)
    try {
      await verifyOperator.mutateAsync({
        session_id: session.id,
        employee_id: selectedOperatorEmployeeId,
        password: operatorPassword,
      })
      setOperatorUnlocked(true)
      setOperatorSessionId(session.id)
      setOperatorEmployeeId(selectedOperatorEmployeeId)
      setOperatorDialogDismissedSessionId(session.id)
      focusSearch()
    } catch (error) {
      setOperatorError(error instanceof Error ? error.message : "Nao foi possivel liberar o PDV.")
    }
  }

  function setHeldSalesPersisted(next: HeldSale[]) {
    setHeldSales(next)
    writeHeldSales(next)
  }

  function resetCurrentSale() {
    setCart([])
    setSelectedCartItemKey("")
    setCustomerName("")
    setSelectedCustomerId("")
    setCartDiscount_("")
    setManagerAuthorization("")
    setPrescriptionConfirmed(false)
    setDeliveryEnabled(false)
    setDeliveryForm(emptyDeliveryForm())
    setPayments([{ method: "cash", amount: "" }])
    setSaleError(null)
    focusSearch()
  }

  function findCustomer(customerId: string) {
    return customerOptions.find((customer) => customer.id === customerId) ?? null
  }

  function applyCustomer(customer: Customer | null) {
    if (!customer) {
      setSelectedCustomerId("")
      setDeliveryForm((current) => ({ ...current, customer_id: "" }))
      return
    }

    setSelectedCustomerId(customer.id)
    setCustomerName(customer.name)
    setDeliveryForm((current) => ({
      ...current,
      customer_id: customer.id,
      customer_phone: customer.phone ?? current.customer_phone,
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

  function applyCustomerById(customerId: string) {
    applyCustomer(findCustomer(customerId))
  }

  function addToCart(item: SellableItem) {
    setSaleError(null)
    if (tracksInventory(item.product) && item.stock_quantity <= 0) {
      setSaleError("Produto sem estoque disponivel.")
      return
    }

    setCart((current) => {
      const existing = current.findIndex((cartItem) => cartItem.key === item.key)
      if (existing >= 0) {
        const updated = [...current]
        const nextQuantity = normalizeQuantity(
          updated[existing].product,
          item.stock_quantity,
          updated[existing].quantity + 1
        )
        if (nextQuantity === updated[existing].quantity && tracksInventory(item.product)) {
          setSaleError("Quantidade limitada pelo estoque.")
        }
        updated[existing] = { ...updated[existing], quantity: nextQuantity }
        return updated
      }

      return [
        ...current,
        {
          key: item.key,
          product: item.product,
          variant: item.variant,
          quantity: 1,
          unit_price: item.unit_price,
          base_price: item.unit_price,
          discount: 0,
          notes: "",
          prescription_checked: false,
        },
      ]
    })
    setSelectedCartItemKey(item.key)
    setSearch("")
    setProductsExpanded(false)
    focusSearch()
  }

  function updateQuantity(itemKey: string, delta: number) {
    setCart((current) =>
      current.map((item) => {
        if (item.key !== itemKey) return item
        const stock = item.variant?.stock_quantity ?? item.product.stock_quantity
        return {
          ...item,
          quantity: normalizeQuantity(item.product, stock, item.quantity + delta),
        }
      })
    )
  }

  function updateQuantityValue(itemKey: string, value: string) {
    setCart((current) =>
      current.map((item) => {
        if (item.key !== itemKey) return item
        const stock = item.variant?.stock_quantity ?? item.product.stock_quantity
        return {
          ...item,
          quantity: normalizeQuantity(item.product, stock, Number(value) || 0),
        }
      })
    )
  }

  function removeFromCart(itemKey: string) {
    const removedIndex = cart.findIndex((item) => item.key === itemKey)
    const nextCart = cart.filter((item) => item.key !== itemKey)
    setCart((current) => current.filter((item) => item.key !== itemKey))
    if (selectedCartItem?.key === itemKey) {
      const nextIndex = Math.min(Math.max(removedIndex, 0), nextCart.length - 1)
      setSelectedCartItemKey(nextCart[nextIndex]?.key ?? "")
    }
    focusSearch()
  }

  function selectCartItemByOffset(offset: number) {
    if (cart.length === 0) {
      setSaleError("Carrinho vazio.")
      focusSearch()
      return
    }

    const currentIndex = selectedCartItem
      ? cart.findIndex((item) => item.key === selectedCartItem.key)
      : cart.length - 1
    const baseIndex = currentIndex >= 0 ? currentIndex : cart.length - 1
    const nextIndex = (baseIndex + offset + cart.length) % cart.length
    setSelectedCartItemKey(cart[nextIndex].key)
    focusSearch()
  }

  function updateSelectedQuantity(delta: number) {
    if (!selectedCartItem) {
      setSaleError("Selecione ou adicione um item.")
      focusSearch()
      return
    }

    updateQuantity(selectedCartItem.key, delta)
    setSelectedCartItemKey(selectedCartItem.key)
    focusSearch()
  }

  function focusSelectedQuantity() {
    if (!selectedCartItem) {
      setSaleError("Adicione um item para alterar quantidade.")
      focusSearch()
      return
    }

    setSelectedCartItemKey(selectedCartItem.key)
    focusAndSelect(quantityInputRefs.current[selectedCartItem.key])
  }

  function focusSelectedDiscount() {
    if (selectedCartItem) {
      setSelectedCartItemKey(selectedCartItem.key)
      focusAndSelect(discountInputRefs.current[selectedCartItem.key])
      return
    }

    focusAndSelect(cartDiscountRef.current)
  }

  function removeSelectedCartItem() {
    if (!selectedCartItem) {
      setSaleError("Nenhum item selecionado para remover.")
      focusSearch()
      return
    }

    removeFromCart(selectedCartItem.key)
  }

  function updateItemPrice(itemKey: string, value: string) {
    setCart((current) =>
      current.map((item) =>
        item.key === itemKey
          ? { ...item, unit_price: Math.max(0, Number(value) || 0) }
          : item
      )
    )
  }

  function updateItemDiscount(itemKey: string, value: string) {
    setCart((current) =>
      current.map((item) =>
        item.key === itemKey
          ? { ...item, discount: Math.min(Math.max(0, Number(value) || 0), item.quantity * item.unit_price) }
          : item
      )
    )
  }

  function updateItemNotes(itemKey: string, value: string) {
    setCart((current) =>
      current.map((item) => (item.key === itemKey ? { ...item, notes: value } : item))
    )
  }

  function togglePrescriptionCheck(itemKey: string, checked: boolean) {
    setCart((current) =>
      current.map((item) =>
        item.key === itemKey ? { ...item, prescription_checked: checked } : item
      )
    )
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return
    event.preventDefault()
    const q = search.trim().toLowerCase()
    const exact = q
      ? sellableItems.find(
          (item) =>
            item.barcode?.toLowerCase() === q ||
            item.sku?.toLowerCase() === q ||
            item.name.toLowerCase() === q
        )
      : null
    const target = exact ?? (filteredProducts.length === 1 ? filteredProducts[0] : null)
    if (!target) {
      setSaleError("Produto nao identificado para adicionar.")
      return
    }
    addToCart(target)
  }

  function openPayDialog() {
    setSaleError(null)
    if (cart.length === 0) {
      setSaleError("Adicione pelo menos um produto.")
      return
    }

    if (!session?.employee_id || !operatorReady) {
      setSaleError("Libere o PDV com a senha do operador do caixa.")
      openOperatorDialog()
      return
    }
    setPayments([{ method: "cash", amount: String(finalTotal.toFixed(2)) }])
    setPayDialogOpen(true)
    focusAndSelect(firstPaymentAmountRef.current)
  }

  function addPaymentLine(method: PaymentMethod = "pix") {
    setPayments((current) => [
      ...current,
      { method, amount: remaining > 0 ? remaining.toFixed(2) : "" },
    ])
  }

  function removePaymentLine(index: number) {
    setPayments((current) => current.filter((_, idx) => idx !== index))
  }

  function updatePaymentMethod(index: number, method: PaymentMethod) {
    setPayments((current) =>
      current.map((payment, idx) => (idx === index ? { ...payment, method } : payment))
    )
  }

  function updatePaymentAmount(index: number, amount: string) {
    setPayments((current) =>
      current.map((payment, idx) => (idx === index ? { ...payment, amount } : payment))
    )
  }

  function fillPaymentRemaining(index: number) {
    const paidByOthers = payments.reduce(
      (sum, payment, idx) => sum + (idx === index ? 0 : Number(payment.amount) || 0),
      0
    )
    updatePaymentAmount(index, Math.max(0, finalTotal - paidByOthers).toFixed(2))
  }

  async function fillDeliveryAddressFromCep() {
    setSaleError(null)
    setDeliveryCepLoading(true)
    try {
      const address = await lookupCep(deliveryForm.postal_code)
      setDeliveryForm((current) => ({
        ...current,
        postal_code: address.cep,
        address_line: address.logradouro || current.address_line,
        complement: current.complement || address.complemento || "",
        neighborhood: address.bairro || current.neighborhood,
        city: address.localidade || current.city,
        state: address.uf || current.state,
      }))
    } catch (error) {
      setSaleError(error instanceof Error ? error.message : "Nao foi possivel buscar o CEP.")
    } finally {
      setDeliveryCepLoading(false)
    }
  }

  async function fillQuickCustomerAddressFromCep() {
    setSaleError(null)
    setQuickCepLoading(true)
    try {
      const address = await lookupCep(quickCustomerForm.postal_code)
      setQuickCustomerForm((current) => ({
        ...current,
        postal_code: address.cep,
        address_line: address.logradouro || current.address_line,
        complement: current.complement || address.complemento || "",
        neighborhood: address.bairro || current.neighborhood,
        city: address.localidade || current.city,
        state: address.uf || current.state,
      }))
    } catch (error) {
      setSaleError(error instanceof Error ? error.message : "Nao foi possivel buscar o CEP.")
    } finally {
      setQuickCepLoading(false)
    }
  }

  async function handleQuickCustomerSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaleError(null)
    try {
      const customer = await createCustomer.mutateAsync({
        branch_id: branchId || null,
        name: quickCustomerForm.name.trim(),
        document: quickCustomerForm.document.trim() || null,
        phone: quickCustomerForm.phone.trim() || null,
        email: null,
        birth_date: null,
        status: "active",
        postal_code: quickCustomerForm.postal_code.trim() || null,
        address_line: quickCustomerForm.address_line.trim() || null,
        address_number: quickCustomerForm.address_number.trim() || null,
        complement: quickCustomerForm.complement.trim() || null,
        neighborhood: quickCustomerForm.neighborhood.trim() || null,
        city: quickCustomerForm.city.trim() || null,
        state: quickCustomerForm.state.trim() || null,
        reference: quickCustomerForm.reference.trim() || null,
        notes: "Criado pelo PDV",
        marketing_opt_in: false,
      })
      applyCustomer(customer)
      setQuickCustomerForm(emptyQuickCustomerForm())
      setQuickCustomerOpen(false)
    } catch (error) {
      setSaleError(error instanceof Error ? error.message : "Nao foi possivel criar o cliente.")
    }
  }

  function holdCurrentSale() {
    if (!branchId || cart.length === 0) {
      setSaleError("Adicione itens antes de colocar a venda em espera.")
      return
    }
    const nextIndex =
      heldSales.reduce((max, sale) => {
        const current = Number(sale.id.replace("held-", ""))
        return Number.isFinite(current) ? Math.max(max, current) : max
      }, 0) + 1
    const held: HeldSale = {
      id: `held-${nextIndex}`,
      branch_id: branchId,
      session_id: session?.id ?? null,
      label: heldSaleLabel(customerName, Math.max(0, cartTotal(cart) - extraDiscount)),
      created_at: new Date().toISOString(),
      customer_name: customerName,
      selected_customer_id: selectedCustomerId,
      cart_discount: cartDiscount_,
      sale_mode: saleMode,
      delivery_enabled: deliveryEnabled,
      delivery_form: deliveryForm,
      cart,
    }
    setHeldSalesPersisted([held, ...heldSales])
    resetCurrentSale()
  }

  function restoreHeldSale(held: HeldSale) {
    setCart(held.cart)
    setSelectedCartItemKey(held.cart.at(-1)?.key ?? "")
    setCustomerName(held.customer_name)
    setSelectedCustomerId(held.selected_customer_id)
    setCartDiscount_(held.cart_discount)
    setDeliveryEnabled(held.delivery_enabled)
    setDeliveryForm(held.delivery_form)
    setHeldSalesPersisted(heldSales.filter((sale) => sale.id !== held.id))
    setSaleError(null)
    focusSearch()
  }

  function restoreLatestHeldSale() {
    if (cart.length > 0) {
      setSaleError("Finalize, limpe ou coloque a venda atual em espera antes de recuperar outra.")
      focusSearch()
      return
    }

    const held = heldSalesForBranch[0]
    if (!held) {
      setSaleError("Nenhuma venda em espera para recuperar.")
      focusSearch()
      return
    }

    restoreHeldSale(held)
  }

  function removeHeldSale(heldId: string) {
    setHeldSalesPersisted(heldSales.filter((sale) => sale.id !== heldId))
  }

  function confirmCancelCurrentSale() {
    if (!cancelReason.trim()) {
      setSaleError("Informe o motivo do cancelamento.")
      return
    }
    setCancelDialogOpen(false)
    setCancelReason("")
    resetCurrentSale()
  }

  function buildSaleNotes() {
    const notes: string[] = [`Modo: ${saleModeLabel[saleMode]}`]
    const itemNotes = cart
      .filter((item) => item.notes.trim())
      .map((item) => `${cartItemName(item)}: ${item.notes.trim()}`)
    if (itemNotes.length > 0) notes.push(`Itens: ${itemNotes.join(" | ")}`)
    if (requiresAuthorization) {
      notes.push(`Autorizacao: ${managerAuthorization.trim()}`)
    }
    if (requiresPrescription) {
      notes.push(`Receita/conferencia: ${prescriptionConfirmed ? "sim" : "nao"}`)
    }
    return notes.join("\n")
  }

  async function handleSaleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!session) return
    setSaleError(null)

    if (cart.length === 0) {
      setSaleError("Adicione pelo menos um produto.")
      return
    }

    if (!session.employee_id || !operatorReady) {
      setSaleError("Libere o PDV com a senha do operador do caixa.")
      openOperatorDialog()
      return
    }

    if (requiresAuthorization && managerAuthorization.trim().length < 3) {
      setSaleError("Informe a autorizacao para desconto ou alteracao de preco.")
      return
    }

    if (requiresPrescription && !prescriptionConfirmed) {
      setSaleError("Confirme a receita ou conferencia farmaceutica.")
      return
    }

    if (saleMode === "pharmacy" && requiresPrescription && !customerName.trim()) {
      setSaleError("Informe o cliente para venda com item controlado ou receita.")
      return
    }

    if (totalPaid < finalTotal - 0.005) {
      setSaleError(`Pagamento insuficiente. Falta ${formatCurrency(remaining)}.`)
      return
    }

    if (deliveryEnabled && !deliveryForm.address_line.trim()) {
      setSaleError("Informe o endereco da entrega.")
      return
    }

    const invalidStock = cart.find((item) => {
      const stock = item.variant?.stock_quantity ?? item.product.stock_quantity
      return tracksInventory(item.product) && item.quantity > stock
    })
    if (invalidStock) {
      setSaleError(`Estoque insuficiente para ${cartItemName(invalidStock)}.`)
      return
    }

    try {
      const saleItems = cart.map((item) => ({
        product_id: item.product.id,
        variant_id: item.variant?.id ?? null,
        product_name: cartItemName(item),
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_amount: item.discount,
        total_amount: cartItemTotal(item),
      }))
      const saleItemsWithDelivery = deliveryFee > 0
        ? [
            ...saleItems,
            {
              product_id: null,
              variant_id: null,
              product_name: "Taxa de entrega",
              quantity: 1,
              unit_price: deliveryFee,
              discount_amount: 0,
              total_amount: deliveryFee,
            },
          ]
        : saleItems
      const salePayments = payments
        .filter((payment) => Number(payment.amount) > 0)
        .map((payment) => ({
          method: payment.method,
          amount: Number(payment.amount),
          change_amount: payment.method === "cash" ? change : 0,
        }))
      const saleId = await completeSale.mutateAsync({
        branch_id: branchId,
        session_id: session.id,
        post_id: session.post_id ?? null,
        operator_employee_id: selectedOperatorEmployeeId,
        operator_password: operatorPassword,
        customer_id: selectedCustomerId || deliveryForm.customer_id || null,
        customer_name: customerName.trim() || null,
        sale_mode: saleMode,
        manager_authorization: requiresAuthorization
          ? managerAuthorization.trim()
          : null,
        discount_amount: discountTotal,
        notes: buildSaleNotes(),
        items: saleItemsWithDelivery,
        payments: salePayments,
      })
      if (deliveryEnabled) {
        await createDelivery.mutateAsync({
          branch_id: branchId,
          sale_id: saleId,
          customer_id: selectedCustomerId || deliveryForm.customer_id || null,
          assigned_employee_id: null,
          source: "pos",
          status: "pending",
          priority: "normal",
          customer_name: customerName.trim() || "Cliente PDV",
          customer_phone: deliveryForm.customer_phone.trim() || null,
          postal_code: deliveryForm.postal_code.trim() || null,
          address_line: deliveryForm.address_line.trim(),
          address_number: deliveryForm.address_number.trim() || null,
          complement: deliveryForm.complement.trim() || null,
          neighborhood: deliveryForm.neighborhood.trim() || null,
          city: deliveryForm.city.trim() || null,
          state: deliveryForm.state.trim() || null,
          reference: deliveryForm.reference.trim() || null,
          courier_name: deliveryForm.courier_name.trim() || null,
          delivery_fee: deliveryFee,
          order_amount: Math.max(0, cartTotal(cart) - extraDiscount),
          payment_status: "paid",
          scheduled_for: null,
          estimated_delivery_at: deliveryForm.estimated_delivery_at || null,
          notes: deliveryForm.notes.trim() || null,
          items: cart.map((item) => ({
            name: cartItemName(item),
            quantity: item.quantity,
            notes: item.notes.trim() || null,
          })),
        })
      }

      let postSaleWarning: string | null = null
      try {
        const document = await createFiscalDocument.mutateAsync({
          sale_id: saleId,
          doc_type: "internal_coupon",
          series: "1",
          notes: "Cupom interno gerado automaticamente ao finalizar a venda.",
        })
        queueCouponPrint({
          document,
          items: saleItemsWithDelivery.map((item, index) => ({
            id: `${saleId}-item-${index}`,
            product_name: item.product_name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_amount: item.total_amount,
          })),
          payments: salePayments.map((payment, index) => ({
            id: `${saleId}-payment-${index}`,
            method: payment.method,
            amount: payment.amount,
          })),
        })
      } catch (error) {
        postSaleWarning =
          error instanceof Error
            ? `Venda finalizada, mas nao foi possivel gerar o cupom automatico: ${error.message}`
            : "Venda finalizada, mas nao foi possivel gerar o cupom automatico."
      }

      setPayDialogOpen(false)
      resetCurrentSale()
      if (postSaleWarning) setSaleError(postSaleWarning)
    } catch (error) {
      setSaleError(error instanceof Error ? error.message : "Nao foi possivel finalizar a venda.")
    }
  }

  useEffect(() => {
    shortcutHandlerRef.current = (event: globalThis.KeyboardEvent) => {
    function isEditableTarget(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) return false
      const tagName = target.tagName
      return (
        target.isContentEditable ||
        tagName === "INPUT" ||
        tagName === "TEXTAREA" ||
        tagName === "SELECT"
      )
    }

    function closeTopDialog() {
      if (payDialogOpen) {
        setPayDialogOpen(false)
        focusSearch()
        return true
      }
      if (quickCustomerOpen) {
        setQuickCustomerOpen(false)
        focusSearch()
        return true
      }
      if (cancelDialogOpen) {
        setCancelDialogOpen(false)
        focusSearch()
        return true
      }
      if (cashSessionDialogOpen) {
        setCashSessionDialogOpen(false)
        focusSearch()
        return true
      }
      if (operatorDialogOpen) {
        closeOperatorDialog()
        focusSearch()
        return true
      }
      return false
    }

    if (event.defaultPrevented || event.altKey || event.metaKey) return

    const target = event.target
    const editableTarget = isEditableTarget(target)
    const searchTarget = target === searchRef.current
    const key = event.key

    if (event.ctrlKey) {
      if (key.toLowerCase() !== "l") return
      event.preventDefault()
      setSearch("")
      setProductsExpanded(false)
      focusSearch()
      return
    }

    if (key === "Escape") {
      event.preventDefault()
      if (!closeTopDialog()) {
        setSearch("")
        setProductsExpanded(false)
        focusSearch()
      }
      return
    }

    if (payDialogOpen) {
      if (key === "F8") {
        event.preventDefault()
        focusAndSelect(firstPaymentAmountRef.current)
        return
      }
      if (key === "F9") {
        event.preventDefault()
        payFormRef.current?.requestSubmit()
        return
      }
      return
    }

    if (quickCustomerOpen || cancelDialogOpen || cashSessionDialogOpen || operatorDialogOpen) {
      return
    }

    if ((key === "ArrowUp" || key === "ArrowDown") && (!editableTarget || searchTarget)) {
      event.preventDefault()
      selectCartItemByOffset(key === "ArrowDown" ? 1 : -1)
      return
    }

    if (event.code === "NumpadAdd" || (!editableTarget && key === "+")) {
      event.preventDefault()
      updateSelectedQuantity(1)
      return
    }

    if (event.code === "NumpadSubtract" || (!editableTarget && key === "-")) {
      event.preventDefault()
      updateSelectedQuantity(-1)
      return
    }

    if (editableTarget && !key.startsWith("F")) return

    switch (key) {
      case "F2":
        event.preventDefault()
        setProductsExpanded(true)
        focusSearch()
        break
      case "F3":
        event.preventDefault()
        customerSelectRef.current?.focus()
        break
      case "F4":
        event.preventDefault()
        focusSelectedQuantity()
        break
      case "F5":
        event.preventDefault()
        focusSelectedDiscount()
        break
      case "F6":
        event.preventDefault()
        holdCurrentSale()
        break
      case "F7":
        event.preventDefault()
        restoreLatestHeldSale()
        break
      case "F8":
        event.preventDefault()
        openPayDialog()
        break
      case "F9":
        event.preventDefault()
        openPayDialog()
        break
      case "F10":
        event.preventDefault()
        if (cart.length === 0) {
          setSaleError("Nenhuma venda em andamento para cancelar.")
          focusSearch()
          return
        }
        setCancelDialogOpen(true)
        break
      case "Delete":
        event.preventDefault()
        removeSelectedCartItem()
        break
    }
    }
  })

  useEffect(() => {
    const handlePosShortcut = (event: globalThis.KeyboardEvent) => {
      shortcutHandlerRef.current(event)
    }
    window.addEventListener("keydown", handlePosShortcut)
    return () => window.removeEventListener("keydown", handlePosShortcut)
  }, [])

  if (cashSessions.isLoading) {
    return (
      <main className="p-6">
        <StateBlock type="loading" title="Verificando caixa" />
      </main>
    )
  }

  if (!session && openCashSessions.length === 0) {
    return (
      <>
        <PageHeader title="PDV - Venda" description="Registre vendas pelo caixa." />
        <div className="p-6">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Nenhum caixa aberto. Acesse <strong>Caixa</strong> para abrir um caixa antes de registrar vendas.
          </div>
        </div>
      </>
    )
  }

  if (!session) {
    return (
      <>
        <PageHeader title="PDV - Venda" description="Escolha o caixa para registrar vendas." />
        <div className="p-6">
          <Card className="border bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="size-5" />
                Selecionar caixa do PDV
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {openCashSessions.map((cashSession) => (
                <button
                  key={cashSession.id}
                  type="button"
                  onClick={() => chooseCashSession(cashSession)}
                  className="flex w-full items-center justify-between rounded-lg border bg-white px-4 py-3 text-left transition-colors hover:border-slate-400 hover:bg-slate-50"
                >
                  <div>
                    <div className="font-medium">{cashSessionTitle(cashSession)}</div>
                    <div className="text-xs text-muted-foreground">
                      {cashSessionDescription(cashSession)}
                    </div>
                  </div>
                  <Badge variant="default">Aberto</Badge>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="PDV - Venda"
        description="Registro de venda, cliente, pagamento e entrega no mesmo fluxo."
        action={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <ModeIcon className="size-3" />
              {saleModeLabel[saleMode]}
            </Badge>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCashSessionDialogOpen(true)}
            >
              <Store className="size-4" />
              {cashSessionTitle(session)}
            </Button>
            <Badge variant="default" className="text-sm">
              Caixa aberto
            </Badge>
            {!operatorReady ? (
              <Button
                type="button"
                variant="outline"
                onClick={openOperatorDialog}
              >
                <LockKeyhole className="size-4" />
                Liberar PDV
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="p-4 sm:p-6">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
          <div className="space-y-4">
            <Card className="border bg-white shadow-sm">
              <CardHeader className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2">
                    <Search className="size-5" />
                    Produtos
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="gap-1">
                      <ModeIcon className="size-3" />
                      {saleModeLabel[saleMode]}
                    </Badge>
                    <Button
                      type="button"
                      size="sm"
                      variant={productsExpanded ? "default" : "outline"}
                      onClick={() => setProductsExpanded((current) => !current)}
                    >
                      {productsExpanded ? "Recolher" : "Mostrar"}
                    </Button>
                  </div>
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    ref={searchRef}
                    className="h-10 pl-9 text-base"
                    placeholder="Produto, codigo, SKU, categoria..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    autoFocus
                  />
                </div>
                <div className="flex gap-1 overflow-x-auto pb-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={categoryFilter === "all" ? "default" : "outline"}
                    onClick={() => setCategoryFilter("all")}
                  >
                    Todas
                  </Button>
                  {categoryOptions.map((category) => (
                    <Button
                      key={category}
                      type="button"
                      size="sm"
                      variant={categoryFilter === category ? "default" : "outline"}
                      onClick={() => setCategoryFilter(category)}
                    >
                      {category}
                    </Button>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {saleError ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {saleError}
                  </div>
                ) : null}
                {!showProductList ? (
                  <div className="rounded-lg border border-dashed bg-slate-50 px-3 py-6 text-center text-sm text-muted-foreground">
                    Produtos recolhidos. Use a busca por codigo/nome ou clique em Mostrar.
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <StateBlock title="Nenhum produto encontrado" />
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                    {filteredProducts.map((item) => {
                      const stockBlocked = tracksInventory(item.product) && item.stock_quantity <= 0
                      const needsPrescription =
                        item.product.prescription_required || item.product.controlled_substance
                      return (
                        <button
                          key={item.key}
                          type="button"
                          className="min-h-32 rounded-lg border bg-white p-3 text-left transition-colors hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-55"
                          onClick={() => addToCart(item)}
                          disabled={stockBlocked}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="line-clamp-2 text-sm font-semibold">
                                {item.name}
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {item.category}
                              </div>
                            </div>
                            {needsPrescription ? (
                              <Badge variant="destructive">
                                <Pill className="size-3" />
                                RX
                              </Badge>
                            ) : null}
                          </div>
                          <div className="mt-3 flex items-end justify-between gap-2">
                            <div>
                              <div className="text-base font-semibold">
                                {formatCurrency(item.unit_price)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {item.product.unit}
                              </div>
                            </div>
                            <Badge variant={stockBlocked ? "destructive" : "outline"}>
                              {badgeForStock(item)}
                            </Badge>
                          </div>
                          {(item.barcode || item.sku) ? (
                            <div className="mt-2 truncate text-xs text-muted-foreground">
                              {item.barcode ?? item.sku}
                            </div>
                          ) : null}
                        </button>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="border bg-white shadow-sm">
              <CardHeader className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="size-5" />
                    Carrinho
                  </CardTitle>
                  <Badge variant="secondary">
                    {cart.length} {cart.length === 1 ? "item" : "itens"}
                  </Badge>
                </div>
                <div className="grid gap-2">
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Cliente cadastrado</span>
                    <div className="flex gap-2">
                      <select
                        ref={customerSelectRef}
                        className={fieldClass}
                        value={selectedCustomerId}
                        onChange={(event) => applyCustomerById(event.target.value)}
                      >
                        <option value="">Cliente avulso</option>
                        {customerOptions.map((customer) => (
                          <option key={customer.id} value={customer.id}>
                            {customer.customer_code} - {customer.name}
                            {customer.phone ? ` (${customer.phone})` : ""}
                          </option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setQuickCustomerOpen(true)}
                        aria-label="Novo cliente"
                      >
                        <UserPlus className="size-4" />
                      </Button>
                    </div>
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Nome no cupom</span>
                    <Input
                      value={customerName}
                      onChange={(event) => setCustomerName(event.target.value)}
                      placeholder="Consumidor final"
                    />
                  </label>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {cart.length === 0 ? (
                  <StateBlock title="Carrinho vazio" description="Adicione produtos para iniciar." />
                ) : (
                  <>
                    <div className="max-h-[48vh] space-y-2 overflow-y-auto pr-1">
                      {cart.map((item) => {
                        const needsPrescription = itemHasPrescriptionRule(item)
                        const isSelected = selectedCartItem?.key === item.key
                        return (
                          <div
                            key={item.key}
                            tabIndex={0}
                            onClick={() => setSelectedCartItemKey(item.key)}
                            onFocus={() => setSelectedCartItemKey(item.key)}
                            className={`rounded-lg border p-2.5 outline-none transition-colors ${
                              isSelected
                                ? "border-slate-900 bg-slate-50 ring-2 ring-slate-200"
                                : "bg-white focus:border-slate-400"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold">
                                  {cartItemName(item)}
                                </div>
                                <div className="flex flex-wrap gap-1 pt-1">
                                  <Badge variant="outline">
                                    {formatCurrency(cartItemTotal(item))}
                                  </Badge>
                                  {itemHasPriceChange(item) ? (
                                    <Badge variant="destructive">
                                      <ShieldCheck className="size-3" />
                                      Preco
                                    </Badge>
                                  ) : null}
                                  {needsPrescription ? (
                                    <Badge variant="destructive">
                                      <Pill className="size-3" />
                                      Receita
                                    </Badge>
                                  ) : null}
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => removeFromCart(item.key)}
                                aria-label="Remover item"
                              >
                                <X className="size-4" />
                              </Button>
                            </div>

                            <div className="mt-2 grid grid-cols-[auto_64px_auto_1fr] items-center gap-1.5">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon-sm"
                                onClick={() => updateQuantity(item.key, -1)}
                              >
                                <Minus className="size-3" />
                              </Button>
                              <input
                                ref={(node) => {
                                  quantityInputRefs.current[item.key] = node
                                }}
                                type="number"
                                min={item.product.allow_fractional_quantity ? "0.001" : "1"}
                                step={item.product.allow_fractional_quantity ? "0.001" : "1"}
                                className="h-7 rounded border px-1.5 text-center text-sm font-medium outline-none focus:border-ring"
                                value={formatQuantity(item.quantity)}
                                onFocus={() => setSelectedCartItemKey(item.key)}
                                onChange={(event) =>
                                  updateQuantityValue(item.key, event.target.value)
                                }
                                aria-label="Quantidade"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon-sm"
                                onClick={() => updateQuantity(item.key, 1)}
                              >
                                <Plus className="size-3" />
                              </Button>
                              <div className="grid grid-cols-2 gap-1">
                                <label className="flex items-center gap-1">
                                  <span className="text-xs text-muted-foreground">R$</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    className="h-7 min-w-0 rounded border px-1.5 text-xs outline-none focus:border-ring"
                                    value={item.unit_price}
                                    onFocus={() => setSelectedCartItemKey(item.key)}
                                    onChange={(event) =>
                                      updateItemPrice(item.key, event.target.value)
                                    }
                                  />
                                </label>
                                <label className="flex items-center gap-1">
                                  <Percent className="size-3 text-muted-foreground" />
                                  <input
                                    ref={(node) => {
                                      discountInputRefs.current[item.key] = node
                                    }}
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    className="h-7 min-w-0 rounded border px-1.5 text-xs outline-none focus:border-ring"
                                    value={item.discount || ""}
                                    onFocus={() => setSelectedCartItemKey(item.key)}
                                    onChange={(event) =>
                                      updateItemDiscount(item.key, event.target.value)
                                    }
                                  />
                                </label>
                              </div>
                            </div>

                            {(saleMode === "restaurant" || saleMode === "pharmacy" || needsPrescription) ? (
                              <div className="mt-2 space-y-2">
                                {saleMode === "restaurant" ? (
                                  <label className="space-y-1 text-xs">
                                    <span className="font-medium">Observacao do item</span>
                                    <Input
                                      className="h-7 text-xs"
                                      value={item.notes}
                                      onChange={(event) =>
                                        updateItemNotes(item.key, event.target.value)
                                      }
                                      placeholder="Sem cebola, ponto da carne..."
                                    />
                                  </label>
                                ) : null}
                                {needsPrescription ? (
                                  <label className="flex items-center gap-2 text-xs font-medium">
                                    <input
                                      type="checkbox"
                                      checked={item.prescription_checked}
                                      onChange={(event) =>
                                        togglePrescriptionCheck(item.key, event.target.checked)
                                      }
                                    />
                                    Receita/conferencia do item
                                  </label>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>

                    <div className="grid gap-2 border-t pt-3">
                      <label className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-muted-foreground">Desconto venda R$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0,00"
                          className="h-8 w-28 rounded border px-2 text-sm outline-none focus:border-ring"
                          ref={cartDiscountRef}
                          value={cartDiscount_}
                          onChange={(event) => setCartDiscount_(event.target.value)}
                        />
                      </label>
                      {requiresAuthorization ? (
                        <label className="space-y-1 text-sm">
                          <span className="font-medium">Autorizacao</span>
                          <Input
                            value={managerAuthorization}
                            onChange={(event) =>
                              setManagerAuthorization(event.target.value)
                            }
                            placeholder="Responsavel"
                          />
                        </label>
                      ) : null}
                    </div>

                    <div className="rounded-lg border bg-slate-50 p-3 text-sm">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Subtotal</span>
                        <span>{formatCurrency(subtotal)}</span>
                      </div>
                      {discountTotal > 0 ? (
                        <div className="flex justify-between text-red-600">
                          <span>Descontos</span>
                          <span>- {formatCurrency(discountTotal)}</span>
                        </div>
                      ) : null}
                      {deliveryFee > 0 ? (
                        <div className="flex justify-between text-muted-foreground">
                          <span>Taxa de entrega</span>
                          <span>{formatCurrency(deliveryFee)}</span>
                        </div>
                      ) : null}
                      <div className="mt-1 flex justify-between border-t pt-2 text-lg font-semibold">
                        <span>Total</span>
                        <span>{formatCurrency(finalTotal)}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button type="button" onClick={openPayDialog}>
                        <CreditCard className="size-4" />
                        Pagamento
                      </Button>
                      <Button type="button" variant="outline" onClick={holdCurrentSale}>
                        <Pause className="size-4" />
                        Espera
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setCancelDialogOpen(true)}
                      >
                        <Ban className="size-4" />
                        Cancelar
                      </Button>
                      <Button type="button" variant="outline" onClick={resetCurrentSale}>
                        <Trash2 className="size-4" />
                        Limpar
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="border bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="size-5" />
                  Em espera
                  {heldSalesForBranch.length > 0 ? (
                    <Badge variant="secondary">{heldSalesForBranch.length}</Badge>
                  ) : null}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {heldSalesForBranch.length === 0 ? (
                  <StateBlock title="Nenhuma venda em espera" />
                ) : (
                  <div className="space-y-2">
                    {heldSalesForBranch.map((held) => (
                      <div
                        key={held.id}
                        className="flex items-center justify-between gap-2 rounded-lg border p-2"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">
                            {held.label}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(held.created_at).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="outline"
                            onClick={() => restoreHeldSale(held)}
                            aria-label="Retomar venda"
                          >
                            <RotateCcw className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => removeHeldSale(held.id)}
                            aria-label="Excluir venda em espera"
                          >
                            <X className="size-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
        <div className="sticky bottom-0 z-20 mt-4 -mx-4 border-t bg-white/95 px-4 py-2 shadow-sm backdrop-blur sm:-mx-6 sm:px-6">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            {[
              ["F2", "Produto"],
              ["F3", "Cliente"],
              ["F4", "Qtd"],
              ["F5", "Desc"],
              ["F6", "Espera"],
              ["F7", "Retomar"],
              ["F8", "Pagar"],
              ["F9", "Confirmar"],
              ["Esc", "Voltar"],
              ["Del", "Item"],
              ["+/-", "Qtd"],
            ].map(([key, label]) => (
              <span key={`${key}-${label}`} className="inline-flex items-center gap-1">
                <kbd className="rounded border bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-900">
                  {key}
                </kbd>
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <Dialog open={cashSessionDialogOpen} onOpenChange={setCashSessionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Store className="size-5" />
              Escolher caixa do PDV
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {openCashSessions.map((cashSession) => (
              <button
                key={cashSession.id}
                type="button"
                onClick={() => chooseCashSession(cashSession)}
                className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors hover:border-slate-400 ${
                  cashSession.id === session.id
                    ? "border-slate-900 bg-slate-50"
                    : "bg-white"
                }`}
              >
                <div>
                  <div className="font-medium">{cashSessionTitle(cashSession)}</div>
                  <div className="text-xs text-muted-foreground">
                    {cashSessionDescription(cashSession)}
                  </div>
                </div>
                {cashSession.id === session.id ? (
                  <Badge variant="default">Selecionado</Badge>
                ) : (
                  <Badge variant="outline">Aberto</Badge>
                )}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={operatorDialogOpen}
        onOpenChange={(open) => {
          if (open) {
            openOperatorDialog()
            return
          }
          closeOperatorDialog()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LockKeyhole className="size-5" />
              Liberar PDV
            </DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(event) => void handleOperatorUnlock(event)}>
            <div className="rounded-lg border bg-slate-50 p-3 text-sm">
              <div className="text-muted-foreground">Caixa aberto para</div>
              <div className="font-semibold">
                {session.employees?.name ?? "Caixa sem operador"}
              </div>
            </div>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Colaborador</span>
              <select
                className={fieldClass}
                value={selectedOperatorEmployeeId}
                onChange={(event) => {
                  setOperatorSessionId(session.id)
                  setOperatorUnlocked(false)
                  setOperatorEmployeeId(event.target.value)
                  setOperatorPassword("")
                  setOperatorError(null)
                }}
                disabled={!session || employees.isLoading}
              >
                <option value="">Selecione o colaborador</option>
                {operatorOptions.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                  </option>
                ))}
              </select>
              <span className="block text-xs text-muted-foreground">
                Para liberar o PDV, selecione o mesmo colaborador responsavel pelo caixa.
              </span>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Senha do PDV</span>
              <Input
                autoFocus
                type="password"
                value={operatorSessionId === session.id ? operatorPassword : ""}
                onChange={(event) => {
                  setOperatorSessionId(session.id)
                  setOperatorUnlocked(false)
                  setOperatorPassword(event.target.value)
                }}
              />
            </label>
            {operatorError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {operatorError}
              </div>
            ) : null}
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleOperatorBack}
              >
                Voltar
              </Button>
              <Button
                type="submit"
                disabled={verifyOperator.isPending || !session.employee_id}
              >
                Liberar venda
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ReceiptText className="size-5" />
              Pagamento
            </DialogTitle>
          </DialogHeader>
          <form
            ref={payFormRef}
            className="space-y-4"
            onSubmit={(event) => void handleSaleSubmit(event)}
          >
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border bg-slate-50 p-3">
                <div className="text-xs text-muted-foreground">Itens</div>
                <div className="text-xl font-semibold">{formatQuantity(totalUnits)}</div>
              </div>
              <div className="rounded-lg border bg-slate-50 p-3">
                <div className="text-xs text-muted-foreground">Total</div>
                <div className="text-xl font-semibold">{formatCurrency(finalTotal)}</div>
              </div>
              <div className="rounded-lg border bg-slate-50 p-3">
                <div className="text-xs text-muted-foreground">Falta</div>
                <div className={remaining > 0.005 ? "text-xl font-semibold text-red-600" : "text-xl font-semibold text-emerald-700"}>
                  {formatCurrency(remaining)}
                </div>
              </div>
            </div>

            {(requiresAuthorization || requiresPrescription) ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <div className="flex items-center gap-2 font-medium">
                  <AlertTriangle className="size-4" />
                  Conferencia necessaria
                </div>
                {requiresAuthorization ? (
                  <label className="mt-2 block space-y-1">
                    <span>Autorizacao</span>
                    <Input
                      value={managerAuthorization}
                      onChange={(event) => setManagerAuthorization(event.target.value)}
                      placeholder="Responsavel"
                    />
                  </label>
                ) : null}
                {requiresPrescription ? (
                  <label className="mt-2 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={prescriptionConfirmed}
                      onChange={(event) =>
                        setPrescriptionConfirmed(event.target.checked)
                      }
                    />
                    Receita ou conferencia farmaceutica confirmada
                  </label>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-3 rounded-lg border p-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={deliveryEnabled}
                  onChange={(event) => setDeliveryEnabled(event.target.checked)}
                />
                <MapPin className="size-4" />
                Gerar entrega
              </label>
              {deliveryEnabled ? (
                <div className="space-y-3 border-t pt-3">
                  <div className="grid gap-2 md:grid-cols-[1fr_150px]">
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">Cliente da entrega</span>
                      <select
                        className={fieldClass}
                        value={deliveryForm.customer_id || selectedCustomerId}
                        onChange={(event) => applyCustomerById(event.target.value)}
                      >
                        <option value="">Cliente avulso</option>
                        {customerOptions.map((customer) => (
                          <option key={customer.id} value={customer.id}>
                            {customer.customer_code} - {customer.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">Taxa</span>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={deliveryForm.delivery_fee}
                        onChange={(event) =>
                          setDeliveryForm((current) => ({
                            ...current,
                            delivery_fee: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>
                  <div className="grid gap-2 md:grid-cols-[130px_1fr_auto]">
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">CEP</span>
                      <Input
                        value={formatCep(deliveryForm.postal_code)}
                        onChange={(event) =>
                          setDeliveryForm((current) => ({
                            ...current,
                            postal_code: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">Endereco</span>
                      <Input
                        required={deliveryEnabled}
                        value={deliveryForm.address_line}
                        onChange={(event) =>
                          setDeliveryForm((current) => ({
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
                        onClick={() => void fillDeliveryAddressFromCep()}
                        disabled={deliveryCepLoading}
                      >
                        <MapPin className="size-4" />
                        CEP
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-2 md:grid-cols-4">
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">Numero</span>
                      <Input
                        value={deliveryForm.address_number}
                        onChange={(event) =>
                          setDeliveryForm((current) => ({
                            ...current,
                            address_number: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">Compl.</span>
                      <Input
                        value={deliveryForm.complement}
                        onChange={(event) =>
                          setDeliveryForm((current) => ({
                            ...current,
                            complement: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="space-y-1 text-sm md:col-span-2">
                      <span className="font-medium">Bairro</span>
                      <Input
                        value={deliveryForm.neighborhood}
                        onChange={(event) =>
                          setDeliveryForm((current) => ({
                            ...current,
                            neighborhood: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>
                  <div className="grid gap-2 md:grid-cols-[1fr_80px_1fr]">
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">Cidade</span>
                      <Input
                        value={deliveryForm.city}
                        onChange={(event) =>
                          setDeliveryForm((current) => ({
                            ...current,
                            city: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">UF</span>
                      <Input
                        maxLength={2}
                        value={deliveryForm.state}
                        onChange={(event) =>
                          setDeliveryForm((current) => ({
                            ...current,
                            state: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">Telefone</span>
                      <Input
                        value={deliveryForm.customer_phone}
                        onChange={(event) =>
                          setDeliveryForm((current) => ({
                            ...current,
                            customer_phone: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">Referencia</span>
                      <Input
                        value={deliveryForm.reference}
                        onChange={(event) =>
                          setDeliveryForm((current) => ({
                            ...current,
                            reference: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">Previsao</span>
                      <Input
                        type="datetime-local"
                        value={deliveryForm.estimated_delivery_at}
                        onChange={(event) =>
                          setDeliveryForm((current) => ({
                            ...current,
                            estimated_delivery_at: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Observacoes</span>
                    <textarea
                      className={textareaClass}
                      value={deliveryForm.notes}
                      onChange={(event) =>
                        setDeliveryForm((current) => ({
                          ...current,
                          notes: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
              ) : null}
            </div>

            <div className="grid gap-2">
              <div className="flex flex-wrap gap-1">
                {(Object.keys(paymentMethodLabel) as PaymentMethod[]).map((method) => (
                  <Button
                    key={method}
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => addPaymentLine(method)}
                  >
                    {paymentMethodLabel[method]}
                  </Button>
                ))}
              </div>
              {payments.map((payment, index) => (
                <div key={index} className="grid grid-cols-[1fr_120px_auto_auto] gap-2">
                  <select
                    className={fieldClass}
                    value={payment.method}
                    onChange={(event) =>
                      updatePaymentMethod(index, event.target.value as PaymentMethod)
                    }
                  >
                    {(Object.keys(paymentMethodLabel) as PaymentMethod[]).map((method) => (
                      <option key={method} value={method}>
                        {paymentMethodLabel[method]}
                      </option>
                    ))}
                  </select>
                  <Input
                    ref={index === 0 ? firstPaymentAmountRef : undefined}
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    value={payment.amount}
                    onChange={(event) => updatePaymentAmount(index, event.target.value)}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => fillPaymentRemaining(index)}
                    aria-label="Preencher restante"
                  >
                    <Clock3 className="size-4" />
                  </Button>
                  {payments.length > 1 ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => removePaymentLine(index)}
                      aria-label="Remover pagamento"
                    >
                      <X className="size-4" />
                    </Button>
                  ) : (
                    <span />
                  )}
                </div>
              ))}
            </div>

            <div className="rounded-lg border p-3 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Total pago</span>
                <span className={totalPaid >= finalTotal ? "text-emerald-700" : "text-red-600"}>
                  {formatCurrency(totalPaid)}
                </span>
              </div>
              {change > 0 ? (
                <div className="flex justify-between font-semibold text-emerald-700">
                  <span>Troco</span>
                  <span>{formatCurrency(change)}</span>
                </div>
              ) : null}
              {remaining > 0.005 ? (
                <div className="flex justify-between font-semibold text-red-600">
                  <span>Falta pagar</span>
                  <span>{formatCurrency(remaining)}</span>
                </div>
              ) : null}
            </div>

            {saleError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {saleError}
              </div>
            ) : null}

            <DialogFooter>
              <Button
                type="submit"
                disabled={
                  completeSale.isPending ||
                  createDelivery.isPending ||
                  createFiscalDocument.isPending ||
                  totalPaid < finalTotal - 0.005
                }
              >
                <CreditCard className="size-4" />
                Confirmar venda
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={quickCustomerOpen} onOpenChange={setQuickCustomerOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="size-5" />
              Cliente rapido
            </DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={(event) => void handleQuickCustomerSubmit(event)}>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium">Nome</span>
                <Input
                  required
                  value={quickCustomerForm.name}
                  onChange={(event) =>
                    setQuickCustomerForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Telefone</span>
                <Input
                  value={quickCustomerForm.phone}
                  onChange={(event) =>
                    setQuickCustomerForm((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <div className="grid gap-3 md:grid-cols-[1fr_130px_auto]">
              <label className="space-y-1 text-sm">
                <span className="font-medium">Documento</span>
                <Input
                  value={quickCustomerForm.document}
                  onChange={(event) =>
                    setQuickCustomerForm((current) => ({
                      ...current,
                      document: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">CEP</span>
                <Input
                  value={formatCep(quickCustomerForm.postal_code)}
                  onChange={(event) =>
                    setQuickCustomerForm((current) => ({
                      ...current,
                      postal_code: event.target.value,
                    }))
                  }
                />
              </label>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void fillQuickCustomerAddressFromCep()}
                  disabled={quickCepLoading}
                >
                  <MapPin className="size-4" />
                  CEP
                </Button>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-[1fr_110px_1fr]">
              <label className="space-y-1 text-sm">
                <span className="font-medium">Endereco</span>
                <Input
                  value={quickCustomerForm.address_line}
                  onChange={(event) =>
                    setQuickCustomerForm((current) => ({
                      ...current,
                      address_line: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Numero</span>
                <Input
                  value={quickCustomerForm.address_number}
                  onChange={(event) =>
                    setQuickCustomerForm((current) => ({
                      ...current,
                      address_number: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Complemento</span>
                <Input
                  value={quickCustomerForm.complement}
                  onChange={(event) =>
                    setQuickCustomerForm((current) => ({
                      ...current,
                      complement: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_80px]">
              <label className="space-y-1 text-sm">
                <span className="font-medium">Bairro</span>
                <Input
                  value={quickCustomerForm.neighborhood}
                  onChange={(event) =>
                    setQuickCustomerForm((current) => ({
                      ...current,
                      neighborhood: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Cidade</span>
                <Input
                  value={quickCustomerForm.city}
                  onChange={(event) =>
                    setQuickCustomerForm((current) => ({
                      ...current,
                      city: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">UF</span>
                <Input
                  maxLength={2}
                  value={quickCustomerForm.state}
                  onChange={(event) =>
                    setQuickCustomerForm((current) => ({
                      ...current,
                      state: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Referencia</span>
              <Input
                value={quickCustomerForm.reference}
                onChange={(event) =>
                  setQuickCustomerForm((current) => ({
                    ...current,
                    reference: event.target.value,
                  }))
                }
              />
            </label>
            <DialogFooter>
              <Button type="submit" disabled={createCustomer.isPending}>
                <UserPlus className="size-4" />
                Salvar cliente
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="size-5" />
              Cancelar venda atual
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <label className="space-y-1 text-sm">
              <span className="font-medium">Motivo</span>
              <textarea
                className={textareaClass}
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
              />
            </label>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCancelDialogOpen(false)}
              >
                Voltar
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={confirmCancelCurrentSale}
              >
                Cancelar venda
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {autoPrintCoupon ? (
        <PrintableCoupon
          document={autoPrintCoupon.document}
          items={autoPrintCoupon.items}
          payments={autoPrintCoupon.payments}
        />
      ) : null}
    </>
  )
}
