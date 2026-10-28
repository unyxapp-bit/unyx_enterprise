import * as React from "react"
import { Check, ChevronDown } from "lucide-react"
import { Popover as PopoverPrimitive, Select as SelectPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
  style?: React.CSSProperties
}

const triggerClass =
  "flex h-8 w-full items-center justify-between gap-2 rounded-lg border bg-[color:var(--bg-surface)] px-2.5 text-left text-sm outline-none transition-colors hover:bg-[color:var(--bg-surface-soft)] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-muted-foreground"

const contentClass =
  "z-[70] overflow-hidden rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] p-1 text-sm text-[color:var(--text-primary)] shadow-[0_16px_40px_rgb(15_23_42/0.18)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"

const itemClass =
  "relative flex w-full cursor-pointer select-none items-center gap-2 rounded-lg py-1.5 pr-8 pl-2.5 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-[color:var(--bg-surface-soft)] data-[state=checked]:font-medium"

// Tom escuro para paineis que ficam sempre escuros (ex.: editor de cartazes).
const darkTriggerClass =
  "border-slate-700 bg-slate-950 text-slate-100 hover:bg-slate-900 data-[placeholder]:text-slate-400"
const darkContentClass = "border-slate-700 bg-slate-900 text-slate-100"
const darkItemClass = "data-[highlighted]:bg-slate-800"

// Radix nao aceita value="" em itens; "" vira este valor interno.
const EMPTY = "__empty__"

export function Select({
  value,
  onValueChange,
  options,
  placeholder = "Selecione",
  disabled,
  required,
  className,
  tone = "default",
  "aria-label": ariaLabel,
}: {
  tone?: "default" | "dark"
  value: string
  onValueChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  required?: boolean
  className?: string
  "aria-label"?: string
}) {
  const toInternal = (next: string) => (next === "" ? EMPTY : next)
  const hasEmptyOption = options.some((option) => option.value === "")

  return (
    <SelectPrimitive.Root
      value={value === "" && !hasEmptyOption ? undefined : toInternal(value)}
      onValueChange={(next) => onValueChange(next === EMPTY ? "" : next)}
      disabled={disabled}
      required={required}
    >
      <SelectPrimitive.Trigger
        aria-label={ariaLabel}
        className={cn(triggerClass, tone === "dark" && darkTriggerClass, className)}
      >
        <span className="min-w-0 truncate">
          <SelectPrimitive.Value placeholder={placeholder} />
        </span>
        <SelectPrimitive.Icon>
          <ChevronDown className="size-4 shrink-0 opacity-60" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className={cn(
            contentClass,
            tone === "dark" && darkContentClass,
            "max-h-72 w-[var(--radix-select-trigger-width)] min-w-[8rem]"
          )}
        >
          <SelectPrimitive.Viewport>
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value || EMPTY}
                value={toInternal(option.value)}
                disabled={option.disabled}
                style={option.style}
                className={cn(itemClass, tone === "dark" && darkItemClass)}
              >
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute right-2.5 flex items-center">
                  <Check className="size-4" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}

// Campo de texto livre com sugestoes no mesmo visual do Select (substitui <datalist>).
export function Combobox({
  value,
  onValueChange,
  suggestions,
  placeholder,
  className,
}: {
  value: string
  onValueChange: (value: string) => void
  suggestions: string[]
  placeholder?: string
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const query = value.trim().toLocaleLowerCase("pt-BR")
  const visible = suggestions.filter(
    (suggestion) =>
      !query || suggestion.toLocaleLowerCase("pt-BR").includes(query)
  )

  return (
    <PopoverPrimitive.Root open={open && visible.length > 0} onOpenChange={setOpen}>
      <PopoverPrimitive.Anchor asChild>
        <div className={cn("relative", className)}>
          <input
            value={value}
            placeholder={placeholder}
            onFocus={() => setOpen(true)}
            onChange={(event) => {
              onValueChange(event.target.value)
              setOpen(true)
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") setOpen(false)
            }}
            className={cn(triggerClass, "pr-8")}
          />
          <button
            type="button"
            tabIndex={-1}
            aria-label="Mostrar sugestões"
            className="absolute inset-y-0 right-0 flex w-8 items-center justify-center text-muted-foreground"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setOpen((current) => !current)}
          >
            <ChevronDown className="size-4 opacity-60" />
          </button>
        </div>
      </PopoverPrimitive.Anchor>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(event) => event.preventDefault()}
          // A lista rola quando há mais sugestões do que cabem (contentClass esconde o excedente).
          className={cn(
            contentClass,
            "max-h-72 w-[var(--radix-popover-trigger-width)] min-w-[8rem] overflow-y-auto overscroll-contain"
          )}
        >
          {visible.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className={cn(itemClass, suggestion === value && "font-medium")}
              onClick={() => {
                onValueChange(suggestion)
                setOpen(false)
              }}
            >
              {suggestion}
              {suggestion === value ? (
                <Check className="absolute right-2.5 size-4" />
              ) : null}
            </button>
          ))}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
