import { create } from "zustand"
import { persist } from "zustand/middleware"

interface AppStore {
  selectedBranchId: string | null
  setSelectedBranchId: (branchId: string | null) => void
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  delayToleranceMinutes: number
  setDelayToleranceMinutes: (minutes: number) => void
  breakToleranceMinutes: number
  setBreakToleranceMinutes: (minutes: number) => void
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      selectedBranchId: null,
      setSelectedBranchId: (selectedBranchId) => set({ selectedBranchId }),
      sidebarOpen: false,
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      delayToleranceMinutes: 5,
      setDelayToleranceMinutes: (delayToleranceMinutes) => set({ delayToleranceMinutes }),
      breakToleranceMinutes: 5,
      setBreakToleranceMinutes: (breakToleranceMinutes) => set({ breakToleranceMinutes }),
    }),
    {
      name: "unyx-app-store",
      partialize: (state) => ({
        selectedBranchId: state.selectedBranchId,
        delayToleranceMinutes: state.delayToleranceMinutes,
        breakToleranceMinutes: state.breakToleranceMinutes,
      }),
    }
  )
)
