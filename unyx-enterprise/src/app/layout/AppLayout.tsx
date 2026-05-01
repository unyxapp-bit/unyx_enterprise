import {
  Activity,
  BarChart2,
  BellRing,
  Building2,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  UserCog,
  Users,
} from "lucide-react"
import { NavLink, Outlet } from "react-router-dom"

import { useAuth } from "@/app/providers/auth-context"
import { BranchSelector } from "@/components/shared/BranchSelector"
import { StateBlock } from "@/components/shared/StateBlock"
import { Button } from "@/components/ui/button"
import { OnboardingPage } from "@/features/onboarding/OnboardingPage"
import { useOrganization } from "@/hooks/useUnyxData"
import { cn } from "@/lib/utils"
import type { UserRole } from "@/types/domain"
import { useAppStore } from "@/store/useAppStore"

const roleLabel: Record<UserRole, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  branch_manager: "Gerente de filial",
  supervisor: "Supervisor",
  operator: "Operador",
  employee: "Colaborador",
}

const navItems = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/alerts", label: "Alertas", icon: BellRing },
  { to: "/app/employees", label: "Colaboradores", icon: Users },
  { to: "/app/schedules", label: "Escalas", icon: CalendarDays },
  { to: "/app/operations", label: "Operação", icon: Activity },
  { to: "/app/branches", label: "Filiais", icon: Building2 },
  { to: "/app/reports", label: "Relatórios", icon: BarChart2 },
  { to: "/app/audit", label: "Auditoria", icon: ClipboardList },
  { to: "/app/users", label: "Usuários", icon: UserCog },
  { to: "/app/settings", label: "Configurações", icon: Settings },
]

export function AppLayout() {
  const { profile, profileLoading, signOut } = useAuth()
  const { data: organization } = useOrganization()
  const sidebarOpen = useAppStore((state) => state.sidebarOpen)
  const setSidebarOpen = useAppStore((state) => state.setSidebarOpen)

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
    organization?.trade_name ?? organization?.name ?? "Unyx Ops"

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-72 border-r bg-white transition-transform lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center border-b px-5">
          <div className="min-w-0">
            <div className="text-lg font-semibold tracking-tight">Unyx Ops</div>
            <div
              className="truncate text-xs text-muted-foreground"
              title={orgDisplayName}
            >
              {orgDisplayName}
            </div>
          </div>
        </div>
        <nav className="space-y-1 px-3 py-4">
          {navItems.map((item) => (
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
              {item.label}
            </NavLink>
          ))}
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
