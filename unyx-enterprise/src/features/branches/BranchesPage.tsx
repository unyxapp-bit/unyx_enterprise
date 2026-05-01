import { useMemo, useState } from "react"
import type { FormEvent } from "react"
import { Building2, Pencil, Plus, ToggleLeft, ToggleRight } from "lucide-react"

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
    <Dialog open={open} onOpenChange={setOpen}>
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
                value={form.state}
                onChange={(e) => setForm((c) => ({ ...c, state: e.target.value }))}
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
          {error || updateBranch.error ? (
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

function SectorEditDialog({ sector }: { sector: Sector }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    name: sector.name,
    description: sector.description ?? "",
  })
  const [error, setError] = useState<string | null>(null)
  const updateSector = useUpdateSector()

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
    <Dialog open={open} onOpenChange={setOpen}>
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
          {error || updateSector.error ? (
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
  const [formError, setFormError] = useState<string | null>(null)
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string | null>(null)

  const employeeCountByBranch = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const emp of allEmployees.data ?? []) {
      if (emp.active) counts[emp.branch_id] = (counts[emp.branch_id] ?? 0) + 1
    }
    return counts
  }, [allEmployees.data])

  const filteredSectors = useMemo(() => {
    const all = sectors.data ?? []
    if (!selectedBranchFilter) return all
    return all.filter((s) => s.branch_id === selectedBranchFilter)
  }, [sectors.data, selectedBranchFilter])

  async function handleCreateBranch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    if (!branchForm.name.trim()) { setFormError("Informe o nome da filial."); return }

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
    setFormError(null)
    if (!sectorForm.branch_id || !sectorForm.name.trim()) {
      setFormError("Selecione a filial e informe o setor.")
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

  return (
    <>
      <PageHeader
        title="Filiais e Setores"
        description="Base organizacional da operação multi-tenant."
        action={
          <>
            <Dialog open={branchOpen} onOpenChange={setBranchOpen}>
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
                        value={branchForm.state}
                        onChange={(e) => setBranchForm((c) => ({ ...c, state: e.target.value }))}
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
                  {formError || createBranch.error ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {formError ?? createBranch.error?.message}
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

            <Dialog open={sectorOpen} onOpenChange={setSectorOpen}>
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
                      {(branches.data ?? []).map((b) => (
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
                  {formError || createSector.error ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {formError ?? createSector.error?.message}
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
          </>
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
                        ? "border-slate-400 bg-slate-50"
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
                        <div className="font-medium">{branch.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {[branch.city, branch.state].filter(Boolean).join(" / ") ||
                            "Localização não informada"}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {employeeCountByBranch[branch.id] ?? 0} colaborador(es) ativo(s)
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
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
                    </div>
                    <div
                      className="mt-3 flex gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <BranchEditDialog branch={branch} />
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={toggleBranchActive.isPending}
                        onClick={() =>
                          toggleBranchActive.mutate({
                            branchId: branch.id,
                            active: !branch.active,
                          })
                        }
                      >
                        {branch.active ? (
                          <ToggleLeft className="size-4" />
                        ) : (
                          <ToggleRight className="size-4" />
                        )}
                        {branch.active ? "Desativar" : "Ativar"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border bg-white shadow-sm">
          <CardHeader>
            <CardTitle>
              {selectedBranchFilter
                ? `Setores — ${(branches.data ?? []).find((b) => b.id === selectedBranchFilter)?.name ?? ""}`
                : "Setores"}
            </CardTitle>
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
            ) : filteredSectors.length === 0 ? (
              <StateBlock
                title={
                  selectedBranchFilter
                    ? "Nenhum setor nesta filial"
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
                          <div className="mt-1 text-sm text-muted-foreground">
                            {sector.description}
                          </div>
                        ) : null}
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
          </CardContent>
        </Card>
      </div>
    </>
  )
}
