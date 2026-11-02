import { describe, expect, it } from "vitest"

import { minutesWorkedUntil, scheduleEndDate } from "@/features/operational/utils"
import type { AttendanceEvent, OperationalBreak } from "@/types/domain"

import {
  dayClosure,
  defaultCorrectionForm,
  deriveReconciliationRow,
  summarizeReconciliation,
} from "../scaleReconciliation"

const local = (hour: number, minute: number, day = 2) =>
  new Date(2026, 10, day, hour, minute).toISOString()

const schedule = {
  id: "s1",
  work_date: "2026-11-02",
  start_time: "07:40:00",
  break_start: "11:00:00",
  break_end: "12:00:00",
  end_time: "17:00:00",
  status: "finished" as const,
}

const event = (
  type: AttendanceEvent["event_type"],
  iso: string,
  source?: AttendanceEvent["source"]
) => ({ id: type, schedule_id: "s1", event_type: type, event_time: iso, source }) as AttendanceEvent

describe("deriveReconciliationRow", () => {
  it("mostra o horário e a origem de cada registro", () => {
    const row = deriveReconciliationRow(
      schedule,
      [
        event("entrada_confirmada", local(7, 40), "escala"),
        event("saida_confirmada", local(17, 0), "retroativo"),
      ],
      [
        {
          id: "b1",
          schedule_id: "s1",
          break_type: "intervalo",
          status: "retornou",
          actual_start: local(11, 0),
          actual_end: local(12, 5),
          source: "manual",
        } as OperationalBreak,
      ]
    )
    expect(row.arrival).toEqual({ time: "07:40", origin: "escala" })
    expect(row.breakStart).toEqual({ time: "11:00", origin: "manual" })
    expect(row.breakEnd).toEqual({ time: "12:05", origin: "manual" })
    expect(row.exit).toEqual({ time: "17:00", origin: "retroativo" })
    expect(row.delayMinutes).toBe(0)
  })

  it("calcula o atraso pela escala e trata registro sem origem como feito na hora", () => {
    const row = deriveReconciliationRow(
      schedule,
      [event("entrada_confirmada", local(8, 10))],
      []
    )
    expect(row.arrival.origin).toBe("manual")
    expect(row.delayMinutes).toBe(30)
    expect(row.exit.origin).toBe("pendente")
    expect(row.breakStart).toEqual({ time: null, origin: "pendente" })
  })

  it("não conta intervalo cancelado e usa os eventos quando não há linha de intervalo", () => {
    const row = deriveReconciliationRow(
      schedule,
      [
        event("intervalo_iniciado", local(11, 5), "escala"),
        event("retorno_confirmado", local(12, 5), "escala"),
      ],
      [
        {
          id: "b2",
          schedule_id: "s1",
          break_type: "intervalo",
          status: "cancelado",
          actual_start: local(9, 0),
          actual_end: local(9, 10),
        } as OperationalBreak,
      ]
    )
    expect(row.breakStart.time).toBe("11:05")
    expect(row.breakEnd.time).toBe("12:05")
  })
})

describe("defaultCorrectionForm", () => {
  it("usa o que consta no sistema e, sem registro, o horário da escala", () => {
    const row = deriveReconciliationRow(
      schedule,
      [event("entrada_confirmada", local(8, 10), "manual")],
      []
    )
    expect(defaultCorrectionForm(schedule, row)).toEqual({
      outcome: "compareceu",
      arrival: "08:10",
      breakStart: "11:00",
      breakEnd: "12:00",
      exit: "17:00",
    })
  })

  it("abre como falta quando a escala está como ausente", () => {
    const row = deriveReconciliationRow({ ...schedule, status: "absent" }, [], [])
    expect(defaultCorrectionForm(schedule, row).outcome).toBe("faltou")
  })
})

describe("dayClosure", () => {
  const schedules = [
    { work_date: "2026-11-02", start_time: "07:40:00", end_time: "17:00:00", status: "working" as const },
    { work_date: "2026-11-02", start_time: "13:00:00", end_time: "21:20:00", status: "scheduled" as const },
    { work_date: "2026-11-02", start_time: "09:00:00", end_time: "23:59:00", status: "absent" as const },
  ]

  it("fecha no fim da última saída prevista, ignorando falta", () => {
    const open = dayClosure(schedules, new Date(2026, 10, 2, 20, 0))
    expect(open.closed).toBe(false)
    expect(open.closesAt).toEqual(new Date(2026, 10, 2, 21, 20))
    expect(dayClosure(schedules, new Date(2026, 10, 2, 21, 20)).closed).toBe(true)
  })

  it("considera fechado quando ninguém está escalado para trabalhar", () => {
    expect(dayClosure([], new Date()).closed).toBe(true)
  })

  it("turno que passa da meia-noite termina no dia seguinte", () => {
    const night = [
      { work_date: "2026-11-02", start_time: "22:00:00", end_time: "06:00:00", status: "scheduled" as const },
    ]
    expect(dayClosure(night, new Date(2026, 10, 3, 1, 0)).closed).toBe(false)
    expect(dayClosure(night, new Date(2026, 10, 3, 6, 0)).closed).toBe(true)
  })
})

describe("minutesWorkedUntil", () => {
  const window = { work_date: "2026-11-02", start_time: "07:40:00", end_time: "17:00:00" }

  it("conta até agora enquanto a escala não terminou", () => {
    const now = new Date(2026, 10, 2, 10, 0).getTime()
    expect(minutesWorkedUntil(local(7, 40), window, now)).toBe(140)
  })

  it("para no horário de saída da escala", () => {
    const now = new Date(2026, 10, 2, 20, 0).getTime()
    expect(minutesWorkedUntil(local(7, 40), window, now)).toBe(9 * 60 + 20)
    expect(scheduleEndDate(window)).toEqual(new Date(2026, 10, 2, 17, 0))
  })

  it("sem escala, conta até agora", () => {
    const now = new Date(2026, 10, 2, 10, 0).getTime()
    expect(minutesWorkedUntil(local(9, 0), null, now)).toBe(60)
  })
})

describe("summarizeReconciliation", () => {
  it("resume só o que foi confirmado", () => {
    expect(summarizeReconciliation({ arrivals: 1, breaks: 0, returns: 0, exits: 3 })).toBe(
      "1 entrada, 3 saídas"
    )
    expect(summarizeReconciliation({ arrivals: 0, breaks: 0, returns: 0, exits: 0 })).toBe("")
  })
})
