import { describe, expect, it } from "vitest"

import {
  isStaffProfile,
  isValidStaffCode,
  normalizeStaffCode,
  STAFF_CASHIER_PRESET,
  STAFF_PERMISSION_KEYS,
  staffEmail,
  staffLoginErrorMessage,
} from "../staffAccess"

describe("staffAccess", () => {
  it("deixa o código só com letras minúsculas e números", () => {
    expect(normalizeStaffCode("Lorena 01!")).toBe("lorena01")
    expect(normalizeStaffCode("José-Álvaro")).toBe("josealvaro")
    expect(normalizeStaffCode("a".repeat(40))).toHaveLength(20)
  })

  it("valida o tamanho do código de acesso", () => {
    expect(isValidStaffCode("lorena01")).toBe(true)
    expect(isValidStaffCode("a")).toBe(false)
    expect(isValidStaffCode("")).toBe(false)
    expect(isValidStaffCode("com espaco")).toBe(false)
    expect(isValidStaffCode("MAIUSCULA")).toBe(false)
  })

  it("monta o e-mail interno igual ao que a função do servidor cria", () => {
    expect(staffEmail("Mercado ABC", "Lorena01")).toBe("lorena01@mercadoabc.unyx.app")
  })

  it("não deixa liberar telas de administração a um fiscal", () => {
    for (const blocked of ["users", "settings", "audit", "branches"] as const) {
      expect(STAFF_PERMISSION_KEYS).not.toContain(blocked)
    }
    expect(STAFF_PERMISSION_KEYS).toContain("pos_cash")
    // A sugestão de caixa só usa telas que podem ser liberadas.
    for (const key of STAFF_CASHIER_PRESET) expect(STAFF_PERMISSION_KEYS).toContain(key)
  })

  it("reconhece o perfil de fiscal pelo código de acesso", () => {
    expect(isStaffProfile({ login_code: "lorena01" })).toBe(true)
    expect(isStaffProfile({ login_code: null })).toBe(false)
    expect(isStaffProfile({})).toBe(false)
  })

  it("traduz as falhas de login sem mostrar o texto do Supabase", () => {
    expect(staffLoginErrorMessage(new Error("Invalid login credentials"))).toBe("Loja, código ou senha incorretos.")
    expect(staffLoginErrorMessage(new Error("User is banned"))).toBe("Este acesso está bloqueado. Fale com o gerente.")
    expect(staffLoginErrorMessage(new Error("email rate limit exceeded"))).toContain("Muitas tentativas")
    expect(staffLoginErrorMessage(null)).toBe("Não foi possível entrar.")
  })
})
