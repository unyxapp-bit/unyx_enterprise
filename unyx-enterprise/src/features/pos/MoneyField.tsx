import { cn } from "@/lib/utils"

/** Campo de valor em reais com o "R$" colado ao número, dentro da mesma borda. */
export function MoneyField({
  value,
  onChange,
  ariaLabel,
  disabled,
  invalid,
  placeholder = "0,00",
  className,
}: {
  value: string
  onChange: (value: string) => void
  ariaLabel: string
  disabled?: boolean
  invalid?: boolean
  placeholder?: string
  className?: string
}) {
  return (
    <label
      className={cn(
        "flex h-8 cursor-text items-center gap-1 rounded-2xl border bg-transparent px-3 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30",
        invalid ? "border-destructive" : "border-input",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
    >
      <span className="text-xs text-muted-foreground">R$</span>
      <input
        inputMode="decimal"
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        className="min-w-0 flex-1 bg-transparent text-sm tabular-nums outline-none placeholder:text-muted-foreground"
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}
