import { AlertTriangle, CalendarPlus, Copy } from "lucide-react"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import {
  useBranches,
  useCopySchedules,
  useSchedules,
  useSchedulesRange,
} from "@/hooks/useUnyxData"
import { branchDisplayLabel } from "@/lib/branchLabels"
import { formatDateBR } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/store/useAppStore"
import type { Branch } from "@/types/domain"
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
  const branches = useBranches()
  const allSchedulesToday = useSchedules(date, null)
  const copySchedules = useCopySchedules()
  const shouldSearchPreviousSchedules = !isLoading && currentScheduleCount === 0
  const previousSchedules = useSchedulesRange(dateFrom, dateTo, {
    enabled: shouldSearchPreviousSchedules,
  })
  const sourceDate = findLatestScheduleSourceDate(previousSchedules.data ?? [], date)
  const sourceCount = countSchedulesForDate(previousSchedules.data ?? [], sourceDate)
  const selectedBranch = (branches.data ?? []).find(
    (branch) => branch.id === selectedBranchId
  )
  const otherBranchSchedules = selectedBranchId
    ? (allSchedulesToday.data ?? []).filter(
        (schedule) => schedule.branch_id !== selectedBranchId
      )
    : []
  const otherBranchIds = Array.from(
    new Set(otherBranchSchedules.map((schedule) => schedule.branch_id))
  )
  const otherBranchLabels = otherBranchIds
    .map((branchId) => (branches.data ?? []).find((branch) => branch.id === branchId))
    .filter((branch): branch is Branch => Boolean(branch))
    .map((branch) => branchDisplayLabel(branch, branches.data ?? []))
    .slice(0, 3)
  const hasSchedulesInOtherBranches =
    Boolean(selectedBranchId) &&
    currentScheduleCount === 0 &&
    otherBranchSchedules.length > 0
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
        "rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100",
        className
      )}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="font-semibold">
              {selectedBranch
                ? `Não há escala cadastrada para ${formatDateBR(date)} em ${branchDisplayLabel(selectedBranch, branches.data ?? [])}`
                : `Não há escala cadastrada para ${formatDateBR(date)}`}
            </p>
            <p className="mt-1 text-amber-800 dark:text-amber-200">
              Sem escala no escopo selecionado, Dashboard, Operações e IA ficam
              sem base completa para calcular presença, atrasos e cobertura.
            </p>
            {hasSchedulesInOtherBranches ? (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                Encontrei {otherBranchSchedules.length} escala(s) hoje em outra(s)
                filial(is): {otherBranchLabels.join(", ") || "filiais com outro cadastro"}.
              </p>
            ) : null}
            {sourceDate ? (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                Última escala encontrada: {formatDateBR(sourceDate)} com {sourceCount} registro(s).
              </p>
            ) : (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                Não encontrei uma escala anterior nos últimos 30 dias para copiar automaticamente.
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
              {copySchedules.isPending ? "Copiando..." : "Copiar última escala"}
            </Button>
          ) : null}
          <Button
            asChild
            size="sm"
            variant="outline"
            className="border-amber-300 bg-white/70 text-amber-950 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-transparent dark:text-amber-100 dark:hover:bg-amber-500/15"
          >
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
