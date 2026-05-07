import type { SubscriptionPlan } from "@/types/domain"

export type CoreModuleKey =
  | "unyx_ops"
  | "unyx_control"
  | "unyx_insight"
export type ExpansionModuleKey =
  | "unyx_comms"
  | "unyx_game"
  | "unyx_deliveries"
  | "unyx_checklists"
  | "unyx_academy"
  | "unyx_ai"
export type ProductModuleKey = CoreModuleKey | ExpansionModuleKey

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

export const expansionModules = [
  {
    key: "unyx_comms",
    name: "Unyx Comms",
    tagline: "Centraliza a comunicacao",
    description:
      "Feed interno, avisos por filial ou setor, comunicados fixados e leitura confirmada.",
    planAccess: {
      starter: "Indisponivel",
      growth: "Opcional",
      enterprise: "Completo",
    },
  },
  {
    key: "unyx_game",
    name: "Unyx Game",
    tagline: "Engaja a operacao",
    description:
      "Ranking por comportamento operacional, pontos, niveis e metas de engajamento.",
    planAccess: {
      starter: "Indisponivel",
      growth: "Opcional",
      enterprise: "Completo",
    },
  },
  {
    key: "unyx_deliveries",
    name: "Unyx Deliveries",
    tagline: "Controla entregas",
    description:
      "Entregas integradas ao PDV, pedidos manuais, rotas, status, taxas e historico operacional.",
    planAccess: {
      starter: "Indisponivel",
      growth: "Opcional",
      enterprise: "Completo",
    },
  },
  {
    key: "unyx_checklists",
    name: "Unyx Checklists",
    tagline: "Padroniza procedimentos",
    description:
      "Procedimentos operacionais, checklists executaveis, evidencias e historico de conclusao.",
    planAccess: {
      starter: "Indisponivel",
      growth: "Opcional",
      enterprise: "Completo",
    },
  },
  {
    key: "unyx_academy",
    name: "Unyx Academy",
    tagline: "Padroniza treinamento",
    description:
      "Conteudos, progresso por usuario, onboarding e trilhas de capacitacao.",
    planAccess: {
      starter: "Indisponivel",
      growth: "Opcional",
      enterprise: "Completo",
    },
  },
  {
    key: "unyx_ai",
    name: "Unyx AI",
    tagline: "Antecipa riscos",
    description:
      "Insights automaticos, previsao de atrasos, risco operacional e sugestoes de acao.",
    planAccess: {
      starter: "Indisponivel",
      growth: "Indisponivel",
      enterprise: "Completo",
    },
  },
] as const

export const productModuleGroups = [
  {
    label: "Core",
    modules: coreModules,
  },
  {
    label: "Expansao",
    modules: expansionModules,
  },
] as const

export function getCoreModulePlanAccess(
  moduleKey: CoreModuleKey,
  plan: SubscriptionPlan
) {
  return coreModules.find((module) => module.key === moduleKey)?.planAccess[plan]
}

export function getProductModulePlanAccess(
  moduleKey: ProductModuleKey,
  plan: SubscriptionPlan
) {
  return [...coreModules, ...expansionModules].find(
    (module) => module.key === moduleKey
  )?.planAccess[plan]
}
