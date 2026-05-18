import { describe, expect, it } from "vitest"
import { getOperationalModeDefaults } from "../operationalModes"

describe("operationalModeDefaults", () => {
  it("keeps cashier sangria optional by default for supermarkets", () => {
    expect(getOperationalModeDefaults("supermarket").require_cashier_cash_count).toBe(false)
  })

  it("keeps break coverage enabled by default for supermarkets", () => {
    expect(getOperationalModeDefaults("supermarket").require_coverage_before_break).toBe(true)
  })
})
