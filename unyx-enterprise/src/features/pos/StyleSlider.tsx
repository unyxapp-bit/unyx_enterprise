import { useState } from "react"
import type { KeyboardEvent, PointerEvent, ReactNode } from "react"
import { ChevronDown, RotateCcw } from "lucide-react"

import { cn } from "@/lib/utils"

interface StyleSliderProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  // Casas decimais exibidas no campo numérico.
  decimals?: number
  disabled?: boolean
  // Valor padrão: quando diferente do atual, aparece o botão de restaurar.
  defaultValue?: number
  // Gravar o histórico fica a cargo do editor: o slider avisa o início do arraste
  // (onPointerDown/onKeyDown) e chama onChange(valor, false) enquanto arrasta;
  // o campo numérico e o botão de restaurar chamam onChange(valor, true).
  history: {
    onPointerDown: (event: PointerEvent<HTMLInputElement>) => void
    onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
  }
  onChange: (value: number, recordHistory: boolean) => void
  className?: string
}

function format(value: number, decimals: number) {
  return String(Number(value.toFixed(decimals)))
}

export function StyleSlider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  decimals = 0,
  disabled,
  defaultValue,
  history,
  onChange,
  className,
}: StyleSliderProps) {
  const [draft, setDraft] = useState<string | null>(null)
  const display = draft ?? format(value, decimals)
  const canReset =
    defaultValue !== undefined &&
    !disabled &&
    format(value, decimals) !== format(defaultValue, decimals)

  function commit() {
    if (draft === null) return
    const parsed = Number(draft.replace(",", "."))
    setDraft(null)
    if (draft.trim() === "" || Number.isNaN(parsed)) return
    const next = Math.min(max, Math.max(min, parsed))
    if (format(next, decimals) !== format(value, decimals)) onChange(next, true)
  }

  return (
    <div className={cn("block text-xs text-slate-400", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate">{label}</span>
        <span className="flex shrink-0 items-center gap-1">
          {canReset ? (
            <button
              type="button"
              title="Restaurar padrão"
              aria-label={`Restaurar ${label}`}
              onClick={() => onChange(defaultValue as number, true)}
              className="inline-flex size-5 items-center justify-center rounded text-slate-500 hover:bg-slate-800 hover:text-slate-200"
            >
              <RotateCcw className="size-3" />
            </button>
          ) : null}
          <input
            type="text"
            inputMode="decimal"
            aria-label={label}
            disabled={disabled}
            value={display}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur()
              if (event.key === "Escape") {
                setDraft(null)
                event.currentTarget.blur()
              }
            }}
            className="h-6 w-14 rounded border border-slate-700 bg-slate-950 px-1.5 text-right text-xs text-white outline-none focus:border-primary disabled:opacity-40"
          />
          {unit ? <span className="w-5 text-left text-[0.65rem] text-slate-500">{unit}</span> : null}
        </span>
      </div>
      <input
        type="range"
        aria-label={`${label} (controle deslizante)`}
        min={min}
        max={max}
        step={step}
        value={Math.min(max, Math.max(min, value))}
        disabled={disabled}
        onPointerDown={history.onPointerDown}
        onKeyDown={history.onKeyDown}
        onChange={(event) => onChange(Number(event.target.value), false)}
        className="mt-1 block w-full accent-primary disabled:opacity-40"
      />
    </div>
  )
}

// Seção recolhível do painel de estilo (nativa: <details>, acessível pelo teclado).
export function StyleGroup({
  title,
  defaultOpen = true,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  return (
    <details open={defaultOpen} className="group border-t border-slate-800 pt-3 first:border-t-0 first:pt-0">
      <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-slate-100 [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown className="size-4 text-slate-500 transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-3 space-y-4">{children}</div>
    </details>
  )
}
