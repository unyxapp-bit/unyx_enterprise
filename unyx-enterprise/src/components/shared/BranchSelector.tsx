import { useEffect } from "react"
import { Building2 } from "lucide-react"

import { Select } from "@/components/ui/select"
import { useBranches } from "@/hooks/useUnyxData"
import { branchDisplayLabel } from "@/lib/branchLabels"
import { useAppStore } from "@/store/useAppStore"

export function BranchSelector() {
  const { data: branches = [], isLoading } = useBranches()
  const selectedBranchId = useAppStore((state) => state.selectedBranchId)
  const setSelectedBranchId = useAppStore((state) => state.setSelectedBranchId)

  useEffect(() => {
    if (isLoading || !selectedBranchId) return
    if (branches.some((branch) => branch.id === selectedBranchId)) return

    setSelectedBranchId(null)
  }, [branches, isLoading, selectedBranchId, setSelectedBranchId])

  return (
    <div className="flex h-9 min-w-48 items-center gap-2 rounded-full border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] px-2.5 text-xs shadow-sm">
      <Building2 className="size-3.5 shrink-0 text-[color:var(--text-muted)]" />
      <Select
        aria-label="Filial"
        className="h-full border-0 bg-transparent px-0 text-xs shadow-none hover:bg-transparent focus-visible:ring-0"
        value={selectedBranchId ?? ""}
        disabled={isLoading}
        onValueChange={(value) => setSelectedBranchId(value || null)}
        options={[
          { value: "", label: "Todas as filiais" },
          ...branches.map((branch) => ({
            value: branch.id,
            label: branchDisplayLabel(branch, branches),
          })),
        ]}
      />
    </div>
  )
}
