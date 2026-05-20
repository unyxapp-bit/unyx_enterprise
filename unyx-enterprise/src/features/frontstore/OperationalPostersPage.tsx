import { useEffect, useMemo, useState } from "react"
import type { FormEvent } from "react"
import {
  Archive,
  FileText,
  ImageIcon,
  LayoutTemplate,
  Plus,
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
  formatLabel,
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
  onConfirm: () => Promise<void>
}

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
  const posters = useOperationalPosters()
  const branches = useBranches()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<OperationalPoster | null>(null)
  const [form, setForm] = useState<PosterForm>(emptyPosterForm)
  const [filters, setFilters] = useState<PosterFiltersState>(emptyPosterFilters)
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
  const filteredRows = useMemo(
    () => rows.filter((poster) => posterMatchesFilters(poster, filters)),
    [filters, rows]
  )

  const stats = useMemo(
    () => ({
      total: rows.length,
      templates: rows.filter((poster) => poster.template_key).length,
      attention: rows.filter((poster) => poster.tone === "attention").length,
      a4: rows.filter((poster) => poster.format === "a4").length,
    }),
    [rows]
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
      onConfirm: async () => {
        await updatePoster.mutateAsync({
          posterId: poster.id,
          values: { active: false },
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
            value={stats.total}
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
            icon={ImageIcon}
            label="Formato A4"
            value={stats.a4}
            detail={formatLabel.a4}
          />
        </div>

        <PosterFilters
          filters={filters}
          branches={branches.data ?? []}
          sectors={filterSectors.data ?? []}
          total={rows.length}
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
        ) : rows.length === 0 ? (
          <StateBlock
            title="Nenhum cartaz"
            description="Crie ofertas, avisos internos e materiais simples para impressao."
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
              <Archive className="size-4" />
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
              variant="destructive"
              disabled={confirming}
              onClick={() => void confirmCurrentAction()}
            >
              {confirming ? "Arquivando..." : confirmAction?.confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {printPoster ? <PrintablePoster poster={printPoster} /> : null}
    </>
  )
}
