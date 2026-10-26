import { useState } from "react"
import { Clock, Coffee, LogOut } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import {
  useAdjustPostAllocationStart,
  useFinalizePostAllocation,
  useReleaseEmployeeBreak,
} from "@/hooks/useUnyxData"
import type { OperationalBreakType, PostAllocation } from "@/types/domain"
import { isoFromDayAndTime, localDateKey } from "../utils"

const BREAK_TYPE_LABEL: Record<OperationalBreakType, string> = {
  cafe_manha: "Café manhã",
  cafe_tarde: "Café tarde",
  intervalo: "Intervalo",
}

const EXIT_REASONS = [
  { value: "Saída antecipada", label: "Saída antecipada do colaborador" },
  { value: "Fim do turno", label: "Fim do turno" },
  { value: "Troca de posto", label: "Troca de posto" },
  { value: "Outro motivo", label: "Outro motivo" },
]

type Mode = "start" | "exit" | "break"

function hhmmFromIso(iso: string) {
  const date = new Date(iso)
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * Correções de horário de uma alocação, sempre com confirmação: ajustar o início no posto,
 * registrar a saída do posto (inclusive saída antecipada) e liberar intervalo/café com o
 * horário real, quando o fiscal registra depois que o colaborador já saiu.
 */
export function AllocationTimeActions({
  allocation,
  hasActiveBreak,
  nowMs,
  exitLabel = "Liberar posto",
  onExited,
}: {
  allocation: PostAllocation
  hasActiveBreak: boolean
  nowMs: number
  /** Rótulo do botão de saída, ex.: "Liberar caixa". */
  exitLabel?: string
  /** Chamado depois que o posto é liberado ou o intervalo/café é liberado (o modal pai se fecha). */
  onExited?: () => void
}) {
  const [mode, setMode] = useState<Mode | null>(null)
  const [time, setTime] = useState("")
  const [exitReason, setExitReason] = useState(EXIT_REASONS[0].value)
  const [breakType, setBreakType] = useState<OperationalBreakType>("intervalo")

  const adjustStart = useAdjustPostAllocationStart()
  const finalize = useFinalizePostAllocation()
  const releaseBreak = useReleaseEmployeeBreak()
  const pending = adjustStart.isPending || finalize.isPending || releaseBreak.isPending

  const today = localDateKey(new Date(nowMs))
  const open = (next: Mode, initial: string) => {
    setMode(next)
    setTime(initial)
  }

  // Horário informado: não pode ser futuro nem anterior ao limite dado.
  const parseTime = (notBeforeIso?: string) => {
    if (!/^\d{2}:\d{2}$/.test(time)) {
      toast.error("Informe o horário no formato hh:mm.")
      return null
    }
    const iso = isoFromDayAndTime(today, time)
    if (Date.parse(iso) > Date.now() + 60_000) {
      toast.error("O horário não pode ser no futuro.")
      return null
    }
    if (notBeforeIso && Date.parse(iso) < Date.parse(notBeforeIso)) {
      toast.error(`O horário não pode ser antes de ${hhmmFromIso(notBeforeIso)}.`)
      return null
    }
    return iso
  }

  const isNow = (iso: string) => Date.now() - Date.parse(iso) < 90_000

  const confirm = async () => {
    try {
      if (mode === "start") {
        const iso = parseTime()
        if (!iso) return
        await adjustStart.mutateAsync({
          allocation_id: allocation.id,
          branch_id: allocation.branch_id,
          started_at: iso,
          previous_started_at: allocation.started_at,
        })
        setMode(null)
      } else if (mode === "exit") {
        const iso = parseTime(allocation.started_at)
        if (!iso) return
        await finalize.mutateAsync({
          allocation_id: allocation.id,
          ended_at: isNow(iso) ? null : iso,
          notes: `${exitReason}. Saída do posto às ${time}, registrada pelo controle PDV.`,
        })
        setMode(null)
        onExited?.()
      } else if (mode === "break") {
        const iso = parseTime(allocation.started_at)
        if (!iso) return
        await releaseBreak.mutateAsync({
          allocation_id: allocation.id,
          employee_id: allocation.employee_id,
          post_id: allocation.post_id,
          schedule_id: allocation.schedule_id,
          break_type: breakType,
          started_at: isNow(iso) ? null : iso,
          notes: isNow(iso)
            ? `${BREAK_TYPE_LABEL[breakType]} liberado pelo controle PDV`
            : `${BREAK_TYPE_LABEL[breakType]} com saída às ${time}, registrada depois pelo controle PDV`,
        })
        setMode(null)
        onExited?.()
      }
    } catch {
      // Os hooks já mostram o erro em toast.
    }
  }

  const nowHhmm = () => hhmmFromIso(new Date().toISOString())

  return (
    <div className="space-y-3 rounded-2xl border border-[color:var(--border-soft)] p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">Ações</div>
      <div className="grid gap-2 sm:grid-cols-3">
        <Button
          type="button"
          variant="outline"
          className="h-auto justify-start gap-2 whitespace-normal py-2 text-left"
          onClick={() => open("start", hhmmFromIso(allocation.started_at))}
        >
          <Clock className="size-4 shrink-0" />
          Ajustar início no posto
        </Button>
        {!hasActiveBreak ? (
          <Button
            type="button"
            variant="outline"
            className="h-auto justify-start gap-2 whitespace-normal py-2 text-left"
            onClick={() => open("break", nowHhmm())}
          >
            <Coffee className="size-4 shrink-0" />
            Intervalo ou café
          </Button>
        ) : null}
        {!hasActiveBreak ? (
          <Button
            type="button"
            variant="destructive"
            className="h-auto justify-start gap-2 whitespace-normal py-2 text-left"
            onClick={() => open("exit", nowHhmm())}
          >
            <LogOut className="size-4 shrink-0" />
            {exitLabel}
          </Button>
        ) : null}
      </div>

      {mode ? (
        <div className="space-y-3 rounded-2xl bg-[color:var(--bg-surface-soft)] p-3">
          <div className="text-sm font-medium text-[color:var(--text-primary)]">
            {mode === "start"
              ? "Corrigir o horário em que entrou no posto"
              : mode === "exit"
                ? `${exitLabel}: horário e motivo`
                : "Registrar a saída para intervalo ou café"}
          </div>
          <div className="text-xs text-muted-foreground">
            {mode === "start"
              ? "O tempo no posto começa na entrada da escala. Só altere se o horário real for diferente; a mudança fica na auditoria."
              : "Se o colaborador saiu antes de você registrar, informe o horário real. Deixe o horário atual para registrar agora."}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="space-y-1 text-xs">
              <span className="font-medium">
                {mode === "start" ? "Entrou no posto às" : "Saiu às"}
              </span>
              <Input
                type="time"
                className="w-32"
                value={time}
                onChange={(event) => setTime(event.target.value)}
              />
            </label>
            {mode === "exit" ? (
              <label className="min-w-48 flex-1 space-y-1 text-xs">
                <span className="font-medium">Motivo</span>
                <Select value={exitReason} onValueChange={setExitReason} options={EXIT_REASONS} />
              </label>
            ) : null}
            {mode === "break" ? (
              <label className="min-w-48 flex-1 space-y-1 text-xs">
                <span className="font-medium">Tipo</span>
                <Select
                  value={breakType}
                  onValueChange={(value) => setBreakType(value as OperationalBreakType)}
                  options={(Object.keys(BREAK_TYPE_LABEL) as OperationalBreakType[]).map(
                    (type) => ({ value: type, label: BREAK_TYPE_LABEL[type] })
                  )}
                />
              </label>
            ) : null}
            <div className="flex gap-2">
              <Button type="button" size="sm" disabled={pending} onClick={() => void confirm()}>
                {mode === "start"
                  ? "Confirmar alteração"
                  : mode === "exit"
                    ? "Confirmar saída"
                    : "Confirmar liberação"}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setMode(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
