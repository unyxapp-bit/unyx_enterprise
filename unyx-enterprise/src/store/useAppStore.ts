import { create } from "zustand"

interface AppStore {
  selectedBranchId: string | null
  setSelectedBranchId: (branchId: string | null) => void
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}

export const useAppStore = create<AppStore>((set) => ({
  selectedBranchId: null,
  setSelectedBranchId: (selectedBranchId) => set({ selectedBranchId }),
  sidebarOpen: false,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
}))
