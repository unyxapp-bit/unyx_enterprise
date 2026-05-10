import type {
  AttendanceEventType,
  OperationalStatus,
  ScheduleStatus,
} from "@/types/domain"

export const operationalStatuses: OperationalStatus[] = [
  "alerta_critico",
  "aguardando_sangria",
  "troca_de_caixa",
  "deve_sair",
  "em_intervalo",
  "voltou",
  "trabalhando",
  "aguardando_evento",
  "finalizado",
  "folga",
]

export const statusMeta: Record<
  OperationalStatus,
  {
    label: string
    badgeClassName: string
    cardClassName: string
    dotClassName: string
  }
> = {
  aguardando_evento: {
    label: "Aguardando evento",
    badgeClassName: "border-slate-200 bg-slate-50 text-slate-600",
    cardClassName: "border-slate-200 bg-slate-50/70",
    dotClassName: "bg-slate-400",
  },
  trabalhando: {
    label: "Trabalhando",
    badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
    cardClassName: "border-emerald-200 bg-emerald-50/70",
    dotClassName: "bg-emerald-500",
  },
  deve_sair: {
    label: "Deve sair",
    badgeClassName: "border-amber-200 bg-amber-50 text-amber-700",
    cardClassName: "border-amber-200 bg-amber-50/70",
    dotClassName: "bg-amber-500",
  },
  aguardando_sangria: {
    label: "Aguardando sangria",
    badgeClassName: "border-orange-200 bg-orange-50 text-orange-700",
    cardClassName: "border-orange-200 bg-orange-50/70",
    dotClassName: "bg-orange-500",
  },
  troca_de_caixa: {
    label: "Troca de caixa",
    badgeClassName: "border-sky-200 bg-sky-50 text-sky-700",
    cardClassName: "border-sky-200 bg-sky-50/70",
    dotClassName: "bg-sky-500",
  },
  em_intervalo: {
    label: "Em intervalo",
    badgeClassName: "border-violet-200 bg-violet-50 text-violet-700",
    cardClassName: "border-violet-200 bg-violet-50/70",
    dotClassName: "bg-violet-500",
  },
  voltou: {
    label: "Voltou",
    badgeClassName: "border-teal-200 bg-teal-50 text-teal-700",
    cardClassName: "border-teal-200 bg-teal-50/70",
    dotClassName: "bg-teal-500",
  },
  folga: {
    label: "Folga",
    badgeClassName: "border-zinc-200 bg-zinc-50 text-zinc-600",
    cardClassName: "border-zinc-200 bg-zinc-50/70",
    dotClassName: "bg-zinc-400",
  },
  finalizado: {
    label: "Finalizado",
    badgeClassName: "border-neutral-200 bg-neutral-50 text-neutral-700",
    cardClassName: "border-neutral-200 bg-neutral-50/70",
    dotClassName: "bg-neutral-500",
  },
  alerta_critico: {
    label: "Alerta crítico",
    badgeClassName: "border-red-200 bg-red-50 text-red-700",
    cardClassName: "border-red-200 bg-red-50/70",
    dotClassName: "bg-red-500",
  },
}

export const scheduleStatusLabel: Record<ScheduleStatus, string> = {
  scheduled: "Escalado",
  working: "Trabalhando",
  on_break: "Em intervalo",
  returned: "Retornou",
  finished: "Finalizado",
  absent: "Falta",
  day_off: "Folga",
  banked_hours: "Banco de horas",
  cancelled: "Cancelado",
}

export const eventLabel: Record<AttendanceEventType, string> = {
  entrada_confirmada: "Entrada confirmada",
  atraso_detectado: "Atraso detectado",
  falta_detectada: "Falta detectada",
  intervalo_solicitado: "Intervalo solicitado",
  sangria_confirmada: "Sangria confirmada",
  troca_caixa_confirmada: "Troca de caixa confirmada",
  intervalo_iniciado: "Intervalo iniciado",
  retorno_confirmado: "Retorno confirmado",
  saida_confirmada: "Saída confirmada",
  ocorrencia_registrada: "Ocorrência registrada",
}

export const operationalActions: Array<{
  eventType: AttendanceEventType
  label: string
  nextStatus: OperationalStatus
  priorityLevel: number
}> = [
  {
    eventType: "entrada_confirmada",
    label: "Entrada",
    nextStatus: "trabalhando",
    priorityLevel: 20,
  },
  {
    eventType: "atraso_detectado",
    label: "Atraso",
    nextStatus: "alerta_critico",
    priorityLevel: 100,
  },
  {
    eventType: "falta_detectada",
    label: "Falta",
    nextStatus: "alerta_critico",
    priorityLevel: 110,
  },
  {
    eventType: "intervalo_solicitado",
    label: "Intervalo",
    nextStatus: "aguardando_sangria",
    priorityLevel: 80,
  },
  {
    eventType: "sangria_confirmada",
    label: "Sangria",
    nextStatus: "troca_de_caixa",
    priorityLevel: 70,
  },
  {
    eventType: "troca_caixa_confirmada",
    label: "Troca",
    nextStatus: "deve_sair",
    priorityLevel: 60,
  },
  {
    eventType: "intervalo_iniciado",
    label: "Iniciar",
    nextStatus: "em_intervalo",
    priorityLevel: 50,
  },
  {
    eventType: "retorno_confirmado",
    label: "Retorno",
    nextStatus: "voltou",
    priorityLevel: 30,
  },
  {
    eventType: "saida_confirmada",
    label: "Confirmar saída",
    nextStatus: "finalizado",
    priorityLevel: 5,
  },
  {
    eventType: "ocorrencia_registrada",
    label: "Ocorrência",
    nextStatus: "alerta_critico",
    priorityLevel: 95,
  },
]

export function getActionMeta(eventType: AttendanceEventType) {
  return operationalActions.find((action) => action.eventType === eventType)
}
