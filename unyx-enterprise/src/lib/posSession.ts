const selectedCashSessionKey = "unyx-pos-selected-cash-session"

function storageKey(branchId: string) {
  return `${selectedCashSessionKey}:${branchId}`
}

export function getSelectedCashSessionId(branchId: string): string {
  if (typeof window === "undefined" || !branchId) return ""
  return window.sessionStorage.getItem(storageKey(branchId)) ?? ""
}

export function setSelectedCashSessionId(branchId: string, sessionId: string) {
  if (typeof window === "undefined" || !branchId) return
  window.sessionStorage.setItem(storageKey(branchId), sessionId)
}

export function clearSelectedCashSessionId(branchId: string) {
  if (typeof window === "undefined" || !branchId) return
  window.sessionStorage.removeItem(storageKey(branchId))
}
