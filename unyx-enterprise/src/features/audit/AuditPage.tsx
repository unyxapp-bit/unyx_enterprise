import { useMemo, useState } from "react"
import { ClipboardList } from "lucide-react"

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

const filterClass =
  "h-8 rounded-lg border bg-white px-2.5 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"

const actionLabels: Record<string, string> = {
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
  record_event: "Registro de evento operacional",
  create_branch: "Criacao de filial",
  update_branch: "Edicao de filial",
  create_sector: "Criacao de setor",
  update_sector: "Edicao de setor",
  update_settings: "Atualizacao de configuracoes",
  create_post: "Publicacao de comunicado",
  update_post: "Edicao de comunicado",
  delete_post: "Exclusao de comunicado",
  invite_user: "Convite de usuario",
  update_user_role: "Alteracao de perfil de usuario",
}

const entityLabels: Record<string, string> = {
  employee: "Colaborador",
  schedule: "Escala",
  branch: "Filial",
  sector: "Setor",
  attendance_event: "Evento de presenca",
  operational_setting: "Configuracao operacional",
  comms_post: "Comunicado",
  user: "Usuario",
  organization: "Organizacao",
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

      <div className="p-6">
        <Card className="border bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="size-5" />
              {filteredLogs.length} registro(s)
            </CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      </div>
    </>
  )
}
