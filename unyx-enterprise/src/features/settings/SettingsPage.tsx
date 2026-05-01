import { useState } from "react"
import type { FormEvent } from "react"
import { Building, ClipboardList, CreditCard, Shield } from "lucide-react"

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
  useModules,
  useOrganization,
  useSubscription,
  useUpdateOrganization,
} from "@/hooks/useUnyxData"
import { formatDateTimeBR } from "@/lib/format"
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
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                name: event.target.value,
              }))
            }
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Nome fantasia</span>
          <Input
            value={form.trade_name}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                trade_name: event.target.value,
              }))
            }
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Documento</span>
          <Input
            value={form.document}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                document: event.target.value,
              }))
            }
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Segmento</span>
          <select
            className={fieldClass}
            value={form.segment}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                segment: event.target.value as BusinessSegment,
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

export function SettingsPage() {
  const { profile } = useAuth()
  const organization = useOrganization()
  const modules = useModules()
  const subscription = useSubscription()
  const auditLogs = useAuditLogs()

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
                Plano e módulos
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

              {modules.isError ? (
                <StateBlock
                  type="error"
                  title="Erro ao carregar módulos"
                  description={modules.error.message}
                />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(modules.data ?? []).map((module) => (
                    <Badge key={module.id} variant="outline">
                      {module.name}
                    </Badge>
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
