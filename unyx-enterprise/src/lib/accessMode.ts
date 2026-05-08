export type AccessMode = "system" | "pos"

const accessModeKey = "unyx-access-mode"

export function getAccessMode(): AccessMode | null {
  if (typeof window === "undefined") return null
  const value = window.sessionStorage.getItem(accessModeKey)
  return value === "system" || value === "pos" ? value : null
}

export function setAccessMode(mode: AccessMode) {
  if (typeof window === "undefined") return
  window.sessionStorage.setItem(accessModeKey, mode)
}

export function clearAccessMode() {
  if (typeof window === "undefined") return
  window.sessionStorage.removeItem(accessModeKey)
}
