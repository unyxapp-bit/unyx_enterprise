import { escapeHtml } from "./formPrint"

// Impressão de uma anotação operacional em A6 (105 x 148 mm): título, situação, prioridade, escopo, prazo, conteúdo
// e uma linha de assinatura para o fiscal que recebeu/resolveu a pendência.

export type PrintablePriority = "low" | "normal" | "high" | "urgent"

export interface PrintableNote {
  title: string
  content: string
  category: string | null
  priority: string
  // Define a cor da etiqueta de prioridade; sem ele a etiqueta fica neutra.
  priorityLevel?: PrintablePriority
  status: string
  scope: string
  author: string
  createdAt: string
  dueAt: string | null
  resolvedAt: string | null
  printedAt?: string
}

const priorityColors: Record<PrintablePriority, { bg: string; fg: string }> = {
  low: { bg: "#e5e7eb", fg: "#374151" },
  normal: { bg: "#dbeafe", fg: "#1e40af" },
  high: { bg: "#fed7aa", fg: "#9a3412" },
  urgent: { bg: "#c8202f", fg: "#ffffff" },
}

const styles = `
  @page { size: A6; margin: 5mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 9.5px; margin: 0; }
  .sheet { border: 1px solid #111; border-radius: 3px; overflow: hidden; }
  .band { background: #111; color: #fff; display: flex; justify-content: space-between; align-items: center; padding: 4px 8px; font-size: 7.5px; font-weight: 700; letter-spacing: 1.4px; text-transform: uppercase; }
  .title-wrap { padding: 8px 8px 6px; border-bottom: 1px solid #111; }
  h1 { font-size: 15px; line-height: 1.2; margin: 0 0 5px; overflow-wrap: anywhere; }
  .tags { display: flex; flex-wrap: wrap; gap: 4px; }
  .tag { display: inline-block; border-radius: 8px; padding: 1.5px 7px; font-size: 7.5px; font-weight: 700; letter-spacing: .4px; text-transform: uppercase; background: #f3f4f6; color: #111; border: 1px solid #111; }
  .rows { border-bottom: 1px solid #111; }
  .row { display: flex; border-bottom: 1px solid #d1d5db; }
  .row:last-child { border-bottom: 0; }
  .row .k { width: 24mm; flex: none; background: #f3f4f6; padding: 3px 6px; font-size: 7.5px; font-weight: 700; letter-spacing: .4px; text-transform: uppercase; color: #374151; border-right: 1px solid #d1d5db; }
  .row .v { flex: 1; padding: 3px 6px; overflow-wrap: anywhere; }
  .section { padding: 6px 8px 0; font-size: 7.5px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; color: #374151; }
  .content { margin: 3px 8px 8px; padding: 6px 7px; border: 1px solid #9ca3af; border-radius: 3px; white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.45; font-size: 10px; min-height: 26mm; }
  .sign { display: flex; gap: 14px; padding: 14px 8px 6px; }
  .sign div { flex: 1; border-top: 1px solid #111; padding-top: 2px; text-align: center; font-size: 7.5px; color: #374151; }
  .sign div:first-child { flex: 2; }
  .foot { display: flex; justify-content: space-between; padding: 3px 8px; border-top: 1px solid #d1d5db; background: #f3f4f6; font-size: 7px; color: #6b7280; }
`

const row = (label: string, value: string | null) =>
  `<div class="row"><div class="k">${escapeHtml(label)}</div><div class="v">${escapeHtml(value || "—")}</div></div>`

export function buildNoteHtml(note: PrintableNote) {
  const colors = note.priorityLevel ? priorityColors[note.priorityLevel] : null
  const priorityStyle = colors
    ? ` style="background:${colors.bg};color:${colors.fg};border-color:${colors.bg}"`
    : ""
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(
    note.title
  )}</title><style>${styles}</style></head><body>
<div class="sheet">
  <div class="band"><span>Anotação operacional</span><span>${escapeHtml(note.scope)}</span></div>
  <div class="title-wrap">
    <h1>${escapeHtml(note.title)}</h1>
    <div class="tags"><span class="tag">${escapeHtml(note.status)}</span><span class="tag"${priorityStyle}>Prioridade ${escapeHtml(note.priority)}</span>${
      note.category ? `<span class="tag">${escapeHtml(note.category)}</span>` : ""
    }</div>
  </div>
  <div class="rows">
    ${row("Registrada por", note.author)}
    ${row("Registrada em", note.createdAt)}
    ${row("Prazo", note.dueAt)}
    ${row("Resolvida em", note.resolvedAt)}
  </div>
  <div class="section">Descrição</div>
  <div class="content">${escapeHtml(note.content)}</div>
  <div class="sign"><div>Responsável / Fiscal</div><div>Data</div></div>
  <div class="foot"><span>Unyx Enterprise</span><span>${note.printedAt ? `Impresso em ${escapeHtml(note.printedAt)}` : ""}</span></div>
</div>
</body></html>`
}
