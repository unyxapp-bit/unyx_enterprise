import { useMemo, useState } from "react"
import { CheckCheck, Pencil } from "lucide-react"
import { toast } from "sonner"

import { StateBlock } from "@/components/shared/StateBlock"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import {
  useCorrectScheduleAttendance,
  useReconcileSchedulesByScale,
  useSchedules,
  useScheduleRecords,
} from "@/hooks/useUnyxData"
import { localDateKey } from "@/features/operational/utils"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/store/useAppStore"
import type { ScheduleWithRelations } from "@/types/domain"

import {
  RECONCILE_DAYS_BACK,
  defaultCorrectionForm,
  deriveReconciliationRow,
  originLabel,
  summarizeReconciliation,
  trimTime,
  type CorrectionFormState,
  type ReconciliationCell,
  type RecordOrigin,
} from "./scaleReconciliation"

const originClass: Record<RecordOrigin, string> = {
  manual:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300",
  escala:
    "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300",
  retroativo:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
  pendente: "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300",
}

const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"]

function dayOptions() {
  const options: Array<{ value: string; label: string }> = []
  for (let offset = 0; offset <= RECONCILE_DAYS_BACK; offset += 1) {
    const date = new Date()
    date.setDate(date.getDate() - offset)
    const key = localDateKey(date)
    const pad = (value: number) => String(value).padStart(2, "0")
    const label =
      offset === 0
        ? "Hoje"
        : offset === 1
          ? "Ontem"
          : `${pad(date.getDate())}/${pad(date.getMonth() + 1)} (${WEEKDAYS[date.getDay()]})`
    options.push({ value: key, label })
  }
  return options
}

function Cell({ label, cell }: { label: string; cell: ReconciliationCell }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground xl:hidden">{label}</div>
      <div className="text-sm font-semibold text-[color:var(--text-primary)]">{cell.time ?? "--:--"}</div>
      <Badge
        variant="outline"
        className={cn("mt-0.5 rounded-full px-1.5 py-0 text-[10px]", originClass[cell.origin])}
      >
        {originLabel[cell.origin]}
      </Badge>
    </div>
  )
}

export function ScaleReconciliationPanel() {
  const selectedBranchId = useAppStore((state) => state.selectedBranchId)
  const [date, setDate] = useState(() => localDateKey())
  const [editing, setEditing] = useState<ScheduleWithRelations | null>(null)
  const [form, setForm] = useState<CorrectionFormState | null>(null)

  const schedulesQuery = useSchedules(date)
  const schedules = useMemo(
    () =>
      (schedulesQuery.data ?? []).filter(
        (schedule) => !["cancelled", "day_off", "banked_hours"].includes(schedule.status)
      ),
    [schedulesQuery.data]
  )
  const recordsQuery = useScheduleRecords(schedules.map((schedule) => schedule.id))
  const reconcile = useReconcileSchedulesByScale()
  const correct = useCorrectScheduleAttendance()

  const rows = useMemo(
    () =>
      schedules.map((schedule) => ({
        schedule,
        row: deriveReconciliationRow(
          schedule,
          recordsQuery.data?.events ?? [],
          recordsQuery.data?.breaks ?? []
        ),
      })),
    [recordsQuery.data, schedules]
  )

  const totals = useMemo(() => {
    const counts = { manual: 0, escala: 0, retroativo: 0, pendente: 0 }
    for (const { row } of rows) {
      const origins = [row.arrival.origin, row.exit.origin]
      if (origins.includes("pendente") && !row.absent) counts.pendente += 1
      else if (origins.includes("escala")) counts.escala += 1
      else if (origins.includes("retroativo") || row.absent) counts.retroativo += 1
      else counts.manual += 1
    }
    return counts
  }, [rows])

  async function confirmAllNow() {
    if (!selectedBranchId) {
      toast.error("Selecione uma filial para conferir pela escala.")
      return
    }
    const confirmed = window.confirm(
      "Confirmar agora, nos horários da escala, tudo o que ainda não foi registrado neste dia?\n\nVocê poderá corrigir depois quem fugiu da escala."
    )
    if (!confirmed) return
    try {
      const result = await reconcile.mutateAsync({
        branch_id: selectedBranchId,
        date,
        grace_minutes: 0,
      })
      const summary = summarizeReconciliation(result)
      if (summary) toast.success(`Confirmado conforme a escala: ${summary}.`)
      else toast.info("Nada pendente: tudo já estava registrado.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível conferir pela escala.")
    }
  }

  function openCorrection(schedule: ScheduleWithRelations) {
    const entry = rows.find((item) => item.schedule.id === schedule.id)
    if (!entry) return
    setEditing(schedule)
    setForm(defaultCorrectionForm(schedule, entry.row))
  }

  async function saveCorrection() {
    if (!editing || !form) return
    try {
      await correct.mutateAsync({
        schedule_id: editing.id,
        outcome: form.outcome,
        arrival: form.outcome === "compareceu" ? form.arrival : undefined,
        break_start: form.outcome === "compareceu" ? form.breakStart : undefined,
        break_end: form.outcome === "compareceu" ? form.breakEnd : undefined,
        exit: form.outcome === "compareceu" ? form.exit : undefined,
      })
      setEditing(null)
      setForm(null)
    } catch {
      // O hook já mostra o erro em toast; o formulário continua aberto.
    }
  }

  return (
    <div className="space-y-4 rounded-[28px] bg-[color:var(--bg-surface)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          aria-label="Dia da conferência"
          className="w-52"
          value={date}
          onValueChange={setDate}
          options={dayOptions()}
        />
        <Button
          type="button"
          variant="outline"
          className="rounded-full"
          disabled={reconcile.isPending || schedules.length === 0}
          onClick={() => void confirmAllNow()}
        >
          <CheckCheck className="size-4" />
          {reconcile.isPending ? "Conferindo..." : "Confirmar tudo conforme a escala"}
        </Button>
        <div className="ml-auto flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span className={cn("rounded-full border px-2 py-0.5", originClass.manual)}>
            {totals.manual} registrados
          </span>
          <span className={cn("rounded-full border px-2 py-0.5", originClass.escala)}>
            {totals.escala} conforme escala
          </span>
          <span className={cn("rounded-full border px-2 py-0.5", originClass.retroativo)}>
            {totals.retroativo} informados depois
          </span>
          <span className={cn("rounded-full border px-2 py-0.5", originClass.pendente)}>
            {totals.pendente} sem registro
          </span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        O que a escala previa e não foi registrado é confirmado automaticamente no horário da escala. Corrija
        só quem fugiu dela (atraso, falta, saída antecipada ou hora extra): o relatório do dia usa o que
        estiver aqui.
      </p>

      {schedulesQuery.isLoading || recordsQuery.isLoading ? (
        <StateBlock type="loading" title="Carregando conferência" />
      ) : schedulesQuery.isError ? (
        <StateBlock type="error" title="Erro ao carregar a escala" description={schedulesQuery.error.message} />
      ) : rows.length === 0 ? (
        <StateBlock title="Ninguém escalado neste dia" description="Escolha outro dia para conferir." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[color:var(--border-soft)]">
          <div className="hidden grid-cols-[minmax(180px,1.4fr)_1fr_1fr_1fr_1fr_100px] gap-3 bg-[color:var(--bg-muted)] px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground xl:grid">
            <div>Colaborador / escala</div>
            <div>Entrada</div>
            <div>Saída p/ intervalo</div>
            <div>Retorno</div>
            <div>Saída</div>
            <div />
          </div>
          <div className="divide-y divide-[color:var(--border-soft)]">
            {rows.map(({ schedule, row }) => (
              <div
                key={schedule.id}
                className="grid gap-3 px-4 py-3 xl:grid-cols-[minmax(180px,1.4fr)_1fr_1fr_1fr_1fr_100px] xl:items-center"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-[color:var(--text-primary)]">
                    {schedule.employees?.name ?? "Colaborador"}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {trimTime(schedule.start_time) || "--:--"} → {trimTime(schedule.end_time) || "--:--"}
                    {schedule.break_start && schedule.break_end
                      ? ` · intervalo ${trimTime(schedule.break_start)}–${trimTime(schedule.break_end)}`
                      : ""}
                  </div>
                  {row.absent ? (
                    <Badge variant="outline" className="mt-1 rounded-full border-red-200 bg-red-50 px-1.5 py-0 text-[10px] text-red-700">
                      Faltou
                    </Badge>
                  ) : row.delayMinutes > 0 ? (
                    <div className="mt-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                      Chegou {row.delayMinutes} min depois
                    </div>
                  ) : null}
                </div>
                {row.absent ? (
                  <div className="text-sm text-muted-foreground xl:col-span-4">Sem horários: colaborador faltou.</div>
                ) : (
                  <>
                    <Cell label="Entrada" cell={row.arrival} />
                    <Cell label="Saída p/ intervalo" cell={row.breakStart} />
                    <Cell label="Retorno" cell={row.breakEnd} />
                    <Cell label="Saída" cell={row.exit} />
                  </>
                )}
                <div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => openCorrection(schedule)}
                  >
                    <Pencil className="size-3.5" />
                    Corrigir
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null)
            setForm(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Corrigir {editing?.employees?.name ?? "colaborador"}</DialogTitle>
          </DialogHeader>
          {form ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Informe o que realmente aconteceu. Os horários da escala só valem para o que você não mudar.
              </p>
              <div className="flex gap-2">
                {(["compareceu", "faltou"] as const).map((outcome) => (
                  <Button
                    key={outcome}
                    type="button"
                    variant={form.outcome === outcome ? "default" : "outline"}
                    className="rounded-full"
                    aria-pressed={form.outcome === outcome}
                    onClick={() => setForm({ ...form, outcome })}
                  >
                    {outcome === "compareceu" ? "Compareceu" : "Faltou"}
                  </Button>
                ))}
              </div>
              {form.outcome === "compareceu" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Entrada</span>
                    <Input
                      type="time"
                      value={form.arrival}
                      onChange={(event) => setForm({ ...form, arrival: event.target.value })}
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Saída</span>
                    <Input
                      type="time"
                      value={form.exit}
                      onChange={(event) => setForm({ ...form, exit: event.target.value })}
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Saída para intervalo</span>
                    <Input
                      type="time"
                      value={form.breakStart}
                      onChange={(event) => setForm({ ...form, breakStart: event.target.value })}
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Retorno do intervalo</span>
                    <Input
                      type="time"
                      value={form.breakEnd}
                      onChange={(event) => setForm({ ...form, breakEnd: event.target.value })}
                    />
                  </label>
                  <p className="text-xs text-muted-foreground sm:col-span-2">
                    Deixe a saída em branco se o colaborador ainda está trabalhando. Intervalo: preencha os
                    dois horários ou nenhum.
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button type="button" disabled={correct.isPending} onClick={() => void saveCorrection()}>
              {correct.isPending ? "Salvando..." : "Salvar conferência"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
