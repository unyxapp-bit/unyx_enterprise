import { useMemo, useState } from "react"
import type { FormEvent } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardEdit,
  Clock3,
  Edit3,
  Plus,
  StickyNote,
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
  useCreateOperationalNote,
  useDeleteOperationalNote,
  useOperationalNotes,
  useSectors,
  useUpdateOperationalNote,
} from "@/hooks/useUnyxData"
import { formatDateTimeBR } from "@/lib/format"
import { useAppStore } from "@/store/useAppStore"
import type {
  OperationalNote,
  OperationalNoteStatus,
  OperationalSupportPriority,
} from "@/types/domain"

const fieldClass =
  "h-8 w-full rounded-lg border bg-white px-2.5 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"

const textareaClass =
  "min-h-28 w-full rounded-lg border bg-white px-2.5 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"

const priorityLabel: Record<OperationalSupportPriority, string> = {
  low: "Baixa",
  normal: "Normal",
  high: "Alta",
  urgent: "Urgente",
}

const statusLabel: Record<OperationalNoteStatus, string> = {
  open: "Aberta",
  in_review: "Em analise",
  resolved: "Resolvida",
  archived: "Arquivada",
}

const emptyForm = {
  branch_id: "",
  sector_id: "",
  title: "",
  content: "",
  category: "",
  priority: "normal" as OperationalSupportPriority,
  status: "open" as OperationalNoteStatus,
  due_at: "",
}

function priorityVariant(priority: OperationalSupportPriority) {
  if (priority === "urgent") return "destructive"
  if (priority === "high") return "secondary"
  return "outline"
}

function statusVariant(status: OperationalNoteStatus) {
  if (status === "resolved") return "default"
  if (status === "archived") return "secondary"
  if (status === "in_review") return "outline"
  return "destructive"
}

function scopeLabel(note: OperationalNote) {
  const branch = note.branches?.name ?? "Toda empresa"
  return note.sectors?.name ? `${branch} - ${note.sectors.name}` : branch
}

export function OperationalNotesPage() {
  const selectedBranchId = useAppStore((state) => state.selectedBranchId)
  const [statusFilter, setStatusFilter] = useState<OperationalNoteStatus | "all">("all")
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<OperationalNote | null>(null)
  const [form, setForm] = useState(emptyForm)

  const notes = useOperationalNotes(statusFilter)
  const branches = useBranches()
  const sectors = useSectors(form.branch_id || selectedBranchId || null)
  const createNote = useCreateOperationalNote()
  const updateNote = useUpdateOperationalNote()
  const deleteNote = useDeleteOperationalNote()

  const stats = useMemo(() => {
    const rows = notes.data ?? []
    return {
      open: rows.filter((note) => note.status === "open").length,
      review: rows.filter((note) => note.status === "in_review").length,
      urgent: rows.filter((note) => note.priority === "urgent").length,
      total: rows.length,
    }
  }, [notes.data])

  function resetForm() {
    setForm(emptyForm)
    setEditing(null)
  }

  function openCreate() {
    resetForm()
    setForm((current) => ({ ...current, branch_id: selectedBranchId ?? "" }))
    setOpen(true)
  }

  function openEdit(note: OperationalNote) {
    setEditing(note)
    setForm({
      branch_id: note.branch_id ?? "",
      sector_id: note.sector_id ?? "",
      title: note.title,
      content: note.content,
      category: note.category ?? "",
      priority: note.priority,
      status: note.status,
      due_at: note.due_at ? note.due_at.slice(0, 16) : "",
    })
    setOpen(true)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const payload = {
      branch_id: form.branch_id || null,
      sector_id: form.sector_id || null,
      title: form.title,
      content: form.content,
      category: form.category || null,
      priority: form.priority,
      status: form.status,
      due_at: form.due_at || null,
    }

    if (editing) {
      await updateNote.mutateAsync({ noteId: editing.id, values: payload })
    } else {
      await createNote.mutateAsync(payload)
    }

    resetForm()
    setOpen(false)
  }

  async function resolveNote(note: OperationalNote) {
    await updateNote.mutateAsync({
      noteId: note.id,
      values: { status: note.status === "resolved" ? "open" : "resolved" },
    })
  }

  function removeNote(note: OperationalNote) {
    if (!window.confirm(`Excluir a anotacao "${note.title}"?`)) return
    void deleteNote.mutateAsync(note.id)
  }

  const isPending = createNote.isPending || updateNote.isPending

  return (
    <>
      <PageHeader
        title="Anotacoes"
        description="Pendencias, ocorrencias e lembretes operacionais para fiscais de frente de loja."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <select
              className={fieldClass}
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as OperationalNoteStatus | "all")
              }
            >
              <option value="all">Todos status</option>
              {(Object.keys(statusLabel) as OperationalNoteStatus[]).map((status) => (
                <option key={status} value={status}>
                  {statusLabel[status]}
                </option>
              ))}
            </select>
            <Dialog open={open} onOpenChange={(nextOpen) => {
              setOpen(nextOpen)
              if (!nextOpen) resetForm()
            }}>
              <DialogTrigger asChild>
                <Button onClick={openCreate}>
                  <Plus className="size-4" />
                  Nova anotacao
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editing ? "Editar anotacao" : "Nova anotacao"}
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

                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Conteudo</span>
                    <textarea
                      required
                      className={textareaClass}
                      value={form.content}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, content: event.target.value }))
                      }
                    />
                  </label>

                  <div className="grid gap-3 sm:grid-cols-4">
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">Categoria</span>
                      <Input
                        value={form.category}
                        placeholder="Loja, caixa, ruptura..."
                        onChange={(event) =>
                          setForm((current) => ({ ...current, category: event.target.value }))
                        }
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">Prioridade</span>
                      <select
                        className={fieldClass}
                        value={form.priority}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            priority: event.target.value as OperationalSupportPriority,
                          }))
                        }
                      >
                        {(Object.keys(priorityLabel) as OperationalSupportPriority[]).map((priority) => (
                          <option key={priority} value={priority}>
                            {priorityLabel[priority]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">Status</span>
                      <select
                        className={fieldClass}
                        value={form.status}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            status: event.target.value as OperationalNoteStatus,
                          }))
                        }
                      >
                        {(Object.keys(statusLabel) as OperationalNoteStatus[]).map((status) => (
                          <option key={status} value={status}>
                            {statusLabel[status]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">Prazo</span>
                      <Input
                        type="datetime-local"
                        value={form.due_at}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, due_at: event.target.value }))
                        }
                      />
                    </label>
                  </div>

                  <DialogFooter>
                    <Button type="submit" disabled={isPending}>
                      {isPending ? "Salvando..." : "Salvar anotacao"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="space-y-6 p-6">
        <div className="grid gap-3 sm:grid-cols-4">
          <Card className="border bg-white shadow-sm">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="text-2xl font-semibold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card className="border bg-white shadow-sm">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Abertas</div>
              <div className="text-2xl font-semibold">{stats.open}</div>
            </CardContent>
          </Card>
          <Card className="border bg-white shadow-sm">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Em analise</div>
              <div className="text-2xl font-semibold">{stats.review}</div>
            </CardContent>
          </Card>
          <Card className="border bg-white shadow-sm">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Urgentes</div>
              <div className="text-2xl font-semibold">{stats.urgent}</div>
            </CardContent>
          </Card>
        </div>

        {notes.isLoading ? (
          <StateBlock type="loading" title="Carregando anotacoes" />
        ) : notes.isError ? (
          <StateBlock
            type="error"
            title="Erro ao carregar anotacoes"
            description={notes.error.message}
          />
        ) : (notes.data ?? []).length === 0 ? (
          <StateBlock
            title="Nenhuma anotacao"
            description="Registre pendencias, ocorrencias e orientacoes para a frente de loja."
          />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {(notes.data ?? []).map((note) => (
              <Card key={note.id} className="border bg-white shadow-sm">
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <StickyNote className="size-4 shrink-0" />
                        <span className="break-words">{note.title}</span>
                      </CardTitle>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {scopeLabel(note)} - {formatDateTimeBR(note.created_at)}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant={statusVariant(note.status)}>
                        {statusLabel[note.status]}
                      </Badge>
                      <Badge variant={priorityVariant(note.priority)}>
                        {priorityLabel[note.priority]}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="whitespace-pre-wrap rounded-lg border bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                    {note.content}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {note.category ? (
                      <Badge variant="outline">{note.category}</Badge>
                    ) : null}
                    <span>{note.user_profiles?.name ?? "Usuario"}</span>
                    {note.due_at ? (
                      <span className="inline-flex items-center gap-1">
                        <Clock3 className="size-3.5" />
                        Prazo {formatDateTimeBR(note.due_at)}
                      </span>
                    ) : null}
                    {note.priority === "urgent" ? (
                      <span className="inline-flex items-center gap-1 text-red-600">
                        <AlertTriangle className="size-3.5" />
                        Atencao imediata
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void resolveNote(note)}
                    >
                      <CheckCircle2 className="size-4" />
                      {note.status === "resolved" ? "Reabrir" : "Resolver"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => openEdit(note)}
                    >
                      <Edit3 className="size-4" />
                      Editar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => removeNote(note)}
                    >
                      <Trash2 className="size-4" />
                      Excluir
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {createNote.error || updateNote.error || deleteNote.error ? (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <ClipboardEdit className="size-4" />
            {(createNote.error || updateNote.error || deleteNote.error)?.message}
          </div>
        ) : null}
      </div>
    </>
  )
}
