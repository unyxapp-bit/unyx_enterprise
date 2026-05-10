import { useMemo, useState } from "react"
import {
  Ban,
  Eye,
  FilePlus2,
  FileText,
  Printer,
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  useCancelFiscalDocument,
  useCreateFiscalDocument,
  useFiscalDocuments,
  useSaleItems,
  useSalePayments,
  useSales,
} from "@/hooks/useUnyxData"
import { formatCurrency, formatDateTimeBR, todayISO } from "@/lib/format"
import type {
  FiscalDocument,
  FiscalDocumentStatus,
  FiscalDocumentType,
  Sale,
  SaleItem,
  SalePayment,
} from "@/types/domain"

const documentTypeLabel: Record<FiscalDocumentType, string> = {
  internal_coupon: "Cupom interno",
  nfce_draft: "Rascunho NFC-e",
}

const documentStatusLabel: Record<FiscalDocumentStatus, string> = {
  draft: "Rascunho",
  ready_to_print: "Pronto para impressao",
  cancelled: "Cancelado",
}

const paymentMethodLabel: Record<string, string> = {
  cash: "Dinheiro",
  pix: "PIX",
  debit_card: "Cartao de debito",
  credit_card: "Cartao de credito",
  voucher: "Vale / voucher",
  other: "Outro",
}

function documentNumber(document: FiscalDocument) {
  return `${document.series}-${String(document.number).padStart(6, "0")}`
}

function getSnapshotValue(snapshot: Record<string, unknown>, key: string) {
  const value = snapshot[key]
  if (typeof value === "string" || typeof value === "number") return String(value)
  return ""
}

function getSnapshotNumber(snapshot: Record<string, unknown>, key: string) {
  const value = snapshot[key]
  if (typeof value === "number") return value
  if (typeof value === "string") return Number(value) || 0
  return 0
}

function statusVariant(status: FiscalDocumentStatus) {
  if (status === "cancelled") return "destructive"
  if (status === "draft") return "secondary"
  return "default"
}

function PrintableCoupon({
  document,
  items,
  payments,
}: {
  document: FiscalDocument
  items: SaleItem[]
  payments: SalePayment[]
}) {
  const issuerName =
    getSnapshotValue(document.issuer_snapshot, "trade_name") ||
    getSnapshotValue(document.issuer_snapshot, "name") ||
    "Empresa"
  const issuerDocument = getSnapshotValue(document.issuer_snapshot, "document")
  const customerName =
    getSnapshotValue(document.customer_snapshot, "name") ||
    document.sales?.customer_name ||
    "Consumidor final"
  const subtotal = getSnapshotNumber(document.totals_snapshot, "subtotal")
  const discount = getSnapshotNumber(document.totals_snapshot, "discount_amount")
  const total =
    getSnapshotNumber(document.totals_snapshot, "total_amount") ||
    document.sales?.total_amount ||
    0

  return (
    <div className="fiscal-print-root">
      <div className="fiscal-coupon">
        <div className="fiscal-coupon-center fiscal-coupon-strong">
          {issuerName}
        </div>
        {issuerDocument ? (
          <div className="fiscal-coupon-center">CNPJ/CPF: {issuerDocument}</div>
        ) : null}
        <div className="fiscal-coupon-separator" />
        <div className="fiscal-coupon-center fiscal-coupon-strong">
          CUPOM NAO FISCAL
        </div>
        <div className="fiscal-coupon-center">
          Documento local sem autorizacao SEFAZ
        </div>
        <div className="fiscal-coupon-separator" />

        <div>Tipo: {documentTypeLabel[document.doc_type]}</div>
        <div>Numero: {documentNumber(document)}</div>
        <div>Emissao: {formatDateTimeBR(document.issued_at)}</div>
        <div>Cliente: {customerName}</div>
        <div>Chave local: {document.fiscal_key}</div>
        <div className="fiscal-coupon-separator" />

        <div className="fiscal-coupon-strong">Itens</div>
        {items.map((item) => (
          <div key={item.id} className="fiscal-coupon-item">
            <div>{item.product_name}</div>
            <div className="fiscal-coupon-row">
              <span>
                {item.quantity} x {formatCurrency(item.unit_price)}
              </span>
              <span>{formatCurrency(item.total_amount)}</span>
            </div>
          </div>
        ))}
        {items.length === 0 ? <div>Sem itens.</div> : null}
        <div className="fiscal-coupon-separator" />

        <div className="fiscal-coupon-row">
          <span>Subtotal</span>
          <span>{formatCurrency(subtotal)}</span>
        </div>
        <div className="fiscal-coupon-row">
          <span>Desconto</span>
          <span>{formatCurrency(discount)}</span>
        </div>
        <div className="fiscal-coupon-row fiscal-coupon-total">
          <span>Total</span>
          <span>{formatCurrency(total)}</span>
        </div>
        <div className="fiscal-coupon-separator" />

        <div className="fiscal-coupon-strong">Pagamentos</div>
        {payments.map((payment) => (
          <div key={payment.id} className="fiscal-coupon-row">
            <span>{paymentMethodLabel[payment.method] ?? payment.method}</span>
            <span>{formatCurrency(payment.amount)}</span>
          </div>
        ))}
        {payments.length === 0 ? <div>Sem pagamentos.</div> : null}
        <div className="fiscal-coupon-separator" />

        <div className="fiscal-coupon-center">
          Documento auxiliar interno. Nao substitui NFC-e, NF-e ou outro documento fiscal autorizado.
        </div>
      </div>
    </div>
  )
}

function FiscalDocumentDialog({
  document,
  onClose,
}: {
  document: FiscalDocument | null
  onClose: () => void
}) {
  const items = useSaleItems(document?.sale_id)
  const payments = useSalePayments(document?.sale_id)

  if (!document) return null

  const customerName =
    getSnapshotValue(document.customer_snapshot, "name") ||
    document.sales?.customer_name ||
    "Consumidor final"
  const loadedItems = items.data ?? []
  const loadedPayments = payments.data ?? []
  const canPrint = !items.isLoading && !payments.isLoading

  function printCoupon() {
    window.setTimeout(() => window.print(), 0)
  }

  return (
    <Dialog open={Boolean(document)} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ReceiptText className="size-5" />
            {documentTypeLabel[document.doc_type]} {documentNumber(document)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-slate-50 p-3 text-sm">
            <div className="font-semibold">
              {getSnapshotValue(document.issuer_snapshot, "trade_name") ||
                getSnapshotValue(document.issuer_snapshot, "name") ||
                "Empresa"}
            </div>
            <div className="text-xs text-muted-foreground">
              Chave local: {document.fiscal_key}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant={statusVariant(document.status)}>
                {documentStatusLabel[document.status]}
              </Badge>
              <Badge variant="outline">Sem envio SEFAZ</Badge>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Emissao</div>
              <div className="text-sm font-medium">{formatDateTimeBR(document.issued_at)}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Cliente</div>
              <div className="text-sm font-medium">{customerName}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="text-sm font-medium">
                {formatCurrency(document.sales?.total_amount ?? 0)}
              </div>
            </div>
          </div>

          <div>
            <div className="mb-2 text-sm font-medium">Itens</div>
            {items.isLoading ? (
              <StateBlock type="loading" title="Carregando itens" className="min-h-24" />
            ) : (
              <div className="space-y-1 rounded-lg border p-3">
                {(items.data ?? []).map((item) => (
                  <div key={item.id} className="flex justify-between gap-4 text-sm">
                    <span>{item.quantity}x {item.product_name}</span>
                    <span className="font-medium">{formatCurrency(item.total_amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="mb-2 text-sm font-medium">Pagamentos</div>
            {payments.isLoading ? (
              <StateBlock type="loading" title="Carregando pagamentos" className="min-h-24" />
            ) : (
              <div className="space-y-1 rounded-lg border p-3">
                {(payments.data ?? []).map((payment) => (
                  <div key={payment.id} className="flex justify-between gap-4 text-sm">
                    <span>{paymentMethodLabel[payment.method] ?? payment.method}</span>
                    <span className="font-medium">{formatCurrency(payment.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Fechar
          </Button>
          <Button type="button" disabled={!canPrint} onClick={printCoupon}>
            <Printer className="size-4" />
            Imprimir
          </Button>
        </DialogFooter>
      </DialogContent>
      {canPrint ? (
        <PrintableCoupon
          document={document}
          items={loadedItems}
          payments={loadedPayments}
        />
      ) : null}
    </Dialog>
  )
}

function SaleFiscalActions({
  sale,
  documents,
  onCreate,
  creating,
}: {
  sale: Sale
  documents: FiscalDocument[]
  onCreate: (sale: Sale, type: FiscalDocumentType) => void
  creating: boolean
}) {
  const hasCoupon = documents.some(
    (document) => document.doc_type === "internal_coupon" && document.status !== "cancelled"
  )
  const hasNfceDraft = documents.some(
    (document) => document.doc_type === "nfce_draft" && document.status !== "cancelled"
  )

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={creating || hasCoupon}
        onClick={() => onCreate(sale, "internal_coupon")}
      >
        <FilePlus2 className="size-4" />
        Cupom
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={creating || hasNfceDraft}
        onClick={() => onCreate(sale, "nfce_draft")}
      >
        <FileText className="size-4" />
        NFC-e
      </Button>
    </div>
  )
}

export function FiscalDocumentsPage() {
  const [date, setDate] = useState(todayISO())
  const [selectedDocument, setSelectedDocument] = useState<FiscalDocument | null>(null)
  const fiscalDocuments = useFiscalDocuments(undefined, date)
  const sales = useSales(undefined, date)
  const createDocument = useCreateFiscalDocument()
  const cancelDocument = useCancelFiscalDocument()

  const documents = useMemo(
    () => fiscalDocuments.data ?? [],
    [fiscalDocuments.data]
  )
  const completedSales = useMemo(
    () => (sales.data ?? []).filter((sale) => sale.status === "completed"),
    [sales.data]
  )
  const documentsBySale = useMemo(() => {
    const grouped = new Map<string, FiscalDocument[]>()
    documents.forEach((document) => {
      grouped.set(document.sale_id, [...(grouped.get(document.sale_id) ?? []), document])
    })
    return grouped
  }, [documents])

  const printableCount = documents.filter((document) => document.status === "ready_to_print").length
  const draftCount = documents.filter((document) => document.status === "draft").length
  const cancelledCount = documents.filter((document) => document.status === "cancelled").length

  function handleCreateDocument(sale: Sale, docType: FiscalDocumentType) {
    void createDocument.mutateAsync({
      sale_id: sale.id,
      doc_type: docType,
      series: "1",
      notes: "Gerado em modo local sem transmissao SEFAZ.",
    })
  }

  function handleCancelDocument(document: FiscalDocument) {
    const reason = window.prompt("Informe o motivo do cancelamento local:")
    if (reason === null) return
    void cancelDocument.mutateAsync({
      documentId: document.id,
      reason: reason.trim() || null,
    })
  }

  const isLoading = fiscalDocuments.isLoading || sales.isLoading
  const hasError = fiscalDocuments.error || sales.error

  return (
    <>
      <PageHeader
        title="Cupons / NFC-e"
        description="Controle local de cupons e rascunhos NFC-e sem envio para SEFAZ."
        action={
          <div className="flex flex-wrap items-center gap-2">
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
              onClick={() => {
                void fiscalDocuments.refetch()
                void sales.refetch()
              }}
              aria-label="Atualizar documentos fiscais"
            >
              <RefreshCw className="size-4" />
            </Button>
          </div>
        }
      />

      <div className="space-y-6 p-6">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Este modulo ainda opera em modo local. NFC-e criada aqui fica como rascunho e nao tem autorizacao SEFAZ.
        </div>

        {isLoading ? (
          <StateBlock type="loading" title="Carregando documentos fiscais" />
        ) : hasError ? (
          <StateBlock
            type="error"
            title="Erro ao carregar modulo fiscal"
            description="Rode supabase/fiscal_documents_setup.sql no SQL Editor do Supabase e recarregue o app."
          />
        ) : (
          <>
            <BentoGrid>
              <MetricCard
                title="Prontos"
                value={printableCount}
                detail="Cupons locais"
                icon={<ReceiptText className="size-5" />}
              />
              <MetricCard
                title="Rascunhos NFC-e"
                value={draftCount}
                detail="Sem envio SEFAZ"
                icon={<FileText className="size-5" />}
              />
              <MetricCard
                title="Cancelados"
                value={cancelledCount}
                detail="Cancelamento local"
                icon={<Ban className="size-5" />}
              />
            </BentoGrid>

            <Card className="border bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ReceiptText className="size-5" />
                  Documentos gerados
                </CardTitle>
              </CardHeader>
              <CardContent>
                {documents.length === 0 ? (
                  <StateBlock
                    title="Nenhum documento gerado"
                    description="Gere um cupom local ou rascunho NFC-e a partir de uma venda concluida."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="px-4 py-3 font-medium">Numero</th>
                          <th className="px-4 py-3 font-medium">Tipo</th>
                          <th className="px-4 py-3 font-medium">Cliente</th>
                          <th className="px-4 py-3 font-medium">Total</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                          <th className="px-4 py-3 font-medium">Emissao</th>
                          <th className="px-4 py-3 font-medium" />
                        </tr>
                      </thead>
                      <tbody>
                        {documents.map((document) => (
                          <tr key={document.id} className="border-b last:border-0 hover:bg-slate-50">
                            <td className="px-4 py-3 font-medium">{documentNumber(document)}</td>
                            <td className="px-4 py-3">{documentTypeLabel[document.doc_type]}</td>
                            <td className="px-4 py-3">
                              {getSnapshotValue(document.customer_snapshot, "name") ||
                                document.sales?.customer_name ||
                                "Consumidor final"}
                            </td>
                            <td className="px-4 py-3">
                              {formatCurrency(document.sales?.total_amount ?? 0)}
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant={statusVariant(document.status)}>
                                {documentStatusLabel[document.status]}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">{formatDateTimeBR(document.issued_at)}</td>
                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setSelectedDocument(document)}
                                >
                                  <Eye className="size-4" />
                                  Ver
                                </Button>
                                {document.status !== "cancelled" ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="destructive"
                                    disabled={cancelDocument.isPending}
                                    onClick={() => handleCancelDocument(document)}
                                  >
                                    <Ban className="size-4" />
                                    Cancelar
                                  </Button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingBag className="size-5" />
                  Vendas concluidas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {completedSales.length === 0 ? (
                  <StateBlock
                    title="Nenhuma venda concluida"
                    description="Quando uma venda for concluida no PDV, ela aparecera aqui para gerar o documento local."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="px-4 py-3 font-medium">Data / hora</th>
                          <th className="px-4 py-3 font-medium">Cliente</th>
                          <th className="px-4 py-3 font-medium">Total</th>
                          <th className="px-4 py-3 font-medium">Documentos</th>
                          <th className="px-4 py-3 font-medium" />
                        </tr>
                      </thead>
                      <tbody>
                        {completedSales.map((sale) => {
                          const saleDocuments = documentsBySale.get(sale.id) ?? []
                          return (
                            <tr key={sale.id} className="border-b last:border-0 hover:bg-slate-50">
                              <td className="px-4 py-3">{formatDateTimeBR(sale.sold_at)}</td>
                              <td className="px-4 py-3">
                                {sale.customer_name ?? "Consumidor final"}
                              </td>
                              <td className="px-4 py-3 font-medium">
                                {formatCurrency(sale.total_amount)}
                              </td>
                              <td className="px-4 py-3">
                                {saleDocuments.length === 0 ? (
                                  <span className="text-muted-foreground">Nenhum</span>
                                ) : (
                                  <div className="flex flex-wrap gap-1">
                                    {saleDocuments.map((document) => (
                                      <Badge key={document.id} variant={statusVariant(document.status)}>
                                        {documentTypeLabel[document.doc_type]}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex justify-end">
                                  <SaleFiscalActions
                                    sale={sale}
                                    documents={saleDocuments}
                                    creating={createDocument.isPending}
                                    onCreate={handleCreateDocument}
                                  />
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <FiscalDocumentDialog
        document={selectedDocument}
        onClose={() => setSelectedDocument(null)}
      />
    </>
  )
}
