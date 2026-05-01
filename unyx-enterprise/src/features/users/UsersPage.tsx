import { useMemo, useState } from "react"
import {
  Check,
  Copy,
  Link,
  Search,
  Shield,
  UserCog,
} from "lucide-react"

import { useAuth } from "@/app/providers/auth-context"
import { PageHeader } from "@/components/shared/PageHeader"
import { StateBlock } from "@/components/shared/StateBlock"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useUpdateUserRole, useUserProfiles } from "@/hooks/useUnyxData"
import { formatDateBR } from "@/lib/format"
import type { UserProfile, UserRole } from "@/types/domain"

const roleLabel: Record<UserRole, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  branch_manager: "Gerente de filial",
  supervisor: "Supervisor",
  operator: "Operador",
  employee: "Colaborador",
}

const roleDescription: Record<UserRole, string> = {
  owner: "Acesso total. Gerencia organização, usuários, assinatura e todas as configurações.",
  admin: "Acesso amplo. Gerencia filiais, colaboradores, escalas e relatórios. Sem acesso à assinatura.",
  branch_manager: "Gerencia a operação, escalas e equipe de uma filial específica.",
  supervisor: "Acompanha o painel operacional, registra eventos e visualiza relatórios.",
  operator: "Registra eventos e executa ações no painel operacional. Acesso restrito.",
  employee: "Acesso mínimo. Visualiza comunicados e informações próprias.",
}

const roleBadgeClass: Record<UserRole, string> = {
  owner: "border-violet-200 bg-violet-50 text-violet-700",
  admin: "border-blue-200 bg-blue-50 text-blue-700",
  branch_manager: "border-sky-200 bg-sky-50 text-sky-700",
  supervisor: "border-teal-200 bg-teal-50 text-teal-700",
  operator: "border-slate-200 bg-slate-100 text-slate-700",
  employee: "border-zinc-200 bg-zinc-50 text-zinc-600",
}

const fieldClass =
  "h-8 w-full rounded-lg border bg-white px-2.5 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"

const filterClass =
  "h-9 rounded-lg border bg-white px-2.5 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"

function RoleDialog({
  userProfile,
  isOnlyOwner,
}: {
  userProfile: UserProfile
  isOnlyOwner: boolean
}) {
  const [open, setOpen] = useState(false)
  const [role, setRole] = useState<UserRole>(userProfile.role)
  const updateRole = useUpdateUserRole()

  function handleOpenChange(next: boolean) {
    if (!next) setRole(userProfile.role)
    setOpen(next)
  }

  async function handleSave() {
    await updateRole.mutateAsync({ profileId: userProfile.id, role })
    setOpen(false)
  }

  const ownerDemotionBlocked =
    userProfile.role === "owner" && isOnlyOwner && role !== "owner"

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserCog className="size-4" />
          Alterar papel
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Alterar papel — {userProfile.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border bg-slate-50 p-3 text-sm">
            <div className="font-medium">{userProfile.name}</div>
            <div className="mt-0.5 text-muted-foreground">{userProfile.email}</div>
            <div className="mt-1">
              <span
                className={`rounded-full border px-2 py-0.5 text-xs font-medium ${roleBadgeClass[userProfile.role]}`}
              >
                {roleLabel[userProfile.role]} atual
              </span>
            </div>
          </div>

          <label className="space-y-1 text-sm">
            <span className="font-medium">Novo papel</span>
            <select
              className={fieldClass}
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
            >
              {Object.entries(roleLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-800">
            {roleDescription[role]}
          </div>

          {ownerDemotionBlocked ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              Nao e possivel remover o unico proprietario da organizacao. Promova outro usuario a Proprietario antes de alterar este papel.
            </div>
          ) : null}

          {updateRole.error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {updateRole.error.message}
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            onClick={() => void handleSave()}
            disabled={updateRole.isPending || ownerDemotionBlocked || role === userProfile.role}
          >
            {updateRole.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function InvitePanel() {
  const [copied, setCopied] = useState(false)
  const inviteLink = `${window.location.origin}/`

  function handleCopy() {
    void navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <Card className="border bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link className="size-5" />
          Convidar usuario
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Compartilhe o link abaixo com o novo usuario. Apos o primeiro acesso, ele sera redirecionado para o onboarding e aparecera aqui para voce atribuir o papel correto.
        </p>
        <div className="flex items-center gap-2">
          <Input
            readOnly
            value={inviteLink}
            className="font-mono text-xs text-muted-foreground"
          />
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
            {copied ? "Copiado" : "Copiar"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          O novo usuario cria sua conta no link acima. Apos o cadastro, atribua o papel adequado nesta pagina.
        </p>
      </CardContent>
    </Card>
  )
}

export function UsersPage() {
  const { profile: currentProfile } = useAuth()
  const profiles = useUserProfiles()
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState<UserRole | "">("")

  const ownerCount = useMemo(
    () => (profiles.data ?? []).filter((p) => p.role === "owner").length,
    [profiles.data]
  )

  const filteredProfiles = useMemo(() => {
    let list = profiles.data ?? []
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q)
      )
    }
    if (roleFilter) list = list.filter((p) => p.role === roleFilter)
    return list
  }, [profiles.data, search, roleFilter])

  return (
    <>
      <PageHeader
        title="Usuários e Permissões"
        description="Gerencie os perfis e papéis dos usuários da organização."
      />

      <div className="space-y-6 p-6">
        <Card className="border bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="size-5" />
              Usuários da organização
            </CardTitle>
          </CardHeader>
          <CardContent>
            {profiles.isLoading ? (
              <StateBlock type="loading" title="Carregando usuários" />
            ) : profiles.isError ? (
              <StateBlock
                type="error"
                title="Erro ao carregar usuários"
                description={profiles.error.message}
              />
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-48 flex-1">
                    <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-8"
                      placeholder="Buscar por nome ou email..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <select
                    className={filterClass}
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value as UserRole | "")}
                  >
                    <option value="">Todos os papéis</option>
                    {Object.entries(roleLabel).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                {filteredProfiles.length === 0 ? (
                  <StateBlock
                    title={
                      (profiles.data ?? []).length === 0
                        ? "Nenhum usuário encontrado"
                        : "Nenhum resultado para os filtros"
                    }
                    description={
                      (profiles.data ?? []).length === 0
                        ? undefined
                        : "Ajuste a busca ou o filtro de papel."
                    }
                  />
                ) : (
                  <div className="overflow-hidden rounded-lg border">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b bg-slate-50 text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3">Nome</th>
                          <th className="px-4 py-3">Email</th>
                          <th className="px-4 py-3">Filial</th>
                          <th className="px-4 py-3">Papel</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Desde</th>
                          <th className="px-4 py-3 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {filteredProfiles.map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-medium">
                              <div className="flex items-center gap-2">
                                {p.name}
                                {p.id === currentProfile?.id ? (
                                  <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
                                    Você
                                  </span>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {p.email}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {p.branches?.name ?? "—"}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`rounded-full border px-2 py-0.5 text-xs font-medium ${roleBadgeClass[p.role]}`}
                              >
                                {roleLabel[p.role]}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                                  p.active
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                    : "border-zinc-200 bg-zinc-50 text-zinc-600"
                                }`}
                              >
                                {p.active ? "Ativo" : "Inativo"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {formatDateBR(p.created_at)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {p.id !== currentProfile?.id ? (
                                <RoleDialog
                                  userProfile={p}
                                  isOnlyOwner={ownerCount === 1 && p.role === "owner"}
                                />
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  Seu perfil
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <InvitePanel />
      </div>
    </>
  )
}
