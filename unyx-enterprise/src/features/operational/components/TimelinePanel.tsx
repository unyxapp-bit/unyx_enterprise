/**
 * TimelinePanel - Painel de timeline colapsável
 */

import React from "react"
import { ChevronDown, History } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StateBlock } from "@/components/shared/StateBlock"
import { eventLabel } from "@/lib/status"
import { formatDateTimeBR } from "@/lib/format"
import type { AttendanceEvent } from "@/types/domain"

interface TimelinePanelProps {
  isOpen: boolean
  onToggle: () => void
  events: AttendanceEvent[] | undefined
  isLoading: boolean
  isError: boolean
  error?: Error | null
}

export const TimelinePanel = React.memo(
  ({ isOpen, onToggle, events, isLoading, isError, error }: TimelinePanelProps) => {
    return (
      <Card className="self-start border bg-white shadow-sm">
        <CardHeader
          className="cursor-pointer select-none"
          onClick={onToggle}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              onToggle()
            }
          }}
          aria-expanded={isOpen}
        >
          <CardTitle className="flex items-center gap-2">
            <History className="size-5" />
            <span className="flex-1">Timeline</span>
            <ChevronDown
              className={`size-4 text-muted-foreground transition-transform duration-200 ${
                isOpen ? "rotate-180" : ""
              }`}
            />
          </CardTitle>
        </CardHeader>
        {isOpen ? (
          <CardContent>
            {isLoading ? (
              <StateBlock type="loading" title="Carregando eventos" />
            ) : isError ? (
              <StateBlock
                type="error"
                title="Erro ao carregar eventos"
                description={error?.message}
              />
            ) : (events ?? []).length === 0 ? (
              <StateBlock title="Nenhum evento registrado" />
            ) : (
              <div className="space-y-3">
                {(events ?? []).slice(0, 12).map((event) => (
                  <div key={event.id} className="rounded-lg border bg-slate-50 p-3">
                    <div className="text-sm font-medium">
                      {eventLabel[event.event_type] ?? event.event_type}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {event.employees?.name ?? "Colaborador"} ·{" "}
                      {formatDateTimeBR(event.event_time)}
                    </div>
                    {event.notes ? (
                      <div className="mt-2 text-sm text-muted-foreground">
                        {event.notes}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        ) : null}
      </Card>
    )
  }
)

TimelinePanel.displayName = "TimelinePanel"
