/**
 * useOperationalFilters - Hook para gerenciar filtros e estado visual
 */

import { useState } from "react"
import type { FilterOptions, OperationalTab } from "../utils/types"

export function useOperationalFilters() {
  const [date, setDate] = useState<string>(() => {
    const today = new Date()
    return today.toISOString().split("T")[0]
  })

  const [activeTab, setActiveTab] = useState<OperationalTab>("em_turno")
  const [sectorFilter, setSectorFilter] = useState("")
  const [searchText, setSearchText] = useState("")
  const [sortBy, setSortBy] = useState<"priority" | "name" | "time">("priority")
  const [pageIndex, setPageIndex] = useState(0)
  const [timelineOpen, setTimelineOpen] = useState(true)

  const filters: FilterOptions = {
    sectorFilter,
    searchText,
    sortBy,
    dateFilter: date,
  }

  const resetFilters = () => {
    setSectorFilter("")
    setSearchText("")
    setSortBy("priority")
    setPageIndex(0)
  }

  const resetPagination = () => {
    setPageIndex(0)
  }

  return {
    // Date
    date,
    setDate,

    // Tabs
    activeTab,
    setActiveTab,

    // Filters
    ...filters,
    setSectorFilter,
    setSearchText,
    setSortBy,
    resetFilters,

    // Pagination
    pageIndex,
    setPageIndex,
    resetPagination,

    // Timeline
    timelineOpen,
    setTimelineOpen,
  }
}
