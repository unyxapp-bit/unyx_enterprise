import { AlertTriangle, CalendarPlus, Copy } from "lucide-react"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { useCopySchedules, useSchedulesRange } from "@/hooks/useUnyxData"
import { formatDateBR } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/store/useAppStore"
import {
  countSchedulesForDate,
  findLatestScheduleSourceDate,
  getScheduleLookbackRange,
} from "../utils/scheduleCopySuggestions"

interface MissingSchedulesPromptProps {
  date: string
  currentScheduleCount: number
  isLoading?: boolean
  className?: string
  onCopied?: () => void
}

export function MissingSchedulesPrompt({
  date,
  currentScheduleCount,
  isLoading = false,
  className,
  onCopied,
}: MissingSchedulesPromptProps) {
  const selectedBranchId = useAppStore((state) => state.selectedBranchId)
  const { dateFrom, dateTo } = getScheduleLookbackRange(date, 30)
  const copySchedules = useCopySchedules()
  const shouldSearchPreviousSchedules = !isLoading && currentScheduleCount === 0
  const previousSchedules = useSchedulesRange(dateFrom, dateTo, {
    enabled: shouldSearchPreviousSchedules,
  })
  const sourceDate = findLatestScheduleSourceDate(previousSchedules.data ?? [], date)
  const sourceCount = countSchedulesForDate(previousSchedules.data ?? [], sourceDate)
  const showPrompt =
    shouldSearchPreviousSchedules &&
    !previousSchedules.isLoading

  if (!showPrompt) return null

  async function handleCopyLatest() {
    if (!sourceDate) return

    await copySchedules.mutateAsync({
      sourceDate,
      targetDate: date,
      branchId: selectedBranchId ?? null,
    })
    onCopied?.()
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950",
        className
      )}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold">
              Nao ha escala cadastrada para {formatDateBR(date)}
            </p>
            <p className="mt-1 text-amber-800">
              Sem escala do dia, Dashboard, Operacoes e IA ficam sem base completa
              para calcular presenca, atrasos e cobertura.
            </p>
            {sourceDate ? (
              <p className="mt-2 text-xs text-amber-700">
                Ultima escala encontrada: {formatDateBR(sourceDate)} com {sourceCount} registro(s).
              </p>
            ) : (
              <p className="mt-2 text-xs text-amber-700">
                Nao encontrei uma escala anterior nos ultimos 30 dias para copiar automaticamente.
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {sourceDate ? (
            <Button
              type="button"
              size="sm"
              onClick={() => void handleCopyLatest()}
              disabled={copySchedules.isPending}
            >
              <Copy className="size-4" />
              {copySchedules.isPending ? "Copiando..." : "Copiar ultima escala"}
            </Button>
          ) : null}
          <Button asChild size="sm" variant="outline">
            <Link to="/app/schedules">
              <CalendarPlus className="size-4" />
              Abrir escalas
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
