/**
 * OperationsPage - Painel Operacional (Refatorado)
 * 
 * Componente principal que orquestra:
 * - Filtros e paginação
 * - Estado centralizado de diálogos
 * - Ações de colaboradores
 * - Renderização da interface
 */

import { useEffect } from "react"
import { Activity, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/shared/PageHeader"
import { modeUiConfig } from "@/features/ops/modes/modeUiConfig"
import { operationalModeNames } from "@/features/ops/modes/operationalModes"

import {
  BreakDialog,
  EntryDialog,
  OperationalGrid,
  OperationalTabs,
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

import type { ScheduleWithRelations } from "@/types/domain"

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
    mode,
    statusByScheduleId,
    emTurno,
    aChegar,
    activeList,
    activePosts,
    occupiedPostIds,
    employeeByAllocation,
    refetch,
  } = useOperationalData(date, sectorFilter, searchText, sortBy, activeTab)

  // ── Clock (updates every 30s) ──
  const now = useClock()

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

  const handleEntryDialogConfirm = async (withPost: boolean) => {
    const { schedule, selectedPostId } = dialogs.entry
    if (!schedule) return
    try {
      await handleEntryConfirm(schedule, withPost ? selectedPostId : null)
      dialogs.closeEntryDialog()
    } catch (error) {
      console.error("Erro ao confirmar entrada:", error)
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

      <div className="grid gap-4 p-6 xl:grid-cols-[1.35fr_0.65fr]">
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
              onReturn={(s) => handleReturnClick(s, true)}
              onCafe={handleCafeClick}
              onExit={(s) => {
                fireAction(s, "saida_confirmada")
              }}
            />
          </CardContent>
        </Card>

        {/* ── Timeline ── */}
        <TimelinePanel
          isOpen={timelineOpen}
          onToggle={() => setTimelineOpen(!timelineOpen)}
          events={events.data}
          isLoading={events.isLoading}
          isError={events.isError}
          error={events.error}
        />
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
        endTime={dialogs.entry.schedule?.end_time}
        availablePosts={activePosts}
        occupiedPostIds={occupiedPostIds}
        employeeByAllocation={employeeByAllocation}
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
      if (s.schedule_id) map.set(s.schedule_id, s)
    }
    return map
  }, [statuses.data])

  // Base list sorted by operational priority
  const sortedSchedules = useMemo(() => {
    const all = schedules.data ?? []
    const filtered = sectorFilter
      ? all.filter(
          (s) =>
            s.employees?.sectors?.name === sectorFilter ||
            (sectorFilter === "__none__" && !s.employees?.sectors)
        )
      : all

    return filtered.slice().sort((a, b) => {
      const sA = statusByScheduleId.get(a.id)
      const sB = statusByScheduleId.get(b.id)
      return (
        getSchedulePriorityByMode(mode, b, sB) -
          getSchedulePriorityByMode(mode, a, sA) ||
        (a.employees?.name ?? "").localeCompare(b.employees?.name ?? "")
      )
    })
  }, [mode, schedules.data, sectorFilter, statusByScheduleId])

  // Tab split
  const emTurno = useMemo(
    () =>
      sortedSchedules.filter((s) => {
        const status = statusByScheduleId.get(s.id)?.current_status
        return status && ENTERED_STATUSES.has(status)
      }),
    [sortedSchedules, statusByScheduleId]
  )

  const aChegar = useMemo(
    () =>
      sortedSchedules
        .filter((s) => {
          const status = statusByScheduleId.get(s.id)?.current_status
          return !status || status === "aguardando_evento"
        })
        .sort((a, b) => {
          const ta = a.start_time ?? ""
          const tb = b.start_time ?? ""
          if (!ta && tb) return 1
          if (ta && !tb) return -1
          return ta.localeCompare(tb)
        }),
    [sortedSchedules, statusByScheduleId]
  )

  const activeList = activeTab === "em_turno" ? emTurno : aChegar

  useEffect(() => {
    setPageIndex(0)
  }, [date, sectorFilter, activeTab])

  // Clock — updates every 30 s so progress bars and overdue checks stay current
  useEffect(() => {
    const id = setInterval(() => setNow(nowMinutes()), 30_000)
    return () => clearInterval(id)
  }, [])

  // Auto-prompt when a break expires and wasn't manually dismissed
  useEffect(() => {
    if (returnPromptSchedule) return
    const overdue = emTurno.find((s) => {
      const st = statusByScheduleId.get(s.id)?.current_status
      if (st !== "em_intervalo") return false
      const endMin = timeToMinutes(s.break_end)
      return endMin !== null && now >= endMin && !dismissedReturnIds.has(s.id)
    })
    if (overdue) setReturnPromptSchedule(overdue)
  }, [now, emTurno, statusByScheduleId, dismissedReturnIds, returnPromptSchedule])

  const pageCount = Math.ceil(activeList.length / PAGE_SIZE)
  const pagedSchedules = useMemo(
    () => activeList.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE),
    [activeList, pageIndex]
  )

  // Active posts grouped by sector for the entry dialog
  const activePosts = useMemo(
    () => (operationalPosts.data ?? []).filter((p) => p.active),
    [operationalPosts.data]
  )

  // Set of post IDs currently occupied
  const occupiedPostIds = useMemo(
    () =>
      new Set(
        (postAllocations.data ?? [])
          .filter((a) => !a.ended_at)
          .map((a) => a.post_id)
      ),
    [postAllocations.data]
  )

  // Employee name lookup from today's schedules (for "occupied by" display)
  const employeeByAllocation = useMemo(() => {
    const byEmpId = new Map<string, string>()
    for (const s of schedules.data ?? []) {
      if (s.employee_id && s.employees?.name)
        byEmpId.set(s.employee_id, s.employees.name)
    }
    const byPostId = new Map<string, string>()
    for (const a of postAllocations.data ?? []) {
      if (!a.ended_at) {
        const name = byEmpId.get(a.employee_id)
        if (name) byPostId.set(a.post_id, name)
      }
    }
    return byPostId
  }, [postAllocations.data, schedules.data])

  // Posts grouped by sector name for the entry dialog
  const postsBySector = useMemo(() => {
    const map = new Map<string, OperationalPost[]>()
    for (const p of activePosts) {
      const key = p.sectors?.name ?? "Sem setor"
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(p)
    }
    return map
  }, [activePosts])

  // ── actions ──

  async function fireAction(
    schedule: ScheduleWithRelations,
    eventType: AttendanceEventType
  ) {
    const now = new Date()
    const nowTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`

    await recordEvent.mutateAsync({
      branch_id: schedule.branch_id,
      employee_id: schedule.employee_id,
      schedule_id: schedule.id,
      event_type: eventType,
      notes: eventLabel[eventType],
    })

    if (eventType === "entrada_confirmada") {
      updateSchedule.mutate({ scheduleId: schedule.id, values: { status: "working" } })
    }

    if (eventType === "retorno_confirmado") {
      const notes = addNoteMarker(schedule.notes, "lunch_done")
      updateSchedule.mutate({
        scheduleId: schedule.id,
        values: { status: "returned", break_end: nowTime, notes },
      })
    }

    if (eventType === "saida_confirmada") {
      updateSchedule.mutate({ scheduleId: schedule.id, values: { status: "finished" } })
    }
  }

  // Confirms entry: fires entrada_confirmada and optionally allocates a post
  async function handleEntryConfirm() {
    if (!entrySchedule) return
    const s = entrySchedule
    await fireAction(s, "entrada_confirmada")
    if (selectedPostId) {
      allocatePost.mutate({
        post_id: selectedPostId,
        employee_id: s.employee_id,
        schedule_id: s.id,
      })
    }
    setEntrySchedule(null)
    setSelectedPostId(null)
  }

  // Confirms break start.
  // actualStartStr = the time the employee actually left (scheduled or user-entered).
  // break_end is always the SCHEDULED return time from the escala — never recalculated.
  async function handleBreakConfirm(actualStartStr: string) {
    if (!breakConfirmSchedule) return
    const s = breakConfirmSchedule
    const pad = (v: number) => String(v).padStart(2, "0")

    // Scheduled return time stays fixed regardless of when they actually left
    const breakEndToUse = s.break_end ?? (() => {
      const startMin = timeToMinutes(actualStartStr) ?? nowMinutes()
      const endMin = startMin + 60
      return `${pad(Math.floor(endMin / 60) % 24)}:${pad(endMin % 60)}`
    })()

    const plannedStart = timeToMinutes(s.break_start)
    const plannedEnd   = timeToMinutes(s.break_end)
    const duration     =
      plannedStart !== null && plannedEnd !== null && plannedEnd > plannedStart
        ? plannedEnd - plannedStart
        : 60

    await recordEvent.mutateAsync({
      branch_id:   s.branch_id,
      employee_id: s.employee_id,
      schedule_id: s.id,
      event_type:  "intervalo_iniciado",
      notes:       `Intervalo de ${duration}min — saída ${actualStartStr}, retorno ${breakEndToUse}`,
    })
    updateSchedule.mutate({
      scheduleId: s.id,
      values: { status: "on_break", break_start: actualStartStr, break_end: breakEndToUse },
    })
    setBreakConfirmSchedule(null)
    setBreakDialogMode("question")
    setBreakLateTime("")
  }

  // Starts a 10-minute café break — no dialog, single click
  async function handleCafeStart(schedule: ScheduleWithRelations) {
    const n = new Date()
    const pad = (v: number) => String(v).padStart(2, "0")
    const nowStr = `${pad(n.getHours())}:${pad(n.getMinutes())}`
    const endMin = n.getHours() * 60 + n.getMinutes() + 10
    const endStr = `${pad(Math.floor(endMin / 60) % 24)}:${pad(endMin % 60)}`

    await recordEvent.mutateAsync({
      branch_id:   schedule.branch_id,
      employee_id: schedule.employee_id,
      schedule_id: schedule.id,
      event_type:  "intervalo_iniciado",
      notes:       "Café (10min)",
    })
    updateSchedule.mutate({
      scheduleId: schedule.id,
      values: {
        status:      "on_break",
        break_start: nowStr,
        break_end:   endStr,
        notes:       addNoteMarker(schedule.notes, "cafe_active"),
      },
    })
    // Reset any dismissed return prompt so the auto-check fires for this café
    setDismissedReturnIds((prev) => {
      const next = new Set(prev)
      next.delete(schedule.id)
      return next
    })
  }

  // Handles the return-check prompt answer (works for both regular interval and café)
  async function handleReturnAnswer(
    schedule: ScheduleWithRelations,
    returned: boolean
  ) {
    const isCafe = schedule.notes?.includes("cafe_active") ?? false
    const n = new Date()
    const pad = (v: number) => String(v).padStart(2, "0")
    const nowTime = `${pad(n.getHours())}:${pad(n.getMinutes())}`

    if (returned) {
      if (isCafe) {
        // Café return: go back to trabalhando, clean café note
        const notes = removeNoteMarker(schedule.notes, "cafe_active")
        await recordEvent.mutateAsync({
          branch_id:   schedule.branch_id,
          employee_id: schedule.employee_id,
          schedule_id: schedule.id,
          event_type:  "entrada_confirmada",
          notes:       "Retorno do café",
        })
        updateSchedule.mutate({
          scheduleId: schedule.id,
          values: { status: "working", notes },
        })
      } else {
        // Regular interval return: voltou
        const notes = addNoteMarker(schedule.notes, "lunch_done")
        await recordEvent.mutateAsync({
          branch_id:   schedule.branch_id,
          employee_id: schedule.employee_id,
          schedule_id: schedule.id,
          event_type:  "retorno_confirmado",
          notes:       eventLabel["retorno_confirmado"],
        })
        updateSchedule.mutate({
          scheduleId: schedule.id,
          values: { status: "returned", break_end: nowTime, notes },
        })
      }
    } else {
      await recordEvent.mutateAsync({
        branch_id:   schedule.branch_id,
        employee_id: schedule.employee_id,
        schedule_id: schedule.id,
        event_type:  "atraso_detectado",
        notes:       isCafe
          ? "Não retornou do café no prazo"
          : "Não retornou do intervalo no prazo",
      })
    }
    setDismissedReturnIds((prev) => new Set([...prev, schedule.id]))
    setReturnPromptSchedule(null)
  }

  async function handleOccurrenceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setOccurrenceError(null)
    if (!occurrenceSchedule) return
    if (!occurrenceNote.trim()) {
      setOccurrenceError("Descreva a ocorrência.")
      return
    }
    await recordEvent.mutateAsync({
      branch_id: occurrenceSchedule.branch_id,
      employee_id: occurrenceSchedule.employee_id,
      schedule_id: occurrenceSchedule.id,
      event_type: "ocorrencia_registrada",
      notes: occurrenceNote.trim(),
    })
    setOccurrenceNote("")
    setOccurrenceSchedule(null)
  }

  // ─── render ──────────────────────────────────────────────────────────────

  return (
    <>
      <PageHeader
        title={modeConfig.liveTitle}
        description={modeConfig.mainFocus}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{operationalModeNames[mode]}</Badge>
            <Input
              className="w-40"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            {(sectors.data ?? []).length > 0 ? (
              <select
                className={fieldClass}
                value={sectorFilter}
                onChange={(e) => setSectorFilter(e.target.value)}
              >
                <option value="">Todos os setores</option>
                {(sectors.data ?? []).map((sector) => (
                  <option key={sector.id} value={sector.name}>
                    {sector.name}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-4 p-6 xl:grid-cols-[1.35fr_0.65fr]">

        {/* ── Painel operacional ── */}
        <Card className="border bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="size-5" />
              <span className="flex-1">Painel operacional</span>
              <button
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-slate-100 hover:text-slate-900"
                onClick={() => { void schedules.refetch(); void statuses.refetch() }}
                disabled={schedules.isFetching || statuses.isFetching}
                aria-label="Atualizar"
              >
                <RefreshCw className={`size-4 ${schedules.isFetching || statuses.isFetching ? "animate-spin" : ""}`} />
              </button>
            </CardTitle>
          </CardHeader>
          <CardContent>

            {/* Tabs */}
            <div className="mb-4 flex gap-1 rounded-lg border bg-slate-50 p-1">
              <button
                onClick={() => setActiveTab("em_turno")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  activeTab === "em_turno"
                    ? "bg-white shadow-sm text-slate-900"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Em turno
                <span
                  className={`rounded-full px-1.5 py-0.5 text-xs tabular-nums ${
                    activeTab === "em_turno"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {emTurno.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab("a_chegar")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  activeTab === "a_chegar"
                    ? "bg-white shadow-sm text-slate-900"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                A chegar
                <span
                  className={`rounded-full px-1.5 py-0.5 text-xs tabular-nums ${
                    activeTab === "a_chegar"
                      ? "bg-slate-800 text-white"
                      : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {aChegar.length}
                </span>
              </button>
            </div>

            {schedules.isLoading || statuses.isLoading ? (
              <StateBlock type="loading" title="Carregando operação" />
            ) : schedules.isError ? (
              <StateBlock
                type="error"
                title="Erro ao carregar operação"
                description={schedules.error.message}
              />
            ) : activeList.length === 0 ? (
              <StateBlock
                title={
                  activeTab === "em_turno"
                    ? "Nenhum colaborador em turno"
                    : "Todos os colaboradores já entraram"
                }
                description={
                  activeTab === "em_turno"
                    ? "Confirme entradas para ver colaboradores aqui."
                    : "Sem previsão de novos colaboradores para hoje."
                }
              />
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {pagedSchedules.map((schedule) => {
                    const statusRecord = statusByScheduleId.get(schedule.id)
                    const currentStatus = statusRecord?.current_status
                    const isDone =
                      currentStatus === "finalizado" || currentStatus === "folga"

                    const nowMin = nowMinutes()
                    const startMin = timeToMinutes(schedule.start_time)
                    const breakStartMin = timeToMinutes(schedule.break_start)
                    const breakEndMin = timeToMinutes(schedule.break_end)

                    // Time worked since shift start (only if entered)
                    const timeWorked =
                      currentStatus &&
                      ENTERED_STATUSES.has(currentStatus) &&
                      currentStatus !== "finalizado" &&
                      startMin !== null &&
                      nowMin > startMin
                        ? formatDuration(nowMin - startMin)
                        : null

                    // Time until break (only if break not yet done)
                    const breakDone =
                      schedule.notes?.includes("lunch_done") ||
                      currentStatus === "voltou" ||
                      currentStatus === "em_intervalo" ||
                      (breakEndMin !== null && nowMin > breakEndMin)
                    const timeUntilBreak =
                      !breakDone &&
                      breakStartMin !== null &&
                      nowMin < breakStartMin
                        ? formatDuration(breakStartMin - nowMin)
                        : null

                    const cardMeta = currentStatus ? statusMeta[currentStatus] : null
                    const avatarClass =
                      avatarClassByStatus[currentStatus ?? "aguardando_evento"] ??
                      "bg-slate-200 text-slate-700"

                    // Break progress (for em_intervalo cards)
                    const isOnBreak = currentStatus === "em_intervalo"
                    const isCafeBreak = isOnBreak && (schedule.notes?.includes("cafe_active") ?? false)
                    const breakActualStartMin = isOnBreak
                      ? timeToMinutes(schedule.break_start)
                      : null
                    const breakActualEndMin = isOnBreak
                      ? timeToMinutes(schedule.break_end)
                      : null
                    const breakDurationMin =
                      breakActualStartMin !== null && breakActualEndMin !== null
                        ? breakActualEndMin - breakActualStartMin
                        : 60
                    const breakElapsed =
                      breakActualStartMin !== null
                        ? Math.max(0, now - breakActualStartMin)
                        : 0
                    const breakPct = isOnBreak
                      ? Math.min(100, Math.round((breakElapsed / breakDurationMin) * 100))
                      : 0
                    const breakOverdue =
                      isOnBreak &&
                      breakActualEndMin !== null &&
                      now > breakActualEndMin

                    // Button states
                    const canEntrada =
                      !currentStatus || currentStatus === "aguardando_evento"
                    const canIntervalo =
                      currentStatus === "trabalhando" ||
                      currentStatus === "voltou" ||
                      currentStatus === "deve_sair"
                    const canRetorno = isOnBreak
                    const canCafe =
                      (currentStatus === "voltou" || currentStatus === "trabalhando") &&
                      !isOnBreak
                    const canSaida =
                      !!currentStatus && ENTERED_STATUSES.has(currentStatus) && !isOnBreak

                    // Late indicator (only in A chegar tab)
                    const isLate =
                      activeTab === "a_chegar" &&
                      startMin !== null &&
                      nowMin > startMin &&
                      (!currentStatus || currentStatus === "aguardando_evento")
                    const lateMinutes = isLate ? nowMin - (startMin ?? 0) : 0

                    const cardBorderClass = isLate
                      ? "border-orange-300 bg-orange-50/40"
                      : cardMeta
                        ? cardMeta.cardClassName
                        : "border-slate-200 bg-white"

                    return (
                      <div
                        key={schedule.id}
                        className={`flex flex-col rounded-lg border p-4 shadow-sm transition-opacity ${cardBorderClass} ${isDone ? "opacity-60" : ""}`}
                      >
                        {/* Header: avatar + status */}
                        <div className="flex items-start justify-between gap-2">
                          <div
                            className={`flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${avatarClass}`}
                          >
                            {getInitials(schedule.employees?.name ?? "?")}
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <StatusBadge status={currentStatus ?? "aguardando_evento"} />
                            {isLate ? (
                              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700">
                                {formatDuration(lateMinutes)} atrasado
                              </span>
                            ) : null}
                          </div>
                        </div>

                        {/* Name + role/sector */}
                        <div className="mt-3">
                          <div className="text-sm font-semibold leading-tight">
                            {schedule.employees?.name ?? "Colaborador"}
                          </div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {[
                              schedule.employees?.role,
                              schedule.employees?.sectors?.name ?? "Sem setor",
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                        </div>

                        {/* Schedule times */}
                        <div className="mt-2 text-xs text-muted-foreground">
                          {formatTime(schedule.start_time)} → {formatTime(schedule.end_time)}
                          {schedule.break_start ? (
                            <span className="ml-2 text-slate-400">
                              · int. {formatTime(schedule.break_start)}
                            </span>
                          ) : null}
                        </div>

                        {/* Break progress bar (em_intervalo) */}
                        {isOnBreak ? (
                          <div className="mt-3">
                            <div className="mb-1 flex items-center justify-between text-xs">
                              <span className="text-violet-700">
                                {isCafeBreak
                                  ? `☕ Café — ${formatDuration(breakElapsed)}`
                                  : `${formatDuration(breakElapsed)} de intervalo`}
                              </span>
                              <span
                                className={
                                  breakOverdue
                                    ? "font-semibold text-red-600"
                                    : "text-slate-400"
                                }
                              >
                                {breakOverdue
                                  ? `+${formatDuration(breakElapsed - breakDurationMin)} além`
                                  : `${formatDuration(breakDurationMin)} total`}
                              </span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  breakPct >= 100
                                    ? "bg-red-500"
                                    : breakPct >= 80
                                      ? "bg-orange-400"
                                      : "bg-violet-500"
                                }`}
                                style={{ width: `${breakPct}%` }}
                              />
                            </div>
                          </div>
                        ) : null}

                        {/* Time worked + time until break (Em turno, não em intervalo) */}
                        {activeTab === "em_turno" && !isOnBreak && (timeWorked || timeUntilBreak) ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {timeWorked ? (
                              <span className="flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                                <Timer className="size-3" />
                                {timeWorked} trabalhando
                              </span>
                            ) : null}
                            {timeUntilBreak ? (
                              <span className="flex items-center gap-1 rounded-md bg-violet-50 px-2 py-0.5 text-xs text-violet-700">
                                <Coffee className="size-3" />
                                int. em {timeUntilBreak}
                              </span>
                            ) : null}
                          </div>
                        ) : null}

                        {/* Delay badge */}
                        {statusRecord && statusRecord.delay_minutes > 0 ? (
                          <div className="mt-2">
                            <Badge variant="destructive">
                              {minutesLabel(statusRecord.delay_minutes)} atraso
                            </Badge>
                          </div>
                        ) : null}

                        {/* Last event reason */}
                        {statusRecord?.status_reason ? (
                          <div className="mt-1.5 text-xs text-muted-foreground">
                            {statusRecord.status_reason}
                          </div>
                        ) : null}

                        {/* Action buttons */}
                        <div className="mt-auto pt-4">
                          {activeTab === "a_chegar" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex w-full items-center justify-center gap-1.5 text-xs"
                              disabled={!canEntrada || recordEvent.isPending}
                              onClick={() => { setEntrySchedule(schedule); setSelectedPostId(null) }}
                            >
                              <LogIn className="size-3.5" />
                              Confirmar entrada
                            </Button>
                          ) : (
                            <div className="grid grid-cols-2 gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex flex-col gap-0.5 h-auto py-2 text-xs"
                                disabled={!canEntrada || recordEvent.isPending}
                                onClick={() => { setEntrySchedule(schedule); setSelectedPostId(null) }}
                              >
                                <LogIn className="size-3.5" />
                                Entrada
                              </Button>
                              {canRetorno ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex flex-col gap-0.5 h-auto py-2 text-xs border-violet-300 text-violet-700 hover:bg-violet-50"
                                  disabled={recordEvent.isPending}
                                  onClick={() => void handleReturnAnswer(schedule, true)}
                                >
                                  <LogIn className="size-3.5" />
                                  Retorno
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex flex-col gap-0.5 h-auto py-2 text-xs"
                                  disabled={!canIntervalo || recordEvent.isPending}
                                  onClick={() => setBreakConfirmSchedule(schedule)}
                                >
                                  <Timer className="size-3.5" />
                                  Intervalo
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex flex-col gap-0.5 h-auto py-2 text-xs"
                                disabled={!canCafe || recordEvent.isPending}
                                onClick={() => void handleCafeStart(schedule)}
                              >
                                <Coffee className="size-3.5" />
                                Café
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex flex-col gap-0.5 h-auto py-2 text-xs"
                                disabled={!canSaida || recordEvent.isPending}
                                onClick={() => void fireAction(schedule, "saida_confirmada")}
                              >
                                <LogOut className="size-3.5" />
                                Saída
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {pageCount > 1 ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-4 text-sm text-slate-600">
                    <span>
                      {pageIndex * PAGE_SIZE + 1}–{Math.min((pageIndex + 1) * PAGE_SIZE, activeList.length)} de {activeList.length} colaboradores
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        className="rounded-md border bg-white px-3 py-1.5 text-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                        onClick={() => setPageIndex((p) => p - 1)}
                        disabled={pageIndex === 0}
                      >
                        Anterior
                      </button>
                      {Array.from({ length: pageCount }, (_, i) => {
                        const show =
                          pageCount <= 7 ||
                          i === 0 ||
                          i === pageCount - 1 ||
                          Math.abs(i - pageIndex) <= 1
                        const showEllipsisBefore = i === pageIndex - 2 && pageIndex - 2 > 1
                        const showEllipsisAfter =
                          i === pageIndex + 2 && pageIndex + 2 < pageCount - 2
                        if (showEllipsisBefore || showEllipsisAfter) {
                          return <span key={i} className="px-1 text-slate-400">…</span>
                        }
                        if (!show) return null
                        return (
                          <button
                            key={i}
                            className={`min-w-[32px] rounded-md border px-2 py-1.5 text-sm transition-colors ${
                              i === pageIndex
                                ? "border-indigo-600 bg-indigo-600 font-semibold text-white"
                                : "bg-white hover:bg-slate-50"
                            }`}
                            onClick={() => setPageIndex(i)}
                          >
                            {i + 1}
                          </button>
                        )
                      })}
                      <button
                        className="rounded-md border bg-white px-3 py-1.5 text-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                        onClick={() => setPageIndex((p) => p + 1)}
                        disabled={pageIndex === pageCount - 1}
                      >
                        Próximo
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

        {/* ── Timeline (collapsible) ── */}
        <Card className="self-start border bg-white shadow-sm">
          <CardHeader
            className="cursor-pointer select-none"
            onClick={() => setTimelineOpen((v) => !v)}
          >
            <CardTitle className="flex items-center gap-2">
              <History className="size-5" />
              <span className="flex-1">Timeline</span>
              <ChevronDown
                className={`size-4 text-muted-foreground transition-transform duration-200 ${
                  timelineOpen ? "rotate-180" : ""
                }`}
              />
            </CardTitle>
          </CardHeader>
          {timelineOpen ? (
            <CardContent>
              {events.isLoading ? (
                <StateBlock type="loading" title="Carregando eventos" />
              ) : events.isError ? (
                <StateBlock
                  type="error"
                  title="Erro ao carregar eventos"
                  description={events.error.message}
                />
              ) : (events.data ?? []).length === 0 ? (
                <StateBlock title="Nenhum evento registrado" />
              ) : (
                <div className="space-y-3">
                  {(events.data ?? []).slice(0, 12).map((event) => (
                    <div key={event.id} className="rounded-lg border bg-slate-50 p-3">
                      <div className="text-sm font-medium">
                        {eventLabel[event.event_type]}
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {event.employees?.name ?? "Colaborador"} ·{" "}
                        {formatDateTimeBR(event.event_time)}
                      </div>
                      {event.notes ? (
                        <div className="mt-2 text-sm text-muted-foreground">
                          {event.notes}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          ) : null}
        </Card>
      </div>

      {/* ── Entry dialog — post selection ── */}
      <Dialog
        open={Boolean(entrySchedule)}
        onOpenChange={(open) => {
          if (!open) { setEntrySchedule(null); setSelectedPostId(null) }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirmar entrada</DialogTitle>
          </DialogHeader>
          {entrySchedule ? (
            <div className="space-y-4">
              {/* Employee info */}
              <div className="rounded-lg border bg-slate-50 p-3 text-sm">
                <div className="font-semibold">{entrySchedule.employees?.name ?? "Colaborador"}</div>
                <div className="mt-0.5 text-muted-foreground">
                  {[entrySchedule.employees?.role, entrySchedule.employees?.sectors?.name]
                    .filter(Boolean)
                    .join(" · ")}
                  {" · "}
                  {formatTime(entrySchedule.start_time)} → {formatTime(entrySchedule.end_time)}
                </div>
              </div>

              {/* Post selection */}
              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">
                  Selecionar posto de trabalho
                </p>
                {activePosts.length === 0 ? (
                  <div className="rounded-lg border border-dashed bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
                    Nenhum posto cadastrado. O colaborador será marcado como trabalhando sem posto.
                  </div>
                ) : (
                  <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
                    {Array.from(postsBySector.entries()).map(([sector, posts]) => (
                      <div key={sector}>
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                          {sector}
                        </p>
                        <div className="space-y-1">
                          {posts.map((post) => {
                            const isOccupied = occupiedPostIds.has(post.id)
                            const occupiedBy = employeeByAllocation.get(post.id)
                            const isSelected = selectedPostId === post.id
                            return (
                              <button
                                key={post.id}
                                onClick={() =>
                                  setSelectedPostId(isSelected ? null : post.id)
                                }
                                className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                                  isSelected
                                    ? "border-indigo-400 bg-indigo-50 text-indigo-900"
                                    : "border-slate-200 bg-white hover:bg-slate-50"
                                }`}
                              >
                                <MapPin
                                  className={`size-4 shrink-0 ${isSelected ? "text-indigo-500" : "text-slate-400"}`}
                                />
                                <div className="min-w-0 flex-1">
                                  <span className="font-medium">{post.name}</span>
                                  <span className="ml-2 text-xs text-slate-400">
                                    {postTypeLabel[post.type] ?? post.type}
                                  </span>
                                </div>
                                {isOccupied ? (
                                  <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                                    {occupiedBy ? occupiedBy.split(" ")[0] : "Ocupado"}
                                  </span>
                                ) : (
                                  <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                                    Livre
                                  </span>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="ghost"
                  className="text-slate-500"
                  onClick={() => void handleEntryConfirm()}
                  disabled={recordEvent.isPending}
                >
                  Entrar sem posto
                </Button>
                <Button
                  disabled={recordEvent.isPending || (!selectedPostId && activePosts.length > 0 && false)}
                  onClick={() => void handleEntryConfirm()}
                >
                  {recordEvent.isPending
                    ? "Confirmando..."
                    : selectedPostId
                      ? "Confirmar com posto"
                      : "Confirmar entrada"}
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ── Break confirmation dialog ── */}
      <Dialog
        open={Boolean(breakConfirmSchedule)}
        onOpenChange={(open) => {
          if (!open) {
            setBreakConfirmSchedule(null)
            setBreakDialogMode("question")
            setBreakLateTime("")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Liberar para intervalo</DialogTitle>
          </DialogHeader>
          {breakConfirmSchedule ? (() => {
            const s = breakConfirmSchedule
            const pad = (v: number) => String(v).padStart(2, "0")
            const n = new Date()
            const nowMin = n.getHours() * 60 + n.getMinutes()
            const nowStr = `${pad(n.getHours())}:${pad(n.getMinutes())}`

            const scheduledStartMin = timeToMinutes(s.break_start)
            const scheduledEndStr   = s.break_end ?? ""
            const plannedDuration   =
              scheduledStartMin !== null && timeToMinutes(s.break_end) !== null
                ? (timeToMinutes(s.break_end)! - scheduledStartMin)
                : 60

            // More than 2 min past scheduled start → show late warning
            const isLate =
              scheduledStartMin !== null && nowMin > scheduledStartMin + 2

            // Effective duration for the "late_input" summary
            const lateStartMin   = timeToMinutes(breakLateTime)
            const schedEndMin    = timeToMinutes(s.break_end)
            const effectiveDuration =
              lateStartMin !== null && schedEndMin !== null
                ? Math.max(0, schedEndMin - lateStartMin)
                : plannedDuration

            const durationLabel = (min: number) =>
              min >= 60
                ? `${Math.floor(min / 60)}h${min % 60 > 0 ? ` ${min % 60}min` : ""}`
                : `${min}min`

            // ── no scheduled break times → simple confirm with current time ──
            if (!s.break_start) {
              return (
                <div className="space-y-4">
                  <EmployeeInfoBlock s={s} />
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    Sem horário de intervalo definido na escala. O intervalo será registrado a partir de agora ({nowStr}).
                  </div>
                  <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => setBreakConfirmSchedule(null)}>Cancelar</Button>
                    <Button disabled={recordEvent.isPending} onClick={() => void handleBreakConfirm(nowStr)}>
                      {recordEvent.isPending ? "Liberando..." : "Confirmar intervalo"}
                    </Button>
                  </DialogFooter>
                </div>
              )
            }

            // ── late: ask if left on time or entered actual time ──
            if (isLate) {
              if (breakDialogMode === "question") {
                return (
                  <div className="space-y-4">
                    <EmployeeInfoBlock s={s} />
                    <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2.5 text-sm text-orange-800">
                      Este colaborador deveria ter saído para intervalo às{" "}
                      <span className="font-semibold">{s.break_start}</span>.
                      Ele saiu no horário?
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        className="h-auto flex-col gap-1 py-3"
                        disabled={recordEvent.isPending}
                        onClick={() => void handleBreakConfirm(s.break_start!)}
                      >
                        <span className="text-sm font-semibold">Sim</span>
                        <span className="text-xs text-slate-500">Saiu às {s.break_start}</span>
                      </Button>
                      <Button
                        variant="outline"
                        className="h-auto flex-col gap-1 py-3"
                        onClick={() => {
                          setBreakDialogMode("late_input")
                          setBreakLateTime(nowStr)
                        }}
                      >
                        <span className="text-sm font-semibold">Não</span>
                        <span className="text-xs text-slate-500">Saiu depois</span>
                      </Button>
                    </div>
                    <DialogFooter>
                      <Button variant="ghost" onClick={() => setBreakConfirmSchedule(null)}>Cancelar</Button>
                    </DialogFooter>
                  </div>
                )
              }

              // late_input mode
              return (
                <div className="space-y-4">
                  <EmployeeInfoBlock s={s} />
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Horário que o colaborador saiu
                    </label>
                    <Input
                      type="time"
                      value={breakLateTime}
                      onChange={(e) => setBreakLateTime(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  {breakLateTime ? (
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div className="rounded-lg border bg-slate-50 p-2 text-center">
                        <p className="text-[10px] text-slate-400">Saída</p>
                        <p className="font-bold text-slate-800">{breakLateTime}</p>
                      </div>
                      <div className="rounded-lg border bg-violet-50 p-2 text-center">
                        <p className="text-[10px] text-violet-400">Duração efetiva</p>
                        <p className="font-bold text-violet-800">{durationLabel(effectiveDuration)}</p>
                      </div>
                      <div className="rounded-lg border bg-emerald-50 p-2 text-center">
                        <p className="text-[10px] text-emerald-400">Retorno</p>
                        <p className="font-bold text-emerald-800">{scheduledEndStr || "—"}</p>
                      </div>
                    </div>
                  ) : null}
                  <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => setBreakDialogMode("question")}>Voltar</Button>
                    <Button
                      disabled={!breakLateTime || recordEvent.isPending}
                      onClick={() => void handleBreakConfirm(breakLateTime)}
                    >
                      {recordEvent.isPending ? "Liberando..." : "Confirmar intervalo"}
                    </Button>
                  </DialogFooter>
                </div>
              )
            }

            // ── on time or early ──
            return (
              <div className="space-y-4">
                <EmployeeInfoBlock s={s} />
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="rounded-lg border bg-slate-50 p-2 text-center">
                    <p className="text-[10px] text-slate-400">Saída</p>
                    <p className="font-bold text-slate-800">{s.break_start}</p>
                  </div>
                  <div className="rounded-lg border bg-violet-50 p-2 text-center">
                    <p className="text-[10px] text-violet-400">Duração</p>
                    <p className="font-bold text-violet-800">{durationLabel(plannedDuration)}</p>
                  </div>
                  <div className="rounded-lg border bg-emerald-50 p-2 text-center">
                    <p className="text-[10px] text-emerald-400">Retorno</p>
                    <p className="font-bold text-emerald-800">{scheduledEndStr || "—"}</p>
                  </div>
                </div>
                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => setBreakConfirmSchedule(null)}>Cancelar</Button>
                  <Button
                    disabled={recordEvent.isPending}
                    onClick={() => void handleBreakConfirm(s.break_start ?? nowStr)}
                  >
                    {recordEvent.isPending ? "Liberando..." : "Confirmar intervalo"}
                  </Button>
                </DialogFooter>
              </div>
            )
          })() : null}
        </DialogContent>
      </Dialog>

      {/* ── Return check dialog (auto-shown when break expires) ── */}
      <Dialog
        open={Boolean(returnPromptSchedule)}
        onOpenChange={(open) => {
          if (!open && returnPromptSchedule) {
            setDismissedReturnIds((prev) => new Set([...prev, returnPromptSchedule.id]))
            setReturnPromptSchedule(null)
          }
        }}
      >
        <DialogContent>
          {returnPromptSchedule ? (() => {
            const s = returnPromptSchedule
            const isCafe = s.notes?.includes("cafe_active") ?? false
            const endMin = timeToMinutes(s.break_end)
            const overtime = endMin !== null ? Math.max(0, now - endMin) : 0
            return (
              <>
                <DialogHeader>
                  <DialogTitle>{isCafe ? "☕ Café encerrado" : "Intervalo encerrado"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <EmployeeInfoBlock s={s} />
                  {overtime > 0 ? (
                    <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-800">
                      Está há{" "}
                      <span className="font-semibold">{formatDuration(overtime)}</span>{" "}
                      além do {isCafe ? "café" : "intervalo"} previsto.
                    </div>
                  ) : (
                    <p className="text-sm text-slate-600">
                      {isCafe
                        ? "O café de 10min encerrou. O colaborador já retornou ao posto?"
                        : "O intervalo encerrou agora. O colaborador já retornou ao posto?"}
                    </p>
                  )}
                  <DialogFooter className="gap-2">
                    <Button
                      variant="outline"
                      className="border-red-200 text-red-700 hover:bg-red-50"
                      disabled={recordEvent.isPending}
                      onClick={() => void handleReturnAnswer(s, false)}
                    >
                      Não retornou — marcar atraso
                    </Button>
                    <Button
                      disabled={recordEvent.isPending}
                      onClick={() => void handleReturnAnswer(s, true)}
                    >
                      Sim, retornou
                    </Button>
                  </DialogFooter>
                </div>
              </>
            )
          })() : null}
        </DialogContent>
      </Dialog>

      {/* ── Occurrence dialog ── */}
      <Dialog
        open={Boolean(occurrenceSchedule)}
        onOpenChange={(open) => {
          if (!open) {
            setOccurrenceSchedule(null)
            setOccurrenceNote("")
            setOccurrenceError(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar ocorrência</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleOccurrenceSubmit}>
            <div className="rounded-lg border bg-slate-50 p-3 text-sm">
              <div className="font-medium">
                {occurrenceSchedule?.employees?.name ?? "Colaborador"}
              </div>
              <div className="mt-1 text-muted-foreground">
                {occurrenceSchedule?.employees?.sectors?.name ?? "Sem setor"} ·{" "}
                {occurrenceSchedule?.branches?.name ?? "Filial"}
              </div>
            </div>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Descrição da ocorrência</span>
              <textarea
                className="min-h-28 w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"
                value={occurrenceNote}
                onChange={(e) => setOccurrenceNote(e.target.value)}
                placeholder="Ex.: colaborador precisou cobrir outro setor por falta inesperada."
              />
            </label>
            {occurrenceError || recordEvent.error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {occurrenceError ?? recordEvent.error?.message}
              </div>
            ) : null}
            <DialogFooter>
              <Button type="submit" disabled={recordEvent.isPending}>
                {recordEvent.isPending ? "Registrando..." : "Registrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
