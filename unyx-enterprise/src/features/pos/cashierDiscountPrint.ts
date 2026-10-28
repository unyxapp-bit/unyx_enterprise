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

const styles = `
  @page { size: A6 portrait; margin: 6mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 0; padding: 0; }
  .slip { border: 2px solid #111; }
  .title { text-align: center; font-weight: 800; font-size: 26px; color: #c8202f; padding: 8px 0; border-bottom: 2px solid #111; letter-spacing: 1px; }
  .amount { display: flex; align-items: baseline; gap: 8px; padding: 6px 10px; border-bottom: 2px solid #111; }
  .amount .cur { font-weight: 700; font-size: 15px; }
  .amount .val { font-size: 26px; font-weight: 700; }
  .amount .calc { margin-left: auto; font-size: 10px; color: #555; }
  .head { text-align: center; font-weight: 700; font-size: 15px; padding: 5px 0; border-bottom: 1px solid #111; }
  .reason { display: flex; align-items: center; gap: 8px; padding: 4px 8px; border-bottom: 1px solid #111; font-weight: 700; font-size: 12px; }
  .box { width: 16px; height: 16px; border: 1.5px solid #111; display: inline-flex; align-items: center; justify-content: center; font-size: 13px; line-height: 1; }
  .product { padding: 6px 10px; border-bottom: 1px solid #111; font-size: 14px; min-height: 30px; }
  .kv { display: grid; grid-template-columns: 1fr 1.25fr; border-bottom: 1px solid #111; }
  .kv .k { text-align: right; font-weight: 700; font-size: 12px; padding: 6px 8px; border-right: 1px solid #111; }
  .kv .v { padding: 6px 8px; font-size: 14px; }
  .desc { padding: 6px 10px; border-bottom: 1px solid #111; min-height: 56px; font-size: 12px; }
  .desc b { display: block; margin-bottom: 4px; font-size: 12px; }
  .sign { display: grid; grid-template-columns: 1fr 1.25fr; }
  .sign .k { font-weight: 700; font-size: 11px; padding: 8px; border-right: 1px solid #111; }
  .sign .v { padding: 8px; font-size: 12px; }
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

/** PDF (A6 retrato) com a mesma ficha. */
export async function buildDiscountPdf(slip: DiscountSlip) {
  const { jsPDF } = await import("jspdf")
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a6" })
  const margin = 8
  const width = 105 - margin * 2
  const right = margin + width
  const kvSplit = margin + width * 0.44

  pdf.setDrawColor(17, 17, 17)
  pdf.setTextColor(17, 17, 17)
  pdf.setLineWidth(0.5)

  let y = 8
  const row = (height: number, heavy = false) => {
    pdf.setLineWidth(heavy ? 0.5 : 0.3)
    pdf.rect(margin, y, width, height)
  }

  // Título
  row(12, true)
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(22)
  pdf.setTextColor(200, 32, 47)
  pdf.text("DESCONTO", 105 / 2, y + 8.6, { align: "center", charSpace: 0.8 })
  pdf.setTextColor(17, 17, 17)
  y += 12

  // Valor
  row(13, true)
  pdf.setFontSize(11)
  pdf.text("R$", margin + 3, y + 8.2)
  pdf.setFontSize(20)
  pdf.text(plain(slip.discount_cents), margin + 12, y + 9)
  if (slip.quantity > 1) {
    const unit = Math.max(0, slip.system_price_cents - slip.sale_price_cents)
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(8)
    pdf.setTextColor(90, 90, 90)
    pdf.text(`${plain(unit)} × ${slip.quantity}`, right - 3, y + 8.5, { align: "right" })
    pdf.setTextColor(17, 17, 17)
  }
  y += 13

  // Motivo
  row(7)
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(11)
  pdf.text("Motivo", 105 / 2, y + 5, { align: "center" })
  y += 7

  const reasonRow = (current: DiscountReason) => {
    row(7)
    pdf.setLineWidth(0.4)
    pdf.rect(margin + 3, y + 1.6, 4, 4)
    if (slip.reason === current) {
      pdf.setFontSize(10)
      pdf.text("X", margin + 5, y + 5, { align: "center" })
    }
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(9)
    pdf.text(DISCOUNT_REASON_LABEL[current], margin + 10, y + 4.9)
    y += 7
  }

  reasonRow("preco_errado")

  // Produto
  const productHeight = 9
  row(productHeight)
  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(10)
  const productText = pdf.splitTextToSize(productLine(slip.product_name, slip.quantity), width - 6) as string[]
  pdf.text(productText.slice(0, 2), margin + 3, y + 4)
  y += productHeight

  const kvRow = (label: string, value: string) => {
    row(7.5)
    pdf.setLineWidth(0.3)
    pdf.line(kvSplit, y, kvSplit, y + 7.5)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(8.5)
    pdf.text(label, kvSplit - 3, y + 5, { align: "right" })
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(10)
    pdf.text(value, kvSplit + 3, y + 5)
    y += 7.5
  }

  kvRow("Cód. Produto:", slip.product_code || "—")
  kvRow("Sistema:", `R$ ${plain(slip.system_price_cents)}`)
  kvRow("Venda:", `R$ ${plain(slip.sale_price_cents)}`)
  kvRow("Caixa (PDV):", slip.pdv || "—")
  kvRow("Operador (OP):", slip.operator_name || "—")
  reasonRow("outro")

  // Descrição
  const descHeight = 20
  row(descHeight)
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(8.5)
  pdf.text("Descrição:", margin + 3, y + 5)
  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(9)
  const descLines = pdf.splitTextToSize(slip.reason_description?.trim() ?? "", width - 6) as string[]
  pdf.text(descLines.slice(0, 4), margin + 3, y + 10)
  y += descHeight

  // Assinatura
  const signHeight = 12
  row(signHeight)
  pdf.setLineWidth(0.3)
  pdf.line(kvSplit, y, kvSplit, y + signHeight)
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(8)
  pdf.text("Ass. Fiscal / Data:", margin + 3, y + 7)
  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(9)
  pdf.text(slip.fiscal_name || "—", kvSplit + 3, y + 5)
  pdf.text(dateTime(slip.created_at), kvSplit + 3, y + 9.5)

  return pdf.output("blob")
}
