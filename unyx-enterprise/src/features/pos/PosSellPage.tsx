import { useMemo, useState } from "react"
import type { FormEvent } from "react"
import {
  CreditCard,
  MapPin,
  Minus,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
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
  useCreateDeliveryOrder,
  useCurrentCashSession,
  useProductVariants,
  useProducts,
} from "@/hooks/useUnyxData"
import { formatCurrency } from "@/lib/format"
import { useAppStore } from "@/store/useAppStore"
import type { PaymentMethod, Product, ProductVariant } from "@/types/domain"

const fieldClass =
  "h-8 w-full rounded-lg border bg-white px-2.5 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"

const paymentMethodLabel: Record<PaymentMethod, string> = {
  cash: "Dinheiro",
  pix: "PIX",
  debit_card: "Cartao de debito",
  credit_card: "Cartao de credito",
  voucher: "Vale / voucher",
  other: "Outro",
}

type CartItem = {
  key: string
  product: Product
  variant: ProductVariant | null
  quantity: number
  unit_price: number
  discount: number
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
}

type PaymentEntry = {
  method: PaymentMethod
  amount: string
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
  return payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
}

function cashChange(payments: PaymentEntry[], total: number): number {
  const cash = payments
    .filter((p) => p.method === "cash")
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
  const nonCash = payments
    .filter((p) => p.method !== "cash")
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
  return Math.max(0, cash + nonCash - total)
}

function cartItemName(item: CartItem) {
  return item.variant ? `${item.product.name} - ${item.variant.name}` : item.product.name
}

function sellableName(product: Product, variant: ProductVariant | null) {
  return variant ? `${product.name} - ${variant.name}` : product.name
}

function normalizeQuantity(product: Product, value: number) {
  if (product.allow_fractional_quantity) return Math.max(0.001, value)
  return Math.max(1, Math.round(value))
}

export function PosSellPage() {
  const selectedBranchId = useAppStore((state) => state.selectedBranchId)
  const currentSession = useCurrentCashSession()
  const products = useProducts()
  const productVariants = useProductVariants()
  const completeSale = useCompleteSale()
  const createDelivery = useCreateDeliveryOrder()

  const session = currentSession.data ?? null
  const allProducts = useMemo(
    () => (products.data ?? []).filter((p) => p.active),
    [products.data]
  )
  const activeVariants = useMemo(
    () => (productVariants.data ?? []).filter((variant) => variant.active),
    [productVariants.data]
  )

  const [search, setSearch] = useState("")
  const [cart, setCart] = useState<CartItem[]>([])
  const [customerName, setCustomerName] = useState("")
  const [cartDiscount_, setCartDiscount_] = useState("")
  const [payDialogOpen, setPayDialogOpen] = useState(false)
  const [payments, setPayments] = useState<PaymentEntry[]>([
    { method: "cash", amount: "" },
  ])
  const [deliveryEnabled, setDeliveryEnabled] = useState(false)
  const [deliveryForm, setDeliveryForm] = useState({
    customer_phone: "",
    address_line: "",
    neighborhood: "",
    city: "",
    state: "",
    reference: "",
    courier_name: "",
    delivery_fee: "",
    estimated_delivery_at: "",
    notes: "",
  })
  const [saleError, setSaleError] = useState<string | null>(null)

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
        },
      ]
    })
  }, [allProducts, variantsByProduct])

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return sellableItems.slice(0, 24)
    const q = search.toLowerCase()
    return sellableItems.filter((item) => {
      const searchText = [
        item.name,
        item.product.name,
        item.barcode,
        item.sku,
        item.product.category,
        item.product.brand,
        item.product.size_label,
        item.product.dosage,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return searchText.includes(q)
    })
  }, [sellableItems, search])

  function addToCart(item: SellableItem) {
    setCart((prev) => {
      const existing = prev.findIndex((cartItem) => cartItem.key === item.key)
      if (existing >= 0) {
        const updated = [...prev]
        updated[existing] = {
          ...updated[existing],
          quantity: normalizeQuantity(
            updated[existing].product,
            updated[existing].quantity + 1
          ),
        }
        return updated
      }
      return [
        ...prev,
        {
          key: item.key,
          product: item.product,
          variant: item.variant,
          quantity: 1,
          unit_price: item.unit_price,
          discount: 0,
        },
      ]
    })
    setSearch("")
  }

  function updateQuantity(itemKey: string, delta: number) {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.key !== itemKey) return item
          return {
            ...item,
            quantity: normalizeQuantity(item.product, item.quantity + delta),
          }
        })
    })
  }

  function updateQuantityValue(itemKey: string, value: string) {
    setCart((prev) =>
      prev.map((item) =>
        item.key === itemKey
          ? { ...item, quantity: normalizeQuantity(item.product, Number(value) || 0) }
          : item
      )
    )
  }

  function removeFromCart(itemKey: string) {
    setCart((prev) => prev.filter((item) => item.key !== itemKey))
  }

  function updateItemPrice(itemKey: string, value: string) {
    setCart((prev) =>
      prev.map((item) =>
        item.key === itemKey
          ? { ...item, unit_price: Math.max(0, Number(value) || 0) }
          : item
      )
    )
  }

  function updateItemDiscount(itemKey: string, value: string) {
    setCart((prev) =>
      prev.map((item) =>
        item.key === itemKey
          ? { ...item, discount: Math.max(0, Number(value) || 0) }
          : item
      )
    )
  }

  const extraDiscount = Number(cartDiscount_) || 0
  const deliveryFee = deliveryEnabled ? Number(deliveryForm.delivery_fee) || 0 : 0
  const finalTotal = Math.max(0, cartTotal(cart) - extraDiscount + deliveryFee)
  const totalPaid = paymentTotal(payments)
  const change = cashChange(payments, finalTotal)
  const remaining = Math.max(0, finalTotal - totalPaid)

  function openPayDialog() {
    setSaleError(null)
    setPayments([{ method: "cash", amount: String(finalTotal.toFixed(2)) }])
    setPayDialogOpen(true)
  }

  function addPaymentLine() {
    setPayments((prev) => [...prev, { method: "pix", amount: "" }])
  }

  function removePaymentLine(index: number) {
    setPayments((prev) => prev.filter((_, i) => i !== index))
  }

  function updatePaymentMethod(index: number, method: PaymentMethod) {
    setPayments((prev) =>
      prev.map((p, i) => (i === index ? { ...p, method } : p))
    )
  }

  function updatePaymentAmount(index: number, amount: string) {
    setPayments((prev) =>
      prev.map((p, i) => (i === index ? { ...p, amount } : p))
    )
  }

  async function handleSaleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!session) return
    setSaleError(null)

    if (cart.length === 0) {
      setSaleError("Adicione pelo menos um produto.")
      return
    }

    if (totalPaid < finalTotal - 0.005) {
      setSaleError(
        `Pagamento insuficiente. Falta ${formatCurrency(remaining)}.`
      )
      return
    }

    if (deliveryEnabled && !deliveryForm.address_line.trim()) {
      setSaleError("Informe o endereco da entrega.")
      return
    }

    try {
      const branchId = selectedBranchId ?? session.branch_id
      const saleItems = cart.map((item) => ({
        product_id: item.product.id,
        variant_id: item.variant?.id ?? null,
        product_name: cartItemName(item),
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_amount: item.discount,
        total_amount: cartItemTotal(item),
      }))
      const saleId = await completeSale.mutateAsync({
        branch_id: branchId,
        session_id: session.id,
        post_id: session.post_id ?? null,
        customer_name: customerName.trim() || null,
        discount_amount: cartDiscount(cart) + extraDiscount,
        notes: null,
        items: deliveryFee > 0
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
          : saleItems,
        payments: payments
          .filter((p) => Number(p.amount) > 0)
          .map((p) => ({
            method: p.method,
            amount: Number(p.amount),
            change_amount: p.method === "cash" ? change : 0,
          })),
      })
      if (deliveryEnabled) {
        await createDelivery.mutateAsync({
          branch_id: branchId,
          sale_id: saleId,
          assigned_employee_id: null,
          source: "pos",
          status: "pending",
          priority: "normal",
          customer_name: customerName.trim() || "Cliente PDV",
          customer_phone: deliveryForm.customer_phone.trim() || null,
          address_line: deliveryForm.address_line.trim(),
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
          })),
        })
      }
      setCart([])
      setCustomerName("")
      setCartDiscount_("")
      setDeliveryEnabled(false)
      setDeliveryForm({
        customer_phone: "",
        address_line: "",
        neighborhood: "",
        city: "",
        state: "",
        reference: "",
        courier_name: "",
        delivery_fee: "",
        estimated_delivery_at: "",
        notes: "",
      })
      setPayDialogOpen(false)
    } catch (error) {
      setSaleError(error instanceof Error ? error.message : "Nao foi possivel finalizar a venda.")
    }
  }

  if (currentSession.isLoading) {
    return (
      <main className="p-6">
        <StateBlock type="loading" title="Verificando caixa" />
      </main>
    )
  }

  if (!session) {
    return (
      <>
        <PageHeader title="PDV — Venda" description="Registre vendas pelo caixa." />
        <div className="p-6">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Nenhum caixa aberto. Acesse <strong>Caixa</strong> para abrir um caixa antes de registrar vendas.
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="PDV — Venda"
        description="Registre vendas pelo caixa."
        action={
          <Badge variant="default" className="text-sm">
            Caixa aberto
          </Badge>
        }
      />

      <div className="p-6">
        <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
          {/* Product search */}
          <div className="space-y-4">
            <Card className="border bg-white shadow-sm">
              <CardHeader>
                <CardTitle>Buscar produto</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Nome, codigo ou categoria..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    autoFocus
                  />
                </div>
                {filteredProducts.length === 0 ? (
                  <StateBlock title="Nenhum produto encontrado" />
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredProducts.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        className="rounded-lg border bg-white p-3 text-left transition-colors hover:bg-slate-50 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-ring"
                        onClick={() => addToCart(item)}
                      >
                        <div className="font-medium text-sm truncate">{item.name}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {item.product.category ?? item.product.unit}
                          {item.variant ? " - variacao" : ""}
                        </div>
                        <div className="mt-1 font-semibold text-sm">
                          {formatCurrency(item.unit_price)}
                        </div>
                        {item.product.track_inventory ?? true ? (
                          <div className="mt-1 text-xs text-muted-foreground">
                            Estoque {item.stock_quantity} {item.product.unit}
                          </div>
                        ) : null}
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Cart */}
          <div className="space-y-4">
            <Card className="border bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="size-5" />
                  Carrinho
                  {cart.length > 0 && (
                    <Badge variant="secondary">{cart.length} {cart.length === 1 ? "item" : "itens"}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {cart.length === 0 ? (
                  <StateBlock title="Carrinho vazio" description="Adicione produtos ao lado." />
                ) : (
                  <>
                    <div className="space-y-2">
                      {cart.map((item) => (
                        <div
                          key={item.key}
                          className="rounded-lg border p-3 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-medium text-sm truncate">
                                {cartItemName(item)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {formatCurrency(cartItemTotal(item))}
                              </div>
                            </div>
                            <button
                              type="button"
                              className="shrink-0 text-muted-foreground hover:text-red-500"
                              onClick={() => removeFromCart(item.key)}
                              aria-label="Remover"
                            >
                              <X className="size-4" />
                            </button>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="size-7"
                              onClick={() => updateQuantity(item.key, -1)}
                            >
                              <Minus className="size-3" />
                            </Button>
                            <input
                              type="number"
                              min={item.product.allow_fractional_quantity ? "0.001" : "1"}
                              step={item.product.allow_fractional_quantity ? "0.001" : "1"}
                              className="h-7 w-16 rounded border px-1.5 text-center text-sm font-medium outline-none focus:border-ring"
                              value={item.quantity}
                              onChange={(e) => updateQuantityValue(item.key, e.target.value)}
                              aria-label="Quantidade"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="size-7"
                              onClick={() => updateQuantity(item.key, 1)}
                            >
                              <Plus className="size-3" />
                            </Button>
                            <div className="flex items-center gap-1 ml-auto">
                              <span className="text-xs text-muted-foreground">R$</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                className="h-7 w-20 rounded border px-1.5 text-xs outline-none focus:border-ring"
                                value={item.unit_price}
                                onChange={(e) => updateItemPrice(item.key, e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">Desc. item R$</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className="h-7 w-20 rounded border px-1.5 text-xs outline-none focus:border-ring"
                              value={item.discount || ""}
                              onChange={(e) => updateItemDiscount(item.key, e.target.value)}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2 border-t pt-3">
                      <label className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-muted-foreground">Cliente (opcional)</span>
                        <Input
                          className="w-40 h-7 text-xs"
                          placeholder="Nome..."
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                        />
                      </label>
                      <label className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-muted-foreground">Desconto extra R$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0,00"
                          className="h-7 w-24 rounded border px-1.5 text-xs outline-none focus:border-ring"
                          value={cartDiscount_}
                          onChange={(e) => setCartDiscount_(e.target.value)}
                        />
                      </label>
                    </div>

                    <div className="rounded-lg border bg-slate-50 p-3 space-y-1 text-sm">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Subtotal</span>
                        <span>{formatCurrency(cartSubtotal(cart))}</span>
                      </div>
                      {(cartDiscount(cart) + extraDiscount) > 0 && (
                        <div className="flex justify-between text-red-600">
                          <span>Descontos</span>
                          <span>- {formatCurrency(cartDiscount(cart) + extraDiscount)}</span>
                        </div>
                      )}
                      {deliveryFee > 0 && (
                        <div className="flex justify-between text-muted-foreground">
                          <span>Taxa de entrega</span>
                          <span>{formatCurrency(deliveryFee)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-semibold text-base border-t pt-1">
                        <span>Total</span>
                        <span>{formatCurrency(finalTotal)}</span>
                      </div>
                    </div>

                    <Button
                      className="w-full"
                      onClick={openPayDialog}
                      disabled={cart.length === 0}
                    >
                      <CreditCard className="size-4" />
                      Pagamento — {formatCurrency(finalTotal)}
                    </Button>

                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setCart([])
                        setCustomerName("")
                        setCartDiscount_("")
                      }}
                    >
                      <Trash2 className="size-4" />
                      Limpar carrinho
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Payment dialog */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pagamento</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(e) => void handleSaleSubmit(e)}>
            <div className="rounded-lg border bg-slate-50 p-3 text-sm space-y-1">
              <div className="flex justify-between font-semibold">
                <span>Total a pagar</span>
                <span>{formatCurrency(finalTotal)}</span>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border p-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={deliveryEnabled}
                  onChange={(e) => setDeliveryEnabled(e.target.checked)}
                />
                <MapPin className="size-4" />
                Gerar entrega a partir desta venda
              </label>
              {deliveryEnabled ? (
                <div className="space-y-3 border-t pt-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">Telefone</span>
                      <Input
                        value={deliveryForm.customer_phone}
                        onChange={(e) =>
                          setDeliveryForm((current) => ({
                            ...current,
                            customer_phone: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">Taxa de entrega</span>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={deliveryForm.delivery_fee}
                        onChange={(e) =>
                          setDeliveryForm((current) => ({
                            ...current,
                            delivery_fee: e.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Endereco</span>
                    <Input
                      required={deliveryEnabled}
                      value={deliveryForm.address_line}
                      onChange={(e) =>
                        setDeliveryForm((current) => ({
                          ...current,
                          address_line: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <div className="grid gap-2 sm:grid-cols-4">
                    <label className="space-y-1 text-sm sm:col-span-2">
                      <span className="font-medium">Bairro</span>
                      <Input
                        value={deliveryForm.neighborhood}
                        onChange={(e) =>
                          setDeliveryForm((current) => ({
                            ...current,
                            neighborhood: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">Cidade</span>
                      <Input
                        value={deliveryForm.city}
                        onChange={(e) =>
                          setDeliveryForm((current) => ({
                            ...current,
                            city: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">UF</span>
                      <Input
                        maxLength={2}
                        value={deliveryForm.state}
                        onChange={(e) =>
                          setDeliveryForm((current) => ({
                            ...current,
                            state: e.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">Referencia</span>
                      <Input
                        value={deliveryForm.reference}
                        onChange={(e) =>
                          setDeliveryForm((current) => ({
                            ...current,
                            reference: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">Previsao</span>
                      <Input
                        type="datetime-local"
                        value={deliveryForm.estimated_delivery_at}
                        onChange={(e) =>
                          setDeliveryForm((current) => ({
                            ...current,
                            estimated_delivery_at: e.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Observacoes da entrega</span>
                    <textarea
                      className="min-h-16 w-full rounded-lg border bg-white px-2.5 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
                      value={deliveryForm.notes}
                      onChange={(e) =>
                        setDeliveryForm((current) => ({
                          ...current,
                          notes: e.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              {payments.map((payment, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <select
                    className={`${fieldClass} flex-1`}
                    value={payment.method}
                    onChange={(e) =>
                      updatePaymentMethod(idx, e.target.value as PaymentMethod)
                    }
                  >
                    {(Object.keys(paymentMethodLabel) as PaymentMethod[]).map(
                      (m) => (
                        <option key={m} value={m}>
                          {paymentMethodLabel[m]}
                        </option>
                      )
                    )}
                  </select>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    className="w-28"
                    value={payment.amount}
                    onChange={(e) => updatePaymentAmount(idx, e.target.value)}
                  />
                  {payments.length > 1 && (
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-red-500"
                      onClick={() => removePaymentLine(idx)}
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addPaymentLine}
              >
                <Plus className="size-3" />
                Outra forma
              </Button>
            </div>

            <div className="rounded-lg border p-3 text-sm space-y-1">
              <div className="flex justify-between text-muted-foreground">
                <span>Total pago</span>
                <span className={totalPaid >= finalTotal ? "text-emerald-700" : "text-red-600"}>
                  {formatCurrency(totalPaid)}
                </span>
              </div>
              {change > 0 && (
                <div className="flex justify-between font-semibold text-emerald-700">
                  <span>Troco</span>
                  <span>{formatCurrency(change)}</span>
                </div>
              )}
              {remaining > 0.005 && (
                <div className="flex justify-between font-semibold text-red-600">
                  <span>Falta pagar</span>
                  <span>{formatCurrency(remaining)}</span>
                </div>
              )}
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
                  totalPaid < finalTotal - 0.005
                }
              >
                Confirmar venda
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
