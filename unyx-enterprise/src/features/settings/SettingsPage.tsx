import { useMemo, useState } from "react"
import type { FormEvent } from "react"
import {
  AlertTriangle,
  Building,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Gauge,
  KeyRound,
  Lock,
  RotateCcw,
  Settings2,
  Shield,
  User,
} from "lucide-react"

import { useAuth } from "@/app/providers/auth-context"
import { PageHeader } from "@/components/shared/PageHeader"
import { StateBlock } from "@/components/shared/StateBlock"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  useAllAuditLogs,
  useAllEmployees,
  useBranches,
  useOperationalSettings,
  useOrganization,
  useOrganizationModules,
  useSaveOperationalSettings,
  useSubscription,
  useUpdateCurrentUserPassword,
  useUpdateCurrentUserProfile,
  useUpdateOrganization,
  useUpdateOrganizationPlan,
} from "@/hooks/useUnyxData"
import {
  getOperationalMode,
  getOperationalModeDefaults,
  operationalModeDescriptions,
  operationalModeNames,
  type OperationalMode,
} from "@/features/ops/modes/operationalModes"
import {
  getProductModulePlanAccess,
  productModuleGroups,
  type ProductModuleKey,
} from "@/lib/coreModules"
import { formatDateTimeBR } from "@/lib/format"
import type {
  AuditLog,
  Branch,
  BusinessSegment,
  EmployeeWithRelations,
  OperationalSettings,
  Organization,
  OrganizationModule,
  Subscription,
  SubscriptionPlan,
  UserProfile,
  UserRole,
} from "@/types/domain"

const fieldClass =
  "h-8 w-full rounded-lg border bg-white px-2.5 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"

type OperationalSettingsFormValues = {
  mode: OperationalMode
} & ReturnType<typeof getOperationalModeDefaults>

const adminRoles: UserRole[] = ["owner", "admin"]

const roleLabel: Record<UserRole, string> = {
  owner: "Proprietario",
  admin: "Administrador",
  branch_manager: "Gerente de filial",
  supervisor: "Supervisor",
  operator: "Operador",
  employee: "Colaborador",
}

const segmentLabel: Record<BusinessSegment, string> = {
  retail_store: "Loja de varejo",
  supermarket: "Supermercado",
  restaurant: "Restaurante",
  pharmacy: "Farmacia",
  other: "Outro",
}

const planLabel: Record<SubscriptionPlan, string> = {
  starter: "Starter",
  growth: "Growth",
  enterprise: "Enterprise",
}

function canManageSettings(profile: UserProfile | null) {
  return Boolean(profile && adminRoles.includes(profile.role))
}

function usagePercent(current: number, limit: number) {
  if (!limit || limit <= 0) return 0
  return Math.min(100, Math.round((current / limit) * 100))
}

function buildOperationalSettingsForm(
  organization: Organization | null | undefined,
  settings: OperationalSettings | null | undefined
): OperationalSettingsFormValues {
  const mode = getOperationalMode(settings?.mode ?? organization?.segment)
  const defaults = getOperationalModeDefaults(mode)

  return {
    mode,
    late_tolerance_minutes:
      settings?.late_tolerance_minutes ?? defaults.late_tolerance_minutes,
    break_tolerance_minutes:
      settings?.break_tolerance_minutes ?? defaults.break_tolerance_minutes,
    require_cashier_cash_count:
      settings?.require_cashier_cash_count ?? defaults.require_cashier_cash_count,
    require_coverage_before_break:
      settings?.require_coverage_before_break ??
      defaults.require_coverage_before_break,
    block_break_on_peak_hours:
      settings?.block_break_on_peak_hours ?? defaults.block_break_on_peak_hours,
    require_responsible_presence:
      settings?.require_responsible_presence ??
      defaults.require_responsible_presence,
  }
}

function PermissionNotice({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <span>{text}</span>
    </div>
  )
}

function OrganizationForm({
  disabled,
  organization,
}: {
  disabled: boolean
  organization: Organization
}) {
  const updateOrganization = useUpdateOrganization()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: organization.name,
    trade_name: organization.trade_name ?? "",
    document: organization.document ?? "",
    segment: organization.segment,
  })

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (disabled) return
    if (!form.name.trim()) {
      setError("Informe a razao social da organizacao.")
      return
    }

    await updateOrganization.mutateAsync({
      name: form.name.trim(),
      trade_name: form.trade_name.trim() || null,
      document: form.document.trim() || null,
      segment: form.segment,
    })
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {disabled ? (
        <PermissionNotice text="Somente proprietarios e administradores podem editar dados da organizacao." />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Razao social</span>
          <Input
            disabled={disabled}
            value={form.name}
            onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Nome fantasia</span>
          <Input
            disabled={disabled}
            value={form.trade_name}
            onChange={(e) =>
              setForm((current) => ({ ...current, trade_name: e.target.value }))
            }
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Documento</span>
          <Input
            disabled={disabled}
            value={form.document}
            onChange={(e) =>
              setForm((current) => ({ ...current, document: e.target.value }))
            }
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Segmento</span>
          <select
            className={fieldClass}
            disabled={disabled}
            value={form.segment}
            onChange={(e) =>
              setForm((current) => ({
                ...current,
                segment: e.target.value as BusinessSegment,
              }))
            }
          >
            {Object.entries(segmentLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error || updateOrganization.error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error ?? updateOrganization.error?.message}
        </div>
      ) : null}

      <Button type="submit" disabled={disabled || updateOrganization.isPending}>
        {updateOrganization.isPending ? "Salvando..." : "Salvar organizacao"}
      </Button>
    </form>
  )
}

function OperationalSettingsEditor({
  branches,
  disabled,
  initialForm,
  isLoading,
  selectedBranchId,
  selectedSettings,
  setSelectedBranchId,
}: {
  branches: Branch[]
  disabled: boolean
  initialForm: OperationalSettingsFormValues
  isLoading: boolean
  selectedBranchId: string | null
  selectedSettings: OperationalSettings | null | undefined
  setSelectedBranchId: (branchId: string | null) => void
}) {
  const saveSettings = useSaveOperationalSettings()
  const [form, setForm] = useState(initialForm)
  const inheritedFromOrganization =
    Boolean(selectedBranchId) && selectedSettings?.branch_id !== selectedBranchId

  function handleModeChange(mode: OperationalMode) {
    setForm({
      mode,
      ...getOperationalModeDefaults(mode),
    })
  }

  function handleResetDefaults() {
    setForm({
      mode: form.mode,
      ...getOperationalModeDefaults(form.mode),
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (disabled) return

    await saveSettings.mutateAsync({
      branch_id: selectedBranchId,
      ...form,
    })
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {disabled ? (
        <PermissionNotice text="Somente proprietarios e administradores podem alterar modos e regras operacionais." />
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">
          {selectedBranchId ? "Configuracao de filial" : "Padrao da organizacao"}
        </Badge>
        {inheritedFromOrganization ? (
          <Badge variant="secondary">Herdando padrao da organizacao</Badge>
        ) : null}
      </div>

      <label className="space-y-1 text-sm">
        <span className="font-medium">Escopo da configuracao</span>
        <select
          className={fieldClass}
          value={selectedBranchId ?? ""}
          onChange={(event) => setSelectedBranchId(event.target.value || null)}
        >
          <option value="">Padrao da organizacao</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Escolher uma filial aqui nao altera a filial selecionada no restante do app.
        </p>
      </label>

      <label className="space-y-1 text-sm">
        <span className="font-medium">Modo operacional</span>
        <select
          className={fieldClass}
          disabled={disabled}
          value={form.mode}
          onChange={(event) => handleModeChange(event.target.value as OperationalMode)}
        >
          {Object.entries(operationalModeNames).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          {operationalModeDescriptions[form.mode]}
        </p>
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Tolerancia de atraso (min)</span>
          <Input
            disabled={disabled}
            type="number"
            min={0}
            max={120}
            value={form.late_tolerance_minutes}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                late_tolerance_minutes: Number(event.target.value),
              }))
            }
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Tolerancia de intervalo (min)</span>
          <Input
            disabled={disabled}
            type="number"
            min={0}
            max={120}
            value={form.break_tolerance_minutes}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                break_tolerance_minutes: Number(event.target.value),
              }))
            }
          />
        </label>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {[
          ["require_cashier_cash_count", "Exigir sangria no caixa"],
          ["require_coverage_before_break", "Exigir cobertura antes do intervalo"],
          ["block_break_on_peak_hours", "Proteger intervalo em horario de pico"],
          ["require_responsible_presence", "Exigir responsavel presente"],
        ].map(([key, label]) => (
          <label
            key={key}
            className="flex items-center gap-2 rounded-lg border bg-slate-50 p-3 text-sm"
          >
            <input
              disabled={disabled}
              type="checkbox"
              checked={Boolean(form[key as keyof typeof form])}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  [key]: event.target.checked,
                }))
              }
            />
            {label}
          </label>
        ))}
      </div>

      {isLoading ? (
        <StateBlock type="loading" title="Carregando modo operacional" />
      ) : null}

      {saveSettings.error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {saveSettings.error.message}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={disabled || saveSettings.isPending}>
          {saveSettings.isPending ? "Salvando..." : "Salvar regras"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={handleResetDefaults}
        >
          <RotateCcw className="size-4" />
          Restaurar padrao
        </Button>
      </div>
    </form>
  )
}

function OperationalSettingsForm({
  branches,
  disabled,
  organization,
}: {
  branches: Branch[]
  disabled: boolean
  organization: Organization | null | undefined
}) {
  const [settingsBranchId, setSettingsBranchId] = useState<string | null>(null)
  const settings = useOperationalSettings(settingsBranchId)
  const initialForm = buildOperationalSettingsForm(organization, settings.data)
  const editorKey = [
    settingsBranchId ?? "organization",
    settings.data?.updated_at ?? organization?.updated_at ?? initialForm.mode,
  ].join(":")

  return (
    <OperationalSettingsEditor
      key={editorKey}
      branches={branches}
      disabled={disabled}
      initialForm={initialForm}
      isLoading={settings.isLoading}
      selectedBranchId={settingsBranchId}
      selectedSettings={settings.data}
      setSelectedBranchId={setSettingsBranchId}
    />
  )
}

function CurrentUserForm({
  branches,
  profile,
}: {
  branches: Branch[]
  profile: UserProfile
}) {
  const updateProfile = useUpdateCurrentUserProfile()
  const updatePassword = useUpdateCurrentUserPassword()
  const [profileError, setProfileError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [profileForm, setProfileForm] = useState({
    name: profile.name,
    email: profile.email,
    branch_id: profile.branch_id ?? "",
  })
  const [passwordForm, setPasswordForm] = useState({
    password: "",
    confirmation: "",
  })

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setProfileError(null)

    if (!profileForm.name.trim()) {
      setProfileError("Informe seu nome.")
      return
    }

    if (!profileForm.email.trim() || !profileForm.email.includes("@")) {
      setProfileError("Informe um email valido.")
      return
    }

    await updateProfile.mutateAsync({
      name: profileForm.name.trim(),
      email: profileForm.email.trim(),
      branch_id: profileForm.branch_id || null,
    })
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPasswordError(null)

    if (passwordForm.password.length < 6) {
      setPasswordError("A senha precisa ter pelo menos 6 caracteres.")
      return
    }

    if (passwordForm.password !== passwordForm.confirmation) {
      setPasswordError("As senhas nao conferem.")
      return
    }

    await updatePassword.mutateAsync(passwordForm.password)
    setPasswordForm({ password: "", confirmation: "" })
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-slate-50 p-3">
          <div className="text-xs text-muted-foreground">Papel</div>
          <div className="mt-1 font-medium">{roleLabel[profile.role]}</div>
        </div>
        <div className="rounded-lg border bg-slate-50 p-3">
          <div className="text-xs text-muted-foreground">Status</div>
          <div className="mt-1 font-medium">{profile.active ? "Ativo" : "Inativo"}</div>
        </div>
        <div className="rounded-lg border bg-slate-50 p-3">
          <div className="text-xs text-muted-foreground">Filial padrao</div>
          <div className="mt-1 font-medium">
            {branches.find((branch) => branch.id === profile.branch_id)?.name ??
              "Sem filial"}
          </div>
        </div>
      </div>

      <form className="space-y-4" onSubmit={handleProfileSubmit}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium">Nome</span>
            <Input
              value={profileForm.name}
              onChange={(event) =>
                setProfileForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Email</span>
            <Input
              type="email"
              value={profileForm.email}
              onChange={(event) =>
                setProfileForm((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
            />
            <p className="text-xs text-muted-foreground">
              A troca de email pode exigir confirmacao pelo Supabase Auth.
            </p>
          </label>
        </div>

        <label className="space-y-1 text-sm">
          <span className="font-medium">Filial padrao</span>
          <select
            className={fieldClass}
            value={profileForm.branch_id}
            onChange={(event) =>
              setProfileForm((current) => ({
                ...current,
                branch_id: event.target.value,
              }))
            }
          >
            <option value="">Sem filial padrao</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>

        {profileError || updateProfile.error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {profileError ?? updateProfile.error?.message}
          </div>
        ) : null}

        <Button type="submit" disabled={updateProfile.isPending}>
          <User className="size-4" />
          {updateProfile.isPending ? "Salvando..." : "Salvar meu perfil"}
        </Button>
      </form>

      <form className="space-y-4 rounded-lg border bg-slate-50 p-4" onSubmit={handlePasswordSubmit}>
        <div>
          <div className="flex items-center gap-2 font-medium">
            <Lock className="size-4" />
            Seguranca de acesso
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Atualize sua senha de login. A sessao atual continua ativa.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium">Nova senha</span>
            <Input
              type="password"
              value={passwordForm.password}
              onChange={(event) =>
                setPasswordForm((current) => ({
                  ...current,
                  password: event.target.value,
                }))
              }
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Confirmar senha</span>
            <Input
              type="password"
              value={passwordForm.confirmation}
              onChange={(event) =>
                setPasswordForm((current) => ({
                  ...current,
                  confirmation: event.target.value,
                }))
              }
            />
          </label>
        </div>

        {passwordError || updatePassword.error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {passwordError ?? updatePassword.error?.message}
          </div>
        ) : null}

        <Button type="submit" variant="outline" disabled={updatePassword.isPending}>
          <KeyRound className="size-4" />
          {updatePassword.isPending ? "Atualizando..." : "Atualizar senha"}
        </Button>
      </form>
    </div>
  )
}

function UsageItem({
  current,
  label,
  limit,
}: {
  current: number
  label: string
  limit: number | null
}) {
  const percent = limit ? usagePercent(current, limit) : 0

  return (
    <div className="rounded-lg border bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          {current}
          {limit ? ` / ${limit}` : ""}
        </span>
      </div>
      {limit ? (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
          <div
            className={`h-full rounded-full ${
              percent >= 90 ? "bg-red-500" : percent >= 75 ? "bg-amber-500" : "bg-emerald-500"
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
      ) : null}
    </div>
  )
}

function PlanModulesPanel({
  branches,
  canViewBilling,
  employees,
  modules,
  organization,
  subscription,
}: {
  branches: Branch[]
  canViewBilling: boolean
  employees: EmployeeWithRelations[]
  modules: OrganizationModule[]
  organization: Organization | null | undefined
  subscription: Subscription | null | undefined
}) {
  const currentPlan = organization?.plan ?? subscription?.plan ?? "starter"
  const moduleByKey = useMemo(() => {
    const map = new Map<string, OrganizationModule>()
    modules.forEach((module) => {
      if (module.modules?.key) map.set(module.modules.key, module)
    })
    return map
  }, [modules])

  return (
    <div className="space-y-4">
      {!canViewBilling ? (
        <PermissionNotice text="Detalhes de plano e assinatura ficam visiveis para proprietarios e administradores." />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border bg-slate-50 p-3">
          <div className="text-xs text-muted-foreground">Plano</div>
          <div className="mt-1 font-medium">{planLabel[currentPlan]}</div>
        </div>
        <div className="rounded-lg border bg-slate-50 p-3">
          <div className="text-xs text-muted-foreground">Status</div>
          <div className="mt-1 font-medium">
            {subscription?.status ?? organization?.status ?? "-"}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <UsageItem
          label="Filiais ativas"
          current={branches.filter((branch) => branch.active).length}
          limit={subscription?.max_branches ?? null}
        />
        <UsageItem
          label="Colaboradores ativos"
          current={employees.filter((employee) => employee.active).length}
          limit={subscription?.max_employees ?? null}
        />
      </div>


      <div className="space-y-4">
        {productModuleGroups.map((group) => (
          <div key={group.label} className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {group.label}
            </div>
            <div className="grid gap-3">
              {group.modules.map((module) => {
                const organizationModule = moduleByKey.get(module.key)
                const enabled = Boolean(organizationModule?.enabled)
                const planAccess = getProductModulePlanAccess(
                  module.key as ProductModuleKey,
                  currentPlan
                )
                const blocked = planAccess === "Indisponivel"

                return (
                  <div key={module.key} className="rounded-lg border bg-slate-50 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="font-medium">{module.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {module.tagline}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge
                          variant={enabled && !blocked ? "default" : "outline"}
                        >
                          {blocked ? "Bloqueado" : enabled ? "Ativo" : "Pendente"}
                        </Badge>
                        <Badge variant="outline">{planAccess}</Badge>
                      </div>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {module.description}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const auditActionLabels: Record<string, string> = {
  bootstrap_first_access: "Primeiro acesso (bootstrap)",
  create_employee: "Cadastro de colaborador",
  update_employee: "Edicao de colaborador",
  deactivate_employee: "Desativacao de colaborador",
  activate_employee: "Reativacao de colaborador",
  create_schedule: "Criacao de escala",
  update_schedule: "Edicao de escala",
  delete_schedule: "Exclusao de escala",
  import_schedules: "Importacao de escalas",
  copy_schedules: "Copia de escalas",
  schedules_imported: "Importacao de escalas",
  schedules_copied: "Copia de escalas",
  employees_imported: "Importacao de colaboradores",
  record_event: "Registro de evento operacional",
  entrada_confirmada: "Entrada confirmada",
  saida_confirmada: "Saida confirmada",
  operational_settings_updated: "Configuracoes operacionais atualizadas",
  organization_updated: "Dados da organizacao atualizados",
  organization_plan_updated: "Plano da organizacao atualizado",
  employee_updated: "Colaborador atualizado",
  create_branch: "Criacao de filial",
  update_branch: "Edicao de filial",
  create_sector: "Criacao de setor",
  create_post: "Publicacao de comunicado",
  invite_user: "Convite de usuario",
  update_user_role: "Alteracao de papel de usuario",
}

const auditEntityLabels: Record<string, string> = {
  employee: "Colaborador",
  employees: "Colaboradores",
  schedule: "Escala",
  schedules: "Escalas",
  branch: "Filial",
  sector: "Setor",
  attendance_events: "Evento de presenca",
  operational_settings: "Configuracoes operacionais",
  organizations: "Organizacao",
  comms_post: "Comunicado",
  user: "Usuario",
}

function auditLabel(map: Record<string, string>, key: string) {
  return map[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function PlanSwitcherCard({ currentPlan }: { currentPlan: SubscriptionPlan }) {
  const updatePlan = useUpdateOrganizationPlan()

  return (
    <Card className="border bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="size-5" />
          Plano de acesso
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Altere o plano para liberar todos os modulos durante os testes.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {(["starter", "growth", "enterprise"] as const).map((plan) => (
            <Button
              key={plan}
              size="sm"
              variant={currentPlan === plan ? "default" : "outline"}
              disabled={updatePlan.isPending || currentPlan === plan}
              onClick={() => updatePlan.mutate(plan)}
            >
              {planLabel[plan]}
            </Button>
          ))}
          <span className="ml-1 text-xs text-muted-foreground">
            Plano atual: <strong>{planLabel[currentPlan]}</strong>
          </span>
        </div>
        {updatePlan.error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {updatePlan.error.message}
          </div>
        ) : null}
        {updatePlan.isSuccess ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Plano atualizado com sucesso.
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function AuditSummary({ logs }: { logs: AuditLog[] }) {
  if (logs.length === 0) return <StateBlock title="Nenhuma acao auditada" />

  return (
    <div className="space-y-3">
      {logs.slice(0, 10).map((log) => (
        <div key={log.id} className="rounded-lg border bg-slate-50 p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-sm font-medium">{auditLabel(auditActionLabels, log.action)}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {auditLabel(auditEntityLabels, log.entity_type)} — {formatDateTimeBR(log.created_at)}
              </div>
            </div>
            <Badge variant="outline">
              {log.user_profiles?.name ?? (log.user_id ? "Usuario" : "Sistema")}
            </Badge>
          </div>
          <details className="mt-2 text-xs text-muted-foreground">
            <summary className="cursor-pointer">Detalhes</summary>
            <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-white p-2 text-[0.7rem]">
              {JSON.stringify(
                { antes: log.old_value, depois: log.new_value },
                null,
                2
              )}
            </pre>
          </details>
        </div>
      ))}
    </div>
  )
}

export function SettingsPage() {
  const { profile } = useAuth()
  const organization = useOrganization()
  const branches = useBranches()
  const employees = useAllEmployees()
  const organizationModules = useOrganizationModules()
  const subscription = useSubscription()
  const auditLogs = useAllAuditLogs()
  const isAdmin = canManageSettings(profile)
  const currentPlan: SubscriptionPlan = organization.data?.plan ?? "starter"

  return (
    <>
      <PageHeader
        title="Configuracoes"
        description="Dados da organizacao, perfil, plano, modulos, regras operacionais e auditoria."
      />

      <div className="grid gap-4 p-6 xl:grid-cols-[1fr_0.85fr]">
        <div className="space-y-4">
          <Card className="border bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="size-5" />
                Organizacao
              </CardTitle>
            </CardHeader>
            <CardContent>
              {organization.isLoading ? (
                <StateBlock type="loading" title="Carregando organizacao" />
              ) : organization.isError ? (
                <StateBlock
                  type="error"
                  title="Erro ao carregar organizacao"
                  description={organization.error.message}
                />
              ) : organization.data ? (
                <OrganizationForm
                  key={`${organization.data.id}-${organization.data.updated_at}`}
                  disabled={!isAdmin}
                  organization={organization.data}
                />
              ) : (
                <StateBlock title="Organizacao nao encontrada" />
              )}
            </CardContent>
          </Card>

          <Card className="border bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="size-5" />
                Regras operacionais
              </CardTitle>
            </CardHeader>
            <CardContent>
              <OperationalSettingsForm
                branches={branches.data ?? []}
                disabled={!isAdmin}
                organization={organization.data}
              />
            </CardContent>
          </Card>

          <Card className="border bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="size-5" />
                Usuario atual
              </CardTitle>
            </CardHeader>
            <CardContent>
              {profile ? (
                <CurrentUserForm branches={branches.data ?? []} profile={profile} />
              ) : (
                <StateBlock title="Perfil nao encontrado" />
              )}
            </CardContent>
          </Card>

          {profile ? <PlanSwitcherCard currentPlan={currentPlan} /> : null}
        </div>

        <div className="space-y-4">
          <Card className="border bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="size-5" />
                Plano e modulos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {branches.isLoading || employees.isLoading || organizationModules.isLoading ? (
                <StateBlock type="loading" title="Carregando plano e modulos" />
              ) : organizationModules.isError ? (
                <StateBlock
                  type="error"
                  title="Erro ao carregar modulos da organizacao"
                  description={organizationModules.error.message}
                />
              ) : subscription.isError ? (
                <StateBlock
                  type="error"
                  title="Erro ao carregar assinatura"
                  description={subscription.error.message}
                />
              ) : (
                <PlanModulesPanel
                  branches={branches.data ?? []}
                  canViewBilling={isAdmin}
                  employees={employees.data ?? []}
                  modules={organizationModules.data ?? []}
                  organization={organization.data}
                  subscription={subscription.data}
                />
              )}
            </CardContent>
          </Card>

          <Card className="border bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gauge className="size-5" />
                Saude da configuracao
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                {
                  label: "Organizacao cadastrada",
                  done: Boolean(organization.data),
                },
                {
                  label: "Filial ativa",
                  done: Boolean((branches.data ?? []).some((branch) => branch.active)),
                },
                {
                  label: "Colaboradores ativos",
                  done: Boolean((employees.data ?? []).some((employee) => employee.active)),
                },
                {
                  label: "Modulos vinculados",
                  done: Boolean((organizationModules.data ?? []).length),
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-slate-50 p-3 text-sm"
                >
                  <span>{item.label}</span>
                  {item.done ? (
                    <CheckCircle2 className="size-4 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="size-4 text-amber-600" />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="size-5" />
                Auditoria recente
              </CardTitle>
            </CardHeader>
            <CardContent>
              {auditLogs.isLoading ? (
                <StateBlock type="loading" title="Carregando auditoria" />
              ) : auditLogs.isError ? (
                <StateBlock
                  type="error"
                  title="Erro ao carregar auditoria"
                  description={auditLogs.error.message}
                />
              ) : (
                <AuditSummary logs={auditLogs.data ?? []} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
