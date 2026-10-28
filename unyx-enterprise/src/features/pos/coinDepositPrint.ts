import { escapeHtml } from "@/features/frontstore/formPrint"

import { centsToReais } from "./coinExchange"
import {
  depositCode,
  ESTIMATE_UNKNOWN_LABEL,
  formatDateTimeFull,
  type CoinDepositRecord,
} from "./coinDeposit"

// Comprovante de moedas deixadas para troca: duas vias no mesmo arquivo (uma folha A4, via do
// cliente em cima e via do fiscal embaixo, com linha de corte). O texto das duas vias é igual;
// muda só o rótulo e quem fica com ela.

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

const styles = `
  @page { size: A4 portrait; margin: 10mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 0; padding: 0; }
  .page { display: flex; flex-direction: column; min-height: 277mm; }
  .via { flex: 1; border: 2px solid #111; display: flex; flex-direction: column; }
  .cut { text-align: center; font-size: 11px; color: #555; letter-spacing: 3px; padding: 5mm 0; border: 0; border-top: 2px dashed #777; margin: 4mm 0; position: relative; }
  .cut span { position: absolute; left: 50%; top: -8px; transform: translateX(-50%); background: #fff; padding: 0 8px; }
  .head { background: #f0a020; border-bottom: 2px solid #111; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; }
  .head .title { font-weight: 700; font-size: 17px; letter-spacing: 1px; }
  .head .tag { font-weight: 700; font-size: 12px; border: 2px solid #111; padding: 3px 8px; background: #fff; }
  .code { padding: 6px 12px; border-bottom: 1px solid #111; font-size: 13px; }
  .code b { font-size: 16px; letter-spacing: 2px; }
  .field { padding: 8px 12px; border-bottom: 1px solid #111; font-size: 14px; display: flex; gap: 10px; }
  .field .label { flex: 0 0 150px; font-weight: 700; text-transform: uppercase; font-size: 11px; padding-top: 2px; }
  .field .value { flex: 1; font-size: 15px; }
  .field.big .value { font-size: 20px; font-weight: 700; }
  .notice { padding: 8px 12px; font-size: 11px; color: #444; border-bottom: 1px solid #111; }
  .signs { margin-top: auto; display: flex; gap: 24px; padding: 28px 16px 12px; }
  .signs div { flex: 1; border-top: 1px solid #111; text-align: center; font-size: 11px; padding-top: 3px; }
`

function viaHtml(deposit: CoinDepositRecord, via: string) {
  const fields = depositFields(deposit)
    .map(
      (field) =>
        `<div class="field${field.label === "Valor estimado" ? " big" : ""}"><span class="label">${escapeHtml(
          field.label
        )}</span><span class="value">${escapeHtml(field.value)}</span></div>`
    )
    .join("")
  return `<section class="via">
    <div class="head"><span class="title">MOEDAS DEIXADAS PARA TROCA</span><span class="tag">${via}</span></div>
    <div class="code">Código: <b>${depositCode(deposit.id)}</b></div>
    ${fields}
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

/** PDF A4 com as duas vias na mesma folha (cliente em cima, fiscal embaixo). */
export async function buildCoinDepositPdf(deposit: CoinDepositRecord) {
  const { jsPDF } = await import("jspdf")
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const margin = 12
  const width = 210 - margin * 2
  const viaHeight = 128
  const fields = depositFields(deposit)

  const drawVia = (top: number, via: string) => {
    pdf.setDrawColor(17, 17, 17)
    pdf.setTextColor(17, 17, 17)
    pdf.setLineWidth(0.5)
    pdf.rect(margin, top, width, viaHeight)

    // Cabeçalho
    pdf.setFillColor(240, 160, 32)
    pdf.rect(margin, top, width, 12, "FD")
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(13)
    pdf.text("MOEDAS DEIXADAS PARA TROCA", margin + 4, top + 8)
    pdf.setFontSize(9)
    const tagWidth = pdf.getTextWidth(via) + 6
    pdf.setFillColor(255, 255, 255)
    pdf.rect(margin + width - tagWidth - 3, top + 2.5, tagWidth, 7, "FD")
    pdf.text(via, margin + width - tagWidth / 2 - 3, top + 7.3, { align: "center" })

    // Código
    let y = top + 12
    pdf.setLineWidth(0.3)
    pdf.rect(margin, y, width, 9)
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(10)
    pdf.text("Código:", margin + 4, y + 6)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(13)
    pdf.text(depositCode(deposit.id), margin + 22, y + 6.2, { charSpace: 0.8 })
    y += 9

    // Campos
    for (const field of fields) {
      const big = field.label === "Valor estimado"
      const rowHeight = big ? 12 : 10
      pdf.rect(margin, y, width, rowHeight)
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(8)
      pdf.text(field.label.toUpperCase(), margin + 4, y + rowHeight / 2 + 1.2)
      pdf.setFontSize(big ? 15 : 11)
      pdf.setFont("helvetica", big ? "bold" : "normal")
      const lines = pdf.splitTextToSize(field.value, width - 52) as string[]
      pdf.text(lines[0] ?? "", margin + 46, y + rowHeight / 2 + (big ? 2 : 1.4))
      y += rowHeight
    }

    // Aviso
    pdf.rect(margin, y, width, 8)
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(8)
    pdf.setTextColor(70, 70, 70)
    pdf.text(NOTICE, margin + 4, y + 5)
    pdf.setTextColor(17, 17, 17)

    // Assinaturas
    const signY = top + viaHeight - 10
    const half = (width - 12) / 2
    pdf.setLineWidth(0.3)
    pdf.line(margin + 4, signY, margin + 4 + half - 4, signY)
    pdf.line(margin + 4 + half + 4, signY, margin + width - 4, signY)
    pdf.setFontSize(8)
    pdf.text("Assinatura do cliente", margin + 4 + (half - 4) / 2, signY + 4, { align: "center" })
    pdf.text("Assinatura do fiscal", margin + 4 + half + 4 + (half - 4) / 2, signY + 4, { align: "center" })
  }

  drawVia(12, VIAS[0])
  pdf.setLineDashPattern([2, 2], 0)
  pdf.setDrawColor(120, 120, 120)
  pdf.line(margin, 12 + viaHeight + 6, margin + width, 12 + viaHeight + 6)
  pdf.setLineDashPattern([], 0)
  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(7)
  pdf.setTextColor(110, 110, 110)
  pdf.text("CORTE AQUI", 105, 12 + viaHeight + 4.6, { align: "center", charSpace: 1 })
  drawVia(12 + viaHeight + 12, VIAS[1])

  return pdf.output("blob")
}
