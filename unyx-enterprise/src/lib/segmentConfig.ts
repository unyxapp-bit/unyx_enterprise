import type { BusinessSegment, OperationalPostType } from "@/types/domain"

export const SEGMENT_LABELS: Record<BusinessSegment, string> = {
  supermarket:  "Supermercado",
  retail_store: "Varejo / Atacado",
  restaurant:   "Restaurante",
  pharmacy:     "Farmacia",
  other:        "Outro",
}

// Tipos de posto ordenados por relevancia por segmento
export const SEGMENT_POST_TYPES: Record<BusinessSegment, OperationalPostType[]> = {
  supermarket: [
    "cashier", "self_checkout", "service_desk", "counter",
    "stock", "delivery", "reception", "kitchen", "other",
  ],
  retail_store: [
    "cashier", "service_desk", "counter", "stock",
    "delivery", "reception", "self_checkout", "kitchen", "other",
  ],
  restaurant: [
    "kitchen", "counter", "service_desk", "cashier",
    "delivery", "reception", "stock", "self_checkout", "other",
  ],
  pharmacy: [
    "counter", "cashier", "service_desk", "stock",
    "delivery", "reception", "self_checkout", "kitchen", "other",
  ],
  other: [
    "cashier", "self_checkout", "counter", "service_desk",
    "delivery", "stock", "kitchen", "reception", "other",
  ],
}

// Setores sugeridos por segmento
export const SEGMENT_DEFAULT_SECTORS: Record<BusinessSegment, string[]> = {
  supermarket: [
    "Frente de Caixa",
    "Self-checkout",
    "Atendimento",
    "Reposicao",
    "Estoque",
    "Padaria",
    "Acougue",
    "Hortifruti",
    "Fiscalizacao",
    "Delivery / Retirada",
  ],
  retail_store: [
    "Vendas",
    "Reposicao",
    "Estoque",
    "Expedicao",
    "Recebimento",
    "Atendimento",
    "Caixa / PDV",
    "Fiscalizacao",
    "Conferencia",
  ],
  restaurant: [
    "Cozinha",
    "Salao",
    "Caixa",
    "Delivery",
    "Atendimento",
    "Limpeza",
    "Estoque",
    "Bar / Copa",
  ],
  pharmacy: [
    "Balcao",
    "Caixa",
    "Atendimento",
    "Farmaceutico Responsavel",
    "Estoque",
    "Perfumaria",
    "Delivery / Retirada",
  ],
  other: ["Atendimento", "Caixa", "Estoque", "Operacoes"],
}

export interface SegmentDefaultPost {
  name: string
  type: OperationalPostType
  sector_name: string
}

// Postos padrao por segmento (idempotente — so cria se nao existir)
export const SEGMENT_DEFAULT_POSTS: Record<BusinessSegment, SegmentDefaultPost[]> = {
  supermarket: [
    { name: "Caixa 01",          type: "cashier",      sector_name: "Frente de Caixa" },
    { name: "Caixa 02",          type: "cashier",      sector_name: "Frente de Caixa" },
    { name: "Caixa 03",          type: "cashier",      sector_name: "Frente de Caixa" },
    { name: "Self-checkout 01",  type: "self_checkout", sector_name: "Self-checkout" },
    { name: "Self-checkout 02",  type: "self_checkout", sector_name: "Self-checkout" },
    { name: "Atendimento",       type: "service_desk", sector_name: "Atendimento" },
    { name: "Fiscalizacao",      type: "counter",      sector_name: "Fiscalizacao" },
    { name: "Delivery / Retirada", type: "delivery",   sector_name: "Delivery / Retirada" },
  ],
  retail_store: [
    { name: "Caixa 01",     type: "cashier",      sector_name: "Caixa / PDV" },
    { name: "Caixa 02",     type: "cashier",      sector_name: "Caixa / PDV" },
    { name: "Atendimento",  type: "service_desk", sector_name: "Atendimento" },
    { name: "Estoque",      type: "stock",        sector_name: "Estoque" },
    { name: "Expedicao",    type: "delivery",     sector_name: "Expedicao" },
    { name: "Fiscalizacao", type: "counter",      sector_name: "Fiscalizacao" },
  ],
  restaurant: [
    { name: "Caixa",              type: "cashier",      sector_name: "Caixa" },
    { name: "Cozinha Principal",  type: "kitchen",      sector_name: "Cozinha" },
    { name: "Atendimento Salao",  type: "counter",      sector_name: "Salao" },
    { name: "Delivery",           type: "delivery",     sector_name: "Delivery" },
    { name: "Bar / Copa",         type: "reception",    sector_name: "Bar / Copa" },
  ],
  pharmacy: [
    { name: "Balcao 01",                   type: "counter",      sector_name: "Balcao" },
    { name: "Balcao 02",                   type: "counter",      sector_name: "Balcao" },
    { name: "Caixa",                       type: "cashier",      sector_name: "Caixa" },
    { name: "Farmaceutico Responsavel",    type: "service_desk", sector_name: "Farmaceutico Responsavel" },
    { name: "Atendimento",                 type: "service_desk", sector_name: "Atendimento" },
    { name: "Delivery / Retirada",         type: "delivery",     sector_name: "Delivery / Retirada" },
  ],
  other: [
    { name: "Caixa 01",    type: "cashier",      sector_name: "Caixa" },
    { name: "Atendimento", type: "service_desk", sector_name: "Atendimento" },
    { name: "Estoque",     type: "stock",        sector_name: "Estoque" },
  ],
}

export interface SegmentPanelAlert {
  label: string
  description: string
  severity: "critical" | "warning" | "info"
  priorityMin: number
}

// Alertas do painel por segmento, em ordem de prioridade
export const SEGMENT_PANEL_ALERTS: Record<BusinessSegment, SegmentPanelAlert[]> = {
  supermarket: [
    { label: "Caixa sem operador",  description: "PDV aguardando alocacao",                    severity: "critical", priorityMin: 100 },
    { label: "Operador atrasado",   description: "Atraso na entrada do turno",                 severity: "critical", priorityMin: 90  },
    { label: "Sangria pendente",    description: "Aguardando confirmacao de sangria",           severity: "warning",  priorityMin: 70  },
    { label: "Intervalo vencido",   description: "Colaborador em intervalo acima do tolerado", severity: "warning",  priorityMin: 50  },
    { label: "Troca pendente",      description: "Aguardando troca de operador",               severity: "info",     priorityMin: 30  },
  ],
  retail_store: [
    { label: "Setor sem equipe",         description: "Area operacional descoberta",          severity: "critical", priorityMin: 100 },
    { label: "Falta confirmada",         description: "Colaborador ausente",                  severity: "critical", priorityMin: 90  },
    { label: "Equipe abaixo do minimo",  description: "Setor com pessoal insuficiente",      severity: "warning",  priorityMin: 70  },
    { label: "Atraso grave",             description: "Atraso acima do tolerado",             severity: "warning",  priorityMin: 50  },
    { label: "Demanda acumulada",        description: "Acumulo de tarefas ou clientes",       severity: "info",     priorityMin: 30  },
  ],
  restaurant: [
    { label: "Equipe minima incompleta", description: "Turno com pessoal insuficiente",           severity: "critical", priorityMin: 110 },
    { label: "Ausencia em pico",         description: "Falta durante horario de pico",             severity: "critical", priorityMin: 100 },
    { label: "Funcao critica vazia",     description: "Cozinheiro ou atendente ausente",           severity: "critical", priorityMin: 95  },
    { label: "Atraso no turno",          description: "Entrada com atraso no turno",               severity: "warning",  priorityMin: 80  },
    { label: "Intervalo em pico",        description: "Intervalo solicitado em horario de pico",   severity: "warning",  priorityMin: 60  },
  ],
  pharmacy: [
    { label: "Responsavel ausente",      description: "Farmaceutico responsavel nao esta presente", severity: "critical", priorityMin: 110 },
    { label: "Responsavel atrasado",     description: "Farmaceutico com atraso na entrada",          severity: "critical", priorityMin: 100 },
    { label: "Atendimento descoberto",   description: "Balcao sem atendente",                        severity: "critical", priorityMin: 95  },
    { label: "Falta confirmada",         description: "Colaborador ausente",                         severity: "warning",  priorityMin: 90  },
    { label: "Atraso grave",             description: "Atraso acima do limite permitido",            severity: "warning",  priorityMin: 80  },
  ],
  other: [
    { label: "Posto sem cobertura", description: "Posto operacional sem colaborador", severity: "critical", priorityMin: 100 },
    { label: "Falta confirmada",    description: "Colaborador ausente",               severity: "warning",  priorityMin: 90  },
    { label: "Atraso detectado",    description: "Atraso na entrada",                 severity: "warning",  priorityMin: 80  },
  ],
}
