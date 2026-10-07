import { useMemo } from "react"
import { Download, ShieldAlert } from "lucide-react"

import { StateBlock } from "@/components/shared/StateBlock"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useSchedulesRange } from "@/hooks/useUnyxData"
import { buildCsv, downloadCsv } from "@/lib/exportCsv"
import { formatDateBR } from "@/lib/format"
import type { ScheduleWithRelations } from "@/types/domain"

type Severity = "critical" | "attention"

interface AuditFinding {
  employee: string
  sector: string
  branch: string
  date: string
  rule: string
  detail: string
  severity: Severity
}

const NON_WORK_STATUSES = new Set(["day_off", "banked_hours", "cancelled"])

function dateOffset(date: string, amount: number) {
  const value = new Date(`${date}T12:00:00`)
  value.setDate(value.getDate() + amount)
  return value.toISOString().slice(0, 10)
}

function dayOffset(from: string, to: string) {
  return Math.round(
    (new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) /
      86_400_000
  )
}

function timeMinutes(value: string | null) {
  if (!value) return null
  const match = value.match(/^(\d{1,2}):(\d{2})/)
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

function isScheduledWork(schedule: ScheduleWithRelations) {
  return (
    !NON_WORK_STATUSES.has(schedule.status) &&
    schedule.status !== "absent" &&
    Boolean(schedule.start_time && schedule.end_time)
  )
}

function isExplicitRest(schedule: ScheduleWithRelations | undefined) {
  return schedule?.status === "day_off"
}

function plannedWorkMinutes(schedule: ScheduleWithRelations) {
  const start = timeMinutes(schedule.start_time)
  const end = timeMinutes(schedule.end_time)
  if (start == null || end == null) return null

  let total = end - start
  if (total < 0) total += 24 * 60

  const breakStart = timeMinutes(schedule.break_start)
  const breakEnd = timeMinutes(schedule.break_end)
  if (breakStart != null && breakEnd != null) {
    let pause = breakEnd - breakStart
    if (pause < 0) pause += 24 * 60
    total -= pause
  } else if ((breakStart == null) !== (breakEnd == null)) {
    return null
  }

  return total
}

function auditSchedules(
  schedules: ScheduleWithRelations[],
  periodStart: string,
  periodEnd: string
) {
  const findings: AuditFinding[] = []
  const byEmployee = new Map<string, ScheduleWithRelations[]>()

  for (const schedule of schedules) {
    const employeeId = schedule.employee_id
    byEmployee.set(employeeId, [...(byEmployee.get(employeeId) ?? []), schedule])
  }

  for (const employeeSchedules of byEmployee.values()) {
    const sorted = [...employeeSchedules].sort((a, b) =>
      `${a.work_date} ${a.start_time ?? "00:00"}`.localeCompare(
        `${b.work_date} ${b.start_time ?? "00:00"}`
      )
    )
    const employee = sorted[0]?.employees?.name ?? "Colaborador"
    const sector = sorted[0]?.employees?.sectors?.name ?? ""
    const branch = sorted[0]?.branches?.name ?? ""
    const byDate = new Map<string, ScheduleWithRelations[]>()
    for (const schedule of sorted) {
      byDate.set(schedule.work_date, [...(byDate.get(schedule.work_date) ?? []), schedule])
    }
    const daily = [...byDate.entries()]
      .map(([date, entries]) => ({
        date,
        entries,
        work: entries.some(isScheduledWork),
        rest: entries.some((entry) => isExplicitRest(entry)),
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
    const workSchedules = sorted.filter(isScheduledWork)

    for (const schedule of workSchedules) {
      if (schedule.work_date < periodStart || schedule.work_date > periodEnd) continue
      const minutes = plannedWorkMinutes(schedule)
      if (minutes == null) {
        findings.push({
          employee,
          sector,
          branch,
          date: schedule.work_date,
          rule: "Jornada incompleta",
          detail: "Faltam horários para calcular a carga líquida do dia.",
          severity: "attention",
        })
      } else if (minutes > 10 * 60) {
        findings.push({
          employee,
          sector,
          branch,
          date: schedule.work_date,
          rule: "Acima de 10h planejadas",
          detail: `${(minutes / 60).toFixed(1)}h líquidas; revisar imediatamente a escala e o regime aplicável.`,
          severity: "critical",
        })
      } else if (minutes > 8 * 60) {
        findings.push({
          employee,
          sector,
          branch,
          date: schedule.work_date,
          rule: "Jornada acima de 8h",
          detail: `${(minutes / 60).toFixed(1)}h líquidas; verificar autorização e registro de horas extras.`,
          severity: "attention",
        })
      }
    }

    for (let index = 1; index < workSchedules.length; index += 1) {
      const previous = workSchedules[index - 1]
      const next = workSchedules[index]
      if (previous.work_date === next.work_date) continue
      if (next.work_date < periodStart || next.work_date > periodEnd) continue
      const previousEnd = timeMinutes(previous.end_time)
      const nextStart = timeMinutes(next.start_time)
      if (previousEnd == null || nextStart == null) continue
      const elapsed =
        dayOffset(previous.work_date, next.work_date) * 24 * 60 + nextStart - previousEnd
      if (elapsed < 11 * 60) {
        findings.push({
          employee,
          sector,
          branch,
          date: next.work_date,
          rule: "Interjornada abaixo de 11h",
          detail: `Há ${Math.max(0, elapsed / 60).toFixed(1)}h entre a saída de ${formatDateBR(previous.work_date)} e a próxima entrada.`,
          severity: "critical",
        })
      }
    }

    let streak = 0
    let previousDate = ""
    for (const day of daily) {
      if (!day.work) {
        streak = 0
        previousDate = day.date
        continue
      }
      streak = previousDate && dayOffset(previousDate, day.date) === 1 ? streak + 1 : 1
      previousDate = day.date
      if (day.date < periodStart || day.date > periodEnd || (streak !== 6 && streak !== 7)) continue
      findings.push({
        employee,
        sector,
        branch,
        date: day.date,
        rule: streak >= 7 ? "7 dias consecutivos" : "6 dias consecutivos",
        detail:
          streak >= 7
            ? "O repouso precisa ocorrer até o 7º dia; revise a concessão antes de considerar a escala regular."
            : "A sequência está próxima do limite. Confirme o repouso semanal antes da próxima jornada.",
        severity: streak >= 7 ? "critical" : "attention",
      })
    }

    for (const sunday of workSchedules.filter(
      (schedule) =>
        schedule.work_date >= periodStart &&
        schedule.work_date <= periodEnd &&
        new Date(`${schedule.work_date}T12:00:00`).getDay() === 0
    )) {
      const monday = dateOffset(sunday.work_date, -6)
      const previousWeek = Array.from({ length: 6 }, (_, index) => dateOffset(monday, index))
      if (!previousWeek.some((date) => (byDate.get(date) ?? []).some(isExplicitRest))) {
        const complete = previousWeek.every((date) => byDate.has(date))
        findings.push({
          employee,
          sector,
          branch,
          date: sunday.work_date,
          rule: "Folga antes do domingo",
          detail: complete
            ? "Nenhuma folga está registrada de segunda a sábado (regra do modelo)."
            : "Não há folga registrada; faltam dias no cadastro para confirmar a regra do modelo.",
          severity: complete ? "critical" : "attention",
        })
      }

      const nextWeek = Array.from({ length: 7 }, (_, index) => dateOffset(sunday.work_date, index + 1))
      if (!nextWeek.some((date) => (byDate.get(date) ?? []).some(isExplicitRest))) {
        const complete = nextWeek.every((date) => byDate.has(date))
        findings.push({
          employee,
          sector,
          branch,
          date: sunday.work_date,
          rule: "Folga após o domingo",
          detail: complete
            ? "Nenhuma folga está registrada na semana seguinte (regra do modelo)."
            : "A semana seguinte ainda não está totalmente cadastrada; a regra do modelo está pendente.",
          severity: complete ? "critical" : "attention",
        })
      }
    }

    const workedSundays = workSchedules
      .filter((schedule) => new Date(`${schedule.work_date}T12:00:00`).getDay() === 0)
      .map((schedule) => schedule.work_date)
    for (let index = 2; index < workedSundays.length; index += 1) {
      const first = workedSundays[index - 2]
      const second = workedSundays[index - 1]
      const third = workedSundays[index]
      if (
        dayOffset(first, second) !== 7 ||
        dayOffset(second, third) !== 7 ||
        third < periodStart ||
        third > periodEnd
      ) {
        continue
      }
      findings.push({
        employee,
        sector,
        branch,
        date: third,
        rule: "3 domingos consecutivos",
        detail: "Revisar a escala de repouso dominical para o comércio, considerando legislação local e norma coletiva aplicável.",
        severity: "critical",
      })
    }
  }

  return findings.sort((a, b) => {
    const severityOrder = { critical: 0, attention: 1 }
    return (
      severityOrder[a.severity] - severityOrder[b.severity] ||
      a.date.localeCompare(b.date) ||
      a.employee.localeCompare(b.employee)
    )
  })
}

export function ScheduleComplianceAudit({
  startDate,
  endDate,
  employeeFilter,
  branchFilter,
  sectorFilter,
}: {
  startDate: string
  endDate: string
  employeeFilter: string
  branchFilter: string
  sectorFilter: string
}) {
  const queryFrom = dateOffset(startDate, -7)
  const queryTo = dateOffset(endDate, 7)
  const schedules = useSchedulesRange(queryFrom, queryTo)

  const scopedSchedules = useMemo(
    () =>
      (schedules.data ?? []).filter(
        (schedule) =>
          (!branchFilter || schedule.branch_id === branchFilter) &&
          (!employeeFilter || schedule.employee_id === employeeFilter) &&
          (!sectorFilter || schedule.employees?.sectors?.name === sectorFilter)
      ),
    [branchFilter, employeeFilter, schedules.data, sectorFilter]
  )
  const findings = useMemo(
    () => auditSchedules(scopedSchedules, startDate, endDate),
    [endDate, scopedSchedules, startDate]
  )
  const criticalCount = findings.filter((finding) => finding.severity === "critical").length
  const attentionCount = findings.filter((finding) => finding.severity === "attention").length
  const sundayWork = useMemo(
    () =>
      scopedSchedules.filter(
        (schedule) =>
          schedule.work_date >= startDate &&
          schedule.work_date <= endDate &&
          isScheduledWork(schedule) &&
          new Date(`${schedule.work_date}T12:00:00`).getDay() === 0
      ),
    [endDate, scopedSchedules, startDate]
  )

  function exportAudit() {
    const headers = [
      { key: "date", label: "Data" },
      { key: "employee", label: "Colaborador" },
      { key: "branch", label: "Filial" },
      { key: "sector", label: "Setor" },
      { key: "severity", label: "Classificacao" },
      { key: "rule", label: "Regra" },
      { key: "detail", label: "Detalhe" },
    ]
    const rows = findings.map((finding) => ({
      ...finding,
      date: formatDateBR(finding.date),
      severity: finding.severity === "critical" ? "NOK" : "Atencao",
    }))
    downloadCsv(buildCsv(rows, headers), `auditoria_escalas_${startDate}_${endDate}.csv`)
  }

  return (
    <Card className="border bg-white shadow-sm">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="size-5" />
            Auditoria de escalas
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Horários planejados no período {formatDateBR(startDate)} a {formatDateBR(endDate)}.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportAudit} disabled={findings.length === 0}>
          <Download className="mr-1.5 size-4" />
          Exportar auditoria
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {schedules.isLoading ? (
          <StateBlock type="loading" title="Analisando escalas" />
        ) : schedules.isError ? (
          <StateBlock type="error" title="Falha ao carregar escalas" description={schedules.error.message} />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className={`rounded-lg border p-3 ${criticalCount ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}>
                <div className="text-xs text-muted-foreground">NOK / revisão imediata</div>
                <div className={`mt-1 text-2xl font-bold ${criticalCount ? "text-red-700" : "text-emerald-700"}`}>{criticalCount}</div>
              </div>
              <div className={`rounded-lg border p-3 ${attentionCount ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
                <div className="text-xs text-muted-foreground">Atenção / dados incompletos</div>
                <div className={`mt-1 text-2xl font-bold ${attentionCount ? "text-amber-700" : "text-emerald-700"}`}>{attentionCount}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs text-muted-foreground">Escalas analisadas</div>
                <div className="mt-1 text-2xl font-bold text-slate-800">
                  {scopedSchedules.filter((schedule) => schedule.work_date >= startDate && schedule.work_date <= endDate).length}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-lg border bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <span><span className="mr-1 inline-block size-2.5 rounded-sm bg-emerald-500" />Conforme</span>
              <span><span className="mr-1 inline-block size-2.5 rounded-sm bg-red-500" />NOK / revisão</span>
              <span><span className="mr-1 inline-block size-2.5 rounded-sm bg-amber-500" />Atenção</span>
              <span><span className="mr-1 inline-block size-2.5 rounded-sm bg-sky-200" />Setor Fiscal</span>
              <span><span className="mr-1 inline-block size-2.5 rounded-sm bg-lime-300" />Domingo trabalhado</span>
            </div>

            {sundayWork.length > 0 ? (
              <div className="rounded-lg border border-lime-200 bg-lime-50 p-3">
                <p className="mb-2 text-xs font-semibold text-lime-950">Escalados no domingo</p>
                <div className="flex flex-wrap gap-2">
                  {sundayWork.map((schedule) => (
                    <span
                      key={schedule.id}
                      className={`rounded-md bg-lime-200 px-2 py-1 text-xs text-lime-950 ${schedule.employees?.sectors?.name?.toLocaleLowerCase("pt-BR").includes("fiscal") ? "ring-1 ring-sky-400" : ""}`}
                      title={`${schedule.branches?.name ?? "Filial"}${schedule.employees?.sectors?.name ? ` · ${schedule.employees.sectors.name}` : ""}`}
                    >
                      {formatDateBR(schedule.work_date)} · {schedule.employees?.name ?? "Colaborador"}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs leading-relaxed text-blue-900">
              Verificações: interjornada mínima de 11h, carga planejada de 8h/10h, sequência de dias, folgas pré/pós-domingo do modelo e três domingos consecutivos. O requisito de folga antes/depois do domingo é uma regra interna enviada por você. O repouso semanal previsto em lei e de 24h, mas este painel nao calcula sozinho esse intervalo entre semanas; sinaliza trabalho consecutivo para revisao. Ausência de registro é tratada como dado insuficiente, não como folga.
              {" "}
              <a className="font-medium underline" href="https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452.htm" target="_blank" rel="noreferrer">CLT, arts. 66–67</a>
              {" · "}
              <a className="font-medium underline" href="https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2007/lei/l11603.htm" target="_blank" rel="noreferrer">Lei 11.603/2007</a>
              {" · "}
              <a className="font-medium underline" href="https://www.tst.jus.br/documents/d/guest/irr265-1-pdf" target="_blank" rel="noreferrer">TST, Tema 265</a>
            </div>

            {findings.length === 0 ? (
              <StateBlock
                title="Nenhum alerta encontrado nas verificações calculáveis"
                description="Isso não confirma pagamento, convenção coletiva ou descanso semanal quando faltam registros no período."
              />
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b bg-slate-50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2.5">Data</th>
                      <th className="px-3 py-2.5">Colaborador</th>
                      <th className="px-3 py-2.5">Filial / setor</th>
                      <th className="px-3 py-2.5">Regra</th>
                      <th className="px-3 py-2.5">Resultado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {findings.map((finding, index) => (
                      <tr
                        key={`${finding.employee}-${finding.date}-${finding.rule}-${index}`}
                        className={finding.sector.toLocaleLowerCase("pt-BR").includes("fiscal") ? "bg-sky-50/80" : "bg-white"}
                      >
                        <td className="whitespace-nowrap px-3 py-2.5">{formatDateBR(finding.date)}</td>
                        <td className="px-3 py-2.5 font-medium">{finding.employee}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {finding.branch || "—"}{finding.sector ? ` · ${finding.sector}` : ""}
                        </td>
                        <td className="px-3 py-2.5">{finding.rule}</td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${finding.severity === "critical" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-900"}`}>
                            {finding.severity === "critical" ? "NOK" : "Atenção"}
                          </span>
                          <p className="mt-1 max-w-lg text-xs leading-relaxed text-muted-foreground">{finding.detail}</p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
