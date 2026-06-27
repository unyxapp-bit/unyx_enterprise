import { useMemo, useState } from "react"
import type { FormEvent } from "react"
import {
  ArrowUpDown,
  Boxes,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  Edit3,
  Eye,
  FileText,
  Plus,
  Save,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
} from "lucide-react"

import { PageHeader } from "@/components/shared/PageHeader"
import { StateBlock } from "@/components/shared/StateBlock"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  useCreateOperationalForm,
  useDeleteOperationalForm,
  useOperationalFormResponses,
  useOperationalForms,
  useSectors,
  useSubmitOperationalFormResponse,
  useUpdateOperationalForm,
} from "@/hooks/useUnyxData"
import { localDateKey } from "@/features/operational/utils"
import { formatDateTimeBR } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/store/useAppStore"
import type { OperationalForm } from "@/types/domain"

const fieldClass =
  "h-8 w-full rounded-lg border bg-[color:var(--bg-surface)] px-2.5 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"

const textareaClass =
  "min-h-28 w-full rounded-lg border bg-[color:var(--bg-surface)] px-2.5 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"

const emptyForm = {
  branch_id: "",
  sector_id: "",
  title: "",
  description: "",
  category: "",
  questions: "",
}

const formViews = [
  ["respond", "Responder"],
  ["models", "Modelos"],
  ["responses", "Respostas"],
] as const

type FormSort = "name" | "responses" | "recent"
type QuestionFieldKind = "text" | "long_text" | "cpf" | "phone" | "email" | "date" | "time"
type FormDraft = { answers: Record<string, string>; notes: string }

const FORMS_PER_PAGE = 6
const DRAFT_STORAGE_PREFIX = "unyx-operational-form-draft:"

function draftStorageKey(formId: string) {
  return `${DRAFT_STORAGE_PREFIX}${formId}`
}

function storedDraftFormIds() {
  if (typeof window === "undefined") return new Set<string>()
  return new Set(
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith(DRAFT_STORAGE_PREFIX))
      .map((key) => key.slice(DRAFT_STORAGE_PREFIX.length))
  )
}

function loadFormDraft(formId: string): FormDraft | null {
  if (typeof window === "undefined") return null
  try {
    const value = window.localStorage.getItem(draftStorageKey(formId))
    return value ? (JSON.parse(value) as FormDraft) : null
  } catch {
    return null
  }
}

function splitQuestions(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)
}

function scopeLabel(form: OperationalForm) {
  const branch = form.branches?.name ?? "Toda empresa"
  return form.sectors?.name ? `${branch} - ${form.sectors.name}` : branch
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
}

function categoryGroup(form: OperationalForm) {
  const explicitCategory = normalizeText(form.category)
  const source = normalizeText(`${form.category ?? ""} ${form.title}`)

  if (explicitCategory === "atendimento") {
    return {
      key: "atendimento",
      label: "Atendimento",
      className: "border-sky-200 bg-sky-50 text-sky-700",
    }
  }
  if (explicitCategory === "fiscal") {
    return {
      key: "fiscal",
      label: "Fiscal",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    }
  }
  if (explicitCategory === "operacional") {
    return {
      key: "operacional",
      label: "Operacional",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    }
  }
  if (explicitCategory === "rh") {
    return {
      key: "rh",
      label: "RH",
      className: "border-rose-200 bg-rose-50 text-rose-700",
    }
  }

  if (["cliente", "satisfacao", "reclam", "atendimento"].some((term) => source.includes(term))) {
    return {
      key: "atendimento",
      label: "Atendimento",
      className: "border-sky-200 bg-sky-50 text-sky-700",
    }
  }
  if (["fiscal", "auditoria", "ronda", "conferencia"].some((term) => source.includes(term))) {
    return {
      key: "fiscal",
      label: "Fiscal",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    }
  }
  if (["rh", "avaliacao", "advertencia", "feedback", "colaborador"].some((term) => source.includes(term))) {
    return {
      key: "rh",
      label: "RH",
      className: "border-rose-200 bg-rose-50 text-rose-700",
    }
  }
  if (["operacional", "controle", "inventario", "checklist", "setor"].some((term) => source.includes(term))) {
    return {
      key: "operacional",
      label: "Operacional",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    }
  }

  return {
    key: "outros",
    label: form.category?.trim() || "Outros",
    className: "border-[color:var(--border-soft)] bg-[color:var(--bg-surface-soft)] text-[color:var(--text-muted)]",
  }
}

function CategoryIcon({ categoryKey, className }: { categoryKey: string; className?: string }) {
  const Icon =
    categoryKey === "atendimento"
      ? UserRound
      : categoryKey === "fiscal"
        ? ShieldCheck
        : categoryKey === "operacional"
          ? Boxes
          : categoryKey === "rh"
            ? Users
            : FileText
  const tone =
    categoryKey === "atendimento"
      ? "bg-emerald-500"
      : categoryKey === "fiscal"
        ? "bg-blue-600"
        : categoryKey === "operacional"
          ? "bg-cyan-600"
          : categoryKey === "rh"
            ? "bg-rose-500"
            : "bg-violet-600"

  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-lg text-white",
        tone,
        className
      )}
    >
      <Icon className="size-4" />
    </span>
  )
}

function activityTime(value: string | null) {
  if (!value) return "--:--"
  return new Date(value).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
}

function activityDate(value: string | null) {
  if (!value) return "Sem respostas registradas"
  return new Date(value).toLocaleDateString("pt-BR")
}

function questionFieldKind(question: string): QuestionFieldKind {
  const normalized = normalizeText(question)
  if (normalized.includes("cpf")) return "cpf"
  if (["telefone", "celular", "whatsapp"].some((term) => normalized.includes(term))) {
    return "phone"
  }
  if (["e-mail", "email"].some((term) => normalized.includes(term))) return "email"
  if (["data", "nascimento"].some((term) => normalized.includes(term))) return "date"
  if (["hora", "horario"].some((term) => normalized.includes(term))) return "time"
  if (["descreva", "descricao", "detalhe", "motivo", "observacao", "ocorrencia"].some(
    (term) => normalized.includes(term)
  )) {
    return "long_text"
  }
  return "text"
}

function maskCpf(value: string) {
  return value
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
}

function maskPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11)
  if (digits.length <= 2) return digits ? `(${digits}` : ""
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

function normalizeAnswer(kind: QuestionFieldKind, value: string) {
  if (kind === "cpf") return maskCpf(value)
  if (kind === "phone") return maskPhone(value)
  return value
}

function isValidAnswer(question: string, value: string | undefined) {
  const answer = value?.trim() ?? ""
  if (!answer) return false
  const kind = questionFieldKind(question)
  if (kind === "cpf") return /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(answer)
  if (kind === "phone") return /^\(\d{2}\) \d{4,5}-\d{4}$/.test(answer)
  if (kind === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answer)
  return true
}

export function OperationalFormsPage() {
  const selectedBranchId = useAppStore((state) => state.selectedBranchId)
  const forms = useOperationalForms()
  const responses = useOperationalFormResponses()
  const branches = useBranches()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<OperationalForm | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [selectedFormId, setSelectedFormId] = useState("")
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [responseNotes, setResponseNotes] = useState("")
  const [expandedFormIds, setExpandedFormIds] = useState<Set<string>>(new Set())
  const [view, setView] = useState<"respond" | "models" | "responses">("respond")
  const [deleteTarget, setDeleteTarget] = useState<OperationalForm | null>(null)
  const [searchText, setSearchText] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [sortBy, setSortBy] = useState<FormSort>("name")
  const [currentPage, setCurrentPage] = useState(1)
  const [currentStep, setCurrentStep] = useState(0)
  const [stepError, setStepError] = useState("")
  const [draftNotice, setDraftNotice] = useState("")
  const [draftFormIds, setDraftFormIds] = useState<Set<string>>(storedDraftFormIds)

  const sectors = useSectors(form.branch_id || null)
  const createForm = useCreateOperationalForm()
  const updateForm = useUpdateOperationalForm()
  const deleteForm = useDeleteOperationalForm()
  const submitResponse = useSubmitOperationalFormResponse()

  const responsesByFormId = useMemo(() => {
    const counts = new Map<string, number>()
    for (const response of responses.data ?? []) {
      counts.set(response.form_id, (counts.get(response.form_id) ?? 0) + 1)
    }
    return counts
  }, [responses.data])

  const latestResponseByFormId = useMemo(() => {
    const latest = new Map<string, string>()
    for (const response of responses.data ?? []) {
      if (!latest.has(response.form_id)) latest.set(response.form_id, response.submitted_at)
    }
    return latest
  }, [responses.data])

  const filteredForms = useMemo(() => {
    const query = normalizeText(searchText.trim())
    return (forms.data ?? [])
      .filter((item) => {
        if (categoryFilter !== "all" && categoryGroup(item).key !== categoryFilter) {
          return false
        }
        if (!query) return true
        return normalizeText(
          [
            item.title,
            item.category,
            item.description,
            scopeLabel(item),
            ...item.questions,
          ].join(" ")
        ).includes(query)
      })
      .slice()
      .sort((left, right) => {
        if (sortBy === "responses") {
          const difference =
            (responsesByFormId.get(right.id) ?? 0) -
            (responsesByFormId.get(left.id) ?? 0)
          if (difference !== 0) return difference
        }
        if (sortBy === "recent") {
          const difference =
            new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
          if (difference !== 0) return difference
        }
        return left.title.localeCompare(right.title, "pt-BR")
      })
  }, [categoryFilter, forms.data, responsesByFormId, searchText, sortBy])

  const totalPages = Math.max(1, Math.ceil(filteredForms.length / FORMS_PER_PAGE))
  const visiblePage = Math.min(currentPage, totalPages)
  const paginatedForms = filteredForms.slice(
    (visiblePage - 1) * FORMS_PER_PAGE,
    visiblePage * FORMS_PER_PAGE
  )

  const selectedForm =
    paginatedForms.find((item) => item.id === selectedFormId) ??
    paginatedForms[0] ??
    null

  const stats = useMemo(() => {
    const formRows = forms.data ?? []
    const responseRows = responses.data ?? []
    const today = localDateKey()
    return {
      activeForms: formRows.length,
      totalResponses: responseRows.length,
      responsesToday: responseRows.filter((item) => item.submitted_at.startsWith(today)).length,
      pending: draftFormIds.size,
      lastActivity: responseRows[0]?.submitted_at ?? null,
    }
  }, [draftFormIds.size, forms.data, responses.data])

  const questionSplitIndex = selectedForm
    ? Math.max(1, Math.ceil(selectedForm.questions.length / 2))
    : 0
  const questionSteps = selectedForm
    ? [
        selectedForm.questions.slice(0, questionSplitIndex),
        selectedForm.questions.slice(questionSplitIndex),
      ]
    : [[], []]

  function selectOperationalForm(item: OperationalForm) {
    const draft = loadFormDraft(item.id)
    setSelectedFormId(item.id)
    setAnswers(draft?.answers ?? {})
    setResponseNotes(draft?.notes ?? "")
    setCurrentStep(0)
    setStepError("")
    setDraftNotice(draft ? "Rascunho recuperado." : "")
  }

  function resetResponse() {
    setAnswers({})
    setResponseNotes("")
    setCurrentStep(0)
    setStepError("")
    setDraftNotice("")
  }

  function saveDraft() {
    if (!selectedForm || typeof window === "undefined") return
    window.localStorage.setItem(
      draftStorageKey(selectedForm.id),
      JSON.stringify({ answers, notes: responseNotes } satisfies FormDraft)
    )
    setDraftFormIds((current) => new Set(current).add(selectedForm.id))
    setDraftNotice("Rascunho salvo neste dispositivo.")
  }

  function advanceStep() {
    const requiredQuestions = questionSteps[currentStep] ?? []
    const hasInvalidAnswer = requiredQuestions.some(
      (question) => !isValidAnswer(question, answers[question])
    )
    if (hasInvalidAnswer) {
      setStepError("Preencha corretamente os campos desta etapa antes de continuar.")
      return
    }
    setStepError("")
    setDraftNotice("")
    setCurrentStep((step) => Math.min(2, step + 1))
  }

  function previousStep() {
    setStepError("")
    setDraftNotice("")
    setCurrentStep((step) => Math.max(0, step - 1))
  }

  function showSelectedModel() {
    if (!selectedForm) return
    setExpandedFormIds((current) => new Set(current).add(selectedForm.id))
    setView("models")
  }

  function resetForm() {
    setForm(emptyForm)
    setEditing(null)
  }

  function openCreate() {
    resetForm()
    setForm((current) => ({ ...current, branch_id: selectedBranchId ?? "" }))
    setOpen(true)
  }

  function openEdit(item: OperationalForm) {
    setEditing(item)
    setForm({
      branch_id: item.branch_id ?? "",
      sector_id: item.sector_id ?? "",
      title: item.title,
      description: item.description ?? "",
      category: item.category ?? "",
      questions: item.questions.join("\n"),
    })
    setOpen(true)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const payload = {
      branch_id: form.branch_id || null,
      sector_id: form.sector_id || null,
      title: form.title,
      description: form.description || null,
      category: form.category || null,
      questions: splitQuestions(form.questions),
    }

    if (editing) {
      await updateForm.mutateAsync({ formId: editing.id, values: payload })
    } else {
      await createForm.mutateAsync(payload)
    }

    resetForm()
    setOpen(false)
  }

  async function handleResponseSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedForm) return

    await submitResponse.mutateAsync({
      form_id: selectedForm.id,
      branch_id: selectedBranchId ?? null,
      answers,
      notes: responseNotes || null,
    })

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(draftStorageKey(selectedForm.id))
    }
    setDraftFormIds((current) => {
      const next = new Set(current)
      next.delete(selectedForm.id)
      return next
    })
    resetResponse()
  }

  function removeForm(item: OperationalForm) {
    setDeleteTarget(item)
  }

  function toggleFormExpanded(formId: string) {
    const newExpanded = new Set(expandedFormIds)
    if (newExpanded.has(formId)) {
      newExpanded.delete(formId)
    } else {
      newExpanded.add(formId)
    }
    setExpandedFormIds(newExpanded)
  }

  const isSaving = createForm.isPending || updateForm.isPending

  return (
    <>
      <PageHeader
        title="Formularios"
        description="Colete informacoes, auditorias e registros de forma simples e eficiente."
        action={
          <Dialog open={open} onOpenChange={(nextOpen) => {
            setOpen(nextOpen)
            if (!nextOpen) resetForm()
          }}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}>
                <Plus className="size-4" />
                Novo formulario
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editing ? "Editar formulario" : "Novo formulario"}
                </DialogTitle>
              </DialogHeader>
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="grid gap-3 sm:grid-cols-2">
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

                <label className="space-y-1 text-sm">
                  <span className="font-medium">Titulo</span>
                  <Input
                    required
                    value={form.title}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, title: event.target.value }))
                    }
                  />
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Categoria</span>
                    <Input
                      list="operational-form-categories"
                      value={form.category}
                      placeholder="Atendimento, Fiscal, Operacional ou RH"
                      onChange={(event) =>
                        setForm((current) => ({ ...current, category: event.target.value }))
                      }
                    />
                    <datalist id="operational-form-categories">
                      <option value="Atendimento" />
                      <option value="Fiscal" />
                      <option value="Operacional" />
                      <option value="RH" />
                    </datalist>
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Descricao</span>
                    <Input
                      value={form.description}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, description: event.target.value }))
                      }
                    />
                  </label>
                </div>

                <label className="space-y-1 text-sm">
                  <span className="font-medium">Perguntas</span>
                  <textarea
                    required
                    className={textareaClass}
                    placeholder="Uma pergunta por linha"
                    value={form.questions}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, questions: event.target.value }))
                    }
                  />
                </label>

                <DialogFooter>
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? "Salvando..." : "Salvar formulario"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="space-y-4 p-4 sm:p-6">
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          {[
            {
              label: "Formularios ativos",
              value: stats.activeForms,
              detail: "Disponiveis no escopo",
              icon: <FileText className="size-4" />,
              tone: "bg-violet-50 text-violet-600",
            },
            {
              label: "Respostas hoje",
              value: stats.responsesToday,
              detail: "Enviadas no dia atual",
              icon: <CheckCircle2 className="size-4" />,
              tone: "bg-emerald-50 text-emerald-600",
            },
            {
              label: "Pendentes",
              value: stats.pending,
              detail: "Rascunhos neste dispositivo",
              icon: <Clock3 className="size-4" />,
              tone: "bg-amber-50 text-amber-600",
            },
            {
              label: "Ultima atividade",
              value: activityTime(stats.lastActivity),
              detail: activityDate(stats.lastActivity),
              icon: <Users className="size-4" />,
              tone: "bg-sky-50 text-sky-600",
            },
          ].map((metric) => (
            <div
              key={metric.label}
              className="flex min-h-20 items-center gap-3 rounded-lg border bg-[color:var(--bg-surface)] px-3 py-3 shadow-sm"
            >
              <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", metric.tone)}>
                {metric.icon}
              </span>
              <div className="min-w-0">
                <div className="truncate text-[11px] font-medium text-muted-foreground">
                  {metric.label}
                </div>
                <div className="mt-0.5 text-xl font-semibold leading-none">{metric.value}</div>
                <div className="mt-1 truncate text-[10px] text-muted-foreground">
                  {metric.detail}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-lg border bg-[color:var(--bg-surface)] p-1 shadow-sm">
          {formViews.map(([key, label]) => {
            const count =
              key === "responses"
                ? stats.totalResponses
                : key === "models"
                  ? stats.activeForms
                  : stats.activeForms
            return (
              <Button
                key={key}
                type="button"
                size="sm"
                variant={view === key ? "default" : "ghost"}
                className="h-8 shrink-0 rounded-md px-3 text-xs"
                onClick={() => {
                  setView(key)
                  if (key !== "respond") {
                    setSearchText("")
                    setCategoryFilter("all")
                    setSortBy("name")
                    setCurrentPage(1)
                  }
                }}
              >
                {label}
                <span className="ml-1 text-[10px] opacity-75">{count}</span>
              </Button>
            )
          })}
        </div>

        {forms.isLoading || responses.isLoading ? (
          <StateBlock type="loading" title="Carregando formularios" />
        ) : forms.isError ? (
          <StateBlock
            type="error"
            title="Erro ao carregar formularios"
            description={forms.error.message}
          />
        ) : responses.isError ? (
          <StateBlock
            type="error"
            title="Erro ao carregar respostas"
            description={responses.error.message}
          />
        ) : view === "respond" ? (
          <div className="grid items-start gap-4 xl:grid-cols-[23rem_minmax(0,1fr)]">
            <section className="overflow-hidden rounded-lg border bg-[color:var(--bg-surface)] shadow-sm">
              <div className="space-y-2 border-b p-3">
                <div className="grid grid-cols-[minmax(0,1fr)_8.5rem] gap-2">
                  <label className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-8"
                      value={searchText}
                      placeholder="Buscar formulario..."
                      aria-label="Buscar formulario"
                      onChange={(event) => {
                        setSearchText(event.target.value)
                        setCurrentPage(1)
                        resetResponse()
                      }}
                    />
                  </label>
                  <label className="relative">
                    <ArrowUpDown className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <select
                      className={cn(fieldClass, "pl-8")}
                      value={sortBy}
                      aria-label="Ordenar formularios"
                      onChange={(event) => {
                        setSortBy(event.target.value as FormSort)
                        setCurrentPage(1)
                        resetResponse()
                      }}
                    >
                      <option value="name">A-Z</option>
                      <option value="responses">Mais usados</option>
                      <option value="recent">Recentes</option>
                    </select>
                  </label>
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                  {[
                    ["all", "Todos"],
                    ["atendimento", "Atendimento"],
                    ["fiscal", "Fiscal"],
                    ["operacional", "Operacional"],
                    ["rh", "RH"],
                    ["outros", "Outros"],
                  ].map(([key, label]) => (
                    <Button
                      key={key}
                      type="button"
                      size="sm"
                      variant={categoryFilter === key ? "default" : "outline"}
                      className="h-7 shrink-0 rounded-md px-2.5 text-[11px]"
                      onClick={() => {
                        setCategoryFilter(key)
                        setCurrentPage(1)
                        resetResponse()
                      }}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>

              {filteredForms.length === 0 ? (
                <StateBlock
                  className="min-h-52"
                  title={stats.activeForms === 0 ? "Nenhum formulario" : "Nenhum resultado"}
                  description={
                    stats.activeForms === 0
                      ? "Cadastre o primeiro modelo para iniciar."
                      : "Revise a busca ou a categoria selecionada."
                  }
                />
              ) : (
                <div className="space-y-1.5 p-2">
                  {paginatedForms.map((item) => {
                    const isSelected = selectedForm?.id === item.id
                    const category = categoryGroup(item)
                    const latestActivity = latestResponseByFormId.get(item.id) ?? null
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg border p-2 text-left transition-colors",
                          isSelected
                            ? "border-primary bg-primary/5 ring-1 ring-primary/10"
                            : "border-[color:var(--border-soft)] hover:bg-[color:var(--bg-surface-soft)]"
                        )}
                        onClick={() => selectOperationalForm(item)}
                      >
                        <CategoryIcon categoryKey={category.key} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="min-w-0 truncate text-xs font-semibold">
                              {item.title}
                            </span>
                            <Badge
                              variant="outline"
                              className={cn("h-4 shrink-0 px-1 text-[9px]", category.className)}
                            >
                              {category.label}
                            </Badge>
                          </div>
                          <div className="mt-1 flex gap-1.5 text-[10px] text-muted-foreground">
                            <span>{item.questions.length} perguntas</span>
                            <span>{responsesByFormId.get(item.id) ?? 0} respostas</span>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
                          <span>{latestActivity ? activityTime(latestActivity) : "--:--"}</span>
                          <ChevronRight className="size-3.5" />
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}

              <div className="flex items-center justify-between gap-2 border-t px-3 py-2 text-[10px] text-muted-foreground">
                <span>
                  {filteredForms.length === 0
                    ? "Nenhum formulario"
                    : `${(visiblePage - 1) * FORMS_PER_PAGE + 1}-${Math.min(
                        visiblePage * FORMS_PER_PAGE,
                        filteredForms.length
                      )} de ${filteredForms.length}`}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    className="size-7"
                    disabled={visiblePage <= 1}
                    aria-label="Pagina anterior"
                    onClick={() => {
                      setCurrentPage((page) => Math.max(1, page - 1))
                      setSelectedFormId("")
                      resetResponse()
                    }}
                  >
                    <ChevronLeft className="size-3.5" />
                  </Button>
                  <span className="min-w-12 text-center text-xs font-medium text-foreground">
                    {visiblePage} / {totalPages}
                  </span>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    className="size-7"
                    disabled={visiblePage >= totalPages}
                    aria-label="Proxima pagina"
                    onClick={() => {
                      setCurrentPage((page) => Math.min(totalPages, page + 1))
                      setSelectedFormId("")
                      resetResponse()
                    }}
                  >
                    <ChevronRight className="size-3.5" />
                  </Button>
                </div>
              </div>
            </section>

            <section className="min-w-0 overflow-hidden rounded-lg border bg-[color:var(--bg-surface)] shadow-sm">
              {!selectedForm ? (
                <StateBlock className="min-h-96" title="Selecione um formulario" />
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <CategoryIcon
                        categoryKey={categoryGroup(selectedForm).key}
                        className="size-10"
                      />
                      <div className="min-w-0">
                        <h2 className="truncate text-base font-semibold">{selectedForm.title}</h2>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                          <Badge
                            variant="outline"
                            className={categoryGroup(selectedForm).className}
                          >
                            {categoryGroup(selectedForm).label}
                          </Badge>
                          <span>{scopeLabel(selectedForm)}</span>
                          <Badge
                            variant="outline"
                            className="border-emerald-200 bg-emerald-50 text-emerald-700"
                          >
                            Ativo
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={showSelectedModel}>
                        <Eye className="size-4" />
                        Ver modelo
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="outline"
                        aria-label="Editar formulario"
                        onClick={() => openEdit(selectedForm)}
                      >
                        <Edit3 className="size-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="border-b bg-[color:var(--bg-surface-soft)]/60 px-4 py-4">
                    <div className="mx-auto grid max-w-2xl grid-cols-[auto_1fr_auto_1fr_auto] items-start gap-2">
                      {["Dados iniciais", "Complemento", "Confirmacao"].map((label, index) => (
                        <div key={label} className="contents">
                          <div className="flex min-w-20 flex-col items-center text-center">
                            <span
                              className={cn(
                                "flex size-7 items-center justify-center rounded-full border text-xs font-semibold",
                                index <= currentStep
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-[color:var(--border-strong)] bg-[color:var(--bg-surface)] text-[color:var(--text-muted)]"
                              )}
                            >
                              {index + 1}
                            </span>
                            <span
                              className={cn(
                                "mt-1 text-[10px] font-medium",
                                index === currentStep ? "text-primary" : "text-muted-foreground"
                              )}
                            >
                              {label}
                            </span>
                          </div>
                          {index < 2 ? (
                            <div
                              className={cn(
                                "mt-3.5 h-px min-w-6",
                                index < currentStep ? "bg-primary" : "bg-slate-300"
                              )}
                            />
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>

                  <form onSubmit={handleResponseSubmit}>
                    <div className="min-h-64 p-4 sm:p-5">
                      {selectedForm.description && currentStep === 0 ? (
                        <p className="mb-4 text-sm leading-5 text-[color:var(--text-muted)]">
                          {selectedForm.description}
                        </p>
                      ) : null}

                      {currentStep < 2 ? (
                        <div className="grid gap-x-4 gap-y-3 md:grid-cols-2">
                          {(questionSteps[currentStep] ?? []).map((question) => {
                            const kind = questionFieldKind(question)
                            const isLongAnswer = kind === "long_text"
                            const inputType =
                              kind === "email" || kind === "date" || kind === "time"
                                ? kind
                                : "text"
                            return (
                              <label
                                key={question}
                                className={cn(
                                  "space-y-1 text-sm",
                                  isLongAnswer && "md:col-span-2"
                                )}
                              >
                                <span className="text-xs font-medium">{question}</span>
                                {isLongAnswer ? (
                                  <textarea
                                    required
                                    className="min-h-20 w-full rounded-lg border bg-[color:var(--bg-surface)] px-2.5 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"
                                    value={answers[question] ?? ""}
                                    onChange={(event) =>
                                      setAnswers((current) => ({
                                        ...current,
                                        [question]: event.target.value,
                                      }))
                                    }
                                  />
                                ) : (
                                  <Input
                                    required
                                    type={inputType}
                                    inputMode={kind === "cpf" || kind === "phone" ? "numeric" : undefined}
                                    maxLength={kind === "cpf" ? 14 : kind === "phone" ? 15 : undefined}
                                    pattern={
                                      kind === "cpf"
                                        ? "[0-9]{3}\\.[0-9]{3}\\.[0-9]{3}-[0-9]{2}"
                                        : kind === "phone"
                                          ? "\\([0-9]{2}\\) [0-9]{4,5}-[0-9]{4}"
                                          : undefined
                                    }
                                    autoComplete={
                                      kind === "email"
                                        ? "email"
                                        : kind === "phone"
                                          ? "tel"
                                          : undefined
                                    }
                                    value={answers[question] ?? ""}
                                    onChange={(event) =>
                                      setAnswers((current) => ({
                                        ...current,
                                        [question]: normalizeAnswer(kind, event.target.value),
                                      }))
                                    }
                                  />
                                )}
                              </label>
                            )
                          })}
                          {currentStep === 1 ? (
                            <label className="space-y-1 text-sm md:col-span-2">
                              <span className="text-xs font-medium">Observacao geral</span>
                              <textarea
                                className="min-h-20 w-full rounded-lg border bg-[color:var(--bg-surface)] px-2.5 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"
                                value={responseNotes}
                                onChange={(event) => setResponseNotes(event.target.value)}
                              />
                            </label>
                          ) : null}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="grid gap-3 md:grid-cols-2">
                            {selectedForm.questions.map((question) => (
                              <div key={question} className="rounded-lg border bg-[color:var(--bg-surface-soft)] px-3 py-2">
                                <div className="text-[11px] font-medium text-muted-foreground">
                                  {question}
                                </div>
                                <div className="mt-1 break-words text-sm">
                                  {answers[question] || "Nao informado"}
                                </div>
                              </div>
                            ))}
                          </div>
                          {responseNotes ? (
                            <div className="rounded-lg border bg-[color:var(--bg-surface-soft)] px-3 py-2">
                              <div className="text-[11px] font-medium text-muted-foreground">
                                Observacao geral
                              </div>
                              <p className="mt-1 whitespace-pre-wrap text-sm">{responseNotes}</p>
                            </div>
                          ) : null}
                        </div>
                      )}

                      {stepError ? (
                        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                          {stepError}
                        </div>
                      ) : null}
                      {draftNotice ? (
                        <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700">
                          {draftNotice}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-[color:var(--bg-surface-soft)]/50 px-4 py-3">
                      <Button type="button" size="sm" variant="outline" onClick={resetResponse}>
                        Cancelar
                      </Button>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={saveDraft}>
                          <Save className="size-4" />
                          Salvar rascunho
                        </Button>
                        {currentStep > 0 ? (
                          <Button type="button" size="sm" variant="ghost" onClick={previousStep}>
                            <ChevronLeft className="size-4" />
                            Voltar
                          </Button>
                        ) : null}
                        {currentStep < 2 ? (
                          <Button type="button" size="sm" onClick={advanceStep}>
                            Proximo
                            <ChevronRight className="size-4" />
                          </Button>
                        ) : (
                          <Button type="submit" size="sm" disabled={submitResponse.isPending}>
                            <Send className="size-4" />
                            {submitResponse.isPending ? "Enviando..." : "Enviar respostas"}
                          </Button>
                        )}
                      </div>
                    </div>
                  </form>
                </>
              )}
            </section>
          </div>
        ) : view === "models" ? (
          <div className="space-y-2">
            {filteredForms.length === 0 ? (
              <StateBlock
                title={stats.activeForms === 0 ? "Nenhum modelo cadastrado" : "Nenhum resultado"}
                description={
                  stats.activeForms === 0
                    ? "Crie um formulario para disponibiliza-lo ao time."
                    : "Revise a busca ou o filtro selecionado."
                }
              />
            ) : (
              filteredForms.map((item) => {
                const isExpanded = expandedFormIds.has(item.id)
                const category = categoryGroup(item)
                return (
                  <div key={item.id} className="overflow-hidden rounded-lg border bg-[color:var(--bg-surface)] shadow-sm">
                    <div className="flex items-center gap-2 px-3 py-2.5">
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                        aria-expanded={isExpanded}
                        onClick={() => toggleFormExpanded(item.id)}
                      >
                        <ChevronDown
                          className={cn(
                            "size-4 shrink-0 transition-transform",
                            !isExpanded && "-rotate-90"
                          )}
                        />
                        <FileText className="size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                          {item.title}
                        </span>
                        <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                          {scopeLabel(item)}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn("hidden shrink-0 sm:inline-flex", category.className)}
                        >
                          {category.label}
                        </Badge>
                        <Badge variant="outline" className="shrink-0">
                          {responsesByFormId.get(item.id) ?? 0} respostas
                        </Badge>
                      </button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="outline"
                        onClick={() => openEdit(item)}
                        aria-label="Editar formulario"
                      >
                        <Edit3 className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="destructive"
                        onClick={() => removeForm(item)}
                        aria-label="Excluir formulario"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    {isExpanded ? (
                      <div className="border-t bg-[color:var(--bg-surface-soft)]/60 px-4 py-3">
                        {item.description ? (
                          <p className="mb-3 text-sm leading-5 text-[color:var(--text-muted)]">
                            {item.description}
                          </p>
                        ) : null}
                        <div className="grid gap-2 md:grid-cols-2">
                          {item.questions.map((question, index) => (
                            <div key={question} className="flex items-start gap-2 text-sm">
                              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[color:var(--bg-surface)] text-[10px] font-semibold text-[color:var(--text-muted)] ring-1 ring-slate-200">
                                {index + 1}
                              </span>
                              <span className="min-w-0 break-words">{question}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )
              })
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {(responses.data ?? []).length === 0 ? (
              <StateBlock title="Sem respostas registradas" />
            ) : (
              (responses.data ?? []).map((response) => (
                <details key={response.id} className="group overflow-hidden rounded-lg border bg-[color:var(--bg-surface)] shadow-sm">
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-3">
                    <ChevronDown className="size-4 shrink-0 -rotate-90 transition-transform group-open:rotate-0" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">
                        {response.operational_forms?.title ?? "Formulario"}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {response.branches?.name ?? "Empresa"} - {response.user_profiles?.name ?? "Usuario"}
                      </div>
                    </div>
                    <div className="hidden text-right text-xs text-muted-foreground sm:block">
                      {formatDateTimeBR(response.submitted_at)}
                    </div>
                    <Badge variant="outline" className="shrink-0">
                      {Object.keys(response.answers).length} respostas
                    </Badge>
                  </summary>
                  <div className="border-t bg-[color:var(--bg-surface-soft)]/60 px-4 py-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      {Object.entries(response.answers).map(([question, answer]) => (
                        <div key={question}>
                          <div className="text-xs font-medium text-muted-foreground">
                            {question}
                          </div>
                          <div className="mt-0.5 whitespace-pre-wrap break-words text-sm">
                            {String(answer)}
                          </div>
                        </div>
                      ))}
                    </div>
                    {response.notes ? (
                      <div className="mt-3 border-t pt-3">
                        <div className="text-xs font-medium text-muted-foreground">
                          Observacao geral
                        </div>
                        <p className="mt-0.5 whitespace-pre-wrap text-sm">{response.notes}</p>
                      </div>
                    ) : null}
                  </div>
                </details>
              ))
            )}
          </div>
        )}

        {createForm.error || updateForm.error || deleteForm.error || submitResponse.error ? (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <ClipboardList className="size-4" />
            {(createForm.error || updateForm.error || deleteForm.error || submitResponse.error)?.message}
          </div>
        ) : null}
      </div>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => {
        if (!open) setDeleteTarget(null)
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir formulario</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Deseja excluir permanentemente "{deleteTarget?.title}"?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={deleteForm.isPending}
              onClick={() => {
                if (!deleteTarget) return
                void deleteForm.mutateAsync(deleteTarget.id).then(() => {
                  setDeleteTarget(null)
                })
              }}
            >
              {deleteForm.isPending ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
