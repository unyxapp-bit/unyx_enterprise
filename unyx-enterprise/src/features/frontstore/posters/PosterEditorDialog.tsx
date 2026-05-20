import { useMemo, useState } from "react"
import type { FormEvent } from "react"
import {
  FileText,
  ImageIcon,
  Layers,
  LayoutTemplate,
  MapPin,
  Minus,
  Move,
  Palette,
  Plus,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  fieldClass,
  formatLabel,
  positionFields,
  posterTemplates,
  rangeClass,
  saleUnits,
  templateUrl,
  textareaClass,
  toneLabel,
  type PosterPositionAxis,
} from "@/features/frontstore/posters/posterConfig"
import { PosterCanvas } from "@/features/frontstore/posters/PosterCanvas"
import { PosterPreviewEditor } from "@/features/frontstore/posters/PosterPreviewEditor"
import {
  formPositionsFromLayoutConfig,
  formToCanvasData,
  getFormPositionValue,
  type PosterForm,
} from "@/features/frontstore/posters/posterModel"
import type {
  Branch,
  OperationalPoster,
  OperationalPosterFormat,
  OperationalPosterLayoutField,
  OperationalPosterTone,
  Sector,
} from "@/types/domain"

type EditorSection = "content" | "template" | "design" | "position" | "scope"

const sections: Array<{
  key: EditorSection
  label: string
  icon: typeof FileText
}> = [
  { key: "content", label: "Conteudo", icon: FileText },
  { key: "template", label: "Modelo", icon: LayoutTemplate },
  { key: "design", label: "Design", icon: Palette },
  { key: "position", label: "Posicao", icon: Move },
  { key: "scope", label: "Publicacao", icon: MapPin },
]

const sizeControlByField: Partial<
  Record<
    OperationalPosterLayoutField,
    {
      key: keyof PosterForm
      label: string
      min: number
      max: number
    }
  >
> = {
  subtitle: {
    key: "sale_unit_size",
    label: "Tamanho da chamada",
    min: 10,
    max: 52,
  },
  product: {
    key: "product_name_size",
    label: "Tamanho do produto",
    min: 18,
    max: 96,
  },
  description: {
    key: "description_size",
    label: "Tamanho da descricao",
    min: 10,
    max: 54,
  },
  price: {
    key: "price_size",
    label: "Tamanho do valor",
    min: 28,
    max: 140,
  },
  unit: {
    key: "sale_unit_size",
    label: "Tamanho da unidade",
    min: 10,
    max: 52,
  },
  footer: {
    key: "sale_unit_size",
    label: "Tamanho do rodape",
    min: 10,
    max: 52,
  },
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

function PositionAxisControl({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{value}%</span>
      </div>
      <input
        className={rangeClass}
        max={100}
        min={0}
        step={1}
        type="range"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <Input
        max={100}
        min={0}
        step={1}
        type="number"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

function PositionControl({
  label,
  x,
  y,
  onChange,
}: {
  label: string
  x: string
  y: string
  onChange: (axis: PosterPositionAxis, value: string) => void
}) {
  return (
    <div className="rounded-lg border bg-white p-2.5">
      <div className="mb-2 flex items-center justify-between gap-2 text-sm font-medium">
        <span>{label}</span>
        <span className="text-xs text-muted-foreground">
          X {x}% / Y {y}%
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <PositionAxisControl
          label="X"
          value={x}
          onChange={(value) => onChange("x", value)}
        />
        <PositionAxisControl
          label="Y"
          value={y}
          onChange={(value) => onChange("y", value)}
        />
      </div>
    </div>
  )
}

export function PosterEditorDialog({
  open,
  editing,
  form,
  branches,
  sectors,
  isSaving,
  onFormChange,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  editing: OperationalPoster | null
  form: PosterForm
  branches: Branch[]
  sectors: Sector[]
  isSaving: boolean
  onFormChange: (updater: (current: PosterForm) => PosterForm) => void
  onOpenChange: (open: boolean) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  const [section, setSection] = useState<EditorSection>("content")
  const [selectedField, setSelectedField] =
    useState<OperationalPosterLayoutField>("price")
  const [zoom, setZoom] = useState(1)
  const previewData = useMemo(() => formToCanvasData(form), [form])
  const selectedTemplate = posterTemplates.find((template) => template.key === form.template_key)
  const selectedFieldConfig = positionFields.find(({ field }) => field === selectedField)
  const selectedSizeControl = sizeControlByField[selectedField]
  const stageWidth = Math.round(620 * zoom)
  const textScale = stageWidth / 620

  function updatePosition(
    field: OperationalPosterLayoutField,
    axis: PosterPositionAxis,
    value: string
  ) {
    onFormChange((current) => ({
      ...current,
      [`${field}_${axis}`]: value,
    }))
  }

  function chooseTemplate(templateKey: string) {
    onFormChange((current) => ({
      ...current,
      template_key: templateKey,
      ...formPositionsFromLayoutConfig(null, templateKey),
    }))
  }

  function resetPositions() {
    onFormChange((current) => ({
      ...current,
      ...formPositionsFromLayoutConfig(null, current.template_key),
    }))
  }

  function updateSelectedSize(value: string) {
    if (!selectedSizeControl) return

    onFormChange((current) => ({
      ...current,
      [selectedSizeControl.key]: value,
    }))
  }

  function updateZoom(nextZoom: number) {
    setZoom(Math.min(Math.max(nextZoom, 0.65), 1.45))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-[calc(100vw-1rem)] xl:max-w-7xl 2xl:max-w-[1360px]">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar cartaz" : "Novo cartaz"}</DialogTitle>
        </DialogHeader>

        <form
          className="grid gap-5 xl:grid-cols-[minmax(320px,430px)_minmax(520px,1fr)]"
          onSubmit={onSubmit}
        >
          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap gap-1 rounded-lg border bg-slate-50 p-1">
              {sections.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
                      section === item.key
                        ? "bg-slate-950 text-white"
                        : "text-slate-600 hover:bg-white hover:text-slate-950"
                    )}
                    onClick={() => setSection(item.key)}
                  >
                    <Icon className="size-3.5" />
                    {item.label}
                  </button>
                )
              })}
            </div>

            {section === "content" ? (
              <div className="space-y-4 rounded-xl border bg-white p-4">
                <div>
                  <h3 className="text-sm font-semibold">Informacoes do cartaz</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Preencha somente o que deve aparecer no material impresso.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-sm sm:col-span-2">
                    <span className="font-medium">Nome do produto</span>
                    <textarea
                      required
                      className="min-h-24 w-full rounded-lg border bg-white px-2.5 py-2 text-xl font-black uppercase leading-none outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"
                      value={form.product_name}
                      onChange={(event) =>
                        onFormChange((current) => ({
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
                        onFormChange((current) => ({
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
                        onFormChange((current) => ({
                          ...current,
                          price_text: event.target.value,
                        }))
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
                        onFormChange((current) => ({
                          ...current,
                          sale_unit: event.target.value,
                        }))
                      }
                    />
                    <datalist id="poster-sale-units">
                      {saleUnits.map((unit) => (
                        <option key={unit} value={unit} />
                      ))}
                    </datalist>
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Chamada superior</span>
                    <Input
                      value={form.subtitle}
                      onChange={(event) =>
                        onFormChange((current) => ({
                          ...current,
                          subtitle: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Rodape</span>
                    <Input
                      value={form.footer}
                      placeholder="Valido ate..."
                      onChange={(event) =>
                        onFormChange((current) => ({
                          ...current,
                          footer: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
              </div>
            ) : null}

            {section === "template" ? (
              <div className="space-y-4 rounded-xl border bg-white p-4">
                <div>
                  <h3 className="text-sm font-semibold">Galeria de modelos</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Escolha um modelo visual para a loja imprimir com mais consistencia.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {posterTemplates.map((template) => (
                    <button
                      key={template.key}
                      type="button"
                      className={cn(
                        "group rounded-xl border bg-slate-50 p-2 text-left transition-all hover:border-slate-900 hover:bg-white",
                        form.template_key === template.key && "border-slate-950 ring-2 ring-slate-950/10"
                      )}
                      onClick={() => chooseTemplate(template.key)}
                    >
                      <div
                        className="mb-2 flex h-36 items-center justify-center overflow-hidden rounded-lg border bg-white"
                        style={{ aspectRatio: template.aspectRatio }}
                      >
                        {template.file ? (
                          <img
                            alt=""
                            className="size-full object-fill"
                            src={templateUrl(template)}
                          />
                        ) : template.kind === "guided" ? (
                          <PosterCanvas
                            compact
                            showPlaceholders
                            data={formToCanvasData({
                              ...form,
                              template_key: template.key,
                            })}
                          />
                        ) : (
                          <LayoutTemplate className="size-8 text-slate-400" />
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold">{template.name}</span>
                        {form.template_key === template.key ? (
                          <Badge variant="secondary">Atual</Badge>
                        ) : null}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {section === "design" ? (
              <div className="space-y-4 rounded-xl border bg-white p-4">
                <div>
                  <h3 className="text-sm font-semibold">Tamanho e tom</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Ajuste pesos visuais sem perder a proporcao do modelo.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Papel de impressao</span>
                    <select
                      className={fieldClass}
                      value={form.format}
                      onChange={(event) =>
                        onFormChange((current) => ({
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
                        onFormChange((current) => ({
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
                <div className="grid gap-3 sm:grid-cols-2">
                  <SizeControl
                    label="Produto"
                    min={18}
                    max={96}
                    value={form.product_name_size}
                    onChange={(value) =>
                      onFormChange((current) => ({
                        ...current,
                        product_name_size: value,
                      }))
                    }
                  />
                  <SizeControl
                    label="Descricao"
                    min={10}
                    max={54}
                    value={form.description_size}
                    onChange={(value) =>
                      onFormChange((current) => ({
                        ...current,
                        description_size: value,
                      }))
                    }
                  />
                  <SizeControl
                    label="Valor"
                    min={28}
                    max={140}
                    value={form.price_size}
                    onChange={(value) =>
                      onFormChange((current) => ({ ...current, price_size: value }))
                    }
                  />
                  <SizeControl
                    label="Forma de venda"
                    min={10}
                    max={52}
                    value={form.sale_unit_size}
                    onChange={(value) =>
                      onFormChange((current) => ({
                        ...current,
                        sale_unit_size: value,
                      }))
                    }
                  />
                </div>
              </div>
            ) : null}

            {section === "position" ? (
              <div className="space-y-4 rounded-xl border bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">Posicao dos dados</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Coordenadas de cada campo no modelo selecionado.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={resetPositions}
                  >
                    <RotateCcw className="size-4" />
                    Resetar
                  </Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {positionFields.map(({ field, label }) => (
                    <button
                      key={field}
                      type="button"
                      className={cn(
                        "rounded-lg border px-2.5 py-2 text-left text-xs transition-colors",
                        selectedField === field
                          ? "border-slate-950 bg-slate-950 text-white"
                          : "bg-white hover:border-slate-400 hover:bg-slate-50"
                      )}
                      onClick={() => setSelectedField(field)}
                    >
                      <span className="block font-semibold">{label}</span>
                      <span
                        className={cn(
                          "mt-0.5 block",
                          selectedField === field
                            ? "text-white/70"
                            : "text-muted-foreground"
                        )}
                      >
                        X {getFormPositionValue(form, field, "x")}% / Y{" "}
                        {getFormPositionValue(form, field, "y")}%
                      </span>
                    </button>
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {positionFields.map(({ field, label }) => (
                    <PositionControl
                      key={field}
                      label={label}
                      x={getFormPositionValue(form, field, "x")}
                      y={getFormPositionValue(form, field, "y")}
                      onChange={(axis, value) => updatePosition(field, axis, value)}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {section === "scope" ? (
              <div className="space-y-4 rounded-xl border bg-white p-4">
                <div>
                  <h3 className="text-sm font-semibold">Publicacao</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Defina onde este cartaz aparece para organizacao e auditoria.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Filial</span>
                    <select
                      className={fieldClass}
                      value={form.branch_id}
                      onChange={(event) =>
                        onFormChange((current) => ({
                          ...current,
                          branch_id: event.target.value,
                          sector_id: "",
                        }))
                      }
                    >
                      <option value="">Toda empresa</option>
                      {branches.map((branch) => (
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
                        onFormChange((current) => ({
                          ...current,
                          sector_id: event.target.value,
                        }))
                      }
                    >
                      <option value="">Todos setores</option>
                      {sectors.map((sector) => (
                        <option key={sector.id} value={sector.id}>
                          {sector.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            ) : null}
          </div>

          <aside className="space-y-3 xl:sticky xl:top-4 xl:self-start">
            <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-slate-950 px-3 py-2 text-white">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <ImageIcon className="size-4" />
                  Editor visual
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    className="inline-flex size-7 items-center justify-center rounded-md text-white/80 hover:bg-white/10 hover:text-white"
                    title="Diminuir zoom"
                    onClick={() => updateZoom(zoom - 0.1)}
                  >
                    <Minus className="size-4" />
                  </button>
                  <span className="min-w-12 text-center text-xs font-semibold">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    type="button"
                    className="inline-flex size-7 items-center justify-center rounded-md text-white/80 hover:bg-white/10 hover:text-white"
                    title="Aumentar zoom"
                    onClick={() => updateZoom(zoom + 0.1)}
                  >
                    <Plus className="size-4" />
                  </button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    className="border-white/20 bg-white/10 text-white hover:bg-white/20"
                    title="Resetar posicoes"
                    onClick={resetPositions}
                  >
                    <RotateCcw className="size-4" />
                  </Button>
                </div>
              </div>

              <div className="grid gap-0 border-b bg-white xl:grid-cols-[220px_minmax(0,1fr)]">
                <div className="border-b p-3 xl:border-b-0 xl:border-r">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-700">
                    <Layers className="size-4" />
                    Camadas
                  </div>
                  <div className="grid gap-1.5">
                    {positionFields.map(({ field, label }) => (
                      <button
                        key={field}
                        type="button"
                        className={cn(
                          "flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition-colors",
                          selectedField === field
                            ? "border-slate-950 bg-slate-950 text-white"
                            : "bg-white hover:border-slate-400 hover:bg-slate-50"
                        )}
                        onClick={() => {
                          setSelectedField(field)
                          setSection("position")
                        }}
                      >
                        <span className="font-semibold">{label}</span>
                        <span
                          className={cn(
                            "text-[10px]",
                            selectedField === field
                              ? "text-white/70"
                              : "text-muted-foreground"
                          )}
                        >
                          {getFormPositionValue(form, field, "x")} /{" "}
                          {getFormPositionValue(form, field, "y")}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <SlidersHorizontal className="size-4" />
                        {selectedFieldConfig?.label ?? "Elemento"}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        Arraste no cartaz ou ajuste os valores.
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="secondary">{formatLabel[form.format]}</Badge>
                      <Badge variant="outline">{toneLabel[form.tone]}</Badge>
                    </div>
                  </div>

                  <div className="grid gap-2 md:grid-cols-3">
                    <label className="space-y-1 text-xs">
                      <span className="font-medium">X</span>
                      <Input
                        max={100}
                        min={0}
                        step={0.5}
                        type="number"
                        value={getFormPositionValue(form, selectedField, "x")}
                        onChange={(event) =>
                          updatePosition(selectedField, "x", event.target.value)
                        }
                      />
                    </label>
                    <label className="space-y-1 text-xs">
                      <span className="font-medium">Y</span>
                      <Input
                        max={100}
                        min={0}
                        step={0.5}
                        type="number"
                        value={getFormPositionValue(form, selectedField, "y")}
                        onChange={(event) =>
                          updatePosition(selectedField, "y", event.target.value)
                        }
                      />
                    </label>
                    {selectedSizeControl ? (
                      <label className="space-y-1 text-xs">
                        <span className="font-medium">{selectedSizeControl.label}</span>
                        <Input
                          min={selectedSizeControl.min}
                          max={selectedSizeControl.max}
                          type="number"
                          value={String(form[selectedSizeControl.key])}
                          onChange={(event) => updateSelectedSize(event.target.value)}
                        />
                      </label>
                    ) : null}
                  </div>

                  {selectedSizeControl ? (
                    <input
                      className={rangeClass}
                      min={selectedSizeControl.min}
                      max={selectedSizeControl.max}
                      type="range"
                      value={String(form[selectedSizeControl.key])}
                      onChange={(event) => updateSelectedSize(event.target.value)}
                    />
                  ) : null}
                </div>
              </div>

              <PosterPreviewEditor
                data={previewData}
                form={form}
                selectedField={selectedField}
                stageWidth={stageWidth}
                textScale={textScale}
                onPositionChange={updatePosition}
                onSelectedFieldChange={(field) => {
                  setSelectedField(field)
                  setSection("position")
                }}
              />

              <div className="flex items-center justify-between gap-2 border-t bg-white px-3 py-2 text-xs text-muted-foreground">
                <span>{selectedTemplate?.name ?? "Em branco"}</span>
                <span>Previa em escala editorial</span>
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
  )
}
