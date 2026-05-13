import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom"

import { AppLayout } from "@/app/layout/AppLayout"
import { useAuth } from "@/app/providers/auth-context"
import { StateBlock } from "@/components/shared/StateBlock"
import { canAccessUser, type PermissionKey } from "@/lib/permissions"
import { AlertsPage } from "@/features/alerts/AlertsPage"
import { AccessChoicePage } from "@/features/auth/AccessChoicePage"
import { AcademyPage } from "@/features/academy/AcademyPage"
import { AiPage } from "@/features/ai/AiPage"
import { AuditPage } from "@/features/audit/AuditPage"
import { BranchesPage } from "@/features/branches/BranchesPage"
import { ChecklistsPage } from "@/features/checklists/ChecklistsPage"
import { CommsPage } from "@/features/comms/CommsPage"
import { CustomersPage } from "@/features/customers/CustomersPage"
import { DashboardPage } from "@/features/dashboard/DashboardPage"
import { DeliveriesPage } from "@/features/deliveries/DeliveriesPage"
import { EmployeesPage } from "@/features/employees/EmployeesPage"
import { OperationalFormsPage } from "@/features/frontstore/OperationalFormsPage"
import { OperationalNotesPage } from "@/features/frontstore/OperationalNotesPage"
import { OperationalPostersPage } from "@/features/frontstore/OperationalPostersPage"
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
import { FiscalDocumentsPage } from "@/features/pos/FiscalDocumentsPage"
import { PosSellPage } from "@/features/pos/PosSellPage"
import { PosSalesPage } from "@/features/pos/PosSalesPage"
import { ProductionOrdersPage } from "@/features/pos/ProductionOrdersPage"

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

function RequirePermission({ perm }: { perm: PermissionKey }) {
  const { profile } = useAuth()
  if (!profile || !canAccessUser(profile, perm)) {
    return <Navigate to="/app" replace />
  }
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
          <Route path="/access" element={<AccessChoicePage />} />
          <Route path="/app" element={<AppLayout />}>
            <Route index element={<DashboardPage />} />

            <Route element={<RequirePermission perm="operations" />}>
              <Route path="operations" element={<OperationsPage />} />
            </Route>
            <Route element={<RequirePermission perm="alerts" />}>
              <Route path="alerts" element={<AlertsPage />} />
            </Route>
            <Route element={<RequirePermission perm="schedules" />}>
              <Route path="schedules" element={<SchedulesPage />} />
            </Route>
            <Route element={<RequirePermission perm="checklists" />}>
              <Route path="checklists" element={<ChecklistsPage />} />
            </Route>
            <Route element={<RequirePermission perm="front_notes" />}>
              <Route path="notes" element={<OperationalNotesPage />} />
            </Route>
            <Route element={<RequirePermission perm="front_forms" />}>
              <Route path="forms" element={<OperationalFormsPage />} />
            </Route>
            <Route element={<RequirePermission perm="front_posters" />}>
              <Route path="posters" element={<OperationalPostersPage />} />
            </Route>

            <Route element={<RequirePermission perm="branches" />}>
              <Route path="branches" element={<BranchesPage />} />
            </Route>
            <Route element={<RequirePermission perm="employees" />}>
              <Route path="employees" element={<EmployeesPage />} />
            </Route>
            <Route element={<RequirePermission perm="customers" />}>
              <Route path="customers" element={<CustomersPage />} />
            </Route>
            <Route element={<RequirePermission perm="users" />}>
              <Route path="users" element={<UsersPage />} />
            </Route>
            <Route element={<RequirePermission perm="settings" />}>
              <Route path="settings" element={<SettingsPage />} />
            </Route>

            <Route element={<RequirePermission perm="pos_sell" />}>
              <Route path="pos/sell" element={<PosSellPage />} />
            </Route>
            <Route element={<RequirePermission perm="pos_cash" />}>
              <Route path="pos/cash" element={<PosCashPage />} />
            </Route>
            <Route element={<RequirePermission perm="pos_products" />}>
              <Route path="pos/products" element={<PosProductsPage />} />
            </Route>
            <Route element={<RequirePermission perm="pos_sales" />}>
              <Route path="pos/sales" element={<PosSalesPage />} />
            </Route>
            <Route element={<RequirePermission perm="production_orders" />}>
              <Route path="pos/production" element={<ProductionOrdersPage />} />
            </Route>
            <Route element={<RequirePermission perm="fiscal_documents" />}>
              <Route path="pos/fiscal" element={<FiscalDocumentsPage />} />
            </Route>
            <Route element={<RequirePermission perm="deliveries" />}>
              <Route path="deliveries" element={<DeliveriesPage />} />
            </Route>

            <Route element={<RequirePermission perm="reports" />}>
              <Route path="reports" element={<ReportsPage />} />
            </Route>
            <Route element={<RequirePermission perm="audit" />}>
              <Route path="audit" element={<AuditPage />} />
            </Route>

            <Route element={<RequirePermission perm="comms" />}>
              <Route path="comms" element={<CommsPage />} />
            </Route>
            <Route element={<RequirePermission perm="game" />}>
              <Route path="game" element={<GamePage />} />
            </Route>
            <Route element={<RequirePermission perm="academy" />}>
              <Route path="academy" element={<AcademyPage />} />
            </Route>
            <Route element={<RequirePermission perm="ai" />}>
              <Route path="ai" element={<AiPage />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
