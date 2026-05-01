import { useMemo, useState } from "react"
import type { FormEvent } from "react"
import {
  AlertTriangle,
  Building2,
  Filter,
  Pencil,
  Plus,
  Search,
  ToggleLeft,
  ToggleRight,
  X,
} from "lucide-react"

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
import {
  useAllEmployees,
  useBranches,
  useCreateBranch,
  useCreateSector,
  useSectors,
  useToggleBranchActive,
  useToggleSectorActive,
  useUpdateBranch,
  useUpdateSector,
} from "@/hooks/useUnyxData"
import type { Branch, Sector } from "@/types/domain"

const fieldClass =
  "h-8 w-full rounded-lg border bg-white px-2.5 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"

function BranchEditDialog({ branch }: { branch: Branch }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    name: branch.name,
    city: branch.city ?? "",
    state: branch.state ?? "",
    address: branch.address ?? "",
  })
  const [error, setError] = useState<string | null>(null)
  const updateBranch = useUpdateBranch()

  function handleOpenChange(next: boolean) {
    if (!next) {
      setForm({
        name: branch.name,
        city: branch.city ?? "",
        state: branch.state ?? "",
        address: branch.address ?? "",
      })
      setError(null)
    }
    setOpen(next)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    if (!form.name.trim()) { setError("Informe o nome da filial."); return }

    await updateBranch.mutateAsync({
      branchId: branch.id,
      values: {
        name: form.name.trim(),
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        address: form.address.trim() || null,
      },
    })
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="size-4" />
          Editar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar filial</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Nome</span>
            <Input
              value={form.name}
              onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium">Cidade</span>
              <Input
                value={form.city}
                onChange={(e) => setForm((c) => ({ ...c, city: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">UF</span>
              <Input
                maxLength={2}
                value={form.state}
                onChange={(e) => setForm((c) => ({ ...c, state: e.target.value.toUpperCase() }))}
              />
            </label>
          </div>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Endereço</span>
            <Input
              value={form.address}
              onChange={(e) => setForm((c) => ({ ...c, address: e.target.value }))}
            />
          </label>
          {error ?? updateBranch.error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error ?? updateBranch.error?.message}
            </div>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={updateBranch.isPending}>
              {updateBranch.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function BranchDeactivateDialog({ branch }: { branch: Branch }) {
  const [open, setOpen] = useState(false)
  const toggleBranchActive = useToggleBranchActive()

  async function handleConfirm() {
    await toggleBranchActive.mutateAsync({ branchId: branch.id, active: false })
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ToggleLeft className="size-4" />
          Desativar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Desativar filial</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <div className="text-sm text-amber-800">
              Desativar <span className="font-medium">{branch.name}</span> impede novos registros operacionais para esta filial. Escalas e eventos existentes sao preservados, mas a filial nao aparecera nas selecoes ativas do sistema.
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Esta acao pode ser revertida a qualquer momento reativando a filial.
          </p>
          {toggleBranchActive.error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {toggleBranchActive.error.message}
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={toggleBranchActive.isPending}
            onClick={() => void handleConfirm()}
          >
            {toggleBranchActive.isPending ? "Desativando..." : "Confirmar desativacao"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SectorEditDialog({ sector }: { sector: Sector }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    name: sector.name,
    description: sector.description ?? "",
  })
  const [error, setError] = useState<string | null>(null)
  const updateSector = useUpdateSector()

  function handleOpenChange(next: boolean) {
    if (!next) {
      setForm({ name: sector.name, description: sector.description ?? "" })
      setError(null)
    }
    setOpen(next)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    if (!form.name.trim()) { setError("Informe o nome do setor."); return }

    await updateSector.mutateAsync({
      sectorId: sector.id,
      values: {
        name: form.name.trim(),
        description: form.description.trim() || null,
      },
    })
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="size-4" />
          Editar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar setor</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Nome</span>
            <Input
              value={form.name}
              onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Descrição</span>
            <Input
              value={form.description}
              onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))}
            />
          </label>
          {error ?? updateSector.error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error ?? updateSector.error?.message}
            </div>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={updateSector.isPending}>
              {updateSector.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function BranchesPage() {
  const branches = useBranches()
  const sectors = useSectors(null)
  const allEmployees = useAllEmployees()
  const createBranch = useCreateBranch()
  const createSector = useCreateSector()
  const toggleBranchActive = useToggleBranchActive()
  const toggleSectorActive = useToggleSectorActive()

  const [branchOpen, setBranchOpen] = useState(false)
  const [sectorOpen, setSectorOpen] = useState(false)
  const [branchForm, setBranchForm] = useState({ name: "", city: "", state: "", address: "" })
  const [sectorForm, setSectorForm] = useState({ branch_id: "", name: "", description: "" })
  const [branchFormError, setBranchFormError] = useState<string | null>(null)
  const [sectorFormError, setSectorFormError] = useState<string | null>(null)
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string | null>(null)
  const [sectorSearch, setSectorSearch] = useState("")

  const activeBranches = useMemo(
    () => (branches.data ?? []).filter((b) => b.active),
    [branches.data]
  )

  const employeeCountByBranch = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const emp of allEmployees.data ?? []) {
      if (emp.active) counts[emp.branch_id] = (counts[emp.branch_id] ?? 0) + 1
    }
    return counts
  }, [allEmployees.data])

  const employeeCountBySector = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const emp of allEmployees.data ?? []) {
      if (emp.active && emp.sector_id) {
        counts[emp.sector_id] = (counts[emp.sector_id] ?? 0) + 1
      }
    }
    return counts
  }, [allEmployees.data])

  const sectorCountByBranch = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const s of sectors.data ?? []) {
      if (s.active) counts[s.branch_id] = (counts[s.branch_id] ?? 0) + 1
    }
    return counts
  }, [sectors.data])

  const filteredSectors = useMemo(() => {
    let list = sectors.data ?? []
    if (selectedBranchFilter) list = list.filter((s) => s.branch_id === selectedBranchFilter)
    if (sectorSearch.trim()) {
      const q = sectorSearch.trim().toLowerCase()
      list = list.filter((s) => s.name.toLowerCase().includes(q))
    }
    return list
  }, [sectors.data, selectedBranchFilter, sectorSearch])

  function handleBranchOpenChange(next: boolean) {
    if (!next) {
      setBranchForm({ name: "", city: "", state: "", address: "" })
      setBranchFormError(null)
    }
    setBranchOpen(next)
  }

  function handleSectorOpenChange(next: boolean) {
    if (!next) {
      setSectorForm({ branch_id: "", name: "", description: "" })
      setSectorFormError(null)
    }
    setSectorOpen(next)
  }

  async function handleCreateBranch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBranchFormError(null)
    if (!branchForm.name.trim()) { setBranchFormError("Informe o nome da filial."); return }

    await createBranch.mutateAsync({
      name: branchForm.name.trim(),
      city: branchForm.city.trim() || null,
      state: branchForm.state.trim() || null,
      address: branchForm.address.trim() || null,
    })
    setBranchForm({ name: "", city: "", state: "", address: "" })
    setBranchOpen(false)
  }

  async function handleCreateSector(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSectorFormError(null)
    if (!sectorForm.branch_id || !sectorForm.name.trim()) {
      setSectorFormError("Selecione a filial e informe o nome do setor.")
      return
    }

    await createSector.mutateAsync({
      branch_id: sectorForm.branch_id,
      name: sectorForm.name.trim(),
      description: sectorForm.description.trim() || null,
    })
    setSectorForm({ branch_id: "", name: "", description: "" })
    setSectorOpen(false)
  }

  const selectedBranchName = selectedBranchFilter
    ? (branches.data ?? []).find((b) => b.id === selectedBranchFilter)?.name
    : null

  return (
    <>
      <PageHeader
        title="Filiais e Setores"
        description="Base organizacional da operação multi-tenant."
        action={
          <div className="flex gap-2">
            <Dialog open={branchOpen} onOpenChange={handleBranchOpenChange}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Building2 className="size-4" />
                  Nova filial
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cadastrar filial</DialogTitle>
                </DialogHeader>
                <form className="space-y-4" onSubmit={handleCreateBranch}>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Nome</span>
                    <Input
                      value={branchForm.name}
                      onChange={(e) => setBranchForm((c) => ({ ...c, name: e.target.value }))}
                    />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">Cidade</span>
                      <Input
                        value={branchForm.city}
                        onChange={(e) => setBranchForm((c) => ({ ...c, city: e.target.value }))}
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">UF</span>
                      <Input
                        maxLength={2}
                        value={branchForm.state}
                        onChange={(e) =>
                          setBranchForm((c) => ({ ...c, state: e.target.value.toUpperCase() }))
                        }
                      />
                    </label>
                  </div>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Endereço</span>
                    <Input
                      value={branchForm.address}
                      onChange={(e) => setBranchForm((c) => ({ ...c, address: e.target.value }))}
                    />
                  </label>
                  {branchFormError ?? createBranch.error ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {branchFormError ?? createBranch.error?.message}
                    </div>
                  ) : null}
                  <DialogFooter>
                    <Button type="submit" disabled={createBranch.isPending}>
                      {createBranch.isPending ? "Salvando..." : "Salvar"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={sectorOpen} onOpenChange={handleSectorOpenChange}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="size-4" />
                  Novo setor
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cadastrar setor</DialogTitle>
                </DialogHeader>
                <form className="space-y-4" onSubmit={handleCreateSector}>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Filial</span>
                    <select
                      className={fieldClass}
                      value={sectorForm.branch_id}
                      onChange={(e) =>
                        setSectorForm((c) => ({ ...c, branch_id: e.target.value }))
                      }
                    >
                      <option value="">Selecione</option>
                      {activeBranches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Nome do setor</span>
                    <Input
                      value={sectorForm.name}
                      onChange={(e) =>
                        setSectorForm((c) => ({ ...c, name: e.target.value }))
                      }
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Descrição</span>
                    <Input
                      value={sectorForm.description}
                      onChange={(e) =>
                        setSectorForm((c) => ({ ...c, description: e.target.value }))
                      }
                    />
                  </label>
                  {sectorFormError ?? createSector.error ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {sectorFormError ?? createSector.error?.message}
                    </div>
                  ) : null}
                  <DialogFooter>
                    <Button type="submit" disabled={createSector.isPending}>
                      {createSector.isPending ? "Salvando..." : "Salvar"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid gap-4 p-6 xl:grid-cols-[1fr_1fr]">
        <Card className="border bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Filiais</CardTitle>
          </CardHeader>
          <CardContent>
            {branches.isLoading ? (
              <StateBlock type="loading" title="Carregando filiais" />
            ) : branches.isError ? (
              <StateBlock
                type="error"
                title="Erro ao carregar filiais"
                description={branches.error.message}
              />
            ) : (branches.data ?? []).length === 0 ? (
              <StateBlock title="Nenhuma filial cadastrada" />
            ) : (
              <div className="space-y-3">
                {(branches.data ?? []).map((branch) => (
                  <div
                    key={branch.id}
                    className={`cursor-pointer rounded-lg border p-4 transition-colors ${
                      selectedBranchFilter === branch.id
                        ? "border-slate-400 bg-slate-50 ring-1 ring-slate-300"
                        : "bg-white hover:bg-slate-50"
                    }`}
                    onClick={() =>
                      setSelectedBranchFilter(
                        selectedBranchFilter === branch.id ? null : branch.id
                      )
                    }
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{branch.name}</span>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                              branch.active
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-zinc-200 bg-zinc-50 text-zinc-600"
                            }`}
                          >
                            {branch.active ? "Ativa" : "Inativa"}
                          </span>
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {[branch.city, branch.state].filter(Boolean).join(" / ") ||
                            "Localização não informada"}
                        </div>
                        {branch.address ? (
                          <div className="text-xs text-muted-foreground">{branch.address}</div>
                        ) : null}
                        <div className="mt-1.5 flex gap-3 text-xs text-muted-foreground">
                          <span>{employeeCountByBranch[branch.id] ?? 0} colaborador(es)</span>
                          <span>{sectorCountByBranch[branch.id] ?? 0} setor(es) ativo(s)</span>
                        </div>
                      </div>
                      {selectedBranchFilter === branch.id ? (
                        <span className="rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 shrink-0">
                          <Filter className="inline size-3 mr-1" />
                          Filtrado
                        </span>
                      ) : null}
                    </div>
                    <div
                      className="mt-3 flex gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <BranchEditDialog branch={branch} />
                      {branch.active ? (
                        <BranchDeactivateDialog branch={branch} />
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={toggleBranchActive.isPending}
                          onClick={() =>
                            toggleBranchActive.mutate({ branchId: branch.id, active: true })
                          }
                        >
                          <ToggleRight className="size-4" />
                          Ativar
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border bg-white shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>
                {selectedBranchName ? `Setores — ${selectedBranchName}` : "Setores"}
              </CardTitle>
              {selectedBranchFilter ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedBranchFilter(null)}
                >
                  <X className="size-4" />
                  Limpar filtro
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            {sectors.isLoading ? (
              <StateBlock type="loading" title="Carregando setores" />
            ) : sectors.isError ? (
              <StateBlock
                type="error"
                title="Erro ao carregar setores"
                description={sectors.error.message}
              />
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    placeholder="Buscar setor..."
                    value={sectorSearch}
                    onChange={(e) => setSectorSearch(e.target.value)}
                  />
                </div>

                {filteredSectors.length === 0 ? (
                  <StateBlock
                    title={
                      selectedBranchFilter
                        ? "Nenhum setor nesta filial"
                        : sectorSearch
                          ? "Nenhum setor encontrado"
                          : "Nenhum setor cadastrado"
                    }
                  />
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {filteredSectors.map((sector) => (
                      <div key={sector.id} className="rounded-lg border bg-white p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-medium">{sector.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {sector.branches?.name ?? "Sem filial"}
                            </div>
                            {sector.description ? (
                              <div className="mt-0.5 text-xs text-muted-foreground">
                                {sector.description}
                              </div>
                            ) : null}
                            <div className="mt-1 text-xs text-muted-foreground">
                              {employeeCountBySector[sector.id] ?? 0} colaborador(es)
                            </div>
                          </div>
                          <span
                            className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${
                              sector.active
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-zinc-200 bg-zinc-50 text-zinc-600"
                            }`}
                          >
                            {sector.active ? "Ativo" : "Inativo"}
                          </span>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <SectorEditDialog sector={sector} />
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={toggleSectorActive.isPending}
                            onClick={() =>
                              toggleSectorActive.mutate({
                                sectorId: sector.id,
                                active: !sector.active,
                              })
                            }
                          >
                            {sector.active ? (
                              <ToggleLeft className="size-4" />
                            ) : (
                              <ToggleRight className="size-4" />
                            )}
                            {sector.active ? "Desativar" : "Ativar"}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
