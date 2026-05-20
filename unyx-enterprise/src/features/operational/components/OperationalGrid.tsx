/**
 * OperationalGrid - Grade de cards de colaboradores
 */

import React from "react"
import { StateBlock } from "@/components/shared/StateBlock"
import { EmployeeCard } from "./EmployeeCard"
import { OperationalPagination } from "./OperationalPagination"
import type {
  OperationalPost,
  OperationalStatusRecord,
  PostAllocation,
  ScheduleWithRelations,
} from "@/types/domain"
import type { OperationalTab } from "../utils"

const PAGE_SIZE = 12

interface OperationalGridProps {
  schedules: ScheduleWithRelations[]
  statusByScheduleId: Map<string, OperationalStatusRecord>
  allocationByScheduleId: Map<string, PostAllocation>
  allocationByEmployeeId: Map<string, PostAllocation>
  activePosts: OperationalPost[]
  occupiedPostIds: Set<string>
  currentMinutes: number
  activeTab: OperationalTab
  pageIndex: number
  onPageChange: (index: number) => void
  isLoading: boolean
  isError: boolean
  error?: Error | null
  isPending: boolean
  onAllocatePost: (
    schedule: ScheduleWithRelations,
    post: OperationalPost
  ) => void
  onEntry: (schedule: ScheduleWithRelations) => void
  onBreak: (schedule: ScheduleWithRelations) => void
  onBreakAlreadyDone: (schedule: ScheduleWithRelations) => void
  onCashMovement: (
    schedule: ScheduleWithRelations,
    allocation: PostAllocation | undefined
  ) => void
  onCashierSwap: (schedule: ScheduleWithRelations) => void
  onReturn: (schedule: ScheduleWithRelations) => void
  onCafe: (schedule: ScheduleWithRelations) => void
  onPeak: (schedule: ScheduleWithRelations) => void
  onSupport: (schedule: ScheduleWithRelations) => void
  onClosing: (schedule: ScheduleWithRelations) => void
  onNormal: (schedule: ScheduleWithRelations) => void
  onExit: (schedule: ScheduleWithRelations) => void
}

export const OperationalGrid = React.memo(
  ({
    schedules,
    statusByScheduleId,
    allocationByScheduleId,
    allocationByEmployeeId,
    activePosts,
    occupiedPostIds,
    currentMinutes,
    activeTab,
    pageIndex,
    onPageChange,
    isLoading,
    isError,
    error,
    isPending,
    onAllocatePost,
    onEntry,
    onBreak,
    onBreakAlreadyDone,
    onCashMovement,
    onCashierSwap,
    onReturn,
    onCafe,
    onPeak,
    onSupport,
    onClosing,
    onNormal,
    onExit,
  }: OperationalGridProps) => {
    const pageCount = Math.ceil(schedules.length / PAGE_SIZE)
    const pagedSchedules = schedules.slice(
      pageIndex * PAGE_SIZE,
      (pageIndex + 1) * PAGE_SIZE
    )

    if (isLoading) {
      return <StateBlock type="loading" title="Carregando operação" />
    }

    if (isError) {
      return (
        <StateBlock
          type="error"
          title="Erro ao carregar operação"
          description={error?.message}
        />
      )
    }

    if (schedules.length === 0) {
      return (
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
      )
    }

    return (
      <>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {pagedSchedules.map((schedule) => {
            const postAllocation =
              allocationByScheduleId.get(schedule.id) ??
              allocationByEmployeeId.get(schedule.employee_id)

            return (
              <EmployeeCard
                key={schedule.id}
                schedule={schedule}
                statusRecord={statusByScheduleId.get(schedule.id)}
                postAllocation={postAllocation}
                activePosts={activePosts}
                occupiedPostIds={occupiedPostIds}
                currentMinutes={currentMinutes}
                activeTab={activeTab}
                isPending={isPending}
                onAllocatePost={(post) => onAllocatePost(schedule, post)}
                onEntry={() => onEntry(schedule)}
                onBreak={() => onBreak(schedule)}
                onBreakAlreadyDone={() => onBreakAlreadyDone(schedule)}
                onCashMovement={() => onCashMovement(schedule, postAllocation)}
                onCashierSwap={() => onCashierSwap(schedule)}
                onReturn={() => onReturn(schedule)}
                onCafe={() => onCafe(schedule)}
                onPeak={() => onPeak(schedule)}
                onSupport={() => onSupport(schedule)}
                onClosing={() => onClosing(schedule)}
                onNormal={() => onNormal(schedule)}
                onExit={() => onExit(schedule)}
              />
            )
          })}
        </div>

        {pageCount > 1 ? (
          <OperationalPagination
            currentPage={pageIndex}
            totalPages={pageCount}
            totalItems={schedules.length}
            itemsPerPage={PAGE_SIZE}
            pageIndex={pageIndex}
            onPageChange={onPageChange}
          />
        ) : null}
      </>
    )
  }
)

OperationalGrid.displayName = "OperationalGrid"
