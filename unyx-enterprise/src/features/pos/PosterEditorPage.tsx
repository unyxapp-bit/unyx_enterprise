import {
  Download,
  Eye,
  EyeOff,
  FileImage,
  Palette,
  RotateCcw,
  Type,
  Upload,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import type { ChangeEvent, PointerEvent as ReactPointerEvent } from "react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"

const FIELD_KEYS = [
  "produto",
  "descricao",
  "preco_reais",
  "preco_centavos",
  "unidade",
  "validade",
  "observacao",
] as const

type PosterFieldKey = (typeof FIELD_KEYS)[number]
type EditorTab = "fields" | "style"
type FontWeight = "400" | "700" | "900"

type PosterFields = Record<PosterFieldKey, string>

type PosterFieldStyle = {
  x: number
  y: number
  fontSize: number
  color: string
  fontWeight: FontWeight
  stroke: string
  strokeWidth: number
  visible: boolean
}

type PosterStyles = Record<PosterFieldKey, PosterFieldStyle>

type PosterTemplate = {
  id: string
  name: string
  dataUrl: string
  width: number
  height: number
}

type PosterTemplateManifestItem = {
  file: string
  name?: string
}

type PosterTemplateManifest = {
  templates?: PosterTemplateManifestItem[]
}

const EXPECTED_TEMPLATE_NAMES = [
  "Aproveite Agora",
  "Aviso Importante",
  "Cartaz Oferta do Dia",
  "Cartaz Oferta",
  "Oferta 2",
  "Oferta Dia Tradicional",
  "Oferta",
  "Proximo Vencimento",
  "Super Oferta",
]

const DEFAULT_CANVAS = {
  width: 800,
  height: 1100,
}

const DEFAULT_FIELDS: PosterFields = {
  produto: "ARROZ TIPO 1",
  descricao: "PACOTE 5KG",
  preco_reais: "24",
  preco_centavos: "99",
  unidade: "UNID",
  validade: "OFERTA VALIDA ATE 25/05",
  observacao: "ENQUANTO DURAREM OS ESTOQUES",
}

const FIELD_META: Record<PosterFieldKey, { label: string; hint: string }> = {
  produto: { label: "Produto", hint: "Nome do produto" },
  descricao: { label: "Descricao", hint: "Ex: PACOTE 5KG" },
  preco_reais: { label: "R$ inteiro", hint: "Ex: 24" },
  preco_centavos: { label: "Centavos", hint: "Ex: 99" },
  unidade: { label: "Unidade", hint: "Ex: UNID / KG" },
  validade: { label: "Validade", hint: "Periodo da oferta" },
  observacao: { label: "Observacao", hint: "Rodape" },
}

const DEFAULT_STYLES: PosterStyles = {
  produto: {
    x: 50,
    y: 36,
    fontSize: 54,
    color: "#FFFFFF",
    fontWeight: "900",
    stroke: "#000000",
    strokeWidth: 2,
    visible: true,
  },
  descricao: {
    x: 50,
    y: 45,
    fontSize: 30,
    color: "#FFE000",
    fontWeight: "700",
    stroke: "#000000",
    strokeWidth: 1,
    visible: true,
  },
  preco_reais: {
    x: 36,
    y: 63,
    fontSize: 120,
    color: "#FFE000",
    fontWeight: "900",
    stroke: "#000000",
    strokeWidth: 3,
    visible: true,
  },
  preco_centavos: {
    x: 70,
    y: 55,
    fontSize: 54,
    color: "#FFFFFF",
    fontWeight: "900",
    stroke: "#000000",
    strokeWidth: 2,
    visible: true,
  },
  unidade: {
    x: 70,
    y: 65,
    fontSize: 26,
    color: "#FFFFFF",
    fontWeight: "700",
    stroke: "#000000",
    strokeWidth: 1,
    visible: true,
  },
  validade: {
    x: 50,
    y: 79,
    fontSize: 22,
    color: "#FFFFFF",
    fontWeight: "700",
    stroke: "#000000",
    strokeWidth: 1,
    visible: true,
  },
  observacao: {
    x: 50,
    y: 87,
    fontSize: 16,
    color: "#CCCCCC",
    fontWeight: "400",
    stroke: "none",
    strokeWidth: 0,
    visible: true,
  },
}

function cloneStyles(): PosterStyles {
  return FIELD_KEYS.reduce((styles, key) => {
    styles[key] = { ...DEFAULT_STYLES[key] }
    return styles
  }, {} as PosterStyles)
}

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function svgText(value: string, style: PosterFieldStyle, width: number, height: number) {
  if (!style.visible || !value) return ""

  const x = (style.x / 100) * width
  const y = (style.y / 100) * height
  const stroke =
    style.stroke !== "none" && style.strokeWidth > 0
      ? ` paint-order="stroke fill" stroke="${xmlEscape(style.stroke)}" stroke-width="${
          style.strokeWidth * 2
        }" stroke-linejoin="round"`
      : ""

  return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-family="'Arial Black', Impact, sans-serif" font-size="${
    style.fontSize
  }" font-weight="${style.fontWeight}" fill="${xmlEscape(
    style.color
  )}"${stroke}>${xmlEscape(value)}</text>`
}

function buildPosterSvg(
  templateDataUrl: string,
  fields: PosterFields,
  styles: PosterStyles,
  width: number,
  height: number
) {
  const template = `<image href="${xmlEscape(
    templateDataUrl
  )}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice"/>`
  const fieldsSvg = FIELD_KEYS.map((key) =>
    svgText(fields[key], styles[key], width, height)
  ).join("\n")

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
${template}
${fieldsSvg}
</svg>`
}

function readDimension(rawValue: string | null) {
  if (!rawValue) return null
  const value = Number.parseFloat(rawValue)
  return Number.isFinite(value) && value > 0 ? value : null
}

function readSvgSize(markup: string) {
  const document = new DOMParser().parseFromString(markup, "image/svg+xml")
  if (document.querySelector("parsererror")) {
    throw new Error("SVG invalido.")
  }

  const svg = document.documentElement
  if (svg.localName !== "svg") {
    throw new Error("Arquivo sem raiz SVG.")
  }

  const viewBox = svg
    .getAttribute("viewBox")
    ?.trim()
    .split(/[\s,]+/)
    .map(Number)

  if (
    viewBox?.length === 4 &&
    Number.isFinite(viewBox[2]) &&
    Number.isFinite(viewBox[3]) &&
    viewBox[2] > 0 &&
    viewBox[3] > 0
  ) {
    return {
      width: viewBox[2],
      height: viewBox[3],
    }
  }

  const width = readDimension(svg.getAttribute("width"))
  const height = readDimension(svg.getAttribute("height"))
  return width && height ? { width, height } : DEFAULT_CANVAS
}

function readFileDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error(`Falha ao ler ${file.name}.`))
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error(`Falha ao preparar ${file.name}.`))
        return
      }
      resolve(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

function cleanTemplateName(fileName: string) {
  return fileName.replace(/\.svg$/i, "").replace(/[_-]+/g, " ").trim()
}

function uploadTemplateId(fileName: string) {
  return `upload:${fileName.trim().toLocaleLowerCase()}`
}

async function templateFromFile(file: File): Promise<PosterTemplate> {
  const markup = await file.text()
  const size = readSvgSize(markup)

  return {
    id: uploadTemplateId(file.name),
    name: cleanTemplateName(file.name) || "Template SVG",
    dataUrl: await readFileDataUrl(file),
    ...size,
  }
}

function publicTemplateUrl(fileName: string) {
  const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "")
  return `${baseUrl}/templates/cartazes/${encodeURIComponent(fileName)}`
}

function publicTemplateId(fileName: string) {
  return `public:${fileName.trim().toLocaleLowerCase()}`
}

function readManifestItems(value: unknown): PosterTemplateManifestItem[] {
  const manifest = value as PosterTemplateManifest
  if (!Array.isArray(manifest.templates)) return []

  return manifest.templates.filter(
    (template): template is PosterTemplateManifestItem =>
      typeof template?.file === "string" &&
      template.file.trim().toLocaleLowerCase().endsWith(".svg")
  )
}

async function templateFromManifest(item: PosterTemplateManifestItem): Promise<PosterTemplate> {
  const response = await fetch(publicTemplateUrl(item.file))
  if (!response.ok) {
    throw new Error(`Template ${item.file} nao encontrado.`)
  }

  const markup = await response.text()
  const size = readSvgSize(markup)

  return {
    id: publicTemplateId(item.file),
    name: item.name?.trim() || cleanTemplateName(item.file) || "Template SVG",
    dataUrl: await readFileDataUrl(new File([markup], item.file, { type: "image/svg+xml" })),
    ...size,
  }
}

async function loadPublicTemplates() {
  const response = await fetch(publicTemplateUrl("manifest.json"))
  if (!response.ok) return []

  const items = readManifestItems(await response.json())
  if (items.length === 0) return []

  const results = await Promise.allSettled(items.map(templateFromManifest))
  const loaded = results.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : []
  )

  for (const result of results) {
    if (result.status === "rejected") {
      toast.error(result.reason instanceof Error ? result.reason.message : "Falha no template.")
    }
  }

  return loaded
}

function fileSegment(value: string) {
  const cleanValue = value
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[\\/:*?"<>|]+/g, "")
    .slice(0, 80)

  return cleanValue || "cartaz"
}

export function PosterEditorPage() {
  const [templates, setTemplates] = useState<PosterTemplate[]>([])
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null)
  const [fields, setFields] = useState<PosterFields>({ ...DEFAULT_FIELDS })
  const [stylesByTemplate, setStylesByTemplate] = useState<Record<string, PosterStyles>>({})
  const [selectedField, setSelectedField] = useState<PosterFieldKey>("produto")
  const [draggingField, setDraggingField] = useState<PosterFieldKey | null>(null)
  const [tab, setTab] = useState<EditorTab>("fields")
  const svgRef = useRef<SVGSVGElement | null>(null)
  const activeTemplate =
    templates.find((template) => template.id === activeTemplateId) ?? null
  const width = activeTemplate?.width ?? DEFAULT_CANVAS.width
  const height = activeTemplate?.height ?? DEFAULT_CANVAS.height
  const styles =
    (activeTemplate ? stylesByTemplate[activeTemplate.id] : null) ?? DEFAULT_STYLES
  const selectedStyle = styles[selectedField]
  const canEditStyle = Boolean(activeTemplate)

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? [])
    event.currentTarget.value = ""
    if (files.length === 0) return

    const results = await Promise.allSettled(files.map(templateFromFile))
    const uploaded = results.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : []
    )

    for (const result of results) {
      if (result.status === "rejected") {
        toast.error(result.reason instanceof Error ? result.reason.message : "Falha no upload.")
      }
    }

    if (uploaded.length === 0) return

    setTemplates((current) => {
      const next = [...current]
      for (const template of uploaded) {
        const currentIndex = next.findIndex((item) => item.id === template.id)
        if (currentIndex >= 0) {
          next[currentIndex] = template
          continue
        }
        next.push(template)
      }
      return next
    })
    setStylesByTemplate((current) => {
      const next = { ...current }
      for (const template of uploaded) {
        next[template.id] = next[template.id] ?? cloneStyles()
      }
      return next
    })
    setActiveTemplateId(uploaded.at(-1)?.id ?? null)
    toast.success(uploaded.length === 1 ? "Template carregado." : "Templates carregados.")
  }

  const updateStyle = <Key extends keyof PosterFieldStyle>(
    field: PosterFieldKey,
    key: Key,
    value: PosterFieldStyle[Key]
  ) => {
    if (!activeTemplate) return

    setStylesByTemplate((current) => ({
      ...current,
      [activeTemplate.id]: {
        ...(current[activeTemplate.id] ?? cloneStyles()),
        [field]: {
          ...(current[activeTemplate.id] ?? DEFAULT_STYLES)[field],
          [key]: value,
        },
      },
    }))
  }

  const resetStyles = () => {
    if (!activeTemplate) return
    setStylesByTemplate((current) => ({
      ...current,
      [activeTemplate.id]: cloneStyles(),
    }))
    toast.success("Estilos redefinidos.")
  }

  const handleDownload = () => {
    if (!activeTemplate) return

    const svg = buildPosterSvg(
      activeTemplate.dataUrl,
      fields,
      styles,
      activeTemplate.width,
      activeTemplate.height
    )
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }))
    const link = document.createElement("a")
    link.href = url
    link.download = `${fileSegment(activeTemplate.name)}_${fileSegment(fields.produto)}.svg`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    toast.success("Cartaz baixado.")
  }

  const getSvgPoint = (event: ReactPointerEvent<SVGSVGElement>) => {
    const svgNode = svgRef.current
    if (!svgNode) return null

    const rect = svgNode.getBoundingClientRect()
    if (!rect.width || !rect.height) return null

    return {
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    }
  }

  const handlePointerDown = (
    event: ReactPointerEvent<SVGTextElement>,
    field: PosterFieldKey
  ) => {
    if (!activeTemplate) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    setSelectedField(field)
    setDraggingField(field)
  }

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!activeTemplate || !draggingField) return

    const point = getSvgPoint(event)
    if (!point) return

    setStylesByTemplate((current) => {
      const currentStyles = current[activeTemplate.id] ?? cloneStyles()
      return {
        ...current,
        [activeTemplate.id]: {
          ...currentStyles,
          [draggingField]: {
            ...currentStyles[draggingField],
            x: Math.max(0, Math.min(100, point.x)),
            y: Math.max(0, Math.min(100, point.y)),
          },
        },
      }
    })
  }

  useEffect(() => {
    const handlePointerUp = () => setDraggingField(null)
    window.addEventListener("pointerup", handlePointerUp)
    window.addEventListener("pointercancel", handlePointerUp)
    return () => {
      window.removeEventListener("pointerup", handlePointerUp)
      window.removeEventListener("pointercancel", handlePointerUp)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    void loadPublicTemplates().then((loaded) => {
      if (cancelled || loaded.length === 0) return

      setTemplates((current) => {
        const next = [...current]
        for (const template of loaded) {
          if (!next.some((item) => item.id === template.id)) {
            next.push(template)
          }
        }
        return next
      })
      setStylesByTemplate((current) => {
        const next = { ...current }
        for (const template of loaded) {
          next[template.id] = next[template.id] ?? cloneStyles()
        }
        return next
      })
      setActiveTemplateId((current) => current ?? loaded[0]?.id ?? null)
    })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <>
      <input
        id="poster-template-upload"
        className="sr-only"
        type="file"
        accept=".svg,image/svg+xml"
        multiple
        onChange={(event) => void handleUpload(event)}
      />
      <PageHeader
        title="Cartaz Editor"
        description="Ofertas e avisos para loja."
        action={
          <>
            <Button asChild variant="outline">
              <label htmlFor="poster-template-upload" className="cursor-pointer">
                <Upload data-icon="inline-start" />
                Carregar SVG
              </label>
            </Button>
            <Button variant="outline" onClick={resetStyles} disabled={!activeTemplate}>
              <RotateCcw data-icon="inline-start" />
              Redefinir
            </Button>
            <Button onClick={handleDownload} disabled={!activeTemplate}>
              <Download data-icon="inline-start" />
              Baixar SVG
            </Button>
          </>
        }
      />

      <div className="p-4 md:p-6">
        <div className="grid min-h-[calc(100vh-11rem)] overflow-hidden rounded-lg border bg-slate-950 text-slate-100 shadow-sm lg:grid-cols-[13rem_minmax(0,1fr)_20rem]">
          <aside className="flex min-h-0 flex-col border-b border-slate-800 bg-slate-900/80 lg:border-b-0 lg:border-r">
            <div className="border-b border-slate-800 px-3 py-3">
              <p className="text-xs font-semibold uppercase text-slate-400">Templates</p>
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
              {templates.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-700 p-3 text-slate-400">
                  <FileImage className="mb-2 size-5" />
                  <p className="text-xs font-medium text-slate-300">Nenhum template</p>
                  <div className="mt-3 space-y-1">
                    {EXPECTED_TEMPLATE_NAMES.map((name) => (
                      <p
                        key={name}
                        className="truncate rounded bg-slate-800/70 px-1.5 py-1 text-[0.7rem]"
                      >
                        {name}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}

              {templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => setActiveTemplateId(template.id)}
                  className={`w-full overflow-hidden rounded-lg border p-1 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary ${
                    activeTemplateId === template.id
                      ? "border-primary bg-slate-800"
                      : "border-slate-800 bg-slate-900 hover:border-slate-600"
                  }`}
                >
                  <span className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-md bg-slate-950">
                    <img
                      src={template.dataUrl}
                      alt={template.name}
                      className="h-full w-full object-cover"
                    />
                  </span>
                  <span className="mt-1 block truncate px-1 text-xs text-slate-300">
                    {template.name}
                  </span>
                </button>
              ))}
            </div>
          </aside>

          <section className="flex min-h-[36rem] min-w-0 flex-col bg-slate-950 lg:min-h-0">
            <div className="flex min-h-12 items-center justify-between gap-3 border-b border-slate-800 px-4 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {activeTemplate?.name ?? "Preview"}
                </p>
                <p className="text-xs text-slate-500">
                  {Math.round(width)} x {Math.round(height)}
                </p>
              </div>
              <p className="truncate text-xs text-slate-400">{FIELD_META[selectedField].label}</p>
            </div>

            <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3 sm:p-6">
              <div
                className="relative h-full max-w-full overflow-hidden rounded-lg bg-slate-900 shadow-2xl"
                style={{ aspectRatio: `${width}/${height}` }}
              >
                <svg
                  ref={svgRef}
                  viewBox={`0 0 ${width} ${height}`}
                  className="h-full w-full select-none"
                  style={{ cursor: draggingField ? "grabbing" : "default", touchAction: "none" }}
                  onPointerMove={handlePointerMove}
                >
                  {activeTemplate ? (
                    <image
                      href={activeTemplate.dataUrl}
                      x="0"
                      y="0"
                      width={width}
                      height={height}
                      preserveAspectRatio="xMidYMid slice"
                    />
                  ) : (
                    <>
                      <rect width={width} height={height} fill="#111827" />
                      <text
                        x={width / 2}
                        y={height / 2}
                        textAnchor="middle"
                        fill="#475569"
                        fontFamily="Arial"
                        fontSize="28"
                      >
                        Nenhum template
                      </text>
                    </>
                  )}

                  {FIELD_KEYS.map((key) => {
                    const style = styles[key]
                    if (!style.visible || !fields[key]) return null

                    const x = (style.x / 100) * width
                    const y = (style.y / 100) * height
                    const isSelected = selectedField === key

                    return (
                      <g key={key}>
                        {isSelected ? (
                          <circle
                            cx={x}
                            cy={y}
                            r={10}
                            fill="rgba(239,68,68,0.35)"
                            stroke="#ef4444"
                            strokeWidth={2}
                          />
                        ) : null}
                        <text
                          x={x}
                          y={y}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fontFamily="'Arial Black', Impact, sans-serif"
                          fontSize={style.fontSize}
                          fontWeight={style.fontWeight}
                          fill={style.color}
                          stroke={style.stroke !== "none" ? style.stroke : undefined}
                          strokeWidth={
                            style.stroke !== "none" ? style.strokeWidth * 2 : undefined
                          }
                          paintOrder="stroke fill"
                          strokeLinejoin="round"
                          style={{ cursor: canEditStyle ? "grab" : "default", userSelect: "none" }}
                          onPointerDown={(event) => handlePointerDown(event, key)}
                        >
                          {fields[key]}
                        </text>
                        {isSelected ? (
                          <rect
                            x={x - 60}
                            y={y - style.fontSize * 0.7}
                            width={120}
                            height={style.fontSize * 1.4}
                            fill="none"
                            stroke="#ef4444"
                            strokeWidth={1.5}
                            strokeDasharray="4 3"
                            rx={4}
                            style={{ pointerEvents: "none" }}
                          />
                        ) : null}
                      </g>
                    )
                  })}
                </svg>
              </div>
            </div>
          </section>

          <aside className="flex min-h-0 flex-col border-t border-slate-800 bg-slate-900/80 lg:border-l lg:border-t-0">
            <div className="flex border-b border-slate-800">
              <button
                type="button"
                onClick={() => setTab("fields")}
                className={`flex h-11 flex-1 items-center justify-center gap-1.5 border-b-2 text-xs font-semibold uppercase transition-colors ${
                  tab === "fields"
                    ? "border-primary text-white"
                    : "border-transparent text-slate-500 hover:text-slate-300"
                }`}
              >
                <Type className="size-3.5" />
                Conteudo
              </button>
              <button
                type="button"
                onClick={() => setTab("style")}
                className={`flex h-11 flex-1 items-center justify-center gap-1.5 border-b-2 text-xs font-semibold uppercase transition-colors ${
                  tab === "style"
                    ? "border-primary text-white"
                    : "border-transparent text-slate-500 hover:text-slate-300"
                }`}
              >
                <Palette className="size-3.5" />
                Estilo
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
              {tab === "fields" ? (
                FIELD_KEYS.map((key) => (
                  <section
                    key={key}
                    className={`rounded-lg border p-2.5 transition-colors ${
                      selectedField === key
                        ? "border-primary bg-primary/10"
                        : "border-slate-800 bg-slate-900 hover:border-slate-700"
                    }`}
                  >
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedField(key)}
                        className="truncate text-xs font-semibold uppercase text-slate-300"
                      >
                        {FIELD_META[key].label}
                      </button>
                      <button
                        type="button"
                        title={styles[key].visible ? "Ocultar campo" : "Mostrar campo"}
                        aria-label={styles[key].visible ? "Ocultar campo" : "Mostrar campo"}
                        aria-pressed={styles[key].visible}
                        disabled={!canEditStyle}
                        onClick={() => updateStyle(key, "visible", !styles[key].visible)}
                        className="inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-slate-700 text-slate-300 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {styles[key].visible ? (
                          <Eye className="size-3.5" />
                        ) : (
                          <EyeOff className="size-3.5" />
                        )}
                      </button>
                    </div>
                    <input
                      value={fields[key]}
                      onFocus={() => setSelectedField(key)}
                      onChange={(event) =>
                        setFields((current) => ({
                          ...current,
                          [key]: event.target.value,
                        }))
                      }
                      placeholder={FIELD_META[key].hint}
                      className="h-8 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-primary focus:ring-2 focus:ring-primary/30"
                    />
                  </section>
                ))
              ) : (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {FIELD_KEYS.map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedField(key)}
                        className={`rounded-md px-2 py-1 text-xs transition-colors ${
                          selectedField === key
                            ? "bg-primary text-primary-foreground"
                            : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                        }`}
                      >
                        {FIELD_META[key].label}
                      </button>
                    ))}
                  </div>

                  <section className="space-y-3 rounded-lg border border-slate-800 bg-slate-900 p-3">
                    <p className="truncate text-xs font-semibold uppercase text-slate-300">
                      {FIELD_META[selectedField].label}
                    </p>

                    <label className="block text-xs text-slate-400">
                      Fonte
                      <span className="float-right text-white">{selectedStyle.fontSize}px</span>
                      <input
                        type="range"
                        min="8"
                        max="200"
                        value={selectedStyle.fontSize}
                        disabled={!canEditStyle}
                        onChange={(event) =>
                          updateStyle(selectedField, "fontSize", Number(event.target.value))
                        }
                        className="mt-1 block w-full accent-primary disabled:opacity-40"
                      />
                    </label>

                    <label className="block text-xs text-slate-400">
                      Posicao X
                      <span className="float-right text-white">{Math.round(selectedStyle.x)}%</span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={selectedStyle.x}
                        disabled={!canEditStyle}
                        onChange={(event) =>
                          updateStyle(selectedField, "x", Number(event.target.value))
                        }
                        className="mt-1 block w-full accent-primary disabled:opacity-40"
                      />
                    </label>

                    <label className="block text-xs text-slate-400">
                      Posicao Y
                      <span className="float-right text-white">{Math.round(selectedStyle.y)}%</span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={selectedStyle.y}
                        disabled={!canEditStyle}
                        onChange={(event) =>
                          updateStyle(selectedField, "y", Number(event.target.value))
                        }
                        className="mt-1 block w-full accent-primary disabled:opacity-40"
                      />
                    </label>

                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs text-slate-400">
                        Texto
                        <span className="mt-1 flex h-8 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950 px-1.5">
                          <input
                            type="color"
                            value={selectedStyle.color}
                            disabled={!canEditStyle}
                            onChange={(event) =>
                              updateStyle(selectedField, "color", event.target.value)
                            }
                            className="size-6 cursor-pointer border-0 bg-transparent disabled:opacity-40"
                          />
                          <span className="truncate text-[0.65rem] text-slate-300">
                            {selectedStyle.color}
                          </span>
                        </span>
                      </label>
                      <label className="text-xs text-slate-400">
                        Contorno
                        <span className="mt-1 flex h-8 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950 px-1.5">
                          <input
                            type="color"
                            value={
                              selectedStyle.stroke === "none"
                                ? "#000000"
                                : selectedStyle.stroke
                            }
                            disabled={!canEditStyle}
                            onChange={(event) =>
                              updateStyle(selectedField, "stroke", event.target.value)
                            }
                            className="size-6 cursor-pointer border-0 bg-transparent disabled:opacity-40"
                          />
                          <span className="truncate text-[0.65rem] text-slate-300">
                            {selectedStyle.stroke}
                          </span>
                        </span>
                      </label>
                    </div>

                    <label className="block text-xs text-slate-400">
                      Largura do contorno
                      <span className="float-right text-white">
                        {selectedStyle.strokeWidth}px
                      </span>
                      <input
                        type="range"
                        min="0"
                        max="6"
                        step="0.5"
                        value={selectedStyle.strokeWidth}
                        disabled={!canEditStyle}
                        onChange={(event) => {
                          const strokeWidth = Number(event.target.value)
                          updateStyle(selectedField, "strokeWidth", strokeWidth)
                          updateStyle(
                            selectedField,
                            "stroke",
                            strokeWidth === 0
                              ? "none"
                              : selectedStyle.stroke === "none"
                                ? "#000000"
                                : selectedStyle.stroke
                          )
                        }}
                        className="mt-1 block w-full accent-primary disabled:opacity-40"
                      />
                    </label>

                    <div>
                      <p className="mb-1 text-xs text-slate-400">Peso</p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(
                          [
                            ["400", "Normal"],
                            ["700", "Bold"],
                            ["900", "Black"],
                          ] satisfies Array<[FontWeight, string]>
                        ).map(([fontWeight, label]) => (
                          <button
                            key={fontWeight}
                            type="button"
                            disabled={!canEditStyle}
                            onClick={() =>
                              updateStyle(selectedField, "fontWeight", fontWeight)
                            }
                            className={`h-8 rounded-md text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                              selectedStyle.fontWeight === fontWeight
                                ? "bg-primary text-primary-foreground"
                                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <label className="flex items-center justify-between gap-2 text-xs text-slate-400">
                      Visivel
                      <input
                        type="checkbox"
                        checked={selectedStyle.visible}
                        disabled={!canEditStyle}
                        onChange={(event) =>
                          updateStyle(selectedField, "visible", event.target.checked)
                        }
                        className="size-4 accent-primary disabled:opacity-40"
                      />
                    </label>
                  </section>
                </>
              )}
            </div>
          </aside>
        </div>
      </div>
    </>
  )
}
