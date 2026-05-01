import { useState } from "react"
import type { FormEvent } from "react"
import { Building, ClipboardList, CreditCard, Settings2, Shield } from "lucide-react"

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
  useAuditLogs,
  useBranches,
  useModules,
  useOperationalSettings,
  useOrganization,
  useSaveOperationalSettings,
  useSubscription,
  useUpdateOrganization,
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
import { useAppStore } from "@/store/useAppStore"
import type {
  Branch,
  BusinessSegment,
  OperationalSettings,
  Organization,
  UserRole,
} from "@/types/domain"

const fieldClass =
  "h-8 w-full rounded-lg border bg-white px-2.5 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"

type OperationalSettingsFormValues = {
  mode: OperationalMode
} & ReturnType<typeof getOperationalModeDefaults>

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

function OrganizationForm({ organization }: { organization: Organization }) {
  const updateOrganization = useUpdateOrganization()
  const [form, setForm] = useState({
    name: organization.name,
    trade_name: organization.trade_name ?? "",
    document: organization.document ?? "",
    segment: organization.segment,
  })

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await updateOrganization.mutateAsync({
      name: form.name.trim(),
      trade_name: form.trade_name.trim() || null,
      document: form.document.trim() || null,
      segment: form.segment,
    })
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Razao social</span>
          <Input
            value={form.name}
            onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Nome fantasia</span>
          <Input
            value={form.trade_name}
            onChange={(e) => setForm((c) => ({ ...c, trade_name: e.target.value }))}
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Documento</span>
          <Input
            value={form.document}
            onChange={(e) => setForm((c) => ({ ...c, document: e.target.value }))}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Segmento</span>
          <select
            className={fieldClass}
            value={form.segment}
            onChange={(e) =>
              setForm((c) => ({ ...c, segment: e.target.value as BusinessSegment }))
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

      {updateOrganization.error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {updateOrganization.error.message}
        </div>
      ) : null}

      <Button type="submit" disabled={updateOrganization.isPending}>
        {updateOrganization.isPending ? "Salvando..." : "Salvar alteracoes"}
      </Button>
    </form>
  )
}

function OperationalSettingsEditor({
  branches,
  initialForm,
  isLoading,
  selectedBranchId,
  setSelectedBranchId,
}: {
  branches: Branch[]
  initialForm: OperationalSettingsFormValues
  isLoading: boolean
  selectedBranchId: string | null
  setSelectedBranchId: (branchId: string | null) => void
}) {
  const saveSettings = useSaveOperationalSettings()
  const [form, setForm] = useState(initialForm)

  function handleModeChange(mode: OperationalMode) {
    setForm({
      mode,
      ...getOperationalModeDefaults(mode),
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await saveSettings.mutateAsync({
      branch_id: selectedBranchId,
      ...form,
    })
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <label className="space-y-1 text-sm">
        <span className="font-medium">Filial de trabalho</span>
        <select
          className={fieldClass}
          value={selectedBranchId ?? ""}
          onChange={(e) => setSelectedBranchId(e.target.value || null)}
        >
          <option value="">Padrao da organizacao</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Sem filial selecionada, esta configuracao vale para toda a empresa.
        </p>
      </label>

      <label className="space-y-1 text-sm">
        <span className="font-medium">Modo operacional</span>
        <select
          className={fieldClass}
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

      <Button type="submit" disabled={saveSettings.isPending}>
        {saveSettings.isPending ? "Salvando..." : "Salvar modo operacional"}
      </Button>
    </form>
  )
}

function OperationalSettingsForm({
  organization,
}: {
  organization: Organization | null | undefined
}) {
  const branches = useBranches()
  const selectedBranchId = useAppStore((state) => state.selectedBranchId)
  const setSelectedBranchId = useAppStore((state) => state.setSelectedBranchId)
  const settings = useOperationalSettings(selectedBranchId)
  const initialForm = buildOperationalSettingsForm(organization, settings.data)
  const editorKey = [
    selectedBranchId ?? "organization",
    settings.data?.updated_at ?? organization?.updated_at ?? initialForm.mode,
  ].join(":")

  return (
    <OperationalSettingsEditor
      key={editorKey}
      branches={branches.data ?? []}
      initialForm={initialForm}
      isLoading={settings.isLoading}
      selectedBranchId={selectedBranchId}
      setSelectedBranchId={setSelectedBranchId}
    />
  )
}

export function SettingsPage() {
  const { profile } = useAuth()
  const organization = useOrganization()
  const modules = useModules()
  const subscription = useSubscription()
  const auditLogs = useAuditLogs()
  const currentPlan = subscription.data?.plan ?? organization.data?.plan ?? "starter"
  const activeModuleKeys = new Set((modules.data ?? []).map((module) => module.key))

  return (
    <>
      <PageHeader
        title="Configuracoes"
        description="Dados da organizacao, plano, modulos, modos operacionais e auditoria."
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
                Modos operacionais
              </CardTitle>
            </CardHeader>
            <CardContent>
              <OperationalSettingsForm organization={organization.data} />
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
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border bg-slate-50 p-3">
                  <div className="text-xs text-muted-foreground">Nome</div>
                  <div className="mt-1 font-medium">{profile?.name}</div>
                </div>
                <div className="rounded-lg border bg-slate-50 p-3">
                  <div className="text-xs text-muted-foreground">Email</div>
                  <div className="mt-1 font-medium">{profile?.email}</div>
                </div>
                <div className="rounded-lg border bg-slate-50 p-3">
                  <div className="text-xs text-muted-foreground">Papel</div>
                  <div className="mt-1 font-medium">
                    {profile ? roleLabel[profile.role] : "-"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="border bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="size-5" />
                Plano e modulos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {subscription.isLoading ? (
                <StateBlock type="loading" title="Carregando plano" />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border bg-slate-50 p-3">
                    <div className="text-xs text-muted-foreground">Plano</div>
                    <div className="mt-1 font-medium">
                      {subscription.data?.plan ?? organization.data?.plan ?? "-"}
                    </div>
                  </div>
                  <div className="rounded-lg border bg-slate-50 p-3">
                    <div className="text-xs text-muted-foreground">Status</div>
                    <div className="mt-1 font-medium">
                      {subscription.data?.status ?? organization.data?.status ?? "-"}
                    </div>
                  </div>
                </div>
              )}

              {modules.isLoading ? (
                <StateBlock type="loading" title="Carregando modulos" />
              ) : modules.isError ? (
                <StateBlock
                  type="error"
                  title="Erro ao carregar modulos"
                  description={modules.error.message}
                />
              ) : (
                <div className="space-y-4">
                  {productModuleGroups.map((group) => (
                    <div key={group.label} className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        {group.label}
                      </div>
                      <div className="grid gap-3">
                        {group.modules.map((module) => {
                          const isActive = activeModuleKeys.has(module.key)
                          const planAccess = getProductModulePlanAccess(
                            module.key as ProductModuleKey,
                            currentPlan
                          )

                          return (
                            <div
                              key={module.key}
                              className="rounded-lg border bg-slate-50 p-3"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div>
                                  <div className="font-medium">{module.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {module.tagline}
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  <Badge variant={isActive ? "default" : "outline"}>
                                    {isActive ? "Ativo" : "Pendente"}
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
              )}
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
              ) : (auditLogs.data ?? []).length === 0 ? (
                <StateBlock title="Nenhuma acao auditada" />
              ) : (
                <div className="space-y-3">
                  {(auditLogs.data ?? []).slice(0, 10).map((log) => (
                    <div key={log.id} className="rounded-lg border bg-slate-50 p-3">
                      <div className="text-sm font-medium">{log.action}</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {log.entity_type} · {formatDateTimeBR(log.created_at)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
