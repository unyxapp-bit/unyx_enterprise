import { describe, expect, it } from "vitest"

import { buildDiscountHtml, buildDiscountPdf, type DiscountSlip } from "../cashierDiscountPrint"

const slip: DiscountSlip = {
  product_name: "Batata pringles 104G original",
  product_code: "1050444",
  quantity: 3,
  system_price_cents: 1289,
  sale_price_cents: 1190,
  discount_cents: 297,
  reason: "preco_errado",
  reason_description: "Em anexo",
  fiscal_name: "Lorena",
  pdv: "Caixa 108",
  operator_name: "Francielly",
  created_at: new Date(2026, 9, 19, 14, 35).toISOString(),
}

describe("buildDiscountHtml", () => {
  const html = buildDiscountHtml(slip)

  it("reproduz a ficha de papel: valor, produto com a quantidade, código, sistema e venda", () => {
    expect(html).toContain("DESCONTO")
    expect(html).toContain('<span class="val">2,97</span>')
    expect(html).toContain("Batata pringles 104G original (3X)")
    expect(html).toContain("1050444")
    expect(html).toContain("R$ 12,89")
    expect(html).toContain("R$ 11,90")
    expect(html).toContain("Lorena")
    expect(html).toContain("19/10/2026 14:35")
    expect(html).toContain("Em anexo")
    // Mostra a conta: diferença por unidade × quantidade.
    expect(html).toContain("0,99 × 3")
  })

  it("mostra o caixa (PDV) e o operador (OP); sem eles aparece um traço", () => {
    expect(html).toContain("Caixa (PDV):")
    expect(html).toContain("Caixa 108")
    expect(html).toContain("Operador (OP):")
    expect(html).toContain("Francielly")
    const blank = buildDiscountHtml({ ...slip, pdv: null, operator_name: "" })
    expect(blank).toMatch(/Caixa \(PDV\):<\/div><div class="v">—<\/div>/)
    expect(blank).toMatch(/Operador \(OP\):<\/div><div class="v">—<\/div>/)
  })

  it("marca só a caixa do motivo escolhido", () => {
    expect(html).toMatch(/<span class="box">X<\/span>Preço errado/)
    expect(html).toMatch(/<span class="box"><\/span>Outro motivo/)
    const other = buildDiscountHtml({ ...slip, reason: "outro" })
    expect(other).toMatch(/<span class="box"><\/span>Preço errado/)
    expect(other).toMatch(/<span class="box">X<\/span>Outro motivo/)
  })

  it("uma unidade não mostra a conta nem (1X), e o texto digitado é escapado", () => {
    const single = buildDiscountHtml({ ...slip, quantity: 1, discount_cents: 99 })
    expect(single).not.toContain("(1X)")
    expect(single).not.toContain("0,99 × 1")
    const safe = buildDiscountHtml({ ...slip, product_name: "<script>x</script>", reason_description: "<b>y</b>" })
    expect(safe).not.toContain("<script>x")
    expect(safe).toContain("&lt;script&gt;")
    expect(safe).toContain("&lt;b&gt;y&lt;/b&gt;")
  })
})

describe("buildDiscountPdf", () => {
  it("gera um PDF válido de uma página", async () => {
    const pdf = await buildDiscountPdf(slip)
    expect(pdf.type).toBe("application/pdf")
    const bytes = new Uint8Array(await pdf.arrayBuffer())
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-")
    expect(new TextDecoder("latin1").decode(bytes).match(/\/Type \/Page\b/g)).toHaveLength(1)
  })
})
