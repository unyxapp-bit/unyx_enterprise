import { useMemo, useState } from "react"
import { BarChart2, Clock, TrendingDown, Users } from "lucide-react"

import { BentoGrid } from "@/components/bento/BentoGrid"
import { MetricCard } from "@/components/bento/MetricCard"
import { PageHeader } from "@/components/shared/PageHeader"
import { StateBlock } from "@/components/shared/StateBlock"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useReportEvents } from "@/hooks/useUnyxData"
import { formatDateBR } from "@/lib/format"
import { eventLabel } from "@/lib/status"

function getRelativeISODate(daysOffset: number) {
  const date = new Date()
  date.setDate(date.getDate() + daysOffset)
  return date.toISOString().slice(0, 10)
}

export function ReportsPage() {
  const events = useReportEvents()
  const [startDate, setStartDate] = useState(() => getRelativeISODate(-30))
  const [endDate, setEndDate] = useState(() => getRelativeISODate(0))

  const filteredEvents = useMemo(() => {
    const list = events.data ?? []
    return list.filter((e) => {
      const d = e.event_time.slice(0, 10)
      return d >= startDate && d <= endDate
    })
  }, [events.data, startDate, endDate])

  const stats = useMemo(() => {
    const total = filteredEvents.length
    const absences = filteredEvents.filter(
      (e) => e.event_type === "falta_detectada"
    ).length
    const delays = filteredEvents.filter(
      (e) => e.event_type === "atraso_detectado"
    ).length
    const occurrences = filteredEvents.filter(
      (e) => e.event_type === "ocorrencia_registrada"
    ).length

    const employeeCounts: Record<string, { name: string; issues: number }> = {}
    for (const e of filteredEvents) {
      if (
        e.event_type === "falta_detectada" ||
        e.event_type === "atraso_detectado" ||
        e.event_type === "ocorrencia_registrada"
      ) {
        const id = e.employee_id
        if (!employeeCounts[id]) {
          employeeCounts[id] = { name: e.employees?.name ?? "Desconhecido", issues: 0 }
        }
        employeeCounts[id].issues++
      }
    }

    const topEmployees = Object.values(employeeCounts)
      .sort((a, b) => b.issues - a.issues)
      .slice(0, 5)

    const eventBreakdown: Record<string, number> = {}
    for (const e of filteredEvents) {
      eventBreakdown[e.event_type] = (eventBreakdown[e.event_type] ?? 0) + 1
    }

    return { total, absences, delays, occurrences, topEmployees, eventBreakdown }
  }, [filteredEvents])

  return (
    <>
      <PageHeader
        title="Relatórios"
        description="Métricas agregadas de frequência e ocorrências operacionais."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="w-36"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <span className="text-sm text-muted-foreground">até</span>
            <Input
              className="w-36"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        }
      />

      <div className="space-y-6 p-6">
        {events.isLoading ? (
          <StateBlock type="loading" title="Carregando relatório" />
        ) : events.isError ? (
          <StateBlock
            type="error"
            title="Erro ao carregar eventos"
            description={events.error.message}
          />
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Período: {formatDateBR(startDate)} — {formatDateBR(endDate)} ·{" "}
              {stats.total} eventos registrados
            </p>

            <BentoGrid>
              <MetricCard
                title="Faltas"
                value={stats.absences}
                detail="Ausências detectadas"
                icon={<Users className="size-5" />}
                className={stats.absences > 0 ? "border-red-200" : undefined}
              />
              <MetricCard
                title="Atrasos"
                value={stats.delays}
                detail="Entradas tardias"
                icon={<Clock className="size-5" />}
                className={stats.delays > 0 ? "border-amber-200" : undefined}
              />
              <MetricCard
                title="Ocorrências"
                value={stats.occurrences}
                detail="Registros especiais"
                icon={<TrendingDown className="size-5" />}
              />
              <MetricCard
                title="Total de eventos"
                value={stats.total}
                detail="Todos os tipos"
                icon={<BarChart2 className="size-5" />}
              />
            </BentoGrid>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card className="border bg-white shadow-sm">
                <CardHeader>
                  <CardTitle>Colaboradores com mais ocorrências</CardTitle>
                </CardHeader>
                <CardContent>
                  {stats.topEmployees.length === 0 ? (
                    <StateBlock title="Nenhuma ocorrência no período" />
                  ) : (
                    <div className="space-y-2">
                      {stats.topEmployees.map((emp, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between rounded-lg border bg-slate-50 px-3 py-2"
                        >
                          <span className="text-sm font-medium">{emp.name}</span>
                          <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                            {emp.issues} ocorrência(s)
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border bg-white shadow-sm">
                <CardHeader>
                  <CardTitle>Distribuição por tipo de evento</CardTitle>
                </CardHeader>
                <CardContent>
                  {Object.keys(stats.eventBreakdown).length === 0 ? (
                    <StateBlock title="Sem eventos no período" />
                  ) : (
                    <div className="space-y-2">
                      {Object.entries(stats.eventBreakdown)
                        .sort(([, a], [, b]) => b - a)
                        .map(([type, count]) => (
                          <div
                            key={type}
                            className="flex items-center justify-between rounded-lg border bg-slate-50 px-3 py-2"
                          >
                            <span className="text-sm">
                              {eventLabel[type as keyof typeof eventLabel] ?? type}
                            </span>
                            <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-700">
                              {count}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </>
  )
}
