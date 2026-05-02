import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom"

import { AppLayout } from "@/app/layout/AppLayout"
import { useAuth } from "@/app/providers/auth-context"
import { StateBlock } from "@/components/shared/StateBlock"
import { AlertsPage } from "@/features/alerts/AlertsPage"
import { AcademyPage } from "@/features/academy/AcademyPage"
import { AiPage } from "@/features/ai/AiPage"
import { AllocationPage } from "@/features/allocation/AllocationPage"
import { AuditPage } from "@/features/audit/AuditPage"
import { BranchesPage } from "@/features/branches/BranchesPage"
import { CommsPage } from "@/features/comms/CommsPage"
import { DashboardPage } from "@/features/dashboard/DashboardPage"
import { EmployeesPage } from "@/features/employees/EmployeesPage"
import { GamePage } from "@/features/game/GamePage"
import { LoginPage } from "@/features/auth/LoginPage"
import { LandingPage } from "@/features/landing/LandingPage"
import { OperationsPage } from "@/features/operational/OperationsPage"
import { ReportsPage } from "@/features/reports/ReportsPage"
import { SchedulesPage } from "@/features/schedules/SchedulesPage"
import { SettingsPage } from "@/features/settings/SettingsPage"
import { UsersPage } from "@/features/users/UsersPage"
import { PosProductsPage } from "@/features/pos/PosProductsPage"
import { PosCashPage } from "@/features/pos/PosCashPage"
import { PosSellPage } from "@/features/pos/PosSellPage"
import { PosSalesPage } from "@/features/pos/PosSalesPage"

function ProtectedRoute() {
  const { loading, session } = useAuth()

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <StateBlock type="loading" title="Iniciando plataforma" />
      </main>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  return <Outlet />
}

export function AppRouter() {
  const basename =
    import.meta.env.BASE_URL === "/"
      ? undefined
      : import.meta.env.BASE_URL.replace(/\/$/, "")

  return (
    <BrowserRouter basename={basename}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/app" element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="alerts" element={<AlertsPage />} />
            <Route path="employees" element={<EmployeesPage />} />
            <Route path="schedules" element={<SchedulesPage />} />
            <Route path="operations" element={<OperationsPage />} />
            <Route path="allocation" element={<AllocationPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="audit" element={<AuditPage />} />
            <Route path="branches" element={<BranchesPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="comms" element={<CommsPage />} />
            <Route path="game" element={<GamePage />} />
            <Route path="academy" element={<AcademyPage />} />
            <Route path="ai" element={<AiPage />} />
            <Route path="pos/products" element={<PosProductsPage />} />
            <Route path="pos/cash" element={<PosCashPage />} />
            <Route path="pos/sell" element={<PosSellPage />} />
            <Route path="pos/sales" element={<PosSalesPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
