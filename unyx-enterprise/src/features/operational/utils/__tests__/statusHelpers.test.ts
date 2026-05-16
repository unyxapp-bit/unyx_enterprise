/**
 * Tests para statusHelpers
 */

import { describe, it, expect } from "vitest"
import {
  getInitials,
  canStartEntry,
  canStartBreak,
  canReturnFromBreak,
  canStartCafe,
  canStartExit,
  isCafeBreak,
  isDone,
  ENTERED_STATUSES,
} from "../statusHelpers"

describe("statusHelpers", () => {
  describe("getInitials", () => {
    it("returns initials from full name", () => {
      expect(getInitials("João Silva")).toBe("JS")
      expect(getInitials("Maria Santos")).toBe("MS")
    })

    it("handles single names", () => {
      expect(getInitials("João")).toBe("J")
    })

    it("handles edge cases", () => {
      expect(getInitials("")).toBe("?")
      expect(getInitials("  ")).toBe("?")
    })
  })

  describe("canStartEntry", () => {
    it("allows entry for waiting status", () => {
      expect(canStartEntry("aguardando_evento")).toBe(true)
      expect(canStartEntry(null)).toBe(true)
      expect(canStartEntry(undefined)).toBe(true)
    })

    it("disallows entry for other statuses", () => {
      expect(canStartEntry("trabalhando")).toBe(false)
      expect(canStartEntry("em_intervalo")).toBe(false)
    })
  })

  describe("canStartBreak", () => {
    it("allows break from working status", () => {
      expect(canStartBreak("trabalhando")).toBe(true)
      expect(canStartBreak("voltou")).toBe(true)
      expect(canStartBreak("deve_sair")).toBe(true)
    })

    it("disallows break from other statuses", () => {
      expect(canStartBreak("em_intervalo")).toBe(false)
      expect(canStartBreak("aguardando_evento")).toBe(false)
    })
  })

  describe("canReturnFromBreak", () => {
    it("allows return only from break", () => {
      expect(canReturnFromBreak("em_intervalo")).toBe(true)
    })

    it("disallows return from other statuses", () => {
      expect(canReturnFromBreak("trabalhando")).toBe(false)
      expect(canReturnFromBreak(null)).toBe(false)
    })
  })

  describe("canStartCafe", () => {
    it("allows café from working status", () => {
      expect(canStartCafe("trabalhando")).toBe(true)
      expect(canStartCafe("voltou")).toBe(true)
    })

    it("disallows café from break status", () => {
      expect(canStartCafe("em_intervalo")).toBe(false)
    })
  })

  describe("canStartExit", () => {
    it("allows exit from entered statuses", () => {
      expect(canStartExit("trabalhando")).toBe(true)
      expect(canStartExit("voltou")).toBe(true)
    })

    it("disallows exit from break", () => {
      expect(canStartExit("em_intervalo")).toBe(false)
    })

    it("disallows exit while cashier flow is pending", () => {
      expect(canStartExit("aguardando_sangria")).toBe(false)
      expect(canStartExit("troca_de_caixa")).toBe(false)
    })

    it("disallows exit from waiting", () => {
      expect(canStartExit(null)).toBe(false)
      expect(canStartExit("aguardando_evento")).toBe(false)
    })
  })

  describe("isCafeBreak", () => {
    it("detects café marker in notes", () => {
      expect(isCafeBreak("cafe_active")).toBe(true)
      expect(isCafeBreak("lunch_done,cafe_active")).toBe(true)
    })

    it("returns false without café marker", () => {
      expect(isCafeBreak("lunch_done")).toBe(false)
      expect(isCafeBreak(null)).toBe(false)
    })
  })

  describe("isDone", () => {
    it("detects done statuses", () => {
      expect(isDone("finalizado")).toBe(true)
      expect(isDone("folga")).toBe(true)
    })

    it("returns false for active statuses", () => {
      expect(isDone("trabalhando")).toBe(false)
      expect(isDone(null)).toBe(false)
    })
  })

  describe("ENTERED_STATUSES", () => {
    it("contains all entered statuses", () => {
      expect(ENTERED_STATUSES.has("trabalhando")).toBe(true)
      expect(ENTERED_STATUSES.has("voltou")).toBe(true)
      expect(ENTERED_STATUSES.has("em_intervalo")).toBe(true)
      expect(ENTERED_STATUSES.has("finalizado")).toBe(false)
    })
  })
})
