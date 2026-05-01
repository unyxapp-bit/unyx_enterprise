import {
  Activity,
  Building2,
  CalendarDays,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Users,
} from "lucide-react"
import { NavLink, Outlet } from "react-router-dom"

import { useAuth } from "@/app/providers/auth-context"
import { BranchSelector } from "@/components/shared/BranchSelector"
import { StateBlock } from "@/components/shared/StateBlock"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/store/useAppStore"

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/employees", label: "Colaboradores", icon: Users },
  { to: "/schedules", label: "Escalas", icon: CalendarDays },
  { to: "/operations", label: "Operação", icon: Activity },
  { to: "/branches", label: "Filiais", icon: Building2 },
  { to: "/settings", label: "Configurações", icon: Settings },
]

export function AppLayout() {
  const { profile, profileLoading, signOut } = useAuth()
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
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-2xl">
          <StateBlock
            type="error"
            title="Perfil não encontrado"
            description="A sessão existe no Supabase Auth, mas ainda não há um registro correspondente em user_profiles."
          />
          <Button className="mt-4" variant="outline" onClick={() => void signOut()}>
            Sair
          </Button>
        </div>
      </main>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-72 border-r bg-white transition-transform lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center border-b px-5">
          <div>
            <div className="text-lg font-semibold tracking-tight">Unyx Ops</div>
            <div className="text-xs text-muted-foreground">Operational Intelligence</div>
          </div>
        </div>
        <nav className="space-y-1 px-3 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
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
              <div className="text-xs text-muted-foreground">{profile.role}</div>
            </div>
            <Button variant="outline" size="icon" onClick={() => void signOut()} aria-label="Sair">
              <LogOut className="size-4" />
            </Button>
          </div>
        </header>
        <Outlet />
      </div>
    </div>
  )
}
