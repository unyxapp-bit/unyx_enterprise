import type { SubscriptionPlan } from "@/types/domain"

export type PlanLimit = number | null

export interface PlanConfig {
  label: string
  description: string
  maxBranches: PlanLimit
  maxEmployees: PlanLimit
}

export const planConfig: Record<SubscriptionPlan, PlanConfig> = {
  starter: {
    label: "Starter",
    description: "Core basico, 1 filial, 30 colaboradores",
    maxBranches: 1,
    maxEmployees: 30,
  },
  growth: {
    label: "Growth",
    description: "Core completo, 5 filiais, 150 colaboradores",
    maxBranches: 5,
    maxEmployees: 150,
  },
  enterprise: {
    label: "Enterprise",
    description: "Tudo liberado, sem limites operacionais",
    maxBranches: null,
    maxEmployees: null,
  },
}

export function getPlanLimits(plan: SubscriptionPlan) {
  const config = planConfig[plan]
  return {
    max_branches: config.maxBranches ?? 0,
    max_employees: config.maxEmployees ?? 0,
  }
}

export function limitLabel(limit: PlanLimit) {
  return limit === null ? "Ilimitado" : String(limit)
}
