import { useMemo } from "react"
import { Medal, Target, Trophy, Users } from "lucide-react"

import { BentoGrid } from "@/components/bento/BentoGrid"
import { MetricCard } from "@/components/bento/MetricCard"
import { PageHeader } from "@/components/shared/PageHeader"
import { StateBlock } from "@/components/shared/StateBlock"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useAllEmployees, useReportEvents } from "@/hooks/useUnyxData"
import type { AttendanceEventType } from "@/types/domain"

const eventPoints: Partial<Record<AttendanceEventType, number>> = {
  entrada_confirmada: 10,
  atraso_detectado: -5,
  falta_detectada: -20,
  retorno_confirmado: 5,
  saida_confirmada: 2,
  ocorrencia_registrada: -3,
}

const eventPointLabel: Partial<Record<AttendanceEventType, string>> = {
  entrada_confirmada: "Sem atraso",
  atraso_detectado: "Atraso",
  falta_detectada: "Falta",
  retorno_confirmado: "Retorno correto",
  saida_confirmada: "Saida confirmada",
  ocorrencia_registrada: "Ocorrencia",
}

function getLevel(points: number) {
  if (points >= 80) return "Elite"
  if (points >= 50) return "Ouro"
  if (points >= 20) return "Prata"
  return "Bronze"
}

export function GamePage() {
  const events = useReportEvents()
  const employees = useAllEmployees()

  const stats = useMemo(() => {
    const ranking: Record<
      string,
      {
        id: string
        name: string
        points: number
        positive: number
        negative: number
        events: number
      }
    > = {}

    for (const employee of employees.data ?? []) {
      if (!employee.active) continue
      ranking[employee.id] = {
        id: employee.id,
        name: employee.name,
        points: 0,
        positive: 0,
        negative: 0,
        events: 0,
      }
    }

    for (const event of events.data ?? []) {
      const points = eventPoints[event.event_type] ?? 0
      if (!ranking[event.employee_id]) {
        ranking[event.employee_id] = {
          id: event.employee_id,
          name: event.employees?.name ?? "Colaborador",
          points: 0,
          positive: 0,
          negative: 0,
          events: 0,
        }
      }

      ranking[event.employee_id].points += points
      ranking[event.employee_id].events += 1
      if (points >= 0) ranking[event.employee_id].positive += points
      if (points < 0) ranking[event.employee_id].negative += Math.abs(points)
    }

    const rows = Object.values(ranking)
      .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
      .slice(0, 20)

    const top = rows[0]
    const participants = rows.filter((row) => row.events > 0).length
    const average =
      rows.length === 0
        ? 0
        : Math.round(rows.reduce((sum, row) => sum + row.points, 0) / rows.length)
    const goalsHit = rows.filter((row) => row.points >= 20).length

    return { rows, top, participants, average, goalsHit }
  }, [employees.data, events.data])

  return (
    <>
      <PageHeader
        title="Unyx Game"
        description="Ranking de engajamento baseado nos eventos operacionais ja registrados."
      />

      <div className="space-y-6 p-6">
        {events.isLoading || employees.isLoading ? (
          <StateBlock type="loading" title="Calculando ranking" />
        ) : events.isError ? (
          <StateBlock
            type="error"
            title="Erro ao carregar eventos"
            description={events.error.message}
          />
        ) : employees.isError ? (
          <StateBlock
            type="error"
            title="Erro ao carregar colaboradores"
            description={employees.error.message}
          />
        ) : (
          <>
            <BentoGrid>
              <MetricCard
                title="Lider atual"
                value={stats.top?.name ?? "-"}
                detail={
                  stats.top ? `${stats.top.points} pontos acumulados` : "Sem dados"
                }
                icon={<Trophy className="size-5" />}
              />
              <MetricCard
                title="Participantes"
                value={stats.participants}
                detail="Com evento operacional"
                icon={<Users className="size-5" />}
              />
              <MetricCard
                title="Media de pontos"
                value={stats.average}
                detail="Entre colaboradores ativos"
                icon={<Target className="size-5" />}
              />
              <MetricCard
                title="Meta prata"
                value={stats.goalsHit}
                detail="Colaboradores com 20+ pontos"
                icon={<Medal className="size-5" />}
              />
            </BentoGrid>

            <div className="grid gap-4 xl:grid-cols-[1fr_0.6fr]">
              <Card className="border bg-white shadow-sm">
                <CardHeader>
                  <CardTitle>Ranking operacional</CardTitle>
                </CardHeader>
                <CardContent>
                  {stats.rows.length === 0 ? (
                    <StateBlock title="Sem colaboradores para pontuar" />
                  ) : (
                    <div className="space-y-2">
                      {stats.rows.map((row, index) => (
                        <div
                          key={row.id}
                          className="grid gap-3 rounded-lg border bg-slate-50 p-3 sm:grid-cols-[2.75rem_1fr_auto]"
                        >
                          <div className="flex size-10 items-center justify-center rounded-full border bg-white text-sm font-semibold">
                            {index + 1}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-medium">{row.name}</div>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              <Badge variant="outline">{getLevel(row.points)}</Badge>
                              <Badge variant="outline">{row.events} evento(s)</Badge>
                            </div>
                          </div>
                          <div className="text-left sm:text-right">
                            <div className="text-xl font-semibold">
                              {row.points}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              +{row.positive} / -{row.negative}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border bg-white shadow-sm">
                <CardHeader>
                  <CardTitle>Regra de pontos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(eventPoints).map(([type, points]) => (
                    <div
                      key={type}
                      className="flex items-center justify-between rounded-lg border bg-slate-50 px-3 py-2"
                    >
                      <span className="text-sm">
                        {eventPointLabel[type as AttendanceEventType] ?? type}
                      </span>
                      <Badge variant={points >= 0 ? "default" : "destructive"}>
                        {points > 0 ? `+${points}` : points}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </>
  )
}
