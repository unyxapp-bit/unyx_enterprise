import { useEffect, useMemo, useState } from "react"
import type { FormEvent } from "react"
import {
  Archive,
  FileText,
  LayoutTemplate,
  Plus,
  RotateCcw,
  Sparkles,
} from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/PageHeader"
import { StateBlock } from "@/components/shared/StateBlock"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  useBranches,
  useCreateOperationalPoster,
  useOperationalPosters,
  useSectors,
  useUpdateOperationalPoster,
} from "@/hooks/useUnyxData"
import { useAppStore } from "@/store/useAppStore"
import { PrintablePoster } from "@/features/frontstore/posters/PosterCanvas"
import { PosterCard } from "@/features/frontstore/posters/PosterCard"
import { PosterEditorDialog } from "@/features/frontstore/posters/PosterEditorDialog"
import {
  PosterFilters,
  type PosterFiltersState,
} from "@/features/frontstore/posters/PosterFilters"
import { downloadPosterAsPng } from "@/features/frontstore/posters/posterExport"
import {
  getPosterTemplate,
  posterTemplates,
  toneLabel,
} from "@/features/frontstore/posters/posterConfig"
import {
  emptyPosterForm,
  formToPosterPayload,
  posterToDuplicatePayload,
  posterToForm,
  scopeLabel,
  type PosterForm,
} from "@/features/frontstore/posters/posterModel"
import type { OperationalPoster } from "@/types/domain"

type ConfirmAction = {
  title: string
  description: string
  confirmLabel: string
  pendingLabel: string
  tone: "archive" | "restore"
  onConfirm: () => Promise<void>
}

type PosterLibraryView = "active" | "archived"

const emptyPosterFilters: PosterFiltersState = {
  search: "",
  branchId: "all",
  sectorId: "all",
  format: "all",
  tone: "all",
  templateKey: "all",
}

function StatCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof FileText
  label: string
  value: number
  detail: string
}) {
  return (
    <Card className="border bg-white shadow-sm">
      <CardContent className="flex items-center gap-3 p-4">
        <span className="inline-flex size-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold leading-tight">{value}</div>
          <div className="truncate text-xs text-muted-foreground">{detail}</div>
        </div>
      </CardContent>
    </Card>
  )
}

function posterMatchesFilters(poster: OperationalPoster, filters: PosterFiltersState) {
  const search = filters.search.trim().toLowerCase()
  const templateKey = poster.template_key ?? "blank"
  const searchable = [
    poster.title,
    poster.body,
    poster.subtitle,
    poster.footer,
    poster.product_name,
    poster.product_description,
    poster.price_text,
    poster.sale_unit,
    scopeLabel(poster),
    getPosterTemplate(poster.template_key).name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  if (search && !searchable.includes(search)) return false
  if (filters.branchId === "global" && poster.branch_id) return false
  if (
    filters.branchId !== "all" &&
    filters.branchId !== "global" &&
    poster.branch_id !== filters.branchId
  ) {
    return false
  }
  if (filters.sectorId === "global" && poster.sector_id) return false
  if (
    filters.sectorId !== "all" &&
    filters.sectorId !== "global" &&
    poster.sector_id !== filters.sectorId
  ) {
    return false
  }
  if (filters.format !== "all" && poster.format !== filters.format) return false
  if (filters.tone !== "all" && poster.tone !== filters.tone) return false
  if (filters.templateKey !== "all" && templateKey !== filters.templateKey) return false

  return true
}

export function OperationalPostersPage() {
  const selectedBranchId = useAppStore((state) => state.selectedBranchId)
  const posters = useOperationalPosters("all")
  const branches = useBranches()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<OperationalPoster | null>(null)
  const [form, setForm] = useState<PosterForm>(emptyPosterForm)
  const [filters, setFilters] = useState<PosterFiltersState>(emptyPosterFilters)
  const [libraryView, setLibraryView] = useState<PosterLibraryView>("active")
  const [printPoster, setPrintPoster] = useState<OperationalPoster | null>(null)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const [confirming, setConfirming] = useState(false)

  const formSectors = useSectors(form.branch_id || null)
  const filterBranchId =
    filters.branchId === "all" || filters.branchId === "global" ? null : filters.branchId
  const filterSectors = useSectors(filterBranchId)
  const createPoster = useCreateOperationalPoster()
  const updatePoster = useUpdateOperationalPoster()

  const rows = useMemo(() => posters.data ?? [], [posters.data])
  const activeRows = useMemo(() => rows.filter((poster) => poster.active), [rows])
  const archivedRows = useMemo(() => rows.filter((poster) => !poster.active), [rows])
  const libraryRows = libraryView === "active" ? activeRows : archivedRows
  const filteredRows = useMemo(
    () => libraryRows.filter((poster) => posterMatchesFilters(poster, filters)),
    [filters, libraryRows]
  )

  const stats = useMemo(
    () => ({
      total: rows.length,
      active: activeRows.length,
      archived: archivedRows.length,
      templates: activeRows.filter((poster) => poster.template_key).length,
      attention: activeRows.filter((poster) => poster.tone === "attention").length,
      a4: activeRows.filter((poster) => poster.format === "a4").length,
    }),
    [activeRows, archivedRows, rows]
  )

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
    setForm(emptyPosterForm)
    setEditing(null)
  }

  function openCreate() {
    resetForm()
    setForm((current) => ({ ...current, branch_id: selectedBranchId ?? "" }))
    setOpen(true)
  }

  function openEdit(poster: OperationalPoster) {
    setEditing(poster)
    setForm(posterToForm(poster))
    setOpen(true)
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) resetForm()
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const payload = formToPosterPayload(form)

    if (editing) {
      await updatePoster.mutateAsync({ posterId: editing.id, values: payload })
    } else {
      await createPoster.mutateAsync(payload)
    }

    resetForm()
    setOpen(false)
  }

  async function duplicatePoster(poster: OperationalPoster) {
    await createPoster.mutateAsync(posterToDuplicatePayload(poster))
  }

  function archivePoster(poster: OperationalPoster) {
    setConfirmAction({
      title: "Arquivar cartaz",
      description: `O cartaz "${poster.product_name ?? poster.title}" saira da biblioteca ativa, mas o historico de auditoria continuara registrado.`,
      confirmLabel: "Arquivar",
      pendingLabel: "Arquivando...",
      tone: "archive",
      onConfirm: async () => {
        await updatePoster.mutateAsync({
          posterId: poster.id,
          values: { active: false },
        })
      },
    })
  }

  function restorePoster(poster: OperationalPoster) {
    setConfirmAction({
      title: "Restaurar cartaz",
      description: `O cartaz "${poster.product_name ?? poster.title}" voltara para a biblioteca ativa e podera ser impresso novamente.`,
      confirmLabel: "Restaurar",
      pendingLabel: "Restaurando...",
      tone: "restore",
      onConfirm: async () => {
        await updatePoster.mutateAsync({
          posterId: poster.id,
          values: { active: true },
        })
      },
    })
  }

  async function exportPosterPng(poster: OperationalPoster) {
    try {
      await downloadPosterAsPng(poster)
      toast.success("PNG gerado.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel gerar o PNG.")
    }
  }

  async function confirmCurrentAction() {
    if (!confirmAction) return
    setConfirming(true)
    try {
      await confirmAction.onConfirm()
      setConfirmAction(null)
    } finally {
      setConfirming(false)
    }
  }

  const isSaving = createPoster.isPending || updatePoster.isPending
  const mutationError = createPoster.error || updatePoster.error

  return (
    <>
      <PageHeader
        title="Cartazes"
        description="Crie, filtre, imprima e reutilize materiais de loja com modelos padronizados."
        action={
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Novo cartaz
          </Button>
        }
      />

      <PosterEditorDialog
        open={open}
        editing={editing}
        form={form}
        branches={branches.data ?? []}
        sectors={formSectors.data ?? []}
        isSaving={isSaving}
        onFormChange={setForm}
        onOpenChange={handleOpenChange}
        onSubmit={handleSubmit}
      />

      <div className="space-y-5 p-4 lg:p-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={FileText}
            label="Cartazes ativos"
            value={stats.active}
            detail="Biblioteca disponivel"
          />
          <StatCard
            icon={LayoutTemplate}
            label="Com modelo"
            value={stats.templates}
            detail={`${posterTemplates.length - 1} modelos cadastrados`}
          />
          <StatCard
            icon={Sparkles}
            label="Atencao"
            value={stats.attention}
            detail={toneLabel.attention}
          />
          <StatCard
            icon={Archive}
            label="Arquivados"
            value={stats.archived}
            detail="Fora da biblioteca ativa"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-white p-2 shadow-sm">
          <div className="flex flex-wrap gap-1">
            <Button
              type="button"
              size="sm"
              variant={libraryView === "active" ? "default" : "ghost"}
              onClick={() => setLibraryView("active")}
            >
              <FileText className="size-4" />
              Ativos
              <span className="ml-1 rounded bg-white/20 px-1.5 text-xs">
                {stats.active}
              </span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant={libraryView === "archived" ? "default" : "ghost"}
              onClick={() => setLibraryView("archived")}
            >
              <Archive className="size-4" />
              Arquivados
              <span className="ml-1 rounded bg-white/20 px-1.5 text-xs">
                {stats.archived}
              </span>
            </Button>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {libraryView === "active"
              ? "Cartazes disponiveis para edicao, impressao e exportacao."
              : "Cartazes arquivados podem ser restaurados ou duplicados."}
          </div>
        </div>

        <PosterFilters
          filters={filters}
          branches={branches.data ?? []}
          sectors={filterSectors.data ?? []}
          total={libraryRows.length}
          visible={filteredRows.length}
          onChange={setFilters}
          onClear={() => setFilters(emptyPosterFilters)}
        />

        {posters.isLoading ? (
          <StateBlock type="loading" title="Carregando cartazes" />
        ) : posters.isError ? (
          <StateBlock
            type="error"
            title="Erro ao carregar cartazes"
            description={posters.error.message}
          />
        ) : libraryRows.length === 0 ? (
          <StateBlock
            title={libraryView === "active" ? "Nenhum cartaz ativo" : "Nenhum cartaz arquivado"}
            description={
              libraryView === "active"
                ? "Crie ofertas, avisos internos e materiais simples para impressao."
                : "Cartazes arquivados aparecem aqui quando saem da biblioteca ativa."
            }
          />
        ) : filteredRows.length === 0 ? (
          <StateBlock
            title="Nenhum resultado"
            description="Ajuste os filtros para encontrar outros cartazes."
          />
        ) : (
          <div className="grid gap-4 xl:grid-cols-3">
            {filteredRows.map((poster) => (
              <PosterCard
                key={poster.id}
                poster={poster}
                busy={isSaving}
                onArchive={archivePoster}
                onDuplicate={(row) => void duplicatePoster(row)}
                onEdit={openEdit}
                onExportPng={(row) => void exportPosterPng(row)}
                onPrint={setPrintPoster}
                onRestore={restorePoster}
              />
            ))}
          </div>
        )}

        {mutationError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {mutationError.message}
          </div>
        ) : null}
      </div>

      <Dialog
        open={Boolean(confirmAction)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setConfirmAction(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {confirmAction?.tone === "restore" ? (
                <RotateCcw className="size-4" />
              ) : (
                <Archive className="size-4" />
              )}
              {confirmAction?.title}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{confirmAction?.description}</p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={confirming}
              onClick={() => setConfirmAction(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant={confirmAction?.tone === "restore" ? "default" : "destructive"}
              disabled={confirming}
              onClick={() => void confirmCurrentAction()}
            >
              {confirming ? confirmAction?.pendingLabel : confirmAction?.confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {printPoster ? <PrintablePoster poster={printPoster} /> : null}
    </>
  )
}
