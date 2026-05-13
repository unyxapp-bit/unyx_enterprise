import { useEffect, useMemo, useState } from "react"
import type { FormEvent } from "react"
import {
  Edit3,
  Megaphone,
  Plus,
  Printer,
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
  useCreateOperationalPoster,
  useDeleteOperationalPoster,
  useOperationalPosters,
  useSectors,
  useUpdateOperationalPoster,
} from "@/hooks/useUnyxData"
import { formatDateTimeBR } from "@/lib/format"
import { useAppStore } from "@/store/useAppStore"
import type {
  OperationalPoster,
  OperationalPosterFormat,
  OperationalPosterTone,
} from "@/types/domain"

const fieldClass =
  "h-8 w-full rounded-lg border bg-white px-2.5 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"

const textareaClass =
  "min-h-28 w-full rounded-lg border bg-white px-2.5 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"

const toneLabel: Record<OperationalPosterTone, string> = {
  neutral: "Neutro",
  info: "Informativo",
  attention: "Atencao",
  urgent: "Urgente",
  success: "Positivo",
}

const formatLabel: Record<OperationalPosterFormat, string> = {
  a4: "A4",
  a5: "A5",
  thermal: "Bobina",
}

const emptyForm = {
  branch_id: "",
  sector_id: "",
  title: "",
  subtitle: "",
  body: "",
  footer: "",
  tone: "attention" as OperationalPosterTone,
  format: "a4" as OperationalPosterFormat,
}

function toneClasses(tone: OperationalPosterTone) {
  if (tone === "urgent") return "border-red-300 bg-red-50 text-red-950"
  if (tone === "attention") return "border-amber-300 bg-amber-50 text-amber-950"
  if (tone === "success") return "border-emerald-300 bg-emerald-50 text-emerald-950"
  if (tone === "info") return "border-sky-300 bg-sky-50 text-sky-950"
  return "border-slate-200 bg-white text-slate-950"
}

function scopeLabel(poster: OperationalPoster) {
  const branch = poster.branches?.name ?? "Toda empresa"
  return poster.sectors?.name ? `${branch} - ${poster.sectors.name}` : branch
}

function PrintablePoster({ poster }: { poster: OperationalPoster }) {
  return (
    <div className={`poster-print-root poster-tone-${poster.tone} poster-format-${poster.format}`}>
      <div className="poster-print-page">
        {poster.subtitle ? <div className="poster-print-subtitle">{poster.subtitle}</div> : null}
        <div className="poster-print-title">{poster.title}</div>
        <div className="poster-print-body">{poster.body}</div>
        {poster.footer ? <div className="poster-print-footer">{poster.footer}</div> : null}
      </div>
    </div>
  )
}

export function OperationalPostersPage() {
  const selectedBranchId = useAppStore((state) => state.selectedBranchId)
  const posters = useOperationalPosters()
  const branches = useBranches()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<OperationalPoster | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [printPoster, setPrintPoster] = useState<OperationalPoster | null>(null)

  const sectors = useSectors(form.branch_id || null)
  const createPoster = useCreateOperationalPoster()
  const updatePoster = useUpdateOperationalPoster()
  const deletePoster = useDeleteOperationalPoster()

  const stats = useMemo(() => {
    const rows = posters.data ?? []
    return {
      total: rows.length,
      urgent: rows.filter((poster) => poster.tone === "urgent").length,
      attention: rows.filter((poster) => poster.tone === "attention").length,
      a4: rows.filter((poster) => poster.format === "a4").length,
    }
  }, [posters.data])

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
    setForm(emptyForm)
    setEditing(null)
  }

  function openCreate() {
    resetForm()
    setForm((current) => ({ ...current, branch_id: selectedBranchId ?? "" }))
    setOpen(true)
  }

  function openEdit(poster: OperationalPoster) {
    setEditing(poster)
    setForm({
      branch_id: poster.branch_id ?? "",
      sector_id: poster.sector_id ?? "",
      title: poster.title,
      subtitle: poster.subtitle ?? "",
      body: poster.body,
      footer: poster.footer ?? "",
      tone: poster.tone,
      format: poster.format,
    })
    setOpen(true)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const payload = {
      branch_id: form.branch_id || null,
      sector_id: form.sector_id || null,
      title: form.title,
      subtitle: form.subtitle || null,
      body: form.body,
      footer: form.footer || null,
      tone: form.tone,
      format: form.format,
    }

    if (editing) {
      await updatePoster.mutateAsync({ posterId: editing.id, values: payload })
    } else {
      await createPoster.mutateAsync(payload)
    }

    resetForm()
    setOpen(false)
  }

  function removePoster(poster: OperationalPoster) {
    if (!window.confirm(`Excluir o cartaz "${poster.title}"?`)) return
    void deletePoster.mutateAsync(poster.id)
  }

  const isSaving = createPoster.isPending || updatePoster.isPending

  return (
    <>
      <PageHeader
        title="Cartazes"
        description="Crie avisos de loja, comunicados de frente e cartazes internos prontos para imprimir."
        action={
          <Dialog open={open} onOpenChange={(nextOpen) => {
            setOpen(nextOpen)
            if (!nextOpen) resetForm()
          }}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}>
                <Plus className="size-4" />
                Novo cartaz
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editing ? "Editar cartaz" : "Novo cartaz"}</DialogTitle>
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
                  <span className="font-medium">Titulo principal</span>
                  <Input
                    required
                    value={form.title}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, title: event.target.value }))
                    }
                  />
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-medium">Subtitulo</span>
                  <Input
                    value={form.subtitle}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, subtitle: event.target.value }))
                    }
                  />
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-medium">Mensagem</span>
                  <textarea
                    required
                    className={textareaClass}
                    value={form.body}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, body: event.target.value }))
                    }
                  />
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-medium">Rodape</span>
                  <Input
                    value={form.footer}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, footer: event.target.value }))
                    }
                  />
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Tom</span>
                    <select
                      className={fieldClass}
                      value={form.tone}
                      onChange={(event) =>
                        setForm((current) => ({
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
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Formato</span>
                    <select
                      className={fieldClass}
                      value={form.format}
                      onChange={(event) =>
                        setForm((current) => ({
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
                </div>

                <DialogFooter>
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? "Salvando..." : "Salvar cartaz"}
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
              <div className="text-xs text-muted-foreground">Cartazes</div>
              <div className="text-2xl font-semibold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card className="border bg-white shadow-sm">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Urgentes</div>
              <div className="text-2xl font-semibold">{stats.urgent}</div>
            </CardContent>
          </Card>
          <Card className="border bg-white shadow-sm">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Atencao</div>
              <div className="text-2xl font-semibold">{stats.attention}</div>
            </CardContent>
          </Card>
          <Card className="border bg-white shadow-sm">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">A4</div>
              <div className="text-2xl font-semibold">{stats.a4}</div>
            </CardContent>
          </Card>
        </div>

        {posters.isLoading ? (
          <StateBlock type="loading" title="Carregando cartazes" />
        ) : posters.isError ? (
          <StateBlock
            type="error"
            title="Erro ao carregar cartazes"
            description={posters.error.message}
          />
        ) : (posters.data ?? []).length === 0 ? (
          <StateBlock
            title="Nenhum cartaz"
            description="Crie avisos internos, orientacoes para loja e materiais simples para impressao."
          />
        ) : (
          <div className="grid gap-4 xl:grid-cols-3">
            {(posters.data ?? []).map((poster) => (
              <Card key={poster.id} className="border bg-white shadow-sm">
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Megaphone className="size-4 shrink-0" />
                      <span className="break-words">{poster.title}</span>
                    </CardTitle>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="outline">{toneLabel[poster.tone]}</Badge>
                      <Badge variant="secondary">{formatLabel[poster.format]}</Badge>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {scopeLabel(poster)} - {formatDateTimeBR(poster.created_at)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className={`rounded-lg border p-4 text-center ${toneClasses(poster.tone)}`}>
                    {poster.subtitle ? (
                      <div className="text-xs font-semibold uppercase tracking-wide">
                        {poster.subtitle}
                      </div>
                    ) : null}
                    <div className="mt-2 text-2xl font-black uppercase leading-tight">
                      {poster.title}
                    </div>
                    <div className="mt-3 whitespace-pre-wrap text-sm font-medium leading-6">
                      {poster.body}
                    </div>
                    {poster.footer ? (
                      <div className="mt-4 border-t pt-2 text-xs font-semibold">
                        {poster.footer}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setPrintPoster(poster)}
                    >
                      <Printer className="size-4" />
                      Imprimir
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => openEdit(poster)}
                    >
                      <Edit3 className="size-4" />
                      Editar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => removePoster(poster)}
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

        {createPoster.error || updatePoster.error || deletePoster.error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {(createPoster.error || updatePoster.error || deletePoster.error)?.message}
          </div>
        ) : null}
      </div>

      {printPoster ? <PrintablePoster poster={printPoster} /> : null}
    </>
  )
}
