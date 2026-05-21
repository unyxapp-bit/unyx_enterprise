import { useMemo, useState } from "react"
import type { FormEvent, ReactNode } from "react"
import {
  FileText,
  ImageIcon,
  Layers,
  LayoutTemplate,
  MapPin,
  Minus,
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

const sizeControlByField: Record<
  OperationalPosterLayoutField,
  {
    key: keyof PosterForm
    label: string
    min: number
    max: number
  }
> = {
  subtitle: {
    key: "sale_unit_size",
    label: "Chamada",
    min: 10,
    max: 80,
  },
  product: {
    key: "product_name_size",
    label: "Produto",
    min: 18,
    max: 140,
  },
  description: {
    key: "description_size",
    label: "Descricao",
    min: 10,
    max: 86,
  },
  price: {
    key: "price_size",
    label: "Valor",
    min: 36,
    max: 220,
  },
  unit: {
    key: "sale_unit_size",
    label: "Unidade",
    min: 10,
    max: 80,
  },
  footer: {
    key: "sale_unit_size",
    label: "Rodape",
    min: 10,
    max: 80,
  },
}

function FieldGroup({
  children,
  icon: Icon,
  title,
}: {
  children: ReactNode
  icon: typeof FileText
  title: string
}) {
  return (
    <section className="space-y-3 border-b p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
        <Icon className="size-4 text-slate-500" />
        {title}
      </div>
      {children}
    </section>
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
    <label className="space-y-1.5 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{value}px</span>
      </div>
      <input
        className={rangeClass}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

function TemplatePreview({
  form,
  onChoose,
  selectedKey,
}: {
  form: PosterForm
  onChoose: (templateKey: string) => void
  selectedKey: string
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {posterTemplates.map((template) => (
        <button
          key={template.key}
          type="button"
          className={cn(
            "rounded-lg border bg-slate-50 p-1.5 text-left transition-all hover:border-slate-900 hover:bg-white",
            selectedKey === template.key && "border-slate-950 ring-2 ring-slate-950/10"
          )}
          onClick={() => onChoose(template.key)}
        >
          <div
            className="flex h-28 items-center justify-center overflow-hidden rounded-md border bg-white"
            style={{ aspectRatio: template.aspectRatio }}
          >
            {template.file ? (
              <img alt="" className="size-full object-fill" src={templateUrl(template)} />
            ) : template.kind === "guided" ? (
              <PosterCanvas
                compact
                showPlaceholders
                data={formToCanvasData({ ...form, template_key: template.key })}
              />
            ) : (
              <LayoutTemplate className="size-7 text-slate-400" />
            )}
          </div>
          <div className="mt-1 truncate text-[11px] font-semibold">{template.name}</div>
        </button>
      ))}
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
  const [selectedField, setSelectedField] =
    useState<OperationalPosterLayoutField>("price")
  const [zoom, setZoom] = useState(0.78)
  const previewData = useMemo(() => formToCanvasData(form), [form])
  const selectedTemplate =
    posterTemplates.find((template) => template.key === form.template_key) ??
    posterTemplates[0]
  const selectedFieldConfig =
    positionFields.find(({ field }) => field === selectedField) ?? positionFields[0]
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

  function updateFormValue(key: keyof PosterForm, value: string) {
    onFormChange((current) => ({ ...current, [key]: value }))
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
    onFormChange((current) => ({
      ...current,
      [selectedSizeControl.key]: value,
    }))
  }

  function updateZoom(nextZoom: number) {
    setZoom(Math.min(Math.max(nextZoom, 0.58), 1.5))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid h-[calc(100vh-1rem)] max-h-[calc(100vh-1rem)] gap-0 overflow-hidden p-0 sm:max-w-[calc(100vw-1rem)]">
        <form className="grid min-h-0 grid-rows-[56px_minmax(0,1fr)]" onSubmit={onSubmit}>
          <div className="flex items-center justify-between gap-3 border-b bg-white px-4 pr-12">
            <DialogHeader className="min-w-0 gap-1">
              <DialogTitle className="truncate text-base font-semibold">
                {editing ? "Editar cartaz" : "Novo cartaz"}
              </DialogTitle>
              <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                <span className="truncate">{selectedTemplate.name}</span>
                <span>-</span>
                <span>{formatLabel[form.format]}</span>
              </div>
            </DialogHeader>

            <div className="flex shrink-0 items-center gap-2">
              <Button type="button" variant="outline" onClick={resetPositions}>
                <RotateCcw className="size-4" />
                Resetar
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Salvando..." : "Salvar cartaz"}
              </Button>
            </div>
          </div>

          <div className="grid min-h-0 grid-cols-[300px_minmax(420px,1fr)_320px] bg-slate-100">
            <aside className="min-h-0 overflow-y-auto border-r bg-white">
              <FieldGroup icon={FileText} title="Conteudo">
                <label className="space-y-1.5 text-xs">
                  <span className="font-medium">Produto</span>
                  <textarea
                    required
                    className="min-h-24 w-full resize-none rounded-lg border bg-white px-3 py-2 text-xl font-black uppercase leading-none outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"
                    value={form.product_name}
                    onChange={(event) => {
                      updateFormValue("product_name", event.target.value)
                      updateFormValue("title", event.target.value)
                    }}
                  />
                </label>
                <label className="space-y-1.5 text-xs">
                  <span className="font-medium">Descricao</span>
                  <textarea
                    required
                    className="min-h-20 w-full resize-none rounded-lg border bg-white px-3 py-2 text-sm font-semibold uppercase outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"
                    value={form.product_description}
                    onChange={(event) => {
                      updateFormValue("product_description", event.target.value)
                      updateFormValue("body", event.target.value)
                    }}
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1.5 text-xs">
                    <span className="font-medium">Valor</span>
                    <Input
                      required
                      className="font-black"
                      placeholder="21,99"
                      value={form.price_text}
                      onChange={(event) => updateFormValue("price_text", event.target.value)}
                    />
                  </label>
                  <label className="space-y-1.5 text-xs">
                    <span className="font-medium">Unidade</span>
                    <Input
                      required
                      className="font-black uppercase"
                      list="poster-sale-units"
                      value={form.sale_unit}
                      onChange={(event) => updateFormValue("sale_unit", event.target.value)}
                    />
                    <datalist id="poster-sale-units">
                      {saleUnits.map((unit) => (
                        <option key={unit} value={unit} />
                      ))}
                    </datalist>
                  </label>
                </div>
                <label className="space-y-1.5 text-xs">
                  <span className="font-medium">Chamada</span>
                  <Input
                    value={form.subtitle}
                    onChange={(event) => updateFormValue("subtitle", event.target.value)}
                  />
                </label>
                <label className="space-y-1.5 text-xs">
                  <span className="font-medium">Rodape</span>
                  <Input
                    value={form.footer}
                    onChange={(event) => updateFormValue("footer", event.target.value)}
                  />
                </label>
              </FieldGroup>

              <FieldGroup icon={LayoutTemplate} title="Modelos">
                <TemplatePreview
                  form={form}
                  selectedKey={form.template_key}
                  onChoose={chooseTemplate}
                />
              </FieldGroup>

              <FieldGroup icon={MapPin} title="Publicacao">
                <label className="space-y-1.5 text-xs">
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
                <label className="space-y-1.5 text-xs">
                  <span className="font-medium">Setor</span>
                  <select
                    className={fieldClass}
                    disabled={!form.branch_id}
                    value={form.sector_id}
                    onChange={(event) => updateFormValue("sector_id", event.target.value)}
                  >
                    <option value="">Todos setores</option>
                    {sectors.map((sector) => (
                      <option key={sector.id} value={sector.id}>
                        {sector.name}
                      </option>
                    ))}
                  </select>
                </label>
              </FieldGroup>
            </aside>

            <main className="grid min-h-0 grid-rows-[44px_minmax(0,1fr)]">
              <div className="flex items-center justify-between gap-2 border-b bg-slate-950 px-3 text-white">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <ImageIcon className="size-4" />
                  Canvas
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    className="inline-flex size-7 items-center justify-center rounded-md text-white/80 hover:bg-white/10 hover:text-white"
                    onClick={() => updateZoom(zoom - 0.08)}
                    title="Diminuir zoom"
                  >
                    <Minus className="size-4" />
                  </button>
                  <span className="min-w-12 text-center text-xs font-semibold">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    type="button"
                    className="inline-flex size-7 items-center justify-center rounded-md text-white/80 hover:bg-white/10 hover:text-white"
                    onClick={() => updateZoom(zoom + 0.08)}
                    title="Aumentar zoom"
                  >
                    <Plus className="size-4" />
                  </button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="ml-1 border-white/20 bg-white/10 text-white hover:bg-white/20"
                    onClick={() => setZoom(0.78)}
                  >
                    Ajustar
                  </Button>
                </div>
              </div>

              <PosterPreviewEditor
                className="min-h-0"
                data={previewData}
                form={form}
                selectedField={selectedField}
                stageWidth={stageWidth}
                textScale={textScale}
                onPositionChange={updatePosition}
                onSelectedFieldChange={setSelectedField}
              />
            </main>

            <aside className="min-h-0 overflow-y-auto border-l bg-white">
              <FieldGroup icon={Layers} title="Camadas">
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
                      onClick={() => setSelectedField(field)}
                    >
                      <span className="font-semibold">{label}</span>
                      <span
                        className={cn(
                          "text-[10px]",
                          selectedField === field ? "text-white/70" : "text-muted-foreground"
                        )}
                      >
                        {getFormPositionValue(form, field, "x")} /{" "}
                        {getFormPositionValue(form, field, "y")}
                      </span>
                    </button>
                  ))}
                </div>
              </FieldGroup>

              <FieldGroup icon={SlidersHorizontal} title={selectedFieldConfig.label}>
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1.5 text-xs">
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
                  <label className="space-y-1.5 text-xs">
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
                </div>
                <label className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{selectedSizeControl.label}</span>
                    <span className="text-muted-foreground">
                      {String(form[selectedSizeControl.key])}px
                    </span>
                  </div>
                  <input
                    className={rangeClass}
                    min={selectedSizeControl.min}
                    max={selectedSizeControl.max}
                    type="range"
                    value={String(form[selectedSizeControl.key])}
                    onChange={(event) => updateSelectedSize(event.target.value)}
                  />
                  <Input
                    min={selectedSizeControl.min}
                    max={selectedSizeControl.max}
                    type="number"
                    value={String(form[selectedSizeControl.key])}
                    onChange={(event) => updateSelectedSize(event.target.value)}
                  />
                </label>
              </FieldGroup>

              <FieldGroup icon={Palette} title="Design">
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1.5 text-xs">
                    <span className="font-medium">Papel</span>
                    <select
                      className={fieldClass}
                      value={form.format}
                      onChange={(event) =>
                        updateFormValue("format", event.target.value as OperationalPosterFormat)
                      }
                    >
                      {(Object.keys(formatLabel) as OperationalPosterFormat[]).map((format) => (
                        <option key={format} value={format}>
                          {formatLabel[format]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1.5 text-xs">
                    <span className="font-medium">Tom</span>
                    <select
                      className={fieldClass}
                      value={form.tone}
                      onChange={(event) =>
                        updateFormValue("tone", event.target.value as OperationalPosterTone)
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
                <div className="space-y-3">
                  <SizeControl
                    label="Produto"
                    min={18}
                    max={140}
                    value={form.product_name_size}
                    onChange={(value) => updateFormValue("product_name_size", value)}
                  />
                  <SizeControl
                    label="Descricao"
                    min={10}
                    max={86}
                    value={form.description_size}
                    onChange={(value) => updateFormValue("description_size", value)}
                  />
                  <SizeControl
                    label="Valor"
                    min={36}
                    max={220}
                    value={form.price_size}
                    onChange={(value) => updateFormValue("price_size", value)}
                  />
                  <SizeControl
                    label="Unidade"
                    min={10}
                    max={80}
                    value={form.sale_unit_size}
                    onChange={(value) => updateFormValue("sale_unit_size", value)}
                  />
                </div>
              </FieldGroup>

              <div className="flex items-center justify-between gap-2 p-4 text-xs text-muted-foreground">
                <Badge variant="secondary">{formatLabel[form.format]}</Badge>
                <Badge variant="outline">{toneLabel[form.tone]}</Badge>
              </div>
            </aside>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
