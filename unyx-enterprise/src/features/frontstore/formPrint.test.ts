import { describe, expect, it } from "vitest"

import { buildFormHtml, buildResponseHtml, escapeHtml } from "./formPrint"

describe("formPrint", () => {
  it("escapes html", () => {
    expect(escapeHtml('<b>"a" & b</b>')).toBe("&lt;b&gt;&quot;a&quot; &amp; b&lt;/b&gt;")
  })

  it("prints a blank form with options as checkboxes", () => {
    const html = buildFormHtml({
      title: "Controle <loja>",
      description: null,
      category: "Operacional",
      scope: "LOJA 04",
      questions: ["Pontualidade ::choice=No horário|Atraso", "Obs ::long_text?"],
    })
    expect(html).toContain("Controle &lt;loja&gt;")
    expect(html).toContain('<span class="box"></span>No horário')
    expect(html).toContain("(opcional)")
    expect(html).not.toContain("::choice")
  })

  it("prints answers in the form's question order", () => {
    const html = buildResponseHtml({
      formTitle: "F",
      scope: "LOJA 04",
      author: "Ana",
      submittedAt: "24/10/2026",
      answers: { B: "2", A: "1" },
      notes: null,
      questions: ["A", "B"],
    })
    expect(html.indexOf("1. A")).toBeLessThan(html.indexOf("2. B"))
  })

  it("traz o visto do fiscal e, só com colaborador, a assinatura dele", () => {
    const base = { title: "F", description: null, category: null, scope: "L" }
    const without = buildFormHtml({ ...base, questions: ["Pontualidade ::choice=Sim|Não"] })
    expect(without).toContain("Visto do fiscal")
    expect(without).not.toContain("Assinatura do colaborador")

    const withCollaborator = buildFormHtml({ ...base, questions: ["Colaborador avaliado ::employee"] })
    expect(withCollaborator).toContain("Visto do fiscal")
    expect(withCollaborator).toContain("Assinatura do colaborador")
  })

  it("na resposta, escreve o nome do fiscal e do colaborador sob as linhas", () => {
    const html = buildResponseHtml({
      formTitle: "F",
      scope: "L",
      author: "Lorena",
      submittedAt: "24/10/2026",
      answers: { "Colaborador avaliado": "João", Obs: "ok" },
      notes: null,
      questions: ["Colaborador avaliado ::employee", "Obs"],
    })
    expect(html).toContain('<div class="sign-name">Lorena</div>')
    expect(html).toContain('<div class="sign-name">João</div>')

    const plain = buildResponseHtml({ formTitle: "F", scope: "L", author: "Lorena", submittedAt: "", answers: { Obs: "ok" }, notes: null, questions: ["Obs"] })
    expect(plain).not.toContain("Assinatura do colaborador")
  })
})
