import { useMemo, useState } from "react"
import type { FormEvent } from "react"
import { BookOpen, CheckCircle2, Clock, GraduationCap, Plus } from "lucide-react"

import { BentoGrid } from "@/components/bento/BentoGrid"
import { MetricCard } from "@/components/bento/MetricCard"
import { PageHeader } from "@/components/shared/PageHeader"
import { StateBlock } from "@/components/shared/StateBlock"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  useCreateTrainingItem,
  useSetTrainingProgress,
  useTrainingItems,
  useTrainingProgress,
} from "@/hooks/useUnyxData"
import type { TrainingType } from "@/types/domain"

const fieldClass =
  "h-8 w-full rounded-lg border bg-white px-2.5 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"

const trainingTypeLabel: Record<TrainingType, string> = {
  article: "Artigo",
  video: "Video",
  checklist: "Checklist",
  link: "Link",
}

export function AcademyPage() {
  const items = useTrainingItems()
  const progress = useTrainingProgress()
  const createItem = useCreateTrainingItem()
  const setProgress = useSetTrainingProgress()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    title: "",
    type: "link" as TrainingType,
    content_url: "",
    duration_minutes: "",
  })

  const stats = useMemo(() => {
    const completedIds = new Set(
      (progress.data ?? [])
        .filter((item) => item.completed)
        .map((item) => item.training_id)
    )
    const total = items.data?.length ?? 0
    const completed = (items.data ?? []).filter((item) =>
      completedIds.has(item.id)
    ).length
    const minutes = (items.data ?? []).reduce(
      (sum, item) => sum + (item.duration_minutes ?? 0),
      0
    )
    const percent = total === 0 ? 0 : Math.round((completed / total) * 100)

    return { completedIds, total, completed, minutes, percent }
  }, [items.data, progress.data])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    await createItem.mutateAsync({
      title: form.title.trim(),
      type: form.type,
      content_url: form.content_url.trim() || null,
      duration_minutes: form.duration_minutes
        ? Number(form.duration_minutes)
        : null,
    })

    setForm({
      title: "",
      type: "link",
      content_url: "",
      duration_minutes: "",
    })
    setOpen(false)
  }

  return (
    <>
      <PageHeader
        title="Unyx Academy"
        description="Treinamentos, onboarding e progresso de capacitacao da equipe."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4" />
                Novo treinamento
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Cadastrar treinamento</DialogTitle>
                <DialogDescription>
                  Crie um conteudo simples para ser acompanhado pelo time.
                </DialogDescription>
              </DialogHeader>

              <form className="space-y-4" onSubmit={handleSubmit}>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Titulo</span>
                  <Input
                    required
                    value={form.title}
                    onChange={(e) =>
                      setForm((current) => ({ ...current, title: e.target.value }))
                    }
                  />
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Tipo</span>
                    <select
                      className={fieldClass}
                      value={form.type}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          type: e.target.value as TrainingType,
                        }))
                      }
                    >
                      {Object.entries(trainingTypeLabel).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Duracao (min)</span>
                    <Input
                      type="number"
                      min={1}
                      value={form.duration_minutes}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          duration_minutes: e.target.value,
                        }))
                      }
                    />
                  </label>
                </div>

                <label className="space-y-1 text-sm">
                  <span className="font-medium">Link do conteudo</span>
                  <Input
                    type="url"
                    placeholder="https://"
                    value={form.content_url}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        content_url: e.target.value,
                      }))
                    }
                  />
                </label>

                {createItem.error ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {createItem.error.message}
                  </div>
                ) : null}

                <DialogFooter>
                  <Button type="submit" disabled={createItem.isPending}>
                    {createItem.isPending ? "Criando..." : "Criar treinamento"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="space-y-6 p-6">
        {items.isLoading || progress.isLoading ? (
          <StateBlock type="loading" title="Carregando treinamentos" />
        ) : items.isError ? (
          <StateBlock
            type="error"
            title="Erro ao carregar Unyx Academy"
            description={`${items.error.message}. Rode o SQL atualizado no Supabase se as tabelas ainda nao existirem.`}
          />
        ) : progress.isError ? (
          <StateBlock
            type="error"
            title="Erro ao carregar progresso"
            description={progress.error.message}
          />
        ) : (
          <>
            <BentoGrid>
              <MetricCard
                title="Treinamentos"
                value={stats.total}
                detail="Conteudos ativos"
                icon={<BookOpen className="size-5" />}
              />
              <MetricCard
                title="Concluidos"
                value={stats.completed}
                detail={`${stats.percent}% do percurso`}
                icon={<CheckCircle2 className="size-5" />}
              />
              <MetricCard
                title="Carga estimada"
                value={`${stats.minutes} min`}
                detail="Somando conteudos ativos"
                icon={<Clock className="size-5" />}
              />
              <MetricCard
                title="Onboarding"
                value={stats.percent === 100 && stats.total > 0 ? "Completo" : "Em curso"}
                detail="Status do usuario atual"
                icon={<GraduationCap className="size-5" />}
              />
            </BentoGrid>

            {(items.data ?? []).length === 0 ? (
              <StateBlock
                title="Nenhum treinamento cadastrado"
                description="Adicione o primeiro conteudo para estruturar o onboarding."
              />
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                {(items.data ?? []).map((item) => {
                  const completed = stats.completedIds.has(item.id)

                  return (
                    <Card key={item.id} className="border bg-white shadow-sm">
                      <CardHeader>
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <CardTitle>{item.title}</CardTitle>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {item.duration_minutes
                                ? `${item.duration_minutes} min`
                                : "Sem duracao definida"}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <Badge variant="outline">
                              {trainingTypeLabel[item.type]}
                            </Badge>
                            <Badge variant={completed ? "default" : "outline"}>
                              {completed ? "Concluido" : "Pendente"}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="flex flex-wrap items-center gap-2">
                        {item.content_url ? (
                          <a
                            className="inline-flex h-8 items-center justify-center rounded-lg border bg-white px-2.5 text-sm font-medium hover:bg-slate-100"
                            href={item.content_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Abrir conteudo
                          </a>
                        ) : null}
                        <Button
                          variant={completed ? "outline" : "default"}
                          onClick={() =>
                            setProgress.mutate({
                              trainingId: item.id,
                              completed: !completed,
                            })
                          }
                          disabled={setProgress.isPending}
                        >
                          {completed ? "Reabrir" : "Marcar como concluido"}
                        </Button>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
