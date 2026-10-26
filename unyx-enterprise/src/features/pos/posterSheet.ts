import { getCell } from "@/lib/spreadsheet"
import type { SpreadsheetRow } from "@/lib/spreadsheet"

import { parsePrice } from "./posterPrice"

// Campos de um cartaz vindos de uma linha da planilha.
export interface SheetPoster {
  produto: string
  descricao: string
  preco_reais: string
  preco_centavos: string
  unidade: string
  validade: string
  observacao: string
}

export const SHEET_HEADERS = ["Produto", "Descrição", "Preço", "Unidade", "Validade", "Observação"]
export const MAX_SHEET_POSTERS = 200

const UTF8_BOM = String.fromCharCode(0xfeff)

function text(value: unknown) {
  if (value instanceof Date) return ""
  return String(value ?? "").trim()
}

// Preço: aceita 24,99 · 24.99 · "R$ 24,99" · 24,9 (vira 24,90) · 24 (sem centavos).
function priceFrom(value: unknown) {
  const { reais, centavos } = parsePrice(text(value))
  return { reais, centavos: centavos.length === 1 ? `${centavos}0` : centavos }
}

// Validade: texto livre, ou uma data (vira "OFERTA VÁLIDA ATÉ 25/05").
function validityFrom(value: unknown) {
  if (value instanceof Date) {
    const day = String(value.getUTCDate()).padStart(2, "0")
    const month = String(value.getUTCMonth() + 1).padStart(2, "0")
    return `OFERTA VÁLIDA ATÉ ${day}/${month}`
  }
  return text(value)
}

export function postersFromRows(rows: SpreadsheetRow[]) {
  const posters: SheetPoster[] = []
  let skipped = 0

  for (const row of rows) {
    const produto = text(getCell(row, ["produto", "nome", "nome do produto", "item", "descricao do produto"]))
    if (!produto) {
      skipped += 1
      continue
    }
    const priceCell = getCell(row, ["preco", "preço", "valor", "preco de venda", "preço de venda"])
    let price = priceFrom(priceCell)
    if (!price.reais) {
      // Também aceita as colunas separadas "reais" e "centavos".
      const reais = text(getCell(row, ["reais", "r$ inteiro", "preco reais"]))
      const centavos = text(getCell(row, ["centavos", "preco centavos"]))
      price = priceFrom(`${reais},${centavos}`)
    }
    posters.push({
      produto,
      descricao: text(getCell(row, ["descricao", "descrição", "detalhe", "complemento"])),
      preco_reais: price.reais,
      preco_centavos: price.centavos,
      unidade: text(getCell(row, ["unidade", "un", "medida"])),
      validade: validityFrom(getCell(row, ["validade", "oferta", "valido ate", "válido até"])),
      observacao: text(getCell(row, ["observacao", "observação", "obs", "rodape", "rodapé"])),
    })
  }

  return { posters: posters.slice(0, MAX_SHEET_POSTERS), skipped, truncated: posters.length > MAX_SHEET_POSTERS }
}

// Modelo em CSV com ";" (abre direto no Excel em português; salve como .xlsx se preferir).
export function sheetTemplateCsv() {
  const example = ["ARROZ TIPO 1", "PACOTE 5KG", "24,99", "UNID", "OFERTA VÁLIDA ATÉ 25/05", "ENQUANTO DURAREM OS ESTOQUES"]
  return `${UTF8_BOM}${SHEET_HEADERS.join(";")}\r\n${example.join(";")}\r\n`
}
