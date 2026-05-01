import { Building2 } from "lucide-react"

import { useBranches } from "@/hooks/useUnyxData"
import { useAppStore } from "@/store/useAppStore"

export function BranchSelector() {
  const { data: branches = [], isLoading } = useBranches()
  const selectedBranchId = useAppStore((state) => state.selectedBranchId)
  const setSelectedBranchId = useAppStore((state) => state.setSelectedBranchId)

  return (
    <label className="flex min-w-56 items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm">
      <Building2 className="size-4 text-muted-foreground" />
      <select
        className="w-full bg-transparent outline-none"
        value={selectedBranchId ?? ""}
        disabled={isLoading}
        onChange={(event) => setSelectedBranchId(event.target.value || null)}
      >
        <option value="">Todas as filiais</option>
        {branches.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.name}
          </option>
        ))}
      </select>
    </label>
  )
}
