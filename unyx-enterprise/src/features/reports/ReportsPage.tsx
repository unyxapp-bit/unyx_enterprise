import { useMemo, useState } from "react"
import { BarChart2, Clock, Download, TrendingDown, Users } from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useReportEvents } from "@/hooks/useUnyxData"
import { buildCsv, downloadCsv } from "@/lib/exportCsv"
import { formatDateBR } from "@/lib/format"
import { eventLabel } from "@/lib/status"

function getRelativeISODate(daysOffset: number) {
  const date = new Date()
  date.setDate(date.getDate() + daysOffset)
  return date.toISOString().slice(0, 10)
}

const filterClass =
  "h-9 rounded-lg border bg-white px-2.5 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"

export function ReportsPage() {
  const events = useReportEvents()
  const [startDate, setStartDate] = useState(() => getRelativeISODate(-30))
  const [endDate, setEndDate] = useState(() => getRelativeISODate(0))
  const [employeeFilter, setEmployeeFilter] = useState("")
  const [branchFilter, setBranchFilter] = useState("")
  const [sectorFilter, setSectorFilter] = useState("")

  const employeeOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const e of events.data ?? []) {
      if (!map.has(e.employee_id)) map.set(e.employee_id, e.employees?.name ?? "Desconhecido")
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [events.data])

  const branchOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const event of events.data ?? []) {
      if (!map.has(event.branch_id)) {
        map.set(event.branch_id, event.branches?.name ?? "Filial")
      }
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [events.data])

  const sectorOptions = useMemo(() => {
    const set = new Set<string>()
    for (const event of events.data ?? []) {
      const sector = event.employees?.sectors?.name
      if (sector) set.add(sector)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [events.data])

  const filteredEvents = useMemo(() => {
    const list = events.data ?? []
    return list.filter((e) => {
      const d = e.event_time.slice(0, 10)
      const inRange = d >= startDate && d <= endDate
      const inEmployee = !employeeFilter || e.employee_id === employeeFilter
      const inBranch = !branchFilter || e.branch_id === branchFilter
      const inSector = !sectorFilter || e.employees?.sectors?.name === sectorFilter
      return inRange && inEmployee && inBranch && inSector
    })
  }, [branchFilter, employeeFilter, endDate, events.data, sectorFilter, startDate])

  const periodDays = useMemo(() => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1)
  }, [startDate, endDate])

  const prevPeriodEvents = useMemo(() => {
    const list = events.data ?? []
    const prevEnd = new Date(startDate)
    prevEnd.setDate(prevEnd.getDate() - 1)
    const prevStart = new Date(prevEnd)
    prevStart.setDate(prevStart.getDate() - periodDays + 1)
    const ps = prevStart.toISOString().slice(0, 10)
    const pe = prevEnd.toISOString().slice(0, 10)
    return list.filter((e) => {
      const d = e.event_time.slice(0, 10)
      const inRange = d >= ps && d <= pe
      const inEmployee = !employeeFilter || e.employee_id === employeeFilter
      const inBranch = !branchFilter || e.branch_id === branchFilter
      const inSector = !sectorFilter || e.employees?.sectors?.name === sectorFilter
      return inRange && inEmployee && inBranch && inSector
    })
  }, [branchFilter, employeeFilter, events.data, periodDays, sectorFilter, startDate])

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
    const branchCounts: Record<string, { name: string; total: number }> = {}
    const sectorCounts: Record<string, { name: string; total: number }> = {}
    for (const e of filteredEvents) {
      eventBreakdown[e.event_type] = (eventBreakdown[e.event_type] ?? 0) + 1
      const branchName = e.branches?.name ?? "Filial"
      const sectorName = e.employees?.sectors?.name ?? "Sem setor"
      branchCounts[e.branch_id] = branchCounts[e.branch_id] ?? {
        name: branchName,
        total: 0,
      }
      branchCounts[e.branch_id].total++
      sectorCounts[sectorName] = sectorCounts[sectorName] ?? {
        name: sectorName,
        total: 0,
      }
      sectorCounts[sectorName].total++
    }

    return {
      total,
      absences,
      delays,
      occurrences,
      topEmployees,
      eventBreakdown,
      topBranches: Object.values(branchCounts)
        .sort((a, b) => b.total - a.total)
        .slice(0, 5),
      topSectors: Object.values(sectorCounts)
        .sort((a, b) => b.total - a.total)
        .slice(0, 5),
    }
  }, [filteredEvents])

  const dailyChartData = useMemo(() => {
    const map = new Map<string, { date: string; faltas: number; atrasos: number; ocorrencias: number; total: number }>()
    for (const e of filteredEvents) {
      const day = e.event_time.slice(0, 10)
      if (!map.has(day)) map.set(day, { date: day, faltas: 0, atrasos: 0, ocorrencias: 0, total: 0 })
      const entry = map.get(day)!
      entry.total++
      if (e.event_type === "falta_detectada") entry.faltas++
      if (e.event_type === "atraso_detectado") entry.atrasos++
      if (e.event_type === "ocorrencia_registrada") entry.ocorrencias++
    }
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date))
  }, [filteredEvents])

  const typeChartData = useMemo(() => {
    return Object.entries(stats.eventBreakdown)
      .map(([type, count]) => ({
        label: eventLabel[type as keyof typeof eventLabel] ?? type,
        total: count,
      }))
      .sort((a, b) => b.total - a.total)
  }, [stats.eventBreakdown])

  function handleExport() {
    const headers = [
      { key: "event_time", label: "Data/Hora" },
      { key: "employee_name", label: "Colaborador" },
      { key: "event_type_label", label: "Tipo de evento" },
      { key: "branch_name", label: "Filial" },
      { key: "sector_name", label: "Setor" },
      { key: "notes", label: "Observacoes" },
    ]
    const rows = filteredEvents.map((e) => ({
      event_time: e.event_time,
      employee_name: e.employees?.name ?? "",
      event_type_label: eventLabel[e.event_type as keyof typeof eventLabel] ?? e.event_type,
      branch_name: e.branches?.name ?? "",
      sector_name: e.employees?.sectors?.name ?? "",
      notes: e.notes ?? "",
    }))
    downloadCsv(buildCsv(rows, headers), `relatorio_${startDate}_${endDate}.csv`)
  }

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
            {employeeOptions.length > 0 ? (
              <select
                className={filterClass}
                value={employeeFilter}
                onChange={(e) => setEmployeeFilter(e.target.value)}
              >
                <option value="">Todos os colaboradores</option>
                {employeeOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name}
                  </option>
                ))}
              </select>
            ) : null}
            {branchOptions.length > 1 ? (
              <select
                className={filterClass}
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
              >
                <option value="">Todas as filiais</option>
                {branchOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name}
                  </option>
                ))}
              </select>
            ) : null}
            {sectorOptions.length > 0 ? (
              <select
                className={filterClass}
                value={sectorFilter}
                onChange={(e) => setSectorFilter(e.target.value)}
              >
                <option value="">Todos os setores</option>
                {sectorOptions.map((sector) => (
                  <option key={sector} value={sector}>
                    {sector}
                  </option>
                ))}
              </select>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={filteredEvents.length === 0}
            >
              <Download className="mr-1.5 size-4" />
              Exportar CSV
            </Button>
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

            {(() => {
              const prevAbsences = prevPeriodEvents.filter((e) => e.event_type === "falta_detectada").length
              const prevDelays = prevPeriodEvents.filter((e) => e.event_type === "atraso_detectado").length
              const prevOccurrences = prevPeriodEvents.filter((e) => e.event_type === "ocorrencia_registrada").length
              const delta = (cur: number, prev: number) => {
                if (prev === 0) return null
                const pct = Math.round(((cur - prev) / prev) * 100)
                return pct
              }
              const absencesDelta = delta(stats.absences, prevAbsences)
              const delaysDelta = delta(stats.delays, prevDelays)
              const occurrencesDelta = delta(stats.occurrences, prevOccurrences)
              if (prevPeriodEvents.length === 0) return null
              return (
                <Card className="border bg-white shadow-sm">
                  <CardHeader>
                    <CardTitle>Comparativo com periodo anterior ({periodDays} dias)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {[
                        { label: "Faltas", cur: stats.absences, prev: prevAbsences, delta: absencesDelta },
                        { label: "Atrasos", cur: stats.delays, prev: prevDelays, delta: delaysDelta },
                        { label: "Ocorrencias", cur: stats.occurrences, prev: prevOccurrences, delta: occurrencesDelta },
                      ].map((item) => (
                        <div key={item.label} className="rounded-lg border bg-slate-50 p-3">
                          <div className="text-xs text-muted-foreground">{item.label}</div>
                          <div className="mt-1 flex items-end gap-2">
                            <span className="text-xl font-bold">{item.cur}</span>
                            <span className="text-sm text-muted-foreground">vs {item.prev}</span>
                            {item.delta != null ? (
                              <span className={`text-xs font-medium ${item.delta > 0 ? "text-red-600" : item.delta < 0 ? "text-emerald-600" : "text-slate-500"}`}>
                                {item.delta > 0 ? "+" : ""}{item.delta}%
                              </span>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )
            })()}

            <Card className="border bg-white shadow-sm">
              <CardHeader>
                <CardTitle>Eventos por dia</CardTitle>
              </CardHeader>
              <CardContent>
                {dailyChartData.length === 0 ? (
                  <StateBlock title="Sem eventos no período" />
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dailyChartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="faltas" stroke="#ef4444" dot={false} name="Faltas" />
                        <Line type="monotone" dataKey="atrasos" stroke="#f59e0b" dot={false} name="Atrasos" />
                        <Line type="monotone" dataKey="ocorrencias" stroke="#8b5cf6" dot={false} name="Ocorrencias" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card className="border bg-white shadow-sm">
                <CardHeader>
                  <CardTitle>Colaboradores com mais ocorrencias</CardTitle>
                </CardHeader>
                <CardContent>
                  {stats.topEmployees.length === 0 ? (
                    <StateBlock title="Nenhuma ocorrencia no periodo" />
                  ) : (
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.topEmployees} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                          <YAxis type="category" dataKey="name" width={100} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Bar dataKey="issues" fill="#ef4444" radius={[0, 4, 4, 0]} name="Ocorrencias" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border bg-white shadow-sm">
                <CardHeader>
                  <CardTitle>Distribuicao por tipo de evento</CardTitle>
                </CardHeader>
                <CardContent>
                  {typeChartData.length === 0 ? (
                    <StateBlock title="Sem eventos no periodo" />
                  ) : (
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={typeChartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Bar dataKey="total" fill="#0f172a" radius={[4, 4, 0, 0]} name="Total" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card className="border bg-white shadow-sm">
                <CardHeader>
                  <CardTitle>Eventos por filial</CardTitle>
                </CardHeader>
                <CardContent>
                  {stats.topBranches.length === 0 ? (
                    <StateBlock title="Sem eventos por filial" />
                  ) : (
                    <div className="space-y-2">
                      {stats.topBranches.map((branch) => (
                        <div
                          key={branch.name}
                          className="flex items-center justify-between rounded-lg border bg-slate-50 px-3 py-2 text-sm"
                        >
                          <span className="font-medium">{branch.name}</span>
                          <span className="text-muted-foreground">
                            {branch.total} evento(s)
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border bg-white shadow-sm">
                <CardHeader>
                  <CardTitle>Eventos por setor</CardTitle>
                </CardHeader>
                <CardContent>
                  {stats.topSectors.length === 0 ? (
                    <StateBlock title="Sem eventos por setor" />
                  ) : (
                    <div className="space-y-2">
                      {stats.topSectors.map((sector) => (
                        <div
                          key={sector.name}
                          className="flex items-center justify-between rounded-lg border bg-slate-50 px-3 py-2 text-sm"
                        >
                          <span className="font-medium">{sector.name}</span>
                          <span className="text-muted-foreground">
                            {sector.total} evento(s)
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
