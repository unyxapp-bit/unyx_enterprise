import type { PermissionKey } from "@/lib/permissions"

// Acesso de fiscais por código e senha. Cada fiscal é um usuário do Supabase Auth com um e-mail
// interno montado a partir do código da loja e do código dele (ninguém digita esse e-mail).

export const STAFF_EMAIL_DOMAIN = "unyx.app"
export const STAFF_CODE_MAX = 20
export const STAFF_PASSWORD_MIN = 6

/** Só letras minúsculas e números: o mesmo formato vale para o código da loja e o do fiscal. */
export function normalizeStaffCode(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, STAFF_CODE_MAX)
}

export function isValidStaffCode(code: string) {
  return /^[a-z0-9]{2,20}$/.test(code)
}

/** O e-mail interno do fiscal: codigo@loja.unyx.app */
export function staffEmail(store: string, code: string) {
  return `${normalizeStaffCode(code)}@${normalizeStaffCode(store)}.${STAFF_EMAIL_DOMAIN}`
}

/** Telas que podem ser liberadas a um fiscal (a mesma lista da função do servidor). */
export const STAFF_PERMISSION_KEYS: PermissionKey[] = [
  "dashboard",
  "operations",
  "alerts",
  "schedules",
  "checklists",
  "front_notes",
  "front_forms",
  "employees",
  "customers",
  "pos_sell",
  "pos_cash",
  "pos_products",
  "pos_posters",
  "pos_sales",
  "production_orders",
  "fiscal_documents",
  "deliveries",
  "reports",
  "comms",
  "game",
  "academy",
  "ai",
]

/** Sugestão pronta para um fiscal de caixa; o gerente ajusta como quiser. */
export const STAFF_CASHIER_PRESET: PermissionKey[] = [
  "dashboard",
  "operations",
  "front_notes",
  "front_forms",
  "pos_cash",
  "pos_posters",
]

export interface StaffLike {
  login_code?: string | null
}

export const isStaffProfile = (profile: StaffLike) => Boolean(profile.login_code)

/** Tradução das falhas de login para o fiscal, sem expor detalhes do Supabase. */
export function staffLoginErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : ""
  if (/banned/i.test(message)) return "Este acesso está bloqueado. Fale com o gerente."
  if (/invalid login credentials/i.test(message)) return "Loja, código ou senha incorretos."
  if (/rate limit|too many/i.test(message)) return "Muitas tentativas. Aguarde um pouco e tente de novo."
  return message || "Não foi possível entrar."
}
