import type { Branch } from "@/types/domain"

export function branchDisplayLabel(branch: Branch, branches: Branch[]) {
  const hasDuplicateName =
    branches.filter((item) => item.name === branch.name).length > 1

  if (!hasDuplicateName) return branch.name

  const location = [branch.city, branch.state].filter(Boolean).join("/")
  if (location) return `${branch.name} - ${location}`

  return `${branch.name} #${branch.id.slice(0, 8)}`
}
