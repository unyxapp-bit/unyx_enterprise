import { describe, expect, it } from "vitest"
import {
  countSchedulesForDate,
  findLatestScheduleSourceDate,
  getScheduleLookbackRange,
} from "../scheduleCopySuggestions"

describe("scheduleCopySuggestions", () => {
  it("builds the lookback range ending one day before the target date", () => {
    expect(getScheduleLookbackRange("2026-05-18", 30)).toEqual({
      dateFrom: "2026-04-18",
      dateTo: "2026-05-17",
    })
  })

  it("finds the latest available source date before the target date", () => {
    const schedules = [
      { work_date: "2026-05-11" },
      { work_date: "2026-05-17" },
      { work_date: "2026-05-15" },
      { work_date: "2026-05-18" },
    ]

    expect(findLatestScheduleSourceDate(schedules, "2026-05-18")).toBe("2026-05-17")
  })

  it("counts schedules for the selected source date", () => {
    const schedules = [
      { work_date: "2026-05-17" },
      { work_date: "2026-05-17" },
      { work_date: "2026-05-16" },
    ]

    expect(countSchedulesForDate(schedules, "2026-05-17")).toBe(2)
    expect(countSchedulesForDate(schedules, null)).toBe(0)
  })
})
