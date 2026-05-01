import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom"

import { AppLayout } from "@/app/layout/AppLayout"
import { useAuth } from "@/app/providers/auth-context"
import { StateBlock } from "@/components/shared/StateBlock"
import { BranchesPage } from "@/features/branches/BranchesPage"
import { DashboardPage } from "@/features/dashboard/DashboardPage"
import { EmployeesPage } from "@/features/employees/EmployeesPage"
import { LoginPage } from "@/features/auth/LoginPage"
import { OperationsPage } from "@/features/operational/OperationsPage"
import { SchedulesPage } from "@/features/schedules/SchedulesPage"
import { SettingsPage } from "@/features/settings/SettingsPage"

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
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="/employees" element={<EmployeesPage />} />
            <Route path="/schedules" element={<SchedulesPage />} />
            <Route path="/operations" element={<OperationsPage />} />
            <Route path="/branches" element={<BranchesPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
