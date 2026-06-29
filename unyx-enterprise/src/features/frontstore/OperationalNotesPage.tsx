import { useMemo, useState } from "react"
import type { DragEvent, FormEvent } from "react"
import {
  Archive,
  AlertTriangle,
  CheckCircle2,
  ClipboardEdit,
  CircleDot,
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
import { cn } from "@/lib/utils"
import { useAppStore } from "@/store/useAppStore"
import type {
  OperationalNote,
  OperationalNoteStatus,
  OperationalSupportPriority,
} from "@/types/domain"

const fieldClass =
  "h-8 w-full rounded-lg border bg-[color:var(--bg-surface)] px-2.5 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"

const textareaClass =
  "min-h-28 w-full rounded-lg border bg-[color:var(--bg-surface)] px-2.5 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"

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

const noteColumns: Array<{
  status: OperationalNoteStatus
  title: string
  empty: string
  icon: typeof CircleDot
  badgeClass: string
  iconClass: string
}> = [
  {
    status: "open",
    title: "Em aberto",
    empty: "Arraste uma anotacao para abrir.",
    icon: CircleDot,
    badgeClass: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
    iconClass: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
  },
  {
    status: "in_review",
    title: "Em analise",
    empty: "Arraste uma anotacao para analise.",
    icon: Clock3,
    badgeClass: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
    iconClass: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
  },
  {
    status: "resolved",
    title: "Resolvidas",
    empty: "Arraste uma anotacao resolvida aqui.",
    icon: CheckCircle2,
    badgeClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
    iconClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
  },
  {
    status: "archived",
    title: "Arquivadas",
    empty: "Sem anotacoes arquivadas.",
    icon: Archive,
    badgeClass: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200",
    iconClass: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200",
  },
]

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

function scopeLabel(note: OperationalNote) {
  const branch = note.branches?.name ?? "Toda empresa"
  return note.sectors?.name ? `${branch} - ${note.sectors.name}` : branch
}

export function OperationalNotesPage() {
  const selectedBranchId = useAppStore((state) => state.selectedBranchId)
  const [statusFilter, setStatusFilter] = useState<OperationalNoteStatus | "all">("all")
  const [priorityFilter, setPriorityFilter] = useState<OperationalSupportPriority | "all">("all")
  const [searchText, setSearchText] = useState("")
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<OperationalNote | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<OperationalNote | null>(null)
  const [draggingNoteId, setDraggingNoteId] = useState<string | null>(null)
  const [dragOverStatus, setDragOverStatus] = useState<OperationalNoteStatus | null>(null)
  const [renderTime] = useState(() => Date.now())
  const [form, setForm] = useState(emptyForm)

  const notes = useOperationalNotes("all")
  const branches = useBranches()
  const sectors = useSectors(form.branch_id || selectedBranchId || null)
  const createNote = useCreateOperationalNote()
  const updateNote = useUpdateOperationalNote()
  const deleteNote = useDeleteOperationalNote()

  const filteredNotes = useMemo(() => {
    const query = searchText.trim().toLowerCase()
    return (notes.data ?? []).filter((note) => {
      if (statusFilter !== "all" && note.status !== statusFilter) return false
      if (priorityFilter !== "all" && note.priority !== priorityFilter) return false
      if (!query) return true
      return [note.title, note.content, note.category, scopeLabel(note)]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query))
    })
  }, [notes.data, priorityFilter, searchText, statusFilter])

  const visibleColumns = useMemo(() => {
    const hasArchived = filteredNotes.some((note) => note.status === "archived")
    return noteColumns.filter((column) => {
      if (statusFilter !== "all") return column.status === statusFilter
      if (column.status === "archived") return hasArchived
      return true
    })
  }, [filteredNotes, statusFilter])

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

  async function setNoteStatus(note: OperationalNote, status: OperationalNoteStatus) {
    if (note.status === status) return
    await updateNote.mutateAsync({
      noteId: note.id,
      values: { status },
    })
  }

  function handleDragStart(event: DragEvent<HTMLDivElement>, note: OperationalNote) {
    setDraggingNoteId(note.id)
    event.dataTransfer.effectAllowed = "move"
    event.dataTransfer.setData("text/plain", note.id)
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>, status: OperationalNoteStatus) {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
    setDragOverStatus((current) => (current === status ? null : current))
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>, status: OperationalNoteStatus) {
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
    setDragOverStatus(status)
  }

  function handleDrop(event: DragEvent<HTMLDivElement>, status: OperationalNoteStatus) {
    event.preventDefault()
    const noteId = event.dataTransfer.getData("text/plain") || draggingNoteId
    const note = (notes.data ?? []).find((item) => item.id === noteId)
    setDraggingNoteId(null)
    setDragOverStatus(null)
    if (!note) return
    void setNoteStatus(note, status)
  }

  function isOverdue(note: OperationalNote) {
    return Boolean(
      note.due_at &&
        note.status !== "resolved" &&
        note.status !== "archived" &&
        new Date(note.due_at).getTime() < renderTime
    )
  }

  function primaryStatusAction(note: OperationalNote) {
    if (note.status === "open") {
      return {
        label: "Analisar",
        status: "in_review" as OperationalNoteStatus,
        icon: Clock3,
      }
    }
    if (note.status === "in_review") {
      return {
        label: "Resolver",
        status: "resolved" as OperationalNoteStatus,
        icon: CheckCircle2,
      }
    }
    return {
      label: "Reabrir",
      status: "open" as OperationalNoteStatus,
      icon: CircleDot,
    }
  }

  function removeNote(note: OperationalNote) {
    setDeleteTarget(note)
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
              className={cn(fieldClass, "w-40 text-xs")}
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
            <select
              className={cn(fieldClass, "w-44 text-xs")}
              value={priorityFilter}
              onChange={(event) =>
                setPriorityFilter(event.target.value as OperationalSupportPriority | "all")
              }
            >
              <option value="all">Todas prioridades</option>
              {(Object.keys(priorityLabel) as OperationalSupportPriority[]).map((priority) => (
                <option key={priority} value={priority}>
                  {priorityLabel[priority]}
                </option>
              ))}
            </select>
            <Input
              className="h-8 w-52 text-xs"
              type="search"
              placeholder="Buscar anotacao..."
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />
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

      <div className="space-y-4 p-4 sm:p-5">
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
        ) : filteredNotes.length === 0 ? (
          <StateBlock
            title="Nenhuma anotacao neste filtro"
            description="Ajuste busca, status ou prioridade para ampliar a lista."
          />
        ) : (
          <div
            className={cn(
              "grid gap-3",
              visibleColumns.length === 1 && "grid-cols-1",
              visibleColumns.length === 2 && "lg:grid-cols-2",
              visibleColumns.length === 3 && "lg:grid-cols-3",
              visibleColumns.length >= 4 && "lg:grid-cols-2 2xl:grid-cols-4"
            )}
          >
            {visibleColumns.map((column) => {
              const Icon = column.icon
              const columnNotes = filteredNotes.filter(
                (note) => note.status === column.status
              )
              return (
                <section
                  key={column.status}
                  className="overflow-hidden rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-soft)] shadow-sm"
                >
                  <div className="flex h-12 items-center justify-between gap-2 border-b border-[color:var(--border-soft)] px-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-lg",
                          column.iconClass
                        )}
                      >
                        <Icon className="size-4" />
                      </span>
                      <span className="truncate text-sm font-semibold text-[color:var(--text-primary)]">
                        {column.title}
                      </span>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                        column.badgeClass
                      )}
                    >
                      {columnNotes.length}
                    </span>
                  </div>

                  <div
                    className={cn(
                      "min-h-[22rem] space-y-2 p-2.5 transition-colors",
                      dragOverStatus === column.status &&
                        "bg-[color:var(--bg-surface)]"
                    )}
                    onDragOver={(event) => handleDragOver(event, column.status)}
                    onDragLeave={(event) => handleDragLeave(event, column.status)}
                    onDrop={(event) => handleDrop(event, column.status)}
                  >
                    {columnNotes.length === 0 ? (
                      <div className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[color:var(--border-soft)] text-center text-xs text-[color:var(--text-muted)]">
                        <StickyNote className="size-5 opacity-50" />
                        <span>{column.empty}</span>
                      </div>
                    ) : (
                      columnNotes.map((note) => {
                        const overdue = isOverdue(note)
                        const action = primaryStatusAction(note)
                        const ActionIcon = action.icon
                        return (
                          <div
                            key={note.id}
                            draggable
                            onDragStart={(event) => handleDragStart(event, note)}
                            onDragEnd={() => {
                              setDraggingNoteId(null)
                              setDragOverStatus(null)
                            }}
                            className={cn(
                              "cursor-grab rounded-lg border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] p-3 shadow-sm transition active:cursor-grabbing",
                              "hover:border-[color:var(--border-strong)]",
                              draggingNoteId === note.id && "opacity-40",
                              overdue && "border-amber-300 bg-amber-50 dark:bg-amber-500/10"
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex min-w-0 items-start gap-2">
                                <span
                                  className={cn(
                                    "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg",
                                    column.iconClass
                                  )}
                                >
                                  <StickyNote className="size-3.5" />
                                </span>
                                <div className="min-w-0">
                                  <h3 className="break-words text-sm font-semibold leading-5 text-[color:var(--text-primary)]">
                                    {note.title}
                                  </h3>
                                  <p className="mt-0.5 truncate text-[11px] text-[color:var(--text-muted)]">
                                    {scopeLabel(note)} - {formatDateTimeBR(note.created_at)}
                                  </p>
                                </div>
                              </div>
                              <Badge variant={priorityVariant(note.priority)}>
                                {priorityLabel[note.priority]}
                              </Badge>
                            </div>

                            <p className="mt-3 max-h-20 overflow-hidden whitespace-pre-wrap rounded-lg border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-soft)] px-3 py-2 text-xs leading-5 text-[color:var(--text-secondary)]">
                              {note.content}
                            </p>

                            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-[color:var(--text-muted)]">
                              {note.category ? (
                                <Badge variant="outline">{note.category}</Badge>
                              ) : null}
                              <span>{note.user_profiles?.name ?? "Usuario"}</span>
                              {note.due_at ? (
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1",
                                    overdue && "font-medium text-amber-700 dark:text-amber-200"
                                  )}
                                >
                                  <Clock3 className="size-3" />
                                  Prazo {formatDateTimeBR(note.due_at)}
                                </span>
                              ) : null}
                              {note.priority === "urgent" ? (
                                <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-300">
                                  <AlertTriangle className="size-3" />
                                  Atencao imediata
                                </span>
                              ) : null}
                            </div>

                            <div className="mt-3 flex flex-wrap gap-1.5">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={updateNote.isPending}
                                onClick={() => void setNoteStatus(note, action.status)}
                              >
                                <ActionIcon className="size-3.5" />
                                {action.label}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => openEdit(note)}
                              >
                                <Edit3 className="size-3.5" />
                                Editar
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                onClick={() => removeNote(note)}
                              >
                                <Trash2 className="size-3.5" />
                                Excluir
                              </Button>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </section>
              )
            })}
          </div>
        )}

        {createNote.error || updateNote.error || deleteNote.error ? (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-[color:var(--text-secondary)]">
            <ClipboardEdit className="size-4" />
            {(createNote.error || updateNote.error || deleteNote.error)?.message}
          </div>
        ) : null}
      </div>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => {
        if (!open) setDeleteTarget(null)
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir anotacao</DialogTitle>
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
              disabled={deleteNote.isPending}
              onClick={() => {
                if (!deleteTarget) return
                void deleteNote.mutateAsync(deleteTarget.id).then(() => {
                  setDeleteTarget(null)
                })
              }}
            >
              {deleteNote.isPending ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
