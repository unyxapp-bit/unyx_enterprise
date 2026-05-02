import { useMemo, useState } from "react"
import {
  Ban,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Link,
  MailPlus,
  MoreHorizontal,
  Search,
  Shield,
  Trash2,
  UserCheck,
  UserCog,
  UserMinus,
  X,
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
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  useBranches,
  useCancelInvitation,
  useCreateInvitation,
  useInvitations,
  useRemoveUserFromOrg,
  useSetUserActive,
  useSetUserBranch,
  useUpdateUserRole,
  useUserProfiles,
} from "@/hooks/useUnyxData"
import { formatDateBR } from "@/lib/format"
import type { Invitation, UserProfile, UserRole } from "@/types/domain"

// ─── Labels / helpers ─────────────────────────────────────────────────────────

const roleLabel: Record<UserRole, string> = {
  owner:          "Proprietário",
  admin:          "Administrador",
  branch_manager: "Gerente de filial",
  supervisor:     "Supervisor",
  operator:       "Operador",
  employee:       "Colaborador",
}

const roleDescription: Record<UserRole, string> = {
  owner:          "Acesso total. Gerencia organização, usuários, assinatura e todas as configurações.",
  admin:          "Acesso amplo. Gerencia filiais, colaboradores, escalas e relatórios. Sem acesso à assinatura.",
  branch_manager: "Gerencia a operação, escalas e equipe de uma filial específica.",
  supervisor:     "Acompanha o painel operacional, registra eventos e visualiza relatórios.",
  operator:       "Registra eventos e executa ações no painel operacional. Acesso restrito.",
  employee:       "Acesso mínimo. Visualiza comunicados e informações próprias.",
}

const roleBadge: Record<UserRole, string> = {
  owner:          "border-violet-200 bg-violet-50 text-violet-700",
  admin:          "border-blue-200 bg-blue-50 text-blue-700",
  branch_manager: "border-sky-200 bg-sky-50 text-sky-700",
  supervisor:     "border-teal-200 bg-teal-50 text-teal-700",
  operator:       "border-slate-200 bg-slate-100 text-slate-700",
  employee:       "border-zinc-200 bg-zinc-50 text-zinc-600",
}

const inviteStatusLabel: Record<Invitation["status"], string> = {
  pending:   "Pendente",
  accepted:  "Aceito",
  cancelled: "Cancelado",
  expired:   "Expirado",
}

const inviteStatusBadge: Record<Invitation["status"], string> = {
  pending:   "border-amber-200 bg-amber-50 text-amber-700",
  accepted:  "border-emerald-200 bg-emerald-50 text-emerald-700",
  cancelled: "border-zinc-200 bg-zinc-50 text-zinc-500",
  expired:   "border-red-200 bg-red-50 text-red-600",
}

const fieldClass =
  "h-8 w-full rounded-lg border bg-white px-2.5 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"

const filterClass =
  "h-9 rounded-lg border bg-white px-2.5 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"

// ─── EditRoleDialog ───────────────────────────────────────────────────────────

function EditRoleDialog({
  user,
  isOnlyOwner,
  open,
  onClose,
}: {
  user: UserProfile
  isOnlyOwner: boolean
  open: boolean
  onClose: () => void
}) {
  const [role, setRole] = useState<UserRole>(user.role)
  const updateRole = useUpdateUserRole()

  function handleOpenChange(next: boolean) {
    if (!next) { setRole(user.role); onClose() }
  }

  async function handleSave() {
    await updateRole.mutateAsync({ profileId: user.id, role })
    onClose()
  }

  const blocked = user.role === "owner" && isOnlyOwner && role !== "owner"

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Alterar papel — {user.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border bg-slate-50 p-3 text-sm">
            <div className="font-medium">{user.name}</div>
            <div className="mt-0.5 text-muted-foreground">{user.email}</div>
            <div className="mt-1">
              <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${roleBadge[user.role]}`}>
                {roleLabel[user.role]} atual
              </span>
            </div>
          </div>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Novo papel</span>
            <select className={fieldClass} value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
              {Object.entries(roleLabel).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <div className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-800">
            {roleDescription[role]}
          </div>
          {blocked && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              Não é possível remover o único Proprietário. Promova outro usuário antes.
            </div>
          )}
          {updateRole.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {updateRole.error.message}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => void handleSave()}
            disabled={updateRole.isPending || blocked || role === user.role}
          >
            {updateRole.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── EditBranchDialog ─────────────────────────────────────────────────────────

function EditBranchDialog({
  user,
  open,
  onClose,
}: {
  user: UserProfile
  open: boolean
  onClose: () => void
}) {
  const [branchId, setBranchId] = useState<string>(user.branch_id ?? "")
  const setBranch  = useSetUserBranch()
  const branches   = useBranches()

  function handleOpenChange(next: boolean) {
    if (!next) { setBranchId(user.branch_id ?? ""); onClose() }
  }

  async function handleSave() {
    await setBranch.mutateAsync({ profileId: user.id, branchId: branchId || null })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Atribuir filial — {user.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <label className="space-y-1 text-sm">
            <span className="font-medium">Filial</span>
            <select
              className={fieldClass}
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
            >
              <option value="">Sem filial</option>
              {(branches.data ?? []).map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </label>
          <p className="text-xs text-muted-foreground">
            A filial define quais dados o usuário pode visualizar e gerenciar.
          </p>
          {setBranch.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {setBranch.error.message}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => void handleSave()}
            disabled={setBranch.isPending || branchId === (user.branch_id ?? "")}
          >
            {setBranch.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── ToggleActiveDialog ───────────────────────────────────────────────────────

function ToggleActiveDialog({
  user,
  open,
  onClose,
}: {
  user: UserProfile
  open: boolean
  onClose: () => void
}) {
  const toggle    = useSetUserActive()
  const activating = !user.active

  async function handleConfirm() {
    await toggle.mutateAsync({ profileId: user.id, active: activating })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {activating ? "Ativar usuário" : "Desativar usuário"} — {user.name}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {activating
            ? "O usuário voltará a ter acesso à plataforma com o papel atual."
            : "O usuário perderá acesso imediatamente. O histórico será preservado."}
        </p>
        {toggle.error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {toggle.error.message}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            variant={activating ? "default" : "destructive"}
            onClick={() => void handleConfirm()}
            disabled={toggle.isPending}
          >
            {toggle.isPending ? "Processando..." : activating ? "Ativar" : "Desativar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── RemoveUserDialog ─────────────────────────────────────────────────────────

function RemoveUserDialog({
  user,
  open,
  onClose,
}: {
  user: UserProfile
  open: boolean
  onClose: () => void
}) {
  const remove = useRemoveUserFromOrg()

  async function handleConfirm() {
    await remove.mutateAsync(user.id)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remover usuário — {user.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            O usuário será desativado e perderá acesso à organização. O histórico de atividades é preservado.
          </p>
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Esta ação não pode ser desfeita facilmente. Tem certeza?
          </div>
          {remove.error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {remove.error.message}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            variant="destructive"
            onClick={() => void handleConfirm()}
            disabled={remove.isPending}
          >
            {remove.isPending ? "Removendo..." : "Remover da organização"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── UserActionsMenu ──────────────────────────────────────────────────────────

type DialogType = "role" | "branch" | "toggle" | "remove" | null

function UserActionsMenu({
  user,
  isOnlyOwner,
}: {
  user: UserProfile
  isOnlyOwner: boolean
}) {
  const [dialog, setDialog] = useState<DialogType>(null)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setDialog("role")}>
            <UserCog className="mr-2 size-4" />
            Alterar papel
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDialog("branch")}>
            <Shield className="mr-2 size-4" />
            Atribuir filial
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setDialog("toggle")}>
            {user.active
              ? <Ban className="mr-2 size-4 text-amber-600" />
              : <UserCheck className="mr-2 size-4 text-emerald-600" />}
            {user.active ? "Desativar usuário" : "Ativar usuário"}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-red-600 focus:text-red-600"
            onClick={() => setDialog("remove")}
          >
            <UserMinus className="mr-2 size-4" />
            Remover da organização
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {dialog === "role"   && <EditRoleDialog   user={user} isOnlyOwner={isOnlyOwner} open onClose={() => setDialog(null)} />}
      {dialog === "branch" && <EditBranchDialog user={user} open onClose={() => setDialog(null)} />}
      {dialog === "toggle" && <ToggleActiveDialog user={user} open onClose={() => setDialog(null)} />}
      {dialog === "remove" && <RemoveUserDialog   user={user} open onClose={() => setDialog(null)} />}
    </>
  )
}

// ─── InviteSection ────────────────────────────────────────────────────────────

function HistoricInvites({ invitations }: { invitations: Invitation[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="space-y-2">
      <button
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        Histórico ({invitations.length})
      </button>
      {open && (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-slate-50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Papel</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {invitations.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-muted-foreground">{inv.email}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${roleBadge[inv.role]}`}>
                      {roleLabel[inv.role]}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${inviteStatusBadge[inv.status]}`}>
                      {inviteStatusLabel[inv.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{formatDateBR(inv.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function InviteSection() {
  const [email,    setEmail]    = useState("")
  const [role,     setRole]     = useState<UserRole>("employee")
  const [branchId, setBranchId] = useState("")
  const [copied,   setCopied]   = useState(false)
  const [showForm, setShowForm] = useState(false)

  const branches    = useBranches()
  const invitations = useInvitations()
  const create      = useCreateInvitation()
  const cancel      = useCancelInvitation()

  const inviteLink = `${window.location.origin}/`

  const pending = useMemo(
    () => (invitations.data ?? []).filter((i) => i.status === "pending"),
    [invitations.data]
  )
  const past = useMemo(
    () => (invitations.data ?? []).filter((i) => i.status !== "pending"),
    [invitations.data]
  )

  function handleCopyLink() {
    void navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  async function handleInvite() {
    if (!email.trim()) return
    await create.mutateAsync({ email: email.trim(), role, branch_id: branchId || null })
    setEmail("")
    setRole("employee")
    setBranchId("")
    setShowForm(false)
  }

  return (
    <Card className="border bg-white shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MailPlus className="size-5" />
            Convites
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setShowForm((v) => !v)}>
            {showForm
              ? <><X className="mr-1.5 size-4" />Cancelar</>
              : <><MailPlus className="mr-1.5 size-4" />Novo convite</>}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">

        {showForm && (
          <div className="rounded-lg border bg-slate-50 p-4 space-y-3">
            <p className="text-sm font-medium">Registrar convite</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Email</span>
                <Input
                  type="email"
                  placeholder="usuario@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleInvite() }}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Papel</span>
                <select className={fieldClass} value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
                  {Object.entries(roleLabel).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Filial (opcional)</span>
                <select className={fieldClass} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                  <option value="">Sem filial</option>
                  {(branches.data ?? []).map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </label>
            </div>
            {create.error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {create.error.message}
              </div>
            )}
            <div className="flex justify-end">
              <Button size="sm" onClick={() => void handleInvite()} disabled={create.isPending || !email.trim()}>
                {create.isPending ? "Registrando..." : "Registrar convite"}
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-sm font-medium flex items-center gap-1.5">
            <Link className="size-4 text-muted-foreground" />
            Link de acesso
          </p>
          <p className="text-xs text-muted-foreground">
            Compartilhe com novos usuários. Após o cadastro, atribua o papel e a filial manualmente.
          </p>
          <div className="flex items-center gap-2">
            <Input readOnly value={inviteLink} className="font-mono text-xs text-muted-foreground" />
            <Button variant="outline" size="sm" onClick={handleCopyLink}>
              {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
              {copied ? "Copiado" : "Copiar"}
            </Button>
          </div>
        </div>

        {pending.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Aguardando ({pending.length})</p>
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-slate-50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Papel</th>
                    <th className="px-3 py-2">Filial</th>
                    <th className="px-3 py-2">Expira</th>
                    <th className="px-3 py-2 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {pending.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium">{inv.email}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${roleBadge[inv.role]}`}>
                          {roleLabel[inv.role]}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{inv.branches?.name ?? "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{formatDateBR(inv.expires_at)}</td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => void cancel.mutateAsync(inv.id)}
                          disabled={cancel.isPending}
                        >
                          <Trash2 className="mr-1 size-3.5" />
                          Cancelar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {past.length > 0 && <HistoricInvites invitations={past} />}

      </CardContent>
    </Card>
  )
}

// ─── UsersPage ────────────────────────────────────────────────────────────────

type SortKey = "name" | "role" | "branch" | "status" | "created_at"

function SortIcon({ k, sortKey, sortAsc }: { k: SortKey; sortKey: SortKey; sortAsc: boolean }) {
  if (sortKey !== k) return <span className="ml-1 opacity-30">↕</span>
  return sortAsc
    ? <ChevronUp className="ml-1 inline size-3" />
    : <ChevronDown className="ml-1 inline size-3" />
}

function Th({ label, k, sortKey, sortAsc, onSort }: {
  label: string; k: SortKey; sortKey: SortKey; sortAsc: boolean; onSort: (k: SortKey) => void
}) {
  return (
    <th
      className="cursor-pointer select-none px-4 py-3 hover:text-foreground"
      onClick={() => onSort(k)}
    >
      {label}<SortIcon k={k} sortKey={sortKey} sortAsc={sortAsc} />
    </th>
  )
}

export function UsersPage() {
  const { profile: currentProfile } = useAuth()
  const profiles = useUserProfiles()
  const branches = useBranches()

  const [search,       setSearch]       = useState("")
  const [roleFilter,   setRoleFilter]   = useState<UserRole | "">("")
  const [branchFilter, setBranchFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "inactive">("")
  const [sortKey,      setSortKey]      = useState<SortKey>("name")
  const [sortAsc,      setSortAsc]      = useState(true)

  const ownerCount = useMemo(
    () => (profiles.data ?? []).filter((p) => p.role === "owner" && p.active).length,
    [profiles.data]
  )

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((v) => !v)
    else { setSortKey(key); setSortAsc(true) }
  }

  const filteredProfiles = useMemo(() => {
    let list = [...(profiles.data ?? [])]
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)
      )
    }
    if (roleFilter)   list = list.filter((p) => p.role === roleFilter)
    if (branchFilter) list = list.filter((p) => p.branch_id === branchFilter)
    if (statusFilter === "active")   list = list.filter((p) =>  p.active)
    if (statusFilter === "inactive") list = list.filter((p) => !p.active)

    list.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case "name":       cmp = a.name.localeCompare(b.name); break
        case "role":       cmp = a.role.localeCompare(b.role); break
        case "branch":     cmp = (a.branches?.name ?? "").localeCompare(b.branches?.name ?? ""); break
        case "status":     cmp = Number(b.active) - Number(a.active); break
        case "created_at": cmp = a.created_at.localeCompare(b.created_at); break
      }
      return sortAsc ? cmp : -cmp
    })
    return list
  }, [profiles.data, search, roleFilter, branchFilter, statusFilter, sortKey, sortAsc])

  const activeCount   = (profiles.data ?? []).filter((p) =>  p.active).length
  const inactiveCount = (profiles.data ?? []).filter((p) => !p.active).length

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
              <span className="ml-1 rounded-full border bg-slate-100 px-2 py-0.5 text-xs font-normal text-muted-foreground">
                {activeCount} ativo{activeCount !== 1 ? "s" : ""}
                {inactiveCount > 0 ? `, ${inactiveCount} inativo${inactiveCount !== 1 ? "s" : ""}` : ""}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {profiles.isLoading ? (
              <StateBlock type="loading" title="Carregando usuários" />
            ) : profiles.isError ? (
              <StateBlock type="error" title="Erro ao carregar usuários" description={profiles.error.message} />
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
                    {Object.entries(roleLabel).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                  <select
                    className={filterClass}
                    value={branchFilter}
                    onChange={(e) => setBranchFilter(e.target.value)}
                  >
                    <option value="">Todas as filiais</option>
                    {(branches.data ?? []).map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                  <select
                    className={filterClass}
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as "" | "active" | "inactive")}
                  >
                    <option value="">Todos os status</option>
                    <option value="active">Ativos</option>
                    <option value="inactive">Inativos</option>
                  </select>
                </div>

                {filteredProfiles.length === 0 ? (
                  <StateBlock
                    title={(profiles.data ?? []).length === 0 ? "Nenhum usuário encontrado" : "Nenhum resultado"}
                    description={(profiles.data ?? []).length === 0 ? undefined : "Ajuste os filtros."}
                  />
                ) : (
                  <div className="overflow-hidden rounded-lg border">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b bg-slate-50 text-xs uppercase text-muted-foreground">
                        <tr>
                          <Th label="Nome"    k="name"       sortKey={sortKey} sortAsc={sortAsc} onSort={toggleSort} />
                          <th className="px-4 py-3">Email</th>
                          <Th label="Filial"  k="branch"     sortKey={sortKey} sortAsc={sortAsc} onSort={toggleSort} />
                          <Th label="Papel"   k="role"       sortKey={sortKey} sortAsc={sortAsc} onSort={toggleSort} />
                          <Th label="Status"  k="status"     sortKey={sortKey} sortAsc={sortAsc} onSort={toggleSort} />
                          <Th label="Desde"   k="created_at" sortKey={sortKey} sortAsc={sortAsc} onSort={toggleSort} />
                          <th className="px-4 py-3 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {filteredProfiles.map((p) => (
                          <tr key={p.id} className={`hover:bg-slate-50 ${!p.active ? "opacity-60" : ""}`}>
                            <td className="px-4 py-3 font-medium">
                              <div className="flex items-center gap-2">
                                {p.name}
                                {p.id === currentProfile?.id && (
                                  <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
                                    Você
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{p.email}</td>
                            <td className="px-4 py-3 text-muted-foreground">{p.branches?.name ?? "—"}</td>
                            <td className="px-4 py-3">
                              <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${roleBadge[p.role]}`}>
                                {roleLabel[p.role]}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                                p.active
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : "border-zinc-200 bg-zinc-50 text-zinc-600"
                              }`}>
                                {p.active ? "Ativo" : "Inativo"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{formatDateBR(p.created_at)}</td>
                            <td className="px-4 py-3 text-right">
                              {p.id !== currentProfile?.id ? (
                                <UserActionsMenu
                                  user={p}
                                  isOnlyOwner={ownerCount === 1 && p.role === "owner"}
                                />
                              ) : (
                                <span className="text-xs text-muted-foreground">Seu perfil</span>
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

        <InviteSection />
      </div>
    </>
  )
}
