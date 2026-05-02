import { useState } from "react"
import type { FormEvent } from "react"
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  History,
  Lock,
  RefreshCw,
  Unlock,
} from "lucide-react"

import { BentoGrid } from "@/components/bento/BentoGrid"
import { MetricCard } from "@/components/bento/MetricCard"
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
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  useBranches,
  useCashSessions,
  useCloseCashSession,
  useCreatePosCashMovement,
  useCurrentCashSession,
  useEmployees,
  useOpenCashSession,
  useOperationalPosts,
  usePosCashMovements,
} from "@/hooks/useUnyxData"
import { formatCurrency, formatDateTimeBR } from "@/lib/format"
import { useAppStore } from "@/store/useAppStore"
import type { PosCashMovementType } from "@/types/domain"

const fieldClass =
  "h-8 w-full rounded-lg border bg-white px-2.5 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"

const movementLabel: Record<PosCashMovementType, string> = {
  sale_cash_in: "Entrada de venda",
  cash_in: "Entrada",
  cash_out: "Saída",
  sangria: "Sangria",
  change_reinforcement: "Reforco de troco",
  adjustment: "Ajuste",
}

const sessionStatusLabel: Record<string, string> = {
  open: "Aberto",
  closed: "Fechado",
  cancelled: "Cancelado",
}

export function PosCashPage() {
  const selectedBranchId = useAppStore((state) => state.selectedBranchId)
  const branches = useBranches()
  const employees = useEmployees(null)
  const posts = useOperationalPosts()
  const currentSession = useCurrentCashSession()
  const sessions = useCashSessions()
  const openSession = useOpenCashSession()
  const closeSession = useCloseCashSession()
  const createMovement = useCreatePosCashMovement()

  const session = currentSession.data ?? null
  const movements = usePosCashMovements(session?.id)

  const defaultBranchId = selectedBranchId ?? branches.data?.[0]?.id ?? ""
  const activePosts = (posts.data ?? []).filter(
    (p) => p.active && (defaultBranchId ? p.branch_id === defaultBranchId : true)
  )
  const activeEmployees = (employees.data ?? []).filter(
    (e) => e.active && (defaultBranchId ? e.branch_id === defaultBranchId : true)
  )

  const [openDialogOpen, setOpenDialogOpen] = useState(false)
  const [openForm, setOpenForm] = useState({
    post_id: "",
    employee_id: "",
    initial_amount: "",
    notes: "",
  })
  const [openError, setOpenError] = useState<string | null>(null)

  const [closeDialogOpen, setCloseDialogOpen] = useState(false)
  const [closeForm, setCloseForm] = useState({ final_amount: "", notes: "" })
  const [closeError, setCloseError] = useState<string | null>(null)

  const [movDialogOpen, setMovDialogOpen] = useState(false)
  const [movForm, setMovForm] = useState({
    movement_type: "sangria" as PosCashMovementType,
    amount: "",
    notes: "",
  })
  const [movError, setMovError] = useState<string | null>(null)

  async function handleOpenSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setOpenError(null)
    if (!defaultBranchId) {
      setOpenError("Selecione uma filial no topo da pagina.")
      return
    }
    try {
      await openSession.mutateAsync({
        branch_id: defaultBranchId,
        post_id: openForm.post_id || null,
        employee_id: openForm.employee_id || null,
        initial_amount: Number(openForm.initial_amount) || 0,
        notes: openForm.notes.trim() || null,
      })
      setOpenDialogOpen(false)
      setOpenForm({ post_id: "", employee_id: "", initial_amount: "", notes: "" })
    } catch (error) {
      setOpenError(error instanceof Error ? error.message : "Nao foi possivel abrir o caixa.")
    }
  }

  async function handleCloseSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!session) return
    setCloseError(null)
    try {
      await closeSession.mutateAsync({
        session_id: session.id,
        final_amount: Number(closeForm.final_amount) || 0,
        notes: closeForm.notes.trim() || null,
      })
      setCloseDialogOpen(false)
      setCloseForm({ final_amount: "", notes: "" })
    } catch (error) {
      setCloseError(error instanceof Error ? error.message : "Nao foi possivel fechar o caixa.")
    }
  }

  async function handleMovSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!session) return
    setMovError(null)
    const amount = Number(movForm.amount)
    if (!amount || amount <= 0) {
      setMovError("Informe um valor valido.")
      return
    }
    try {
      await createMovement.mutateAsync({
        session_id: session.id,
        movement_type: movForm.movement_type,
        amount,
        notes: movForm.notes.trim() || null,
      })
      setMovDialogOpen(false)
      setMovForm({ movement_type: "sangria", amount: "", notes: "" })
    } catch (error) {
      setMovError(error instanceof Error ? error.message : "Nao foi possivel registrar movimento.")
    }
  }

  const isLoading = currentSession.isLoading || sessions.isLoading

  return (
    <>
      <PageHeader
        title="Caixa"
        description="Abertura, fechamento e movimentos de caixa."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                void currentSession.refetch()
                void sessions.refetch()
              }}
              aria-label="Atualizar caixa"
            >
              <RefreshCw className="size-4" />
            </Button>
            {session ? (
              <>
                <Button variant="outline" onClick={() => setMovDialogOpen(true)}>
                  <Banknote className="size-4" />
                  Movimento
                </Button>
                <Button variant="destructive" onClick={() => setCloseDialogOpen(true)}>
                  <Lock className="size-4" />
                  Fechar caixa
                </Button>
              </>
            ) : (
              <Button onClick={() => setOpenDialogOpen(true)} disabled={!defaultBranchId}>
                <Unlock className="size-4" />
                Abrir caixa
              </Button>
            )}
          </div>
        }
      />

      <div className="space-y-6 p-6">
        {isLoading ? (
          <StateBlock type="loading" title="Carregando caixa" />
        ) : (
          <>
            {session ? (
              <>
                <BentoGrid>
                  <MetricCard
                    title="Valor inicial"
                    value={formatCurrency(session.initial_amount)}
                    detail="Troco de abertura"
                    icon={<Banknote className="size-5" />}
                  />
                  <MetricCard
                    title="Saldo esperado"
                    value={formatCurrency(session.expected_amount)}
                    detail="Apos entradas e saidas"
                    icon={<ArrowUpCircle className="size-5" />}
                  />
                  <MetricCard
                    title="Aberto em"
                    value={formatDateTimeBR(session.opened_at)}
                    detail={session.operational_posts?.name ?? "Sem posto vinculado"}
                    icon={<Unlock className="size-5" />}
                  />
                </BentoGrid>

                <Card className="border bg-white shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Banknote className="size-5" />
                      Movimentos do caixa atual
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {movements.isLoading ? (
                      <StateBlock type="loading" title="Carregando movimentos" />
                    ) : (movements.data ?? []).length === 0 ? (
                      <StateBlock title="Sem movimentos registrados" />
                    ) : (
                      <div className="space-y-2">
                        {(movements.data ?? []).map((mov) => {
                          const isIn = ["cash_in", "sale_cash_in", "change_reinforcement"].includes(
                            mov.movement_type
                          )
                          return (
                            <div
                              key={mov.id}
                              className="flex items-center justify-between rounded-lg border px-4 py-3"
                            >
                              <div className="flex items-center gap-3">
                                {isIn ? (
                                  <ArrowUpCircle className="size-4 text-emerald-600" />
                                ) : (
                                  <ArrowDownCircle className="size-4 text-red-500" />
                                )}
                                <div>
                                  <div className="text-sm font-medium">
                                    {movementLabel[mov.movement_type]}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {formatDateTimeBR(mov.occurred_at)}
                                    {mov.notes ? ` — ${mov.notes}` : ""}
                                  </div>
                                </div>
                              </div>
                              <div
                                className={`font-medium ${
                                  isIn ? "text-emerald-700" : "text-red-600"
                                }`}
                              >
                                {isIn ? "+" : "-"}
                                {formatCurrency(mov.amount)}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                Nenhum caixa aberto para esta filial. Abra o caixa para comecar a registrar vendas.
              </div>
            )}

            <Card className="border bg-white shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="size-5" />
                  Historico de caixas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(sessions.data ?? []).length === 0 ? (
                  <StateBlock title="Nenhum caixa registrado" />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="px-4 py-3 font-medium">Abertura</th>
                          <th className="px-4 py-3 font-medium">Fechamento</th>
                          <th className="px-4 py-3 font-medium">Inicial</th>
                          <th className="px-4 py-3 font-medium">Esperado</th>
                          <th className="px-4 py-3 font-medium">Final</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(sessions.data ?? []).map((s) => (
                          <tr key={s.id} className="border-b last:border-0 hover:bg-slate-50">
                            <td className="px-4 py-3">{formatDateTimeBR(s.opened_at)}</td>
                            <td className="px-4 py-3">
                              {s.closed_at ? formatDateTimeBR(s.closed_at) : "-"}
                            </td>
                            <td className="px-4 py-3">{formatCurrency(s.initial_amount)}</td>
                            <td className="px-4 py-3">{formatCurrency(s.expected_amount)}</td>
                            <td className="px-4 py-3">
                              {s.final_amount != null ? formatCurrency(s.final_amount) : "-"}
                            </td>
                            <td className="px-4 py-3">
                              <Badge
                                variant={
                                  s.status === "open"
                                    ? "default"
                                    : s.status === "closed"
                                    ? "outline"
                                    : "secondary"
                                }
                              >
                                {sessionStatusLabel[s.status] ?? s.status}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Open session dialog */}
      <Dialog open={openDialogOpen} onOpenChange={setOpenDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Abrir caixa</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(e) => void handleOpenSubmit(e)}>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Valor inicial (troco)</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={openForm.initial_amount}
                onChange={(e) => setOpenForm((p) => ({ ...p, initial_amount: e.target.value }))}
              />
            </label>

            {activePosts.length > 0 && (
              <label className="space-y-1 text-sm">
                <span className="font-medium">Posto operacional</span>
                <select
                  className={fieldClass}
                  value={openForm.post_id}
                  onChange={(e) => setOpenForm((p) => ({ ...p, post_id: e.target.value }))}
                >
                  <option value="">Sem posto</option>
                  {activePosts.map((post) => (
                    <option key={post.id} value={post.id}>
                      {post.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {activeEmployees.length > 0 && (
              <label className="space-y-1 text-sm">
                <span className="font-medium">Operador</span>
                <select
                  className={fieldClass}
                  value={openForm.employee_id}
                  onChange={(e) => setOpenForm((p) => ({ ...p, employee_id: e.target.value }))}
                >
                  <option value="">Sem vincular operador</option>
                  {activeEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="space-y-1 text-sm">
              <span className="font-medium">Observacao</span>
              <Input
                value={openForm.notes}
                onChange={(e) => setOpenForm((p) => ({ ...p, notes: e.target.value }))}
              />
            </label>

            {openError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {openError}
              </div>
            ) : null}

            <DialogFooter>
              <Button type="submit" disabled={openSession.isPending}>
                Abrir caixa
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Close session dialog */}
      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fechar caixa</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(e) => void handleCloseSubmit(e)}>
            {session && (
              <div className="rounded-lg border bg-slate-50 p-3 text-sm">
                <div>
                  Saldo esperado:{" "}
                  <strong>{formatCurrency(session.expected_amount)}</strong>
                </div>
              </div>
            )}
            <label className="space-y-1 text-sm">
              <span className="font-medium">Valor contado em caixa *</span>
              <Input
                required
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={closeForm.final_amount}
                onChange={(e) => setCloseForm((p) => ({ ...p, final_amount: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Observacao</span>
              <Input
                value={closeForm.notes}
                onChange={(e) => setCloseForm((p) => ({ ...p, notes: e.target.value }))}
              />
            </label>
            {closeError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {closeError}
              </div>
            ) : null}
            <DialogFooter>
              <Button type="submit" variant="destructive" disabled={closeSession.isPending}>
                Fechar caixa
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Movement dialog */}
      <Dialog open={movDialogOpen} onOpenChange={setMovDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar movimento</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(e) => void handleMovSubmit(e)}>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Tipo de movimento</span>
              <select
                className={fieldClass}
                value={movForm.movement_type}
                onChange={(e) =>
                  setMovForm((p) => ({
                    ...p,
                    movement_type: e.target.value as PosCashMovementType,
                  }))
                }
              >
                {(
                  [
                    "sangria",
                    "cash_in",
                    "cash_out",
                    "change_reinforcement",
                    "adjustment",
                  ] as PosCashMovementType[]
                ).map((type) => (
                  <option key={type} value={type}>
                    {movementLabel[type]}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Valor *</span>
              <Input
                required
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0,00"
                value={movForm.amount}
                onChange={(e) => setMovForm((p) => ({ ...p, amount: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Observacao</span>
              <Input
                value={movForm.notes}
                onChange={(e) => setMovForm((p) => ({ ...p, notes: e.target.value }))}
              />
            </label>
            {movError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {movError}
              </div>
            ) : null}
            <DialogFooter>
              <Button type="submit" disabled={createMovement.isPending}>
                Registrar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
