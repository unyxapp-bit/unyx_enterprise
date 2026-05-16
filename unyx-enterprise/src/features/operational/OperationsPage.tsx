/**
 * OperationsPage - Painel Operacional (Refatorado)
 * 
 * Componente principal que orquestra:
 * - Filtros e paginação
 * - Estado centralizado de diálogos
 * - Ações de colaboradores
 * - Renderização da interface
 */

import { useEffect, useState } from "react"
import {
  Activity,
  ChevronDown,
  History,
  MapPinned,
  RefreshCw,
  Store,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/shared/PageHeader"
import { modeUiConfig } from "@/features/ops/modes/modeUiConfig"
import { operationalModeNames } from "@/features/ops/modes/operationalModes"
import { useFinalizePostAllocation } from "@/hooks/useUnyxData"

import {
  BreakDialog,
  EntryDialog,
  OperationalGrid,
  OperationalPostsManagerCard,
  OperationalTabs,
  OccupiedPostsCard,
  OccurrenceDialog,
  ReturnPromptDialog,
  TimelinePanel,
} from "./components"

import {
  useClock,
  useOperationalActions,
  useOperationalDialogs,
  useOperationalData,
  useOperationalFilters,
} from "./hooks"

import {
  isCafeBreak,
  timeToMinutes,
} from "./utils"

import type { PostAllocation, ScheduleWithRelations } from "@/types/domain"

const fieldClass =
  "h-8 rounded-lg border bg-white px-2.5 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"

export function OperationsPage() {
  // ── Filters & Pagination ──
  const {
    date,
    setDate,
    activeTab,
    setActiveTab,
    sectorFilter,
    setSectorFilter,
    searchText,
    setSearchText,
    sortBy,
    setSortBy,
    pageIndex,
    setPageIndex,
    resetPagination,
    timelineOpen,
    setTimelineOpen,
  } = useOperationalFilters()

  // ── Data ──
  const {
    schedules,
    statuses,
    events,
    sectors,
    operationalPosts,
    postAllocations,
    mode,
    statusByScheduleId,
    emTurno,
    aChegar,
    activeList,
    allPosts,
    activePosts,
    occupiedPostIds,
    allocationByScheduleId,
    allocationByEmployeeId,
    occupiedPostAllocations,
    refetch,
  } = useOperationalData(date, sectorFilter, searchText, sortBy, activeTab)

  // ── Clock (updates every 30s) ──
  const now = useClock()
  const finalizePostAllocation = useFinalizePostAllocation()
  const [releasingAllocationId, setReleasingAllocationId] = useState<string | null>(
    null
  )

  // Reset pagination when tab/filter changes
  useEffect(() => {
    resetPagination()
  }, [date, sectorFilter, searchText, activeTab, resetPagination])

  // Auto-show return prompt when break expires
  const {
    returnPrompt,
    openReturnPrompt,
    dismissReturnPrompt,
  } = useOperationalDialogs()

  useEffect(() => {
    if (returnPrompt.schedule) return
    const overdue = emTurno.find((s) => {
      const st = statusByScheduleId.get(s.id)?.current_status
      if (st !== "em_intervalo") return false
      const endMin = timeToMinutes(s.break_end)
      return (
        endMin !== null &&
        now >= endMin &&
        !returnPrompt.dismissedIds.has(s.id)
      )
    })
    if (overdue) openReturnPrompt(overdue)
  }, [now, emTurno, statusByScheduleId, returnPrompt, openReturnPrompt])

  // ── Dialogs ──
  const dialogs = useOperationalDialogs()

  // ── Actions ──
  const {
    handleEntryConfirm,
    handleBreakConfirm,
    handleBreakAlreadyDone,
    handleCashMovementConfirm,
    handleCashierSwapConfirm,
    handleCafeStart,
    handleReturnAnswer,
    handleOccurrenceSubmit,
    fireAction,
    isPending,
  } = useOperationalActions()

  const modeConfig = modeUiConfig[mode]

  // ── Handlers ──

  const handleOpenEntryDialog = (schedule: ScheduleWithRelations) => {
    dialogs.openEntryDialog(schedule)
  }

  const handleEntryDialogConfirm = async (
    withPost: boolean,
    breakAlreadyDone: boolean
  ) => {
    const { schedule, selectedPostId } = dialogs.entry
    if (!schedule) return
    try {
      await handleEntryConfirm(
        schedule,
        withPost ? selectedPostId : null,
        breakAlreadyDone
      )
      dialogs.closeEntryDialog()
    } catch (error) {
      console.error("Erro ao confirmar entrada:", error)
    }
  }

  const handleBreakAlreadyDoneClick = async (schedule: ScheduleWithRelations) => {
    try {
      await handleBreakAlreadyDone(schedule)
    } catch (error) {
      console.error("Erro ao marcar intervalo feito:", error)
    }
  }

  const handleCashMovementClick = async (
    schedule: ScheduleWithRelations,
    allocation: PostAllocation | undefined
  ) => {
    if (!allocation) {
      console.error("Alocacao ativa nao encontrada para confirmar sangria:", schedule.id)
      return
    }
    try {
      await handleCashMovementConfirm(allocation)
    } catch (error) {
      console.error("Erro ao confirmar sangria:", error)
    }
  }

  const handleCashierSwapClick = async (schedule: ScheduleWithRelations) => {
    try {
      await handleCashierSwapConfirm(schedule)
    } catch (error) {
      console.error("Erro ao confirmar troca de caixa:", error)
    }
  }

  const handleBreakDialogConfirm = async (actualStartStr: string) => {
    const { schedule } = dialogs.breakDialog
    if (!schedule) return
    try {
      await handleBreakConfirm(schedule, actualStartStr)
      dialogs.closeBreakDialog()
    } catch (error) {
      console.error("Erro ao confirmar intervalo:", error)
    }
  }

  const handleCafeClick = async (schedule: ScheduleWithRelations) => {
    try {
      await handleCafeStart(schedule)
    } catch (error) {
      console.error("Erro ao iniciar café:", error)
    }
  }

  const handleReturnClick = async (
    schedule: ScheduleWithRelations,
    returned: boolean
  ) => {
    const isCafe = isCafeBreak(schedule.notes)
    try {
      await handleReturnAnswer(schedule, returned, isCafe)
      if (returned || !isCafe) {
        dismissReturnPrompt(schedule.id)
      }
    } catch (error) {
      console.error("Erro ao confirmar retorno:", error)
    }
  }

  const handleReleasePost = async (allocation: PostAllocation) => {
    setReleasingAllocationId(allocation.id)
    try {
      await finalizePostAllocation.mutateAsync({
        allocation_id: allocation.id,
        notes: "Liberado pela frente de caixa em tempo real",
      })
    } finally {
      setReleasingAllocationId(null)
    }
  }

  const handleOccurrenceDialogSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()
    const { schedule, note } = dialogs.occurrence
    if (!schedule) return
    try {
      await handleOccurrenceSubmit(schedule, note)
      dialogs.closeOccurrenceDialog()
      dialogs.setOccurrenceError(null)
    } catch (error) {
      dialogs.setOccurrenceError(
        error instanceof Error ? error.message : "Erro ao registrar ocorrência"
      )
    }
  }

  // ── Render ──

  return (
    <>
      <PageHeader
        title={modeConfig.liveTitle}
        description={modeConfig.mainFocus}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm">
                  <Store className="size-3.5" />
                  Gerenciar postos
                  <Badge variant="outline" className="ml-1 h-5 px-1.5">
                    {allPosts.filter((post) => post.active).length}/{allPosts.length}
                  </Badge>
                  <ChevronDown className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-[min(92vw,28rem)] p-0"
                onCloseAutoFocus={(event) => event.preventDefault()}
              >
                <div className="max-h-[70vh] overflow-y-auto">
                  <OperationalPostsManagerCard
                    posts={allPosts}
                    sectors={sectors.data ?? []}
                    isLoading={operationalPosts.isLoading}
                    isError={operationalPosts.isError}
                    error={operationalPosts.error}
                    defaultOpen
                    embedded
                  />
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm">
                  <MapPinned className="size-3.5" />
                  Alocados trabalhando
                  <Badge variant="outline" className="ml-1 h-5 px-1.5">
                    {occupiedPostAllocations.length}
                  </Badge>
                  <ChevronDown className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-[min(92vw,26rem)] p-0"
                onCloseAutoFocus={(event) => event.preventDefault()}
              >
                <div className="max-h-[70vh] overflow-y-auto">
                  <OccupiedPostsCard
                    allocations={occupiedPostAllocations}
                    isLoading={postAllocations.isLoading}
                    isError={postAllocations.isError}
                    error={postAllocations.error}
                    isReleasePending={finalizePostAllocation.isPending}
                    releasingAllocationId={releasingAllocationId}
                    onReleasePost={(allocation) => void handleReleasePost(allocation)}
                    defaultOpen
                    embedded
                  />
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm">
                  <History className="size-3.5" />
                  Timeline
                  <ChevronDown className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-[min(92vw,26rem)] p-0"
                onCloseAutoFocus={(event) => event.preventDefault()}
              >
                <div className="max-h-[70vh] overflow-y-auto">
                  <TimelinePanel
                    isOpen={timelineOpen}
                    onToggle={() => setTimelineOpen(!timelineOpen)}
                    events={events.data}
                    isLoading={events.isLoading}
                    isError={events.isError}
                    error={events.error}
                    embedded
                  />
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <Badge variant="outline">{operationalModeNames[mode]}</Badge>
            <Input
              className="w-40"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-label="Data da operação"
            />
            <Input
              className="w-40"
              type="search"
              placeholder="Buscar colaborador..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              aria-label="Buscar por nome"
            />
            {(sectors.data ?? []).length > 0 ? (
              <select
                className={fieldClass}
                value={sectorFilter}
                onChange={(e) => setSectorFilter(e.target.value)}
                aria-label="Filtrar por setor"
              >
                <option value="">Todos os setores</option>
                {(sectors.data ?? []).map((sector) => (
                  <option key={sector.id} value={sector.name}>
                    {sector.name}
                  </option>
                ))}
              </select>
            ) : null}
            <select
              className={fieldClass}
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as "priority" | "name" | "time")
              }
              aria-label="Ordenar por"
            >
              <option value="priority">Por prioridade</option>
              <option value="name">Por nome</option>
              <option value="time">Por horário</option>
            </select>
          </div>
        }
      />

      <div className="grid gap-4 p-6">
        {/* ── Main Panel ── */}
        <Card className="border bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="size-5" />
              <span className="flex-1">Painel operacional</span>
              <button
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-slate-100 hover:text-slate-900"
                onClick={() => refetch()}
                disabled={schedules.isFetching || statuses.isFetching}
                aria-label="Atualizar"
              >
                <RefreshCw
                  className={`size-4 ${
                    schedules.isFetching || statuses.isFetching
                      ? "animate-spin"
                      : ""
                  }`}
                />
              </button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Tabs */}
            <OperationalTabs
              activeTab={activeTab}
              emTurnoCount={emTurno.length}
              aChEgarCount={aChegar.length}
              onTabChange={setActiveTab}
            />

            {/* Grid */}
            <OperationalGrid
              schedules={activeList}
              statusByScheduleId={statusByScheduleId}
              allocationByScheduleId={allocationByScheduleId}
              allocationByEmployeeId={allocationByEmployeeId}
              currentMinutes={now}
              activeTab={activeTab}
              pageIndex={pageIndex}
              onPageChange={setPageIndex}
              isLoading={schedules.isLoading || statuses.isLoading}
              isError={schedules.isError || statuses.isError}
              error={schedules.error || statuses.error}
              isPending={isPending}
              onEntry={handleOpenEntryDialog}
              onBreak={(s) => dialogs.openBreakDialog(s)}
              onBreakAlreadyDone={handleBreakAlreadyDoneClick}
              onCashMovement={handleCashMovementClick}
              onCashierSwap={handleCashierSwapClick}
              onReturn={(s) => handleReturnClick(s, true)}
              onCafe={handleCafeClick}
              onExit={(s) => {
                fireAction(s, "saida_confirmada")
              }}
            />
          </CardContent>
        </Card>
      </div>

      {/* ── Dialogs ── */}

      <EntryDialog
        isOpen={!!dialogs.entry.schedule}
        onOpenChange={(open) => {
          if (!open) dialogs.closeEntryDialog()
        }}
        employeeName={dialogs.entry.schedule?.employees?.name ?? ""}
        employeeRole={dialogs.entry.schedule?.employees?.role}
        employeeSector={dialogs.entry.schedule?.employees?.sectors?.name}
        startTime={dialogs.entry.schedule?.start_time}
        breakStartTime={dialogs.entry.schedule?.break_start}
        breakEndTime={dialogs.entry.schedule?.break_end}
        endTime={dialogs.entry.schedule?.end_time}
        shouldAskBreakAlreadyDone={(() => {
          const schedule = dialogs.entry.schedule
          if (!schedule || schedule.notes?.includes("lunch_done")) return false
          const breakEnd = timeToMinutes(schedule.break_end)
          return breakEnd !== null && now > breakEnd
        })()}
        breakAlreadyDone={dialogs.entry.breakAlreadyDone}
        onBreakAlreadyDoneChange={(value) => dialogs.setEntryBreakAlreadyDone(value)}
        availablePosts={activePosts}
        occupiedPostIds={occupiedPostIds}
        selectedPostId={dialogs.entry.selectedPostId}
        onSelectedPostIdChange={(postId) => dialogs.setSelectedPost(postId)}
        isPending={isPending}
        onConfirm={handleEntryDialogConfirm}
      />

      <BreakDialog
        isOpen={!!dialogs.breakDialog.schedule}
        onOpenChange={(open) => {
          if (!open) dialogs.closeBreakDialog()
        }}
        schedule={dialogs.breakDialog.schedule}
        breakDialogMode={dialogs.breakDialog.mode}
        onModeChange={(mode) => dialogs.setBreakMode(mode)}
        breakLateTime={dialogs.breakDialog.lateTime}
        onLateTimeChange={(time) => dialogs.setBreakLateTime(time)}
        currentMinutes={now}
        isPending={isPending}
        onConfirm={handleBreakDialogConfirm}
      />

      <ReturnPromptDialog
        isOpen={!!returnPrompt.schedule}
        onOpenChange={(open) => {
          if (!open && returnPrompt.schedule) {
            dismissReturnPrompt(returnPrompt.schedule.id)
          }
        }}
        schedule={returnPrompt.schedule}
        currentMinutes={now}
        isPending={isPending}
        onReturnYes={() =>
          returnPrompt.schedule && handleReturnClick(returnPrompt.schedule, true)
        }
        onReturnNo={() =>
          returnPrompt.schedule && handleReturnClick(returnPrompt.schedule, false)
        }
      />

      <OccurrenceDialog
        isOpen={!!dialogs.occurrence.schedule}
        onOpenChange={(open) => {
          if (!open) dialogs.closeOccurrenceDialog()
        }}
        schedule={dialogs.occurrence.schedule}
        note={dialogs.occurrence.note}
        onNoteChange={(note) => dialogs.setOccurrenceNote(note)}
        error={dialogs.occurrence.error}
        isPending={isPending}
        onSubmit={handleOccurrenceDialogSubmit}
      />
    </>
  )
}
