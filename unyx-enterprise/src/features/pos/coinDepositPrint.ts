import { escapeHtml } from "@/features/frontstore/formPrint"

import { centsToReais } from "./coinExchange"
import {
  depositCode,
  ESTIMATE_UNKNOWN_LABEL,
  formatDateTimeFull,
  type CoinDepositRecord,
} from "./coinDeposit"

// Comprovante de moedas deixadas para troca: duas vias no mesmo arquivo, em meia folha A4
// (210 x 148 mm: via do cliente em cima e via do fiscal embaixo, com linha de corte). O texto das
// duas vias é igual; muda só o rótulo e quem fica com ela.

const money = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(centsToReais(cents))

const NOTICE = "O valor é uma estimativa e será conferido na contagem das moedas."

interface DepositFields {
  label: string
  value: string
}

function depositFields(deposit: CoinDepositRecord): DepositFields[] {
  const fields: DepositFields[] = [
    { label: "Cliente", value: deposit.customer_name },
    { label: "Telefone", value: deposit.customer_phone || "—" },
    { label: "Deixou em", value: formatDateTimeFull(deposit.left_at) },
    {
      label: "Valor estimado",
      value: deposit.estimated_cents > 0 ? money(deposit.estimated_cents) : ESTIMATE_UNKNOWN_LABEL,
    },
    { label: "Fiscal que recebeu", value: deposit.fiscal_name || deposit.user_profiles?.name || "—" },
  ]
  if (deposit.notes?.trim()) fields.push({ label: "Observação", value: deposit.notes.trim() })
  return fields
}

const VIAS = ["VIA DO CLIENTE", "VIA DO FISCAL"] as const

/** Meia folha A4 (210 x 148 mm): cada via ocupa 65 mm de altura. */
export const DEPOSIT_SHEET_MM = { width: 210, height: 148, margin: 6, gap: 6 } as const
const VIA_HEIGHT_MM = (DEPOSIT_SHEET_MM.height - DEPOSIT_SHEET_MM.margin * 2 - DEPOSIT_SHEET_MM.gap) / 2

const styles = `
  @page { size: ${DEPOSIT_SHEET_MM.width}mm ${DEPOSIT_SHEET_MM.height}mm; margin: ${DEPOSIT_SHEET_MM.margin}mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 0; padding: 0; }
  .page { width: ${DEPOSIT_SHEET_MM.width - DEPOSIT_SHEET_MM.margin * 2}mm; }
  .via { height: ${VIA_HEIGHT_MM}mm; overflow: hidden; border: 1.5px solid #111; display: flex; flex-direction: column; }
  .cut { height: 0; position: relative; border-top: 1.5px dashed #777; margin: ${DEPOSIT_SHEET_MM.gap / 2 - 0.2}mm 0; }
  .cut span { position: absolute; left: 50%; top: -7px; transform: translateX(-50%); background: #fff; padding: 0 8px; font-size: 8px; color: #555; letter-spacing: 2px; }
  .head { background: #f0a020; border-bottom: 1.5px solid #111; padding: 4px 10px; display: flex; align-items: center; gap: 10px; }
  .head .title { font-weight: 700; font-size: 13px; letter-spacing: 0.5px; margin-right: auto; }
  .head .code { font-size: 10px; }
  .head .code b { font-size: 12px; letter-spacing: 1.5px; }
  .head .tag { font-weight: 700; font-size: 9px; border: 1.5px solid #111; padding: 2px 6px; background: #fff; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; }
  .cell { padding: 3px 10px; border-bottom: 1px solid #111; min-width: 0; }
  .cell:nth-child(odd) { border-right: 1px solid #111; }
  .cell.full { grid-column: 1 / -1; border-right: 0; display: flex; align-items: baseline; gap: 10px; }
  .label { display: block; font-weight: 700; text-transform: uppercase; font-size: 7px; color: #333; }
  .value { font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cell.full .label { flex: 0 0 90px; display: inline; }
  .cell.full .value { white-space: normal; font-size: 11px; }
  .cell.big .value { font-size: 16px; font-weight: 700; }
  .notice { padding: 3px 10px; font-size: 8px; color: #444; border-bottom: 1px solid #111; }
  .signs { margin-top: auto; display: flex; gap: 20px; padding: 0 12px 4px; }
  .signs div { flex: 1; border-top: 1px solid #111; text-align: center; font-size: 8px; padding-top: 2px; }
`

function viaHtml(deposit: CoinDepositRecord, via: string) {
  // Dois a dois (cliente/telefone, data/fiscal) e depois o valor e a observação em linha inteira.
  const order = ["Cliente", "Telefone", "Deixou em", "Fiscal que recebeu", "Valor estimado", "Observação"]
  const cells = [...depositFields(deposit)]
    .sort((x, y) => order.indexOf(x.label) - order.indexOf(y.label))
    .map((field) => {
      const full = field.label === "Valor estimado" || field.label === "Observação"
      const big = field.label === "Valor estimado"
      return `<div class="cell${full ? " full" : ""}${big ? " big" : ""}"><span class="label">${escapeHtml(
        field.label
      )}</span><span class="value">${escapeHtml(field.value)}</span></div>`
    })
    .join("")
  return `<section class="via">
    <div class="head"><span class="title">MOEDAS DEIXADAS PARA TROCA</span><span class="code">Código: <b>${depositCode(
      deposit.id
    )}</b></span><span class="tag">${via}</span></div>
    <div class="grid">${cells}</div>
    <div class="notice">${NOTICE}</div>
    <div class="signs"><div>Assinatura do cliente</div><div>Assinatura do fiscal</div></div>
  </section>`
}

export function buildCoinDepositHtml(deposit: CoinDepositRecord) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Moedas deixadas ${depositCode(
    deposit.id
  )}</title><style>${styles}</style></head><body>
<div class="page">
  ${viaHtml(deposit, VIAS[0])}
  <div class="cut"><span>CORTE AQUI</span></div>
  ${viaHtml(deposit, VIAS[1])}
</div></body></html>`
}

/** PDF em meia folha A4 (210 x 148 mm) com as duas vias (cliente em cima, fiscal embaixo). */
export async function buildCoinDepositPdf(deposit: CoinDepositRecord) {
  const { jsPDF } = await import("jspdf")
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: [DEPOSIT_SHEET_MM.width, DEPOSIT_SHEET_MM.height],
  })
  const margin = DEPOSIT_SHEET_MM.margin
  const width = DEPOSIT_SHEET_MM.width - margin * 2
  const viaHeight = VIA_HEIGHT_MM
  const half = width / 2
  const fields = depositFields(deposit)
  const find = (label: string) => fields.find((field) => field.label === label)

  const drawVia = (top: number, via: string) => {
    pdf.setDrawColor(17, 17, 17)
    pdf.setTextColor(17, 17, 17)
    pdf.setLineWidth(0.4)
    pdf.rect(margin, top, width, viaHeight)

    // Cabeçalho
    pdf.setFillColor(240, 160, 32)
    pdf.rect(margin, top, width, 8, "FD")
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(11)
    pdf.text("MOEDAS DEIXADAS PARA TROCA", margin + 4, top + 5.4)
    pdf.setFontSize(8)
    const tagWidth = pdf.getTextWidth(via) + 5
    const tagX = margin + width - tagWidth - 3
    pdf.setFillColor(255, 255, 255)
    pdf.rect(tagX, top + 1.6, tagWidth, 4.8, "FD")
    pdf.text(via, tagX + tagWidth / 2, top + 5, { align: "center" })
    pdf.setFontSize(11)
    const code = depositCode(deposit.id)
    // jsPDF não conta o espaçamento entre letras na largura: soma à mão para não encostar na etiqueta.
    const codeWidth = pdf.getTextWidth(code) + 0.6 * code.length * 0.3528
    const codeX = tagX - 5 - codeWidth
    pdf.text(code, codeX, top + 5.5, { charSpace: 0.6 })
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(8)
    pdf.text("Código:", codeX - 2, top + 5.4, { align: "right" })

    pdf.setLineWidth(0.25)
    let y = top + 8

    const cell = (x: number, cellWidth: number, label: string, value: string, height: number) => {
      pdf.rect(x, y, cellWidth, height)
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(6)
      pdf.setTextColor(60, 60, 60)
      pdf.text(label.toUpperCase(), x + 3, y + 3)
      pdf.setTextColor(17, 17, 17)
      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(10)
      pdf.text((pdf.splitTextToSize(value, cellWidth - 6) as string[])[0] ?? "", x + 3, y + height - 2)
    }

    const pair = (left: string, right: string) => {
      const a = find(left)
      const b = find(right)
      if (a) cell(margin, half, a.label, a.value, 9)
      if (b) cell(margin + half, half, b.label, b.value, 9)
      y += 9
    }
    pair("Cliente", "Telefone")
    pair("Deixou em", "Fiscal que recebeu")

    const estimate = find("Valor estimado")
    if (estimate) {
      pdf.rect(margin, y, width, 10)
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(6)
      pdf.setTextColor(60, 60, 60)
      pdf.text("VALOR ESTIMADO", margin + 3, y + 6.2)
      pdf.setTextColor(17, 17, 17)
      pdf.setFontSize(14)
      pdf.text(estimate.value, margin + 30, y + 7)
      y += 10
    }

    const notes = find("Observação")
    if (notes) {
      pdf.rect(margin, y, width, 7)
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(6)
      pdf.setTextColor(60, 60, 60)
      pdf.text("OBSERVAÇÃO", margin + 3, y + 4.4)
      pdf.setTextColor(17, 17, 17)
      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(9)
      pdf.text((pdf.splitTextToSize(notes.value, width - 36) as string[])[0] ?? "", margin + 30, y + 4.6)
      y += 7
    }

    // Aviso
    pdf.rect(margin, y, width, 6)
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(7)
    pdf.setTextColor(70, 70, 70)
    pdf.text(NOTICE, margin + 3, y + 4)
    pdf.setTextColor(17, 17, 17)

    // Assinaturas
    const signY = top + viaHeight - 6
    const signHalf = (width - 12) / 2
    pdf.setLineWidth(0.3)
    pdf.line(margin + 4, signY, margin + 4 + signHalf - 4, signY)
    pdf.line(margin + 4 + signHalf + 4, signY, margin + width - 4, signY)
    pdf.setFontSize(7)
    pdf.text("Assinatura do cliente", margin + 4 + (signHalf - 4) / 2, signY + 3.2, { align: "center" })
    pdf.text("Assinatura do fiscal", margin + 4 + signHalf + 4 + (signHalf - 4) / 2, signY + 3.2, { align: "center" })
  }

  drawVia(margin, VIAS[0])
  const cutY = margin + viaHeight + DEPOSIT_SHEET_MM.gap / 2
  pdf.setLineWidth(0.3)
  pdf.setLineDashPattern([2, 2], 0)
  pdf.setDrawColor(120, 120, 120)
  pdf.line(margin, cutY, margin + width, cutY)
  pdf.setLineDashPattern([], 0)
  pdf.setFillColor(255, 255, 255)
  pdf.rect(DEPOSIT_SHEET_MM.width / 2 - 14, cutY - 1.6, 28, 3.2, "F")
  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(6)
  pdf.setTextColor(110, 110, 110)
  pdf.text("CORTE AQUI", DEPOSIT_SHEET_MM.width / 2 - 8.5, cutY + 0.8, { charSpace: 1 })
  drawVia(margin + viaHeight + DEPOSIT_SHEET_MM.gap, VIAS[1])

  return pdf.output("blob")
}
