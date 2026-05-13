import { useEffect, useMemo, useState } from "react"
import type { CSSProperties, FormEvent } from "react"
import {
  Edit3,
  ImageIcon,
  Megaphone,
  Plus,
  Printer,
  Trash2,
  Type,
} from "lucide-react"

import { PageHeader } from "@/components/shared/PageHeader"
import { StateBlock } from "@/components/shared/StateBlock"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  useBranches,
  useCreateOperationalPoster,
  useDeleteOperationalPoster,
  useOperationalPosters,
  useSectors,
  useUpdateOperationalPoster,
} from "@/hooks/useUnyxData"
import { formatDateTimeBR } from "@/lib/format"
import { useAppStore } from "@/store/useAppStore"
import type {
  OperationalPoster,
  OperationalPosterFormat,
  OperationalPosterTone,
} from "@/types/domain"

const fieldClass =
  "h-8 w-full rounded-lg border bg-white px-2.5 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"

const textareaClass =
  "min-h-24 w-full rounded-lg border bg-white px-2.5 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"

const rangeClass =
  "h-2 w-full cursor-pointer accent-slate-950"

const toneLabel: Record<OperationalPosterTone, string> = {
  neutral: "Neutro",
  info: "Informativo",
  attention: "Atencao",
  urgent: "Urgente",
  success: "Positivo",
}

const formatLabel: Record<OperationalPosterFormat, string> = {
  a2: "A2",
  a3: "A3",
  a4: "A4",
  a5: "A5",
  a6: "A6",
  thermal: "Bobina",
}

const printScaleByFormat: Record<OperationalPosterFormat, number> = {
  a2: 2,
  a3: 1.41,
  a4: 1,
  a5: 0.71,
  a6: 0.5,
  thermal: 0.42,
}

const paperAspectByFormat: Record<OperationalPosterFormat, string> = {
  a2: "420 / 594",
  a3: "297 / 420",
  a4: "210 / 297",
  a5: "148 / 210",
  a6: "105 / 148",
  thermal: "72 / 160",
}

const saleUnits = ["unid", "kg", "g", "cx", "pct", "lt", "ml", "m", "dz"]

type PosterArea = {
  left: string
  top: string
  width: string
  align?: CSSProperties["textAlign"]
  color?: string
}

type PosterTemplate = {
  key: string
  name: string
  file: string | null
  aspectRatio: string
  layout: {
    product: PosterArea
    description: PosterArea
    price: PosterArea
    unit: PosterArea
  }
  textColor?: string
  priceColor?: string
}

type PosterCanvasData = {
  template_key: string | null
  title: string
  subtitle: string | null
  body: string
  footer: string | null
  product_name: string | null
  product_description: string | null
  price_text: string | null
  sale_unit: string | null
  product_name_size: number
  description_size: number
  price_size: number
  sale_unit_size: number
  tone: OperationalPosterTone
  format: OperationalPosterFormat
}

const centeredLayout: PosterTemplate["layout"] = {
  product: { top: "42%", left: "8%", width: "84%" },
  description: { top: "53%", left: "10%", width: "80%" },
  price: { top: "65%", left: "8%", width: "84%" },
  unit: { top: "77%", left: "18%", width: "64%" },
}

const lowOfferLayout: PosterTemplate["layout"] = {
  product: { top: "50%", left: "9%", width: "82%" },
  description: { top: "59%", left: "12%", width: "76%" },
  price: { top: "72%", left: "8%", width: "84%" },
  unit: { top: "84%", left: "18%", width: "64%" },
}

const highNoticeLayout: PosterTemplate["layout"] = {
  product: { top: "32%", left: "9%", width: "82%" },
  description: { top: "46%", left: "10%", width: "80%" },
  price: { top: "61%", left: "8%", width: "84%" },
  unit: { top: "75%", left: "18%", width: "64%" },
}

const posterTemplates: PosterTemplate[] = [
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

const emptyForm = {
  branch_id: "",
  sector_id: "",
  template_key: "blank",
  title: "",
  subtitle: "",
  body: "",
  footer: "",
  product_name: "",
  product_description: "",
  price_text: "",
  sale_unit: "unid",
  product_name_size: "34",
  description_size: "18",
  price_size: "76",
  sale_unit_size: "20",
  tone: "attention" as OperationalPosterTone,
  format: "a4" as OperationalPosterFormat,
}

type PosterForm = typeof emptyForm

function templateUrl(template: PosterTemplate) {
  return template.file
    ? `${import.meta.env.BASE_URL}cartaz-templates/${encodeURIComponent(template.file)}`
    : ""
}

function getPosterTemplate(key?: string | null) {
  return posterTemplates.find((template) => template.key === key) ?? posterTemplates[0]
}

function scopeLabel(poster: OperationalPoster) {
  const branch = poster.branches?.name ?? "Toda empresa"
  return poster.sectors?.name ? `${branch} - ${poster.sectors.name}` : branch
}

function toNumber(value: string | number | null | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function formToCanvasData(form: PosterForm): PosterCanvasData {
  const productName = form.product_name.trim()
  const productDescription = form.product_description.trim()

  return {
    template_key: form.template_key === "blank" ? null : form.template_key,
    title: productName || form.title,
    subtitle: form.subtitle.trim() || null,
    body: productDescription || form.body,
    footer: form.footer.trim() || null,
    product_name: productName || null,
    product_description: productDescription || null,
    price_text: form.price_text.trim() || null,
    sale_unit: form.sale_unit.trim() || null,
    product_name_size: toNumber(form.product_name_size, 34),
    description_size: toNumber(form.description_size, 18),
    price_size: toNumber(form.price_size, 76),
    sale_unit_size: toNumber(form.sale_unit_size, 20),
    tone: form.tone,
    format: form.format,
  }
}

function posterToCanvasData(poster: OperationalPoster): PosterCanvasData {
  return {
    template_key: poster.template_key,
    title: poster.title,
    subtitle: poster.subtitle,
    body: poster.body,
    footer: poster.footer,
    product_name: poster.product_name,
    product_description: poster.product_description,
    price_text: poster.price_text,
    sale_unit: poster.sale_unit,
    product_name_size: poster.product_name_size ?? 34,
    description_size: poster.description_size ?? 18,
    price_size: poster.price_size ?? 76,
    sale_unit_size: poster.sale_unit_size ?? 20,
    tone: poster.tone,
    format: poster.format,
  }
}

function blankToneStyle(tone: OperationalPosterTone): CSSProperties {
  if (tone === "urgent") return { backgroundColor: "#fff1f2", borderColor: "#dc2626" }
  if (tone === "success") return { backgroundColor: "#ecfdf5", borderColor: "#059669" }
  if (tone === "info") return { backgroundColor: "#f0f9ff", borderColor: "#0284c7" }
  if (tone === "attention") return { backgroundColor: "#fffbeb", borderColor: "#f59e0b" }
  return { backgroundColor: "#ffffff", borderColor: "#111827" }
}

function areaStyle(
  area: PosterArea,
  size: number,
  scale: number,
  color: string,
  weight: number
): CSSProperties {
  return {
    position: "absolute",
    zIndex: 1,
    left: area.left,
    top: area.top,
    width: area.width,
    transform: "translateY(-50%)",
    color: area.color ?? color,
    fontFamily: "Arial Black, Arial, Helvetica, sans-serif",
    fontSize: `${clamp(size * scale, 8, 150)}px`,
    fontWeight: weight,
    letterSpacing: 0,
    lineHeight: 1,
    overflowWrap: "anywhere",
    textAlign: area.align ?? "center",
    textShadow: "0 1px 2px rgba(255,255,255,0.72)",
    textTransform: "uppercase",
  }
}

function PosterCanvas({
  data,
  compact = false,
  print = false,
  showPlaceholders = false,
}: {
  data: PosterCanvasData
  compact?: boolean
  print?: boolean
  showPlaceholders?: boolean
}) {
  const template = getPosterTemplate(data.template_key)
  const hasTemplate = Boolean(template.file)
  const scale = print ? printScaleByFormat[data.format] : compact ? 0.36 : 0.5
  const textColor = template.textColor ?? "#111827"
  const priceColor = template.priceColor ?? textColor
  const productName =
    data.product_name || data.title || (showPlaceholders ? "NOME DO PRODUTO" : "")
  const productDescription =
    data.product_description || data.body || (showPlaceholders ? "Descricao da oferta" : "")
  const priceText = data.price_text || (showPlaceholders ? "R$ 0,00" : "")
  const unitText = data.sale_unit || (showPlaceholders ? "unid" : "")

  return (
    <div
      className="poster-template-canvas relative isolate overflow-hidden rounded-lg border bg-white shadow-sm"
      style={{
        aspectRatio: print ? paperAspectByFormat[data.format] : template.aspectRatio,
        ...(hasTemplate ? {} : blankToneStyle(data.tone)),
      }}
    >
      {hasTemplate ? (
        <img
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 size-full object-fill"
          draggable={false}
          src={templateUrl(template)}
        />
      ) : null}

      {!hasTemplate ? (
        <div className="absolute inset-x-[8%] top-[7%] z-10 border-b-4 border-current pb-3 text-center text-sm font-black uppercase text-slate-900">
          {data.subtitle || "OFERTA"}
        </div>
      ) : null}

      {productName ? (
        <div
          style={areaStyle(
            template.layout.product,
            data.product_name_size,
            scale,
            textColor,
            900
          )}
        >
          {productName}
        </div>
      ) : null}

      {productDescription ? (
        <div
          style={{
            ...areaStyle(
              template.layout.description,
              data.description_size,
              scale,
              textColor,
              800
            ),
            lineHeight: 1.12,
          }}
        >
          {productDescription}
        </div>
      ) : null}

      {priceText ? (
        <div
          style={{
            ...areaStyle(template.layout.price, data.price_size, scale, priceColor, 900),
            lineHeight: 0.92,
          }}
        >
          {priceText}
        </div>
      ) : null}

      {unitText ? (
        <div
          style={areaStyle(
            template.layout.unit,
            data.sale_unit_size,
            scale,
            textColor,
            900
          )}
        >
          {unitText}
        </div>
      ) : null}

      {data.footer ? (
        <div
          className="absolute inset-x-[8%] bottom-[4%] text-center font-bold uppercase text-slate-900"
          style={{
            zIndex: 1,
            fontSize: `${clamp(data.sale_unit_size * scale * 0.72, 7, 36)}px`,
            letterSpacing: 0,
            lineHeight: 1.15,
            textShadow: "0 1px 2px rgba(255,255,255,0.72)",
          }}
        >
          {data.footer}
        </div>
      ) : null}
    </div>
  )
}

function SizeControl({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: string
  min: number
  max: number
  onChange: (value: string) => void
}) {
  return (
    <label className="space-y-1 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{value}px</span>
      </div>
      <input
        className={rangeClass}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <Input
        min={min}
        max={max}
        type="number"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

function PrintablePoster({ poster }: { poster: OperationalPoster }) {
  return (
    <div className={`poster-print-root poster-tone-${poster.tone} poster-format-${poster.format}`}>
      <PosterCanvas data={posterToCanvasData(poster)} print />
    </div>
  )
}

export function OperationalPostersPage() {
  const selectedBranchId = useAppStore((state) => state.selectedBranchId)
  const posters = useOperationalPosters()
  const branches = useBranches()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<OperationalPoster | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [printPoster, setPrintPoster] = useState<OperationalPoster | null>(null)

  const sectors = useSectors(form.branch_id || null)
  const createPoster = useCreateOperationalPoster()
  const updatePoster = useUpdateOperationalPoster()
  const deletePoster = useDeleteOperationalPoster()

  const stats = useMemo(() => {
    const rows = posters.data ?? []
    return {
      total: rows.length,
      templates: rows.filter((poster) => poster.template_key).length,
      attention: rows.filter((poster) => poster.tone === "attention").length,
      a4: rows.filter((poster) => poster.format === "a4").length,
    }
  }, [posters.data])

  useEffect(() => {
    if (!printPoster) return
    const clearPrintedPoster = () => setPrintPoster(null)
    window.addEventListener("afterprint", clearPrintedPoster)
    window.setTimeout(() => window.print(), 150)
    return () => {
      window.removeEventListener("afterprint", clearPrintedPoster)
    }
  }, [printPoster])

  function resetForm() {
    setForm(emptyForm)
    setEditing(null)
  }

  function openCreate() {
    resetForm()
    setForm((current) => ({ ...current, branch_id: selectedBranchId ?? "" }))
    setOpen(true)
  }

  function openEdit(poster: OperationalPoster) {
    setEditing(poster)
    setForm({
      branch_id: poster.branch_id ?? "",
      sector_id: poster.sector_id ?? "",
      template_key: poster.template_key ?? "blank",
      title: poster.title,
      subtitle: poster.subtitle ?? "",
      body: poster.body,
      footer: poster.footer ?? "",
      product_name: poster.product_name ?? poster.title,
      product_description: poster.product_description ?? poster.body,
      price_text: poster.price_text ?? "",
      sale_unit: poster.sale_unit ?? "unid",
      product_name_size: String(poster.product_name_size ?? 34),
      description_size: String(poster.description_size ?? 18),
      price_size: String(poster.price_size ?? 76),
      sale_unit_size: String(poster.sale_unit_size ?? 20),
      tone: poster.tone,
      format: poster.format,
    })
    setOpen(true)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const productName = form.product_name.trim()
    const productDescription = form.product_description.trim()
    const priceText = form.price_text.trim()
    const saleUnit = form.sale_unit.trim()

    const payload = {
      branch_id: form.branch_id || null,
      sector_id: form.sector_id || null,
      template_key: form.template_key === "blank" ? null : form.template_key,
      title: productName,
      subtitle: form.subtitle || null,
      body: productDescription,
      footer: form.footer || null,
      product_name: productName,
      product_description: productDescription,
      price_text: priceText,
      sale_unit: saleUnit,
      product_name_size: toNumber(form.product_name_size, 34),
      description_size: toNumber(form.description_size, 18),
      price_size: toNumber(form.price_size, 76),
      sale_unit_size: toNumber(form.sale_unit_size, 20),
      tone: form.tone,
      format: form.format,
    }

    if (editing) {
      await updatePoster.mutateAsync({ posterId: editing.id, values: payload })
    } else {
      await createPoster.mutateAsync(payload)
    }

    resetForm()
    setOpen(false)
  }

  function removePoster(poster: OperationalPoster) {
    if (!window.confirm(`Excluir o cartaz "${poster.title}"?`)) return
    void deletePoster.mutateAsync(poster.id)
  }

  const isSaving = createPoster.isPending || updatePoster.isPending
  const selectedTemplate = getPosterTemplate(form.template_key)
  const previewData = formToCanvasData(form)
  const mutationError = createPoster.error || updatePoster.error || deletePoster.error

  return (
    <>
      <PageHeader
        title="Cartazes"
        description="Crie cartazes de oferta com modelo pronto, dados do produto e impressao por tamanho de papel."
        action={
          <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
              setOpen(nextOpen)
              if (!nextOpen) resetForm()
            }}
          >
            <DialogTrigger asChild>
              <Button onClick={openCreate}>
                <Plus className="size-4" />
                Novo cartaz
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
              <DialogHeader>
                <DialogTitle>{editing ? "Editar cartaz" : "Novo cartaz"}</DialogTitle>
              </DialogHeader>
              <form className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_310px]" onSubmit={handleSubmit}>
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">Template</span>
                      <select
                        className={fieldClass}
                        value={form.template_key}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            template_key: event.target.value,
                          }))
                        }
                      >
                        {posterTemplates.map((template) => (
                          <option key={template.key} value={template.key}>
                            {template.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">Filial</span>
                      <select
                        className={fieldClass}
                        value={form.branch_id}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            branch_id: event.target.value,
                            sector_id: "",
                          }))
                        }
                      >
                        <option value="">Toda empresa</option>
                        {(branches.data ?? []).map((branch) => (
                          <option key={branch.id} value={branch.id}>
                            {branch.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">Setor</span>
                      <select
                        className={fieldClass}
                        disabled={!form.branch_id}
                        value={form.sector_id}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, sector_id: event.target.value }))
                        }
                      >
                        <option value="">Todos setores</option>
                        {(sectors.data ?? []).map((sector) => (
                          <option key={sector.id} value={sector.id}>
                            {sector.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1 text-sm sm:col-span-2">
                      <span className="font-medium">Nome do produto</span>
                      <Input
                        required
                        value={form.product_name}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            product_name: event.target.value,
                            title: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="space-y-1 text-sm sm:col-span-2">
                      <span className="font-medium">Descricao</span>
                      <textarea
                        required
                        className={textareaClass}
                        value={form.product_description}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            product_description: event.target.value,
                            body: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">Valor</span>
                      <Input
                        required
                        placeholder="R$ 9,99"
                        value={form.price_text}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, price_text: event.target.value }))
                        }
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">Forma de venda</span>
                      <Input
                        required
                        list="poster-sale-units"
                        value={form.sale_unit}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, sale_unit: event.target.value }))
                        }
                      />
                      <datalist id="poster-sale-units">
                        {saleUnits.map((unit) => (
                          <option key={unit} value={unit} />
                        ))}
                      </datalist>
                    </label>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">Papel de impressao</span>
                      <select
                        className={fieldClass}
                        value={form.format}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            format: event.target.value as OperationalPosterFormat,
                          }))
                        }
                      >
                        {(Object.keys(formatLabel) as OperationalPosterFormat[]).map((format) => (
                          <option key={format} value={format}>
                            {formatLabel[format]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">Tom do cartaz</span>
                      <select
                        className={fieldClass}
                        value={form.tone}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            tone: event.target.value as OperationalPosterTone,
                          }))
                        }
                      >
                        {(Object.keys(toneLabel) as OperationalPosterTone[]).map((tone) => (
                          <option key={tone} value={tone}>
                            {toneLabel[tone]}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="rounded-lg border bg-slate-50 p-3">
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                      <Type className="size-4" />
                      Tamanho das informacoes
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <SizeControl
                        label="Produto"
                        min={18}
                        max={96}
                        value={form.product_name_size}
                        onChange={(value) =>
                          setForm((current) => ({ ...current, product_name_size: value }))
                        }
                      />
                      <SizeControl
                        label="Descricao"
                        min={10}
                        max={54}
                        value={form.description_size}
                        onChange={(value) =>
                          setForm((current) => ({ ...current, description_size: value }))
                        }
                      />
                      <SizeControl
                        label="Valor"
                        min={28}
                        max={140}
                        value={form.price_size}
                        onChange={(value) =>
                          setForm((current) => ({ ...current, price_size: value }))
                        }
                      />
                      <SizeControl
                        label="Forma de venda"
                        min={10}
                        max={52}
                        value={form.sale_unit_size}
                        onChange={(value) =>
                          setForm((current) => ({ ...current, sale_unit_size: value }))
                        }
                      />
                    </div>
                  </div>

                  <details className="rounded-lg border bg-white p-3 text-sm">
                    <summary className="cursor-pointer font-semibold">Dados extras</summary>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="space-y-1">
                        <span className="font-medium">Chamada superior</span>
                        <Input
                          value={form.subtitle}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, subtitle: event.target.value }))
                          }
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="font-medium">Rodape</span>
                        <Input
                          value={form.footer}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, footer: event.target.value }))
                          }
                        />
                      </label>
                    </div>
                  </details>
                </div>

                <aside className="space-y-3">
                  <div className="rounded-lg border bg-white p-3">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <ImageIcon className="size-4" />
                        Previa
                      </div>
                      <Badge variant="secondary">{formatLabel[form.format]}</Badge>
                    </div>
                    <PosterCanvas data={previewData} showPlaceholders />
                    <div className="mt-2 text-xs text-muted-foreground">
                      {selectedTemplate.name}
                    </div>
                  </div>
                  <DialogFooter className="sm:justify-end">
                    <Button type="submit" disabled={isSaving}>
                      {isSaving ? "Salvando..." : "Salvar cartaz"}
                    </Button>
                  </DialogFooter>
                </aside>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="space-y-6 p-6">
        <div className="grid gap-3 sm:grid-cols-4">
          <Card className="border bg-white shadow-sm">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Cartazes</div>
              <div className="text-2xl font-semibold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card className="border bg-white shadow-sm">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Com template</div>
              <div className="text-2xl font-semibold">{stats.templates}</div>
            </CardContent>
          </Card>
          <Card className="border bg-white shadow-sm">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Atencao</div>
              <div className="text-2xl font-semibold">{stats.attention}</div>
            </CardContent>
          </Card>
          <Card className="border bg-white shadow-sm">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">A4</div>
              <div className="text-2xl font-semibold">{stats.a4}</div>
            </CardContent>
          </Card>
        </div>

        {posters.isLoading ? (
          <StateBlock type="loading" title="Carregando cartazes" />
        ) : posters.isError ? (
          <StateBlock
            type="error"
            title="Erro ao carregar cartazes"
            description={posters.error.message}
          />
        ) : (posters.data ?? []).length === 0 ? (
          <StateBlock
            title="Nenhum cartaz"
            description="Crie avisos internos, orientacoes para loja e materiais simples para impressao."
          />
        ) : (
          <div className="grid gap-4 xl:grid-cols-3">
            {(posters.data ?? []).map((poster) => {
              const template = getPosterTemplate(poster.template_key)
              return (
                <Card key={poster.id} className="border bg-white shadow-sm">
                  <CardHeader>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Megaphone className="size-4 shrink-0" />
                        <span className="break-words">
                          {poster.product_name ?? poster.title}
                        </span>
                      </CardTitle>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="outline">{toneLabel[poster.tone]}</Badge>
                        <Badge variant="secondary">{formatLabel[poster.format]}</Badge>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {scopeLabel(poster)} - {formatDateTimeBR(poster.created_at)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="mx-auto max-w-[230px]">
                      <PosterCanvas data={posterToCanvasData(poster)} compact />
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <Badge variant="outline">{template.name}</Badge>
                      {poster.price_text ? <span>{poster.price_text}</span> : null}
                      {poster.sale_unit ? <span>/ {poster.sale_unit}</span> : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setPrintPoster(poster)}
                      >
                        <Printer className="size-4" />
                        Imprimir
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => openEdit(poster)}
                      >
                        <Edit3 className="size-4" />
                        Editar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => removePoster(poster)}
                      >
                        <Trash2 className="size-4" />
                        Excluir
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {mutationError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {mutationError.message}
          </div>
        ) : null}
      </div>

      {printPoster ? <PrintablePoster poster={printPoster} /> : null}
    </>
  )
}
