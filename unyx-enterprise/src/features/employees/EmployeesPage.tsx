import { useMemo, useState } from "react"
import type { FormEvent } from "react"
import {
  FileSpreadsheet,
  Pencil,
  Plus,
  Search,
  UserRoundCheck,
  UserRoundX,
} from "lucide-react"

import { PageHeader } from "@/components/shared/PageHeader"
import { StateBlock } from "@/components/shared/StateBlock"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  useCreateEmployee,
  useEmployees,
  useImportEmployees,
  useSectors,
  useUpdateEmployee,
} from "@/hooks/useUnyxData"
import {
  cellToText,
  getCell,
  normalizeColumn,
  parseSpreadsheet,
} from "@/lib/spreadsheet"
import { useAppStore } from "@/store/useAppStore"
import type { EmployeeImportInput } from "@/services/unyxApi"
import type { Branch, EmployeeWithRelations, Sector } from "@/types/domain"

const fieldClass =
  "h-8 w-full rounded-lg border bg-white px-2.5 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"

const filterClass =
  "h-9 rounded-lg border bg-white px-2.5 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"

interface EmployeeFormState {
  branch_id: string
  sector_id: string
  name: string
  role: string
  phone: string
  document: string
  notes: string
}

const initialForm: EmployeeFormState = {
  branch_id: "",
  sector_id: "",
  name: "",
  role: "",
  phone: "",
  document: "",
  notes: "",
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11)
  if (digits.length <= 2) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

function normalizeLookup(value: string) {
  return normalizeColumn(value).replace(/_/g, " ")
}

function EmployeeStatusBadge({ active }: { active: boolean }) {
  return (
    <Badge
      variant="outline"
      className={
        active
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-zinc-200 bg-zinc-50 text-zinc-600"
      }
    >
      {active ? "Ativo" : "Inativo"}
    </Badge>
  )
}

function EmployeesImportDialog({
  branches,
  sectors,
  selectedBranchId,
}: {
  branches: Branch[]
  sectors: Sector[]
  selectedBranchId: string | null
}) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<EmployeeImportInput[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [fileName, setFileName] = useState("")
  const importEmployees = useImportEmployees()

  const activeBranches = useMemo(
    () => branches.filter((branch) => branch.active),
    [branches]
  )

  async function handleFile(file: File | null) {
    setRows([])
    setErrors([])
    setFileName(file?.name ?? "")

    if (!file) return

    try {
      const parsed = await parseSpreadsheet(file)
      const branchByName = new Map(
        activeBranches.map((branch) => [normalizeLookup(branch.name), branch.id])
      )
      const sectorByBranchAndName = new Map(
        sectors
          .filter((sector) => sector.active)
          .map((sector) => [
            `${sector.branch_id}:${normalizeLookup(sector.name)}`,
            sector.id,
          ])
      )
      const fallbackBranchId =
        selectedBranchId && activeBranches.some((branch) => branch.id === selectedBranchId)
          ? selectedBranchId
          : activeBranches[0]?.id ?? ""
      const nextRows: EmployeeImportInput[] = []
      const nextErrors: string[] = []

      parsed.forEach((row, index) => {
        const name = cellToText(getCell(row, ["nome", "colaborador", "funcionario"]))
        const branchName = cellToText(getCell(row, ["filial", "loja", "unidade"]))
        const sectorName = cellToText(getCell(row, ["setor", "departamento"]))
        const branchId = branchName
          ? branchByName.get(normalizeLookup(branchName)) ?? ""
          : fallbackBranchId
        const sectorId = sectorName
          ? sectorByBranchAndName.get(`${branchId}:${normalizeLookup(sectorName)}`) ?? ""
          : ""

        if (!name) {
          nextErrors.push(`Linha ${index + 2}: nome obrigatorio.`)
          return
        }

        if (!branchId) {
          nextErrors.push(`Linha ${index + 2}: filial nao encontrada.`)
          return
        }

        if (sectorName && !sectorId) {
          nextErrors.push(`Linha ${index + 2}: setor nao encontrado na filial.`)
          return
        }

        nextRows.push({
          branch_id: branchId,
          sector_id: sectorId || null,
          name,
          role: cellToText(getCell(row, ["cargo", "funcao"])) || null,
          phone: formatPhone(cellToText(getCell(row, ["telefone", "celular"]))),
          document: cellToText(getCell(row, ["documento", "cpf"])),
          notes: cellToText(getCell(row, ["observacoes", "obs", "notas"])) || null,
        })
      })

      setRows(nextRows)
      setErrors(nextErrors)
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Nao foi possivel ler a planilha."])
    }
  }

  async function handleImport() {
    const result = await importEmployees.mutateAsync(rows)
    setErrors(result.errors)

    if (result.created > 0) {
      setRows([])
      setFileName("")
      if (result.errors.length === 0) setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileSpreadsheet className="size-4" />
          Importar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar colaboradores</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border bg-slate-50 p-3 text-sm text-slate-700">
            Colunas aceitas: nome, filial, setor, cargo, telefone, cpf/documento e
            observacoes. Use arquivos .xlsx ou .csv.
          </div>
          <Input
            type="file"
            accept=".xlsx,.csv"
            onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
          />
          {fileName ? (
            <div className="text-sm text-muted-foreground">
              {fileName}: {rows.length} linha(s) validas.
            </div>
          ) : null}
          {errors.length > 0 ? (
            <div className="max-h-40 overflow-auto rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              {errors.slice(0, 12).map((error) => (
                <div key={error}>{error}</div>
              ))}
              {errors.length > 12 ? <div>...mais {errors.length - 12}</div> : null}
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            disabled={rows.length === 0 || importEmployees.isPending}
            onClick={() => void handleImport()}
          >
            {importEmployees.isPending ? "Importando..." : "Importar colaboradores"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EmployeeEditDialog({
  employee,
  branches,
}: {
  employee: EmployeeWithRelations
  branches: Branch[]
}) {
  const [open, setOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [form, setForm] = useState<EmployeeFormState>({
    branch_id: employee.branch_id,
    sector_id: employee.sector_id ?? "",
    name: employee.name,
    role: employee.role ?? "",
    phone: employee.phone ?? "",
    document: employee.document ?? "",
    notes: employee.notes ?? "",
  })
  const sectors = useSectors(form.branch_id)
  const updateEmployee = useUpdateEmployee()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    if (!form.branch_id) {
      setFormError("Selecione uma filial.")
      return
    }
    if (!form.name.trim()) {
      setFormError("Informe o nome do colaborador.")
      return
    }

    await updateEmployee.mutateAsync({
      employeeId: employee.id,
      values: {
        branch_id: form.branch_id,
        sector_id: form.sector_id || null,
        name: form.name.trim(),
        role: form.role.trim() || null,
        phone: form.phone.trim() || null,
        document: form.document.trim() || null,
        notes: form.notes.trim() || null,
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
          <DialogTitle>Editar colaborador</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium">Nome</span>
              <Input
                value={form.name}
                onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Cargo</span>
              <Input
                value={form.role}
                onChange={(e) => setForm((c) => ({ ...c, role: e.target.value }))}
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium">Filial</span>
              <select
                className={fieldClass}
                value={form.branch_id}
                onChange={(e) =>
                  setForm((c) => ({ ...c, branch_id: e.target.value, sector_id: "" }))
                }
              >
                <option value="">Selecione</option>
                {branches.filter((b) => b.active).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Setor</span>
              <select
                className={fieldClass}
                value={form.sector_id}
                onChange={(e) =>
                  setForm((c) => ({ ...c, sector_id: e.target.value }))
                }
              >
                <option value="">Sem setor</option>
                {(sectors.data ?? []).filter((s) => s.active).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium">Telefone</span>
              <Input
                value={form.phone}
                placeholder="(11) 99999-9999"
                onChange={(e) =>
                  setForm((c) => ({ ...c, phone: formatPhone(e.target.value) }))
                }
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Documento (CPF)</span>
              <Input
                value={form.document}
                placeholder="000.000.000-00"
                onChange={(e) =>
                  setForm((c) => ({ ...c, document: e.target.value }))
                }
              />
            </label>
          </div>

          <label className="space-y-1 text-sm">
            <span className="font-medium">Observações</span>
            <Input
              value={form.notes}
              onChange={(e) => setForm((c) => ({ ...c, notes: e.target.value }))}
            />
          </label>

          {form.branch_id !== employee.branch_id ||
          form.sector_id !== (employee.sector_id ?? "") ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Verifique escalas futuras deste colaborador depois de alterar filial ou setor.
            </div>
          ) : null}

          {formError || updateEmployee.error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError ?? updateEmployee.error?.message}
            </div>
          ) : null}

          <DialogFooter>
            <Button type="submit" disabled={updateEmployee.isPending}>
              {updateEmployee.isPending ? "Salvando..." : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeactivateDialog({ employee }: { employee: EmployeeWithRelations }) {
  const [open, setOpen] = useState(false)
  const updateEmployee = useUpdateEmployee()

  async function handleConfirm() {
    await updateEmployee.mutateAsync({ employeeId: employee.id, values: { active: false } })
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserRoundX className="size-4" />
          Desativar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Desativar colaborador</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Deseja desativar{" "}
          <span className="font-medium text-slate-950">{employee.name}</span>? O
          colaborador não aparecerá em novas escalas.
        </p>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={updateEmployee.isPending}
            onClick={() => void handleConfirm()}
          >
            {updateEmployee.isPending ? "Desativando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function EmployeesPage() {
  const selectedBranchId = useAppStore((state) => state.selectedBranchId)
  const { data: branches = [] } = useBranches()
  const allSectors = useSectors(null)
  const activeBranches = useMemo(
    () => branches.filter((branch) => branch.active),
    [branches]
  )
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<EmployeeFormState>({
    ...initialForm,
    branch_id: selectedBranchId ?? "",
  })
  const [formError, setFormError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [sectorFilter, setSectorFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "inactive">("")

  const employees = useEmployees()
  const formSectors = useSectors(form.branch_id || selectedBranchId)
  const createEmployee = useCreateEmployee()
  const updateEmployee = useUpdateEmployee()

  const sectorOptions = useMemo(() => {
    const names = new Set(
      (employees.data ?? []).map((e) => e.sectors?.name).filter(Boolean) as string[]
    )
    return Array.from(names).sort()
  }, [employees.data])

  const activeCount = useMemo(
    () => (employees.data ?? []).filter((e) => e.active).length,
    [employees.data]
  )

  const filteredEmployees = useMemo(() => {
    let list = employees.data ?? []
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((e) => e.name.toLowerCase().includes(q))
    }
    if (sectorFilter) list = list.filter((e) => e.sectors?.name === sectorFilter)
    if (statusFilter === "active") list = list.filter((e) => e.active)
    if (statusFilter === "inactive") list = list.filter((e) => !e.active)
    return list
  }, [employees.data, search, sectorFilter, statusFilter])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    if (!form.branch_id) { setFormError("Selecione uma filial."); return }
    if (!form.name.trim()) { setFormError("Informe o nome do colaborador."); return }

    await createEmployee.mutateAsync({
      branch_id: form.branch_id,
      sector_id: form.sector_id || null,
      name: form.name.trim(),
      role: form.role.trim() || null,
      phone: form.phone.trim() || null,
      document: form.document.trim() || null,
      notes: form.notes.trim() || null,
    })

    setForm({ ...initialForm, branch_id: selectedBranchId ?? "" })
    setOpen(false)
  }

  return (
    <>
      <PageHeader
        title="Colaboradores"
        description={`${activeCount} ativos na operação`}
        action={
          <div className="flex flex-wrap gap-2">
            <EmployeesImportDialog
              branches={branches}
              sectors={allSectors.data ?? []}
              selectedBranchId={selectedBranchId}
            />
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="size-4" />
                  Novo colaborador
                </Button>
              </DialogTrigger>
              <DialogContent>
              <DialogHeader>
                <DialogTitle>Cadastrar colaborador</DialogTitle>
              </DialogHeader>
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Nome</span>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Cargo</span>
                    <Input
                      value={form.role}
                      onChange={(e) => setForm((c) => ({ ...c, role: e.target.value }))}
                    />
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Filial</span>
                    <select
                      className={fieldClass}
                      value={form.branch_id}
                      onChange={(e) =>
                        setForm((c) => ({ ...c, branch_id: e.target.value, sector_id: "" }))
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
                    <span className="font-medium">Setor</span>
                    <select
                      className={fieldClass}
                      value={form.sector_id}
                      onChange={(e) =>
                        setForm((c) => ({ ...c, sector_id: e.target.value }))
                      }
                    >
                      <option value="">Sem setor</option>
                      {(formSectors.data ?? []).filter((s) => s.active).map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Telefone</span>
                    <Input
                      value={form.phone}
                      placeholder="(11) 99999-9999"
                      onChange={(e) =>
                        setForm((c) => ({ ...c, phone: formatPhone(e.target.value) }))
                      }
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Documento (CPF)</span>
                    <Input
                      value={form.document}
                      placeholder="000.000.000-00"
                      onChange={(e) =>
                        setForm((c) => ({ ...c, document: e.target.value }))
                      }
                    />
                  </label>
                </div>

                <label className="space-y-1 text-sm">
                  <span className="font-medium">Observações</span>
                  <Input
                    value={form.notes}
                    onChange={(e) => setForm((c) => ({ ...c, notes: e.target.value }))}
                  />
                </label>

                {formError || createEmployee.error ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {formError ?? createEmployee.error?.message}
                  </div>
                ) : null}

                <DialogFooter>
                  <Button type="submit" disabled={createEmployee.isPending}>
                    {createEmployee.isPending ? "Salvando..." : "Salvar"}
                  </Button>
                </DialogFooter>
              </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-48 flex-1">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Buscar por nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {sectorOptions.length > 0 ? (
            <select
              className={filterClass}
              value={sectorFilter}
              onChange={(e) => setSectorFilter(e.target.value)}
            >
              <option value="">Todos os setores</option>
              {sectorOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          ) : null}
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

        {employees.isLoading ? (
          <StateBlock type="loading" title="Carregando colaboradores" />
        ) : employees.isError ? (
          <StateBlock
            type="error"
            title="Erro ao carregar colaboradores"
            description={employees.error.message}
          />
        ) : filteredEmployees.length === 0 ? (
          <StateBlock
            title={
              (employees.data ?? []).length === 0
                ? "Nenhum colaborador cadastrado"
                : "Nenhum resultado encontrado"
            }
            description={
              (employees.data ?? []).length === 0
                ? "Crie os primeiros registros para alimentar escalas e operação."
                : "Ajuste os filtros de busca."
            }
          />
        ) : (
          <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-slate-50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Filial</th>
                  <th className="px-4 py-3">Setor</th>
                  <th className="px-4 py-3">Cargo</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredEmployees.map((employee) => (
                  <tr key={employee.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{employee.name}</td>
                    <td className="px-4 py-3">{employee.branches?.name ?? "-"}</td>
                    <td className="px-4 py-3">{employee.sectors?.name ?? "-"}</td>
                    <td className="px-4 py-3">{employee.role ?? "-"}</td>
                    <td className="px-4 py-3">
                      <EmployeeStatusBadge active={employee.active} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <EmployeeEditDialog employee={employee} branches={branches} />
                        {employee.active ? (
                          <DeactivateDialog employee={employee} />
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={updateEmployee.isPending}
                            onClick={() =>
                              updateEmployee.mutate({
                                employeeId: employee.id,
                                values: { active: true },
                              })
                            }
                          >
                            <UserRoundCheck className="size-4" />
                            Ativar
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
