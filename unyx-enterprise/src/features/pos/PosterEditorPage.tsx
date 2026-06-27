import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpToLine,
  Barcode,
  Bold,
  ChevronDown,
  ChevronUp,
  Download,
  Copy,
  Eye,
  EyeOff,
  FileDown,
  FileImage,
  Grid3X3,
  ImageDown,
  ImagePlus,
  Italic,
  Layers3,
  LoaderCircle,
  Lock,
  Maximize2,
  Move,
  Palette,
  Plus,
  Redo2,
  RotateCcw,
  Ruler,
  Save,
  Square,
  Star,
  Trash2,
  Type,
  Undo2,
  Unlock,
  Upload,
  ZoomIn,
  ZoomOut,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import type {
  ChangeEvent,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
} from "react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/PageHeader"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  createImagePdf,
  DEFAULT_DOCUMENT_SETTINGS,
  documentGeometry,
  logicalPxToPt,
  PAPER_SIZES_MM,
  ptToLogicalPx,
  rasterDimensions,
} from "@/features/pos/posterEditorCore"
import {
  barcodeDataUrl,
  createCustomElement,
  customElementSvg,
} from "@/features/pos/posterEditorElements"
import type {
  CustomElementKind,
  PosterCustomElement,
} from "@/features/pos/posterEditorElements"
import type {
  PosterDocumentSettings,
  PosterGeometry,
} from "@/features/pos/posterEditorCore"

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
type EditorTab = "fields" | "style" | "document" | "layers"
type FontWeight = "400" | "700" | "900"
type FontStyle = "normal" | "italic"
type TextAlign = "start" | "middle" | "end"

type PosterFields = Record<PosterFieldKey, string>

type PosterFieldStyle = {
  x: number
  y: number
  fontSize: number
  fontFamily: string
  color: string
  fontWeight: FontWeight
  fontStyle: FontStyle
  textAlign: TextAlign
  letterSpacing: number
  lineHeight: number
  maxWidth: number
  stroke: string
  strokeWidth: number
  shadowColor: string
  shadowBlur: number
  shadowX: number
  shadowY: number
  rotation: number
  opacity: number
  visible: boolean
  locked: boolean
}

type PosterStyles = Record<PosterFieldKey, PosterFieldStyle>
type EditorElementId = string

type ElementBounds = {
  id: EditorElementId
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
  locked: boolean
}

type ResizeCorner = "nw" | "ne" | "se" | "sw"
type TransformMode = "move" | "rotate" | ResizeCorner

type TransformSession = {
  mode: TransformMode
  startX: number
  startY: number
  primaryId: EditorElementId
  initial: Record<EditorElementId, ElementBounds>
  fieldStyles: Partial<Record<PosterFieldKey, PosterFieldStyle>>
  startAngle: number
}

type SmartGuides = { x?: number; y?: number }

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
  "Proximo Vencimento",
  "Super Dia",
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

const FONT_OPTIONS = [
  "Arial Black",
  "Arial",
  "Verdana",
  "Georgia",
  "Impact",
] as const

const BRAND_COLORS = [
  "#FFFFFF",
  "#111827",
  "#FFE000",
  "#EF4444",
  "#16A34A",
  "#2563EB",
  "#7C3AED",
  "#F97316",
]

const COMMON_TEXT_STYLE = {
  fontFamily: "Arial Black",
  fontStyle: "normal" as FontStyle,
  textAlign: "middle" as TextAlign,
  letterSpacing: 0,
  lineHeight: 1.1,
  maxWidth: 90,
  shadowColor: "#000000",
  shadowBlur: 0,
  shadowX: 0,
  shadowY: 0,
  rotation: 0,
  opacity: 1,
  locked: false,
}

const DEFAULT_STYLES: PosterStyles = {
  produto: {
    ...COMMON_TEXT_STYLE,
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
    ...COMMON_TEXT_STYLE,
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
    ...COMMON_TEXT_STYLE,
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
    ...COMMON_TEXT_STYLE,
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
    ...COMMON_TEXT_STYLE,
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
    ...COMMON_TEXT_STYLE,
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
    ...COMMON_TEXT_STYLE,
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

function normalizeStylesByTemplate(
  value: Record<string, PosterStyles> | undefined
): Record<string, PosterStyles> {
  if (!value) return {}
  return Object.fromEntries(
    Object.entries(value).map(([templateId, templateStyles]) => [
      templateId,
      FIELD_KEYS.reduce((next, field) => {
        next[field] = { ...DEFAULT_STYLES[field], ...templateStyles?.[field] }
        return next
      }, {} as PosterStyles),
    ])
  )
}

function isPosterFieldKey(value: string): value is PosterFieldKey {
  return FIELD_KEYS.includes(value as PosterFieldKey)
}

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function estimatedTextWidth(value: string, fontSize: number, letterSpacing: number) {
  const characterCount = Math.max(1, Array.from(value).length)
  return characterCount * fontSize * 0.58 + Math.max(0, characterCount - 1) * letterSpacing
}

function textLayout(value: string, style: PosterFieldStyle, canvasWidth: number) {
  const anchorAvailableWidth =
    style.textAlign === "start"
      ? ((100 - style.x) / 100) * canvasWidth - 12
      : style.textAlign === "end"
        ? (style.x / 100) * canvasWidth - 12
        : (Math.min(style.x, 100 - style.x) / 100) * canvasWidth * 2 - 20
  const maximumWidth = Math.max(
    canvasWidth * 0.08,
    Math.min((style.maxWidth / 100) * canvasWidth, anchorAvailableWidth)
  )
  const words = value.replace(/\r/g, "").split(/(\s+|\n)/).filter(Boolean)
  const longestWordWidth = words.reduce(
    (maximum, word) =>
      Math.max(maximum, estimatedTextWidth(word.trim(), style.fontSize, style.letterSpacing)),
    0
  )
  const scale = longestWordWidth > maximumWidth ? maximumWidth / longestWordWidth : 1
  const fontSize = Math.max(8, style.fontSize * scale)
  const lines: string[] = []
  let currentLine = ""

  for (const token of words) {
    if (token === "\n" || token.includes("\n")) {
      if (currentLine.trim()) lines.push(currentLine.trim())
      currentLine = ""
      continue
    }
    const candidate = `${currentLine}${token}`.trim()
    if (
      currentLine &&
      estimatedTextWidth(candidate, fontSize, style.letterSpacing) > maximumWidth
    ) {
      lines.push(currentLine.trim())
      currentLine = token.trimStart()
    } else {
      currentLine += token
    }
  }
  if (currentLine.trim()) lines.push(currentLine.trim())
  if (lines.length === 0) lines.push("")

  const lineHeight = fontSize * style.lineHeight
  const width = Math.min(
    maximumWidth,
    lines.reduce(
      (maximum, line) =>
        Math.max(maximum, estimatedTextWidth(line, fontSize, style.letterSpacing)),
      0
    )
  )

  return {
    fontSize,
    lines,
    lineHeight,
    width,
    height: Math.max(fontSize * 1.35, lineHeight * lines.length),
  }
}

function svgText(
  field: PosterFieldKey,
  value: string,
  style: PosterFieldStyle,
  width: number,
  height: number
) {
  if (!style.visible || !value) return ""

  const x = (style.x / 100) * width
  const y = (style.y / 100) * height
  const layout = textLayout(value, style, width)
  const firstLineY = y - ((layout.lines.length - 1) * layout.lineHeight) / 2
  const stroke =
    style.stroke !== "none" && style.strokeWidth > 0
      ? ` paint-order="stroke fill" stroke="${xmlEscape(style.stroke)}" stroke-width="${
          style.strokeWidth
        }" stroke-linejoin="round"`
      : ""

  const tspans = layout.lines
    .map(
      (line, index) =>
        `<tspan x="${x}" y="${firstLineY + index * layout.lineHeight}">${xmlEscape(
          line
        )}</tspan>`
    )
    .join("")
  const shared = `text-anchor="${style.textAlign}" dominant-baseline="middle" font-family="${xmlEscape(
    style.fontFamily
  )}" font-size="${layout.fontSize}" font-weight="${style.fontWeight}" font-style="${
    style.fontStyle
  }" letter-spacing="${style.letterSpacing}"`
  const shadow =
    style.shadowBlur > 0 || style.shadowX !== 0 || style.shadowY !== 0
      ? `<text ${shared} fill="${xmlEscape(style.shadowColor)}" opacity="0.65" transform="translate(${
          style.shadowX
        } ${style.shadowY})" filter="url(#shadow-${field})">${tspans}</text>`
      : ""

  return `<g transform="rotate(${style.rotation} ${x} ${y})" opacity="${style.opacity}">${shadow}<text ${shared} fill="${xmlEscape(style.color)}"${stroke}>${tspans}</text></g>`
}

function buildPosterSvg(
  templateDataUrl: string,
  fields: PosterFields,
  styles: PosterStyles,
  customElements: PosterCustomElement[],
  layerOrder: EditorElementId[],
  geometry: PosterGeometry,
  settings: PosterDocumentSettings
) {
  const width = geometry.logicalWidth
  const height = geometry.logicalHeight
  const preserveAspectRatio =
    settings.backgroundFit === "stretch"
      ? "none"
      : settings.backgroundFit === "contain"
        ? "xMidYMid meet"
        : "xMidYMid slice"
  const backgroundScale = settings.backgroundScale ?? 1
  const backgroundWidth = width * backgroundScale
  const backgroundHeight = height * backgroundScale
  const backgroundX = (width - backgroundWidth) / 2 + ((settings.backgroundOffsetX ?? 0) / 100) * width
  const backgroundY = (height - backgroundHeight) / 2 + ((settings.backgroundOffsetY ?? 0) / 100) * height
  const template = `<image href="${xmlEscape(
    templateDataUrl
  )}" x="${backgroundX}" y="${backgroundY}" width="${backgroundWidth}" height="${backgroundHeight}" preserveAspectRatio="${preserveAspectRatio}" opacity="${settings.backgroundOpacity ?? 1}" filter="url(#background-controls)"/>`
  const filters = layerOrder
    .filter(isPosterFieldKey)
    .filter((key) => {
      const style = styles[key]
      return style.shadowBlur > 0 || style.shadowX !== 0 || style.shadowY !== 0
    })
    .map(
      (key) =>
        `<filter id="shadow-${key}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${
          styles[key].shadowBlur
        }"/></filter>`
    )
    .join("")
  const elementsSvg = layerOrder
    .map((id) => {
      if (isPosterFieldKey(id)) return svgText(id, fields[id], styles[id], width, height)
      const customElement = customElements.find((element) => element.id === id)
      return customElement ? customElementSvg(customElement, width, height) : ""
    })
    .join("\n")
  const cropLength = Math.max(1, geometry.mmToLogical * Math.min(2.5, settings.bleedMm))
  const cropMarks = settings.includeCropMarks
    ? [
        [geometry.trimX - cropLength, geometry.trimY, geometry.trimX, geometry.trimY],
        [geometry.trimX, geometry.trimY - cropLength, geometry.trimX, geometry.trimY],
        [geometry.trimX + geometry.trimWidth, geometry.trimY, geometry.trimX + geometry.trimWidth + cropLength, geometry.trimY],
        [geometry.trimX + geometry.trimWidth, geometry.trimY - cropLength, geometry.trimX + geometry.trimWidth, geometry.trimY],
        [geometry.trimX - cropLength, geometry.trimY + geometry.trimHeight, geometry.trimX, geometry.trimY + geometry.trimHeight],
        [geometry.trimX, geometry.trimY + geometry.trimHeight, geometry.trimX, geometry.trimY + geometry.trimHeight + cropLength],
        [geometry.trimX + geometry.trimWidth, geometry.trimY + geometry.trimHeight, geometry.trimX + geometry.trimWidth + cropLength, geometry.trimY + geometry.trimHeight],
        [geometry.trimX + geometry.trimWidth, geometry.trimY + geometry.trimHeight, geometry.trimX + geometry.trimWidth, geometry.trimY + geometry.trimHeight + cropLength],
      ]
        .map(
          ([x1, y1, x2, y2]) =>
            `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#111827" stroke-width="1"/>`
        )
        .join("")
    : ""

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
<defs>
${filters}
<filter id="background-controls" color-interpolation-filters="sRGB">
  <feComponentTransfer result="contrast">
    <feFuncR type="linear" slope="${settings.backgroundContrast ?? 1}" intercept="${0.5 - 0.5 * (settings.backgroundContrast ?? 1)}"/>
    <feFuncG type="linear" slope="${settings.backgroundContrast ?? 1}" intercept="${0.5 - 0.5 * (settings.backgroundContrast ?? 1)}"/>
    <feFuncB type="linear" slope="${settings.backgroundContrast ?? 1}" intercept="${0.5 - 0.5 * (settings.backgroundContrast ?? 1)}"/>
  </feComponentTransfer>
  <feComponentTransfer in="contrast">
    <feFuncR type="linear" slope="${settings.backgroundBrightness ?? 1}"/>
    <feFuncG type="linear" slope="${settings.backgroundBrightness ?? 1}"/>
    <feFuncB type="linear" slope="${settings.backgroundBrightness ?? 1}"/>
  </feComponentTransfer>
</filter>
</defs>
${template}
${elementsSvg}
${cropMarks}
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

function readImageSize(dataUrl: string, fileName: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      if (!image.naturalWidth || !image.naturalHeight) {
        reject(new Error(`Imagem ${fileName} sem dimensoes validas.`))
        return
      }
      resolve({ width: image.naturalWidth, height: image.naturalHeight })
    }
    image.onerror = () => reject(new Error(`Falha ao abrir ${fileName}.`))
    image.src = dataUrl
  })
}

function cleanTemplateName(fileName: string) {
  return fileName.replace(/\.(svg|png|jpe?g|webp)$/i, "").replace(/[_-]+/g, " ").trim()
}

function uploadTemplateId(fileName: string) {
  return `upload:${fileName.trim().toLocaleLowerCase()}`
}

async function templateFromFile(file: File): Promise<PosterTemplate> {
  const normalizedName = file.name.trim().toLocaleLowerCase()
  const isSvg = normalizedName.endsWith(".svg")
  const isPng = normalizedName.endsWith(".png")
  if (!isSvg && !isPng) {
    throw new Error(`Formato de ${file.name} nao suportado.`)
  }

  const dataUrl = await readFileDataUrl(file)
  const size = isSvg
    ? readSvgSize(await file.text())
    : await readImageSize(dataUrl, file.name)

  return {
    id: uploadTemplateId(file.name),
    name: cleanTemplateName(file.name) || "Template",
    dataUrl,
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
      /\.(svg|png)$/i.test(template.file.trim())
  )
}

async function templateFromManifest(item: PosterTemplateManifestItem): Promise<PosterTemplate> {
  const response = await fetch(publicTemplateUrl(item.file))
  if (!response.ok) {
    throw new Error(`Template ${item.file} nao encontrado.`)
  }

  const blob = await response.blob()
  const loaded = await templateFromFile(
    new File([blob], item.file, { type: blob.type || undefined })
  )

  return {
    ...loaded,
    id: publicTemplateId(item.file),
    name: item.name?.trim() || cleanTemplateName(item.file) || "Template",
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

type PosterSnapshot = {
  fields: PosterFields
  stylesByTemplate: Record<string, PosterStyles>
  customElementsByTemplate: Record<string, PosterCustomElement[]>
  layerOrderByTemplate: Record<string, EditorElementId[]>
  documentSettings: PosterDocumentSettings
}

type SavedPosterVersion = {
  id: string
  createdAt: string
  snapshot: PosterSnapshot
}

const POSTER_DRAFT_STORAGE_KEY = "unyx-poster-editor-draft-v2"
const POSTER_VERSIONS_STORAGE_KEY = "unyx-poster-editor-versions-v2"

function readStoredValue<Value>(key: string): Value | null {
  try {
    const value = window.localStorage.getItem(key)
    return value ? (JSON.parse(value) as Value) : null
  } catch {
    return null
  }
}

function cloneSnapshot(snapshot: PosterSnapshot): PosterSnapshot {
  return structuredClone(snapshot)
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function imageFromUrl(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("Falha ao rasterizar o cartaz."))
    image.src = url
  })
}

async function rasterizeSvg(svgMarkup: string, width: number, height: number) {
  const url = URL.createObjectURL(new Blob([svgMarkup], { type: "image/svg+xml" }))
  try {
    const image = await imageFromUrl(url)
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext("2d")
    if (!context) throw new Error("Canvas indisponivel para exportacao.")
    context.fillStyle = "#ffffff"
    context.fillRect(0, 0, width, height)
    context.drawImage(image, 0, 0, width, height)
    return canvas
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function PosterEditorPage() {
  const [draftSeed] = useState(() =>
    readStoredValue<PosterSnapshot>(POSTER_DRAFT_STORAGE_KEY)
  )
  const [templates, setTemplates] = useState<PosterTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null)
  const [fields, setFields] = useState<PosterFields>(
    draftSeed?.fields ?? { ...DEFAULT_FIELDS }
  )
  const [stylesByTemplate, setStylesByTemplate] = useState<Record<string, PosterStyles>>(
    () => normalizeStylesByTemplate(draftSeed?.stylesByTemplate)
  )
  const [customElementsByTemplate, setCustomElementsByTemplate] = useState<
    Record<string, PosterCustomElement[]>
  >(draftSeed?.customElementsByTemplate ?? {})
  const [layerOrderByTemplate, setLayerOrderByTemplate] = useState<
    Record<string, EditorElementId[]>
  >(draftSeed?.layerOrderByTemplate ?? {})
  const [documentSettings, setDocumentSettings] = useState<PosterDocumentSettings>(
    { ...DEFAULT_DOCUMENT_SETTINGS, ...draftSeed?.documentSettings }
  )
  const [savedVersions, setSavedVersions] = useState<SavedPosterVersion[]>(
    () => readStoredValue<SavedPosterVersion[]>(POSTER_VERSIONS_STORAGE_KEY) ?? []
  )
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [historyState, setHistoryState] = useState({ undo: 0, redo: 0 })
  const [exporting, setExporting] = useState<"png" | "pdf" | null>(null)
  const [selectedField, setSelectedField] = useState<PosterFieldKey>("produto")
  const [selectedIds, setSelectedIds] = useState<EditorElementId[]>(["produto"])
  const [transforming, setTransforming] = useState(false)
  const [smartGuides, setSmartGuides] = useState<SmartGuides>({})
  const [copiedStyle, setCopiedStyle] = useState<PosterFieldStyle | null>(null)
  const [imageReplaceTargetId, setImageReplaceTargetId] = useState<string | null>(null)
  const [clipboardCount, setClipboardCount] = useState(0)
  const [spacePressed, setSpacePressed] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const [tab, setTab] = useState<EditorTab>("fields")
  const [zoomPercent, setZoomPercent] = useState(0)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const transformRef = useRef<TransformSession | null>(null)
  const panRef = useRef<{ clientX: number; clientY: number; scrollLeft: number; scrollTop: number } | null>(null)
  const clipboardRef = useRef<PosterCustomElement[]>([])
  const historyRef = useRef<PosterSnapshot[]>([])
  const futureRef = useRef<PosterSnapshot[]>([])
  const activeTemplate =
    templates.find((template) => template.id === activeTemplateId) ?? null
  const geometry = useMemo(
    () => documentGeometry(documentSettings, DEFAULT_CANVAS.width),
    [documentSettings]
  )
  const width = geometry.logicalWidth
  const height = geometry.logicalHeight
  const styles =
    (activeTemplate ? stylesByTemplate[activeTemplate.id] : null) ?? DEFAULT_STYLES
  const layerOrder =
    (activeTemplate ? layerOrderByTemplate[activeTemplate.id] : null) ?? [...FIELD_KEYS]
  const customElements = activeTemplate
    ? customElementsByTemplate[activeTemplate.id] ?? []
    : []
  const primarySelectedId = selectedIds.at(-1) ?? selectedField
  const selectedCustomElement = customElements.find(
    (element) => element.id === primarySelectedId
  ) ?? null
  const selectedStyle = styles[selectedField]
  const canEditStyle = Boolean(activeTemplate)
  const selectedTextLayout = textLayout(fields[selectedField], selectedStyle, width)
  const selectedHorizontalMargin = Math.min(
    49,
    (selectedTextLayout.width / width) * 50 + 1
  )
  const selectedVerticalMargin = Math.min(
    49,
    (selectedTextLayout.height / height) * 50 + 1
  )
  const outputSize = rasterDimensions(documentSettings)
  const backgroundAspectRatio =
    documentSettings.backgroundFit === "stretch"
      ? "none"
      : documentSettings.backgroundFit === "contain"
        ? "xMidYMid meet"
        : "xMidYMid slice"
  const backgroundWidth = width * documentSettings.backgroundScale
  const backgroundHeight = height * documentSettings.backgroundScale
  const backgroundX =
    (width - backgroundWidth) / 2 + (documentSettings.backgroundOffsetX / 100) * width
  const backgroundY =
    (height - backgroundHeight) / 2 + (documentSettings.backgroundOffsetY / 100) * height
  const gridWidth = 5 * geometry.mmToLogical
  const gridHeight = 5 * geometry.mmToLogical
  const selectedFontPt = Math.max(1, Math.round(logicalPxToPt(selectedStyle.fontSize, geometry)))
  const lowResolution = Boolean(
    activeTemplate &&
      (activeTemplate.width < outputSize.width * 0.8 ||
        activeTemplate.height < outputSize.height * 0.8)
  )
  const allElementBounds = layerOrder.flatMap((id): ElementBounds[] => {
    if (isPosterFieldKey(id)) {
      const style = styles[id]
      const layout = textLayout(fields[id], style, width)
      return [{
        id,
        x: style.x,
        y: style.y,
        width: Math.max(1, (layout.width / width) * 100),
        height: Math.max(1, (layout.height / height) * 100),
        rotation: style.rotation,
        opacity: style.opacity,
        locked: style.locked,
      }]
    }
    const custom = customElements.find((element) => element.id === id)
    return custom
      ? [{
          id,
          x: custom.x,
          y: custom.y,
          width: custom.width,
          height: custom.height,
          rotation: custom.rotation,
          opacity: custom.opacity,
          locked: custom.locked,
        }]
      : []
  })
  const primaryBounds = allElementBounds.find((bounds) => bounds.id === primarySelectedId) ?? null
  const selectedBounds = allElementBounds.filter((bounds) => selectedIds.includes(bounds.id))
  const selectionGroupBounds = selectedBounds.length
    ? {
        left: Math.min(...selectedBounds.map((bounds) => bounds.x - bounds.width / 2)),
        right: Math.max(...selectedBounds.map((bounds) => bounds.x + bounds.width / 2)),
        top: Math.min(...selectedBounds.map((bounds) => bounds.y - bounds.height / 2)),
        bottom: Math.max(...selectedBounds.map((bounds) => bounds.y + bounds.height / 2)),
      }
    : null

  const currentSnapshot = (): PosterSnapshot => ({
    fields: { ...fields },
    stylesByTemplate: structuredClone(stylesByTemplate),
    customElementsByTemplate: structuredClone(customElementsByTemplate),
    layerOrderByTemplate: structuredClone(layerOrderByTemplate),
    documentSettings: { ...documentSettings },
  })

  const checkpoint = () => {
    historyRef.current = [...historyRef.current.slice(-39), cloneSnapshot(currentSnapshot())]
    futureRef.current = []
    setHistoryState({ undo: historyRef.current.length, redo: 0 })
  }

  const restoreSnapshot = (snapshot: PosterSnapshot) => {
    setFields({ ...snapshot.fields })
    setStylesByTemplate(normalizeStylesByTemplate(snapshot.stylesByTemplate))
    setCustomElementsByTemplate(structuredClone(snapshot.customElementsByTemplate ?? {}))
    setLayerOrderByTemplate(structuredClone(snapshot.layerOrderByTemplate))
    setDocumentSettings({ ...DEFAULT_DOCUMENT_SETTINGS, ...snapshot.documentSettings })
    transformRef.current = null
    setTransforming(false)
    setSmartGuides({})
  }

  const undo = () => {
    const previous = historyRef.current.at(-1)
    if (!previous) return
    futureRef.current = [cloneSnapshot(currentSnapshot()), ...futureRef.current].slice(0, 40)
    historyRef.current = historyRef.current.slice(0, -1)
    restoreSnapshot(previous)
    setHistoryState({ undo: historyRef.current.length, redo: futureRef.current.length })
  }

  const redo = () => {
    const next = futureRef.current[0]
    if (!next) return
    historyRef.current = [...historyRef.current.slice(-39), cloneSnapshot(currentSnapshot())]
    futureRef.current = futureRef.current.slice(1)
    restoreSnapshot(next)
    setHistoryState({ undo: historyRef.current.length, redo: futureRef.current.length })
  }

  const selectTemplate = (templateId: string) => {
    setActiveTemplateId(templateId)
    setZoomPercent(0)
    setSelectedIds(["produto"])
    setSelectedField("produto")
    transformRef.current = null
    setTransforming(false)
  }

  const zoomIn = () => {
    setZoomPercent((current) => (current === 0 ? 60 : Math.min(240, current + 10)))
  }

  const zoomOut = () => {
    setZoomPercent((current) => (current === 0 ? 40 : Math.max(20, current - 10)))
  }

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
    setLayerOrderByTemplate((current) => {
      const next = { ...current }
      for (const template of uploaded) {
        next[template.id] = next[template.id] ?? [...FIELD_KEYS]
      }
      return next
    })
    setCustomElementsByTemplate((current) => {
      const next = { ...current }
      for (const template of uploaded) {
        next[template.id] = next[template.id] ?? []
      }
      return next
    })
    const latestTemplateId = uploaded.at(-1)?.id
    if (latestTemplateId) selectTemplate(latestTemplateId)
    toast.success(uploaded.length === 1 ? "Template carregado." : "Templates carregados.")
  }

  const updateStyle = <Key extends keyof PosterFieldStyle>(
    field: PosterFieldKey,
    key: Key,
    value: PosterFieldStyle[Key],
    recordHistory = true
  ) => {
    if (!activeTemplate) return
    if (recordHistory) checkpoint()

    setStylesByTemplate((current) => {
      const templateStyles = current[activeTemplate.id] ?? cloneStyles()
      const nextFieldStyle = {
        ...templateStyles[field],
        [key]: value,
      }
      const layout = textLayout(fields[field], nextFieldStyle, width)
      const horizontalMargin = Math.min(
        49,
        (layout.width / width) * 50 + 1
      )
      const verticalMargin = Math.min(
        49,
        (layout.height / height) * 50 + 1
      )

      nextFieldStyle.x = Math.max(
        horizontalMargin,
        Math.min(100 - horizontalMargin, nextFieldStyle.x)
      )
      nextFieldStyle.y = Math.max(
        verticalMargin,
        Math.min(100 - verticalMargin, nextFieldStyle.y)
      )

      return {
        ...current,
        [activeTemplate.id]: {
          ...templateStyles,
          [field]: nextFieldStyle,
        },
      }
    })
  }

  const updateCustomElement = (
    elementId: string,
    patch: Partial<PosterCustomElement>,
    recordHistory = true
  ) => {
    if (!activeTemplate) return
    if (recordHistory) checkpoint()
    setCustomElementsByTemplate((current) => ({
      ...current,
      [activeTemplate.id]: (current[activeTemplate.id] ?? []).map((element) =>
        element.id === elementId ? { ...element, ...patch, id: element.id } : element
      ),
    }))
  }

  const getInsertionPoint = (widthPercent: number, heightPercent: number) => {
    const viewport = viewportRef.current
    const svg = svgRef.current
    const visibleCenter =
      viewport && svg
        ? getSvgPoint(
            viewport.getBoundingClientRect().left + viewport.getBoundingClientRect().width / 2,
            viewport.getBoundingClientRect().top + viewport.getBoundingClientRect().height / 2
          )
        : null
    const offset = (customElements.length % 4) * 2
    const x = Math.max(
      widthPercent / 2,
      Math.min(100 - widthPercent / 2, (visibleCenter?.x ?? 50) + offset)
    )
    const y = Math.max(
      heightPercent / 2,
      Math.min(100 - heightPercent / 2, (visibleCenter?.y ?? 50) + offset)
    )
    return { x, y }
  }

  const addCustomElement = (
    kind: CustomElementKind,
    overrides: Partial<Omit<PosterCustomElement, "id" | "kind">> = {}
  ) => {
    if (!activeTemplate) return null
    checkpoint()
    const preview = createCustomElement(kind, overrides)
    const placement = getInsertionPoint(preview.width, preview.height)
    const element = createCustomElement(kind, {
      ...overrides,
      x: overrides.x ?? placement.x,
      y: overrides.y ?? placement.y,
    })
    setCustomElementsByTemplate((current) => ({
      ...current,
      [activeTemplate.id]: [...(current[activeTemplate.id] ?? []), element],
    }))
    setLayerOrderByTemplate((current) => ({
      ...current,
      [activeTemplate.id]: [...(current[activeTemplate.id] ?? FIELD_KEYS), element.id],
    }))
    setSelectedIds([element.id])
    setTab("layers")
    return element
  }

  const handleElementImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ""
    if (!file || !activeTemplate) return
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem valida.")
      return
    }
    try {
      const src = await readFileDataUrl(file)
      const size = await readImageSize(src, file.name)
      const elementWidth = 34
      const logicalImageWidth = (elementWidth / 100) * width
      const elementHeight = Math.min(
        70,
        ((logicalImageWidth * size.height) / size.width / height) * 100
      )
      if (imageReplaceTargetId) {
        updateCustomElement(imageReplaceTargetId, {
          name: cleanTemplateName(file.name) || "Imagem",
          src,
          width: elementWidth,
          height: Math.max(4, elementHeight),
        })
        setImageReplaceTargetId(null)
        toast.success("Imagem atualizada.")
      } else {
        addCustomElement("image", {
          name: cleanTemplateName(file.name) || "Imagem",
          src,
          width: elementWidth,
          height: Math.max(4, elementHeight),
        })
        toast.success("Imagem adicionada ao cartaz.")
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao adicionar imagem.")
    }
  }

  const fieldAsCustomElement = (field: PosterFieldKey) => {
    const fieldStyle = styles[field]
    const bounds = allElementBounds.find((item) => item.id === field)
    return createCustomElement("text", {
      name: `${FIELD_META[field].label} - copia`,
      value: fields[field],
      x: Math.min(96, fieldStyle.x + 2),
      y: Math.min(96, fieldStyle.y + 2),
      width: bounds?.width ?? 30,
      height: bounds?.height ?? 8,
      rotation: fieldStyle.rotation,
      opacity: fieldStyle.opacity,
      fontFamily: fieldStyle.fontFamily,
      fontSize: fieldStyle.fontSize,
      fontWeight: fieldStyle.fontWeight,
      fontStyle: fieldStyle.fontStyle,
      textAlign: fieldStyle.textAlign,
      color: fieldStyle.color,
      stroke: fieldStyle.stroke,
      strokeWidth: fieldStyle.strokeWidth,
      letterSpacing: fieldStyle.letterSpacing,
      lineHeight: fieldStyle.lineHeight,
    })
  }

  const customCopiesFromSelection = () =>
    selectedIds.flatMap((id) => {
      if (isPosterFieldKey(id)) return [fieldAsCustomElement(id)]
      const element = customElements.find((item) => item.id === id)
      return element ? [{ ...element }] : []
    })

  const appendCustomCopies = (copies: PosterCustomElement[]) => {
    if (!activeTemplate || copies.length === 0) return
    checkpoint()
    const next = copies.map((copy, index) => ({
      ...copy,
      id: `custom:${crypto.randomUUID()}`,
      name: `${copy.name} - copia`,
      x: Math.min(97, copy.x + 2 + index * 0.5),
      y: Math.min(97, copy.y + 2 + index * 0.5),
      locked: false,
    }))
    setCustomElementsByTemplate((current) => ({
      ...current,
      [activeTemplate.id]: [...(current[activeTemplate.id] ?? []), ...next],
    }))
    setLayerOrderByTemplate((current) => ({
      ...current,
      [activeTemplate.id]: [
        ...(current[activeTemplate.id] ?? FIELD_KEYS),
        ...next.map((element) => element.id),
      ],
    }))
    setSelectedIds(next.map((element) => element.id))
  }

  const duplicateSelected = () => appendCustomCopies(customCopiesFromSelection())

  const copySelected = () => {
    clipboardRef.current = customCopiesFromSelection()
    setClipboardCount(clipboardRef.current.length)
    if (clipboardRef.current.length > 0) toast.success("Elemento copiado.")
  }

  const pasteSelected = () => appendCustomCopies(clipboardRef.current)

  const deleteSelected = () => {
    if (!activeTemplate || selectedIds.length === 0) return
    checkpoint()
    const customIds = new Set(selectedIds.filter((id) => !isPosterFieldKey(id)))
    setCustomElementsByTemplate((current) => ({
      ...current,
      [activeTemplate.id]: (current[activeTemplate.id] ?? []).filter(
        (element) => !customIds.has(element.id)
      ),
    }))
    setLayerOrderByTemplate((current) => ({
      ...current,
      [activeTemplate.id]: (current[activeTemplate.id] ?? FIELD_KEYS).filter(
        (id) => !customIds.has(id)
      ),
    }))
    setStylesByTemplate((current) => {
      const templateStyles = current[activeTemplate.id] ?? cloneStyles()
      const next = structuredClone(templateStyles)
      selectedIds.filter(isPosterFieldKey).forEach((field) => {
        next[field].visible = false
      })
      return { ...current, [activeTemplate.id]: next }
    })
    setSelectedIds([])
  }

  const copySelectedStyle = () => {
    if (!isPosterFieldKey(primarySelectedId)) return
    setCopiedStyle({ ...styles[primarySelectedId] })
    toast.success("Estilo copiado.")
  }

  const pasteSelectedStyle = () => {
    if (!activeTemplate || !copiedStyle) return
    const targets = selectedIds.filter(isPosterFieldKey)
    if (targets.length === 0) return
    checkpoint()
    setStylesByTemplate((current) => {
      const templateStyles = current[activeTemplate.id] ?? cloneStyles()
      const next = structuredClone(templateStyles)
      targets.forEach((field) => {
        const { x, y, rotation, opacity, visible, locked } = next[field]
        next[field] = {
          ...copiedStyle,
          x,
          y,
          rotation,
          opacity,
          visible,
          locked,
        }
      })
      return { ...current, [activeTemplate.id]: next }
    })
    toast.success("Estilo aplicado.")
  }

  const resetStyles = () => {
    if (!activeTemplate) return
    checkpoint()
    setStylesByTemplate((current) => ({
      ...current,
      [activeTemplate.id]: cloneStyles(),
    }))
    setZoomPercent(0)
    transformRef.current = null
    setTransforming(false)
    toast.success("Estilos redefinidos.")
  }

  const posterFileName = () =>
    `${fileSegment(activeTemplate?.name ?? "cartaz")}_${fileSegment(fields.produto)}`

  const posterSvgMarkup = () => {
    if (!activeTemplate) return null
    return buildPosterSvg(
      activeTemplate.dataUrl,
      fields,
      styles,
      customElements,
      layerOrder,
      geometry,
      documentSettings
    )
  }

  const exportSvg = () => {
    const markup = posterSvgMarkup()
    if (!markup) return
    downloadBlob(new Blob([markup], { type: "image/svg+xml" }), `${posterFileName()}.svg`)
    toast.success("SVG exportado.")
  }

  const exportPng = async () => {
    const markup = posterSvgMarkup()
    if (!markup) return
    setExporting("png")
    try {
      const canvas = await rasterizeSvg(markup, outputSize.width, outputSize.height)
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (value) => (value ? resolve(value) : reject(new Error("Falha ao gerar PNG."))),
          "image/png"
        )
      )
      downloadBlob(blob, `${posterFileName()}.png`)
      toast.success(`PNG exportado em ${documentSettings.dpi} DPI.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao exportar PNG.")
    } finally {
      setExporting(null)
    }
  }

  const exportPdf = async () => {
    const markup = posterSvgMarkup()
    if (!markup) return
    setExporting("pdf")
    try {
      const canvas = await rasterizeSvg(markup, outputSize.width, outputSize.height)
      const pdf = createImagePdf({
        jpegDataUrl: canvas.toDataURL("image/jpeg", 0.96),
        imageWidth: outputSize.width,
        imageHeight: outputSize.height,
        pageWidthMm: geometry.totalWidthMm,
        pageHeightMm: geometry.totalHeightMm,
      })
      downloadBlob(pdf, `${posterFileName()}.pdf`)
      toast.success("PDF para impressao exportado.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao exportar PDF.")
    } finally {
      setExporting(null)
    }
  }

  const updateDocument = <Key extends keyof PosterDocumentSettings>(
    key: Key,
    value: PosterDocumentSettings[Key]
  ) => {
    checkpoint()
    setDocumentSettings((current) => ({ ...current, [key]: value }))
  }

  const updateLayerOrder = (elementId: EditorElementId, direction: -1 | 1) => {
    if (!activeTemplate) return
    const currentIndex = layerOrder.indexOf(elementId)
    const nextIndex = currentIndex + direction
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= layerOrder.length) return
    checkpoint()
    const next = [...layerOrder]
    ;[next[currentIndex], next[nextIndex]] = [next[nextIndex], next[currentIndex]]
    setLayerOrderByTemplate((current) => ({ ...current, [activeTemplate.id]: next }))
  }

  const saveVersion = () => {
    const version: SavedPosterVersion = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      snapshot: cloneSnapshot(currentSnapshot()),
    }
    const next = [version, ...savedVersions].slice(0, 10)
    setSavedVersions(next)
    window.localStorage.setItem(POSTER_VERSIONS_STORAGE_KEY, JSON.stringify(next))
    toast.success("Versao salva.")
  }

  const restoreVersion = (version: SavedPosterVersion) => {
    checkpoint()
    restoreSnapshot(cloneSnapshot(version.snapshot))
    toast.success("Versao restaurada.")
  }

  const getSvgPoint = (clientX: number, clientY: number) => {
    const svgNode = svgRef.current
    if (!svgNode) return null

    const rect = svgNode.getBoundingClientRect()
    if (!rect.width || !rect.height) return null

    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100,
    }
  }

  const applyElementBounds = (
    updates: Record<EditorElementId, Partial<ElementBounds>>,
    session: TransformSession | null = null
  ) => {
    if (!activeTemplate) return
    setStylesByTemplate((current) => {
      const templateStyles = current[activeTemplate.id] ?? cloneStyles()
      const next = structuredClone(templateStyles)
      Object.entries(updates).forEach(([id, patch]) => {
        if (!isPosterFieldKey(id)) return
        const baseBounds = session?.initial[id]
        const baseStyle = session?.fieldStyles[id]
        next[id] = {
          ...next[id],
          ...(patch.x === undefined ? {} : { x: patch.x }),
          ...(patch.y === undefined ? {} : { y: patch.y }),
          ...(patch.rotation === undefined ? {} : { rotation: patch.rotation }),
          ...(patch.opacity === undefined ? {} : { opacity: patch.opacity }),
        }
        if (baseBounds && baseStyle && (patch.width !== undefined || patch.height !== undefined)) {
          const widthScale = (patch.width ?? baseBounds.width) / baseBounds.width
          const heightScale = (patch.height ?? baseBounds.height) / baseBounds.height
          const fontScale = Math.max(0.08, heightScale)
          next[id].fontSize = Math.max(3, baseStyle.fontSize * fontScale)
          next[id].maxWidth = Math.max(
            5,
            Math.min(180, baseStyle.maxWidth * (widthScale / fontScale))
          )
        }
      })
      return { ...current, [activeTemplate.id]: next }
    })
    setCustomElementsByTemplate((current) => ({
      ...current,
      [activeTemplate.id]: (current[activeTemplate.id] ?? []).map((element) => {
        const patch = updates[element.id]
        return patch
          ? {
              ...element,
              ...(patch.x === undefined ? {} : { x: patch.x }),
              ...(patch.y === undefined ? {} : { y: patch.y }),
              ...(patch.width === undefined ? {} : { width: patch.width }),
              ...(patch.height === undefined ? {} : { height: patch.height }),
              ...(patch.rotation === undefined ? {} : { rotation: patch.rotation }),
              ...(patch.opacity === undefined ? {} : { opacity: patch.opacity }),
            }
          : element
      }),
    }))
  }

  const selectElement = (id: EditorElementId, additive = false) => {
    if (isPosterFieldKey(id)) setSelectedField(id)
    setSelectedIds((current) => {
      if (!additive) return current.includes(id) ? current : [id]
      return current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id]
    })
  }

  const startTransform = (
    event: ReactPointerEvent<SVGElement>,
    id: EditorElementId,
    mode: TransformMode
  ) => {
    if (spacePressed) return
    const additive = event.shiftKey || event.metaKey || event.ctrlKey
    const bounds = allElementBounds.find((item) => item.id === id)
    if (!activeTemplate || !bounds) return
    selectElement(id, additive)
    if (additive || bounds.locked) return

    const point = getSvgPoint(event.clientX, event.clientY)
    if (!point) return
    const activeIds = selectedIds.includes(id) ? selectedIds : [id]
    const initial = Object.fromEntries(
      allElementBounds
        .filter((item) => activeIds.includes(item.id) && !item.locked)
        .map((item) => [item.id, { ...item }])
    )
    if (Object.keys(initial).length === 0) return
    checkpoint()
    event.preventDefault()
    event.stopPropagation()
    svgRef.current?.focus()
    event.currentTarget.setPointerCapture(event.pointerId)
    transformRef.current = {
      mode,
      startX: point.x,
      startY: point.y,
      primaryId: id,
      initial,
      fieldStyles: Object.fromEntries(
        Object.keys(initial)
          .filter(isPosterFieldKey)
          .map((field) => [field, { ...styles[field] }])
      ),
      startAngle:
        Math.atan2(
          ((point.y - bounds.y) / 100) * height,
          ((point.x - bounds.x) / 100) * width
        ) * (180 / Math.PI),
    }
    setTransforming(true)
  }

  const snapMovement = (
    primary: ElementBounds,
    nextX: number,
    nextY: number,
    excludedIds: string[]
  ) => {
    const targetsX = [
      50,
      (geometry.safeX / width) * 100,
      ((geometry.safeX + geometry.safeWidth) / width) * 100,
    ]
    const targetsY = [
      50,
      (geometry.safeY / height) * 100,
      ((geometry.safeY + geometry.safeHeight) / height) * 100,
    ]
    allElementBounds
      .filter((bounds) => !excludedIds.includes(bounds.id))
      .forEach((bounds) => {
        targetsX.push(bounds.x, bounds.x - bounds.width / 2, bounds.x + bounds.width / 2)
        targetsY.push(bounds.y, bounds.y - bounds.height / 2, bounds.y + bounds.height / 2)
      })
    const movingX = [nextX, nextX - primary.width / 2, nextX + primary.width / 2]
    const movingY = [nextY, nextY - primary.height / 2, nextY + primary.height / 2]
    let correctionX = 0
    let correctionY = 0
    let bestX = 0.7
    let bestY = 0.7
    let guideX: number | undefined
    let guideY: number | undefined

    targetsX.forEach((target) => movingX.forEach((moving) => {
      const distance = Math.abs(target - moving)
      if (distance < bestX) {
        bestX = distance
        correctionX = target - moving
        guideX = target
      }
    }))
    targetsY.forEach((target) => movingY.forEach((moving) => {
      const distance = Math.abs(target - moving)
      if (distance < bestY) {
        bestY = distance
        correctionY = target - moving
        guideY = target
      }
    }))

    return { x: nextX + correctionX, y: nextY + correctionY, guideX, guideY }
  }

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const session = transformRef.current
    if (!activeTemplate || !session) return

    const point = getSvgPoint(event.clientX, event.clientY)
    if (!point) return
    const primary = session.initial[session.primaryId]
    if (!primary) return

    if (session.mode === "move") {
      let deltaX = point.x - session.startX
      let deltaY = point.y - session.startY
      const gridX = (5 / geometry.totalWidthMm) * 100
      const gridY = (5 / geometry.totalHeightMm) * 100
      if (documentSettings.snapToGrid) {
        deltaX = Math.round((primary.x + deltaX) / gridX) * gridX - primary.x
        deltaY = Math.round((primary.y + deltaY) / gridY) * gridY - primary.y
      }
      const snapped = snapMovement(
        primary,
        primary.x + deltaX,
        primary.y + deltaY,
        Object.keys(session.initial)
      )
      deltaX = snapped.x - primary.x
      deltaY = snapped.y - primary.y
      setSmartGuides({ x: snapped.guideX, y: snapped.guideY })
      const updates = Object.fromEntries(
        Object.values(session.initial).map((bounds) => [
          bounds.id,
          {
            x: Math.max(bounds.width / 2, Math.min(100 - bounds.width / 2, bounds.x + deltaX)),
            y: Math.max(bounds.height / 2, Math.min(100 - bounds.height / 2, bounds.y + deltaY)),
          },
        ])
      )
      applyElementBounds(updates, session)
      return
    }

    if (session.mode === "rotate") {
      const angle =
        Math.atan2(
          ((point.y - primary.y) / 100) * height,
          ((point.x - primary.x) / 100) * width
        ) * (180 / Math.PI)
      let rotation = primary.rotation + angle - session.startAngle
      const snapAngle = Math.round(rotation / 15) * 15
      if (event.shiftKey || Math.abs(rotation - snapAngle) < 2.5) rotation = snapAngle
      applyElementBounds({ [primary.id]: { rotation } }, session)
      return
    }

    const radians = (-primary.rotation * Math.PI) / 180
    const deltaLogicalX = ((point.x - primary.x) / 100) * width
    const deltaLogicalY = ((point.y - primary.y) / 100) * height
    const localPoint = {
      x:
        primary.x +
        ((deltaLogicalX * Math.cos(radians) - deltaLogicalY * Math.sin(radians)) /
          width) *
          100,
      y:
        primary.y +
        ((deltaLogicalX * Math.sin(radians) + deltaLogicalY * Math.cos(radians)) /
          height) *
          100,
    }
    const left = primary.x - primary.width / 2
    const right = primary.x + primary.width / 2
    const top = primary.y - primary.height / 2
    const bottom = primary.y + primary.height / 2
    let nextLeft = left
    let nextRight = right
    let nextTop = top
    let nextBottom = bottom
    if (session.mode.includes("w")) nextLeft = Math.min(localPoint.x, right - 1)
    if (session.mode.includes("e")) nextRight = Math.max(localPoint.x, left + 1)
    if (session.mode.includes("n")) nextTop = Math.min(localPoint.y, bottom - 1)
    if (session.mode.includes("s")) nextBottom = Math.max(localPoint.y, top + 1)
    let nextWidth = nextRight - nextLeft
    let nextHeight = nextBottom - nextTop
    if (event.shiftKey) {
      const aspect = primary.width / primary.height
      if (nextWidth / nextHeight > aspect) nextWidth = nextHeight * aspect
      else nextHeight = nextWidth / aspect
      if (session.mode.includes("w")) nextLeft = right - nextWidth
      else nextRight = left + nextWidth
      if (session.mode.includes("n")) nextTop = bottom - nextHeight
      else nextBottom = top + nextHeight
    }
    const localCenterX = (nextLeft + nextRight) / 2
    const localCenterY = (nextTop + nextBottom) / 2
    const centerOffsetX = ((localCenterX - primary.x) / 100) * width
    const centerOffsetY = ((localCenterY - primary.y) / 100) * height
    const forwardRadians = (primary.rotation * Math.PI) / 180
    const transformedCenterX =
      primary.x +
      ((centerOffsetX * Math.cos(forwardRadians) -
        centerOffsetY * Math.sin(forwardRadians)) /
        width) *
        100
    const transformedCenterY =
      primary.y +
      ((centerOffsetX * Math.sin(forwardRadians) +
        centerOffsetY * Math.cos(forwardRadians)) /
        height) *
        100
    applyElementBounds(
      {
        [primary.id]: {
          x: transformedCenterX,
          y: transformedCenterY,
          width: nextWidth,
          height: nextHeight,
        },
      },
      session
    )
  }

  const handleCanvasKeyDown = (event: ReactKeyboardEvent<SVGSVGElement>) => {
    const command = event.ctrlKey || event.metaKey
    if (command && event.key.toLowerCase() === "z") {
      event.preventDefault()
      if (event.shiftKey) redo()
      else undo()
      return
    }
    if (command && event.key.toLowerCase() === "y") {
      event.preventDefault()
      redo()
      return
    }
    if (command && event.key.toLowerCase() === "c") {
      event.preventDefault()
      copySelected()
      return
    }
    if (command && event.key.toLowerCase() === "v") {
      event.preventDefault()
      pasteSelected()
      return
    }
    if (command && event.key.toLowerCase() === "d") {
      event.preventDefault()
      duplicateSelected()
      return
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault()
      deleteSelected()
      return
    }
    if (event.key === " ") {
      event.preventDefault()
      setSpacePressed(true)
      return
    }
    if (!activeTemplate || !event.key.startsWith("Arrow") || selectedBounds.length === 0) return
    event.preventDefault()
    checkpoint()
    const distance = event.shiftKey ? 5 : 0.5
    const deltaX = event.key === "ArrowLeft" ? -distance : event.key === "ArrowRight" ? distance : 0
    const deltaY = event.key === "ArrowUp" ? -distance : event.key === "ArrowDown" ? distance : 0
    applyElementBounds(
      Object.fromEntries(
        selectedBounds
          .filter((bounds) => !bounds.locked)
          .map((bounds) => [bounds.id, { x: bounds.x + deltaX, y: bounds.y + deltaY }])
      )
    )
  }

  const alignSelectedElements = (
    alignment: "left" | "center-x" | "right" | "top" | "center-y" | "bottom"
  ) => {
    if (!selectionGroupBounds || selectedBounds.length === 0) return
    checkpoint()
    const safeLeft = (geometry.safeX / width) * 100
    const safeRight = ((geometry.safeX + geometry.safeWidth) / width) * 100
    const safeTop = (geometry.safeY / height) * 100
    const safeBottom = ((geometry.safeY + geometry.safeHeight) / height) * 100
    const updates: Record<string, Partial<ElementBounds>> = {}
    selectedBounds.filter((bounds) => !bounds.locked).forEach((bounds) => {
      if (alignment === "left") {
        const target = selectedBounds.length === 1 ? safeLeft : selectionGroupBounds.left
        updates[bounds.id] = { x: target + bounds.width / 2 }
      } else if (alignment === "center-x") {
        const target = selectedBounds.length === 1
          ? 50
          : (selectionGroupBounds.left + selectionGroupBounds.right) / 2
        updates[bounds.id] = { x: target }
      } else if (alignment === "right") {
        const target = selectedBounds.length === 1 ? safeRight : selectionGroupBounds.right
        updates[bounds.id] = { x: target - bounds.width / 2 }
      } else if (alignment === "top") {
        const target = selectedBounds.length === 1 ? safeTop : selectionGroupBounds.top
        updates[bounds.id] = { y: target + bounds.height / 2 }
      } else if (alignment === "center-y") {
        const target = selectedBounds.length === 1
          ? 50
          : (selectionGroupBounds.top + selectionGroupBounds.bottom) / 2
        updates[bounds.id] = { y: target }
      } else {
        const target = selectedBounds.length === 1 ? safeBottom : selectionGroupBounds.bottom
        updates[bounds.id] = { y: target - bounds.height / 2 }
      }
    })
    applyElementBounds(updates)
  }

  const distributeSelectedElements = (axis: "horizontal" | "vertical") => {
    if (selectedBounds.length < 3) return
    checkpoint()
    const sorted = [...selectedBounds].sort((a, b) =>
      axis === "horizontal" ? a.x - b.x : a.y - b.y
    )
    const start = axis === "horizontal" ? sorted[0].x : sorted[0].y
    const end = axis === "horizontal" ? sorted.at(-1)?.x ?? start : sorted.at(-1)?.y ?? start
    const interval = (end - start) / (sorted.length - 1)
    applyElementBounds(
      Object.fromEntries(
        sorted.map((bounds, index) => [
          bounds.id,
          axis === "horizontal"
            ? { x: start + interval * index }
            : { y: start + interval * index },
        ])
      )
    )
  }

  const centerSelectionOnCanvas = () => {
    if (!selectionGroupBounds) return
    checkpoint()
    const groupCenterX = (selectionGroupBounds.left + selectionGroupBounds.right) / 2
    const groupCenterY = (selectionGroupBounds.top + selectionGroupBounds.bottom) / 2
    applyElementBounds(
      Object.fromEntries(
        selectedBounds.map((bounds) => [
          bounds.id,
          { x: bounds.x + 50 - groupCenterX, y: bounds.y + 50 - groupCenterY },
        ])
      )
    )
  }

  const updatePrimaryTransform = (
    key: "x" | "y" | "width" | "height" | "rotation" | "opacity",
    value: number
  ) => {
    if (!primaryBounds || primaryBounds.locked) return
    const normalizedValue =
      key === "x"
        ? Math.max(primaryBounds.width / 2, Math.min(100 - primaryBounds.width / 2, value))
        : key === "y"
          ? Math.max(primaryBounds.height / 2, Math.min(100 - primaryBounds.height / 2, value))
          : key === "width" || key === "height"
            ? Math.max(1, Math.min(100, value))
            : key === "opacity"
              ? Math.max(0, Math.min(1, value))
              : Math.max(-180, Math.min(180, value))
    checkpoint()
    const session: TransformSession = {
      mode: "se",
      startX: 0,
      startY: 0,
      primaryId: primaryBounds.id,
      initial: { [primaryBounds.id]: primaryBounds },
      fieldStyles: isPosterFieldKey(primaryBounds.id)
        ? { [primaryBounds.id]: { ...styles[primaryBounds.id] } }
        : {},
      startAngle: 0,
    }
    applyElementBounds({ [primaryBounds.id]: { [key]: normalizedValue } }, session)
  }

  const handleViewportPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current
    if (!viewport || (!spacePressed && event.button !== 1)) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    panRef.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
    }
    setIsPanning(true)
  }

  const handleViewportPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current
    const pan = panRef.current
    if (!viewport || !pan) return
    viewport.scrollLeft = pan.scrollLeft - (event.clientX - pan.clientX)
    viewport.scrollTop = pan.scrollTop - (event.clientY - pan.clientY)
  }

  const stopPanning = () => {
    panRef.current = null
    setIsPanning(false)
  }

  const handleViewportWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey && !event.metaKey) return
    event.preventDefault()
    const viewport = viewportRef.current
    const svg = svgRef.current
    if (!viewport || !svg) return
    const svgRect = svg.getBoundingClientRect()
    const currentZoom = zoomPercent || (svgRect.width / width) * 100
    const nextZoom = Math.max(20, Math.min(240, currentZoom + (event.deltaY < 0 ? 10 : -10)))
    const pointX = (event.clientX - svgRect.left) / svgRect.width
    const pointY = (event.clientY - svgRect.top) / svgRect.height
    setZoomPercent(nextZoom)
    window.requestAnimationFrame(() => {
      const nextRect = svg.getBoundingClientRect()
      viewport.scrollLeft +=
        nextRect.left + nextRect.width * pointX - event.clientX
      viewport.scrollTop += nextRect.top + nextRect.height * pointY - event.clientY
    })
  }

  useEffect(() => {
    const handlePointerUp = () => {
      transformRef.current = null
      panRef.current = null
      setTransforming(false)
      setIsPanning(false)
      setSmartGuides({})
    }
    window.addEventListener("pointerup", handlePointerUp)
    window.addEventListener("pointercancel", handlePointerUp)
    return () => {
      window.removeEventListener("pointerup", handlePointerUp)
      window.removeEventListener("pointercancel", handlePointerUp)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const snapshot: PosterSnapshot = {
        fields: { ...fields },
        stylesByTemplate: structuredClone(stylesByTemplate),
        customElementsByTemplate: structuredClone(customElementsByTemplate),
        layerOrderByTemplate: structuredClone(layerOrderByTemplate),
        documentSettings: { ...documentSettings },
      }
      try {
        window.localStorage.setItem(POSTER_DRAFT_STORAGE_KEY, JSON.stringify(snapshot))
        setLastSavedAt(new Date().toISOString())
      } catch {
        toast.error("Nao foi possivel salvar o rascunho local.")
      }
    }, 700)

    return () => window.clearTimeout(timer)
  }, [customElementsByTemplate, documentSettings, fields, layerOrderByTemplate, stylesByTemplate])

  useEffect(() => {
    let cancelled = false

    void loadPublicTemplates()
      .then((loaded) => {
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
        setLayerOrderByTemplate((current) => {
          const next = { ...current }
          for (const template of loaded) {
            next[template.id] = next[template.id] ?? [...FIELD_KEYS]
          }
          return next
        })
        setCustomElementsByTemplate((current) => {
          const next = { ...current }
          for (const template of loaded) {
            next[template.id] = next[template.id] ?? []
          }
          return next
        })
        setActiveTemplateId((current) => current ?? loaded[0]?.id ?? null)
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Falha ao carregar templates.")
        }
      })
      .finally(() => {
        if (!cancelled) setTemplatesLoading(false)
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
        accept=".png,image/png,.svg,image/svg+xml"
        multiple
        onChange={(event) => void handleUpload(event)}
      />
      <input
        id="poster-element-image-upload"
        className="sr-only"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        onChange={(event) => void handleElementImageUpload(event)}
      />
      <PageHeader
        title="Editor de cartazes"
        description="Monte ofertas e avisos prontos para impressao."
        action={
          <>
            <Button asChild variant="outline">
              <label htmlFor="poster-template-upload" className="cursor-pointer">
                <Upload data-icon="inline-start" />
                Importar template
              </label>
            </Button>
            <Button variant="outline" onClick={resetStyles} disabled={!activeTemplate}>
              <RotateCcw data-icon="inline-start" />
              Restaurar layout
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button disabled={!activeTemplate || exporting !== null}>
                  {exporting ? (
                    <LoaderCircle data-icon="inline-start" className="animate-spin" />
                  ) : (
                    <Download data-icon="inline-start" />
                  )}
                  Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => void exportPng()}>
                  <ImageDown />
                  PNG em {documentSettings.dpi} DPI
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void exportPdf()}>
                  <FileDown />
                  PDF para impressao
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={exportSvg}>
                  <Download />
                  SVG editavel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <div className="p-3 md:p-4">
        <div className="poster-editor-workspace poster-surface grid min-h-[42rem] overflow-hidden rounded-lg border bg-slate-950 text-slate-100 shadow-sm lg:min-h-[34rem] lg:grid-cols-[15rem_minmax(0,1fr)_22rem]">
          <aside className="flex min-h-0 flex-col border-b border-slate-800 bg-slate-900/80 lg:border-b-0 lg:border-r">
            <div className="flex min-h-11 items-center justify-between border-b border-slate-800 px-3 py-2">
              <p className="text-xs font-semibold uppercase text-slate-400">Templates</p>
              <span className="rounded-md bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                {templates.length}
              </span>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-2 content-start gap-2 overflow-y-auto p-2">
              {templatesLoading ? (
                <div className="col-span-2 flex min-h-32 items-center justify-center rounded-lg border border-dashed border-slate-700 text-slate-400">
                  <LoaderCircle className="mr-2 size-4 animate-spin" />
                  <span className="text-xs">Carregando templates</span>
                </div>
              ) : templates.length === 0 ? (
                <div className="col-span-2 rounded-lg border border-dashed border-slate-700 p-3 text-slate-400">
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
                  onClick={() => selectTemplate(template.id)}
                  className={`w-full overflow-hidden rounded-lg border p-1 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary ${
                    activeTemplateId === template.id
                      ? "border-primary bg-slate-800"
                      : "border-slate-800 bg-slate-900 hover:border-slate-600"
                  }`}
                >
                  <span className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-md bg-slate-950 p-1">
                    <img
                      src={template.dataUrl}
                      alt={template.name}
                      className="h-full w-full object-contain"
                    />
                  </span>
                  <span className="mt-1 block truncate px-1 text-[11px] text-slate-300">
                    {template.name}
                  </span>
                </button>
              ))}
            </div>
          </aside>

          <section className="flex min-h-[34rem] min-w-0 flex-col bg-slate-950 lg:min-h-0">
            <div className="flex min-h-12 flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {activeTemplate?.name ?? "Preview"}
                </p>
                <p className="text-xs text-slate-500">
                  {PAPER_SIZES_MM[documentSettings.paper].label} {geometry.paperWidthMm} x{" "}
                  {geometry.paperHeightMm} mm + {documentSettings.bleedMm} mm
                </p>
              </div>
              <div className="flex items-center gap-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-700 px-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
                      disabled={!activeTemplate}
                    >
                      <Plus className="size-4" />
                      Adicionar
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    side="bottom"
                    sideOffset={8}
                    collisionPadding={16}
                    className="z-[80] max-h-[calc(100dvh-8rem)] w-60 overflow-y-auto"
                  >
                    <DropdownMenuItem onSelect={() => addCustomElement("text")}>
                      <Type /> Texto livre
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() =>
                        addCustomElement("text", {
                          name: "Cifrao R$",
                          value: "R$",
                          width: 15,
                          height: 9,
                          fontSize: 68,
                          color: "#111827",
                        })
                      }
                    >
                      <span className="w-4 text-center font-bold">R$</span> Cifrao de preco
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() =>
                        addCustomElement("text", {
                          name: "Virgula decimal",
                          value: ",",
                          width: 8,
                          height: 10,
                          fontSize: 86,
                          color: "#111827",
                        })
                      }
                    >
                      <span className="w-4 text-center text-lg font-black">,</span> Virgula decimal
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => {
                        setImageReplaceTargetId(null)
                        document.getElementById("poster-element-image-upload")?.click()
                      }}
                    >
                      <ImagePlus /> Imagem ou logotipo
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => addCustomElement("shape")}>
                      <Square /> Retangulo
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => addCustomElement("shape", { name: "Circulo", shape: "ellipse" })}
                    >
                      <span className="size-4 rounded-full border-2" /> Circulo
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => addCustomElement("shape", { name: "Estrela", shape: "star" })}
                    >
                      <Star /> Estrela
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => addCustomElement("badge")}>
                      <Star /> Selo de oferta
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => addCustomElement("barcode")}>
                      <Barcode /> Codigo de barras
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <button
                  type="button"
                  className="inline-flex size-8 items-center justify-center rounded-md border border-slate-700 text-slate-400 hover:bg-slate-800 disabled:opacity-30"
                  onClick={duplicateSelected}
                  disabled={selectedIds.length === 0}
                  aria-label="Duplicar selecao"
                  title="Duplicar selecao"
                >
                  <Copy className="size-4" />
                </button>
                <button
                  type="button"
                  className="inline-flex size-8 items-center justify-center rounded-md border border-slate-700 text-slate-400 hover:bg-slate-800 disabled:opacity-30"
                  onClick={deleteSelected}
                  disabled={selectedIds.length === 0}
                  aria-label="Excluir selecao"
                  title="Excluir selecao"
                >
                  <Trash2 className="size-4" />
                </button>
                <button
                  type="button"
                  className="inline-flex size-8 items-center justify-center rounded-md border border-slate-700 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-300 disabled:opacity-30"
                  onClick={undo}
                  disabled={historyState.undo === 0}
                  aria-label="Desfazer"
                  title="Desfazer"
                >
                  <Undo2 className="size-4" />
                </button>
                <button
                  type="button"
                  className="inline-flex size-8 items-center justify-center rounded-md border border-slate-700 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-300 disabled:opacity-30"
                  onClick={redo}
                  disabled={historyState.redo === 0}
                  aria-label="Refazer"
                  title="Refazer"
                >
                  <Redo2 className="size-4" />
                </button>
                <span className="mx-1 h-5 w-px bg-slate-800" />
                <span className="mr-2 hidden max-w-28 truncate text-xs text-slate-400 sm:inline">
                  {selectedCustomElement?.name ?? FIELD_META[selectedField].label}
                </span>
                <button
                  type="button"
                  className="inline-flex size-8 items-center justify-center rounded-md border border-slate-700 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-300"
                  onClick={zoomOut}
                  aria-label="Diminuir zoom"
                  title="Diminuir zoom"
                >
                  <ZoomOut className="size-4" />
                </button>
                <span className="min-w-12 text-center text-[11px] font-medium text-slate-400">
                  {zoomPercent === 0 ? "Ajustar" : `${zoomPercent}%`}
                </span>
                <button
                  type="button"
                  className="inline-flex size-8 items-center justify-center rounded-md border border-slate-700 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-300"
                  onClick={zoomIn}
                  aria-label="Aumentar zoom"
                  title="Aumentar zoom"
                >
                  <ZoomIn className="size-4" />
                </button>
                <button
                  type="button"
                  className="inline-flex size-8 items-center justify-center rounded-md border border-slate-700 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-300"
                  onClick={() => setZoomPercent(0)}
                  aria-label="Ajustar cartaz a tela"
                  title="Ajustar a tela"
                >
                  <Maximize2 className="size-4" />
                </button>
              </div>
            </div>

            <div
              ref={viewportRef}
              className={`min-h-0 flex-1 overflow-auto bg-slate-950 ${isPanning ? "cursor-grabbing" : spacePressed ? "cursor-grab" : ""}`}
              onPointerDown={handleViewportPointerDown}
              onPointerMove={handleViewportPointerMove}
              onPointerUp={stopPanning}
              onPointerCancel={stopPanning}
              onWheel={handleViewportWheel}
            >
              <div className="flex min-h-full min-w-full items-center justify-center p-3 sm:p-4">
              <svg
                ref={svgRef}
                tabIndex={0}
                aria-label="Area de edicao do cartaz"
                width={width}
                height={height}
                viewBox={`0 0 ${width} ${height}`}
                className={`block h-auto shrink-0 select-none rounded-lg bg-slate-900 shadow-2xl outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  zoomPercent === 0 ? "max-h-full w-auto max-w-full" : "max-w-none"
                }`}
                style={{
                  cursor: transforming ? "grabbing" : spacePressed ? "grab" : "default",
                  touchAction: "none",
                  width: zoomPercent === 0 ? undefined : `${(width * zoomPercent) / 100}px`,
                }}
                onPointerMove={handlePointerMove}
                onKeyDown={handleCanvasKeyDown}
                onKeyUp={(event) => {
                  if (event.key === " ") setSpacePressed(false)
                }}
                onBlur={() => setSpacePressed(false)}
                onPointerDown={(event) => {
                  if (event.target === event.currentTarget && !spacePressed) {
                    event.currentTarget.focus()
                    setSelectedIds([])
                  }
                }}
              >
                  <defs>
                    <pattern
                      id="poster-grid"
                      width={gridWidth}
                      height={gridHeight}
                      patternUnits="userSpaceOnUse"
                    >
                      <path
                        d={`M ${gridWidth} 0 L 0 0 0 ${gridHeight}`}
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth="0.55"
                        opacity="0.45"
                      />
                    </pattern>
                    {layerOrder.filter(isPosterFieldKey).map((key) => (
                      <filter
                        key={key}
                        id={`preview-shadow-${key}`}
                        x="-50%"
                        y="-50%"
                        width="200%"
                        height="200%"
                      >
                        <feGaussianBlur stdDeviation={styles[key].shadowBlur} />
                      </filter>
                    ))}
                    <filter id="preview-background-controls" colorInterpolationFilters="sRGB">
                      <feComponentTransfer result="contrast">
                        <feFuncR type="linear" slope={documentSettings.backgroundContrast} intercept={0.5 - 0.5 * documentSettings.backgroundContrast} />
                        <feFuncG type="linear" slope={documentSettings.backgroundContrast} intercept={0.5 - 0.5 * documentSettings.backgroundContrast} />
                        <feFuncB type="linear" slope={documentSettings.backgroundContrast} intercept={0.5 - 0.5 * documentSettings.backgroundContrast} />
                      </feComponentTransfer>
                      <feComponentTransfer in="contrast">
                        <feFuncR type="linear" slope={documentSettings.backgroundBrightness} />
                        <feFuncG type="linear" slope={documentSettings.backgroundBrightness} />
                        <feFuncB type="linear" slope={documentSettings.backgroundBrightness} />
                      </feComponentTransfer>
                    </filter>
                  </defs>
                  {activeTemplate ? (
                    <image
                      href={activeTemplate.dataUrl}
                      x={backgroundX}
                      y={backgroundY}
                      width={backgroundWidth}
                      height={backgroundHeight}
                      preserveAspectRatio={backgroundAspectRatio}
                      opacity={documentSettings.backgroundOpacity}
                      filter="url(#preview-background-controls)"
                      style={{ pointerEvents: "none" }}
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

                  {activeTemplate && documentSettings.showGrid ? (
                    <rect width={width} height={height} fill="url(#poster-grid)" style={{ pointerEvents: "none" }} />
                  ) : null}

                  {activeTemplate && documentSettings.showGuides ? (
                    <g style={{ pointerEvents: "none" }}>
                      <rect
                        x={geometry.trimX}
                        y={geometry.trimY}
                        width={geometry.trimWidth}
                        height={geometry.trimHeight}
                        fill="none"
                        stroke="#ef4444"
                        strokeWidth="1.2"
                        strokeDasharray="8 5"
                      />
                      <rect
                        x={geometry.safeX}
                        y={geometry.safeY}
                        width={geometry.safeWidth}
                        height={geometry.safeHeight}
                        fill="none"
                        stroke="#22c55e"
                        strokeWidth="1.2"
                        strokeDasharray="7 5"
                      />
                      <line
                        x1={width / 2}
                        y1={geometry.trimY}
                        x2={width / 2}
                        y2={geometry.trimY + geometry.trimHeight}
                        stroke="#a78bfa"
                        strokeWidth="0.9"
                        strokeDasharray="10 7"
                        opacity="0.8"
                      />
                      <line
                        x1={geometry.trimX}
                        y1={height / 2}
                        x2={geometry.trimX + geometry.trimWidth}
                        y2={height / 2}
                        stroke="#a78bfa"
                        strokeWidth="0.9"
                        strokeDasharray="10 7"
                        opacity="0.8"
                      />
                    </g>
                  ) : null}

                  {activeTemplate && documentSettings.showRulers ? (
                    <g fill="#e2e8f0" stroke="#e2e8f0" opacity="0.8" style={{ pointerEvents: "none" }}>
                      {Array.from({ length: Math.floor(geometry.totalWidthMm / 10) + 1 }, (_, index) => {
                        const x = index * 10 * geometry.mmToLogical
                        return (
                          <g key={`ruler-x-${index}`}>
                            <line x1={x} y1={0} x2={x} y2={index % 5 === 0 ? 12 : 7} strokeWidth="0.7" />
                            {index % 5 === 0 ? (
                              <text x={x + 2} y={20} fontSize="9" stroke="none">{index * 10}</text>
                            ) : null}
                          </g>
                        )
                      })}
                      {Array.from({ length: Math.floor(geometry.totalHeightMm / 10) + 1 }, (_, index) => {
                        const y = index * 10 * geometry.mmToLogical
                        return (
                          <g key={`ruler-y-${index}`}>
                            <line x1={0} y1={y} x2={index % 5 === 0 ? 12 : 7} y2={y} strokeWidth="0.7" />
                            {index % 5 === 0 ? (
                              <text x={14} y={y + 9} fontSize="9" stroke="none">{index * 10}</text>
                            ) : null}
                          </g>
                        )
                      })}
                    </g>
                  ) : null}

                  {smartGuides.x !== undefined ? (
                    <line
                      x1={(smartGuides.x / 100) * width}
                      y1={0}
                      x2={(smartGuides.x / 100) * width}
                      y2={height}
                      stroke="#22d3ee"
                      strokeWidth="1.2"
                      strokeDasharray="6 4"
                      style={{ pointerEvents: "none" }}
                    />
                  ) : null}
                  {smartGuides.y !== undefined ? (
                    <line
                      x1={0}
                      y1={(smartGuides.y / 100) * height}
                      x2={width}
                      y2={(smartGuides.y / 100) * height}
                      stroke="#22d3ee"
                      strokeWidth="1.2"
                      strokeDasharray="6 4"
                      style={{ pointerEvents: "none" }}
                    />
                  ) : null}

                  {layerOrder.map((id) => {
                    if (isPosterFieldKey(id)) {
                      const style = styles[id]
                      if (!style.visible || !fields[id]) return null
                      const x = (style.x / 100) * width
                      const y = (style.y / 100) * height
                      const layout = textLayout(fields[id], style, width)
                      const firstLineY = y - ((layout.lines.length - 1) * layout.lineHeight) / 2
                      const textProps = {
                        x,
                        textAnchor: style.textAlign,
                        dominantBaseline: "middle" as const,
                        fontFamily: style.fontFamily,
                        fontSize: layout.fontSize,
                        fontWeight: style.fontWeight,
                        fontStyle: style.fontStyle,
                        letterSpacing: style.letterSpacing,
                      }
                      const renderLines = () => layout.lines.map((line, index) => (
                        <tspan key={`${id}-${index}`} x={x} y={firstLineY + index * layout.lineHeight}>
                          {line}
                        </tspan>
                      ))
                      return (
                        <g
                          key={id}
                          transform={`rotate(${style.rotation} ${x} ${y})`}
                          opacity={style.opacity}
                          onPointerDown={(event) => startTransform(event, id, "move")}
                          style={{ cursor: style.locked ? "default" : "grab" }}
                        >
                          {style.shadowBlur > 0 || style.shadowX !== 0 || style.shadowY !== 0 ? (
                            <text
                              {...textProps}
                              fill={style.shadowColor}
                              opacity="0.65"
                              transform={`translate(${style.shadowX} ${style.shadowY})`}
                              filter={`url(#preview-shadow-${id})`}
                              style={{ pointerEvents: "none", userSelect: "none" }}
                            >
                              {renderLines()}
                            </text>
                          ) : null}
                          <text
                            {...textProps}
                            fill={style.color}
                            stroke={style.stroke !== "none" ? style.stroke : undefined}
                            strokeWidth={style.stroke !== "none" ? style.strokeWidth : undefined}
                            paintOrder="stroke fill"
                            strokeLinejoin="round"
                            style={{ userSelect: "none" }}
                          >
                            {renderLines()}
                          </text>
                        </g>
                      )
                    }

                    const element = customElements.find((item) => item.id === id)
                    if (!element?.visible) return null
                    const x = (element.x / 100) * width
                    const y = (element.y / 100) * height
                    const elementWidth = (element.width / 100) * width
                    const elementHeight = (element.height / 100) * height
                    const left = -elementWidth / 2
                    const top = -elementHeight / 2
                    const lines = element.value.replace(/\r/g, "").split("\n")
                    const fittedFontSize = Math.max(
                      4,
                      Math.min(
                        element.fontSize,
                        elementHeight / Math.max(1, lines.length * element.lineHeight),
                        elementWidth /
                          Math.max(1, ...lines.map((line) => line.length * 0.58))
                      )
                    )
                    const firstLineY =
                      -((lines.length - 1) * fittedFontSize * element.lineHeight) / 2
                    const starPoints = Array.from({ length: 10 }, (_, index) => {
                      const angle = -Math.PI / 2 + (index * Math.PI) / 5
                      const radius =
                        index % 2 === 0
                          ? Math.min(elementWidth, elementHeight) / 2
                          : Math.min(elementWidth, elementHeight) * 0.23
                      return `${Math.cos(angle) * radius},${Math.sin(angle) * radius}`
                    }).join(" ")
                    const textX =
                      element.textAlign === "start"
                        ? left
                        : element.textAlign === "end"
                          ? -left
                          : 0

                    return (
                      <g
                        key={id}
                        transform={`translate(${x} ${y}) rotate(${element.rotation})`}
                        opacity={element.opacity}
                        onPointerDown={(event) => startTransform(event, id, "move")}
                        style={{ cursor: element.locked ? "default" : "grab" }}
                      >
                        {element.kind === "image" && element.src ? (
                          <image
                            href={element.src}
                            x={left}
                            y={top}
                            width={elementWidth}
                            height={elementHeight}
                            preserveAspectRatio="xMidYMid meet"
                          />
                        ) : element.kind === "barcode" ? (
                          <image
                            href={barcodeDataUrl(element.value, element.color, element.fill)}
                            x={left}
                            y={top}
                            width={elementWidth}
                            height={elementHeight}
                            preserveAspectRatio="xMidYMid meet"
                          />
                        ) : element.kind === "shape" ? (
                          element.shape === "ellipse" ? (
                            <ellipse
                              cx="0"
                              cy="0"
                              rx={elementWidth / 2}
                              ry={elementHeight / 2}
                              fill={element.fill}
                              stroke={element.stroke !== "none" ? element.stroke : undefined}
                              strokeWidth={element.strokeWidth}
                            />
                          ) : element.shape === "star" ? (
                            <polygon
                              points={starPoints}
                              fill={element.fill}
                              stroke={element.stroke !== "none" ? element.stroke : undefined}
                              strokeWidth={element.strokeWidth}
                            />
                          ) : (
                            <rect
                              x={left}
                              y={top}
                              width={elementWidth}
                              height={elementHeight}
                              rx={element.borderRadius}
                              fill={element.fill}
                              stroke={element.stroke !== "none" ? element.stroke : undefined}
                              strokeWidth={element.strokeWidth}
                            />
                          )
                        ) : (
                          <>
                            {element.kind === "badge" ? (
                              <rect
                                x={left}
                                y={top}
                                width={elementWidth}
                                height={elementHeight}
                                rx={element.borderRadius}
                                fill={element.fill}
                                stroke={element.stroke !== "none" ? element.stroke : undefined}
                                strokeWidth={element.strokeWidth}
                              />
                            ) : null}
                            <text
                              x={textX}
                              textAnchor={element.textAlign}
                              dominantBaseline="middle"
                              fontFamily={element.fontFamily}
                              fontSize={fittedFontSize}
                              fontWeight={element.fontWeight}
                              fontStyle={element.fontStyle}
                              letterSpacing={element.letterSpacing}
                              fill={element.color}
                              stroke={element.stroke !== "none" ? element.stroke : undefined}
                              strokeWidth={element.strokeWidth}
                              paintOrder="stroke fill"
                              strokeLinejoin="round"
                            >
                              {lines.map((line, index) => (
                                <tspan
                                  key={`${id}-line-${index}`}
                                  x={textX}
                                  y={firstLineY + index * fittedFontSize * element.lineHeight}
                                >
                                  {line}
                                </tspan>
                              ))}
                            </text>
                          </>
                        )}
                      </g>
                    )
                  })}

                  {selectedBounds.map((bounds) => {
                    const x = (bounds.x / 100) * width
                    const y = (bounds.y / 100) * height
                    const boxWidth = (bounds.width / 100) * width
                    const boxHeight = (bounds.height / 100) * height
                    const singleSelection = selectedBounds.length === 1
                    return (
                      <g
                        key={`selection-${bounds.id}`}
                        transform={`translate(${x} ${y}) rotate(${bounds.rotation})`}
                      >
                        <rect
                          x={-boxWidth / 2 - 5}
                          y={-boxHeight / 2 - 5}
                          width={boxWidth + 10}
                          height={boxHeight + 10}
                          fill="none"
                          stroke={bounds.locked ? "#f59e0b" : "#22d3ee"}
                          strokeWidth="1.5"
                          strokeDasharray={selectedBounds.length > 1 ? "7 4" : undefined}
                          style={{ pointerEvents: "none" }}
                        />
                        {singleSelection && !bounds.locked ? (
                          <>
                            {(
                              [
                                ["nw", -boxWidth / 2 - 5, -boxHeight / 2 - 5],
                                ["ne", boxWidth / 2 + 5, -boxHeight / 2 - 5],
                                ["se", boxWidth / 2 + 5, boxHeight / 2 + 5],
                                ["sw", -boxWidth / 2 - 5, boxHeight / 2 + 5],
                              ] satisfies Array<[ResizeCorner, number, number]>
                            ).map(([corner, handleX, handleY]) => (
                              <rect
                                key={corner}
                                x={handleX - 5}
                                y={handleY - 5}
                                width="10"
                                height="10"
                                rx="2"
                                fill="#f8fafc"
                                stroke="#0891b2"
                                strokeWidth="1.5"
                                onPointerDown={(event) => startTransform(event, bounds.id, corner)}
                                style={{ cursor: `${corner}-resize` }}
                              />
                            ))}
                            <line
                              x1="0"
                              y1={-boxHeight / 2 - 5}
                              x2="0"
                              y2={-boxHeight / 2 - 28}
                              stroke="#22d3ee"
                              strokeWidth="1.5"
                            />
                            <circle
                              cx="0"
                              cy={-boxHeight / 2 - 34}
                              r="6"
                              fill="#f8fafc"
                              stroke="#0891b2"
                              strokeWidth="1.5"
                              onPointerDown={(event) => startTransform(event, bounds.id, "rotate")}
                              style={{ cursor: "grab" }}
                            />
                          </>
                        ) : null}
                      </g>
                    )
                  })}

                  {selectionGroupBounds && selectedBounds.length > 1 ? (
                    <g style={{ pointerEvents: "none" }}>
                      <rect
                        x={(selectionGroupBounds.left / 100) * width}
                        y={(selectionGroupBounds.top / 100) * height}
                        width={((selectionGroupBounds.right - selectionGroupBounds.left) / 100) * width}
                        height={((selectionGroupBounds.bottom - selectionGroupBounds.top) / 100) * height}
                        fill="none"
                        stroke="#a78bfa"
                        strokeWidth="1.6"
                        strokeDasharray="10 5"
                      />
                      <line
                        x1={((selectionGroupBounds.left + selectionGroupBounds.right) / 200) * width}
                        y1={(selectionGroupBounds.top / 100) * height}
                        x2={((selectionGroupBounds.left + selectionGroupBounds.right) / 200) * width}
                        y2={(selectionGroupBounds.bottom / 100) * height}
                        stroke="#a78bfa"
                        strokeWidth="1"
                        strokeDasharray="5 4"
                      />
                      <line
                        x1={(selectionGroupBounds.left / 100) * width}
                        y1={((selectionGroupBounds.top + selectionGroupBounds.bottom) / 200) * height}
                        x2={(selectionGroupBounds.right / 100) * width}
                        y2={((selectionGroupBounds.top + selectionGroupBounds.bottom) / 200) * height}
                        stroke="#a78bfa"
                        strokeWidth="1"
                        strokeDasharray="5 4"
                      />
                    </g>
                  ) : null}
              </svg>
              </div>
            </div>
          </section>

          <aside className="flex min-h-0 flex-col border-t border-slate-800 bg-slate-900/80 lg:border-l lg:border-t-0">
            <div className="grid grid-cols-4 border-b border-slate-800">
              {(
                [
                  ["fields", "Texto", Type],
                  ["style", "Estilo", Palette],
                  ["document", "Pagina", Ruler],
                  ["layers", "Camadas", Layers3],
                ] satisfies Array<[EditorTab, string, typeof Type]>
              ).map(([tabId, label, Icon]) => (
                <button
                  key={tabId}
                  type="button"
                  onClick={() => setTab(tabId)}
                  className={`flex h-12 min-w-0 flex-col items-center justify-center gap-0.5 border-b-2 text-[0.65rem] font-semibold transition-colors ${
                    tab === tabId
                      ? "border-primary text-white"
                      : "border-transparent text-slate-500 hover:text-slate-300"
                  }`}
                >
                  <Icon className="size-3.5" />
                  <span className="truncate">{label}</span>
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2.5">
              {tab === "fields" ? (
                FIELD_KEYS.map((key) => (
                  <section
                    key={key}
                    className={`rounded-lg border px-2.5 py-2 transition-colors ${
                      selectedField === key
                        ? "border-primary bg-primary/10"
                        : "border-slate-800 bg-slate-900 hover:border-slate-700"
                    }`}
                  >
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedField(key)
                          setSelectedIds([key])
                        }}
                        className="truncate text-xs font-semibold text-slate-300"
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
                      onFocus={() => {
                        setSelectedField(key)
                        setSelectedIds([key])
                        checkpoint()
                      }}
                      onChange={(event) =>
                        setFields((current) => ({
                          ...current,
                          [key]: event.target.value,
                        }))
                      }
                      placeholder={FIELD_META[key].hint}
                      maxLength={240}
                      className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-primary focus:ring-2 focus:ring-primary/30"
                    />
                  </section>
                ))
              ) : tab === "style" ? (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {FIELD_KEYS.map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setSelectedField(key)
                          setSelectedIds([key])
                        }}
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

                  <section className="space-y-4 rounded-lg border border-slate-800 bg-slate-900 p-3.5">
                    <p className="truncate text-xs font-semibold text-slate-300">
                      {FIELD_META[selectedField].label}
                    </p>

                    <label className="block text-xs text-slate-400">
                      Familia tipografica
                      <select
                        value={selectedStyle.fontFamily}
                        disabled={!canEditStyle}
                        onChange={(event) =>
                          updateStyle(selectedField, "fontFamily", event.target.value)
                        }
                        className="mt-1 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200 outline-none focus:border-primary"
                      >
                        {FONT_OPTIONS.map((font) => (
                          <option key={font} value={font}>{font}</option>
                        ))}
                      </select>
                    </label>

                    <div className="grid grid-cols-5 gap-1">
                      <button
                        type="button"
                        title="Negrito"
                        aria-label="Negrito"
                        onClick={() =>
                          updateStyle(
                            selectedField,
                            "fontWeight",
                            selectedStyle.fontWeight === "700" ? "400" : "700"
                          )
                        }
                        className={`inline-flex h-8 items-center justify-center rounded-md ${selectedStyle.fontWeight !== "400" ? "bg-primary text-white" : "bg-slate-800 text-slate-300"}`}
                      >
                        <Bold className="size-4" />
                      </button>
                      <button
                        type="button"
                        title="Italico"
                        aria-label="Italico"
                        onClick={() =>
                          updateStyle(
                            selectedField,
                            "fontStyle",
                            selectedStyle.fontStyle === "italic" ? "normal" : "italic"
                          )
                        }
                        className={`inline-flex h-8 items-center justify-center rounded-md ${selectedStyle.fontStyle === "italic" ? "bg-primary text-white" : "bg-slate-800 text-slate-300"}`}
                      >
                        <Italic className="size-4" />
                      </button>
                      {(
                        [
                          ["start", AlignLeft, "Alinhar a esquerda"],
                          ["middle", AlignCenter, "Centralizar"],
                          ["end", AlignRight, "Alinhar a direita"],
                        ] satisfies Array<[TextAlign, typeof AlignLeft, string]>
                      ).map(([alignment, Icon, label]) => (
                        <button
                          key={alignment}
                          type="button"
                          title={label}
                          aria-label={label}
                          onClick={() => updateStyle(selectedField, "textAlign", alignment)}
                          className={`inline-flex h-8 items-center justify-center rounded-md ${selectedStyle.textAlign === alignment ? "bg-primary text-white" : "bg-slate-800 text-slate-300"}`}
                        >
                          <Icon className="size-4" />
                        </button>
                      ))}
                    </div>

                    <label className="block text-xs text-slate-400">
                      Tamanho
                      <span className="float-right text-white">{selectedFontPt} pt</span>
                      <input
                        type="range"
                        min="6"
                        max="500"
                        value={selectedFontPt}
                        disabled={!canEditStyle}
                        onChange={(event) =>
                          updateStyle(
                            selectedField,
                            "fontSize",
                            ptToLogicalPx(Number(event.target.value), geometry)
                          )
                        }
                        className="mt-1 block w-full accent-primary disabled:opacity-40"
                      />
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                      <label className="block text-xs text-slate-400">
                        Largura maxima
                        <span className="float-right text-white">{selectedStyle.maxWidth}%</span>
                        <input
                          type="range"
                          min="10"
                          max="100"
                          step="1"
                          value={selectedStyle.maxWidth}
                          onChange={(event) =>
                            updateStyle(selectedField, "maxWidth", Number(event.target.value))
                          }
                          className="mt-1 block w-full accent-primary"
                        />
                      </label>
                      <label className="block text-xs text-slate-400">
                        Entrelinha
                        <span className="float-right text-white">{selectedStyle.lineHeight.toFixed(1)}</span>
                        <input
                          type="range"
                          min="0.8"
                          max="2"
                          step="0.1"
                          value={selectedStyle.lineHeight}
                          onChange={(event) =>
                            updateStyle(selectedField, "lineHeight", Number(event.target.value))
                          }
                          className="mt-1 block w-full accent-primary"
                        />
                      </label>
                    </div>

                    <label className="block text-xs text-slate-400">
                      Espacamento entre letras
                      <span className="float-right text-white">{selectedStyle.letterSpacing}px</span>
                      <input
                        type="range"
                        min="-4"
                        max="16"
                        step="0.5"
                        value={selectedStyle.letterSpacing}
                        onChange={(event) =>
                          updateStyle(selectedField, "letterSpacing", Number(event.target.value))
                        }
                        className="mt-1 block w-full accent-primary"
                      />
                    </label>

                    <label className="block text-xs text-slate-400">
                      Posicao X
                      <span className="float-right text-white">{Math.round(selectedStyle.x)}%</span>
                      <input
                        type="range"
                        min={selectedHorizontalMargin}
                        max={100 - selectedHorizontalMargin}
                        step="0.5"
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
                        min={selectedVerticalMargin}
                        max={100 - selectedVerticalMargin}
                        step="0.5"
                        value={selectedStyle.y}
                        disabled={!canEditStyle}
                        onChange={(event) =>
                          updateStyle(selectedField, "y", Number(event.target.value))
                        }
                        className="mt-1 block w-full accent-primary disabled:opacity-40"
                      />
                    </label>

                    <div>
                      <p className="mb-1.5 text-xs text-slate-400">Cores rapidas</p>
                      <div className="grid grid-cols-8 gap-1.5">
                        {BRAND_COLORS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            title={color}
                            aria-label={`Usar cor ${color}`}
                            onClick={() => updateStyle(selectedField, "color", color)}
                            className={`aspect-square rounded-md border ${selectedStyle.color === color ? "border-white ring-1 ring-white" : "border-slate-700"}`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>

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

                    <div className="border-t border-slate-800 pt-3">
                      <div className="grid grid-cols-[1fr_5rem] gap-2">
                        <label className="block text-xs text-slate-400">
                          Desfoque da sombra
                          <span className="float-right text-white">{selectedStyle.shadowBlur}px</span>
                          <input
                            type="range"
                            min="0"
                            max="20"
                            step="1"
                            value={selectedStyle.shadowBlur}
                            onChange={(event) =>
                              updateStyle(selectedField, "shadowBlur", Number(event.target.value))
                            }
                            className="mt-1 block w-full accent-primary"
                          />
                        </label>
                        <label className="text-xs text-slate-400">
                          Cor
                          <input
                            type="color"
                            value={selectedStyle.shadowColor}
                            onChange={(event) =>
                              updateStyle(selectedField, "shadowColor", event.target.value)
                            }
                            className="mt-1 block h-8 w-full cursor-pointer rounded border border-slate-700 bg-slate-950"
                          />
                        </label>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-3">
                        <label className="block text-xs text-slate-400">
                          Sombra X
                          <span className="float-right text-white">{selectedStyle.shadowX}px</span>
                          <input
                            type="range"
                            min="-20"
                            max="20"
                            step="1"
                            value={selectedStyle.shadowX}
                            onChange={(event) =>
                              updateStyle(selectedField, "shadowX", Number(event.target.value))
                            }
                            className="mt-1 block w-full accent-primary"
                          />
                        </label>
                        <label className="block text-xs text-slate-400">
                          Sombra Y
                          <span className="float-right text-white">{selectedStyle.shadowY}px</span>
                          <input
                            type="range"
                            min="-20"
                            max="20"
                            step="1"
                            value={selectedStyle.shadowY}
                            onChange={(event) =>
                              updateStyle(selectedField, "shadowY", Number(event.target.value))
                            }
                            className="mt-1 block w-full accent-primary"
                          />
                        </label>
                      </div>
                    </div>

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

                    <div className="grid grid-cols-2 gap-2 border-t border-slate-800 pt-3">
                      <button
                        type="button"
                        onClick={() =>
                          updateStyle(selectedField, "visible", !selectedStyle.visible)
                        }
                        className="flex h-9 items-center justify-center gap-2 rounded-md bg-slate-800 text-xs text-slate-200"
                      >
                        {selectedStyle.visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                        {selectedStyle.visible ? "Visivel" : "Oculto"}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateStyle(selectedField, "locked", !selectedStyle.locked)
                        }
                        className="flex h-9 items-center justify-center gap-2 rounded-md bg-slate-800 text-xs text-slate-200"
                      >
                        {selectedStyle.locked ? <Lock className="size-4" /> : <Unlock className="size-4" />}
                        {selectedStyle.locked ? "Bloqueado" : "Livre"}
                      </button>
                    </div>
                  </section>
                </>
              ) : tab === "document" ? (
                <>
                  <section className="space-y-4 rounded-lg border border-slate-800 bg-slate-900 p-3.5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                      <Ruler className="size-4 text-primary" />
                      Documento de impressao
                    </div>

                    <label className="block text-xs text-slate-400">
                      Formato
                      <select
                        value={documentSettings.paper}
                        onChange={(event) =>
                          updateDocument(
                            "paper",
                            event.target.value as PosterDocumentSettings["paper"]
                          )
                        }
                        className="mt-1 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200 outline-none focus:border-primary"
                      >
                        {Object.entries(PAPER_SIZES_MM).map(([value, paper]) => (
                          <option key={value} value={value}>
                            {paper.label} - {paper.width} x {paper.height} mm
                          </option>
                        ))}
                      </select>
                    </label>

                    <div>
                      <p className="mb-1.5 text-xs text-slate-400">Orientacao</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {(
                          [
                            ["portrait", "Retrato"],
                            ["landscape", "Paisagem"],
                          ] satisfies Array<[
                            PosterDocumentSettings["orientation"],
                            string,
                          ]>
                        ).map(([orientation, label]) => (
                          <button
                            key={orientation}
                            type="button"
                            onClick={() => updateDocument("orientation", orientation)}
                            className={`h-9 rounded-md text-xs ${documentSettings.orientation === orientation ? "bg-primary text-white" : "bg-slate-800 text-slate-300"}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs text-slate-400">
                        Sangria (mm)
                        <input
                          type="number"
                          min="0"
                          max="20"
                          step="0.5"
                          value={documentSettings.bleedMm}
                          onChange={(event) =>
                            updateDocument("bleedMm", Math.max(0, Number(event.target.value)))
                          }
                          className="mt-1 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-white outline-none focus:border-primary"
                        />
                      </label>
                      <label className="text-xs text-slate-400">
                        Margem segura (mm)
                        <input
                          type="number"
                          min="0"
                          max="40"
                          step="1"
                          value={documentSettings.safeMarginMm}
                          onChange={(event) =>
                            updateDocument(
                              "safeMarginMm",
                              Math.max(0, Number(event.target.value))
                            )
                          }
                          className="mt-1 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-white outline-none focus:border-primary"
                        />
                      </label>
                    </div>

                    <div>
                      <p className="mb-1.5 text-xs text-slate-400">Resolucao</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {([150, 300] as const).map((dpi) => (
                          <button
                            key={dpi}
                            type="button"
                            onClick={() => updateDocument("dpi", dpi)}
                            className={`h-9 rounded-md text-xs ${documentSettings.dpi === dpi ? "bg-primary text-white" : "bg-slate-800 text-slate-300"}`}
                          >
                            {dpi} DPI
                          </button>
                        ))}
                      </div>
                    </div>

                    <label className="block text-xs text-slate-400">
                      Ajuste do fundo
                      <select
                        value={documentSettings.backgroundFit}
                        onChange={(event) =>
                          updateDocument(
                            "backgroundFit",
                            event.target.value as PosterDocumentSettings["backgroundFit"]
                          )
                        }
                        className="mt-1 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200 outline-none focus:border-primary"
                      >
                        <option value="cover">Preencher e recortar</option>
                        <option value="contain">Exibir imagem inteira</option>
                        <option value="stretch">Esticar ate as bordas</option>
                      </select>
                    </label>

                    <div className="border-t border-slate-800 pt-3">
                      <p className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-200">
                        <ImagePlus className="size-4 text-primary" />
                        Edicao do fundo
                      </p>
                      <div className="space-y-3">
                        {(
                          [
                            ["backgroundOpacity", "Opacidade", 0, 1, 0.05],
                            ["backgroundBrightness", "Brilho", 0.4, 1.8, 0.05],
                            ["backgroundContrast", "Contraste", 0.4, 1.8, 0.05],
                            ["backgroundScale", "Escala", 0.5, 2, 0.05],
                            ["backgroundOffsetX", "Posicao X", -50, 50, 1],
                            ["backgroundOffsetY", "Posicao Y", -50, 50, 1],
                          ] satisfies Array<[
                            keyof PosterDocumentSettings,
                            string,
                            number,
                            number,
                            number,
                          ]>
                        ).map(([key, label, min, max, step]) => (
                          <label key={key} className="block text-xs text-slate-400">
                            {label}
                            <span className="float-right text-slate-200">
                              {Number(documentSettings[key]).toFixed(step < 1 ? 2 : 0)}
                            </span>
                            <input
                              type="range"
                              min={min}
                              max={max}
                              step={step}
                              value={Number(documentSettings[key])}
                              onChange={(event) =>
                                updateDocument(key, Number(event.target.value) as never)
                              }
                              className="mt-1 block w-full accent-primary"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  </section>

                  <section className="rounded-lg border border-slate-800 bg-slate-900 p-3.5">
                    <p className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-200">
                      <Grid3X3 className="size-4 text-primary" />
                      Guias do editor
                    </p>
                    <div className="space-y-3">
                      {(
                        [
                          ["showGuides", "Corte e margem segura"],
                          ["showGrid", "Grade de 5 mm"],
                          ["showRulers", "Reguas em milimetros"],
                          ["snapToGrid", "Encaixar na grade"],
                          ["includeCropMarks", "Marcas de corte na exportacao"],
                        ] satisfies Array<[keyof PosterDocumentSettings, string]>
                      ).map(([key, label]) => (
                        <label
                          key={key}
                          className="flex items-center justify-between gap-3 text-xs text-slate-300"
                        >
                          {label}
                          <input
                            type="checkbox"
                            checked={Boolean(documentSettings[key])}
                            onChange={(event) =>
                              updateDocument(key, event.target.checked as never)
                            }
                            className="size-4 accent-primary"
                          />
                        </label>
                      ))}
                    </div>
                  </section>

                  <section
                    className={`rounded-lg border p-3 ${lowResolution ? "border-amber-500/50 bg-amber-500/10" : "border-emerald-500/40 bg-emerald-500/10"}`}
                  >
                    <div className="flex items-start gap-2">
                      {lowResolution ? (
                        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-400" />
                      ) : (
                        <FileImage className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                      )}
                      <div className="min-w-0 text-xs">
                        <p className="font-semibold text-slate-200">
                          {lowResolution ? "Imagem abaixo da resolucao ideal" : "Resolucao adequada"}
                        </p>
                        <p className="mt-1 text-slate-400">
                          Saida: {outputSize.width} x {outputSize.height} px
                        </p>
                        {activeTemplate ? (
                          <p className="text-slate-500">
                            Fundo: {activeTemplate.width} x {activeTemplate.height} px
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </section>
                </>
              ) : (
                <>
                  {primaryBounds ? (
                    <section className="space-y-3 rounded-lg border border-slate-800 bg-slate-900 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold text-slate-200">
                            Transformacao
                          </p>
                          <p className="text-[0.65rem] text-slate-500">
                            {selectedBounds.length} selecionado(s)
                          </p>
                        </div>
                        <Move className="size-4 text-primary" />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {(
                          [
                            ["x", "Posicao X", primaryBounds.x, 0, 100, 0.1],
                            ["y", "Posicao Y", primaryBounds.y, 0, 100, 0.1],
                            ["width", "Largura", primaryBounds.width, 1, 100, 0.1],
                            ["height", "Altura", primaryBounds.height, 1, 100, 0.1],
                            ["rotation", "Rotacao", primaryBounds.rotation, -180, 180, 1],
                            ["opacity", "Opacidade", primaryBounds.opacity, 0, 1, 0.05],
                          ] satisfies Array<[
                            "x" | "y" | "width" | "height" | "rotation" | "opacity",
                            string,
                            number,
                            number,
                            number,
                            number,
                          ]>
                        ).map(([key, label, value, min, max, step]) => (
                          <label key={key} className="text-[0.65rem] text-slate-400">
                            {label}
                            <input
                              type="number"
                              min={min}
                              max={max}
                              step={step}
                              value={Number(value.toFixed(2))}
                              onChange={(event) =>
                                updatePrimaryTransform(key, Number(event.target.value))
                              }
                              className="mt-1 h-8 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-white outline-none focus:border-primary"
                            />
                          </label>
                        ))}
                      </div>

                      <div>
                        <p className="mb-1.5 text-[0.65rem] text-slate-400">Alinhamento</p>
                        <div className="grid grid-cols-6 gap-1">
                          {(
                            [
                              ["left", AlignLeft, "Alinhar a esquerda"],
                              ["center-x", AlignCenter, "Centralizar horizontalmente"],
                              ["right", AlignRight, "Alinhar a direita"],
                              ["top", ArrowUpToLine, "Alinhar ao topo"],
                              ["center-y", Move, "Centralizar verticalmente"],
                              ["bottom", ArrowDownToLine, "Alinhar abaixo"],
                            ] satisfies Array<[
                              "left" | "center-x" | "right" | "top" | "center-y" | "bottom",
                              typeof AlignLeft,
                              string,
                            ]>
                          ).map(([alignment, Icon, label]) => (
                            <button
                              key={alignment}
                              type="button"
                              title={label}
                              aria-label={label}
                              onClick={() => alignSelectedElements(alignment)}
                              className="inline-flex h-8 items-center justify-center rounded-md bg-slate-800 text-slate-300 hover:bg-slate-700"
                            >
                              <Icon className="size-3.5" />
                            </button>
                          ))}
                        </div>
                        <div className="mt-1 grid grid-cols-3 gap-1">
                          <button
                            type="button"
                            disabled={selectedBounds.length < 3}
                            onClick={() => distributeSelectedElements("horizontal")}
                            className="h-8 rounded-md bg-slate-800 text-[0.65rem] text-slate-300 disabled:opacity-30"
                          >
                            Distribuir H
                          </button>
                          <button
                            type="button"
                            disabled={selectedBounds.length < 3}
                            onClick={() => distributeSelectedElements("vertical")}
                            className="h-8 rounded-md bg-slate-800 text-[0.65rem] text-slate-300 disabled:opacity-30"
                          >
                            Distribuir V
                          </button>
                          <button
                            type="button"
                            onClick={centerSelectionOnCanvas}
                            className="h-8 rounded-md bg-slate-800 text-[0.65rem] text-slate-300"
                          >
                            Simetria
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-1 border-t border-slate-800 pt-3">
                        <button
                          type="button"
                          title="Copiar"
                          aria-label="Copiar"
                          onClick={copySelected}
                          className="inline-flex h-8 items-center justify-center rounded-md bg-slate-800 text-slate-300"
                        >
                          <Copy className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Colar"
                          aria-label="Colar"
                          disabled={clipboardCount === 0}
                          onClick={pasteSelected}
                          className="inline-flex h-8 items-center justify-center rounded-md bg-slate-800 text-slate-300 disabled:opacity-30"
                        >
                          <Plus className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Duplicar"
                          aria-label="Duplicar"
                          onClick={duplicateSelected}
                          className="inline-flex h-8 items-center justify-center rounded-md bg-slate-800 text-slate-300"
                        >
                          <Copy className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Excluir"
                          aria-label="Excluir"
                          onClick={deleteSelected}
                          className="inline-flex h-8 items-center justify-center rounded-md bg-red-500/15 text-red-300"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>

                      {isPosterFieldKey(primarySelectedId) ? (
                        <div className="grid grid-cols-2 gap-1">
                          <button
                            type="button"
                            onClick={copySelectedStyle}
                            className="h-8 rounded-md border border-slate-700 text-[0.65rem] text-slate-300"
                          >
                            Copiar estilo
                          </button>
                          <button
                            type="button"
                            disabled={!copiedStyle}
                            onClick={pasteSelectedStyle}
                            className="h-8 rounded-md border border-slate-700 text-[0.65rem] text-slate-300 disabled:opacity-30"
                          >
                            Aplicar estilo
                          </button>
                        </div>
                      ) : null}
                    </section>
                  ) : null}

                  {selectedCustomElement ? (
                    <section className="space-y-3 rounded-lg border border-slate-800 bg-slate-900 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-200">Propriedades</p>
                        {selectedCustomElement.kind === "barcode" ? (
                          <Barcode className="size-4 text-primary" />
                        ) : selectedCustomElement.kind === "image" ? (
                          <ImagePlus className="size-4 text-primary" />
                        ) : (
                          <Palette className="size-4 text-primary" />
                        )}
                      </div>

                      <label className="block text-[0.65rem] text-slate-400">
                        Nome da camada
                        <input
                          value={selectedCustomElement.name}
                          maxLength={60}
                          onChange={(event) =>
                            updateCustomElement(selectedCustomElement.id, { name: event.target.value })
                          }
                          className="mt-1 h-8 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-white outline-none focus:border-primary"
                        />
                      </label>

                      {selectedCustomElement.kind !== "image" && selectedCustomElement.kind !== "shape" ? (
                        <label className="block text-[0.65rem] text-slate-400">
                          {selectedCustomElement.kind === "barcode" ? "Codigo" : "Texto"}
                          <textarea
                            value={selectedCustomElement.value}
                            maxLength={240}
                            rows={2}
                            onChange={(event) =>
                              updateCustomElement(selectedCustomElement.id, { value: event.target.value })
                            }
                            className="mt-1 w-full resize-y rounded-md border border-slate-700 bg-slate-950 p-2 text-xs text-white outline-none focus:border-primary"
                          />
                        </label>
                      ) : null}

                      {selectedCustomElement.kind === "text" || selectedCustomElement.kind === "badge" ? (
                        <>
                          <label className="block text-[0.65rem] text-slate-400">
                            Fonte
                            <select
                              value={selectedCustomElement.fontFamily}
                              onChange={(event) =>
                                updateCustomElement(selectedCustomElement.id, { fontFamily: event.target.value })
                              }
                              className="mt-1 h-8 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-white"
                            >
                              {FONT_OPTIONS.map((font) => <option key={font}>{font}</option>)}
                            </select>
                          </label>
                          <label className="block text-[0.65rem] text-slate-400">
                            Tamanho
                            <span className="float-right text-slate-200">
                              {Math.round(logicalPxToPt(selectedCustomElement.fontSize, geometry))} pt
                            </span>
                            <input
                              type="range"
                              min="6"
                              max="500"
                              value={Math.round(logicalPxToPt(selectedCustomElement.fontSize, geometry))}
                              onChange={(event) =>
                                updateCustomElement(selectedCustomElement.id, {
                                  fontSize: ptToLogicalPx(Number(event.target.value), geometry),
                                })
                              }
                              className="mt-1 block w-full accent-primary"
                            />
                          </label>
                          <div className="grid grid-cols-5 gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                updateCustomElement(selectedCustomElement.id, {
                                  fontWeight: selectedCustomElement.fontWeight === "400" ? "900" : "400",
                                })
                              }
                              className="inline-flex h-8 items-center justify-center rounded-md bg-slate-800 text-slate-300"
                            >
                              <Bold className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                updateCustomElement(selectedCustomElement.id, {
                                  fontStyle: selectedCustomElement.fontStyle === "italic" ? "normal" : "italic",
                                })
                              }
                              className="inline-flex h-8 items-center justify-center rounded-md bg-slate-800 text-slate-300"
                            >
                              <Italic className="size-3.5" />
                            </button>
                            {(["start", "middle", "end"] as const).map((alignment, index) => {
                              const Icon = [AlignLeft, AlignCenter, AlignRight][index]
                              return (
                                <button
                                  key={alignment}
                                  type="button"
                                  onClick={() =>
                                    updateCustomElement(selectedCustomElement.id, { textAlign: alignment })
                                  }
                                  className={`inline-flex h-8 items-center justify-center rounded-md ${selectedCustomElement.textAlign === alignment ? "bg-primary text-white" : "bg-slate-800 text-slate-300"}`}
                                >
                                  <Icon className="size-3.5" />
                                </button>
                              )
                            })}
                          </div>
                        </>
                      ) : null}

                      {selectedCustomElement.kind === "shape" ? (
                        <label className="block text-[0.65rem] text-slate-400">
                          Forma
                          <select
                            value={selectedCustomElement.shape}
                            onChange={(event) =>
                              updateCustomElement(selectedCustomElement.id, {
                                shape: event.target.value as PosterCustomElement["shape"],
                              })
                            }
                            className="mt-1 h-8 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-white"
                          >
                            <option value="rectangle">Retangulo</option>
                            <option value="ellipse">Circulo / elipse</option>
                            <option value="star">Estrela</option>
                          </select>
                        </label>
                      ) : null}

                      {selectedCustomElement.kind !== "image" ? (
                        <div className="grid grid-cols-3 gap-2">
                          <label className="text-[0.65rem] text-slate-400">
                            Texto
                            <input
                              type="color"
                              value={selectedCustomElement.color}
                              onChange={(event) =>
                                updateCustomElement(selectedCustomElement.id, { color: event.target.value })
                              }
                              className="mt-1 h-8 w-full rounded border border-slate-700 bg-slate-950"
                            />
                          </label>
                          <label className="text-[0.65rem] text-slate-400">
                            Fundo
                            <input
                              type="color"
                              value={selectedCustomElement.fill === "transparent" ? "#ffffff" : selectedCustomElement.fill}
                              onChange={(event) =>
                                updateCustomElement(selectedCustomElement.id, { fill: event.target.value })
                              }
                              className="mt-1 h-8 w-full rounded border border-slate-700 bg-slate-950"
                            />
                          </label>
                          <label className="text-[0.65rem] text-slate-400">
                            Borda
                            <input
                              type="color"
                              value={selectedCustomElement.stroke === "none" ? "#ffffff" : selectedCustomElement.stroke}
                              onChange={(event) =>
                                updateCustomElement(selectedCustomElement.id, {
                                  stroke: event.target.value,
                                  strokeWidth: Math.max(1, selectedCustomElement.strokeWidth),
                                })
                              }
                              className="mt-1 h-8 w-full rounded border border-slate-700 bg-slate-950"
                            />
                          </label>
                        </div>
                      ) : null}

                      {selectedCustomElement.kind === "image" ? (
                        <Button asChild variant="outline" size="sm" className="w-full border-slate-700 bg-slate-950">
                          <label
                            htmlFor="poster-element-image-upload"
                            className="cursor-pointer"
                            onClick={() => setImageReplaceTargetId(selectedCustomElement.id)}
                          >
                            <ImagePlus data-icon="inline-start" /> Trocar imagem
                          </label>
                        </Button>
                      ) : null}
                    </section>
                  ) : null}

                  <section className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold text-slate-200">Camadas</p>
                        <p className="text-[0.65rem] text-slate-500">Topo primeiro</p>
                      </div>
                      <Layers3 className="size-4 text-primary" />
                    </div>
                    <div className="space-y-1.5">
                      {[...layerOrder].reverse().map((elementId) => {
                        const originalIndex = layerOrder.indexOf(elementId)
                        const field = isPosterFieldKey(elementId) ? elementId : null
                        const custom = customElements.find((element) => element.id === elementId)
                        if (!field && !custom) return null
                        const name = field ? FIELD_META[field].label : custom?.name ?? "Elemento"
                        const visible = field ? styles[field].visible : custom?.visible ?? false
                        const locked = field ? styles[field].locked : custom?.locked ?? false
                        return (
                          <div
                            key={elementId}
                            className={`grid grid-cols-[minmax(0,1fr)_repeat(4,1.75rem)] items-center gap-1 rounded-md border p-1.5 ${selectedIds.includes(elementId) ? "border-primary bg-primary/10" : "border-slate-800 bg-slate-950"}`}
                          >
                            <button
                              type="button"
                              onClick={(event) =>
                                selectElement(
                                  elementId,
                                  event.shiftKey || event.metaKey || event.ctrlKey
                                )
                              }
                              className="truncate px-1 text-left text-xs font-medium text-slate-200"
                            >
                              {name}
                            </button>
                            <button
                              type="button"
                              title={visible ? "Ocultar" : "Mostrar"}
                              aria-label={visible ? "Ocultar" : "Mostrar"}
                              onClick={() =>
                                field
                                  ? updateStyle(field, "visible", !visible)
                                  : custom && updateCustomElement(custom.id, { visible: !visible })
                              }
                              className="inline-flex size-7 items-center justify-center rounded text-slate-400 hover:bg-slate-800"
                            >
                              {visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                            </button>
                            <button
                              type="button"
                              title={locked ? "Desbloquear" : "Bloquear"}
                              aria-label={locked ? "Desbloquear" : "Bloquear"}
                              onClick={() =>
                                field
                                  ? updateStyle(field, "locked", !locked)
                                  : custom && updateCustomElement(custom.id, { locked: !locked })
                              }
                              className="inline-flex size-7 items-center justify-center rounded text-slate-400 hover:bg-slate-800"
                            >
                              {locked ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
                            </button>
                            <button
                              type="button"
                              title="Subir camada"
                              aria-label="Subir camada"
                              disabled={originalIndex === layerOrder.length - 1}
                              onClick={() => updateLayerOrder(elementId, 1)}
                              className="inline-flex size-7 items-center justify-center rounded text-slate-400 hover:bg-slate-800 disabled:opacity-25"
                            >
                              <ChevronUp className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              title="Descer camada"
                              aria-label="Descer camada"
                              disabled={originalIndex === 0}
                              onClick={() => updateLayerOrder(elementId, -1)}
                              className="inline-flex size-7 items-center justify-center rounded text-slate-400 hover:bg-slate-800 disabled:opacity-25"
                            >
                              <ChevronDown className="size-3.5" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </section>

                  <section className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold text-slate-200">Rascunho local</p>
                        <p className="text-[0.65rem] text-slate-500">
                          {lastSavedAt
                            ? `Salvo as ${new Date(lastSavedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                            : "Preparando salvamento"}
                        </p>
                      </div>
                      <Save className="size-4 text-emerald-400" />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3 w-full border-slate-700 bg-slate-950"
                      onClick={saveVersion}
                      disabled={!activeTemplate}
                    >
                      <Save data-icon="inline-start" />
                      Salvar versao
                    </Button>
                  </section>

                  {savedVersions.length > 0 ? (
                    <section className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                      <p className="mb-2 text-xs font-semibold text-slate-200">Versoes salvas</p>
                      <div className="space-y-1.5">
                        {savedVersions.map((version) => (
                          <button
                            key={version.id}
                            type="button"
                            onClick={() => restoreVersion(version)}
                            className="flex w-full items-center justify-between gap-2 rounded-md border border-slate-800 bg-slate-950 px-2.5 py-2 text-left text-xs text-slate-300 hover:border-slate-600"
                          >
                            <span>{new Date(version.createdAt).toLocaleDateString("pt-BR")}</span>
                            <span className="text-slate-500">
                              {new Date(version.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </button>
                        ))}
                      </div>
                    </section>
                  ) : null}
                </>
              )}
            </div>
          </aside>
        </div>
      </div>
    </>
  )
}
