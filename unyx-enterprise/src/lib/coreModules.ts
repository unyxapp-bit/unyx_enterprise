import type { SubscriptionPlan } from "@/types/domain"

export type CoreModuleKey = "unyx_ops" | "unyx_control" | "unyx_insight"

export const coreModules = [
  {
    key: "unyx_ops",
    name: "Unyx Ops",
    tagline: "Mostra o agora",
    description:
      "Operacao em tempo real com dashboard vivo, operacao do dia, status e alertas.",
    planAccess: {
      starter: "Basico",
      growth: "Completo",
      enterprise: "Completo",
    },
  },
  {
    key: "unyx_control",
    name: "Unyx Control",
    tagline: "Organiza a empresa",
    description:
      "Estrutura, cadastros, filiais, setores, colaboradores, usuarios e regras.",
    planAccess: {
      starter: "Basico",
      growth: "Completo",
      enterprise: "Completo",
    },
  },
  {
    key: "unyx_insight",
    name: "Unyx Insight",
    tagline: "Explica o que aconteceu",
    description:
      "Relatorios, faltas, atrasos, historico, auditoria e visao gerencial.",
    planAccess: {
      starter: "Indisponivel",
      growth: "Basico",
      enterprise: "Completo",
    },
  },
] as const

export function getCoreModulePlanAccess(
  moduleKey: CoreModuleKey,
  plan: SubscriptionPlan
) {
  return coreModules.find((module) => module.key === moduleKey)?.planAccess[plan]
}
