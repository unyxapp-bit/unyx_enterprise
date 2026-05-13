import { useMemo, useState } from "react"
import type { FormEvent } from "react"
import {
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  Edit3,
  FileText,
  History,
  Plus,
  Send,
  Trash2,
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
  useCreateOperationalForm,
  useDeleteOperationalForm,
  useOperationalFormResponses,
  useOperationalForms,
  useSectors,
  useSubmitOperationalFormResponse,
  useUpdateOperationalForm,
} from "@/hooks/useUnyxData"
import { formatDateTimeBR } from "@/lib/format"
import { useAppStore } from "@/store/useAppStore"
import type { OperationalForm } from "@/types/domain"

const fieldClass =
  "h-8 w-full rounded-lg border bg-white px-2.5 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"

const textareaClass =
  "min-h-28 w-full rounded-lg border bg-white px-2.5 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"

const emptyForm = {
  branch_id: "",
  sector_id: "",
  title: "",
  description: "",
  category: "",
  questions: "",
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

  const sectors = useSectors(form.branch_id || null)
  const createForm = useCreateOperationalForm()
  const updateForm = useUpdateOperationalForm()
  const deleteForm = useDeleteOperationalForm()
  const submitResponse = useSubmitOperationalFormResponse()

  const selectedForm =
    (forms.data ?? []).find((item) => item.id === selectedFormId) ??
    (forms.data ?? [])[0] ??
    null

  const stats = useMemo(() => {
    const formRows = forms.data ?? []
    const responseRows = responses.data ?? []
    const today = new Date().toISOString().slice(0, 10)
    return {
      forms: formRows.length,
      questions: formRows.reduce((sum, item) => sum + item.questions.length, 0),
      responses: responseRows.length,
      today: responseRows.filter((item) => item.submitted_at.startsWith(today)).length,
    }
  }, [forms.data, responses.data])

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

    setAnswers({})
    setResponseNotes("")
  }

  function removeForm(item: OperationalForm) {
    if (!window.confirm(`Excluir o formulario "${item.title}"?`)) return
    void deleteForm.mutateAsync(item.id)
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
        description="Coleta padronizada para rondas, conferencias e registros de fiscais."
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
                      value={form.category}
                      placeholder="Ronda, limpeza, ruptura..."
                      onChange={(event) =>
                        setForm((current) => ({ ...current, category: event.target.value }))
                      }
                    />
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

      <div className="space-y-6 p-6">
        <div className="grid gap-3 sm:grid-cols-4">
          <Card className="border bg-white shadow-sm">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Formularios</div>
              <div className="text-2xl font-semibold">{stats.forms}</div>
            </CardContent>
          </Card>
          <Card className="border bg-white shadow-sm">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Perguntas</div>
              <div className="text-2xl font-semibold">{stats.questions}</div>
            </CardContent>
          </Card>
          <Card className="border bg-white shadow-sm">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Respostas</div>
              <div className="text-2xl font-semibold">{stats.responses}</div>
            </CardContent>
          </Card>
          <Card className="border bg-white shadow-sm">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Hoje</div>
              <div className="text-2xl font-semibold">{stats.today}</div>
            </CardContent>
          </Card>
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
        ) : (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_1fr]">
            <div className="space-y-4">
              {(forms.data ?? []).length === 0 ? (
                <StateBlock
                  title="Nenhum formulario"
                  description="Crie formularios para rondas, conferencias e pesquisas rapidas."
                />
              ) : (
                (forms.data ?? []).map((item) => {
                  const isExpanded = expandedFormIds.has(item.id)
                  return (
                  <Card key={item.id} className="border bg-white shadow-sm">
                    <CardHeader>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => toggleFormExpanded(item.id)}
                          className="min-w-0 flex-1 text-left transition-opacity hover:opacity-70"
                        >
                          <div className="flex items-start gap-2">
                            <ChevronDown
                              className={`size-4 shrink-0 transition-transform ${
                                isExpanded ? "" : "-rotate-90"
                              }`}
                            />
                            <div className="min-w-0 flex-1">
                              <CardTitle className="flex items-center gap-2 text-base">
                                <FileText className="size-4 shrink-0" />
                                <span className="break-words">{item.title}</span>
                              </CardTitle>
                              <div className="mt-1 text-xs text-muted-foreground">
                                {scopeLabel(item)} - {item.questions.length} pergunta(s)
                              </div>
                            </div>
                          </div>
                        </button>
                        <div className="flex flex-wrap gap-1.5">
                          {item.category ? <Badge variant="outline">{item.category}</Badge> : null}
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
                      </div>
                    </CardHeader>
                    {isExpanded && (
                    <CardContent className="space-y-3">
                      {item.description ? (
                        <p className="whitespace-pre-wrap text-sm text-slate-700">
                          {item.description}
                        </p>
                      ) : null}
                      <div className="grid gap-2">
                        {item.questions.map((question) => (
                          <div key={question} className="rounded-lg border bg-slate-50 px-3 py-2 text-sm">
                            {question}
                          </div>
                        ))}
                      </div>
                      <Button
                        type="button"
                        variant={selectedForm?.id === item.id ? "default" : "outline"}
                        onClick={() => {
                          setSelectedFormId(item.id)
                          setAnswers({})
                          setResponseNotes("")
                        }}
                      >
                        <ClipboardCheck className="size-4" />
                        Responder
                      </Button>
                    </CardContent>
                    )}
                  </Card>
                  )
                })
              )}
            </div>

            <div className="space-y-4">
              <Card className="border bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Send className="size-4" />
                    Responder formulario
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!selectedForm ? (
                    <StateBlock title="Selecione um formulario" />
                  ) : (
                    <form className="space-y-3" onSubmit={handleResponseSubmit}>
                      <div>
                        <div className="font-semibold">{selectedForm.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {scopeLabel(selectedForm)}
                        </div>
                      </div>
                      {selectedForm.questions.map((question) => (
                        <label key={question} className="space-y-1 text-sm">
                          <span className="font-medium">{question}</span>
                          <textarea
                            required
                            className="min-h-16 w-full rounded-lg border bg-white px-2.5 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"
                            value={answers[question] ?? ""}
                            onChange={(event) =>
                              setAnswers((current) => ({
                                ...current,
                                [question]: event.target.value,
                              }))
                            }
                          />
                        </label>
                      ))}
                      <label className="space-y-1 text-sm">
                        <span className="font-medium">Observacao geral</span>
                        <textarea
                          className="min-h-16 w-full rounded-lg border bg-white px-2.5 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"
                          value={responseNotes}
                          onChange={(event) => setResponseNotes(event.target.value)}
                        />
                      </label>
                      <Button type="submit" disabled={submitResponse.isPending}>
                        {submitResponse.isPending ? "Enviando..." : "Enviar respostas"}
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>

              <Card className="border bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <History className="size-4" />
                    Historico recente
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(responses.data ?? []).length === 0 ? (
                    <StateBlock title="Sem respostas" />
                  ) : (
                    (responses.data ?? []).slice(0, 8).map((response) => (
                      <div key={response.id} className="rounded-lg border bg-slate-50 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-sm font-semibold">
                              {response.operational_forms?.title ?? "Formulario"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatDateTimeBR(response.submitted_at)}
                            </div>
                          </div>
                          <Badge variant="outline">
                            {Object.keys(response.answers).length} resp.
                          </Badge>
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          {response.branches?.name ?? "Empresa"} - {response.user_profiles?.name ?? "Usuario"}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {createForm.error || updateForm.error || deleteForm.error || submitResponse.error ? (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <ClipboardList className="size-4" />
            {(createForm.error || updateForm.error || deleteForm.error || submitResponse.error)?.message}
          </div>
        ) : null}
      </div>
    </>
  )
}
