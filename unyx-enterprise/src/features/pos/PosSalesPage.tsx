import { useState } from "react"
import {
  ChevronDown,
  ChevronRight,
  RefreshCw,
  ReceiptText,
  ShoppingBag,
} from "lucide-react"

import { BentoGrid } from "@/components/bento/BentoGrid"
import { MetricCard } from "@/components/bento/MetricCard"
import { PageHeader } from "@/components/shared/PageHeader"
import { StateBlock } from "@/components/shared/StateBlock"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  useSaleItems,
  useSalePayments,
  useSales,
} from "@/hooks/useUnyxData"
import { formatCurrency, formatDateTimeBR, todayISO } from "@/lib/format"
import type { Sale, SaleStatus } from "@/types/domain"

const saleStatusLabel: Record<SaleStatus, string> = {
  draft: "Rascunho",
  completed: "Concluida",
  cancelled: "Cancelada",
  refunded: "Devolvida",
}

const paymentMethodLabel: Record<string, string> = {
  cash: "Dinheiro",
  pix: "PIX",
  debit_card: "Cartao de debito",
  credit_card: "Cartao de credito",
  voucher: "Vale / voucher",
  other: "Outro",
}

function SaleDetailRow({ saleId }: { saleId: string }) {
  const items = useSaleItems(saleId)
  const payments = useSalePayments(saleId)

  if (items.isLoading || payments.isLoading) {
    return (
      <tr>
        <td colSpan={6} className="px-4 py-3 text-sm text-muted-foreground">
          Carregando...
        </td>
      </tr>
    )
  }

  return (
    <tr>
      <td colSpan={6} className="bg-slate-50 px-6 py-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Itens
            </div>
            <div className="space-y-1">
              {(items.data ?? []).map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span>
                    {item.quantity}x {item.product_name}
                  </span>
                  <span className="font-medium">{formatCurrency(item.total_amount)}</span>
                </div>
              ))}
              {(items.data ?? []).length === 0 && (
                <div className="text-sm text-muted-foreground">Sem itens</div>
              )}
            </div>
          </div>
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Pagamentos
            </div>
            <div className="space-y-1">
              {(payments.data ?? []).map((p) => (
                <div key={p.id} className="flex justify-between text-sm">
                  <span>{paymentMethodLabel[p.method] ?? p.method}</span>
                  <span className="font-medium">{formatCurrency(p.amount)}</span>
                </div>
              ))}
              {(payments.data ?? []).length === 0 && (
                <div className="text-sm text-muted-foreground">Sem pagamentos</div>
              )}
            </div>
          </div>
        </div>
      </td>
    </tr>
  )
}

function SaleRow({ sale }: { sale: Sale }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <tr
        className="cursor-pointer border-b last:border-0 hover:bg-slate-50"
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="px-4 py-3">
          {expanded ? (
            <ChevronDown className="size-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 text-muted-foreground" />
          )}
        </td>
        <td className="px-4 py-3 text-sm">{formatDateTimeBR(sale.sold_at)}</td>
        <td className="px-4 py-3 text-sm">
          {sale.customer_name ?? <span className="text-muted-foreground">-</span>}
        </td>
        <td className="px-4 py-3 text-sm font-medium">{formatCurrency(sale.total_amount)}</td>
        <td className="px-4 py-3">
          <Badge
            variant={
              sale.status === "completed"
                ? "default"
                : sale.status === "cancelled" || sale.status === "refunded"
                ? "destructive"
                : "secondary"
            }
          >
            {saleStatusLabel[sale.status]}
          </Badge>
        </td>
        <td className="px-4 py-3 text-sm text-muted-foreground">
          {sale.operational_posts?.name ?? "-"}
        </td>
      </tr>
      {expanded && <SaleDetailRow saleId={sale.id} />}
    </>
  )
}

export function PosSalesPage() {
  const [date, setDate] = useState(todayISO())
  const sales = useSales(undefined, date)

  const allSales = sales.data ?? []
  const completedSales = allSales.filter((s) => s.status === "completed")
  const totalRevenue = completedSales.reduce((sum, s) => sum + s.total_amount, 0)
  const averageTicket =
    completedSales.length > 0 ? totalRevenue / completedSales.length : 0

  return (
    <>
      <PageHeader
        title="Historico de vendas"
        description="Vendas registradas no PDV por dia."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="w-40"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => void sales.refetch()}
              aria-label="Atualizar vendas"
            >
              <RefreshCw className="size-4" />
            </Button>
          </div>
        }
      />

      <div className="space-y-6 p-6">
        {sales.isLoading ? (
          <StateBlock type="loading" title="Carregando vendas" />
        ) : sales.error ? (
          <StateBlock
            type="error"
            title="Erro ao carregar vendas"
            description="Rode supabase/pos_setup.sql no SQL Editor para ativar o modulo POS."
          />
        ) : (
          <>
            <BentoGrid>
              <MetricCard
                title="Vendas concluidas"
                value={completedSales.length}
                detail="No dia selecionado"
                icon={<ShoppingBag className="size-5" />}
              />
              <MetricCard
                title="Receita total"
                value={formatCurrency(totalRevenue)}
                detail="Vendas concluidas"
                icon={<ReceiptText className="size-5" />}
              />
              <MetricCard
                title="Ticket medio"
                value={formatCurrency(averageTicket)}
                detail="Por venda concluida"
                icon={<ReceiptText className="size-5" />}
              />
            </BentoGrid>

            <Card className="border bg-white shadow-sm">
              <CardHeader>
                <CardTitle>Vendas do dia</CardTitle>
              </CardHeader>
              <CardContent>
                {allSales.length === 0 ? (
                  <StateBlock
                    title="Nenhuma venda registrada"
                    description="Nenhuma venda foi registrada nesta data."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="px-4 py-3 w-8" />
                          <th className="px-4 py-3 font-medium">Data / hora</th>
                          <th className="px-4 py-3 font-medium">Cliente</th>
                          <th className="px-4 py-3 font-medium">Total</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                          <th className="px-4 py-3 font-medium">Posto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allSales.map((sale) => (
                          <SaleRow key={sale.id} sale={sale} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </>
  )
}
