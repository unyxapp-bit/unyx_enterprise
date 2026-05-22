import { useState } from "react"

import {
  Activity,
  BarChart2,
  BellRing,
  Building2,
  CalendarDays,
  ClipboardList,
  Contact,
  Coffee,
  FileText,
  GraduationCap,
  ChevronDown,
  Image as ImageIcon,
  LayoutDashboard,
  ListChecks,
  LogOut,
  MapPinned,
  Menu,
  MessageSquareText,
  Moon,
  Package,
  ReceiptText,
  Settings,
  ShoppingCart,
  Sparkles,
  StickyNote,
  Sun,
  Trophy,
  Truck,
  UserCog,
  Users,
  Wallet,
  X,
} from "lucide-react"
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom"

import { useAuth } from "@/app/providers/auth-context"
import { useTheme } from "@/app/providers/theme-context"
import { BranchSelector } from "@/components/shared/BranchSelector"
import { StateBlock } from "@/components/shared/StateBlock"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { OnboardingPage } from "@/features/onboarding/OnboardingPage"
import { useOperationalStatuses, useOrganization } from "@/hooks/useUnyxData"
import { clearAccessMode, getAccessMode, type AccessMode } from "@/lib/accessMode"
import { canAccessUser, type PermissionKey } from "@/lib/permissions"
import { cn } from "@/lib/utils"
import type { UserRole } from "@/types/domain"

const roleLabel: Record<UserRole, string> = {
  owner: "Proprietario",
  admin: "Administrador",
  branch_manager: "Gerente de filial",
  supervisor: "Supervisor",
  operator: "Operador",
  employee: "Colaborador",
}

const navGroups = [
  {
    label: "Unyx Ops",
    items: [
      { to: "/app",            label: "Dashboard", icon: LayoutDashboard, perm: "dashboard"  as PermissionKey },
      { to: "/app/operations", label: "Operacao",  icon: Activity,        perm: "operations" as PermissionKey },
      { to: "/app/allocation", label: "Postos",    icon: MapPinned,       perm: "operations" as PermissionKey },
      { to: "/app/break-room", label: "Intervalos", icon: Coffee,         perm: "operations" as PermissionKey },
      { to: "/app/alerts",     label: "Alertas",   icon: BellRing,        perm: "alerts"     as PermissionKey },
      { to: "/app/schedules",  label: "Escalas",   icon: CalendarDays,    perm: "schedules"  as PermissionKey },
      { to: "/app/checklists", label: "Checklists", icon: ListChecks,      perm: "checklists" as PermissionKey },
      { to: "/app/notes",      label: "Anotacoes", icon: StickyNote,      perm: "front_notes" as PermissionKey },
      { to: "/app/forms",      label: "Formularios", icon: FileText,      perm: "front_forms" as PermissionKey },
    ],
  },
  {
    label: "Unyx Control",
    items: [
      { to: "/app/branches",  label: "Filiais",       icon: Building2, perm: "branches"  as PermissionKey },
      { to: "/app/employees", label: "Colaboradores", icon: Users,     perm: "employees" as PermissionKey },
      { to: "/app/customers", label: "Clientes",      icon: Contact,   perm: "customers" as PermissionKey },
      { to: "/app/users",     label: "Usuarios",      icon: UserCog,   perm: "users"     as PermissionKey },
      { to: "/app/settings",  label: "Configuracoes", icon: Settings,  perm: "settings"  as PermissionKey },
    ],
  },
  {
    label: "Unyx POS",
    items: [
      { to: "/app/pos/sell",     label: "PDV — Venda", icon: ShoppingCart, perm: "pos_sell"     as PermissionKey },
      { to: "/app/pos/cash",     label: "Caixa",       icon: Wallet,       perm: "pos_cash"     as PermissionKey },
      { to: "/app/pos/products", label: "Produtos",    icon: Package,      perm: "pos_products" as PermissionKey },
      { to: "/app/pos/posters",  label: "Cartazes",    icon: ImageIcon,    perm: "pos_posters"  as PermissionKey },
      { to: "/app/pos/sales",    label: "Historico",   icon: ReceiptText,  perm: "pos_sales"    as PermissionKey },
      { to: "/app/pos/fiscal",    label: "Cupons / NFC-e", icon: ReceiptText, perm: "fiscal_documents" as PermissionKey },
      { to: "/app/deliveries",    label: "Entregas",    icon: Truck,        perm: "deliveries"   as PermissionKey },
    ],
  },
  {
    label: "Unyx Insight",
    items: [
      { to: "/app/reports", label: "Relatorios", icon: BarChart2,     perm: "reports" as PermissionKey },
      { to: "/app/audit",   label: "Auditoria",  icon: ClipboardList, perm: "audit"   as PermissionKey },
    ],
  },
  {
    label: "Expansao",
    items: [
      { to: "/app/comms",   label: "Comms",   icon: MessageSquareText, perm: "comms"   as PermissionKey },
      { to: "/app/game",    label: "Game",    icon: Trophy,            perm: "game"    as PermissionKey },
      { to: "/app/academy", label: "Academy", icon: GraduationCap,     perm: "academy" as PermissionKey },
      { to: "/app/ai",      label: "AI",      icon: Sparkles,          perm: "ai"      as PermissionKey },
    ],
  },
]

const navItemDescriptions: Record<string, string> = {
  "/app": "Visao geral da operacao e indicadores do dia.",
  "/app/operations": "Painel vivo para entradas, intervalos e alocacoes.",
  "/app/allocation": "Cadastre e organize caixas, balcoes e postos.",
  "/app/break-room": "Acompanhe pausas, cafes e retornos pendentes.",
  "/app/alerts": "Riscos operacionais e pendencias criticas.",
  "/app/schedules": "Monte, importe e confira a escala por filial.",
  "/app/checklists": "Rotinas de abertura, fechamento e verificacoes.",
  "/app/notes": "Registre comunicados e observacoes de frente.",
  "/app/forms": "Capturas operacionais padronizadas por setor.",
  "/app/branches": "Gerencie unidades, enderecos e status ativos.",
  "/app/employees": "Cadastro da equipe, cargos e setores.",
  "/app/customers": "Base de clientes e dados comerciais.",
  "/app/users": "Acessos, convites, papeis e permissoes.",
  "/app/settings": "Regras operacionais e parametros da empresa.",
  "/app/pos/sell": "Venda rapida, carrinho e finalizacao.",
  "/app/pos/cash": "Abertura, fechamento e movimentos de caixa.",
  "/app/pos/products": "Catalogo, precos e disponibilidade.",
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

const navGroupFooter: Record<string, { label: string; badge?: string; description: string }> = {
  "Unyx Ops": {
    label: "Operacao ativa",
    badge: "Live",
    description: "Controle entradas, postos e pendencias do turno no mesmo fluxo.",
  },
  "Unyx Control": {
    label: "Base administrativa",
    description: "Organize dados mestres para manter a operacao consistente.",
  },
  "Unyx POS": {
    label: "Frente de venda",
    description: "PDV, caixa, produtos e entregas conectados ao operacional.",
  },
  "Unyx Insight": {
    label: "Inteligencia",
    description: "Transforme dados operacionais em analises e auditoria.",
  },
  Expansao: {
    label: "Recursos avancados",
    badge: "Novo",
    description: "Ative modulos para comunicacao, treinamento, IA e engajamento.",
  },
}

function isPosModePath(pathname: string) {
  return pathname === "/app/pos/sell" || pathname.startsWith("/app/pos/sell/")
}

function UserAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
  return (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary)] text-xs font-semibold text-white">
      {initials}
    </div>
  )
}

export function AppLayout() {
  const { profile, profileLoading, signOut } = useAuth()
  const { resolvedTheme, toggleTheme } = useTheme()
  const { data: organization } = useOrganization()
  const { data: opStatuses } = useOperationalStatuses()
  const [accessMode, setAccessModeState] = useState<AccessMode | null>(() =>
    getAccessMode()
  )
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  const criticalCount = (opStatuses ?? []).filter(
    (s) => s.current_status === "alerta_critico"
  ).length

  if (profileLoading) {
    return (
      <main className="min-h-screen bg-background p-6">
        <StateBlock type="loading" title="Carregando perfil" />
      </main>
    )
  }

  if (!profile) {
    return <OnboardingPage />
  }

  if (!accessMode) {
    return <Navigate to="/access" replace />
  }

  if (accessMode === "pos" && !canAccessUser(profile, "pos_sell")) {
    return <Navigate to="/access" replace />
  }

  if (accessMode === "pos" && !isPosModePath(location.pathname)) {
    return <Navigate to="/app/pos/sell" replace />
  }

  const orgDisplayName =
    organization?.trade_name ?? organization?.name ?? "Unyx Enterprise"
  const visibleNavGroups =
    accessMode === "pos"
      ? navGroups
          .filter((group) => group.label === "Unyx POS")
          .map((group) => ({
            ...group,
            items: group.items.filter((item) => item.to === "/app/pos/sell"),
          }))
      : navGroups
  const accessModeLabel = accessMode === "pos" ? "Modo PDV" : "Sistema completo"

  function handleChangeAccessMode() {
    clearAccessMode()
    setAccessModeState(null)
    setMobileOpen(false)
    navigate("/access", { replace: true })
  }

  async function handleSignOut() {
    clearAccessMode()
    setAccessModeState(null)
    await signOut()
  }

  const themeLabel =
    resolvedTheme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Top nav ──────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-[var(--nav-bg)] shadow-md">
        <div className="flex h-14 items-center gap-1 px-4">

          {/* Logo */}
          <div className="flex shrink-0 items-center gap-2.5 pr-4">
            <div className="flex size-7 items-center justify-center rounded-md bg-[var(--brand-primary)]">
              <span className="text-xs font-bold text-white">U</span>
            </div>
            <div className="hidden min-w-0 sm:block">
              <div className="text-sm font-semibold leading-tight text-white">
                Unyx Enterprise
              </div>
              <div
                className="max-w-36 truncate text-[0.65rem] text-slate-400"
                title={orgDisplayName}
              >
                {orgDisplayName}
              </div>
            </div>
          </div>

          {/* Desktop nav groups */}
          <nav className="hidden flex-1 items-center gap-0.5 lg:flex">
            {visibleNavGroups.map((group) => {
              const visibleItems = group.items.filter((item) =>
                canAccessUser(profile, item.perm)
              )
              if (visibleItems.length === 0) return null

              const isGroupActive = visibleItems.some((item) =>
                item.to === "/app"
                  ? location.pathname === "/app"
                  : location.pathname.startsWith(item.to)
              )

              return (
                <DropdownMenu key={group.label}>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={cn(
                        "flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium outline-none transition-colors",
                        isGroupActive
                          ? "bg-white/10 text-white"
                          : "text-slate-400 hover:bg-white/5 hover:text-white"
                      )}
                    >
                      {group.label}
                      <ChevronDown className="size-3 opacity-60" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="center"
                    sideOffset={12}
                    className="w-[min(92vw,39rem)] overflow-hidden rounded-lg border-slate-200 bg-white p-0 shadow-xl"
                  >
                    <div className="grid gap-x-6 gap-y-1 p-6 sm:grid-cols-2">
                      {visibleItems.map((item) => {
                        const isActive =
                          item.to === "/app"
                            ? location.pathname === "/app"
                            : location.pathname.startsWith(item.to)
                        return (
                          <DropdownMenuItem
                            key={item.to}
                            onClick={() => void navigate(item.to)}
                            className={cn(
                              "flex cursor-pointer items-start gap-4 rounded-lg p-3 text-left outline-none transition-colors",
                              isActive
                                ? "bg-slate-100 text-slate-950"
                                : "text-slate-700 focus:bg-slate-50 focus:text-slate-950"
                            )}
                          >
                            <span
                              className={cn(
                                "flex size-10 shrink-0 items-center justify-center rounded-md bg-slate-50 text-slate-500",
                                isActive && "bg-white text-slate-950"
                              )}
                            >
                              <item.icon className="size-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                                {item.label}
                                {item.to === "/app/alerts" && criticalCount > 0 ? (
                                  <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                                    {criticalCount > 99 ? "99+" : criticalCount}
                                  </span>
                                ) : null}
                              </span>
                              <span className="mt-1 block text-xs leading-5 text-slate-500">
                                {navItemDescriptions[item.to]}
                              </span>
                            </span>
                          </DropdownMenuItem>
                        )
                      })}
                    </div>
                    {navGroupFooter[group.label] ? (
                      <div className="border-t bg-slate-50 px-6 py-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                          {navGroupFooter[group.label].label}
                          {navGroupFooter[group.label].badge ? (
                            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                              {navGroupFooter[group.label].badge}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {navGroupFooter[group.label].description}
                        </p>
                      </div>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              )
            })}
          </nav>

          {/* Right: BranchSelector + user + hamburger */}
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden sm:block">
              <BranchSelector />
            </div>

            <button
              type="button"
              aria-label={themeLabel}
              title={themeLabel}
              onClick={toggleTheme}
              className="inline-flex size-8 items-center justify-center rounded-md text-slate-400 outline-none transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/40"
            >
              {resolvedTheme === "dark" ? (
                <Sun className="size-4" />
              ) : (
                <Moon className="size-4" />
              )}
            </button>

            {/* User dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-md px-2 py-1.5 text-slate-400 outline-none transition-colors hover:bg-white/5 hover:text-white">
                  <UserAvatar name={profile.name} />
                  <div className="hidden min-w-0 text-left lg:block">
                    <div className="max-w-32 truncate text-sm font-medium leading-tight text-white">
                      {profile.name}
                    </div>
                    <div className="text-xs text-slate-400">{roleLabel[profile.role]}</div>
                  </div>
                  <ChevronDown className="hidden size-3 opacity-60 lg:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="min-w-44 border-slate-700 bg-slate-800 p-1"
              >
                <DropdownMenuLabel className="px-2 py-1.5 text-xs font-medium text-slate-500">
                  {accessModeLabel}
                </DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={handleChangeAccessMode}
                  className="cursor-pointer gap-2 text-slate-300 focus:bg-white/10 focus:text-white"
                >
                  {accessMode === "pos" ? (
                    <Building2 className="size-4" />
                  ) : (
                    <ShoppingCart className="size-4" />
                  )}
                  Mudar acesso
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-1 bg-slate-700" />
                <DropdownMenuItem
                  onClick={() => void handleSignOut()}
                  className="cursor-pointer gap-2 text-slate-300 focus:bg-white/10 focus:text-white"
                >
                  <LogOut className="size-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile hamburger */}
            <button
              className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu className="size-5" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile drawer ────────────────────────────────────── */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
            aria-label="Fechar menu"
          />
          <div className="absolute left-0 top-0 h-full w-72 overflow-y-auto bg-[var(--nav-bg)]">
            <div className="flex h-14 items-center justify-between px-4">
              <span className="text-sm font-semibold text-white">Unyx Enterprise</span>
              <button
                className="rounded-md p-1.5 text-slate-400 hover:text-white"
                onClick={() => setMobileOpen(false)}
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="px-4 pb-3">
              <BranchSelector />
            </div>

            <nav className="space-y-4 px-3 py-2">
              {visibleNavGroups.map((group) => {
                const visibleItems = group.items.filter((item) =>
                  canAccessUser(profile, item.perm)
                )
                if (visibleItems.length === 0) return null
                return (
                  <div key={group.label} className="space-y-0.5">
                    <div className="px-2 py-1.5 text-[0.65rem] font-semibold uppercase tracking-widest text-slate-500">
                      {group.label}
                    </div>
                    {visibleItems.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.to === "/app"}
                        onClick={() => setMobileOpen(false)}
                        className={({ isActive }) =>
                          cn(
                            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                            isActive
                              ? "bg-white/10 text-white"
                              : "text-slate-400 hover:bg-white/5 hover:text-white"
                          )
                        }
                      >
                        <item.icon className="size-4 shrink-0" />
                        <span className="flex-1">{item.label}</span>
                        {item.to === "/app/alerts" && criticalCount > 0 ? (
                          <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                            {criticalCount > 99 ? "99+" : criticalCount}
                          </span>
                        ) : null}
                      </NavLink>
                    ))}
                  </div>
                )
              })}
            </nav>

            <div className="mt-2 border-t border-slate-800 px-4 py-3">
              <div className="flex items-center gap-3">
                <UserAvatar name={profile.name} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-white">{profile.name}</div>
                  <div className="truncate text-xs text-slate-400">{roleLabel[profile.role]}</div>
                </div>
                <button
                  onClick={() => void handleSignOut()}
                  aria-label="Sair"
                  className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <LogOut className="size-4" />
                </button>
              </div>
              <button
                type="button"
                onClick={toggleTheme}
                className="mt-3 flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
              >
                {resolvedTheme === "dark" ? (
                  <Sun className="size-4" />
                ) : (
                  <Moon className="size-4" />
                )}
                {themeLabel}
              </button>
              <button
                type="button"
                onClick={handleChangeAccessMode}
                className="mt-3 flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
              >
                {accessMode === "pos" ? (
                  <Building2 className="size-4" />
                ) : (
                  <ShoppingCart className="size-4" />
                )}
                Mudar acesso
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Content ──────────────────────────────────────────── */}
      <main>
        <Outlet />
      </main>
    </div>
  )
}
