import { describe, expect, it } from "vitest"

import {
  cleanItems,
  compareOrders,
  formatPickup,
  itemLine,
  orderCode,
  orderMatches,
  parseItems,
  pickupState,
  remainingCents,
  type CustomerOrderRecord,
} from "../customerOrder"
import {
  buildCustomerOrderHtml,
  buildCustomerOrderPdf,
  MAX_PRINT_ITEMS,
  printableItems,
} from "../customerOrderPrint"

const base: CustomerOrderRecord = {
  id: "3f2a9c1e-1234-4abc-8def-001122334455",
  organization_id: "org",
  branch_id: null,
  created_by: null,
  customer_name: "Fernanda Carvalho",
  customer_phone: "(38) 98836-5631",
  ordered_at: new Date(2026, 9, 28, 9, 30).toISOString(),
  // 31/10/2026 é sábado.
  pickup_at: new Date(2026, 9, 31, 16, 0).toISOString(),
  items: [
    { quantity: "40", unit: "un", description: "mini pães de sal" },
    { quantity: "30", unit: "un", description: "mini pães doce" },
  ],
  notes: null,
  total_cents: 12000,
  paid_cents: 5000,
  attendant_name: "Lorena",
  status: "pendente",
  status_at: null,
  created_at: new Date(2026, 9, 28, 9, 30).toISOString(),
  updated_at: new Date(2026, 9, 28, 9, 30).toISOString(),
}

describe("customerOrder", () => {
  it("limpa as linhas do pedido e descarta as vazias", () => {
    expect(
      cleanItems([
        { quantity: " 40 ", description: " mini pães de sal " },
        { quantity: "5", description: "   " },
        { quantity: "2,5", unit: "kg", description: "queijo" },
        { description: "bolo", unit: "xyz" as never },
      ])
    ).toEqual([
      { quantity: "40", unit: "un", description: "mini pães de sal" },
      { quantity: "2,5", unit: "kg", description: "queijo" },
      { quantity: "", unit: "un", description: "bolo" },
    ])
    expect(parseItems(null)).toEqual([])
    expect(parseItems([{ quantity: 2, unit: "fardo", description: "refrigerante" }, 5])).toEqual([
      { quantity: "2", unit: "fardo", description: "refrigerante" },
    ])
    // Pedido antigo, sem unidade, vira "unidade".
    expect(parseItems([{ quantity: "3", description: "tortas" }])[0].unit).toBe("un")
  })

  it("monta a linha do item e o código curto", () => {
    expect(itemLine({ quantity: "40", unit: "un", description: "mini pães de sal" })).toBe(
      "40 Unid. · mini pães de sal"
    )
    expect(itemLine({ quantity: "1,5", unit: "kg", description: "presunto" })).toBe("1,5 Kg · presunto")
    expect(itemLine({ quantity: "500", unit: "g", description: "queijo" })).toBe("500 g · queijo")
    expect(itemLine({ quantity: "2", unit: "fardo", description: "refrigerante" })).toBe("2 Fardo · refrigerante")
    expect(itemLine({ quantity: "", unit: "un", description: "bolo" })).toBe("bolo")
    expect(orderCode(base.id)).toBe("3F2A9C1E")
  })

  it("calcula quanto falta pagar só quando há valor total", () => {
    expect(remainingCents(12000, 5000)).toBe(7000)
    expect(remainingCents(12000, 20000)).toBe(0)
    expect(remainingCents(null, 5000)).toBeNull()
    expect(remainingCents(0, 0)).toBeNull()
  })

  it("escreve a retirada com o dia da semana", () => {
    expect(formatPickup(base.pickup_at)).toBe("Sábado, 31/10/2026 às 16:00")
  })

  it("diz onde a retirada está em relação a agora", () => {
    const at = (day: number, hour = 12) => new Date(2026, 9, day, hour, 0)
    expect(pickupState(base, at(31, 18))).toBe("atrasada")
    expect(pickupState(base, at(31, 8))).toBe("hoje")
    expect(pickupState(base, at(30))).toBe("amanha")
    expect(pickupState(base, at(28))).toBe("futura")
    expect(pickupState({ ...base, status: "retirada" }, at(31, 18))).toBe("encerrada")
    expect(pickupState({ ...base, status: "cancelada" }, at(28))).toBe("encerrada")
  })

  it("ordena os em aberto pela retirada mais próxima e deixa os encerrados no fim", () => {
    const soon = { ...base, id: "a", pickup_at: new Date(2026, 9, 29, 10).toISOString() }
    const later = { ...base, id: "b", pickup_at: new Date(2026, 10, 2, 10).toISOString() }
    const done = { ...base, id: "c", status: "retirada" as const, pickup_at: new Date(2026, 9, 20).toISOString() }
    expect([later, done, soon].sort(compareOrders).map((order) => order.id)).toEqual(["a", "b", "c"])
  })

  it("busca por nome, telefone, código ou item", () => {
    expect(orderMatches(base, "fernanda")).toBe(true)
    expect(orderMatches(base, "98836")).toBe(true)
    expect(orderMatches(base, "3f2a")).toBe(true)
    expect(orderMatches(base, "pães doce")).toBe(true)
    expect(orderMatches(base, "maria")).toBe(false)
    expect(orderMatches(base, "")).toBe(true)
  })
})

describe("buildCustomerOrderHtml", () => {
  const html = buildCustomerOrderHtml(base)

  it("traz as duas vias com cliente, retirada, itens e valores", () => {
    expect(html).toContain("VIA DO CLIENTE")
    expect(html).toContain("VIA DA PRODUÇÃO")
    expect(html).toContain("CORTE AQUI")
    expect(html.match(/Fernanda Carvalho/g)).toHaveLength(2)
    expect(html.match(/Sábado, 31\/10\/2026 às 16:00/g)).toHaveLength(2)
    expect(html.match(/40 Unid\. · mini pães de sal/g)).toHaveLength(2)
    expect(html.match(/28\/10\/2026 09:30/g)).toHaveLength(2)
    expect(html.match(/3F2A9C1E/g)?.length).toBeGreaterThanOrEqual(2)
    expect(html).toMatch(/Valor total/)
    expect(html.match(/R\$\s70,00/g)).toHaveLength(2)
  })

  it("sem valores nem observação, essas linhas não saem; texto digitado é escapado", () => {
    const plain = buildCustomerOrderHtml({ ...base, total_cents: null, paid_cents: 0 })
    expect(plain).not.toContain("Valor total</span>")
    expect(plain).not.toContain("Observação")
    const safe = buildCustomerOrderHtml({ ...base, customer_name: "<script>x</script>", notes: "<b>y</b>" })
    expect(safe).not.toContain("<script>x")
    expect(safe).toContain("&lt;script&gt;")
    expect(safe).toContain("Observação")
  })

  it("pedidos grandes mostram quantos itens ficaram de fora", () => {
    const many = Array.from({ length: 20 }, (_, index) => ({ quantity: "1", unit: "un" as const, description: `item ${index + 1}` }))
    const lines = printableItems({ ...base, items: many })
    expect(lines).toHaveLength(MAX_PRINT_ITEMS)
    expect(lines.at(-1)).toBe("+ 7 itens (veja no sistema)")
    expect(printableItems(base)).toHaveLength(2)
  })
})

describe("buildCustomerOrderPdf", () => {
  it("gera um PDF válido de uma página, mesmo com muitos itens e observação", async () => {
    const many = Array.from({ length: 20 }, (_, index) => ({ quantity: "2", unit: "kg" as const, description: `item ${index + 1}` }))
    const pdf = await buildCustomerOrderPdf({ ...base, items: many, notes: "Sem lactose e escrever parabéns no bolo" })
    expect(pdf.type).toBe("application/pdf")
    const bytes = new Uint8Array(await pdf.arrayBuffer())
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-")
    expect(new TextDecoder("latin1").decode(bytes).match(/\/Type \/Page\b/g)).toHaveLength(1)
  })
})
