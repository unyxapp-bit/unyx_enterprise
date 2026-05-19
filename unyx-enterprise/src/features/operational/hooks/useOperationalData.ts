/**
 * useOperationalData - Hook para agregar dados operacionais
 */

import { useMemo } from "react"
import type {
  OperationalStatusRecord,
  PostAllocation,
} from "@/types/domain"
import {
  useAttendanceEvents,
  useOperationalPosts,
  useOperationalSettings,
  useOperationalStatuses,
  useOrganization,
  usePostAllocations,
  useSchedules,
  useSectors,
} from "@/hooks/useUnyxData"
import { getOperationalMode } from "@/features/ops/modes/operationalModes"
import { getSchedulePriorityByMode } from "@/features/ops/modes/priorityRules"
import {
  DEFAULT_BREAK_TOLERANCE_MINUTES,
  getOperationalFlowPriority,
  FLOW_ENTERED_STATUSES,
  FLOW_REAL_WORKING_STATUSES,
} from "../utils"
import type { OperationalTab } from "../utils/types"

const NON_OPERATIONAL_SCHEDULE_STATUSES = new Set([
  "day_off",
  "banked_hours",
  "cancelled",
])

const ACTIVE_ALLOCATION_STATUSES = new Set<PostAllocation["status"]>([
  "alocado",
  "aguardando_troca",
  "em_troca",
])

function allocationBelongsToDate(allocation: PostAllocation, date: string) {
  if (allocation.schedules?.work_date) {
    return allocation.schedules.work_date === date
  }

  return allocation.started_at.slice(0, 10) === date
}

export function useOperationalData(
  date: string,
  sectorFilter: string,
  searchText: string,
  sortBy: "priority" | "name" | "time",
  activeTab: OperationalTab,
  currentMinutes: number,
  breakToleranceMinutes?: number
) {
  const schedules = useSchedules(date)
  const statuses = useOperationalStatuses()
  const events = useAttendanceEvents()
  const sectors = useSectors()
  const organization = useOrganization()
  const operationalSettings = useOperationalSettings()
  const operationalPosts = useOperationalPosts()
  const postAllocations = usePostAllocations()

  const mode = getOperationalMode(
    operationalSettings.data?.mode ?? organization.data?.segment
  )
  const resolvedBreakToleranceMinutes =
    breakToleranceMinutes ??
    operationalSettings.data?.break_tolerance_minutes ??
    DEFAULT_BREAK_TOLERANCE_MINUTES

  // Create status map
  const statusByScheduleId = useMemo(() => {
    const map = new Map<string, OperationalStatusRecord>()
    for (const s of statuses.data ?? []) {
      if (s.schedule_id) map.set(s.schedule_id, s)
    }
    return map
  }, [statuses.data])

  const statusByEmployeeId = useMemo(() => {
    const map = new Map<string, OperationalStatusRecord>()
    for (const status of statuses.data ?? []) {
      if (status.schedules?.work_date && status.schedules.work_date !== date) {
        continue
      }
      map.set(status.employee_id, status)
    }
    return map
  }, [date, statuses.data])

  // Filter and sort schedules
  const sortedSchedules = useMemo(() => {
    let filtered = (schedules.data ?? []).filter(
      (schedule) => !NON_OPERATIONAL_SCHEDULE_STATUSES.has(schedule.status)
    )

    // Apply sector filter
    if (sectorFilter) {
      filtered = filtered.filter(
        (s) =>
          s.employees?.sectors?.name === sectorFilter ||
          (sectorFilter === "__none__" && !s.employees?.sectors)
      )
    }

    // Apply search filter
    if (searchText) {
      const query = searchText.toLowerCase()
      filtered = filtered.filter((s) =>
        (s.employees?.name ?? "").toLowerCase().includes(query)
      )
    }

    // Sort
    return filtered.slice().sort((a, b) => {
      if (sortBy === "priority") {
        const sA = statusByScheduleId.get(a.id)
        const sB = statusByScheduleId.get(b.id)
        const priorityA = Math.max(
          getSchedulePriorityByMode(mode, a, sA),
          getOperationalFlowPriority({
            schedule: a,
            status: sA,
            currentMinutes,
            breakToleranceMinutes: resolvedBreakToleranceMinutes,
          })
        )
        const priorityB = Math.max(
          getSchedulePriorityByMode(mode, b, sB),
          getOperationalFlowPriority({
            schedule: b,
            status: sB,
            currentMinutes,
            breakToleranceMinutes: resolvedBreakToleranceMinutes,
          })
        )
        return (
          priorityB - priorityA ||
          (a.employees?.name ?? "").localeCompare(b.employees?.name ?? "")
        )
      }
      if (sortBy === "name") {
        return (a.employees?.name ?? "").localeCompare(b.employees?.name ?? "")
      }
      if (sortBy === "time") {
        const ta = a.start_time ?? ""
        const tb = b.start_time ?? ""
        if (!ta && tb) return 1
        if (ta && !tb) return -1
        return ta.localeCompare(tb)
      }
      return 0
    })
  }, [
    currentMinutes,
    mode,
    resolvedBreakToleranceMinutes,
    schedules.data,
    searchText,
    sectorFilter,
    sortBy,
    statusByScheduleId,
  ])

  // Split into tabs
  const emTurno = useMemo(
    () =>
      sortedSchedules.filter((s) => {
        const status = statusByScheduleId.get(s.id)?.current_status
        return status && FLOW_ENTERED_STATUSES.has(status)
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

  // Operational posts
  const activePosts = useMemo(
    () => (operationalPosts.data ?? []).filter((p) => p.active),
    [operationalPosts.data]
  )

  const allPosts = useMemo(
    () =>
      (operationalPosts.data ?? [])
        .slice()
        .sort((a, b) => {
          const sectorA = a.sectors?.name ?? ""
          const sectorB = b.sectors?.name ?? ""
          return sectorA.localeCompare(sectorB) || a.name.localeCompare(b.name)
        }),
    [operationalPosts.data]
  )

  const occupiedPostIds = useMemo(
    () =>
      new Set(
        (postAllocations.data ?? [])
          .filter(
            (allocation) =>
              !allocation.ended_at &&
              ACTIVE_ALLOCATION_STATUSES.has(allocation.status) &&
              allocationBelongsToDate(allocation, date)
          )
          .map((allocation) => allocation.post_id)
      ),
    [date, postAllocations.data]
  )

  const activePostAllocations = useMemo(
    () =>
      (postAllocations.data ?? []).filter(
        (allocation) =>
          !allocation.ended_at &&
          ACTIVE_ALLOCATION_STATUSES.has(allocation.status) &&
          allocationBelongsToDate(allocation, date)
      ),
    [date, postAllocations.data]
  )

  const allocationByScheduleId = useMemo(() => {
    const map = new Map<string, PostAllocation>()
    for (const allocation of activePostAllocations) {
      if (allocation.schedule_id) map.set(allocation.schedule_id, allocation)
    }
    return map
  }, [activePostAllocations])

  const allocationByEmployeeId = useMemo(() => {
    const map = new Map<string, PostAllocation>()
    for (const allocation of activePostAllocations) {
      map.set(allocation.employee_id, allocation)
    }
    return map
  }, [activePostAllocations])

  const employeeByAllocation = useMemo(() => {
    const byPostId = new Map<string, string>()
    for (const allocation of activePostAllocations) {
      const name =
        allocation.employees?.name ??
        schedules.data?.find((schedule) => schedule.employee_id === allocation.employee_id)
          ?.employees?.name
      if (name) byPostId.set(allocation.post_id, name)
    }
    return byPostId
  }, [activePostAllocations, schedules.data])

  const occupiedPostAllocations = useMemo(
    () =>
      activePostAllocations
        .filter((allocation) => {
          const status =
            (allocation.schedule_id
              ? statusByScheduleId.get(allocation.schedule_id)
              : undefined) ?? statusByEmployeeId.get(allocation.employee_id)
          return status && FLOW_REAL_WORKING_STATUSES.has(status.current_status)
        })
        .slice()
        .sort((a, b) => {
          const sectorA = a.operational_posts?.sectors?.name ?? ""
          const sectorB = b.operational_posts?.sectors?.name ?? ""
          return (
            sectorA.localeCompare(sectorB) ||
            (a.operational_posts?.name ?? "").localeCompare(
              b.operational_posts?.name ?? ""
            )
          )
        }),
    [activePostAllocations, statusByEmployeeId, statusByScheduleId]
  )

  const postsBySector = useMemo(() => {
    const map = new Map<string, typeof activePosts>()
    for (const p of activePosts) {
      const key = p.sectors?.name ?? "Sem setor"
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(p)
    }
    return map
  }, [activePosts])

  return {
    // Data
    schedules,
    statuses,
    events,
    sectors,
    organization,
    operationalSettings,
    operationalPosts,
    postAllocations,

    // Derived
    mode,
    statusByScheduleId,
    sortedSchedules,
    emTurno,
    aChegar,
    activeList,
    allPosts,
    activePosts,
    occupiedPostIds,
    employeeByAllocation,
    allocationByScheduleId,
    allocationByEmployeeId,
    occupiedPostAllocations,
    postsBySector,

    // Refetch
    refetch: () => {
      schedules.refetch()
      statuses.refetch()
      operationalPosts.refetch()
      postAllocations.refetch()
    },
  }
}
