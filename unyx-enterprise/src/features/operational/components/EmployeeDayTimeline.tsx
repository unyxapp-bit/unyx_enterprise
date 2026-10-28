import { useMemo } from "react"

import { useEmployeeDayAllocations, useEmployeeDayEvents } from "@/hooks/useUnyxData"
import { eventLabel } from "@/lib/status"

type TimelineEntry = { at: string; label: string; detail?: string | null }

const timeBR = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false }).format(
    new Date(iso)
  )

/** Linha do tempo do colaborador no dia: chegada, postos, intervalos e saída, em ordem. */
export function EmployeeDayTimeline({
  employeeId,
  dateKey,
}: {
  employeeId: string
  dateKey: string
}) {
  const events = useEmployeeDayEvents(employeeId, dateKey)
  const allocations = useEmployeeDayAllocations(employeeId, dateKey)

  const entries = useMemo(() => {
    const list: TimelineEntry[] = []
    for (const event of events.data ?? []) {
      list.push({
        at: event.event_time,
        label: eventLabel[event.event_type] ?? event.event_type,
        detail: event.notes,
      })
    }
    for (const allocation of allocations.data ?? []) {
      const post = allocation.operational_posts?.name ?? "posto"
      list.push({ at: allocation.started_at, label: `Entrou no ${post}` })
      if (allocation.ended_at) {
        list.push({ at: allocation.ended_at, label: `Saiu do ${post}`, detail: allocation.notes })
      }
    }
    return list.sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
  }, [allocations.data, events.data])

  return (
    <details className="group rounded-2xl border border-[color:var(--border-soft)] p-4">
      <summary className="cursor-pointer text-xs uppercase tracking-wide text-muted-foreground">
        Histórico do dia
        {entries.length > 0 ? ` (${entries.length})` : ""}
      </summary>
      {events.isLoading || allocations.isLoading ? (
        <div className="mt-3 text-sm text-muted-foreground">Carregando...</div>
      ) : entries.length === 0 ? (
        <div className="mt-3 text-sm text-muted-foreground">
          Nenhum registro hoje para este colaborador.
        </div>
      ) : (
        <ol className="mt-3 space-y-2 border-l border-[color:var(--border-soft)] pl-4">
          {entries.map((entry, index) => (
            <li key={`${entry.at}-${index}`} className="relative text-sm">
              <span className="absolute -left-[1.3rem] top-1.5 size-2 rounded-full bg-[color:var(--primary)]" />
              <span className="font-semibold tabular-nums text-[color:var(--text-primary)]">
                {timeBR(entry.at)}
              </span>{" "}
              <span className="text-[color:var(--text-primary)]">{entry.label}</span>
              {entry.detail ? (
                <div className="text-xs text-muted-foreground">{entry.detail}</div>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </details>
  )
}
