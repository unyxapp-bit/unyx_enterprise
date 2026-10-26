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
})
