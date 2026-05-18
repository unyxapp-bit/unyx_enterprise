/**
 * Tests para operationalCalculations
 */

import { describe, it, expect } from "vitest"
import {
  timeToMinutes,
  minutesToTime,
  formatDuration,
  calculateBreakProgress,
  isLateForBreak,
} from "../operationalCalculations"

describe("operationalCalculations", () => {
  describe("timeToMinutes", () => {
    it("converts time string to minutes", () => {
      expect(timeToMinutes("14:30")).toBe(870)
      expect(timeToMinutes("00:00")).toBe(0)
      expect(timeToMinutes("23:59")).toBe(1439)
      expect(timeToMinutes("09:15")).toBe(555)
    })

    it("returns null for invalid input", () => {
      expect(timeToMinutes(null)).toBeNull()
      expect(timeToMinutes(undefined)).toBeNull()
      expect(timeToMinutes("")).toBeNull()
    })
  })

  describe("minutesToTime", () => {
    it("converts minutes to time string", () => {
      expect(minutesToTime(0)).toBe("00:00")
      expect(minutesToTime(870)).toBe("14:30")
      expect(minutesToTime(1439)).toBe("23:59")
      expect(minutesToTime(555)).toBe("09:15")
    })

    it("handles hours overflow", () => {
      expect(minutesToTime(1440)).toBe("00:00") // 24h + 0 min
      expect(minutesToTime(1500)).toBe("01:00") // 25h + 0 min
    })
  })

  describe("formatDuration", () => {
    it("formats minutes as duration string", () => {
      expect(formatDuration(30)).toBe("30min")
      expect(formatDuration(60)).toBe("1h")
      expect(formatDuration(90)).toBe("1h 30min")
      expect(formatDuration(120)).toBe("2h")
      expect(formatDuration(150)).toBe("2h 30min")
    })
  })

  describe("calculateBreakProgress", () => {
    it("calculates break progress correctly", () => {
      // 12:00 to 13:00, now 12:30
      const result = calculateBreakProgress(720, 780, 750)
      expect(result.duration).toBe(60)
      expect(result.elapsed).toBe(30)
      expect(result.percentage).toBe(50)
      expect(result.isOverdue).toBe(false)
    })

    it("detects overdue breaks", () => {
      // 12:00 to 13:00, now 13:30
      const result = calculateBreakProgress(720, 780, 810)
      expect(result.isOverdue).toBe(true)
      expect(result.percentage).toBe(100)
    })

    it("handles null values", () => {
      const result = calculateBreakProgress(null, null, 500)
      expect(result.elapsed).toBe(0)
      expect(result.duration).toBe(0)
    })
  })

  describe("isLateForBreak", () => {
    it("detects late breaks", () => {
      // Break should start at 12:00, now it's 12:05
      expect(isLateForBreak(720, 725)).toBe(true)
      // 2 minutes is still considered on-time
      expect(isLateForBreak(720, 722)).toBe(false)
    })

    it("returns false when no scheduled break", () => {
      expect(isLateForBreak(null, 500)).toBe(false)
    })
  })
})
