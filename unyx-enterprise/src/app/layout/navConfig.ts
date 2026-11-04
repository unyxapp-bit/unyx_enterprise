import {
  BadgePercent,
  BarChart2,
  BellRing,
  Building2,
  CalendarDays,
  ClipboardList,
  Coins,
  Contact,
  FileText,
  GraduationCap,
  Home,
  Image as ImageIcon,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  MapPinned,
  MessageSquareText,
  Package,
  ReceiptText,
  Settings,
  ShoppingCart,
  Sparkles,
  StickyNote,
  Trophy,
  Truck,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react"

import type { PermissionKey } from "@/lib/permissions"
import type { UserRole } from "@/types/domain"

export const navGroups: Array<{
  label: string
  items: Array<{ to: string; label: string; icon: LucideIcon; perm: PermissionKey | null }>
}> = [
  {
    label: "Unyx Ops",
    items: [
      { to: "/app",            label: "Inicio",    icon: Home,            perm: null },
      { to: "/app/dashboard",  label: "Dashboard", icon: LayoutDashboard, perm: "dashboard" as PermissionKey },
      { to: "/app/allocation", label: "Mapa de postos", icon: MapPinned,  perm: "operations" as PermissionKey },
      { to: "/app/alerts",     label: "Alertas",   icon: BellRing,        perm: "alerts" as PermissionKey },
      { to: "/app/schedules",  label: "Escalas",   icon: CalendarDays,    perm: "schedules" as PermissionKey },
      { to: "/app/checklists", label: "Checklists", icon: ListChecks,      perm: "checklists" as PermissionKey },
      { to: "/app/notes",      label: "Anotacoes", icon: StickyNote,      perm: "front_notes" as PermissionKey },
      { to: "/app/forms",      label: "Formularios", icon: FileText,      perm: "front_forms" as PermissionKey },
    ],
  },
  {
    label: "Unyx Control",
    items: [
      { to: "/app/branches",  label: "Filiais",       icon: Building2, perm: "branches" as PermissionKey },
      { to: "/app/employees", label: "Colaboradores", icon: Users,     perm: "employees" as PermissionKey },
      { to: "/app/customers", label: "Clientes",      icon: Contact,   perm: "customers" as PermissionKey },
      { to: "/app/users",     label: "Usuarios",      icon: UserCog,   perm: "users" as PermissionKey },
      { to: "/app/staff",     label: "Fiscais",       icon: KeyRound,  perm: "users" as PermissionKey },
      { to: "/app/settings",  label: "Configuracoes", icon: Settings,  perm: "settings" as PermissionKey },
    ],
  },
  {
    label: "Unyx POS",
    items: [
      { to: "/app/pos/sell",     label: "PDV — Venda", icon: ShoppingCart, perm: "pos_sell" as PermissionKey },
      { to: "/app/pos/cash",     label: "Caixa",       icon: Wallet,       perm: "pos_cash" as PermissionKey },
      { to: "/app/pos/products", label: "Produtos",    icon: Package,      perm: "pos_products" as PermissionKey },
      { to: "/app/pos/coins",    label: "Troca de moedas", icon: Coins,    perm: "pos_cash" as PermissionKey },
      { to: "/app/pos/discounts", label: "Descontos",  icon: BadgePercent, perm: "pos_cash" as PermissionKey },
      { to: "/app/pos/orders",    label: "Encomendas", icon: ClipboardList, perm: "pos_cash" as PermissionKey },
      { to: "/app/pos/posters",  label: "Cartazes",    icon: ImageIcon,    perm: "pos_posters" as PermissionKey },
      { to: "/app/pos/sales",    label: "Historico",   icon: ReceiptText,  perm: "pos_sales" as PermissionKey },
      { to: "/app/pos/fiscal",    label: "Cupons / NFC-e", icon: ReceiptText, perm: "fiscal_documents" as PermissionKey },
      { to: "/app/deliveries",    label: "Entregas",    icon: Truck,        perm: "deliveries" as PermissionKey },
    ],
  },
  {
    label: "Unyx Insight",
    items: [
      { to: "/app/reports", label: "Relatorios", icon: BarChart2,     perm: "reports" as PermissionKey },
      { to: "/app/audit",   label: "Auditoria",  icon: ClipboardList, perm: "audit" as PermissionKey },
    ],
  },
  {
    label: "Expansao",
    items: [
      { to: "/app/comms",   label: "Comms",   icon: MessageSquareText, perm: "comms" as PermissionKey },
      { to: "/app/game",    label: "Game",    icon: Trophy,            perm: "game" as PermissionKey },
      { to: "/app/academy", label: "Academy", icon: GraduationCap,     perm: "academy" as PermissionKey },
      { to: "/app/ai",      label: "AI",      icon: Sparkles,          perm: "ai" as PermissionKey },
    ],
  },
]

export const navItemDescriptions: Record<string, string> = {
  "/app": "Resumo do dia, pendencias e atalhos.",
  "/app/dashboard": "Operacao em tempo real: cobertura, atrasos e intervalos.",
  "/app/allocation": "Mapa de postos para ocupados, livres e inativos.",
  "/app/alerts": "Riscos operacionais e pendencias criticas.",
  "/app/schedules": "Monte, importe e confira a escala por filial.",
  "/app/checklists": "Rotinas de abertura, fechamento e verificacoes.",
  "/app/notes": "Registre comunicados e observacoes de frente.",
  "/app/forms": "Capturas operacionais padronizadas por setor.",
  "/app/branches": "Gerencie unidades, enderecos e status ativos.",
  "/app/employees": "Cadastro da equipe, cargos e setores.",
  "/app/customers": "Base de clientes e dados comerciais.",
  "/app/users": "Acessos, convites, papeis e permissoes.",
  "/app/staff": "Fiscais com acesso por codigo e senha e telas liberadas.",
  "/app/settings": "Regras operacionais e parametros da empresa.",
  "/app/pos/sell": "Venda rapida, carrinho e finalizacao.",
  "/app/pos/cash": "Abertura, fechamento e movimentos de caixa.",
  "/app/pos/products": "Catalogo, precos e disponibilidade.",
  "/app/pos/coins": "Troca de moedas com acrescimo por tipo.",
  "/app/pos/discounts": "Fichas de desconto no caixa, com calculo e impressao.",
  "/app/pos/orders": "Encomendas de clientes com retirada marcada e comprovante.",
  "/app/pos/posters": "Cartazes de oferta e avisos para loja.",
  "/app/pos/sales": "Consulta de vendas e comprovantes.",
  "/app/pos/production": "Pedidos de preparo e producao interna.",
  "/app/pos/fiscal": "Documentos fiscais e emissao vinculada.",
  "/app/deliveries": "Pedidos, despachos e acompanhamento.",
  "/app/reports": "Analises, exportacoes e leitura de desempenho.",
  "/app/audit": "Eventos, rastreabilidade e historico de acoes.",
  "/app/comms": "Comunicacao interna e alinhamento da equipe.",
  "/app/game": "Engajamento, metas e reconhecimento.",
  "/app/academy": "Treinamentos, trilhas e aprendizado.",
  "/app/ai": "Agente operacional, relatorios e sugestoes.",
}


export const roleLabel: Record<UserRole, string> = {
  owner: "Proprietario",
  admin: "Administrador",
  branch_manager: "Gerente de filial",
  supervisor: "Supervisor",
  operator: "Operador",
  employee: "Colaborador",
}

