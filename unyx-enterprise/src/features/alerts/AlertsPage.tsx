import { useMemo, useState } from "react"
import type { FormEvent } from "react"
import { AlertTriangle } from "lucide-react"

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
import type { AttendanceEventType, OperationalStatusRecord } from "@/types/domain"

export function AlertsPage() {
  const statuses = useOperationalStatuses()
  const recordEvent = useRecordOperationalEvent()
  const organization = useOrganization()
  const operationalSettings = useOperationalSettings()
  const [selected, setSelected] = useState<OperationalStatusRecord | null>(null)
  const [eventType, setEventType] = useState<AttendanceEventType>("entrada_confirmada")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)

  const mode = getOperationalMode(
    operationalSettings.data?.mode ?? organization.data?.segment
  )
  const modeConfig = modeUiConfig[mode]

  const orderedStatuses = useMemo(
    () => sortStatusesByMode(mode, statuses.data ?? []),
    [mode, statuses.data]
  )

  const priorityStatuses = orderedStatuses.filter((status) => {
    const priority = getPriorityByMode(mode, status.current_status, {
      delayMinutes: status.delay_minutes,
      role: status.employees?.role,
      sectorName: status.employees?.sectors?.name,
      reason: status.status_reason,
    })

    return status.current_status === "alerta_critico" || priority >= 65
  })

  const otherStatuses = orderedStatuses.filter(
    (status) => !priorityStatuses.some((priority) => priority.id === status.id)
  )

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

      <div className="space-y-6 p-6">
        <div className="flex flex-wrap gap-1.5">
          {modeConfig.ruleHighlights.map((rule) => (
            <Badge key={rule} variant="outline">
              {rule}
            </Badge>
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
        ) : orderedStatuses.length === 0 ? (
          <StateBlock
            title="Nenhum status operacional"
            description="Registre eventos na Operacao do Dia para gerar alertas."
          />
        ) : (
          <>
            {priorityStatuses.length > 0 ? (
              <div>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {modeConfig.highPriorityTitle}
                </h2>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {priorityStatuses.map((status) => (
                    <div
                      key={status.id}
                      className={`rounded-lg border p-4 ${
                        status.current_status === "alerta_critico"
                          ? "border-red-200 bg-red-50"
                          : status.current_status === "deve_sair"
                            ? "border-amber-200 bg-amber-50"
                            : "border-orange-200 bg-orange-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium">
                            {status.employees?.name ?? "Colaborador"}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {status.employees?.sectors?.name ?? "Sem setor"} ·{" "}
                            {status.branches?.name ?? "Filial"}
                          </div>
                          {status.status_reason ? (
                            <div className="mt-1 text-sm text-slate-700">
                              {status.status_reason}
                            </div>
                          ) : null}
                        </div>
                        <StatusBadge status={status.current_status} />
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <Badge variant="outline">
                          Prioridade{" "}
                          {getPriorityByMode(mode, status.current_status, {
                            delayMinutes: status.delay_minutes,
                            role: status.employees?.role,
                            sectorName: status.employees?.sectors?.name,
                            reason: status.status_reason,
                          })}
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelected(status)
                            setEventType("entrada_confirmada")
                            setNotes("")
                          }}
                        >
                          Registrar acao
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {otherStatuses.length > 0 ? (
              <div>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Status atual
                </h2>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {otherStatuses.map((status) => (
                    <div
                      key={status.id}
                      className="rounded-lg border bg-white p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium">
                            {status.employees?.name ?? "Colaborador"}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {status.employees?.sectors?.name ?? "Sem setor"} ·{" "}
                            {status.branches?.name ?? "Filial"}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {formatDateTimeBR(status.updated_at)}
                          </div>
                        </div>
                        <StatusBadge status={status.current_status} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {priorityStatuses.length === 0 && otherStatuses.length > 0 ? (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                <AlertTriangle className="size-4 shrink-0" />
                Nenhum alerta de alta prioridade no momento. Operacao dentro do normal.
              </div>
            ) : null}
          </>
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
