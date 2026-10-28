// Rascunhos guardados no navegador: sobrevivem a recarregar a página até a ação ser concluída.

export function readStorage(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function writeStorage(key: string, value: unknown | null) {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Sem armazenamento disponível: a tela segue funcionando, só não guarda o rascunho.
  }
}
