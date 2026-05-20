import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"

import {
  ThemeContext,
  type ResolvedTheme,
  type ThemePreference,
} from "@/app/providers/theme-context"

const storageKey = "unyx.theme"

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system"
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light"
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function getInitialPreference(): ThemePreference {
  if (typeof window === "undefined") return "system"
  const stored = window.localStorage.getItem(storageKey)
  return isThemePreference(stored) ? stored : "system"
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(getInitialPreference)
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme)
  const resolvedTheme = preference === "system" ? systemTheme : preference

  useEffect(() => {
    if (typeof window === "undefined") return

    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const handleChange = () => setSystemTheme(media.matches ? "dark" : "light")

    handleChange()
    media.addEventListener("change", handleChange)
    return () => media.removeEventListener("change", handleChange)
  }, [])

  useEffect(() => {
    if (typeof document === "undefined") return

    const root = document.documentElement
    root.dataset.theme = resolvedTheme
    root.classList.toggle("dark", resolvedTheme === "dark")
    root.style.colorScheme = resolvedTheme
  }, [resolvedTheme])

  const setTheme = useCallback((theme: ThemePreference) => {
    setPreference(theme)
    if (typeof window === "undefined") return
    window.localStorage.setItem(storageKey, theme)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
  }, [resolvedTheme, setTheme])

  const value = useMemo(
    () => ({ preference, resolvedTheme, setTheme, toggleTheme }),
    [preference, resolvedTheme, setTheme, toggleTheme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
