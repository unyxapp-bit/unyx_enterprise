import { useMemo, useState } from "react"
import { ChevronDown, ClipboardList, PieChart as PieChartIcon } from "lucide-react"
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"

import { PageHeader } from "@/components/shared/PageHeader"
import { StateBlock } from "@/components/shared/StateBlock"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useAllAuditLogs, useBranches } from "@/hooks/useUnyxData"
import { formatDateTimeBR } from "@/lib/format"
import { useAppStore } from "@/store/useAppStore"

const AUDIT_COLORS = [
  "#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6",
  "#14b8a6", "#f97316", "#ec4899", "#0ea5e9", "#84cc16",
  "#6366f1", "#a855f7", "#f43f5e", "#06b6d4", "#eab308",
]

const filterClass =
  "h-8 rounded-lg border bg-white px-2.5 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"

const actionLabels: Record<string, string> = {
  // Onboarding
  bootstrap_first_access: "Primeiro acesso",
  complete_onboarding: "Configuracao inicial",
  // Colaboradores
  create_employee: "Cadastro de colaborador",
  update_employee: "Edicao de colaborador",
  deactivate_employee: "Desativacao de colaborador",
  activate_employee: "Reativacao de colaborador",
  delete_employee: "Exclusao de colaborador",
  import_employees: "Importacao de colaboradores",
  // Escalas
  create_schedule: "Criacao de escala",
  update_schedule: "Edicao de escala",
  delete_schedule: "Exclusao de escala",
  delete_schedules_bulk: "Exclusao em lote de escalas",
  import_schedules: "Importacao de escalas",
  copy_schedules: "Copia de escalas",
  // Eventos operacionais
  record_event: "Registro de evento operacional",
  entrada_confirmada: "Entrada confirmada",
  atraso_detectado: "Atraso detectado",
  falta_detectada: "Falta detectada",
  intervalo_solicitado: "Intervalo solicitado",
  intervalo_iniciado: "Intervalo iniciado",
  retorno_confirmado: "Retorno confirmado",
  saida_confirmada: "Saida confirmada",
  ocorrencia_registrada: "Ocorrencia registrada",
  // Alocacao
  operational_post_created: "Criacao de posto operacional",
  operational_post_updated: "Atualizacao de posto operacional",
  post_allocated: "Alocacao de posto",
  post_allocation_transferred: "Transferencia de alocacao",
  post_allocation_finalized: "Finalizacao de alocacao",
  // Caixa / sangria
  sangria_confirmada: "Sangria confirmada",
  abertura_caixa: "Abertura de caixa",
  fechamento_caixa: "Fechamento de caixa",
  troco_reforco: "Reforco de troco",
  troca_caixa_confirmada: "Troca de caixa confirmada",
  // Filiais e setores
  create_branch: "Criacao de filial",
  update_branch: "Edicao de filial",
  toggle_branch: "Ativacao / desativacao de filial",
  create_sector: "Criacao de setor",
  update_sector: "Edicao de setor",
  toggle_sector: "Ativacao / desativacao de setor",
  product_catalog_imported: "Importacao de catalogo PDV",
  product_category_deleted: "Exclusao de categoria PDV",
  product_category_deleted_with_products: "Exclusao de categoria e produtos PDV",
  // Configuracoes
  update_settings: "Atualizacao de configuracoes",
  update_organization: "Atualizacao da empresa",
  organization_plan_updated: "Atualizacao de plano",
  // Comunicados
  create_post: "Publicacao de comunicado",
  update_post: "Edicao de comunicado",
  delete_post: "Exclusao de comunicado",
  // Usuarios
  invite_user: "Convite de usuario",
  cancel_invitation: "Cancelamento de convite",
  update_user_role: "Alteracao de permissao",
  current_user_profile_updated: "Atualizacao de perfil",
  set_user_active: "Ativacao / desativacao de usuario",
  set_user_branch: "Alteracao de filial do usuario",
  remove_user: "Remocao de usuario",
}

const entityLabels: Record<string, string> = {
  employee: "Colaborador",
  employees: "Colaborador",
  schedule: "Escala",
  schedules: "Escala",
  branch: "Filial",
  branches: "Filial",
  sector: "Setor",
  sectors: "Setor",
  attendance_event: "Evento de presenca",
  attendance_events: "Evento de presenca",
  operational_setting: "Configuracao operacional",
  operational_settings: "Configuracao operacional",
  operational_posts: "Posto operacional",
  post_allocations: "Alocacao de posto",
  cash_movements: "Movimento de caixa",
  comms_post: "Comunicado",
  comms_posts: "Comunicado",
  user: "Usuario",
  user_profiles: "Perfil de usuario",
  organization: "Empresa",
  organizations: "Empresa",
  invitation: "Convite",
  invitations: "Convite",
}

function labelFor(map: Record<string, string>, key: string) {
  if (map[key]) return map[key]
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

export function AuditPage() {
  const logs = useAllAuditLogs()
  const branches = useBranches()
  const selectedBranchId = useAppStore((state) => state.selectedBranchId)
  const [dateFilter, setDateFilter] = useState("")
  const [actionFilter, setActionFilter] = useState("")
  const [branchFilter, setBranchFilter] = useState(selectedBranchId ?? "")
  const [tableOpen, setTableOpen] = useState(false)

  const actionOptions = useMemo(() => {
    const actions = new Set((logs.data ?? []).map((l) => l.action))
    return Array.from(actions).sort()
  }, [logs.data])

  const filteredLogs = useMemo(() => {
    let list = logs.data ?? []
    if (branchFilter) list = list.filter((l) => l.branch_id === branchFilter)
    if (actionFilter) list = list.filter((l) => l.action === actionFilter)
    if (dateFilter) {
      list = list.filter((l) => l.created_at.startsWith(dateFilter))
    }
    return list
  }, [logs.data, branchFilter, actionFilter, dateFilter])

  const actionChartData = useMemo(() => {
    const map = new Map<string, number>()
    for (const log of filteredLogs) {
      const label = labelFor(actionLabels, log.action)
      map.set(label, (map.get(label) ?? 0) + 1)
    }
    return Array.from(map.entries())
      .map(([label, total]) => ({ label, total }))
      .sort((a, b) => b.total - a.total)
  }, [filteredLogs])

  return (
    <>
      <PageHeader
        title="Histórico de Auditoria"
        description="Trilha completa de ações realizadas no sistema."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="w-40"
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              placeholder="Filtrar data"
            />
            {actionOptions.length > 0 ? (
              <select
                className={filterClass}
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
              >
                <option value="">Todas as ações</option>
                {actionOptions.map((a) => (
                  <option key={a} value={a}>
                    {labelFor(actionLabels, a)}
                  </option>
                ))}
              </select>
            ) : null}
            <select
              className={filterClass}
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
            >
              <option value="">Todas as filiais</option>
              {(branches.data ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        }
      />

      <div className="space-y-6 p-6">
        {actionChartData.length > 0 ? (
          <Card className="border bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChartIcon className="size-5" />
                Distribuição por ação
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                <div className="relative mx-auto h-52 w-52 shrink-0 sm:mx-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={actionChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={62}
                        outerRadius={96}
                        paddingAngle={2}
                        dataKey="total"
                        strokeWidth={0}
                      >
                        {actionChartData.map((entry, index) => (
                          <Cell
                            key={entry.label}
                            fill={AUDIT_COLORS[index % AUDIT_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value, _name, props) => [
                          value,
                          (props.payload as { label?: string } | undefined)?.label ?? "",
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold leading-none">
                      {filteredLogs.length}
                    </span>
                    <span className="mt-1 text-xs text-muted-foreground">registros</span>
                  </div>
                </div>
                <div className="flex max-h-52 flex-1 flex-col gap-2 overflow-y-auto">
                  {actionChartData.map((entry, index) => (
                    <div
                      key={entry.label}
                      className="flex items-center justify-between gap-2"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: AUDIT_COLORS[index % AUDIT_COLORS.length] }}
                        />
                        <span className="truncate text-sm text-slate-700">{entry.label}</span>
                      </div>
                      <span className="text-sm font-semibold tabular-nums">{entry.total}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card className="border bg-white shadow-sm">
          <CardHeader
            className="cursor-pointer select-none"
            onClick={() => setTableOpen((v) => !v)}
          >
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="size-5" />
              <span className="flex-1">{filteredLogs.length} registro(s)</span>
              <ChevronDown className={`size-4 text-muted-foreground transition-transform duration-200 ${tableOpen ? "rotate-180" : ""}`} />
            </CardTitle>
          </CardHeader>
          {tableOpen ? <CardContent>
            {logs.isLoading ? (
              <StateBlock type="loading" title="Carregando auditoria" />
            ) : logs.isError ? (
              <StateBlock
                type="error"
                title="Erro ao carregar auditoria"
                description={logs.error.message}
              />
            ) : filteredLogs.length === 0 ? (
              <StateBlock
                title="Nenhum registro encontrado"
                description="Ajuste os filtros de data, ação ou filial."
              />
            ) : (
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-slate-50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Data / Hora</th>
                      <th className="px-4 py-3">Ação</th>
                      <th className="px-4 py-3">Entidade</th>
                      <th className="px-4 py-3">Usuário</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatDateTimeBR(log.created_at)}
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {labelFor(actionLabels, log.action)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {labelFor(entityLabels, log.entity_type)}
                        </td>
                        <td className="px-4 py-3">
                          {log.user_profiles?.name ?? (log.user_id ? "—" : "Sistema")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent> : null}
        </Card>
      </div>
    </>
  )
}
