import { useMemo, useState } from "react"
import type { FormEvent } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  History,
  ListChecks,
} from "lucide-react"

import { StatusBadge } from "@/components/bento/StatusBadge"
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
} from "@/components/ui/dialog"
import { modeUiConfig } from "@/features/ops/modes/modeUiConfig"
import {
  getOperationalMode,
  operationalModeNames,
} from "@/features/ops/modes/operationalModes"
import {
  getPriorityByMode,
  sortStatusesByMode,
} from "@/features/ops/modes/priorityRules"
import {
  useOperationalSettings,
  useOperationalStatuses,
  useOrganization,
  useRecordOperationalEvent,
} from "@/hooks/useUnyxData"
import { formatDateTimeBR } from "@/lib/format"
import { eventLabel, operationalActions } from "@/lib/status"
import type {
  AttendanceEventType,
  OperationalStatusRecord,
} from "@/types/domain"
import { localDateKey } from "@/features/operational/utils"

type AlertView = "alerts" | "critical" | "attention" | "review" | "normal" | "all"
type AlertSeverity = "critical" | "attention" | "review" | "normal"

type AlertItem = {
  status: OperationalStatusRecord
  priority: number
  severity: AlertSeverity
  reason: string
  stale: boolean
}

const viewLabel: Record<AlertView, string> = {
  alerts: "Alertas",
  critical: "Criticos",
  attention: "Atencao",
  review: "Revisao",
  normal: "Normal",
  all: "Todos",
}

const viewOptions = [
  "alerts",
  "critical",
  "attention",
  "review",
  "normal",
  "all",
] satisfies AlertView[]

const normalStatuses = new Set(["trabalhando", "voltou", "finalizado", "folga"])

function statusDate(status: OperationalStatusRecord) {
  return status.schedules?.work_date ?? status.updated_at.slice(0, 10)
}

function isStatusStale(status: OperationalStatusRecord, today: string) {
  if (normalStatuses.has(status.current_status)) {
    return statusDate(status) < today && status.current_status !== "finalizado"
  }
  return false
}

function getDisplayReason(
  status: OperationalStatusRecord,
  priority: number,
  stale: boolean
) {
  if (stale) return "Status operacional antigo ainda aberto."
  if (status.status_reason) return status.status_reason
  if (status.current_status === "alerta_critico") return "Alerta critico ativo."
  if (status.current_status === "aguardando_sangria") return "Sangria pendente."
  if (status.current_status === "troca_de_caixa") return "Troca de caixa pendente."
  if (status.current_status === "em_intervalo") return "Colaborador em intervalo."
  if (status.current_status === "deve_sair") return "Saida prevista pede acompanhamento."
  if (status.current_status === "pico") return "Operacao em pico."
  if (priority >= 55) return "Requer acompanhamento operacional."
  return "Status normal registrado."
}

function severityFor(params: {
  status: OperationalStatusRecord
  priority: number
  stale: boolean
}): AlertSeverity {
  if (params.status.current_status === "alerta_critico" || params.priority >= 85) {
    return "critical"
  }
  if (params.stale) return "review"
  if (params.priority >= 55) return "attention"
  return "normal"
}

function itemClassName(severity: AlertSeverity) {
  if (severity === "critical") return "border-red-200 bg-red-50"
  if (severity === "attention") return "border-amber-200 bg-amber-50"
  if (severity === "review") return "border-sky-200 bg-sky-50"
  return "border-border bg-white"
}

function dedupeByEmployee(items: AlertItem[]) {
  const map = new Map<string, AlertItem>()

  for (const item of items) {
    const key = item.status.employee_id
    const current = map.get(key)
    if (
      !current ||
      item.priority > current.priority ||
      (item.priority === current.priority &&
        item.status.updated_at > current.status.updated_at)
    ) {
      map.set(key, item)
    }
  }

  return Array.from(map.values())
}

export function AlertsPage() {
  const statuses = useOperationalStatuses()
  const recordEvent = useRecordOperationalEvent()
  const organization = useOrganization()
  const operationalSettings = useOperationalSettings()
  const [selected, setSelected] = useState<OperationalStatusRecord | null>(null)
  const [eventType, setEventType] =
    useState<AttendanceEventType>("entrada_confirmada")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<AlertView>("alerts")

  const mode = getOperationalMode(
    operationalSettings.data?.mode ?? organization.data?.segment
  )
  const modeConfig = modeUiConfig[mode]

  const alertItems = useMemo(() => {
    const today = localDateKey()
    const ordered = sortStatusesByMode(mode, statuses.data ?? [])
    const mapped = ordered.map((status) => {
      const basePriority = getPriorityByMode(mode, status.current_status, {
        delayMinutes: status.delay_minutes,
        role: status.employees?.role,
        sectorName: status.employees?.sectors?.name,
        reason: status.status_reason,
      })
      const stale = isStatusStale(status, today)
      const priority = stale ? Math.max(basePriority, 70) : basePriority
      const severity = severityFor({ status, priority, stale })

      return {
        status,
        priority,
        severity,
        stale,
        reason: getDisplayReason(status, priority, stale),
      } satisfies AlertItem
    })

    return dedupeByEmployee(mapped).sort(
      (a, b) =>
        b.priority - a.priority ||
        b.status.updated_at.localeCompare(a.status.updated_at) ||
        (a.status.employees?.name ?? "").localeCompare(
          b.status.employees?.name ?? ""
        )
    )
  }, [mode, statuses.data])

  const criticalItems = alertItems.filter((item) => item.severity === "critical")
  const attentionItems = alertItems.filter((item) => item.severity === "attention")
  const reviewItems = alertItems.filter((item) => item.severity === "review")
  const normalItems = alertItems.filter((item) => item.severity === "normal")
  const activeAlertItems = alertItems.filter(
    (item) => item.severity === "critical" || item.severity === "attention"
  )

  const visibleItems =
    view === "critical"
      ? criticalItems
      : view === "attention"
        ? attentionItems
        : view === "review"
          ? reviewItems
          : view === "normal"
            ? normalItems
            : view === "all"
              ? alertItems
              : activeAlertItems

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!selected?.schedule_id) {
      setError("Escala nao encontrada para este colaborador.")
      return
    }

    await recordEvent.mutateAsync({
      branch_id: selected.branch_id,
      employee_id: selected.employee_id,
      schedule_id: selected.schedule_id,
      event_type: eventType,
      notes: notes.trim() || null,
    })

    setSelected(null)
    setNotes("")
  }

  return (
    <>
      <PageHeader
        title="Alertas Operacionais"
        description={modeConfig.mainFocus}
        action={<Badge variant="outline">{operationalModeNames[mode]}</Badge>}
      />

      <div className="space-y-5 p-6">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-lg border bg-white p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="size-4 text-red-600" />
              Criticos
            </div>
            <div className="mt-2 text-2xl font-semibold">{criticalItems.length}</div>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="size-4 text-amber-600" />
              Atencao
            </div>
            <div className="mt-2 text-2xl font-semibold">{attentionItems.length}</div>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <History className="size-4 text-sky-600" />
              Revisao
            </div>
            <div className="mt-2 text-2xl font-semibold">{reviewItems.length}</div>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4 text-emerald-600" />
              Normal
            </div>
            <div className="mt-2 text-2xl font-semibold">{normalItems.length}</div>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <History className="size-4 text-slate-500" />
              Monitorados
            </div>
            <div className="mt-2 text-2xl font-semibold">{alertItems.length}</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {modeConfig.ruleHighlights.map((rule) => (
            <Badge key={rule} variant="outline">
              {rule}
            </Badge>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {viewOptions.map((item) => (
            <Button
              key={item}
              type="button"
              size="sm"
              variant={view === item ? "default" : "outline"}
              onClick={() => setView(item)}
            >
              {viewLabel[item]}
            </Button>
          ))}
        </div>

        {statuses.isLoading ? (
          <StateBlock type="loading" title="Carregando alertas" />
        ) : statuses.isError ? (
          <StateBlock
            type="error"
            title="Erro ao carregar alertas"
            description={statuses.error.message}
          />
        ) : alertItems.length === 0 ? (
          <StateBlock
            title="Nenhum status operacional"
            description="Registre eventos na Operacao do Dia para gerar alertas."
          />
        ) : visibleItems.length === 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>
                {view === "alerts"
                  ? "Nenhum alerta ativo no momento."
                  : "Nenhum alerta nesta categoria."}
              </span>
            </div>
            {view === "alerts" && reviewItems.length > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-100"
                onClick={() => setView("review")}
              >
                Ver revisao ({reviewItems.length})
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibleItems.map((item) => {
              const status = item.status
              return (
                <div
                  key={status.id}
                  className={`rounded-lg border p-4 ${itemClassName(item.severity)}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">
                        {status.employees?.name ?? "Colaborador"}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {status.employees?.sectors?.name ?? "Sem setor"} ·{" "}
                        {status.branches?.name ?? "Filial"}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {status.schedules?.work_date
                          ? `${status.schedules.work_date} · `
                          : ""}
                        {formatDateTimeBR(status.updated_at)}
                      </div>
                    </div>
                    <StatusBadge status={status.current_status} />
                  </div>

                  <div className="mt-3 text-sm text-slate-700">{item.reason}</div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge variant="outline">Prioridade {item.priority}</Badge>
                    {item.stale ? (
                      <Badge className="border-sky-200 bg-white text-sky-700" variant="outline">
                        Revisar fechamento
                      </Badge>
                    ) : null}
                    {item.severity !== "normal" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelected(status)
                          setEventType("entrada_confirmada")
                          setNotes("")
                        }}
                      >
                        <ListChecks className="size-3.5" />
                        Registrar acao
                      </Button>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null)
            setNotes("")
            setError(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar acao operacional</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="rounded-lg border bg-slate-50 p-3 text-sm">
              <div className="font-medium">
                {selected?.employees?.name ?? "Colaborador"}
              </div>
              <div className="mt-1 text-muted-foreground">
                {selected?.employees?.sectors?.name ?? "Sem setor"} ·{" "}
                {selected?.branches?.name ?? "Filial"}
              </div>
            </div>

            <label className="space-y-1 text-sm">
              <span className="font-medium">Evento</span>
              <select
                className="h-8 w-full rounded-lg border bg-white px-2.5 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"
                value={eventType}
                onChange={(e) => setEventType(e.target.value as AttendanceEventType)}
              >
                {operationalActions
                  .filter((action) => action.eventType !== "ocorrencia_registrada")
                  .map((action) => (
                    <option key={action.eventType} value={action.eventType}>
                      {eventLabel[action.eventType]}
                    </option>
                  ))}
              </select>
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium">Observacoes (opcional)</span>
              <textarea
                className="min-h-20 w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex.: colaborador avisou atraso por transporte."
              />
            </label>

            {error || recordEvent.error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error ?? recordEvent.error?.message}
              </div>
            ) : null}

            <DialogFooter>
              <Button type="submit" disabled={recordEvent.isPending}>
                {recordEvent.isPending ? "Registrando..." : "Registrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
