import { navGroups } from "@/app/layout/navConfig"

const STORAGE_PREFIX = "unyx-recent-modules-v1"
const MAX_STORED = 8

const moduleItems = navGroups
  .flatMap((group) => group.items)
  .filter((item) => item.to !== "/app")
  // Rotas mais específicas primeiro, para "/app/pos/sell" não cair em "/app/pos".
  .sort((a, b) => b.to.length - a.to.length)

export function findModule(pathname: string) {
  return moduleItems.find((item) => pathname === item.to || pathname.startsWith(`${item.to}/`)) ?? null
}

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}:${userId}`
}

export function readRecentModules(userId: string): string[] {
  try {
    const raw = window.localStorage.getItem(storageKey(userId))
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : []
  } catch {
    return []
  }
}

// Guarda os módulos visitados (mais recente primeiro) para o "Continue de onde parou" do Início.
export function recordRecentModule(userId: string, pathname: string) {
  const module = findModule(pathname)
  if (!module) return
  try {
    const next = [module.to, ...readRecentModules(userId).filter((to) => to !== module.to)].slice(0, MAX_STORED)
    window.localStorage.setItem(storageKey(userId), JSON.stringify(next))
  } catch {
    // Sem armazenamento local o Início só não mostra os recentes.
  }
}
