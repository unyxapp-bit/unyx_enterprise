import {
  AlertTriangle,
  Clock,
  Coffee,
  Gauge,
  RefreshCw,
  Users,
} from "lucide-react"
import { useMemo, useState } from "react"
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
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  useDashboardRows,
  useOperationalStatuses,
  useSchedules,
} from "@/hooks/useUnyxData"
import { formatTime, minutesLabel, todayISO } from "@/lib/format"
import { operationalStatuses, statusMeta } from "@/lib/status"
import type { OperationalStatus } from "@/types/domain"

const fieldClass =
  "h-8 rounded-lg border bg-white px-2.5 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"

type StatusCount = { current_status: OperationalStatus; delay_minutes: number }

export function DashboardPage() {
  const [date, setDate] = useState(todayISO())
  const [sectorFilter, setSectorFilter] = useState("")
  const dashboard = useDashboardRows(date)
  const schedules = useSchedules(date)
  const statuses = useOperationalStatuses()
  const rows = dashboard.data ?? []
  const liveStatuses = statuses.data ?? []
  const scheduledToday = schedules.data ?? []

  const sectorOptions = useMemo(() => {
    const names = new Set(rows.map((r) => r.sector_name).filter(Boolean) as string[])
    return Array.from(names).sort()
  }, [rows])

  const filteredRows = sectorFilter
    ? rows.filter((r) => r.sector_name === sectorFilter)
    : rows

  const statusSource: StatusCount[] =
    filteredRows.length > 0
      ? filteredRows.map((r) => ({
          current_status: r.current_status,
          delay_minutes: r.delay_minutes,
        }))
      : liveStatuses.map((s) => ({
          current_status: s.current_status,
          delay_minutes: s.delay_minutes,
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

  const lastUpdated = dashboard.dataUpdatedAt
    ? new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(new Date(dashboard.dataUpdatedAt))
    : null

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
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="w-40"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            {sectorOptions.length > 0 ? (
              <select
                className={fieldClass}
                value={sectorFilter}
                onChange={(e) => setSectorFilter(e.target.value)}
              >
                <option value="">Todos os setores</option>
                {sectorOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            ) : null}
            <Button
              variant="outline"
              size="icon"
              onClick={() => void dashboard.refetch()}
              disabled={dashboard.isFetching}
              aria-label="Atualizar"
            >
              <RefreshCw
                className={`size-4 ${dashboard.isFetching ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        }
      />

      <div className="space-y-6 p-6">
        {lastUpdated ? (
          <p className="text-xs text-muted-foreground">
            Atualizado às {lastUpdated}
            {sectorFilter ? ` · Setor: ${sectorFilter}` : ""}
          </p>
        ) : null}

        <BentoGrid>
          <MetricCard
            title="Escalados"
            value={sectorFilter ? filteredRows.length : scheduledToday.length}
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
              {filteredRows.filter((row) => row.current_status === "alerta_critico").length === 0 ? (
                <StateBlock
                  title="Nenhum alerta crítico"
                  description="A operação não possui registros críticos no momento."
                />
              ) : (
                filteredRows
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
            ) : filteredRows.length === 0 ? (
              <StateBlock
                title="Dashboard aguardando eventos"
                description="Depois que a operação do dia começar, os colaboradores aparecerão aqui por prioridade."
              />
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filteredRows.map((row) => (
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
