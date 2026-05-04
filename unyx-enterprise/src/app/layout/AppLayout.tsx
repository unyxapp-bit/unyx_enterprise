import {
  Activity,
  BarChart2,
  BellRing,
  Building2,
  CalendarDays,
  Coffee,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  MapPinned,
  Menu,
  MessageSquareText,
  Package,
  ReceiptText,
  Settings,
  ShoppingCart,
  Sparkles,
  Trophy,
  UserCog,
  Users,
  Wallet,
} from "lucide-react"
import { NavLink, Outlet } from "react-router-dom"

import { useAuth } from "@/app/providers/auth-context"
import { BranchSelector } from "@/components/shared/BranchSelector"
import { StateBlock } from "@/components/shared/StateBlock"
import { Button } from "@/components/ui/button"
import { OnboardingPage } from "@/features/onboarding/OnboardingPage"
import { useOperationalStatuses, useOrganization } from "@/hooks/useUnyxData"
import { canAccessUser, type PermissionKey } from "@/lib/permissions"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/store/useAppStore"
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
    summary: "Mostra o agora",
    items: [
      { to: "/app",            label: "Dashboard", icon: LayoutDashboard, perm: "dashboard"  as PermissionKey },
      { to: "/app/operations", label: "Operacao",  icon: Activity,        perm: "operations" as PermissionKey },
      { to: "/app/alerts",     label: "Alertas",   icon: BellRing,        perm: "alerts"     as PermissionKey },
      { to: "/app/schedules",  label: "Escalas",   icon: CalendarDays,    perm: "schedules"  as PermissionKey },
    ],
  },
  {
    label: "Unyx Control",
    summary: "Organiza a empresa",
    items: [
      { to: "/app/branches",  label: "Filiais",        icon: Building2, perm: "branches"  as PermissionKey },
      { to: "/app/employees", label: "Colaboradores",  icon: Users,     perm: "employees" as PermissionKey },
      { to: "/app/users",     label: "Usuarios",       icon: UserCog,   perm: "users"     as PermissionKey },
      { to: "/app/settings",  label: "Configuracoes",  icon: Settings,  perm: "settings"  as PermissionKey },
    ],
  },
  {
    label: "Unyx Allocation",
    summary: "Cobre postos e PDVs",
    items: [
      { to: "/app/allocation", label: "Alocacao",       icon: MapPinned, perm: "allocation" as PermissionKey },
      { to: "/app/intervals", label: "Intervalo / Cafe", icon: Coffee,    perm: "intervals"  as PermissionKey },
    ],
  },
  {
    label: "Unyx POS",
    summary: "Venda e controle de caixa",
    items: [
      { to: "/app/pos/sell",     label: "PDV — Venda", icon: ShoppingCart, perm: "pos_sell"     as PermissionKey },
      { to: "/app/pos/cash",     label: "Caixa",       icon: Wallet,       perm: "pos_cash"     as PermissionKey },
      { to: "/app/pos/products", label: "Produtos",    icon: Package,      perm: "pos_products" as PermissionKey },
      { to: "/app/pos/sales",    label: "Historico",   icon: ReceiptText,  perm: "pos_sales"    as PermissionKey },
    ],
  },
  {
    label: "Unyx Insight",
    summary: "Explica o que aconteceu",
    items: [
      { to: "/app/reports", label: "Relatorios", icon: BarChart2,    perm: "reports" as PermissionKey },
      { to: "/app/audit",   label: "Auditoria",  icon: ClipboardList, perm: "audit"  as PermissionKey },
    ],
  },
  {
    label: "Expansao",
    summary: "Aumenta engajamento",
    items: [
      { to: "/app/comms",   label: "Comms",   icon: MessageSquareText, perm: "comms"   as PermissionKey },
      { to: "/app/game",    label: "Game",    icon: Trophy,            perm: "game"    as PermissionKey },
      { to: "/app/academy", label: "Academy", icon: GraduationCap,     perm: "academy" as PermissionKey },
      { to: "/app/ai",      label: "AI",      icon: Sparkles,          perm: "ai"      as PermissionKey },
    ],
  },
]

export function AppLayout() {
  const { profile, profileLoading, signOut } = useAuth()
  const { data: organization } = useOrganization()
  const sidebarOpen = useAppStore((state) => state.sidebarOpen)
  const setSidebarOpen = useAppStore((state) => state.setSidebarOpen)
  const { data: opStatuses } = useOperationalStatuses()
  const criticalCount = (opStatuses ?? []).filter(
    (s) => s.current_status === "alerta_critico"
  ).length

  if (profileLoading) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <StateBlock type="loading" title="Carregando perfil" />
      </main>
    )
  }

  if (!profile) {
    return <OnboardingPage />
  }

  const orgDisplayName =
    organization?.trade_name ?? organization?.name ?? "Unyx Enterprise"

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex h-dvh w-72 flex-col overflow-hidden border-r bg-white transition-transform lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 shrink-0 items-center border-b px-5">
          <div className="min-w-0">
            <div className="text-lg font-semibold tracking-tight">
              Unyx Enterprise
            </div>
            <div
              className="truncate text-xs text-muted-foreground"
              title={orgDisplayName}
            >
              {orgDisplayName}
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto overscroll-contain px-3 py-4 pb-6">
          {navGroups.map((group) => {
            const visibleItems = group.items.filter((item) =>
              canAccessUser(profile, item.perm)
            )
            if (visibleItems.length === 0) return null
            return (
              <div key={group.label} className="space-y-1">
                <div className="px-3 pb-1">
                  <div className="text-[0.68rem] font-semibold uppercase tracking-wide text-slate-400">
                    {group.label}
                  </div>
                  <div className="text-[0.7rem] text-muted-foreground">
                    {group.summary}
                  </div>
                </div>
                {visibleItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/app"}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-slate-950 text-white"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                      )
                    }
                  >
                    <item.icon className="size-4" />
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
      </aside>

      {sidebarOpen ? (
        <button
          className="fixed inset-0 z-30 bg-black/20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Fechar menu"
        />
      ) : null}

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-3 border-b bg-slate-50/95 px-4 backdrop-blur lg:px-6">
          <div className="flex items-center gap-3">
            <Button
              className="lg:hidden"
              variant="outline"
              size="icon"
              onClick={() => setSidebarOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu className="size-4" />
            </Button>
            <BranchSelector />
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium">{profile.name}</div>
              <div className="text-xs text-muted-foreground">
                {roleLabel[profile.role]}
              </div>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => void signOut()}
              aria-label="Sair"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </header>
        <Outlet />
      </div>
    </div>
  )
}
