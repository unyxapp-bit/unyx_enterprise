import type { CSSProperties } from "react"

import type {
  OperationalPosterFormat,
  OperationalPosterLayoutField,
  OperationalPosterTone,
} from "@/types/domain"

export const fieldClass =
  "h-8 w-full rounded-lg border bg-white px-2.5 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"

export const textareaClass =
  "min-h-24 w-full rounded-lg border bg-white px-2.5 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"

export const rangeClass = "h-2 w-full cursor-pointer accent-slate-950"

export const toneLabel: Record<OperationalPosterTone, string> = {
  neutral: "Neutro",
  info: "Informativo",
  attention: "Atencao",
  urgent: "Urgente",
  success: "Positivo",
}

export const formatLabel: Record<OperationalPosterFormat, string> = {
  a2: "A2",
  a3: "A3",
  a4: "A4",
  a5: "A5",
  a6: "A6",
  thermal: "Bobina",
}

export const printScaleByFormat: Record<OperationalPosterFormat, number> = {
  a2: 2,
  a3: 1.41,
  a4: 1,
  a5: 0.71,
  a6: 0.5,
  thermal: 0.42,
}

export const paperAspectByFormat: Record<OperationalPosterFormat, string> = {
  a2: "420 / 594",
  a3: "297 / 420",
  a4: "210 / 297",
  a5: "148 / 210",
  a6: "105 / 148",
  thermal: "72 / 160",
}

export const saleUnits = ["unid", "kg", "g", "cx", "pct", "lt", "ml", "m", "dz"]

export type PosterPositionAxis = "x" | "y"

export const positionFields: Array<{
  field: OperationalPosterLayoutField
  label: string
}> = [
  { field: "subtitle", label: "Chamada superior" },
  { field: "product", label: "Produto" },
  { field: "description", label: "Descricao" },
  { field: "price", label: "Valor" },
  { field: "unit", label: "Forma de venda" },
  { field: "footer", label: "Rodape" },
]

export type PosterArea = {
  left: string
  top: string
  width: string
  align?: CSSProperties["textAlign"]
  color?: string
}

export type PosterTemplate = {
  key: string
  name: string
  file: string | null
  kind?: "image" | "guided"
  guidedVariant?: "super-offer" | "yellow-offer"
  aspectRatio: string
  layout: {
    subtitle: PosterArea
    product: PosterArea
    description: PosterArea
    price: PosterArea
    unit: PosterArea
    footer: PosterArea
  }
  textColor?: string
  priceColor?: string
}

const centeredLayout: PosterTemplate["layout"] = {
  subtitle: { top: "10%", left: "8%", width: "84%" },
  product: { top: "42%", left: "8%", width: "84%" },
  description: { top: "53%", left: "10%", width: "80%" },
  price: { top: "65%", left: "8%", width: "84%" },
  unit: { top: "77%", left: "18%", width: "64%" },
  footer: { top: "94%", left: "8%", width: "84%" },
}

const lowOfferLayout: PosterTemplate["layout"] = {
  subtitle: { top: "12%", left: "8%", width: "84%" },
  product: { top: "50%", left: "9%", width: "82%" },
  description: { top: "59%", left: "12%", width: "76%" },
  price: { top: "72%", left: "8%", width: "84%" },
  unit: { top: "84%", left: "18%", width: "64%" },
  footer: { top: "94%", left: "8%", width: "84%" },
}

const highNoticeLayout: PosterTemplate["layout"] = {
  subtitle: { top: "10%", left: "8%", width: "84%" },
  product: { top: "32%", left: "9%", width: "82%" },
  description: { top: "46%", left: "10%", width: "80%" },
  price: { top: "61%", left: "8%", width: "84%" },
  unit: { top: "75%", left: "18%", width: "64%" },
  footer: { top: "92%", left: "8%", width: "84%" },
}

const guidedSuperOfferLayout: PosterTemplate["layout"] = {
  subtitle: { top: "10%", left: "22%", width: "56%" },
  product: { top: "34%", left: "8%", width: "84%" },
  description: { top: "46%", left: "9%", width: "82%" },
  price: { top: "71%", left: "8%", width: "64%" },
  unit: { top: "75%", left: "68%", width: "24%" },
  footer: { top: "96%", left: "14%", width: "72%" },
}

const guidedYellowOfferLayout: PosterTemplate["layout"] = {
  subtitle: { top: "9%", left: "10%", width: "80%" },
  product: { top: "30%", left: "8%", width: "84%" },
  description: { top: "42%", left: "10%", width: "80%" },
  price: { top: "68%", left: "7%", width: "68%" },
  unit: { top: "73%", left: "70%", width: "23%" },
  footer: { top: "94%", left: "10%", width: "80%" },
}

export const posterTemplates: PosterTemplate[] = [
  {
    key: "super-oferta-guiada",
    name: "Super oferta guiada",
    file: null,
    kind: "guided",
    guidedVariant: "super-offer",
    aspectRatio: "210 / 297",
    layout: guidedSuperOfferLayout,
    textColor: "#111827",
    priceColor: "#c4282f",
  },
  {
    key: "oferta-amarela-guiada",
    name: "Oferta amarela guiada",
    file: null,
    kind: "guided",
    guidedVariant: "yellow-offer",
    aspectRatio: "210 / 297",
    layout: guidedYellowOfferLayout,
    textColor: "#111827",
    priceColor: "#b91c1c",
  },
  {
    key: "blank",
    name: "Em branco",
    file: null,
    aspectRatio: "210 / 297",
    layout: centeredLayout,
  },
  {
    key: "aproveite-agora",
    name: "Aproveite agora",
    file: "aproveite agora.svg",
    aspectRatio: "790.5 / 1119",
    layout: lowOfferLayout,
    priceColor: "#8a1111",
  },
  {
    key: "aviso-importante",
    name: "Aviso importante",
    file: "Aviso Importante.svg",
    aspectRatio: "810 / 1012.5",
    layout: highNoticeLayout,
    priceColor: "#111827",
  },
  {
    key: "oferta-do-dia",
    name: "Oferta do dia",
    file: "Cartaz oferta do dua.svg",
    aspectRatio: "1190.25 / 1683.75",
    layout: lowOfferLayout,
    priceColor: "#111827",
  },
  {
    key: "cartaz-oferta",
    name: "Cartaz oferta",
    file: "Cartaz Oferta.svg",
    aspectRatio: "1190.25 / 1683.75",
    layout: lowOfferLayout,
    priceColor: "#b91c1c",
  },
  {
    key: "oferta-vertical",
    name: "Oferta vertical",
    file: "Oferta (2).svg",
    aspectRatio: "810 / 1440",
    layout: lowOfferLayout,
    priceColor: "#111827",
  },
  {
    key: "oferta-tradicional",
    name: "Oferta tradicional",
    file: "Oferta do Dia Tradicional.svg",
    aspectRatio: "595.5 / 842.25",
    layout: lowOfferLayout,
    priceColor: "#b91c1c",
  },
  {
    key: "oferta-simples",
    name: "Oferta simples",
    file: "oferta.svg",
    aspectRatio: "790.5 / 1119",
    layout: lowOfferLayout,
    priceColor: "#b91c1c",
  },
  {
    key: "proximo-vencimento",
    name: "Proximo vencimento",
    file: "proximo vencimento.svg",
    aspectRatio: "790.5 / 1119",
    layout: highNoticeLayout,
    priceColor: "#111827",
  },
  {
    key: "super-oferta",
    name: "Super oferta",
    file: "super oferta.svg",
    aspectRatio: "720 / 960",
    layout: lowOfferLayout,
    priceColor: "#b91c1c",
  },
]

export function templateUrl(template: PosterTemplate) {
  return template.file
    ? `${import.meta.env.BASE_URL}cartaz-templates/${encodeURIComponent(template.file)}`
    : ""
}

export function getPosterTemplate(key?: string | null) {
  return posterTemplates.find((template) => template.key === key) ?? posterTemplates[0]
}
