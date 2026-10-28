import type { jsPDF } from "jspdf"

import { escapeHtml } from "@/features/frontstore/formPrint"

import { centsToReais, type CoinExchangeLine, type CoinExchangeResult } from "./coinExchange"

// Ficha de troca de moedas para o fiscal: mesmo desenho da ficha de papel (uma coluna por
// percentual, total, total com %, total do vale, fiscal e data), com os pacotes de cada moeda.
// Não leva o nome do cliente: ele fica só no registro da troca.

const money = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(centsToReais(cents))
const plain = (cents: number) => money(cents).replace("R$", "").trim()
const percent = (value: number) => `${String(value).replace(".", ",")}%`

export interface CoinSheetInfo {
  fiscal: string
  /** Data já formatada, ex.: 27/10/2026. */
  dateLabel: string
  notes?: string
}

interface SheetGroup {
  rate: number
  lines: CoinExchangeLine[]
  faceCents: number
  bonusCents: number
}

/** Colunas da ficha: uma por percentual, maior primeiro. */
function sheetGroups(result: CoinExchangeResult): SheetGroup[] {
  const rates = [...new Set(result.lines.map((line) => line.rate))].sort((a, b) => b - a)
  return rates.map((rate) => {
    const lines = result.lines.filter((line) => line.rate === rate)
    return {
      rate,
      lines,
      faceCents: lines.reduce((sum, line) => sum + line.faceCents, 0),
      bonusCents: lines.reduce((sum, line) => sum + line.bonusCents, 0),
    }
  })
}

/** "4 pacotes + 0,60", "2 pacotes" ou "10,00 soltos". Vazio quando não há valor. */
function packsLabel(line: CoinExchangeLine) {
  if (line.faceCents === 0) return ""
  const packs = line.packs > 0 ? `${line.packs} ${line.packs === 1 ? "pacote" : "pacotes"}` : ""
  const loose = line.looseCents > 0 ? `${plain(line.looseCents)}${line.packs === 0 ? " soltos" : ""}` : ""
  return [packs, loose].filter(Boolean).join(" + ")
}

const styles = `
  @page { size: A5 landscape; margin: 10mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 0; padding: 0; }
  .sheet { width: 100%; border: 2px solid #111; }
  .title { background: #f0a020; border-bottom: 2px solid #111; text-align: center; font-weight: 700; font-size: 20px; padding: 9px; letter-spacing: 2px; }
  .groups { display: flex; }
  .group { flex: 1; border-right: 2px solid #111; }
  .group:last-child { border-right: 0; }
  /* Todas as linhas têm a mesma altura e as colunas têm o mesmo número de linhas: os totais alinham. */
  .line { display: grid; grid-template-columns: 1.1fr 1.5fr 1fr; align-items: center; column-gap: 6px; height: 32px; padding: 0 12px; border-bottom: 1px solid #aaa; font-size: 14px; }
  .line.head { grid-template-columns: 1fr; text-align: center; height: 30px; background: #f1f1f1; border-bottom: 1px solid #111; font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; }
  .line.sub { height: 22px; font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 0.6px; border-bottom: 1px solid #111; }
  .line .packs { text-align: center; font-size: 11px; color: #555; }
  .line.sub .packs { font-size: 10px; color: #666; }
  .line .value { text-align: right; font-variant-numeric: tabular-nums; }
  .line.total { background: #f6f6f6; font-weight: 700; border-top: 1px solid #111; }
  .line.bonus { grid-template-columns: 1fr auto; background: #eaf5ee; font-weight: 700; border-bottom: 0; }
  .line.total { grid-template-columns: 1fr auto; }
  .line.total .value, .line.bonus .value { font-size: 15px; }
  .vale { display: flex; justify-content: space-between; align-items: center; padding: 0 12px; height: 42px; border-top: 2px solid #111; border-bottom: 2px solid #111; background: #fdecef; font-weight: 700; font-size: 19px; color: #b00020; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; }
  .meta > div, .note { padding: 0 12px; height: 32px; display: flex; align-items: center; gap: 6px; font-size: 14px; }
  .meta > div:first-child { border-right: 1px solid #111; }
  .note { border-top: 1px solid #111; }
  b.lab { text-transform: uppercase; font-size: 11px; letter-spacing: 0.6px; }
`

export function buildCoinSheetHtml(result: CoinExchangeResult, info: CoinSheetInfo) {
  const groupsData = sheetGroups(result)
  const maxLines = Math.max(...groupsData.map((group) => group.lines.length))

  const groups = groupsData
    .map((group) => {
      const rows = group.lines
        .map(
          (line) =>
            `<div class="line"><span>${escapeHtml(line.label)}</span><span class="packs">${escapeHtml(
              packsLabel(line)
            )}</span><span class="value">${line.faceCents > 0 ? plain(line.faceCents) : ""}</span></div>`
        )
        .join("")
      const padding = '<div class="line"></div>'.repeat(maxLines - group.lines.length)
      return `<div class="group">
        <div class="line head">Acréscimo de ${escapeHtml(percent(group.rate))}</div>
        <div class="line sub"><span>Moeda</span><span class="packs">Pacotes</span><span class="value">Valor (R$)</span></div>
        ${rows}${padding}
        <div class="line total"><span>TOTAL</span><span class="value">${plain(group.faceCents)}</span></div>
        <div class="line bonus"><span>TOTAL C/ ${escapeHtml(percent(group.rate))}</span><span class="value">${plain(group.bonusCents)}</span></div>
      </div>`
    })
    .join("")

  const notes = info.notes?.trim()
    ? `<div class="note"><b class="lab">Obs.:</b> ${escapeHtml(info.notes.trim())}</div>`
    : ""

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Troca de moedas</title>
<style>${styles}</style></head><body>
<div class="sheet">
  <div class="title">TROCA DE MOEDAS</div>
  <div class="groups">${groups}</div>
  <div class="vale"><span>TOTAL DO VALE:</span><span>${money(result.bonusCents)}</span></div>
  <div class="meta">
    <div><b class="lab">Fiscal:</b> ${escapeHtml(info.fiscal || "—")}</div>
    <div><b class="lab">Data:</b> ${escapeHtml(info.dateLabel)}</div>
  </div>
  ${notes}
</div></body></html>`
}

function drawFiscalPage(pdf: jsPDF, result: CoinExchangeResult, info: CoinSheetInfo) {
  const margin = 12
  const tableWidth = 210 - margin * 2
  const rowHeight = 7.5
  const baseline = (top: number, height = rowHeight) => top + height * 0.68

  pdf.setDrawColor(17, 17, 17)
  pdf.setTextColor(17, 17, 17)
  pdf.setLineWidth(0.5)

  let y = 14
  pdf.setFillColor(240, 160, 32)
  pdf.rect(margin, y, tableWidth, 11, "FD")
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(16)
  pdf.text("TROCA DE MOEDAS", 105, y + 7.6, { align: "center", charSpace: 0.6 })
  y += 11

  const groups = sheetGroups(result)
  const maxLines = Math.max(...groups.map((group) => group.lines.length))
  const columnWidth = tableWidth / groups.length
  const showPacks = columnWidth >= 80
  const subHeight = 5.5
  // Todas as colunas têm o mesmo número de linhas, então os totais ficam alinhados.
  const bodyHeight = rowHeight + subHeight + rowHeight * (maxLines + 2)
  pdf.rect(margin, y, tableWidth, bodyHeight)

  groups.forEach((group, index) => {
    const left = margin + index * columnWidth
    const right = left + columnWidth
    if (index > 0) pdf.line(left, y, left, y + bodyHeight)

    // Título da coluna
    pdf.setFillColor(241, 241, 241)
    pdf.rect(left, y, columnWidth, rowHeight, "F")
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(9.5)
    pdf.text(`ACRÉSCIMO DE ${percent(group.rate)}`, left + columnWidth / 2, baseline(y), {
      align: "center",
      charSpace: 0.3,
    })
    pdf.setLineWidth(0.3)
    pdf.line(left, y + rowHeight, right, y + rowHeight)

    // Rótulos das colunas
    const subTop = y + rowHeight
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(6.5)
    pdf.setTextColor(110, 110, 110)
    pdf.text("MOEDA", left + 3, baseline(subTop, subHeight))
    if (showPacks) pdf.text("PACOTES", left + columnWidth * 0.5, baseline(subTop, subHeight), { align: "center" })
    pdf.text("VALOR (R$)", right - 3, baseline(subTop, subHeight), { align: "right" })
    pdf.setTextColor(17, 17, 17)
    pdf.line(left, subTop + subHeight, right, subTop + subHeight)

    // Moedas (e linhas em branco para igualar as colunas)
    const firstLine = subTop + subHeight
    for (let row = 0; row < maxLines; row += 1) {
      const top = firstLine + rowHeight * row
      const line = group.lines[row]
      if (line) {
        pdf.setFont("helvetica", "normal")
        pdf.setFontSize(11)
        pdf.text(line.label, left + 3, baseline(top))
        const packs = showPacks ? packsLabel(line) : ""
        if (packs) {
          pdf.setFontSize(8)
          pdf.setTextColor(90, 90, 90)
          pdf.text(packs, left + columnWidth * 0.5, baseline(top), { align: "center" })
          pdf.setTextColor(17, 17, 17)
        }
        pdf.setFontSize(11)
        if (line.faceCents > 0) pdf.text(plain(line.faceCents), right - 3, baseline(top), { align: "right" })
      }
      pdf.setDrawColor(170, 170, 170)
      pdf.line(left, top + rowHeight, right, top + rowHeight)
      pdf.setDrawColor(17, 17, 17)
    }

    // Total e total com %
    const totalTop = firstLine + rowHeight * maxLines
    pdf.setFillColor(246, 246, 246)
    pdf.rect(left, totalTop, columnWidth, rowHeight, "F")
    pdf.setLineWidth(0.4)
    pdf.line(left, totalTop, right, totalTop)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(10.5)
    pdf.text("TOTAL", left + 3, baseline(totalTop))
    pdf.text(plain(group.faceCents), right - 3, baseline(totalTop), { align: "right" })

    const bonusTop = totalTop + rowHeight
    pdf.setFillColor(234, 245, 238)
    pdf.rect(left, bonusTop, columnWidth, rowHeight, "F")
    pdf.text(`TOTAL C/ ${percent(group.rate)}`, left + 3, baseline(bonusTop))
    pdf.text(plain(group.bonusCents), right - 3, baseline(bonusTop), { align: "right" })
    pdf.setLineWidth(0.3)
  })
  pdf.setLineWidth(0.5)
  pdf.rect(margin, y, tableWidth, bodyHeight)
  y += bodyHeight

  // Total do vale
  pdf.setFillColor(253, 236, 239)
  pdf.rect(margin, y, tableWidth, 11, "FD")
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(13)
  pdf.setTextColor(176, 0, 32)
  pdf.text("TOTAL DO VALE:", margin + 3, y + 7.4)
  pdf.text(money(result.bonusCents), margin + tableWidth - 3, y + 7.4, { align: "right" })
  pdf.setTextColor(17, 17, 17)
  y += 11

  // Fiscal e data lado a lado
  const half = tableWidth / 2
  pdf.setLineWidth(0.5)
  pdf.rect(margin, y, half, rowHeight + 0.5)
  pdf.rect(margin + half, y, half, rowHeight + 0.5)
  for (const [label, value, x] of [
    ["FISCAL:", info.fiscal || "—", margin],
    ["DATA:", info.dateLabel, margin + half],
  ] as const) {
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(9)
    pdf.text(label, x + 3, baseline(y))
    const labelWidth = pdf.getTextWidth(label)
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(10.5)
    pdf.text(value, x + 3 + labelWidth + 2, baseline(y))
  }
  y += rowHeight + 0.5

  if (info.notes?.trim()) {
    pdf.rect(margin, y, tableWidth, rowHeight + 0.5)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(9)
    pdf.text("OBS.:", margin + 3, baseline(y))
    const labelWidth = pdf.getTextWidth("OBS.:")
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(10.5)
    pdf.text(info.notes.trim(), margin + 3 + labelWidth + 2, baseline(y))
  }
}

/** PDF (A5 paisagem) com a ficha do fiscal, para baixar e guardar ou imprimir depois. */
export async function buildCoinSheetPdf(result: CoinExchangeResult, info: CoinSheetInfo) {
  const { jsPDF } = await import("jspdf")
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a5" })
  drawFiscalPage(pdf, result, info)
  return pdf.output("blob")
}

// ---------------------------------------------------------------------------------------------
// Conferência para o cliente: o que ele entregou, o acréscimo e o total a receber. Não leva as
// informações internas do fiscal (pacotes, moedas soltas).
// ---------------------------------------------------------------------------------------------

export interface CoinCustomerInfo extends CoinSheetInfo {
  customerName?: string
  customerPhone?: string
}

const CUSTOMER_NOTICE = "Confira os valores antes de assinar."

function customerLines(result: CoinExchangeResult) {
  return result.lines.filter((line) => line.faceCents > 0)
}

function customerWho(info: CoinCustomerInfo) {
  const name = info.customerName?.trim()
  if (!name) return "—"
  return info.customerPhone?.trim() ? `${name} · ${info.customerPhone.trim()}` : name
}

const customerStyles = `
  @page { size: A5 landscape; margin: 10mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 0; padding: 0; }
  .sheet { width: 100%; border: 2px solid #111; }
  .title { background: #f0a020; border-bottom: 2px solid #111; text-align: center; font-weight: 700; font-size: 18px; padding: 8px; letter-spacing: 1.5px; }
  .info { padding: 6px 10px; border-bottom: 1px solid #111; font-size: 13px; display: flex; gap: 8px; }
  .info b { text-transform: uppercase; font-size: 11px; flex: 0 0 70px; padding-top: 1px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 6px 10px; border-bottom: 1px solid #111; font-size: 13px; text-align: right; }
  th { background: #f6f6f6; text-transform: uppercase; font-size: 11px; }
  th:first-child, td:first-child { text-align: left; }
  tr.sum td { font-weight: 700; }
  tr.total td { border-top: 2px solid #111; font-size: 17px; font-weight: 700; color: #0a5c2f; }
  .notice { padding: 6px 10px; font-size: 11px; color: #444; border-bottom: 1px solid #111; }
  .signs { display: flex; gap: 24px; padding: 26px 16px 10px; }
  .signs div { flex: 1; border-top: 1px solid #111; text-align: center; font-size: 11px; padding-top: 3px; }
`

export function buildCoinCustomerHtml(result: CoinExchangeResult, info: CoinCustomerInfo) {
  const rows = customerLines(result)
    .map(
      (line) =>
        `<tr><td>${escapeHtml(line.label)}</td><td>${money(line.faceCents)}</td><td>+${escapeHtml(
          percent(line.rate)
        )} · ${money(line.bonusCents)}</td><td>${money(line.totalCents)}</td></tr>`
    )
    .join("")
  const notes = info.notes?.trim()
    ? `<div class="info"><b>Obs.:</b><span>${escapeHtml(info.notes.trim())}</span></div>`
    : ""

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Conferência da troca de moedas</title>
<style>${customerStyles}</style></head><body>
<div class="sheet">
  <div class="title">CONFERÊNCIA · TROCA DE MOEDAS</div>
  <div class="info"><b>Cliente:</b><span>${escapeHtml(customerWho(info))}</span></div>
  <div class="info"><b>Data:</b><span>${escapeHtml(info.dateLabel)}</span></div>
  <div class="info"><b>Fiscal:</b><span>${escapeHtml(info.fiscal || "—")}</span></div>
  ${notes}
  <table>
    <thead><tr><th>Moeda</th><th>Valor entregue</th><th>Acréscimo</th><th>Total</th></tr></thead>
    <tbody>
      ${rows}
      <tr class="sum"><td>Valor das moedas</td><td colspan="3">${money(result.faceCents)}</td></tr>
      <tr class="sum"><td>Acréscimo</td><td colspan="3">+ ${money(result.bonusCents)}</td></tr>
      <tr class="total"><td>TOTAL A RECEBER</td><td colspan="3">${money(result.totalCents)}</td></tr>
    </tbody>
  </table>
  <div class="notice">${CUSTOMER_NOTICE}</div>
  <div class="signs"><div>Assinatura do cliente</div><div>Assinatura do fiscal</div></div>
</div></body></html>`
}

function drawCustomerPage(pdf: jsPDF, result: CoinExchangeResult, info: CoinCustomerInfo) {
  const margin = 12
  const width = 210 - margin * 2
  const rowHeight = 7
  const baseline = (top: number, height = rowHeight) => top + height * 0.68

  pdf.setDrawColor(17, 17, 17)
  pdf.setTextColor(17, 17, 17)
  pdf.setLineWidth(0.5)

  let y = 12
  pdf.setFillColor(240, 160, 32)
  pdf.rect(margin, y, width, 11, "FD")
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(14)
  pdf.text("CONFERÊNCIA · TROCA DE MOEDAS", 105, y + 7.4, { align: "center", charSpace: 0.4 })
  y += 11

  const infoRows: Array<[string, string]> = [
    ["CLIENTE:", customerWho(info)],
    ["DATA:", info.dateLabel],
    ["FISCAL:", info.fiscal || "—"],
  ]
  if (info.notes?.trim()) infoRows.push(["OBS.:", info.notes.trim()])
  for (const [label, value] of infoRows) {
    pdf.setLineWidth(0.3)
    pdf.rect(margin, y, width, rowHeight)
    pdf.setFont("helvetica", "bold")
    pdf.setFontSize(9)
    pdf.text(label, margin + 3, baseline(y))
    pdf.setFont("helvetica", "normal")
    pdf.setFontSize(10.5)
    const text = pdf.splitTextToSize(value, width - 30) as string[]
    pdf.text(text[0] ?? "", margin + 24, baseline(y))
    y += rowHeight
  }

  // Tabela: Moeda | Valor entregue | Acréscimo | Total
  const columns = [margin, margin + 52, margin + 98, margin + 140]
  const right = margin + width
  pdf.setFillColor(246, 246, 246)
  pdf.rect(margin, y, width, rowHeight, "FD")
  pdf.setFont("helvetica", "bold")
  pdf.setFontSize(8.5)
  pdf.text("MOEDA", columns[0] + 3, baseline(y))
  pdf.text("VALOR ENTREGUE", columns[2] - 3, baseline(y), { align: "right" })
  pdf.text("ACRÉSCIMO", columns[3] - 3, baseline(y), { align: "right" })
  pdf.text("TOTAL", right - 3, baseline(y), { align: "right" })
  y += rowHeight

  pdf.setFontSize(10.5)
  for (const line of customerLines(result)) {
    pdf.setFont("helvetica", "normal")
    pdf.rect(margin, y, width, rowHeight)
    pdf.text(line.label, columns[0] + 3, baseline(y))
    pdf.text(money(line.faceCents), columns[2] - 3, baseline(y), { align: "right" })
    pdf.text(`+${percent(line.rate)} · ${money(line.bonusCents)}`, columns[3] - 3, baseline(y), {
      align: "right",
    })
    pdf.setFont("helvetica", "bold")
    pdf.text(money(line.totalCents), right - 3, baseline(y), { align: "right" })
    y += rowHeight
  }

  for (const [label, value] of [
    ["Valor das moedas", money(result.faceCents)],
    ["Acréscimo", `+ ${money(result.bonusCents)}`],
  ] as const) {
    pdf.rect(margin, y, width, rowHeight)
    pdf.setFont("helvetica", "bold")
    pdf.text(label, margin + 3, baseline(y))
    pdf.text(value, right - 3, baseline(y), { align: "right" })
    y += rowHeight
  }

  const totalHeight = 11
  pdf.setLineWidth(0.5)
  pdf.rect(margin, y, width, totalHeight)
  pdf.setFontSize(13)
  pdf.setTextColor(10, 92, 47)
  pdf.text("TOTAL A RECEBER", margin + 3, baseline(y, totalHeight) + 0.4)
  pdf.text(money(result.totalCents), right - 3, baseline(y, totalHeight) + 0.4, { align: "right" })
  pdf.setTextColor(17, 17, 17)
  y += totalHeight

  pdf.setFont("helvetica", "normal")
  pdf.setFontSize(8)
  pdf.setTextColor(70, 70, 70)
  pdf.text(CUSTOMER_NOTICE, margin + 3, y + 5)
  pdf.setTextColor(17, 17, 17)

  const signY = 148 - 18
  const half = (width - 12) / 2
  pdf.setLineWidth(0.3)
  pdf.line(margin + 4, signY, margin + 4 + half - 4, signY)
  pdf.line(margin + 4 + half + 4, signY, right - 4, signY)
  pdf.setFontSize(8)
  pdf.text("Assinatura do cliente", margin + 4 + (half - 4) / 2, signY + 4, { align: "center" })
  pdf.text("Assinatura do fiscal", margin + 4 + half + 4 + (half - 4) / 2, signY + 4, { align: "center" })
}

/** PDF só com a conferência do cliente. */
export async function buildCoinCustomerPdf(result: CoinExchangeResult, info: CoinCustomerInfo) {
  const { jsPDF } = await import("jspdf")
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a5" })
  drawCustomerPage(pdf, result, info)
  return pdf.output("blob")
}

/** Um arquivo, duas páginas: ficha do fiscal e conferência do cliente. */
export async function buildCoinExchangePdf(result: CoinExchangeResult, info: CoinCustomerInfo) {
  const { jsPDF } = await import("jspdf")
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a5" })
  drawFiscalPage(pdf, result, info)
  pdf.addPage("a5", "landscape")
  drawCustomerPage(pdf, result, info)
  return pdf.output("blob")
}
