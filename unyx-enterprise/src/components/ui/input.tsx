import * as React from "react"
import { CalendarDays } from "lucide-react"

import { cn } from "@/lib/utils"

const INPUT_CLASS =
  "h-8 w-full min-w-0 rounded-2xl border border-input bg-transparent px-3 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"

type BrKind = "date" | "time" | "datetime-local"

const BR_PLACEHOLDER: Record<BrKind, string> = {
  date: "dd/mm/aaaa",
  time: "hh:mm",
  "datetime-local": "dd/mm/aaaa hh:mm",
}

// Quantidade de dígitos de cada tipo (ddmmaaaa / hhmm / ddmmaaaahhmm).
const BR_DIGITS: Record<BrKind, number> = { date: 8, time: 4, "datetime-local": 12 }

function isBrKind(type?: string): type is BrKind {
  return type === "date" || type === "time" || type === "datetime-local"
}

/** Valor ISO do navegador (yyyy-mm-dd, hh:mm, yyyy-mm-ddThh:mm) -> texto brasileiro. */
function isoToBr(kind: BrKind, iso: string): string {
  if (!iso) return ""
  const date = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  const time = /(\d{2}):(\d{2})/.exec(kind === "time" ? iso : iso.split("T")[1] ?? "")
  const datePart = date ? `${date[3]}/${date[2]}/${date[1]}` : ""
  const timePart = time ? `${time[1]}:${time[2]}` : ""
  if (kind === "date") return datePart
  if (kind === "time") return timePart
  return [datePart, timePart].filter(Boolean).join(" ")
}

/** Aplica a máscara brasileira aos dígitos digitados. */
function maskBr(kind: BrKind, raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, BR_DIGITS[kind])
  const datePart = (s: string) =>
    [s.slice(0, 2), s.slice(2, 4), s.slice(4, 8)].filter(Boolean).join("/")
  const timePart = (s: string) => [s.slice(0, 2), s.slice(2, 4)].filter(Boolean).join(":")
  if (kind === "date") return datePart(d)
  if (kind === "time") return timePart(d)
  return [datePart(d.slice(0, 8)), timePart(d.slice(8))].filter(Boolean).join(" ")
}

/** Texto brasileiro completo e válido -> valor ISO; texto incompleto ou inválido -> null. */
function brToIso(kind: BrKind, text: string): string | null {
  const d = text.replace(/\D/g, "")
  if (d.length !== BR_DIGITS[kind]) return null
  const timeAt = kind === "time" ? 0 : 8
  let datePart = ""
  if (kind !== "time") {
    const day = Number(d.slice(0, 2))
    const month = Number(d.slice(2, 4))
    const year = Number(d.slice(4, 8))
    const check = new Date(year, month - 1, day)
    if (
      year < 1000 ||
      check.getFullYear() !== year ||
      check.getMonth() !== month - 1 ||
      check.getDate() !== day
    ) {
      return null
    }
    datePart = `${d.slice(4, 8)}-${d.slice(2, 4)}-${d.slice(0, 2)}`
  }
  if (kind === "date") return datePart
  const hours = Number(d.slice(timeAt, timeAt + 2))
  const minutes = Number(d.slice(timeAt + 2, timeAt + 4))
  if (hours > 23 || minutes > 59) return null
  const timePart = `${d.slice(timeAt, timeAt + 2)}:${d.slice(timeAt + 2, timeAt + 4)}`
  return kind === "time" ? timePart : `${datePart}T${timePart}`
}

function changeEvent(value: string): React.ChangeEvent<HTMLInputElement> {
  return { target: { value }, currentTarget: { value } } as unknown as React.ChangeEvent<HTMLInputElement>
}

/**
 * Campo de data/hora no padrão brasileiro (dd/mm/aaaa e 24h), independente do idioma do navegador.
 * Mantém a mesma interface do input nativo: `value` e `event.target.value` continuam em ISO.
 */
function BrDateTimeInput({
  kind,
  className,
  value,
  onChange,
  disabled,
  placeholder,
  min,
  max,
  required,
  ...props
}: Omit<React.ComponentProps<"input">, "type"> & { kind: BrKind }) {
  const current = typeof value === "string" ? value : ""
  const [text, setText] = React.useState(() => isoToBr(kind, current))
  const pickerRef = React.useRef<HTMLInputElement>(null)

  // Mudanças vindas de fora (ex.: botões de dia anterior/próximo) atualizam o texto exibido.
  const [syncedValue, setSyncedValue] = React.useState(current)
  if (syncedValue !== current) {
    setSyncedValue(current)
    if (brToIso(kind, text) !== current) setText(isoToBr(kind, current))
  }

  const emit = (next: string) => onChange?.(changeEvent(next))

  const handleText = (event: React.ChangeEvent<HTMLInputElement>) => {
    const masked = maskBr(kind, event.target.value)
    setText(masked)
    if (!masked) {
      emit("")
      return
    }
    const iso = brToIso(kind, masked)
    if (iso !== null) emit(iso)
  }

  const handleBlur = () => {
    // Texto incompleto/inválido volta ao último valor válido.
    if (text && brToIso(kind, text) === null) setText(isoToBr(kind, current))
  }

  const hasPicker = kind !== "time"
  return (
    <div className={cn("relative w-full min-w-0", className)}>
      <input
        {...props}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        data-slot="input"
        disabled={disabled}
        required={required}
        placeholder={placeholder ?? BR_PLACEHOLDER[kind]}
        value={text}
        onChange={handleText}
        onBlur={(event) => {
          handleBlur()
          props.onBlur?.(event)
        }}
        className={cn(INPUT_CLASS, hasPicker ? "pr-9" : "")}
      />
      {hasPicker ? (
        <>
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            aria-label="Abrir calendário"
            title="Abrir calendário"
            className="absolute inset-y-0 right-1 my-auto flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
            onClick={() => {
              const picker = pickerRef.current
              if (!picker) return
              try {
                picker.showPicker()
              } catch {
                picker.focus()
              }
            }}
          >
            <CalendarDays className="size-4" />
          </button>
          <input
            ref={pickerRef}
            type={kind}
            tabIndex={-1}
            aria-hidden="true"
            disabled={disabled}
            min={min}
            max={max}
            value={current}
            onChange={(event) => {
              setText(isoToBr(kind, event.target.value))
              emit(event.target.value)
            }}
            className="pointer-events-none absolute right-0 bottom-0 size-px opacity-0"
          />
        </>
      ) : null}
    </div>
  )
}

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  if (isBrKind(type)) {
    return <BrDateTimeInput kind={type} className={className} {...props} />
  }
  return <input type={type} data-slot="input" className={cn(INPUT_CLASS, className)} {...props} />
}

export { Input }
