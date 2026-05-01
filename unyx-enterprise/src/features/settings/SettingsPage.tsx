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
  useOrganization,
  useSubscription,
  useUpdateOrganization,
} from "@/hooks/useUnyxData"
import {
  coreModules,
  getCoreModulePlanAccess,
  type CoreModuleKey,
} from "@/lib/coreModules"
import { formatDateTimeBR } from "@/lib/format"
import { useAppStore } from "@/store/useAppStore"
import type { BusinessSegment, Organization, UserRole } from "@/types/domain"

const fieldClass =
  "h-8 w-full rounded-lg border bg-white px-2.5 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"

const roleLabel: Record<UserRole, string> = {
  owner: "Proprietário",
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
  pharmacy: "Farmácia",
  other: "Outro",
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
          <span className="font-medium">Razão social</span>
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
        {updateOrganization.isPending ? "Salvando..." : "Salvar alterações"}
      </Button>
    </form>
  )
}

function OperationalSettings() {
  const branches = useBranches()
  const delayTolerance = useAppStore((state) => state.delayToleranceMinutes)
  const breakTolerance = useAppStore((state) => state.breakToleranceMinutes)
  const selectedBranchId = useAppStore((state) => state.selectedBranchId)
  const setDelayTolerance = useAppStore((state) => state.setDelayToleranceMinutes)
  const setBreakTolerance = useAppStore((state) => state.setBreakToleranceMinutes)
  const setSelectedBranchId = useAppStore((state) => state.setSelectedBranchId)
  const [saved, setSaved] = useState(false)

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <form className="space-y-4" onSubmit={handleSave}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Tolerância de atraso (min)</span>
          <Input
            type="number"
            min={0}
            max={60}
            value={delayTolerance}
            onChange={(e) => setDelayTolerance(Number(e.target.value))}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Tolerância de intervalo (min)</span>
          <Input
            type="number"
            min={0}
            max={60}
            value={breakTolerance}
            onChange={(e) => setBreakTolerance(Number(e.target.value))}
          />
        </label>
      </div>

      <label className="space-y-1 text-sm">
        <span className="font-medium">Filial padrão</span>
        <select
          className={fieldClass}
          value={selectedBranchId ?? ""}
          onChange={(e) => setSelectedBranchId(e.target.value || null)}
        >
          <option value="">Todas as filiais</option>
          {(branches.data ?? []).map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Filtra automaticamente todas as páginas ao acessar o sistema.
        </p>
      </label>

      <Button type="submit">
        {saved ? "Salvo!" : "Salvar configurações"}
      </Button>
    </form>
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
        title="Configurações"
        description="Dados da organização, plano, módulos e trilha básica de auditoria."
      />

      <div className="grid gap-4 p-6 xl:grid-cols-[1fr_0.85fr]">
        <div className="space-y-4">
          <Card className="border bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="size-5" />
                Organização
              </CardTitle>
            </CardHeader>
            <CardContent>
              {organization.isLoading ? (
                <StateBlock type="loading" title="Carregando organização" />
              ) : organization.isError ? (
                <StateBlock
                  type="error"
                  title="Erro ao carregar organização"
                  description={organization.error.message}
                />
              ) : organization.data ? (
                <OrganizationForm
                  key={`${organization.data.id}-${organization.data.updated_at}`}
                  organization={organization.data}
                />
              ) : (
                <StateBlock title="Organização não encontrada" />
              )}
            </CardContent>
          </Card>

          <Card className="border bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="size-5" />
                Configurações operacionais
              </CardTitle>
            </CardHeader>
            <CardContent>
              <OperationalSettings />
            </CardContent>
          </Card>

          <Card className="border bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="size-5" />
                Usuário atual
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
                Plano e módulos core
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
                <StateBlock type="loading" title="Carregando módulos" />
              ) : modules.isError ? (
                <StateBlock
                  type="error"
                  title="Erro ao carregar módulos"
                  description={modules.error.message}
                />
              ) : (
                <div className="grid gap-3">
                  {coreModules.map((module) => {
                    const isActive = activeModuleKeys.has(module.key)
                    const planAccess = getCoreModulePlanAccess(
                      module.key as CoreModuleKey,
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
                <StateBlock title="Nenhuma ação auditada" />
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
