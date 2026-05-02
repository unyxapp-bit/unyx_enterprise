import { useMemo, useState } from "react"
import type { FormEvent } from "react"
import {
  CreditCard,
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
  useCurrentCashSession,
  useProducts,
} from "@/hooks/useUnyxData"
import { formatCurrency } from "@/lib/format"
import { useAppStore } from "@/store/useAppStore"
import type { PaymentMethod, Product } from "@/types/domain"

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
  product: Product
  quantity: number
  unit_price: number
  discount: number
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

export function PosSellPage() {
  const selectedBranchId = useAppStore((state) => state.selectedBranchId)
  const currentSession = useCurrentCashSession()
  const products = useProducts()
  const completeSale = useCompleteSale()

  const session = currentSession.data ?? null
  const allProducts = (products.data ?? []).filter((p) => p.active)

  const [search, setSearch] = useState("")
  const [cart, setCart] = useState<CartItem[]>([])
  const [customerName, setCustomerName] = useState("")
  const [cartDiscount_, setCartDiscount_] = useState("")
  const [payDialogOpen, setPayDialogOpen] = useState(false)
  const [payments, setPayments] = useState<PaymentEntry[]>([
    { method: "cash", amount: "" },
  ])
  const [saleError, setSaleError] = useState<string | null>(null)

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return allProducts.slice(0, 20)
    const q = search.toLowerCase()
    return allProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.barcode ?? "").toLowerCase().includes(q) ||
        (p.category ?? "").toLowerCase().includes(q)
    )
  }, [allProducts, search])

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.findIndex((item) => item.product.id === product.id)
      if (existing >= 0) {
        const updated = [...prev]
        updated[existing] = {
          ...updated[existing],
          quantity: updated[existing].quantity + 1,
        }
        return updated
      }
      return [
        ...prev,
        { product, quantity: 1, unit_price: product.price, discount: 0 },
      ]
    })
    setSearch("")
  }

  function updateQuantity(productId: string, delta: number) {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.product.id !== productId) return item
          return { ...item, quantity: Math.max(1, item.quantity + delta) }
        })
    })
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((item) => item.product.id !== productId))
  }

  function updateItemPrice(productId: string, value: string) {
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId
          ? { ...item, unit_price: Math.max(0, Number(value) || 0) }
          : item
      )
    )
  }

  function updateItemDiscount(productId: string, value: string) {
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId
          ? { ...item, discount: Math.max(0, Number(value) || 0) }
          : item
      )
    )
  }

  const extraDiscount = Number(cartDiscount_) || 0
  const finalTotal = Math.max(0, cartTotal(cart) - extraDiscount)
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

    try {
      const branchId = selectedBranchId ?? session.branch_id
      await completeSale.mutateAsync({
        branch_id: branchId,
        session_id: session.id,
        post_id: session.post_id ?? null,
        customer_name: customerName.trim() || null,
        discount_amount: cartDiscount(cart) + extraDiscount,
        notes: null,
        items: cart.map((item) => ({
          product_id: item.product.id,
          product_name: item.product.name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_amount: item.discount,
          total_amount: cartItemTotal(item),
        })),
        payments: payments
          .filter((p) => Number(p.amount) > 0)
          .map((p) => ({
            method: p.method,
            amount: Number(p.amount),
            change_amount: p.method === "cash" ? change : 0,
          })),
      })
      setCart([])
      setCustomerName("")
      setCartDiscount_("")
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
                    {filteredProducts.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        className="rounded-lg border bg-white p-3 text-left transition-colors hover:bg-slate-50 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-ring"
                        onClick={() => addToCart(product)}
                      >
                        <div className="font-medium text-sm truncate">{product.name}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {product.category ?? product.unit}
                        </div>
                        <div className="mt-1 font-semibold text-sm">
                          {formatCurrency(product.price)}
                        </div>
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
                          key={item.product.id}
                          className="rounded-lg border p-3 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-medium text-sm truncate">
                                {item.product.name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {formatCurrency(cartItemTotal(item))}
                              </div>
                            </div>
                            <button
                              type="button"
                              className="shrink-0 text-muted-foreground hover:text-red-500"
                              onClick={() => removeFromCart(item.product.id)}
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
                              onClick={() => updateQuantity(item.product.id, -1)}
                            >
                              <Minus className="size-3" />
                            </Button>
                            <span className="w-8 text-center text-sm font-medium">
                              {item.quantity}
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="size-7"
                              onClick={() => updateQuantity(item.product.id, 1)}
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
                                onChange={(e) => updateItemPrice(item.product.id, e.target.value)}
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
                              onChange={(e) => updateItemDiscount(item.product.id, e.target.value)}
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
                disabled={completeSale.isPending || totalPaid < finalTotal - 0.005}
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
