import type { UserRole } from "@/types/domain"

export type PermissionKey =
  | "dashboard"
  | "operations"
  | "alerts"
  | "schedules"
  | "checklists"
  | "branches"
  | "employees"
  | "users"
  | "settings"
  | "pos_sell"
  | "pos_cash"
  | "pos_products"
  | "pos_sales"
  | "deliveries"
  | "reports"
  | "audit"
  | "comms"
  | "game"
  | "academy"
  | "ai"

export const PERMISSION_LABEL: Record<PermissionKey, string> = {
  dashboard: "Dashboard",
  operations: "Operacao",
  alerts: "Alertas",
  schedules: "Escalas",
  checklists: "Checklists e Procedimentos",
  branches: "Filiais",
  employees: "Colaboradores",
  users: "Usuarios",
  settings: "Configuracoes",
  pos_sell: "PDV - Venda",
  pos_cash: "Caixa",
  pos_products: "Produtos",
  pos_sales: "Historico POS",
  deliveries: "Entregas",
  reports: "Relatorios",
  audit: "Auditoria",
  comms: "Comms",
  game: "Game",
  academy: "Academy",
  ai: "AI",
}

export const PERMISSION_GROUP: Record<string, PermissionKey[]> = {
  "Unyx Ops": ["dashboard", "operations", "alerts", "schedules", "checklists"],
  "Unyx Control": ["branches", "employees", "users", "settings"],
  "Unyx POS": ["pos_sell", "pos_cash", "pos_products", "pos_sales", "deliveries"],
  "Unyx Insight": ["reports", "audit"],
  Expansao: ["comms", "game", "academy", "ai"],
}

export const PERMISSIONS: Record<PermissionKey, UserRole[]> = {
  dashboard: ["owner", "admin", "branch_manager", "supervisor", "operator", "employee"],
  operations: ["owner", "admin", "branch_manager", "supervisor", "operator"],
  alerts: ["owner", "admin", "branch_manager", "supervisor"],
  schedules: ["owner", "admin", "branch_manager", "supervisor"],
  checklists: ["owner", "admin", "branch_manager", "supervisor", "operator", "employee"],
  branches: ["owner", "admin", "branch_manager"],
  employees: ["owner", "admin", "branch_manager", "supervisor"],
  users: ["owner", "admin"],
  settings: ["owner"],
  pos_sell: ["owner", "admin", "branch_manager", "supervisor", "operator", "employee"],
  pos_cash: ["owner", "admin", "branch_manager", "supervisor", "operator"],
  pos_products: ["owner", "admin", "branch_manager"],
  pos_sales: ["owner", "admin", "branch_manager", "supervisor"],
  deliveries: ["owner", "admin", "branch_manager", "supervisor", "operator", "employee"],
  reports: ["owner", "admin", "branch_manager"],
  audit: ["owner", "admin"],
  comms: ["owner", "admin", "branch_manager"],
  game: ["owner", "admin", "branch_manager", "supervisor", "operator", "employee"],
  academy: ["owner", "admin", "branch_manager", "supervisor", "operator", "employee"],
  ai: ["owner", "admin", "branch_manager"],
}

export function canAccess(role: UserRole, key: PermissionKey): boolean {
  return PERMISSIONS[key].includes(role)
}

export function getPermissionsForRole(role: UserRole): PermissionKey[] {
  return (Object.keys(PERMISSIONS) as PermissionKey[]).filter((key) =>
    PERMISSIONS[key].includes(role)
  )
}

export function canAccessUser(
  profile: { role: UserRole; custom_permissions: string[] | null },
  key: PermissionKey
): boolean {
  if (profile.custom_permissions && profile.custom_permissions.length > 0) {
    return profile.custom_permissions.includes(key)
  }
  return canAccess(profile.role, key)
}
