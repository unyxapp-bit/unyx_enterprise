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
      <div className="mb-4 flex gap-1 rounded-lg border bg-slate-50 p-1">
        <button
          onClick={() => onTabChange("em_turno")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            activeTab === "em_turno"
              ? "bg-white shadow-sm text-slate-900"
              : "text-slate-500 hover:text-slate-700"
          }`}
          aria-pressed={activeTab === "em_turno"}
        >
          Em turno
          <span
            className={`rounded-full px-1.5 py-0.5 text-xs tabular-nums ${
              activeTab === "em_turno"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-slate-200 text-slate-500"
            }`}
          >
            {emTurnoCount}
          </span>
        </button>
        <button
          onClick={() => onTabChange("a_chegar")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            activeTab === "a_chegar"
              ? "bg-white shadow-sm text-slate-900"
              : "text-slate-500 hover:text-slate-700"
          }`}
          aria-pressed={activeTab === "a_chegar"}
        >
          A chegar
          <span
            className={`rounded-full px-1.5 py-0.5 text-xs tabular-nums ${
              activeTab === "a_chegar"
                ? "bg-slate-800 text-white"
                : "bg-slate-200 text-slate-500"
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
