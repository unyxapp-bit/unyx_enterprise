import { describe, expect, it } from "vitest"
import type { OperationalStatusRecord, ScheduleWithRelations } from "@/types/domain"

import {
  buildOperationalFlowSignals,
  getOperationalFlowPriority,
  operationalStageForStatus,
} from "../flowPolicy"

const baseSchedule = {
  id: "schedule-1",
  branch_id: "branch-1",
  employee_id: "employee-1",
  work_date: "2026-05-19",
  start_time: "08:00",
  break_start: "12:00",
  break_end: "13:00",
  end_time: "17:00",
  status: "working",
  notes: null,
  employees: {
    name: "Renata",
    role: "Caixa",
    sectors: { name: "Caixa" },
  },
} as unknown as ScheduleWithRelations

function statusRecord(currentStatus: OperationalStatusRecord["current_status"]) {
  return {
    current_status: currentStatus,
    delay_minutes: 0,
  } as unknown as OperationalStatusRecord
}

describe("flowPolicy", () => {
  it("maps current statuses into operational flow stages", () => {
    expect(operationalStageForStatus("aguardando_sangria")).toBe("cash_control")
    expect(operationalStageForStatus("troca_de_caixa")).toBe("coverage_change")
    expect(operationalStageForStatus("em_intervalo")).toBe("break")
    expect(operationalStageForStatus("pico")).toBe("working")
    expect(operationalStageForStatus("apoio_operacional")).toBe("working")
    expect(operationalStageForStatus("fechamento")).toBe("closing")
  })

  it("creates fiscal flow signals for peak, support and closing statuses", () => {
    const peakSignals = buildOperationalFlowSignals({
      schedule: baseSchedule,
      status: statusRecord("pico"),
      currentMinutes: 12 * 60,
      breakToleranceMinutes: 15,
    })
    const supportSignals = buildOperationalFlowSignals({
      schedule: baseSchedule,
      status: statusRecord("apoio_operacional"),
      currentMinutes: 12 * 60,
      breakToleranceMinutes: 15,
    })
    const closingSignals = buildOperationalFlowSignals({
      schedule: baseSchedule,
      status: statusRecord("fechamento"),
      currentMinutes: 12 * 60,
      breakToleranceMinutes: 15,
    })

    expect(peakSignals.some((signal) => signal.key === "peak-operation")).toBe(true)
    expect(supportSignals.some((signal) => signal.key === "support-operation")).toBe(true)
    expect(closingSignals.some((signal) => signal.key === "closing-operation")).toBe(true)
  })

  it("raises priority when break release is past tolerance", () => {
    const priority = getOperationalFlowPriority({
      schedule: baseSchedule,
      status: statusRecord("trabalhando"),
      currentMinutes: 12 * 60 + 20,
      breakToleranceMinutes: 15,
    })

    expect(priority).toBeGreaterThan(60)
  })

  it("creates an overdue return signal only after tolerance", () => {
    const signalsInsideTolerance = buildOperationalFlowSignals({
      schedule: baseSchedule,
      status: statusRecord("em_intervalo"),
      currentMinutes: 13 * 60 + 10,
      breakToleranceMinutes: 15,
    })
    const signalsPastTolerance = buildOperationalFlowSignals({
      schedule: baseSchedule,
      status: statusRecord("em_intervalo"),
      currentMinutes: 13 * 60 + 16,
      breakToleranceMinutes: 15,
    })

    expect(signalsInsideTolerance.some((signal) => signal.key === "break-return-overdue"))
      .toBe(false)
    expect(signalsPastTolerance.some((signal) => signal.key === "break-return-overdue"))
      .toBe(true)
  })
})
