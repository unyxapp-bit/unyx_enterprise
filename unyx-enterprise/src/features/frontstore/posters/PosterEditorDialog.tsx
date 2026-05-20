import { useMemo, useState } from "react"
import type { FormEvent } from "react"
import {
  FileText,
  ImageIcon,
  LayoutTemplate,
  MapPin,
  Move,
  Palette,
  RotateCcw,
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
  const previewData = useMemo(() => formToCanvasData(form), [form])
  const selectedTemplate = posterTemplates.find((template) => template.key === form.template_key)

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar cartaz" : "Novo cartaz"}</DialogTitle>
        </DialogHeader>

        <form className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]" onSubmit={onSubmit}>
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
                    <Input
                      required
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

          <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
            <div className="rounded-xl border bg-white p-3 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <ImageIcon className="size-4" />
                  Previa
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    title="Resetar posicoes"
                    onClick={resetPositions}
                  >
                    <RotateCcw className="size-4" />
                  </Button>
                  <Badge variant="secondary">{formatLabel[form.format]}</Badge>
                </div>
              </div>
              <PosterPreviewEditor
                data={previewData}
                form={form}
                onPositionChange={updatePosition}
              />
              <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{selectedTemplate?.name ?? "Em branco"}</span>
                <span>{toneLabel[form.tone]}</span>
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
