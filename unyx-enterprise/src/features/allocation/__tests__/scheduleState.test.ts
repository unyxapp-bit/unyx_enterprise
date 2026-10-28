import { describe, expect, it } from "vitest"

import { coverageInfo, deriveScheduleState, scheduleUrgency } from "../scheduleState"

const base = {
  scheduleStatus: "scheduled",
  startTime: "07:40:00",
  currentStatus: null,
  hasAllocation: false,
  hasActiveBreak: false,
  nowMinutes: 8 * 60,
  lateToleranceMinutes: 5,
}

describe("deriveScheduleState", () => {
  it("aguardando chegada depois do horário, atrasado além da tolerância", () => {
    const state = deriveScheduleState(base)
    expect(state.awaitingArrival).toBe(true)
    expect(state.startArrived).toBe(true)
    expect(state.arrivalLateMinutes).toBe(20)
    expect(state.arrivalIsLate).toBe(true)
    expect(state.canMarkAbsent).toBe(true)
  })

  it("antes do horário de entrada ainda aguarda, mas não pode ser falta", () => {
    const state = deriveScheduleState({ ...base, nowMinutes: 7 * 60 })
    expect(state.awaitingArrival).toBe(true)
    expect(state.startArrived).toBe(false)
    expect(state.canMarkAbsent).toBe(false)
  })

  it("trabalhando sem posto: entrou, mas não está alocado nem em intervalo", () => {
    const state = deriveScheduleState({ ...base, currentStatus: "trabalhando", scheduleStatus: "working" })
    expect(state.hasEntry).toBe(true)
    expect(state.workingWithoutPost).toBe(true)
    expect(state.awaitingArrival).toBe(false)
  })

  it("alocado em posto conta como entrada e não é 'sem posto'", () => {
    const state = deriveScheduleState({ ...base, hasAllocation: true })
    expect(state.hasEntry).toBe(true)
    expect(state.awaitingArrival).toBe(false)
    expect(state.workingWithoutPost).toBe(false)
  })

  it("falta, folga e saída registrada ficam indisponíveis", () => {
    expect(deriveScheduleState({ ...base, scheduleStatus: "absent" }).unavailable).toBe(true)
    expect(deriveScheduleState({ ...base, currentStatus: "folga" }).unavailable).toBe(true)
    expect(deriveScheduleState({ ...base, currentStatus: "finalizado" }).awaitingArrival).toBe(false)
  })
})

describe("scheduleUrgency", () => {
  const none = { returnPending: false, releasePending: false, exitPending: false, critical: false }

  it("chegada atrasada é a mais urgente, depois retorno, sem posto e liberar intervalo", () => {
    const late = deriveScheduleState(base)
    const noPost = deriveScheduleState({ ...base, currentStatus: "trabalhando" })
    const placed = deriveScheduleState({ ...base, hasAllocation: true })

    expect(scheduleUrgency(late, none)).toBe(0)
    expect(scheduleUrgency(placed, { ...none, returnPending: true })).toBe(2)
    expect(scheduleUrgency(noPost, none)).toBe(3)
    expect(scheduleUrgency(placed, { ...none, releasePending: true })).toBe(4)
    expect(scheduleUrgency(placed, none)).toBe(7)
  })
})

describe("coverageInfo", () => {
  it("só libera saída se sobrar a cobertura mínima", () => {
    expect(coverageInfo(6, 1, 4)).toEqual({ active: 5, minimum: 4, canLeave: true })
    expect(coverageInfo(5, 1, 4)).toEqual({ active: 4, minimum: 4, canLeave: false })
    expect(coverageInfo(0, 0, 0).canLeave).toBe(false)
  })
})
