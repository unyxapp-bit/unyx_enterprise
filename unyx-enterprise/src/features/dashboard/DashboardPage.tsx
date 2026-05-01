import {
  AlertTriangle,
  Clock,
  Coffee,
  Gauge,
  Users,
} from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { BentoGrid } from "@/components/bento/BentoGrid"
import { MetricCard } from "@/components/bento/MetricCard"
import { StatusBadge } from "@/components/bento/StatusBadge"
import { PageHeader } from "@/components/shared/PageHeader"
import { StateBlock } from "@/components/shared/StateBlock"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  useDashboardRows,
  useOperationalStatuses,
  useSchedules,
} from "@/hooks/useUnyxData"
import { formatTime, minutesLabel, todayISO } from "@/lib/format"
import { operationalStatuses, statusMeta } from "@/lib/status"

export function DashboardPage() {
  const today = todayISO()
  const dashboard = useDashboardRows(today)
  const schedules = useSchedules(today)
  const statuses = useOperationalStatuses()
  const rows = dashboard.data ?? []
  const liveStatuses = statuses.data ?? []
  const scheduledToday = schedules.data ?? []
  const statusSource =
    rows.length > 0 ? rows : liveStatuses.map((status) => ({
      current_status: status.current_status,
      delay_minutes: status.delay_minutes,
    }))

  const criticalCount = statusSource.filter(
    (row) => row.current_status === "alerta_critico"
  ).length
  const breakCount = statusSource.filter(
    (row) => row.current_status === "em_intervalo"
  ).length
  const delayMinutes = statusSource.reduce(
    (total, row) => total + row.delay_minutes,
    0
  )
  const statusChartData = operationalStatuses.map((status) => ({
    label: statusMeta[status].label,
    total: statusSource.filter((row) => row.current_status === status).length,
  }))

  if (dashboard.isError) {
    return (
      <>
        <PageHeader title="Dashboard Operacional" />
        <div className="p-6">
          <StateBlock
            type="error"
            title="Não foi possível carregar o dashboard"
            description={dashboard.error.message}
          />
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Dashboard Operacional"
        description="Visão viva da operação do dia, organizada por prioridade."
      />

      <div className="space-y-6 p-6">
        <BentoGrid>
          <MetricCard
            title="Escalados hoje"
            value={scheduledToday.length}
            detail="Colaboradores na escala"
            icon={<Users className="size-5" />}
          />
          <MetricCard
            title="Em alerta"
            value={criticalCount}
            detail="Demandam ação imediata"
            icon={<AlertTriangle className="size-5" />}
            className={criticalCount > 0 ? "border-red-200" : undefined}
          />
          <MetricCard
            title="Em intervalo"
            value={breakCount}
            detail="Pausas em andamento"
            icon={<Coffee className="size-5" />}
          />
          <MetricCard
            title="Atraso acumulado"
            value={minutesLabel(delayMinutes)}
            detail="Somatório do dia"
            icon={<Clock className="size-5" />}
          />
        </BentoGrid>

        <div className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
          <Card className="border bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gauge className="size-5" />
                Status por categoria
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dashboard.isLoading || statuses.isLoading ? (
                <StateBlock type="loading" title="Carregando status" />
              ) : statusSource.length === 0 ? (
                <StateBlock
                  title="Sem status operacional"
                  description="Cadastre escalas e registre eventos para alimentar o painel."
                />
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={statusChartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                      <Tooltip />
                      <Bar dataKey="total" fill="#0f172a" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Alertas críticos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {rows.filter((row) => row.current_status === "alerta_critico").length ===
              0 ? (
                <StateBlock
                  title="Nenhum alerta crítico"
                  description="A operação não possui registros críticos no momento."
                />
              ) : (
                rows
                  .filter((row) => row.current_status === "alerta_critico")
                  .slice(0, 6)
                  .map((row) => (
                    <div
                      key={row.id}
                      className="rounded-lg border border-red-100 bg-red-50 p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium">{row.employee_name}</div>
                        <StatusBadge status={row.current_status} />
                      </div>
                      <div className="mt-1 text-sm text-red-700">
                        {row.status_reason ?? "Prioridade operacional alta"}
                      </div>
                    </div>
                  ))
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Operação em tempo real</CardTitle>
          </CardHeader>
          <CardContent>
            {dashboard.isLoading ? (
              <StateBlock type="loading" title="Carregando operação" />
            ) : rows.length === 0 ? (
              <StateBlock
                title="Dashboard aguardando eventos"
                description="Depois que a operação do dia começar, os colaboradores aparecerão aqui por prioridade."
              />
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {rows.map((row) => (
                  <div
                    key={row.id}
                    className="rounded-lg border bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{row.employee_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {row.sector_name ?? "Sem setor"} · {row.branch_name}
                        </div>
                      </div>
                      <StatusBadge status={row.current_status} />
                    </div>
                    <div className="mt-4 grid grid-cols-4 gap-2 text-xs text-muted-foreground">
                      <span>Entrada {formatTime(row.start_time)}</span>
                      <span>Int. {formatTime(row.break_start)}</span>
                      <span>Ret. {formatTime(row.break_end)}</span>
                      <span>Saída {formatTime(row.end_time)}</span>
                    </div>
                    {row.delay_minutes > 0 ? (
                      <div className="mt-3 text-sm font-medium text-red-700">
                        {minutesLabel(row.delay_minutes)} de atraso
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
