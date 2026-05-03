import type { UserRole } from "@/types/domain"

export type PermissionKey =
  | "dashboard"
  | "operations"
  | "alerts"
  | "schedules"
  | "branches"
  | "employees"
  | "users"
  | "settings"
  | "allocation"
  | "pos_sell"
  | "pos_cash"
  | "pos_products"
  | "pos_sales"
  | "reports"
  | "audit"
  | "comms"
  | "game"
  | "academy"
  | "ai"

export const PERMISSION_LABEL: Record<PermissionKey, string> = {
  dashboard:    "Dashboard",
  operations:   "Operação",
  alerts:       "Alertas",
  schedules:    "Escalas",
  branches:     "Filiais",
  employees:    "Colaboradores",
  users:        "Usuários",
  settings:     "Configurações",
  allocation:   "Alocação",
  pos_sell:     "PDV — Venda",
  pos_cash:     "Caixa",
  pos_products: "Produtos",
  pos_sales:    "Histórico POS",
  reports:      "Relatórios",
  audit:        "Auditoria",
  comms:        "Comms",
  game:         "Game",
  academy:      "Academy",
  ai:           "AI",
}

export const PERMISSION_GROUP: Record<string, PermissionKey[]> = {
  "Unyx Ops":        ["dashboard", "operations", "alerts", "schedules"],
  "Unyx Control":    ["branches", "employees", "users", "settings"],
  "Unyx Allocation": ["allocation"],
  "Unyx POS":        ["pos_sell", "pos_cash", "pos_products", "pos_sales"],
  "Unyx Insight":    ["reports", "audit"],
  "Expansão":        ["comms", "game", "academy", "ai"],
}

export const PERMISSIONS: Record<PermissionKey, UserRole[]> = {
  dashboard:    ["owner", "admin", "branch_manager", "supervisor", "operator", "employee"],
  operations:   ["owner", "admin", "branch_manager", "supervisor", "operator"],
  alerts:       ["owner", "admin", "branch_manager", "supervisor"],
  schedules:    ["owner", "admin", "branch_manager", "supervisor"],
  branches:     ["owner", "admin", "branch_manager"],
  employees:    ["owner", "admin", "branch_manager", "supervisor"],
  users:        ["owner", "admin"],
  settings:     ["owner"],
  allocation:   ["owner", "admin", "branch_manager", "supervisor"],
  pos_sell:     ["owner", "admin", "branch_manager", "supervisor", "operator", "employee"],
  pos_cash:     ["owner", "admin", "branch_manager", "supervisor", "operator"],
  pos_products: ["owner", "admin", "branch_manager"],
  pos_sales:    ["owner", "admin", "branch_manager", "supervisor"],
  reports:      ["owner", "admin", "branch_manager"],
  audit:        ["owner", "admin"],
  comms:        ["owner", "admin", "branch_manager"],
  game:         ["owner", "admin", "branch_manager", "supervisor", "operator", "employee"],
  academy:      ["owner", "admin", "branch_manager", "supervisor", "operator", "employee"],
  ai:           ["owner", "admin", "branch_manager"],
}

export function canAccess(role: UserRole, key: PermissionKey): boolean {
  return PERMISSIONS[key].includes(role)
}
