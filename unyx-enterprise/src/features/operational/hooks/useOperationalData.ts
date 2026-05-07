/**
 * useOperationalData - Hook para agregar dados operacionais
 */

import { useMemo } from "react"
import type { OperationalStatusRecord } from "@/types/domain"
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
import { ENTERED_STATUSES } from "../utils/statusHelpers"
import type { OperationalTab } from "../utils/types"

export function useOperationalData(
  date: string,
  sectorFilter: string,
  searchText: string,
  sortBy: "priority" | "name" | "time",
  activeTab: OperationalTab
) {
  const schedules = useSchedules(date)
  const statuses = useOperationalStatuses()
  const events = useAttendanceEvents()
  const sectors = useSectors()
  const organization = useOrganization()
  const operationalSettings = useOperationalSettings()
  const operationalPosts = useOperationalPosts()
  const postAllocations = usePostAllocations(null, true)

  const mode = getOperationalMode(
    operationalSettings.data?.mode ?? organization.data?.segment
  )

  // Create status map
  const statusByScheduleId = useMemo(() => {
    const map = new Map<string, OperationalStatusRecord>()
    for (const s of statuses.data ?? []) {
      if (s.schedule_id) map.set(s.schedule_id, s)
    }
    return map
  }, [statuses.data])

  // Filter and sort schedules
  const sortedSchedules = useMemo(() => {
    let filtered = schedules.data ?? []

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
        return (
          getSchedulePriorityByMode(mode, b, sB) -
            getSchedulePriorityByMode(mode, a, sA) ||
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
  }, [schedules.data, sectorFilter, searchText, sortBy, mode, statusByScheduleId])

  // Split into tabs
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
          .filter((a) => !a.ended_at)
          .map((a) => a.post_id)
      ),
    [postAllocations.data]
  )

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

  const occupiedPostAllocations = useMemo(
    () =>
      (postAllocations.data ?? [])
        .filter((a) => !a.ended_at)
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
    [postAllocations.data]
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
    occupiedPostAllocations,
    postsBySector,

    // Refetch
    refetch: () => {
      schedules.refetch()
      statuses.refetch()
    },
  }
}
