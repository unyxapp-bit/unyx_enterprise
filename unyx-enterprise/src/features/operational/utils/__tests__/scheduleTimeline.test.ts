import { describe, expect, it } from "vitest"

import {
  addDaysToDateKey,
  dayOffsetOf,
  isOvernightStillRunning,
  isShiftRunning,
  minutesSinceWorkDate,
  shiftTimeline,
  shortDateLabel,
} from "@/features/operational/utils/scheduleTimeline"

const night = { start_time: "18:00", break_start: "22:00", break_end: "22:30", end_time: "02:00" }
const nightBreakAfterMidnight = { start_time: "18:00", break_start: "00:30", break_end: "01:00", end_time: "03:00" }
const day = { start_time: "08:00", break_start: "12:00", break_end: "13:00", end_time: "17:00" }

describe("shiftTimeline", () => {
  it("mantém turno diurno no mesmo dia", () => {
    expect(shiftTimeline(day)).toEqual({ start: 480, breakStart: 720, breakEnd: 780, end: 1020 })
  })

  it("saída depois da meia-noite vai para o dia seguinte", () => {
    const timeline = shiftTimeline(night)
    expect(timeline.breakStart).toBe(1320)
    expect(timeline.end).toBe(1440 + 120)
    expect(dayOffsetOf(timeline.end)).toBe(1)
    expect(dayOffsetOf(timeline.breakStart)).toBe(0)
  })

  it("intervalo e retorno depois da meia-noite também mudam de dia", () => {
    const timeline = shiftTimeline(nightBreakAfterMidnight)
    expect(timeline.breakStart).toBe(1440 + 30)
    expect(timeline.breakEnd).toBe(1440 + 60)
    expect(timeline.end).toBe(1440 + 180)
  })

  it("entrada igual à saída, sem intervalo, é um turno de 24h", () => {
    expect(shiftTimeline({ start_time: "08:00", end_time: "08:00" }).end).toBe(480 + 1440)
  })

  it("ignora horários vazios", () => {
    expect(shiftTimeline({ start_time: "18:00", end_time: "02:00" })).toEqual({
      start: 1080,
      breakStart: null,
      breakEnd: null,
      end: 1560,
    })
  })
})

describe("datas", () => {
  it("soma dias e formata", () => {
    expect(addDaysToDateKey("2026-11-30", 1)).toBe("2026-12-01")
    expect(shortDateLabel("2026-11-03", 1)).toBe("04/11")
  })

  it("minutos desde o dia da escala passam de 1440 depois da meia-noite", () => {
    expect(minutesSinceWorkDate("2026-11-03", new Date(2026, 10, 4, 1, 0))).toBe(1440 + 60)
  })
})

describe("isShiftRunning / isOvernightStillRunning", () => {
  it("turno da noite está ativo às 22:00 e antes das 02:00 do dia seguinte", () => {
    expect(isShiftRunning(night, "2026-11-03", new Date(2026, 10, 3, 22, 0))).toBe(true)
    expect(isShiftRunning(night, "2026-11-03", new Date(2026, 10, 4, 1, 30))).toBe(true)
    expect(isShiftRunning(night, "2026-11-03", new Date(2026, 10, 4, 2, 1))).toBe(false)
  })

  it("não está ativo antes da entrada", () => {
    expect(isShiftRunning(night, "2026-11-03", new Date(2026, 10, 3, 17, 59))).toBe(false)
  })

  it("só o turno que atravessou a meia-noite conta como 'da noite anterior'", () => {
    const afterMidnight = new Date(2026, 10, 4, 1, 0)
    expect(isOvernightStillRunning(night, "2026-11-03", afterMidnight)).toBe(true)
    expect(isOvernightStillRunning(day, "2026-11-03", afterMidnight)).toBe(false)
    expect(isOvernightStillRunning(night, "2026-11-03", new Date(2026, 10, 4, 3, 0))).toBe(false)
  })
})
