import { describe, expect, it } from "vitest"

import { calculateCoinExchange, DEFAULT_COIN_RATES } from "../coinExchange"
import {
  buildCoinCustomerHtml,
  buildCoinCustomerPdf,
  buildCoinExchangePdf,
  buildCoinSheetHtml,
  buildCoinSheetPdf,
} from "../coinSheetPrint"

describe("buildCoinSheetHtml", () => {
  // Mesma ficha de papel de 27/10/2026 (fiscal Vanessa).
  const result = calculateCoinExchange(
    { c5: 7540, c10: 13910, c25: 25525, c50: 30500, r1: 9000 },
    DEFAULT_COIN_RATES
  )
  const html = buildCoinSheetHtml(result, { fiscal: "Vanessa", dateLabel: "27/10/2026" })

  it("traz os totais e o vale como na ficha de papel", () => {
    expect(html).toContain("TROCA DE MOEDAS")
    expect(html).toContain("214,50")
    expect(html).toContain("650,25")
    expect(html).toContain("21,45")
    expect(html).toContain("32,51")
    expect(html).toContain("TOTAL DO VALE:")
    expect(html).toContain("53,96")
    expect(html).toContain("Vanessa")
    expect(html).toContain("27/10/2026")
  })

  it("agrupa em colunas por percentual, maior primeiro", () => {
    expect(html.indexOf("Acréscimo de 10%")).toBeGreaterThan(-1)
    expect(html.indexOf("Acréscimo de 10%")).toBeLessThan(html.indexOf("Acréscimo de 5%"))
    expect(html).toContain("TOTAL C/ 10%")
    expect(html).toContain("TOTAL C/ 5%")
  })

  it("mostra os pacotes de cada moeda e não leva o nome do cliente", () => {
    // R$ 139,10 em moedas de 10 centavos: pacote de R$ 5,00 = 27 pacotes + 4,10.
    expect(html).toContain("27 pacotes + 4,10")
    expect(html).not.toContain("Cliente")
  })

  it("escapa texto digitado pelo usuário", () => {
    const safe = buildCoinSheetHtml(result, {
      fiscal: "<b>x</b>",
      dateLabel: "27/10/2026",
      notes: "<script>alert(1)</script>",
    })
    expect(safe).not.toContain("<script>")
    expect(safe).toContain("&lt;script&gt;")
    expect(safe).toContain("&lt;b&gt;x&lt;/b&gt;")
  })

  it("gera um PDF válido da ficha", async () => {
    const pdf = await buildCoinSheetPdf(result, { fiscal: "Vanessa", dateLabel: "27/10/2026" })
    expect(pdf.type).toBe("application/pdf")
    expect(pdf.size).toBeGreaterThan(1500)
    const header = new TextDecoder().decode((await pdf.arrayBuffer()).slice(0, 5))
    expect(header).toBe("%PDF-")
  })
})

describe("conferência do cliente", () => {
  const result = calculateCoinExchange(
    { c5: 7540, c10: 13910, c25: 25525, c50: 30500, r1: 9000 },
    DEFAULT_COIN_RATES
  )
  const info = {
    fiscal: "Vanessa",
    dateLabel: "27/10/2026",
    customerName: "Maria da Silva",
    customerPhone: "(11) 98765-4321",
  }
  const html = buildCoinCustomerHtml(result, info)

  it("leva o cliente, o que entregou e o total a receber", () => {
    expect(html).toContain("CONFERÊNCIA")
    expect(html).toContain("Maria da Silva · (11) 98765-4321")
    expect(html).toContain("Vanessa")
    expect(html).toContain("27/10/2026")
    // Uma linha por moeda entregue, com o valor, o percentual e o total.
    expect(html).toContain("R$ 0,05")
    expect(html).toContain("+10%")
    expect(html).toContain("+5%")
    // Soma: R$ 864,75 em moedas + R$ 53,96 de acréscimo = R$ 918,71.
    expect(html).toContain("TOTAL A RECEBER")
    expect(html.replace(/\u00a0/g, " ")).toContain("R$ 918,71")
    expect(html.replace(/\u00a0/g, " ")).toContain("R$ 864,75")
  })

  it("não mostra informação interna do fiscal e pula moedas sem valor", () => {
    expect(html).not.toContain("pacote")
    expect(html).not.toContain("soltos")
    const partial = buildCoinCustomerHtml(calculateCoinExchange({ c10: 1000 }, DEFAULT_COIN_RATES), info)
    expect(partial).toContain("R$ 0,10")
    expect(partial).not.toContain("R$ 0,25")
  })

  it("cliente sem nome aparece como traço e o texto digitado é escapado", () => {
    expect(buildCoinCustomerHtml(result, { ...info, customerName: "", customerPhone: "" })).toContain(
      "<span>—</span>"
    )
    const safe = buildCoinCustomerHtml(result, { ...info, customerName: "<script>x</script>" })
    expect(safe).not.toContain("<script>x")
    expect(safe).toContain("&lt;script&gt;")
  })

  it("gera o PDF da conferência (1 página) e o arquivo conjunto (2 páginas)", async () => {
    const pages = async (blob: Blob) =>
      new TextDecoder("latin1").decode(new Uint8Array(await blob.arrayBuffer())).match(/\/Type \/Page\b/g)
        ?.length

    expect(await pages(await buildCoinCustomerPdf(result, info))).toBe(1)
    expect(await pages(await buildCoinExchangePdf(result, info))).toBe(2)
    expect(await pages(await buildCoinSheetPdf(result, info))).toBe(1)
  })
})
