import { useMemo, useState } from "react"
import type { FormEvent } from "react"
import {
  Building2,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  History,
  ListChecks,
  Plus,
  RotateCcw,
  Timer,
} from "lucide-react"

import { useAuth } from "@/app/providers/auth-context"
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
  useBranches,
  useChecklistProcedures,
  useChecklistRuns,
  useCompleteChecklistRun,
  useCreateChecklistProcedure,
  useSectors,
} from "@/hooks/useUnyxData"
import { formatDateTimeBR } from "@/lib/format"
import { useAppStore } from "@/store/useAppStore"
import type {
  ChecklistProcedure,
  ChecklistProcedureFrequency,
  UserRole,
} from "@/types/domain"

const fieldClass =
  "h-8 w-full rounded-lg border bg-white px-2.5 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"

const textareaClass =
  "min-h-24 w-full rounded-lg border bg-white px-2.5 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"

const frequencyLabel: Record<ChecklistProcedureFrequency, string> = {
  daily: "Diario",
  weekly: "Semanal",
  monthly: "Mensal",
  on_demand: "Sob demanda",
}

const frequencyOptions: ChecklistProcedureFrequency[] = [
  "daily",
  "weekly",
  "monthly",
  "on_demand",
]

const managerRoles: UserRole[] = ["owner", "admin", "branch_manager", "supervisor"]

function todayStartISO() {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date.toISOString()
}

function splitChecklistItems(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)
}

function canManageProcedures(role: UserRole | undefined) {
  return Boolean(role && managerRoles.includes(role))
}

function ProcedureCard({
  checkedItems,
  isCompletedToday,
  isPending,
  notes,
  onComplete,
  onNotesChange,
  onReset,
  onToggleItem,
  onToggleAll,
  procedure,
}: {
  checkedItems: string[]
  isCompletedToday: boolean
  isPending: boolean
  notes: string
  onComplete: () => void
  onNotesChange: (value: string) => void
  onReset: () => void
  onToggleItem: (item: string) => void
  onToggleAll: () => void
  procedure: ChecklistProcedure
}) {
  const totalItems = procedure.checklist_items.length
  const checkedCount = checkedItems.length
  const complete = totalItems > 0 && checkedCount === totalItems

  return (
    <Card className="border bg-white shadow-sm">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="size-4 shrink-0" />
              <span className="min-w-0 break-words">{procedure.title}</span>
            </CardTitle>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span>{procedure.branches?.name ?? "Toda empresa"}</span>
              {procedure.sectors?.name ? <span>{procedure.sectors.name}</span> : null}
              {procedure.estimated_minutes ? (
                <span>{procedure.estimated_minutes} min</span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant={isCompletedToday ? "default" : "outline"}>
              {isCompletedToday ? "Feito hoje" : frequencyLabel[procedure.frequency]}
            </Badge>
            {procedure.category ? (
              <Badge variant="secondary">{procedure.category}</Badge>
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {procedure.instructions ? (
          <p className="whitespace-pre-wrap rounded-lg border bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700">
            {procedure.instructions}
          </p>
        ) : null}

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-medium">
              {checkedCount} de {totalItems} itens
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onToggleAll}
              >
                <CheckCircle2 className="size-4" />
                Marcar todos
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={onReset}>
                <RotateCcw className="size-4" />
                Limpar
              </Button>
            </div>
          </div>

          <div className="grid gap-2">
            {procedure.checklist_items.map((item) => {
              const checked = checkedItems.includes(item)
              return (
                <label
                  key={item}
                  className={`flex items-start gap-3 rounded-lg border p-3 text-sm transition-colors ${
                    checked ? "border-emerald-200 bg-emerald-50" : "bg-white"
                  }`}
                >
                  <input
                    className="mt-1"
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleItem(item)}
                  />
                  <span className={checked ? "text-emerald-900" : "text-slate-700"}>
                    {item}
                  </span>
                </label>
              )
            })}
          </div>
        </div>

        <label className="space-y-1 text-sm">
          <span className="font-medium">Observacao da execucao</span>
          <textarea
            className="min-h-16 w-full rounded-lg border bg-white px-2.5 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"
            value={notes}
            onChange={(event) => onNotesChange(event.target.value)}
          />
        </label>

        <Button onClick={onComplete} disabled={!complete || isPending}>
          <ClipboardCheck className="size-4" />
          {isPending ? "Finalizando..." : "Finalizar checklist"}
        </Button>
      </CardContent>
    </Card>
  )
}

export function ChecklistsPage() {
  const { profile } = useAuth()
  const selectedBranchId = useAppStore((state) => state.selectedBranchId)
  const procedures = useChecklistProcedures()
  const runsToday = useChecklistRuns(todayStartISO())
  const history = useChecklistRuns()
  const branches = useBranches()
  const createProcedure = useCreateChecklistProcedure()
  const completeRun = useCompleteChecklistRun()
  const [open, setOpen] = useState(false)
  const [checkedByProcedure, setCheckedByProcedure] = useState<Record<string, string[]>>({})
  const [notesByProcedure, setNotesByProcedure] = useState<Record<string, string>>({})
  const [form, setForm] = useState({
    branch_id: "",
    sector_id: "",
    title: "",
    category: "",
    frequency: "daily" as ChecklistProcedureFrequency,
    estimated_minutes: "",
    owner_role: "",
    instructions: "",
    checklist_items: "",
  })
  const isOrgAdmin = profile?.role === "owner" || profile?.role === "admin"
  const effectiveFormBranchId =
    form.branch_id || (!isOrgAdmin ? profile?.branch_id ?? "" : "")
  const sectors = useSectors(effectiveFormBranchId || null)
  const canCreate = canManageProcedures(profile?.role)

  const completedTodayIds = useMemo(
    () => new Set((runsToday.data ?? []).map((run) => run.procedure_id)),
    [runsToday.data]
  )

  const stats = useMemo(() => {
    const activeProcedures = procedures.data ?? []
    const dailyProcedures = activeProcedures.filter(
      (procedure) => procedure.frequency === "daily"
    )
    const totalItems = activeProcedures.reduce(
      (sum, procedure) => sum + procedure.checklist_items.length,
      0
    )
    const dailyPending = dailyProcedures.filter(
      (procedure) => !completedTodayIds.has(procedure.id)
    ).length
    const completedToday = runsToday.data?.length ?? 0

    return {
      active: activeProcedures.length,
      completedToday,
      dailyPending,
      totalItems,
    }
  }, [completedTodayIds, procedures.data, runsToday.data])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    await createProcedure.mutateAsync({
      branch_id: effectiveFormBranchId || null,
      sector_id: form.sector_id || null,
      title: form.title.trim(),
      category: form.category.trim() || null,
      frequency: form.frequency,
      estimated_minutes: form.estimated_minutes
        ? Number(form.estimated_minutes)
        : null,
      owner_role: form.owner_role.trim() || null,
      instructions: form.instructions.trim() || null,
      checklist_items: splitChecklistItems(form.checklist_items),
    })

    setForm({
      branch_id: "",
      sector_id: "",
      title: "",
      category: "",
      frequency: "daily",
      estimated_minutes: "",
      owner_role: "",
      instructions: "",
      checklist_items: "",
    })
    setOpen(false)
  }

  function toggleItem(procedureId: string, item: string) {
    setCheckedByProcedure((current) => {
      const checked = current[procedureId] ?? []
      return {
        ...current,
        [procedureId]: checked.includes(item)
          ? checked.filter((checkedItem) => checkedItem !== item)
          : [...checked, item],
      }
    })
  }

  function toggleAll(procedure: ChecklistProcedure) {
    setCheckedByProcedure((current) => {
      const checked = current[procedure.id] ?? []
      const allChecked = checked.length === procedure.checklist_items.length
      return {
        ...current,
        [procedure.id]: allChecked ? [] : procedure.checklist_items,
      }
    })
  }

  function resetProcedure(procedureId: string) {
    setCheckedByProcedure((current) => ({ ...current, [procedureId]: [] }))
    setNotesByProcedure((current) => ({ ...current, [procedureId]: "" }))
  }

  async function completeProcedure(procedure: ChecklistProcedure) {
    await completeRun.mutateAsync({
      procedure_id: procedure.id,
      branch_id: procedure.branch_id ?? selectedBranchId,
      checked_items: checkedByProcedure[procedure.id] ?? [],
      notes: notesByProcedure[procedure.id]?.trim() || null,
    })
    resetProcedure(procedure.id)
  }

  return (
    <>
      <PageHeader
        title="Checklists e Procedimentos"
        description="Padronize rotinas, execute checklists e registre evidencias operacionais."
        action={
          canCreate ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="size-4" />
                  Novo procedimento
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Cadastrar procedimento</DialogTitle>
                  <DialogDescription>
                    Defina escopo, instrucoes e itens do checklist para execucao do time.
                  </DialogDescription>
                </DialogHeader>

                <form className="space-y-4" onSubmit={handleSubmit}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">Filial</span>
                      <select
                        className={fieldClass}
                        disabled={!isOrgAdmin}
                        value={effectiveFormBranchId}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            branch_id: event.target.value,
                            sector_id: "",
                          }))
                        }
                      >
                        {isOrgAdmin ? <option value="">Toda a empresa</option> : null}
                        {!isOrgAdmin && profile?.branch_id && !(branches.data ?? []).some((branch) => branch.id === profile.branch_id) ? (
                          <option value={profile.branch_id}>Minha filial</option>
                        ) : null}
                        {!isOrgAdmin && !profile?.branch_id ? (
                          <option value="">Sem filial vinculada</option>
                        ) : null}
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
                        disabled={!effectiveFormBranchId}
                        value={form.sector_id}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            sector_id: event.target.value,
                          }))
                        }
                      >
                        <option value="">Todos os setores</option>
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
                        setForm((current) => ({
                          ...current,
                          title: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <div className="grid gap-3 sm:grid-cols-4">
                    <label className="space-y-1 text-sm sm:col-span-2">
                      <span className="font-medium">Categoria</span>
                      <Input
                        value={form.category}
                        placeholder="Abertura, fechamento, higiene..."
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            category: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">Frequencia</span>
                      <select
                        className={fieldClass}
                        value={form.frequency}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            frequency: event.target.value as ChecklistProcedureFrequency,
                          }))
                        }
                      >
                        {frequencyOptions.map((frequency) => (
                          <option key={frequency} value={frequency}>
                            {frequencyLabel[frequency]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">Minutos</span>
                      <Input
                        type="number"
                        min={1}
                        value={form.estimated_minutes}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            estimated_minutes: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>

                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Responsavel padrao</span>
                    <Input
                      value={form.owner_role}
                      placeholder="Operador, supervisor, lider de turno..."
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          owner_role: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Procedimento</span>
                    <textarea
                      className={textareaClass}
                      value={form.instructions}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          instructions: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Itens do checklist</span>
                    <textarea
                      required
                      className={textareaClass}
                      placeholder={"Um item por linha"}
                      value={form.checklist_items}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          checklist_items: event.target.value,
                        }))
                      }
                    />
                  </label>

                  {createProcedure.error ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {createProcedure.error.message}
                    </div>
                  ) : null}

                  <DialogFooter>
                    <Button type="submit" disabled={createProcedure.isPending}>
                      {createProcedure.isPending ? "Criando..." : "Criar procedimento"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          ) : null
        }
      />

      <div className="space-y-6 p-6">
        {procedures.isLoading || runsToday.isLoading ? (
          <StateBlock type="loading" title="Carregando checklists" />
        ) : procedures.isError ? (
          <StateBlock
            type="error"
            title="Erro ao carregar procedimentos"
            description={procedures.error.message}
          />
        ) : runsToday.isError ? (
          <StateBlock
            type="error"
            title="Erro ao carregar execucoes"
            description={runsToday.error.message}
          />
        ) : (
          <>
            <BentoGrid>
              <MetricCard
                title="Procedimentos"
                value={stats.active}
                detail="Ativos no escopo atual"
                icon={<ListChecks className="size-5" />}
              />
              <MetricCard
                title="Concluidos hoje"
                value={stats.completedToday}
                detail="Execucoes registradas"
                icon={<CheckCircle2 className="size-5" />}
              />
              <MetricCard
                title="Rotinas pendentes"
                value={stats.dailyPending}
                detail="Checklists diarios sem baixa"
                icon={<Clock3 className="size-5" />}
              />
              <MetricCard
                title="Itens padronizados"
                value={stats.totalItems}
                detail="Passos documentados"
                icon={<ClipboardCheck className="size-5" />}
              />
            </BentoGrid>

            <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
              <div className="space-y-4">
                {(procedures.data ?? []).length === 0 ? (
                  <StateBlock
                    title="Nenhum procedimento cadastrado"
                    description="Cadastre o primeiro checklist para padronizar uma rotina operacional."
                  />
                ) : (
                  (procedures.data ?? []).map((procedure) => (
                    <ProcedureCard
                      key={procedure.id}
                      procedure={procedure}
                      checkedItems={checkedByProcedure[procedure.id] ?? []}
                      notes={notesByProcedure[procedure.id] ?? ""}
                      isCompletedToday={completedTodayIds.has(procedure.id)}
                      isPending={completeRun.isPending}
                      onToggleItem={(item) => toggleItem(procedure.id, item)}
                      onToggleAll={() => toggleAll(procedure)}
                      onReset={() => resetProcedure(procedure.id)}
                      onNotesChange={(value) =>
                        setNotesByProcedure((current) => ({
                          ...current,
                          [procedure.id]: value,
                        }))
                      }
                      onComplete={() => void completeProcedure(procedure)}
                    />
                  ))
                )}
              </div>

              <Card className="border bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <History className="size-4" />
                    Historico recente
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {history.isLoading ? (
                    <StateBlock type="loading" title="Carregando historico" />
                  ) : history.isError ? (
                    <StateBlock
                      type="error"
                      title="Erro no historico"
                      description={history.error.message}
                    />
                  ) : (history.data ?? []).length === 0 ? (
                    <StateBlock
                      title="Sem execucoes"
                      description="Os checklists finalizados aparecem aqui."
                    />
                  ) : (
                    (history.data ?? []).slice(0, 8).map((run) => (
                      <div key={run.id} className="rounded-lg border bg-slate-50 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="break-words text-sm font-medium">
                              {run.checklist_procedures?.title ?? "Procedimento"}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {formatDateTimeBR(run.completed_at ?? run.created_at)}
                            </div>
                          </div>
                          <Badge variant="outline">
                            {run.checked_items.length} itens
                          </Badge>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          <Building2 className="size-3.5" />
                          <span>{run.branches?.name ?? "Empresa"}</span>
                          <span>{run.user_profiles?.name ?? "Usuario"}</span>
                        </div>
                        {run.notes ? (
                          <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-600">
                            {run.notes}
                          </p>
                        ) : null}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            {completeRun.error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {completeRun.error.message}
              </div>
            ) : null}

            {!canCreate ? (
              <div className="flex items-center gap-2 rounded-lg border bg-slate-50 px-3 py-2 text-sm text-muted-foreground">
                <Timer className="size-4" />
                A execucao esta liberada para o time. O cadastro de procedimentos fica com lideranca e administradores.
              </div>
            ) : null}
          </>
        )}
      </div>
    </>
  )
}
