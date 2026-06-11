/**
 * OperationalTabs - Abas de Em Turno / A Chegar
 */

import React from "react"

interface OperationalTabsProps {
  activeTab: "em_turno" | "a_chegar"
  emTurnoCount: number
  aChEgarCount: number
  onTabChange: (tab: "em_turno" | "a_chegar") => void
}

export const OperationalTabs = React.memo(
  ({ activeTab, emTurnoCount, aChEgarCount, onTabChange }: OperationalTabsProps) => {
    return (
      <div className="mb-4 flex gap-1 rounded-lg border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-soft)] p-1">
        <button
          onClick={() => onTabChange("em_turno")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            activeTab === "em_turno"
              ? "bg-[color:var(--primary)] text-[color:var(--primary-foreground)] shadow-sm"
              : "text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-surface)] hover:text-[color:var(--text-primary)]"
          }`}
          aria-pressed={activeTab === "em_turno"}
        >
          Em turno
          <span
            className={`rounded-full px-1.5 py-0.5 text-xs tabular-nums ${
              activeTab === "em_turno"
                ? "bg-white/20 text-white"
                : "bg-[color:var(--bg-muted)] text-[color:var(--text-secondary)]"
            }`}
          >
            {emTurnoCount}
          </span>
        </button>
        <button
          onClick={() => onTabChange("a_chegar")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            activeTab === "a_chegar"
              ? "bg-[color:var(--primary)] text-[color:var(--primary-foreground)] shadow-sm"
              : "text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-surface)] hover:text-[color:var(--text-primary)]"
          }`}
          aria-pressed={activeTab === "a_chegar"}
        >
          A chegar
          <span
            className={`rounded-full px-1.5 py-0.5 text-xs tabular-nums ${
              activeTab === "a_chegar"
                ? "bg-white/20 text-white"
                : "bg-[color:var(--bg-muted)] text-[color:var(--text-secondary)]"
            }`}
          >
            {aChEgarCount}
          </span>
        </button>
      </div>
    )
  }
)

OperationalTabs.displayName = "OperationalTabs"
