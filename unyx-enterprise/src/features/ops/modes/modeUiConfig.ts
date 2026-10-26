import type { OperationalMode } from "./operationalModes"

export type DashboardMetricKey =
  | "scheduled"
  | "working"
  | "critical"
  | "breaks"
  | "delay"
  | "cashierCoverage"
  | "activeSectors"
  | "sectorAlerts"
  | "present"
  | "absences"
  | "currentShift"
  | "minimumTeam"
  | "nextPeak"
  | "criticalFunctions"
  | "responsiblePresence"
  | "serviceCoverage"
  | "occurrences"

export const modeUiConfig = {
  supermarket: {
    title: "Operação de Frente de Caixa",
    mainFocus: "Cobertura de caixas, sangria, intervalos e atrasos críticos.",
    liveTitle: "Frente de caixa em tempo real",
    highPriorityTitle: "Prioridade da frente de caixa",
    secondaryTitle: "Intervalos e sangria",
    minimumTeamSize: 2,
    dashboardCards: [
      "scheduled",
      "working",
      "cashierCoverage",
      "delay",
      "breaks",
      "critical",
    ],
    ruleHighlights: [
      "Operador não sai sem cobertura.",
      "Sangria antes do intervalo em caixa.",
      "Caixa descoberto sobe como alerta crítico.",
    ],
  },
  retail_store: {
    title: "Operação por Setores",
    mainFocus: "Cobertura por area, faltas, atrasos e realocacao operacional.",
    liveTitle: "Setores em tempo real",
    highPriorityTitle: "Setores em risco",
    secondaryTitle: "Cobertura por area",
    minimumTeamSize: 2,
    dashboardCards: [
      "activeSectors",
      "sectorAlerts",
      "present",
      "absences",
      "delay",
      "critical",
    ],
    ruleHighlights: [
      "Setor descoberto vira prioridade.",
      "Falta pesa mais que atraso leve.",
      "Filtro por setor guia a supervisão.",
    ],
  },
  restaurant: {
    title: "Operação por Turno",
    mainFocus: "Equipe mínima, horários de pico e funções críticas.",
    liveTitle: "Turno em tempo real",
    highPriorityTitle: "Alertas do turno",
    secondaryTitle: "Pico e equipe mínima",
    minimumTeamSize: 3,
    dashboardCards: [
      "currentShift",
      "present",
      "minimumTeam",
      "nextPeak",
      "criticalFunctions",
      "critical",
    ],
    ruleHighlights: [
      "Intervalos devem respeitar horários de pico.",
      "Falta em função crítica sobe prioridade.",
      "Equipe mínima guia a operação.",
    ],
  },
  pharmacy: {
    title: "Operação e Responsabilidade",
    mainFocus: "Responsável obrigatório, atendimento e rastreabilidade.",
    liveTitle: "Farmácia em tempo real",
    highPriorityTitle: "Alertas de conformidade",
    secondaryTitle: "Atendimento e responsável",
    minimumTeamSize: 1,
    dashboardCards: [
      "responsiblePresence",
      "serviceCoverage",
      "critical",
      "delay",
      "occurrences",
      "scheduled",
    ],
    ruleHighlights: [
      "Responsável obrigatório ausente e crítico.",
      "Atraso do responsável tem peso alto.",
      "Eventos críticos pedem auditoria reforçada.",
    ],
  },
  other: {
    title: "Operação em Tempo Real",
    mainFocus: "Controle operacional diário por atrasos, intervalos e alertas.",
    liveTitle: "Operação em tempo real",
    highPriorityTitle: "Alertas críticos",
    secondaryTitle: "Saídas e intervalos",
    minimumTeamSize: 2,
    dashboardCards: ["scheduled", "working", "critical", "breaks", "delay"],
    ruleHighlights: [
      "Prioridade por status operacional.",
      "Atrasos e intervalos aparecem no painel.",
      "Auditoria registra as ações principais.",
    ],
  },
} satisfies Record<
  OperationalMode,
  {
    title: string
    mainFocus: string
    liveTitle: string
    highPriorityTitle: string
    secondaryTitle: string
    minimumTeamSize: number
    dashboardCards: DashboardMetricKey[]
    ruleHighlights: string[]
  }
>
