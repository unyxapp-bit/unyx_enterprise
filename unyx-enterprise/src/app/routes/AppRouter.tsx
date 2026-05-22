import { lazy, Suspense } from "react"
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom"

import { AppLayout } from "@/app/layout/AppLayout"
import { useAuth } from "@/app/providers/auth-context"
import { StateBlock } from "@/components/shared/StateBlock"
import { canAccessUser, type PermissionKey } from "@/lib/permissions"

const AccessChoicePage = lazy(() =>
  import("@/features/auth/AccessChoicePage").then((m) => ({ default: m.AccessChoicePage }))
)
const AcademyPage = lazy(() =>
  import("@/features/academy/AcademyPage").then((m) => ({ default: m.AcademyPage }))
)
const AiPage = lazy(() =>
  import("@/features/ai/AiPage").then((m) => ({ default: m.AiPage }))
)
const AlertsPage = lazy(() =>
  import("@/features/alerts/AlertsPage").then((m) => ({ default: m.AlertsPage }))
)
const AllocationPage = lazy(() =>
  import("@/features/allocation/AllocationPage").then((m) => ({ default: m.AllocationPage }))
)
const AuditPage = lazy(() =>
  import("@/features/audit/AuditPage").then((m) => ({ default: m.AuditPage }))
)
const BranchesPage = lazy(() =>
  import("@/features/branches/BranchesPage").then((m) => ({ default: m.BranchesPage }))
)
const BreakRoomPage = lazy(() =>
  import("@/features/allocation/BreakRoomPage").then((m) => ({ default: m.BreakRoomPage }))
)
const ChecklistsPage = lazy(() =>
  import("@/features/checklists/ChecklistsPage").then((m) => ({ default: m.ChecklistsPage }))
)
const CommsPage = lazy(() =>
  import("@/features/comms/CommsPage").then((m) => ({ default: m.CommsPage }))
)
const CustomersPage = lazy(() =>
  import("@/features/customers/CustomersPage").then((m) => ({ default: m.CustomersPage }))
)
const DashboardPage = lazy(() =>
  import("@/features/dashboard/DashboardPage").then((m) => ({ default: m.DashboardPage }))
)
const DeliveriesPage = lazy(() =>
  import("@/features/deliveries/DeliveriesPage").then((m) => ({ default: m.DeliveriesPage }))
)
const EmployeesPage = lazy(() =>
  import("@/features/employees/EmployeesPage").then((m) => ({ default: m.EmployeesPage }))
)
const FiscalDocumentsPage = lazy(() =>
  import("@/features/pos/FiscalDocumentsPage").then((m) => ({ default: m.FiscalDocumentsPage }))
)
const GamePage = lazy(() =>
  import("@/features/game/GamePage").then((m) => ({ default: m.GamePage }))
)
const LandingPage = lazy(() =>
  import("@/features/landing/LandingPage").then((m) => ({ default: m.LandingPage }))
)
const LoginPage = lazy(() =>
  import("@/features/auth/LoginPage").then((m) => ({ default: m.LoginPage }))
)
const OperationalFormsPage = lazy(() =>
  import("@/features/frontstore/OperationalFormsPage").then((m) => ({ default: m.OperationalFormsPage }))
)
const OperationalNotesPage = lazy(() =>
  import("@/features/frontstore/OperationalNotesPage").then((m) => ({ default: m.OperationalNotesPage }))
)
const OperationsPage = lazy(() =>
  import("@/features/operational/OperationsPage").then((m) => ({ default: m.OperationsPage }))
)
const PosCashPage = lazy(() =>
  import("@/features/pos/PosCashPage").then((m) => ({ default: m.PosCashPage }))
)
const PosProductsPage = lazy(() =>
  import("@/features/pos/PosProductsPage").then((m) => ({ default: m.PosProductsPage }))
)
const PosterEditorPage = lazy(() =>
  import("@/features/pos/PosterEditorPage").then((m) => ({ default: m.PosterEditorPage }))
)
const PosSalesPage = lazy(() =>
  import("@/features/pos/PosSalesPage").then((m) => ({ default: m.PosSalesPage }))
)
const PosSellPage = lazy(() =>
  import("@/features/pos/PosSellPage").then((m) => ({ default: m.PosSellPage }))
)
const ProductionOrdersPage = lazy(() =>
  import("@/features/pos/ProductionOrdersPage").then((m) => ({ default: m.ProductionOrdersPage }))
)
const ReportsPage = lazy(() =>
  import("@/features/reports/ReportsPage").then((m) => ({ default: m.ReportsPage }))
)
const SchedulesPage = lazy(() =>
  import("@/features/schedules/SchedulesPage").then((m) => ({ default: m.SchedulesPage }))
)
const SettingsPage = lazy(() =>
  import("@/features/settings/SettingsPage").then((m) => ({ default: m.SettingsPage }))
)
const UsersPage = lazy(() =>
  import("@/features/users/UsersPage").then((m) => ({ default: m.UsersPage }))
)

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

function RouteFallback() {
  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <StateBlock type="loading" title="Carregando modulo" />
    </main>
  )
}

export function AppRouter() {
  const basename =
    import.meta.env.BASE_URL === "/"
      ? undefined
      : import.meta.env.BASE_URL.replace(/\/$/, "")

  return (
    <BrowserRouter basename={basename}>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/access" element={<AccessChoicePage />} />
            <Route path="/app" element={<AppLayout />}>
              <Route index element={<DashboardPage />} />

            <Route element={<RequirePermission perm="operations" />}>
              <Route path="operations" element={<OperationsPage />} />
              <Route path="allocation" element={<AllocationPage />} />
              <Route path="break-room" element={<BreakRoomPage />} />
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
            <Route element={<RequirePermission perm="pos_posters" />}>
              <Route path="pos/posters" element={<PosterEditorPage />} />
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
      </Suspense>
    </BrowserRouter>
  )
}
