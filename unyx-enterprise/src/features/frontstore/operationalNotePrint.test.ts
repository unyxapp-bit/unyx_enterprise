import { describe, expect, it } from "vitest"

import { buildNoteHtml, type PrintableNote } from "./operationalNotePrint"

const note: PrintableNote = {
  title: "Balança <3>",
  content: "Linha 1\nLinha 2 & \"aspas\"",
  category: "Caixa",
  priority: "Urgente",
  priorityLevel: "urgent",
  status: "Em análise",
  scope: "Loja Centro - Caixas",
  author: "Lorena",
  createdAt: "02/11/2026 09:00",
  dueAt: "05/11/2026 12:00",
  resolvedAt: null,
  printedAt: "02/11/2026 10:00",
}

describe("buildNoteHtml", () => {
  const html = buildNoteHtml(note)

  it("traz os dados da anotação", () => {
    for (const text of ["Em análise", "Urgente", "Loja Centro - Caixas", "Caixa", "Lorena", "02/11/2026 09:00", "05/11/2026 12:00", "Linha 1\nLinha 2"]) {
      expect(html).toContain(text)
    }
  })

  it("escapa HTML do título e do conteúdo", () => {
    expect(html).toContain("Balança &lt;3&gt;")
    expect(html).toContain("&amp; &quot;aspas&quot;")
    expect(html).not.toContain("<3>")
  })

  it("mostra traço nos campos vazios", () => {
    expect(html).toContain('<div class="k">Resolvida em</div><div class="v">—</div>')
  })

  it("colore a prioridade e informa quando foi impresso", () => {
    expect(html).toContain("background:#c8202f")
    expect(html).toContain("Impresso em 02/11/2026 10:00")
    expect(buildNoteHtml({ ...note, priorityLevel: undefined })).not.toContain("background:#c8202f")
  })
})
