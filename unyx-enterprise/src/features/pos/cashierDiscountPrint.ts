import { escapeHtml } from "@/features/frontstore/formPrint"

import {
  DISCOUNT_REASON_LABEL,
  productLine,
  type CashierDiscountRecord,
  type DiscountReason,
} from "./cashierDiscount"
import { centsToReais } from "./coinExchange"

// Ficha de desconto no mesmo desenho da ficha de papel: título DESCONTO, valor, motivo (com a caixa
// marcada), produto, código, preço no sistema, preço de venda, descrição e assinatura do fiscal.

const money = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(centsToReais(cents))
const plain = (cents: number) => money(cents).replace("R$", "").trim()

const pad = (value: number) => String(value).padStart(2, "0")

/** 27/10/2026 14:35 */
function dateTime(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`
}

/** Dados que a ficha precisa; o registro salvo já traz tudo isso. */
export type DiscountSlip = Pick<
  CashierDiscountRecord,
  | "product_name"
  | "product_code"
  | "quantity"
  | "system_price_cents"
  | "sale_price_cents"
  | "discount_cents"
  | "reason"
  | "reason_description"
  | "fiscal_name"
  | "pdv"
  | "operator_name"
  | "created_at"
>

function reasonBox(reason: DiscountReason, current: DiscountReason) {
  return reason === current ? "X" : ""
}

/** Tamanho da ficha impressa: 80 x 100 mm (cabe em bobina de 80 mm e em etiqueta/papel pequeno). */
export const DISCOUNT_SLIP_MM = { width: 80, height: 100, margin: 3 } as const

const styles = `
  @page { size: ${DISCOUNT_SLIP_MM.width}mm ${DISCOUNT_SLIP_MM.height}mm; margin: ${DISCOUNT_SLIP_MM.margin}mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 0; padding: 0; }
  .slip { width: ${DISCOUNT_SLIP_MM.width - DISCOUNT_SLIP_MM.margin * 2}mm; margin: 0 auto; border: 1.5px solid #111; }
  .title { text-align: center; font-weight: 800; font-size: 19px; color: #c8202f; padding: 6px 0; border-bottom: 1.5px solid #111; letter-spacing: 1px; }
  .amount { display: flex; align-items: baseline; gap: 5px; padding: 5px 7px; border-bottom: 1.5px solid #111; }
  .amount .cur { font-weight: 700; font-size: 11px; }
  .amount .val { font-size: 21px; font-weight: 700; }
  .amount .calc { margin-left: auto; font-size: 8px; color: #555; }
  .head { text-align: center; font-weight: 700; font-size: 11px; padding: 3px 0; border-bottom: 1px solid #111; }
  .reason { display: flex; align-items: center; gap: 6px; padding: 3px 7px; border-bottom: 1px solid #111; font-weight: 700; font-size: 10px; }
  .box { width: 12px; height: 12px; border: 1.2px solid #111; display: inline-flex; align-items: center; justify-content: center; font-size: 9px; line-height: 1; }
  .product { padding: 5px 7px; border-bottom: 1px solid #111; font-size: 11px; min-height: 26px; }
  .kv { display: grid; grid-template-columns: 1fr 1.25fr; border-bottom: 1px solid #111; }
  .kv .k { text-align: right; font-weight: 700; font-size: 9px; padding: 4px 6px; border-right: 1px solid #111; }
  .kv .v { padding: 4px 6px; font-size: 11px; }
  .desc { padding: 4px 7px; border-bottom: 1px solid #111; min-height: 46px; font-size: 10px; }
  .desc b { display: block; margin-bottom: 3px; font-size: 9px; }
  .sign { display: grid; grid-template-columns: 1fr 1.25fr; }
  .sign .k { font-weight: 700; font-size: 9px; padding: 6px 6px; border-right: 1px solid #111; }
  .sign .v { padding: 5px 6px; font-size: 10px; }
`

export function buildDiscountHtml(slip: DiscountSlip) {
  const unit = Math.max(0, slip.system_price_cents - slip.sale_price_cents)
  const calc = slip.quantity > 1 ? `${plain(unit)} × ${slip.quantity}` : ""
  const description = slip.reason_description?.trim() ?? ""
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Desconto</title>
<style>${styles}</style></head><body>
<div class="slip">
  <div class="title">DESCONTO</div>
  <div class="amount"><span class="cur">R$</span><span class="val">${plain(slip.discount_cents)}</span><span class="calc">${escapeHtml(calc)}</span></div>
  <div class="head">Motivo</div>
  <div class="reason"><span class="box">${reasonBox(slip.reason, "preco_errado")}</span>${DISCOUNT_REASON_LABEL.preco_errado}</div>
  <div class="product">${escapeHtml(productLine(slip.product_name, slip.quantity))}</div>
  <div class="kv"><div class="k">Cód. Produto:</div><div class="v">${escapeHtml(slip.product_code || "—")}</div></div>
  <div class="kv"><div class="k">Sistema:</div><div class="v">R$ ${plain(slip.system_price_cents)}</div></div>
  <div class="kv"><div class="k">Venda:</div><div class="v">R$ ${plain(slip.sale_price_cents)}</div></div>
  <div class="kv"><div class="k">Caixa (PDV):</div><div class="v">${escapeHtml(slip.pdv || "—")}</div></div>
  <div class="kv"><div class="k">Operador (OP):</div><div class="v">${escapeHtml(slip.operator_name || "—")}</div></div>
  <div class="reason"><span class="box">${reasonBox(slip.reason, "outro")}</span>${DISCOUNT_REASON_LABEL.outro}</div>
  <div class="desc"><b>Descrição:</b>${escapeHtml(description)}</div>
  <div class="sign"><div class="k">Ass. Fiscal / Data:</div><div class="v">${escapeHtml(
    slip.fiscal_name || "—"
  )}<br>${dateTime(slip.created_at)}</div></div>
</div></body></html>`
}

/** PDF (80 x 100 mm) com a mesma ficha compacta. */
export async function buildDiscountPdf(slip: DiscountSlip) {
  const { jsPDF } = await import("jspdf")
  const pageWidth = DISCOUNT_SLIP_MM.width
  const pageHeight = DISCOUNT_SLIP_MM.height
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [pageWidth, pageHeight] })
  const margin = DISCOUNT_SLIP_MM.margin
  const width = pageWidth - margin * 2
  const right = margin + width
  const kvSplit = margin + width * 0.44

  pdf.setDrawColor(17, 17, 17)
  pdf.setTextColor(17, 17, 17)
  pdf.setLineWidth(0.4)

  let y = margin
  const row = (height: number, heavy = false) => {
    pdf.setLineWidth(heavy ? 0.4 : 0.25)
    pdf.rect(margin, y, width, height)
  }

  // Título
  row(8, true)
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(15)
  pdf.setTextColor(200, 32, 47)
  pdf.text("DESCONTO", pageWidth / 2, y + 5.8, { align: "center", charSpace: 0.5 })
  pdf.setTextColor(17, 17, 17)
  y += 8

  // Valor
  row(8.5, true)
  pdf.setFontSize(8)
  pdf.text("R$", margin + 2, y + 5.6)
  pdf.setFontSize(14)
  pdf.text(plain(slip.discount_cents), margin + 7.5, y + 6.2)
  if (slip.quantity > 1) {
    const unit = Math.max(0, slip.system_price_cents - slip.sale_price_cents)
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(6.5)
    pdf.setTextColor(90, 90, 90)
    pdf.text(`${plain(unit)} × ${slip.quantity}`, right - 2, y + 5.6, { align: "right" })
    pdf.setTextColor(17, 17, 17)
  }
  y += 8.5

  // Motivo
  row(5)
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(8.5)
  pdf.text("Motivo", pageWidth / 2, y + 3.6, { align: "center" })
  y += 5

  const reasonRow = (current: DiscountReason) => {
    row(5.2)
    pdf.setLineWidth(0.3)
    pdf.rect(margin + 2, y + 1.1, 3, 3)
    if (slip.reason === current) {
      pdf.setFontSize(7.5)
      pdf.text("X", margin + 3.5, y + 3.6, { align: "center" })
    }
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(7.5)
    pdf.text(DISCOUNT_REASON_LABEL[current], margin + 7, y + 3.6)
    y += 5.2
  }

  reasonRow("preco_errado")

  // Produto
  const productHeight = 7
  row(productHeight)
  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(8)
  const productText = pdf.splitTextToSize(productLine(slip.product_name, slip.quantity), width - 4) as string[]
  pdf.text(productText.slice(0, 2), margin + 2, y + 3)
  y += productHeight

  const kvHeight = 5.2
  const kvRow = (label: string, value: string) => {
    row(kvHeight)
    pdf.setLineWidth(0.25)
    pdf.line(kvSplit, y, kvSplit, y + kvHeight)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(6.5)
    pdf.text(label, kvSplit - 2, y + 3.6, { align: "right" })
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(8)
    pdf.text(pdf.splitTextToSize(value, right - kvSplit - 3)[0] ?? "", kvSplit + 2, y + 3.6)
    y += kvHeight
  }

  kvRow("Cód. Produto:", slip.product_code || "—")
  kvRow("Sistema:", `R$ ${plain(slip.system_price_cents)}`)
  kvRow("Venda:", `R$ ${plain(slip.sale_price_cents)}`)
  kvRow("Caixa (PDV):", slip.pdv || "—")
  kvRow("Operador (OP):", slip.operator_name || "—")
  reasonRow("outro")

  // Descrição
  const descHeight = 13
  row(descHeight)
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(6.5)
  pdf.text("Descrição:", margin + 2, y + 3.4)
  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(7)
  const descLines = pdf.splitTextToSize(slip.reason_description?.trim() ?? "", width - 4) as string[]
  pdf.text(descLines.slice(0, 3), margin + 2, y + 6.6)
  y += descHeight

  // Assinatura
  const signHeight = 8.5
  row(signHeight)
  pdf.setLineWidth(0.25)
  pdf.line(kvSplit, y, kvSplit, y + signHeight)
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(6.5)
  pdf.text("Ass. Fiscal / Data:", margin + 2, y + 5)
  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(7)
  pdf.text(pdf.splitTextToSize(slip.fiscal_name || "—", right - kvSplit - 3)[0] ?? "", kvSplit + 2, y + 3.4)
  pdf.text(dateTime(slip.created_at), kvSplit + 2, y + 6.8)

  return pdf.output("blob")
}
