import { describe, expect, it } from "vitest"

import type { CoinDepositRecord } from "../coinDeposit"
import { buildCoinDepositHtml, buildCoinDepositPdf } from "../coinDepositPrint"

const deposit: CoinDepositRecord = {
  id: "3f2a9c1e-1234-4abc-8def-001122334455",
  organization_id: "org",
  branch_id: null,
  created_by: null,
  customer_name: "Maria da Silva",
  customer_phone: "(11) 98765-4321",
  left_at: new Date(2026, 9, 27, 14, 5).toISOString(),
  estimated_cents: 25050,
  fiscal_name: "Vanessa",
  notes: null,
  status: "pendente",
  completed_at: null,
  created_at: new Date(2026, 9, 27, 14, 5).toISOString(),
}

describe("buildCoinDepositHtml", () => {
  const html = buildCoinDepositHtml(deposit)

  it("traz as duas vias no mesmo arquivo, com os dados do cliente e do fiscal", () => {
    expect(html).toContain("VIA DO CLIENTE")
    expect(html).toContain("VIA DO FISCAL")
    expect(html.indexOf("VIA DO CLIENTE")).toBeLessThan(html.indexOf("VIA DO FISCAL"))
    // Cada dado aparece uma vez por via.
    expect(html.match(/Maria da Silva/g)).toHaveLength(2)
    expect(html.match(/\(11\) 98765-4321/g)).toHaveLength(2)
    expect(html.match(/27\/10\/2026 14:05/g)).toHaveLength(2)
    expect(html.match(/Vanessa/g)).toHaveLength(2)
    expect(html.match(/250,50/g)).toHaveLength(2)
    expect(html).toContain("CORTE AQUI")
    expect(html.match(/3F2A9C1E/g)?.length).toBeGreaterThanOrEqual(2)
  })

  it("sem valor estimado (cliente não soube informar) a ficha diz que será conferido", () => {
    const unknown = buildCoinDepositHtml({ ...deposit, estimated_cents: 0 })
    expect(unknown.match(/A conferir na contagem/g)).toHaveLength(2)
    expect(unknown).not.toContain("R$ 0,00")
  })

  it("escapa texto digitado e só mostra observação quando existe", () => {
    expect(html).not.toContain("Observação")
    const safe = buildCoinDepositHtml({
      ...deposit,
      customer_name: "<script>alert(1)</script>",
      notes: "<b>x</b>",
    })
    expect(safe).not.toContain("<script>")
    expect(safe).toContain("&lt;script&gt;")
    expect(safe).toContain("Observação")
  })
})

describe("buildCoinDepositPdf", () => {
  it("gera um PDF de uma página com as duas vias", async () => {
    const pdf = await buildCoinDepositPdf(deposit)
    expect(pdf.type).toBe("application/pdf")
    const bytes = new Uint8Array(await pdf.arrayBuffer())
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-")
    const text = new TextDecoder("latin1").decode(bytes)
    expect(text.match(/\/Type \/Page\b/g)).toHaveLength(1)
  })
})
