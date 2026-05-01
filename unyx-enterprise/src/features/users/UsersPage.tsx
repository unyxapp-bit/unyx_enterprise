import { useState } from "react"
import { Shield, UserCog } from "lucide-react"

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
} from "@/components/ui/dialog"
import { useUpdateUserRole, useUserProfiles } from "@/hooks/useUnyxData"
import type { UserProfile, UserRole } from "@/types/domain"

const roleLabel: Record<UserRole, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  branch_manager: "Gerente de filial",
  supervisor: "Supervisor",
  operator: "Operador",
  employee: "Colaborador",
}

const fieldClass =
  "h-8 w-full rounded-lg border bg-white px-2.5 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"

function RoleDialog({ userProfile }: { userProfile: UserProfile }) {
  const [open, setOpen] = useState(false)
  const [role, setRole] = useState<UserRole>(userProfile.role)
  const updateRole = useUpdateUserRole()

  async function handleSave() {
    await updateRole.mutateAsync({ profileId: userProfile.id, role })
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <UserCog className="size-4" />
        Alterar papel
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Alterar papel — {userProfile.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border bg-slate-50 p-3 text-sm">
            <div className="font-medium">{userProfile.name}</div>
            <div className="mt-1 text-muted-foreground">{userProfile.email}</div>
          </div>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Papel</span>
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
          {updateRole.error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {updateRole.error.message}
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button onClick={() => void handleSave()} disabled={updateRole.isPending}>
            {updateRole.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function UsersPage() {
  const { profile: currentProfile } = useAuth()
  const profiles = useUserProfiles()

  return (
    <>
      <PageHeader
        title="Usuários e Permissões"
        description="Gerencie os perfis e papéis dos usuários da organização."
      />

      <div className="p-6">
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
            ) : (profiles.data ?? []).length === 0 ? (
              <StateBlock title="Nenhum usuário encontrado" />
            ) : (
              <div className="space-y-4">
                <div className="overflow-hidden rounded-lg border">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b bg-slate-50 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Nome</th>
                        <th className="px-4 py-3">Email</th>
                        <th className="px-4 py-3">Papel</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(profiles.data ?? []).map((p) => (
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
                          <td className="px-4 py-3">{roleLabel[p.role]}</td>
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
                          <td className="px-4 py-3 text-right">
                            {p.id !== currentProfile?.id ? (
                              <RoleDialog userProfile={p} />
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

                <div className="rounded-lg border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-800">
                  Novos usuários podem acessar o sistema via link de convite. Entre em
                  contato com o suporte Unyx para configurar convites da organização.
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
