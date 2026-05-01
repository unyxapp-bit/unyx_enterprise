import { useState } from "react"
import type { FormEvent } from "react"
import { Building2, Plus } from "lucide-react"

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
  useBranches,
  useCreateBranch,
  useCreateSector,
  useSectors,
} from "@/hooks/useUnyxData"

const fieldClass =
  "h-8 w-full rounded-lg border bg-white px-2.5 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"

export function BranchesPage() {
  const branches = useBranches()
  const sectors = useSectors(null)
  const createBranch = useCreateBranch()
  const createSector = useCreateSector()
  const [branchOpen, setBranchOpen] = useState(false)
  const [sectorOpen, setSectorOpen] = useState(false)
  const [branchForm, setBranchForm] = useState({
    name: "",
    city: "",
    state: "",
    address: "",
  })
  const [sectorForm, setSectorForm] = useState({
    branch_id: "",
    name: "",
    description: "",
  })
  const [formError, setFormError] = useState<string | null>(null)

  async function handleCreateBranch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    if (!branchForm.name.trim()) {
      setFormError("Informe o nome da filial.")
      return
    }

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
                      onChange={(event) =>
                        setBranchForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">Cidade</span>
                      <Input
                        value={branchForm.city}
                        onChange={(event) =>
                          setBranchForm((current) => ({
                            ...current,
                            city: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">UF</span>
                      <Input
                        value={branchForm.state}
                        onChange={(event) =>
                          setBranchForm((current) => ({
                            ...current,
                            state: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Endereço</span>
                    <Input
                      value={branchForm.address}
                      onChange={(event) =>
                        setBranchForm((current) => ({
                          ...current,
                          address: event.target.value,
                        }))
                      }
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
                      onChange={(event) =>
                        setSectorForm((current) => ({
                          ...current,
                          branch_id: event.target.value,
                        }))
                      }
                    >
                      <option value="">Selecione</option>
                      {(branches.data ?? []).map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Nome do setor</span>
                    <Input
                      value={sectorForm.name}
                      onChange={(event) =>
                        setSectorForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Descrição</span>
                    <Input
                      value={sectorForm.description}
                      onChange={(event) =>
                        setSectorForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
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
                    className="rounded-lg border bg-white p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-medium">{branch.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {[branch.city, branch.state].filter(Boolean).join(" / ") ||
                            "Localização não informada"}
                        </div>
                      </div>
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        {branch.active ? "Ativa" : "Inativa"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Setores</CardTitle>
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
            ) : (sectors.data ?? []).length === 0 ? (
              <StateBlock title="Nenhum setor cadastrado" />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {(sectors.data ?? []).map((sector) => (
                  <div key={sector.id} className="rounded-lg border bg-white p-4">
                    <div className="font-medium">{sector.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {sector.branches?.name ?? "Sem filial"}
                    </div>
                    {sector.description ? (
                      <div className="mt-2 text-sm text-muted-foreground">
                        {sector.description}
                      </div>
                    ) : null}
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
