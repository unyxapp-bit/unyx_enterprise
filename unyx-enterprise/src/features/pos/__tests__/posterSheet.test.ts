import { describe, expect, it } from "vitest"

import { normalizeColumn } from "@/lib/spreadsheet"
import type { SpreadsheetRow } from "@/lib/spreadsheet"

import { postersFromRows, sheetTemplateCsv } from "../posterSheet"

// Monta uma linha como o leitor de planilhas faz: chaves já normalizadas.
function row(values: Record<string, unknown>): SpreadsheetRow {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [normalizeColumn(key), value]))
}

describe("posterSheet", () => {
  it("creates one poster per row with price split into reais and centavos", () => {
    const { posters, skipped } = postersFromRows([
      row({ Produto: "ARROZ", Descrição: "PACOTE 5KG", Preço: "24,99", Unidade: "UNID", Validade: "ATÉ 25/05", Observação: "x" }),
      row({ Produto: "FEIJÃO", Preço: 7.9 }),
      row({ Produto: "CAFÉ", Preço: "R$ 12" }),
      row({ Preço: "5,00" }),
    ])

    expect(posters).toHaveLength(3)
    expect(skipped).toBe(1)
    expect(posters[0]).toMatchObject({
      produto: "ARROZ",
      descricao: "PACOTE 5KG",
      preco_reais: "24",
      preco_centavos: "99",
      unidade: "UNID",
      validade: "ATÉ 25/05",
      observacao: "x",
    })
    expect(posters[1]).toMatchObject({ preco_reais: "7", preco_centavos: "90" })
    expect(posters[2]).toMatchObject({ preco_reais: "12", preco_centavos: "" })
  })

  it("accepts separate reais/centavos columns and dates as validity", () => {
    const { posters } = postersFromRows([
      row({ Nome: "LEITE", Reais: "5", Centavos: "49", Validade: new Date(Date.UTC(2026, 4, 25)) }),
    ])

    expect(posters[0]).toMatchObject({
      produto: "LEITE",
      preco_reais: "5",
      preco_centavos: "49",
      validade: "OFERTA VÁLIDA ATÉ 25/05",
    })
  })

  it("provides a CSV template with the expected headers", () => {
    expect(sheetTemplateCsv()).toContain("Produto;Descrição;Preço;Unidade;Validade;Observação")
  })
})
