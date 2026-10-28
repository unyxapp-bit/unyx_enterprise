import { escapeHtml } from "@/features/frontstore/formPrint"

import { formatDateTimeFull } from "./coinDeposit"
import { centsToReais } from "./coinExchange"
import {
  formatPickup,
  itemLine,
  orderCode,
  remainingCents,
  type CustomerOrderRecord,
} from "./customerOrder"

// Comprovante da encomenda: duas vias na mesma folha A4 (via do cliente em cima e via da produção
// embaixo, com linha de corte). O texto das duas vias é igual; muda só o rótulo e quem fica com ela.

const money = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(centsToReais(cents))

const VIAS = ["VIA DO CLIENTE", "VIA DA PRODUÇÃO"] as const

/** A4 em pé; cada via ocupa a metade da folha. */
export const ORDER_SHEET_MM = { width: 210, height: 297, margin: 8, gap: 8 } as const
const VIA_HEIGHT_MM = (ORDER_SHEET_MM.height - ORDER_SHEET_MM.margin * 2 - ORDER_SHEET_MM.gap) / 2

/** Mais linhas que isso não cabem na via: as demais viram "+ N itens". */
export const MAX_PRINT_ITEMS = 14

interface Totals {
  total: string | null
  paid: string | null
  remaining: string | null
}

function totalsOf(order: CustomerOrderRecord): Totals {
  const remaining = remainingCents(order.total_cents, order.paid_cents)
  return {
    total: order.total_cents != null && order.total_cents > 0 ? money(order.total_cents) : null,
    paid: order.paid_cents > 0 ? money(order.paid_cents) : null,
    remaining: remaining != null ? money(remaining) : null,
  }
}

/** Linhas que vão no papel (com o aviso de quantos ficaram de fora). */
export function printableItems(order: CustomerOrderRecord) {
  const lines = order.items.map(itemLine)
  if (lines.length <= MAX_PRINT_ITEMS) return lines
  const hidden = lines.length - (MAX_PRINT_ITEMS - 1)
  return [...lines.slice(0, MAX_PRINT_ITEMS - 1), `+ ${hidden} itens (veja no sistema)`]
}

const styles = `
  @page { size: A4 portrait; margin: ${ORDER_SHEET_MM.margin}mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 0; padding: 0; }
  .page { width: ${ORDER_SHEET_MM.width - ORDER_SHEET_MM.margin * 2}mm; }
  .via { height: ${VIA_HEIGHT_MM}mm; overflow: hidden; border: 1.5px solid #111; display: flex; flex-direction: column; }
  .cut { height: 0; position: relative; border-top: 1.5px dashed #777; margin: ${ORDER_SHEET_MM.gap / 2 - 0.2}mm 0; }
  .cut span { position: absolute; left: 50%; top: -7px; transform: translateX(-50%); background: #fff; padding: 0 8px; font-size: 8px; color: #555; letter-spacing: 2px; }
  .head { background: #f0a020; border-bottom: 1.5px solid #111; padding: 5px 10px; display: flex; align-items: center; gap: 10px; }
  .head .title { font-weight: 700; font-size: 15px; letter-spacing: 1px; margin-right: auto; }
  .head .code { font-size: 10px; }
  .head .code b { font-size: 13px; letter-spacing: 1.5px; }
  .head .tag { font-weight: 700; font-size: 9px; border: 1.5px solid #111; padding: 2px 6px; background: #fff; }
  .pickup { padding: 6px 10px; border-bottom: 1.5px solid #111; background: #fff6e0; }
  .pickup .label { display: block; }
  .pickup .when { font-size: 19px; font-weight: 700; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; }
  .cell { padding: 3px 10px; border-bottom: 1px solid #111; min-width: 0; }
  .cell:nth-child(odd) { border-right: 1px solid #111; }
  .cell.third { grid-column: span 2; }
  .label { display: block; font-weight: 700; text-transform: uppercase; font-size: 7px; color: #333; }
  .value { font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .items { flex: 1; min-height: 0; padding: 4px 10px; border-bottom: 1px solid #111; overflow: hidden; }
  .items ol { margin: 2px 0 0; padding-left: 18px; font-size: 12px; line-height: 1.35; }
  .money { display: flex; border-bottom: 1px solid #111; }
  .money div { flex: 1; padding: 3px 10px; border-right: 1px solid #111; }
  .money div:last-child { border-right: 0; }
  .money .value { font-weight: 700; font-size: 13px; }
  .notes { padding: 3px 10px; border-bottom: 1px solid #111; font-size: 10px; max-height: 12mm; overflow: hidden; }
  .signs { display: flex; gap: 24px; padding: 14px 14px 4px; }
  .signs div { flex: 1; border-top: 1px solid #111; text-align: center; font-size: 8px; padding-top: 2px; }
`

function viaHtml(order: CustomerOrderRecord, via: string) {
  const totals = totalsOf(order)
  const items = printableItems(order)
    .map((line) => `<li>${escapeHtml(line)}</li>`)
    .join("")
  const moneyRow =
    totals.total || totals.paid
      ? `<div class="money">
      <div><span class="label">Valor total</span><span class="value">${totals.total ?? "—"}</span></div>
      <div><span class="label">Sinal pago</span><span class="value">${totals.paid ?? "—"}</span></div>
      <div><span class="label">Falta pagar</span><span class="value">${totals.remaining ?? "—"}</span></div>
    </div>`
      : ""
  const notes = order.notes?.trim()
    ? `<div class="notes"><span class="label">Observação</span>${escapeHtml(order.notes.trim())}</div>`
    : ""
  return `<section class="via">
    <div class="head"><span class="title">ENCOMENDA</span><span class="code">Nº <b>${orderCode(
      order.id
    )}</b></span><span class="tag">${via}</span></div>
    <div class="pickup"><span class="label">Retirada</span><span class="when">${escapeHtml(
      formatPickup(order.pickup_at)
    )}</span></div>
    <div class="grid">
      <div class="cell"><span class="label">Cliente</span><span class="value">${escapeHtml(order.customer_name)}</span></div>
      <div class="cell"><span class="label">Telefone</span><span class="value">${escapeHtml(order.customer_phone || "—")}</span></div>
      <div class="cell"><span class="label">Pedido feito em</span><span class="value">${escapeHtml(
        formatDateTimeFull(order.ordered_at)
      )}</span></div>
      <div class="cell"><span class="label">Atendente</span><span class="value">${escapeHtml(order.attendant_name || "—")}</span></div>
    </div>
    <div class="items"><span class="label">Pedido</span><ol>${items}</ol></div>
    ${moneyRow}
    ${notes}
    <div class="signs"><div>Assinatura do cliente</div><div>Assinatura do atendente</div></div>
  </section>`
}

export function buildCustomerOrderHtml(order: CustomerOrderRecord) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Encomenda ${orderCode(
    order.id
  )}</title><style>${styles}</style></head><body>
<div class="page">
  ${viaHtml(order, VIAS[0])}
  <div class="cut"><span>CORTE AQUI</span></div>
  ${viaHtml(order, VIAS[1])}
</div></body></html>`
}

/** PDF A4 com as duas vias (cliente em cima, produção embaixo). */
export async function buildCustomerOrderPdf(order: CustomerOrderRecord) {
  const { jsPDF } = await import("jspdf")
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const margin = ORDER_SHEET_MM.margin
  const width = ORDER_SHEET_MM.width - margin * 2
  const half = width / 2
  const viaHeight = VIA_HEIGHT_MM
  const totals = totalsOf(order)
  const hasMoney = Boolean(totals.total || totals.paid)
  const notes = order.notes?.trim() ?? ""
  const lines = printableItems(order)

  const label = (text: string, x: number, y: number) => {
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(6.5)
    pdf.setTextColor(60, 60, 60)
    pdf.text(text.toUpperCase(), x, y)
    pdf.setTextColor(17, 17, 17)
  }

  const drawVia = (top: number, via: string) => {
    pdf.setDrawColor(17, 17, 17)
    pdf.setTextColor(17, 17, 17)
    pdf.setLineWidth(0.4)
    pdf.rect(margin, top, width, viaHeight)

    // Cabeçalho
    pdf.setFillColor(240, 160, 32)
    pdf.rect(margin, top, width, 10, "FD")
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(14)
    pdf.text("ENCOMENDA", margin + 4, top + 6.8)
    pdf.setFontSize(8)
    const tagWidth = pdf.getTextWidth(via) + 5
    const tagX = margin + width - tagWidth - 3
    pdf.setFillColor(255, 255, 255)
    pdf.rect(tagX, top + 2.6, tagWidth, 4.8, "FD")
    pdf.text(via, tagX + tagWidth / 2, top + 6, { align: "center" })
    const code = orderCode(order.id)
    pdf.setFontSize(12)
    const codeWidth = pdf.getTextWidth(code) + 0.6 * code.length * 0.3528
    const codeX = tagX - 5 - codeWidth
    pdf.text(code, codeX, top + 6.6, { charSpace: 0.6 })
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(8)
    pdf.text("Nº", codeX - 2, top + 6.5, { align: "right" })

    pdf.setLineWidth(0.25)
    let y = top + 10

    // Retirada em destaque
    pdf.setFillColor(255, 246, 224)
    pdf.rect(margin, y, width, 14, "FD")
    label("Retirada", margin + 4, y + 4)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(17)
    pdf.text(formatPickup(order.pickup_at), margin + 4, y + 11.2)
    y += 14

    const cell = (x: number, cellWidth: number, name: string, value: string) => {
      pdf.rect(x, y, cellWidth, 10)
      label(name, x + 3, y + 3.4)
      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(10.5)
      pdf.text((pdf.splitTextToSize(value, cellWidth - 6) as string[])[0] ?? "", x + 3, y + 8)
    }
    cell(margin, half, "Cliente", order.customer_name)
    cell(margin + half, half, "Telefone", order.customer_phone || "—")
    y += 10
    cell(margin, half, "Pedido feito em", formatDateTimeFull(order.ordered_at))
    cell(margin + half, half, "Atendente", order.attendant_name || "—")
    y += 10

    // Espaço que sobra para os itens: o resto da via menos totais, observação e assinaturas.
    const noteLines = notes ? (pdf.setFontSize(9), pdf.splitTextToSize(notes, width - 8) as string[]).slice(0, 2) : []
    const noteHeight = notes ? 4 + noteLines.length * 4 : 0
    const moneyHeight = hasMoney ? 10 : 0
    const signsHeight = 12
    const itemsHeight = top + viaHeight - y - moneyHeight - noteHeight - signsHeight
    pdf.rect(margin, y, width, itemsHeight)
    label("Pedido", margin + 3, y + 3.4)
    const rowHeight = Math.min(6.5, (itemsHeight - 6) / Math.max(lines.length, 1))
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(Math.max(7, Math.min(11, rowHeight * 1.7)))
    lines.forEach((line, index) => {
      const text = `${index + 1}. ${line}`
      pdf.text((pdf.splitTextToSize(text, width - 8) as string[])[0] ?? "", margin + 3, y + 7.5 + index * rowHeight)
    })
    y += itemsHeight

    if (hasMoney) {
      const third = width / 3
      const cells: Array<[string, string | null]> = [
        ["Valor total", totals.total],
        ["Sinal pago", totals.paid],
        ["Falta pagar", totals.remaining],
      ]
      cells.forEach(([name, value], index) => {
        const x = margin + third * index
        pdf.rect(x, y, third, 10)
        label(name, x + 3, y + 3.4)
        pdf.setFont("helvetica", "bold")
        pdf.setFontSize(11.5)
        pdf.text(value ?? "—", x + 3, y + 8)
      })
      y += 10
    }

    if (notes) {
      pdf.rect(margin, y, width, noteHeight)
      label("Observação", margin + 3, y + 3.2)
      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(9)
      pdf.text(noteLines, margin + 3, y + 7)
      y += noteHeight
    }

    // Assinaturas
    const signY = top + viaHeight - 6
    const signHalf = (width - 12) / 2
    pdf.setLineWidth(0.3)
    pdf.line(margin + 4, signY, margin + 4 + signHalf - 4, signY)
    pdf.line(margin + 4 + signHalf + 4, signY, margin + width - 4, signY)
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(7)
    pdf.text("Assinatura do cliente", margin + 4 + (signHalf - 4) / 2, signY + 3.2, { align: "center" })
    pdf.text("Assinatura do atendente", margin + 4 + signHalf + 4 + (signHalf - 4) / 2, signY + 3.2, {
      align: "center",
    })
  }

  drawVia(margin, VIAS[0])
  const cutY = margin + viaHeight + ORDER_SHEET_MM.gap / 2
  pdf.setLineWidth(0.3)
  pdf.setLineDashPattern([2, 2], 0)
  pdf.setDrawColor(120, 120, 120)
  pdf.line(margin, cutY, margin + width, cutY)
  pdf.setLineDashPattern([], 0)
  pdf.setFillColor(255, 255, 255)
  pdf.rect(ORDER_SHEET_MM.width / 2 - 14, cutY - 1.6, 28, 3.2, "F")
  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(6)
  pdf.setTextColor(110, 110, 110)
  pdf.text("CORTE AQUI", ORDER_SHEET_MM.width / 2 - 8.5, cutY + 0.8, { charSpace: 1 })
  drawVia(margin + viaHeight + ORDER_SHEET_MM.gap, VIAS[1])

  return pdf.output("blob")
}
