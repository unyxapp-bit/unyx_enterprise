// Nomes em português para as cores do editor de cartazes. A cor exata da paleta usa o nome
// dela; qualquer outra recebe o nome da cor mais próxima.
const PALETTE: Array<{ name: string; hex: string }> = [
  { name: "Branco", hex: "#FFFFFF" },
  { name: "Preto", hex: "#111827" },
  { name: "Preto", hex: "#000000" },
  { name: "Cinza claro", hex: "#D1D5DB" },
  { name: "Cinza", hex: "#6B7280" },
  { name: "Cinza escuro", hex: "#374151" },
  { name: "Vermelho", hex: "#EF4444" },
  { name: "Vermelho", hex: "#D90429" },
  { name: "Vermelho escuro", hex: "#991B1B" },
  { name: "Rosa", hex: "#EC4899" },
  { name: "Rosa claro", hex: "#F9A8D4" },
  { name: "Laranja", hex: "#F97316" },
  { name: "Amarelo", hex: "#FFE000" },
  { name: "Amarelo ouro", hex: "#F8B80A" },
  { name: "Amarelo", hex: "#FFD400" },
  { name: "Bege", hex: "#F5E6C8" },
  { name: "Marrom", hex: "#92400E" },
  { name: "Verde", hex: "#16A34A" },
  { name: "Verde escuro", hex: "#166534" },
  { name: "Verde limão", hex: "#84CC16" },
  { name: "Azul", hex: "#2563EB" },
  { name: "Azul escuro", hex: "#1E3A8A" },
  { name: "Azul claro", hex: "#38BDF8" },
  { name: "Turquesa", hex: "#14B8A6" },
  { name: "Roxo", hex: "#7C3AED" },
  { name: "Lilás", hex: "#C4B5FD" },
]

function rgb(hex: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) return null
  const value = parseInt(match[1], 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

// Distância de cor que pesa o vermelho conforme a média, mais próxima da percepção.
function distance(a: [number, number, number], b: [number, number, number]) {
  const redMean = (a[0] + b[0]) / 2
  const dr = a[0] - b[0]
  const dg = a[1] - b[1]
  const db = a[2] - b[2]
  return (2 + redMean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - redMean) / 256) * db * db
}

export function colorName(hex: string) {
  if (!hex || hex === "none" || hex === "transparent") return "Sem cor"
  const target = rgb(hex)
  if (!target) return hex
  let best = PALETTE[0]
  let bestDistance = Infinity
  for (const entry of PALETTE) {
    const entryRgb = rgb(entry.hex)
    if (!entryRgb) continue
    const current = distance(target, entryRgb)
    if (current < bestDistance) {
      best = entry
      bestDistance = current
    }
  }
  return best.name
}

// "Vermelho (#D90429)" para dicas (tooltip) e leitores de tela.
export function colorLabel(hex: string) {
  return hex === "none" || hex === "transparent" ? "Sem cor" : `${colorName(hex)} (${hex.toUpperCase()})`
}
