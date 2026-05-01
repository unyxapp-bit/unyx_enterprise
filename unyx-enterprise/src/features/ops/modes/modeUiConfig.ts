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
    title: "Operacao de Frente de Caixa",
    mainFocus: "Cobertura de caixas, sangria, intervalos e atrasos criticos.",
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
      "Operador nao sai sem cobertura.",
      "Sangria antes do intervalo em caixa.",
      "Caixa descoberto sobe como alerta critico.",
    ],
  },
  retail_store: {
    title: "Operacao por Setores",
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
      "Filtro por setor guia a supervisao.",
    ],
  },
  restaurant: {
    title: "Operacao por Turno",
    mainFocus: "Equipe minima, horarios de pico e funcoes criticas.",
    liveTitle: "Turno em tempo real",
    highPriorityTitle: "Alertas do turno",
    secondaryTitle: "Pico e equipe minima",
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
      "Intervalos devem respeitar horarios de pico.",
      "Falta em funcao critica sobe prioridade.",
      "Equipe minima guia a operacao.",
    ],
  },
  pharmacy: {
    title: "Operacao e Responsabilidade",
    mainFocus: "Responsavel obrigatorio, atendimento e rastreabilidade.",
    liveTitle: "Farmacia em tempo real",
    highPriorityTitle: "Alertas de conformidade",
    secondaryTitle: "Atendimento e responsavel",
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
      "Responsavel obrigatorio ausente e critico.",
      "Atraso do responsavel tem peso alto.",
      "Eventos criticos pedem auditoria reforcada.",
    ],
  },
  other: {
    title: "Operacao em Tempo Real",
    mainFocus: "Controle operacional diario por atrasos, intervalos e alertas.",
    liveTitle: "Operacao em tempo real",
    highPriorityTitle: "Alertas criticos",
    secondaryTitle: "Saidas e intervalos",
    minimumTeamSize: 2,
    dashboardCards: ["scheduled", "working", "critical", "breaks", "delay"],
    ruleHighlights: [
      "Prioridade por status operacional.",
      "Atrasos e intervalos aparecem no painel.",
      "Auditoria registra as acoes principais.",
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
