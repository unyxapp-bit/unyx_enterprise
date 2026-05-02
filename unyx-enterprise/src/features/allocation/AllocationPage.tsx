import { useMemo, useState } from "react"
import type { FormEvent } from "react"
import {
  ArrowRightLeft,
  Banknote,
  CheckCircle2,
  History,
  MapPinned,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  ShieldAlert,
  Store,
  UserRoundCheck,
} from "lucide-react"

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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  useAllocatePost,
  useAllocationHistory,
  useBranches,
  useCashMovements,
  useConfirmCashMovement,
  useCreateOperationalPost,
  useEmployees,
  useFinalizePostAllocation,
  useOperationalPosts,
  usePostAllocations,
  useSchedules,
  useSectors,
  useToggleOperationalPost,
  useTransferPostAllocation,
  useUpdateOperationalPost,
} from "@/hooks/useUnyxData"
import { formatDateTimeBR, formatTime, todayISO } from "@/lib/format"
import { useAppStore } from "@/store/useAppStore"
import type {
  CashMovementType,
  EmployeeWithRelations,
  OperationalPost,
  OperationalPostType,
  PostAllocation,
  ScheduleWithRelations,
  Sector,
} from "@/types/domain"

const fieldClass =
  "h-8 w-full rounded-lg border bg-white px-2.5 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"

const postTypeLabel: Record<OperationalPostType, string> = {
  cashier: "Caixa",
  self_checkout: "Self-checkout",
  counter: "Balcao",
  service_desk: "Atendimento",
  delivery: "Delivery",
  stock: "Estoque",
  kitchen: "Cozinha",
  reception: "Recepcao",
  other: "Outro",
}

const cashMovementLabel: Record<CashMovementType, string> = {
  sangria_confirmada: "Sangria confirmada",
  abertura_caixa: "Abertura de caixa",
  fechamento_caixa: "Fechamento de caixa",
  troco_reforco: "Reforco de troco",
}

type PostFormState = {
  branch_id: string
  sector_id: string
  name: string
  type: OperationalPostType
  active: boolean
}

type AllocationAction =
  | { type: "allocate"; post: OperationalPost }
  | { type: "transfer"; post: OperationalPost; allocation: PostAllocation }

function emptyPostForm(branchId = ""): PostFormState {
  return {
    branch_id: branchId,
    sector_id: "",
    name: "",
    type: "cashier",
    active: true,
  }
}

function getScheduleLabel(schedule: ScheduleWithRelations) {
  return [
    formatTime(schedule.start_time),
    formatTime(schedule.break_start),
    formatTime(schedule.break_end),
    formatTime(schedule.end_time),
  ].join(" / ")
}

function getEmployeeSubtitle(employee: EmployeeWithRelations) {
  return [employee.role, employee.sectors?.name].filter(Boolean).join(" - ")
}

function sectorOptionsForBranch(sectors: Sector[], branchId: string) {
  return sectors.filter((sector) => sector.branch_id === branchId && sector.active)
}

export function AllocationPage() {
  const selectedBranchId = useAppStore((state) => state.selectedBranchId)
  const branches = useBranches()
  const sectors = useSectors(null)
  const employees = useEmployees(null)
  const posts = useOperationalPosts()
  const allocations = usePostAllocations()
  const history = useAllocationHistory()
  const cashMovements = useCashMovements()
  const [date, setDate] = useState(todayISO())
  const schedules = useSchedules(date, null)

  const createPost = useCreateOperationalPost()
  const updatePost = useUpdateOperationalPost()
  const togglePost = useToggleOperationalPost()
  const allocate = useAllocatePost()
  const transfer = useTransferPostAllocation()
  const finalize = useFinalizePostAllocation()
  const confirmCash = useConfirmCashMovement()

  const [postOpen, setPostOpen] = useState(false)
  const [editingPost, setEditingPost] = useState<OperationalPost | null>(null)
  const [postForm, setPostForm] = useState<PostFormState>(emptyPostForm())
  const [postError, setPostError] = useState<string | null>(null)
  const [allocationAction, setAllocationAction] =
    useState<AllocationAction | null>(null)
  const [allocationForm, setAllocationForm] = useState({
    employee_id: "",
    schedule_id: "",
    notes: "",
  })
  const [allocationError, setAllocationError] = useState<string | null>(null)
  const [cashAction, setCashAction] = useState<PostAllocation | null>(null)
  const [cashForm, setCashForm] = useState({
    movement_type: "sangria_confirmada" as CashMovementType,
    notes: "",
  })
  const [finalizeAction, setFinalizeAction] = useState<PostAllocation | null>(
    null
  )
  const [finalizeNote, setFinalizeNote] = useState("")

  const defaultBranchId = selectedBranchId ?? branches.data?.[0]?.id ?? ""
  const allPosts = useMemo(() => posts.data ?? [], [posts.data])
  const activePosts = useMemo(
    () => allPosts.filter((post) => post.active),
    [allPosts]
  )
  const activeAllocations = useMemo(
    () => allocations.data ?? [],
    [allocations.data]
  )
  const allocationByPostId = useMemo(() => {
    const map = new Map<string, PostAllocation>()
    for (const allocationItem of activeAllocations) {
      if (!allocationItem.ended_at) map.set(allocationItem.post_id, allocationItem)
    }
    return map
  }, [activeAllocations])
  const coveredPosts = activePosts.filter((post) => allocationByPostId.has(post.id))
  const uncoveredPosts = activePosts.filter(
    (post) => !allocationByPostId.has(post.id)
  )
  const sangriasToday = (cashMovements.data ?? []).filter(
    (movement) =>
      movement.confirmed_at.slice(0, 10) === date &&
      movement.movement_type === "sangria_confirmada"
  ).length
  const busyEmployeeIds = useMemo(
    () => new Set(activeAllocations.map((allocationItem) => allocationItem.employee_id)),
    [activeAllocations]
  )

  const allocationEmployees = useMemo(() => {
    if (!allocationAction) return []

    return (employees.data ?? [])
      .filter(
        (employee) =>
          employee.active &&
          employee.branch_id === allocationAction.post.branch_id &&
          !busyEmployeeIds.has(employee.id)
      )
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [allocationAction, busyEmployeeIds, employees.data])

  const allocationSchedules = useMemo(() => {
    if (!allocationAction || !allocationForm.employee_id) return []

    return (schedules.data ?? []).filter(
      (schedule) =>
        schedule.branch_id === allocationAction.post.branch_id &&
        schedule.employee_id === allocationForm.employee_id &&
        !["day_off", "cancelled", "finished", "absent"].includes(schedule.status)
    )
  }, [allocationAction, allocationForm.employee_id, schedules.data])

  function openCreatePost() {
    setEditingPost(null)
    setPostError(null)
    setPostForm(emptyPostForm(defaultBranchId))
    setPostOpen(true)
  }

  function openEditPost(post: OperationalPost) {
    setEditingPost(post)
    setPostError(null)
    setPostForm({
      branch_id: post.branch_id,
      sector_id: post.sector_id ?? "",
      name: post.name,
      type: post.type,
      active: post.active,
    })
    setPostOpen(true)
  }

  function openAllocationDialog(action: AllocationAction) {
    setAllocationAction(action)
    setAllocationError(null)
    setAllocationForm({
      employee_id: "",
      schedule_id: "",
      notes: "",
    })
  }

  async function handlePostSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPostError(null)

    try {
      if (editingPost) {
        await updatePost.mutateAsync({
          postId: editingPost.id,
          values: {
            name: postForm.name,
            type: postForm.type,
            sector_id: postForm.sector_id || null,
            active: postForm.active,
          },
        })
      } else {
        await createPost.mutateAsync({
          branch_id: postForm.branch_id,
          sector_id: postForm.sector_id || null,
          name: postForm.name,
          type: postForm.type,
          active: postForm.active,
        })
      }
      setPostOpen(false)
    } catch (error) {
      setPostError(error instanceof Error ? error.message : "Nao foi possivel salvar.")
    }
  }

  async function handleAllocationSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!allocationAction) return
    setAllocationError(null)

    if (!allocationForm.employee_id) {
      setAllocationError("Selecione um colaborador.")
      return
    }

    try {
      if (allocationAction.type === "allocate") {
        await allocate.mutateAsync({
          post_id: allocationAction.post.id,
          employee_id: allocationForm.employee_id,
          schedule_id: allocationForm.schedule_id || null,
          notes: allocationForm.notes.trim() || null,
        })
      } else {
        await transfer.mutateAsync({
          allocation_id: allocationAction.allocation.id,
          next_employee_id: allocationForm.employee_id,
          next_schedule_id: allocationForm.schedule_id || null,
          notes: allocationForm.notes.trim() || null,
        })
      }
      setAllocationAction(null)
    } catch (error) {
      setAllocationError(
        error instanceof Error ? error.message : "Nao foi possivel concluir."
      )
    }
  }

  async function handleCashSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!cashAction) return

    await confirmCash.mutateAsync({
      allocation_id: cashAction.id,
      movement_type: cashForm.movement_type,
      notes: cashForm.notes.trim() || null,
    })
    setCashAction(null)
    setCashForm({ movement_type: "sangria_confirmada", notes: "" })
  }

  async function handleFinalizeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!finalizeAction) return

    await finalize.mutateAsync({
      allocation_id: finalizeAction.id,
      notes: finalizeNote.trim() || null,
    })
    setFinalizeAction(null)
    setFinalizeNote("")
  }

  const isLoading =
    posts.isLoading ||
    allocations.isLoading ||
    branches.isLoading ||
    employees.isLoading ||
    schedules.isLoading

  const pageError =
    posts.error ??
    allocations.error ??
    branches.error ??
    employees.error ??
    schedules.error

  return (
    <>
      <PageHeader
        title="Unyx Allocation"
        description="Postos, PDVs, cobertura, trocas e sangrias."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="w-40"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                void posts.refetch()
                void allocations.refetch()
                void cashMovements.refetch()
              }}
              aria-label="Atualizar alocacao"
            >
              <RefreshCw className="size-4" />
            </Button>
            <Button onClick={openCreatePost} disabled={!defaultBranchId}>
              <Plus className="size-4" />
              Novo posto
            </Button>
          </div>
        }
      />

      <div className="space-y-6 p-6">
        {isLoading ? (
          <StateBlock type="loading" title="Carregando alocacao operacional" />
        ) : pageError ? (
          <StateBlock
            type="error"
            title="Erro ao carregar Unyx Allocation"
            description={`${pageError.message}. Rode supabase/onboarding_first_access.sql no SQL Editor se o modulo ainda nao existir.`}
          />
        ) : (
          <>
            <BentoGrid>
              <MetricCard
                title="Postos ativos"
                value={activePosts.length}
                detail="Bases operacionais abertas"
                icon={<Store className="size-5" />}
              />
              <MetricCard
                title="Cobertos"
                value={coveredPosts.length}
                detail="Com colaborador alocado"
                icon={<CheckCircle2 className="size-5" />}
              />
              <MetricCard
                title="Sem cobertura"
                value={uncoveredPosts.length}
                detail="Exigem acao do supervisor"
                icon={<ShieldAlert className="size-5" />}
                className={uncoveredPosts.length > 0 ? "border-red-200" : undefined}
              />
              <MetricCard
                title="Sangrias hoje"
                value={sangriasToday}
                detail="Confirmadas no dia selecionado"
                icon={<Banknote className="size-5" />}
              />
            </BentoGrid>

            <div className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
              <Card className="border bg-white shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPinned className="size-5" />
                    Painel de cobertura
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {activePosts.length === 0 ? (
                    <StateBlock
                      title="Nenhum posto ativo"
                      description="Cadastre caixas, balcoes ou pontos de atendimento para acompanhar cobertura."
                    />
                  ) : (
                    <div className="grid gap-3 lg:grid-cols-2">
                      {activePosts.map((post) => {
                        const allocation = allocationByPostId.get(post.id)
                        return (
                          <div
                            key={post.id}
                            className={`rounded-lg border p-4 ${
                              allocation
                                ? "border-emerald-200 bg-emerald-50"
                                : "border-red-200 bg-red-50"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="font-medium">{post.name}</div>
                                <div className="mt-1 text-sm text-muted-foreground">
                                  {postTypeLabel[post.type]} -{" "}
                                  {post.sectors?.name ?? "Sem setor"}
                                </div>
                              </div>
                              <Badge variant={allocation ? "default" : "destructive"}>
                                {allocation ? "Coberto" : "Sem cobertura"}
                              </Badge>
                            </div>

                            {allocation ? (
                              <div className="mt-4 space-y-3">
                                <div className="rounded-lg border bg-white/70 p-3">
                                  <div className="text-sm font-medium">
                                    {allocation.employees?.name ?? "Colaborador"}
                                  </div>
                                  <div className="mt-1 text-xs text-muted-foreground">
                                    Desde {formatDateTimeBR(allocation.started_at)}
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      openAllocationDialog({
                                        type: "transfer",
                                        post,
                                        allocation,
                                      })
                                    }
                                  >
                                    <ArrowRightLeft className="size-4" />
                                    Trocar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setCashAction(allocation)}
                                  >
                                    <Banknote className="size-4" />
                                    Sangria
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => setFinalizeAction(allocation)}
                                  >
                                    Finalizar
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="mt-4">
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    openAllocationDialog({ type: "allocate", post })
                                  }
                                >
                                  <UserRoundCheck className="size-4" />
                                  Alocar colaborador
                                </Button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card className="border bg-white shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <History className="size-5" />
                      Historico recente
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {(history.data ?? []).slice(0, 6).length === 0 ? (
                      <StateBlock title="Sem trocas registradas" />
                    ) : (
                      (history.data ?? []).slice(0, 6).map((item) => (
                        <div key={item.id} className="rounded-lg border p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-medium">
                              {item.operational_posts?.name ?? "Posto"}
                            </div>
                            <Badge variant="outline">
                              {item.ended_at ? "Finalizado" : "Ativo"}
                            </Badge>
                          </div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            {item.employees?.name ?? "Colaborador"} -{" "}
                            {formatDateTimeBR(item.started_at)}
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card className="border bg-white shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Banknote className="size-5" />
                      Movimentos de caixa
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {(cashMovements.data ?? []).slice(0, 5).length === 0 ? (
                      <StateBlock title="Sem movimentos registrados" />
                    ) : (
                      (cashMovements.data ?? []).slice(0, 5).map((movement) => (
                        <div key={movement.id} className="rounded-lg border p-3">
                          <div className="font-medium">
                            {cashMovementLabel[movement.movement_type]}
                          </div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            {movement.operational_posts?.name ?? "Posto"} -{" "}
                            {movement.employees?.name ?? "Colaborador"}
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            <Card className="border bg-white shadow-sm">
              <CardHeader>
                <CardTitle>Cadastro de postos</CardTitle>
              </CardHeader>
              <CardContent>
                {allPosts.length === 0 ? (
                  <StateBlock title="Nenhum posto cadastrado" />
                ) : (
                  <div className="space-y-3">
                    {allPosts.map((post) => (
                      <div
                        key={post.id}
                        className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{post.name}</span>
                            <Badge variant={post.active ? "outline" : "secondary"}>
                              {post.active ? "Ativo" : "Inativo"}
                            </Badge>
                          </div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            {post.branches?.name ?? "Filial"} -{" "}
                            {post.sectors?.name ?? "Sem setor"} -{" "}
                            {postTypeLabel[post.type]}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => openEditPost(post)}
                            aria-label={`Editar ${post.name}`}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() =>
                              togglePost.mutate({
                                postId: post.id,
                                active: !post.active,
                              })
                            }
                            aria-label={
                              post.active ? `Desativar ${post.name}` : `Ativar ${post.name}`
                            }
                          >
                            <Power className="size-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Dialog open={postOpen} onOpenChange={setPostOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPost ? "Editar posto operacional" : "Cadastrar posto"}
            </DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handlePostSubmit}>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Nome</span>
              <Input
                required
                value={postForm.name}
                onChange={(event) =>
                  setPostForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium">Filial</span>
                <select
                  className={fieldClass}
                  value={postForm.branch_id}
                  disabled={Boolean(editingPost)}
                  onChange={(event) =>
                    setPostForm((current) => ({
                      ...current,
                      branch_id: event.target.value,
                      sector_id: "",
                    }))
                  }
                  required
                >
                  <option value="">Selecione</option>
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
                  value={postForm.sector_id}
                  onChange={(event) =>
                    setPostForm((current) => ({
                      ...current,
                      sector_id: event.target.value,
                    }))
                  }
                >
                  <option value="">Sem setor</option>
                  {sectorOptionsForBranch(
                    sectors.data ?? [],
                    postForm.branch_id
                  ).map((sector) => (
                    <option key={sector.id} value={sector.id}>
                      {sector.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium">Tipo</span>
                <select
                  className={fieldClass}
                  value={postForm.type}
                  onChange={(event) =>
                    setPostForm((current) => ({
                      ...current,
                      type: event.target.value as OperationalPostType,
                    }))
                  }
                >
                  {Object.entries(postTypeLabel).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-sm">
                <span className="font-medium">Status</span>
                <select
                  className={fieldClass}
                  value={postForm.active ? "active" : "inactive"}
                  onChange={(event) =>
                    setPostForm((current) => ({
                      ...current,
                      active: event.target.value === "active",
                    }))
                  }
                >
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                </select>
              </label>
            </div>

            {postError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {postError}
              </div>
            ) : null}

            <DialogFooter>
              <Button
                type="submit"
                disabled={createPost.isPending || updatePost.isPending}
              >
                {editingPost ? "Salvar posto" : "Criar posto"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(allocationAction)}
        onOpenChange={(open) => {
          if (!open) setAllocationAction(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {allocationAction?.type === "transfer"
                ? "Trocar colaborador"
                : "Alocar colaborador"}
            </DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleAllocationSubmit}>
            <div className="rounded-lg border bg-slate-50 p-3 text-sm">
              <div className="font-medium">{allocationAction?.post.name}</div>
              <div className="mt-1 text-muted-foreground">
                {allocationAction
                  ? postTypeLabel[allocationAction.post.type]
                  : "Posto operacional"}
              </div>
            </div>

            <label className="space-y-1 text-sm">
              <span className="font-medium">Colaborador</span>
              <select
                className={fieldClass}
                value={allocationForm.employee_id}
                onChange={(event) =>
                  setAllocationForm((current) => ({
                    ...current,
                    employee_id: event.target.value,
                    schedule_id: "",
                  }))
                }
                required
              >
                <option value="">Selecione</option>
                {allocationEmployees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                    {getEmployeeSubtitle(employee)
                      ? ` - ${getEmployeeSubtitle(employee)}`
                      : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium">Escala do dia</span>
              <select
                className={fieldClass}
                value={allocationForm.schedule_id}
                onChange={(event) =>
                  setAllocationForm((current) => ({
                    ...current,
                    schedule_id: event.target.value,
                  }))
                }
              >
                <option value="">Sem vincular escala</option>
                {allocationSchedules.map((schedule) => (
                  <option key={schedule.id} value={schedule.id}>
                    {getScheduleLabel(schedule)}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium">Observacao</span>
              <Input
                value={allocationForm.notes}
                onChange={(event) =>
                  setAllocationForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
              />
            </label>

            {allocationError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {allocationError}
              </div>
            ) : null}

            <DialogFooter>
              <Button type="submit" disabled={allocate.isPending || transfer.isPending}>
                {allocationAction?.type === "transfer"
                  ? "Confirmar troca"
                  : "Confirmar alocacao"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(cashAction)}
        onOpenChange={(open) => {
          if (!open) setCashAction(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar movimento de caixa</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleCashSubmit}>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Movimento</span>
              <select
                className={fieldClass}
                value={cashForm.movement_type}
                onChange={(event) =>
                  setCashForm((current) => ({
                    ...current,
                    movement_type: event.target.value as CashMovementType,
                  }))
                }
              >
                {Object.entries(cashMovementLabel).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Observacao</span>
              <Input
                value={cashForm.notes}
                onChange={(event) =>
                  setCashForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
              />
            </label>
            <DialogFooter>
              <Button type="submit" disabled={confirmCash.isPending}>
                Confirmar movimento
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(finalizeAction)}
        onOpenChange={(open) => {
          if (!open) setFinalizeAction(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finalizar alocacao</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleFinalizeSubmit}>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Esta acao libera o posto para receber outro colaborador.
            </div>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Observacao</span>
              <Input
                value={finalizeNote}
                onChange={(event) => setFinalizeNote(event.target.value)}
              />
            </label>
            <DialogFooter>
              <Button type="submit" variant="destructive" disabled={finalize.isPending}>
                Finalizar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
