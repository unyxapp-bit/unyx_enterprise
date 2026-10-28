import { useMemo, useState } from "react"
import { Ban, CheckCircle2, Copy, Eye, EyeOff, KeyRound, Pencil, Plus, Trash2, Wand2 } from "lucide-react"
import { toast } from "sonner"

import { useAuth } from "@/app/providers/auth-context"
import { PageHeader } from "@/components/shared/PageHeader"
import { StateBlock } from "@/components/shared/StateBlock"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import {
  isValidStaffCode,
  normalizeStaffCode,
  STAFF_CASHIER_PRESET,
  STAFF_PASSWORD_MIN,
  STAFF_PERMISSION_KEYS,
  isStaffProfile,
} from "@/features/staff/staffAccess"
import {
  useBranches,
  useCreateStaffMember,
  useRemoveStaffMember,
  useSetStaffActive,
  useSetStaffPassword,
  useStaffStoreCode,
  useUpdateStaffProfile,
  useUserProfiles,
} from "@/hooks/useUnyxData"
import { PERMISSION_GROUP, PERMISSION_LABEL, type PermissionKey } from "@/lib/permissions"
import { cn } from "@/lib/utils"
import type { UserProfile } from "@/types/domain"

const NO_BRANCH = "__none__"

/** Senha fácil de ditar: 6 dígitos. */
function generatePassword() {
  const values = new Uint32Array(1)
  crypto.getRandomValues(values)
  return String(100000 + (values[0] % 900000))
}

function PermissionPicker({
  value,
  onChange,
}: {
  value: Set<PermissionKey>
  onChange: (next: Set<PermissionKey>) => void
}) {
  const toggle = (key: PermissionKey) => {
    const next = new Set(value)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    onChange(next)
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">Telas liberadas ({value.size})</span>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => onChange(new Set(STAFF_CASHIER_PRESET))}>
            Sugestão: fiscal de caixa
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange(new Set())}>
            Limpar
          </Button>
        </div>
      </div>
      {Object.entries(PERMISSION_GROUP).map(([group, keys]) => {
        const allowed = keys.filter((key) => STAFF_PERMISSION_KEYS.includes(key))
        if (allowed.length === 0) return null
        return (
          <div key={group}>
            <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{group}</div>
            <div className="grid gap-1 sm:grid-cols-2">
              {allowed.map((key) => (
                <label
                  key={key}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm transition-colors",
                    value.has(key)
                      ? "border-[color:var(--primary)] bg-[color:var(--bg-surface-soft)]"
                      : "border-[color:var(--border-soft)]"
                  )}
                >
                  <input type="checkbox" checked={value.has(key)} onChange={() => toggle(key)} />
                  {PERMISSION_LABEL[key]}
                </label>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function PasswordField({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (value: string) => void
  label: string
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="space-y-1 text-sm">
      <label className="font-medium" htmlFor={`pw-${label}`}>
        {label}
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            id={`pw-${label}`}
            type={visible ? "text" : "password"}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={`Mínimo ${STAFF_PASSWORD_MIN} caracteres`}
            autoComplete="new-password"
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-label={visible ? "Esconder a senha" : "Mostrar a senha"}
            onClick={() => setVisible((current) => !current)}
          >
            {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        <Button
          type="button"
          variant="outline"
          title="Gerar uma senha de 6 números"
          onClick={() => {
            onChange(generatePassword())
            setVisible(true)
          }}
        >
          <Wand2 className="size-4" />
          Gerar
        </Button>
      </div>
    </div>
  )
}

function CreateStaffDialog({
  open,
  onClose,
  store,
  defaultBranchId,
}: {
  open: boolean
  onClose: () => void
  store: string | undefined
  defaultBranchId: string | null
}) {
  const branches = useBranches()
  const create = useCreateStaffMember()
  const [name, setName] = useState("")
  const [jobTitle, setJobTitle] = useState("")
  const [code, setCode] = useState("")
  const [password, setPassword] = useState("")
  const [branchId, setBranchId] = useState(defaultBranchId ?? NO_BRANCH)
  const [perms, setPerms] = useState<Set<PermissionKey>>(new Set(STAFF_CASHIER_PRESET))

  const canSave =
    name.trim().length >= 2 && isValidStaffCode(code) && password.length >= STAFF_PASSWORD_MIN && perms.size > 0

  const save = async () => {
    try {
      await create.mutateAsync({
        name,
        job_title: jobTitle,
        login_code: code,
        password,
        branch_id: branchId === NO_BRANCH ? null : branchId,
        permissions: [...perms],
      })
      onClose()
    } catch {
      // O hook já mostra o erro em toast.
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent className="flex max-h-[92vh] max-w-xl flex-col">
        <DialogHeader>
          <DialogTitle>Novo fiscal</DialogTitle>
          <DialogDescription>
            O fiscal entra só com o código da loja{store ? ` (${store})` : ""}, o código de acesso e a senha. Não
            precisa de e-mail.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 space-y-4 overflow-y-auto pr-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Nome</span>
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome do fiscal" />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Função</span>
              <Input
                value={jobTitle}
                onChange={(event) => setJobTitle(event.target.value)}
                placeholder="Ex.: Fiscal de caixa"
              />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Código de acesso</span>
              <Input
                value={code}
                onChange={(event) => setCode(normalizeStaffCode(event.target.value))}
                placeholder="Ex.: lorena01"
                autoComplete="off"
              />
              <span className="text-xs text-muted-foreground">Letras e números, sem espaços (2 a 20).</span>
            </label>
            <PasswordField value={password} onChange={setPassword} label="Senha" />
          </div>
          {branches.data && branches.data.length > 0 ? (
            <div className="space-y-1 text-sm">
              <span className="font-medium">Filial</span>
              <Select
                value={branchId}
                onValueChange={setBranchId}
                aria-label="Filial do fiscal"
                options={[
                  { value: NO_BRANCH, label: "Sem filial definida" },
                  ...branches.data.map((branch) => ({ value: branch.id, label: branch.name })),
                ]}
              />
            </div>
          ) : null}
          <PermissionPicker value={perms} onChange={setPerms} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={!canSave || create.isPending} onClick={() => void save()}>
            {create.isPending ? "Cadastrando..." : "Cadastrar fiscal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EditStaffDialog({ member, onClose }: { member: UserProfile; onClose: () => void }) {
  const branches = useBranches()
  const update = useUpdateStaffProfile()
  const [name, setName] = useState(member.name)
  const [jobTitle, setJobTitle] = useState(member.job_title ?? "")
  const [branchId, setBranchId] = useState(member.branch_id ?? NO_BRANCH)
  const [perms, setPerms] = useState<Set<PermissionKey>>(
    new Set((member.custom_permissions ?? []) as PermissionKey[])
  )
  const canSave = name.trim().length >= 2 && perms.size > 0

  const save = async () => {
    try {
      await update.mutateAsync({
        profileId: member.id,
        name,
        job_title: jobTitle,
        branch_id: branchId === NO_BRANCH ? null : branchId,
        permissions: [...perms],
      })
      onClose()
    } catch {
      // O hook já mostra o erro em toast.
    }
  }

  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent className="flex max-h-[92vh] max-w-xl flex-col">
        <DialogHeader>
          <DialogTitle>Editar {member.name}</DialogTitle>
          <DialogDescription>Código de acesso: {member.login_code}. Para trocar a senha use "Senha".</DialogDescription>
        </DialogHeader>
        <div className="flex-1 space-y-4 overflow-y-auto pr-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Nome</span>
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Função</span>
              <Input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} />
            </label>
          </div>
          {branches.data && branches.data.length > 0 ? (
            <div className="space-y-1 text-sm">
              <span className="font-medium">Filial</span>
              <Select
                value={branchId}
                onValueChange={setBranchId}
                aria-label="Filial do fiscal"
                options={[
                  { value: NO_BRANCH, label: "Sem filial definida" },
                  ...branches.data.map((branch) => ({ value: branch.id, label: branch.name })),
                ]}
              />
            </div>
          ) : null}
          <PermissionPicker value={perms} onChange={setPerms} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={!canSave || update.isPending} onClick={() => void save()}>
            {update.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PasswordDialog({ member, onClose }: { member: UserProfile; onClose: () => void }) {
  const setPassword = useSetStaffPassword()
  const [password, setPasswordValue] = useState("")
  const save = async () => {
    try {
      await setPassword.mutateAsync({ profileId: member.id, password })
      onClose()
    } catch {
      // O hook já mostra o erro em toast.
    }
  }
  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova senha de {member.name}</DialogTitle>
          <DialogDescription>A senha antiga deixa de valer na hora. Anote a nova para passar ao fiscal.</DialogDescription>
        </DialogHeader>
        <PasswordField value={password} onChange={setPasswordValue} label="Nova senha" />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={password.length < STAFF_PASSWORD_MIN || setPassword.isPending}
            onClick={() => void save()}
          >
            {setPassword.isPending ? "Salvando..." : "Trocar senha"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Fiscais da loja: o gerente cadastra nome, função, código de acesso e senha, e escolhe as telas
 * que cada um pode abrir. O fiscal entra na tela de login em "Fiscal" com o código da loja, o
 * código dele e a senha, sem e-mail.
 */
export function StaffPage() {
  const { profile } = useAuth()
  const profiles = useUserProfiles()
  const store = useStaffStoreCode()
  const setActive = useSetStaffActive()
  const remove = useRemoveStaffMember()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<UserProfile | null>(null)
  const [passwordFor, setPasswordFor] = useState<UserProfile | null>(null)

  const members = useMemo(() => (profiles.data ?? []).filter(isStaffProfile), [profiles.data])

  const copyStore = async () => {
    if (!store.data) return
    try {
      await navigator.clipboard.writeText(store.data)
      toast.success("Código da loja copiado.")
    } catch {
      toast.error("Não foi possível copiar. Anote o código mostrado na tela.")
    }
  }

  const toggleActive = (member: UserProfile) => {
    if (member.active && !window.confirm(`Bloquear o acesso de ${member.name}? Ele não conseguirá mais entrar.`)) {
      return
    }
    setActive.mutate({ profileId: member.id, active: !member.active })
  }

  const confirmRemove = (member: UserProfile) => {
    if (
      !window.confirm(
        `Remover ${member.name}? O acesso é apagado e não dá para desfazer. Para só impedir a entrada, use Bloquear.`
      )
    ) {
      return
    }
    remove.mutate(member.id)
  }

  return (
    <div>
      <PageHeader
        large
        title="Fiscais"
        description="Cadastre fiscais com código e senha e escolha as telas que cada um pode abrir."
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            Novo fiscal
          </Button>
        }
      />

      <div className="space-y-5 p-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Como o fiscal entra</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
              <li>
                Na tela de login, ele escolhe <b className="text-foreground">Fiscal</b>.
              </li>
              <li>
                Informa o <b className="text-foreground">código da loja</b>, o <b className="text-foreground">código de acesso</b> dele e a <b className="text-foreground">senha</b>.
              </li>
              <li>Só vê as telas que você liberou. Tudo o que ele registrar sai com o nome dele.</li>
            </ol>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">Código da loja:</span>
              {store.isLoading ? (
                <span className="text-muted-foreground">carregando...</span>
              ) : store.isError ? (
                <span className="text-red-600">{store.error.message}</span>
              ) : (
                <>
                  <code className="rounded-lg border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-soft)] px-2.5 py-1 text-base font-semibold tracking-wide">
                    {store.data}
                  </code>
                  <Button size="sm" variant="outline" onClick={() => void copyStore()}>
                    <Copy className="size-4" />
                    Copiar
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Fiscais cadastrados ({members.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {profiles.isLoading ? (
              <StateBlock type="loading" title="Carregando fiscais" />
            ) : profiles.isError ? (
              <StateBlock type="error" title="Não foi possível carregar os fiscais" description={profiles.error.message} />
            ) : members.length === 0 ? (
              <StateBlock
                title="Nenhum fiscal cadastrado"
                description='Clique em "Novo fiscal" para criar o primeiro acesso por código e senha.'
              />
            ) : (
              <ul className="divide-y divide-[color:var(--border-soft)]">
                {members.map((member) => (
                  <li key={member.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-semibold">{member.name}</span>
                        {member.job_title ? <span className="text-sm text-muted-foreground">{member.job_title}</span> : null}
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-full",
                            member.active
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                              : "border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-300"
                          )}
                        >
                          {member.active ? "Ativo" : "Bloqueado"}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Código de acesso: <b className="text-foreground">{member.login_code}</b>
                        {member.branches?.name ? ` · ${member.branches.name}` : ""}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {(member.custom_permissions ?? []).map((key) => (
                          <Badge key={key} variant="outline" className="rounded-full text-[11px]">
                            {PERMISSION_LABEL[key as PermissionKey] ?? key}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    {member.id === profile?.id ? null : (
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="outline" onClick={() => setEditing(member)}>
                          <Pencil className="size-4" />
                          Editar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setPasswordFor(member)}>
                          <KeyRound className="size-4" />
                          Senha
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => toggleActive(member)}>
                          {member.active ? <Ban className="size-4" /> : <CheckCircle2 className="size-4" />}
                          {member.active ? "Bloquear" : "Liberar"}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 text-red-600 hover:text-red-700"
                          aria-label={`Remover ${member.name}`}
                          title="Remover o fiscal"
                          onClick={() => confirmRemove(member)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {creating ? (
        <CreateStaffDialog
          open
          onClose={() => setCreating(false)}
          store={store.data}
          defaultBranchId={profile?.branch_id ?? null}
        />
      ) : null}
      {editing ? <EditStaffDialog member={editing} onClose={() => setEditing(null)} /> : null}
      {passwordFor ? <PasswordDialog member={passwordFor} onClose={() => setPasswordFor(null)} /> : null}
    </div>
  )
}
