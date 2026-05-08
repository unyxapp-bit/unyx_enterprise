import { useMemo, useState } from "react"
import type { FormEvent } from "react"
import {
  Ban,
  Contact,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
} from "lucide-react"

import { BentoGrid } from "@/components/bento/BentoGrid"
import { MetricCard } from "@/components/bento/MetricCard"
import { PageHeader } from "@/components/shared/PageHeader"
import { StateBlock } from "@/components/shared/StateBlock"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  useBranches,
  useCreateCustomer,
  useCustomers,
  useDeleteCustomer,
  useUpdateCustomer,
} from "@/hooks/useUnyxData"
import { formatCep, lookupCep } from "@/services/viaCep"
import { useAppStore } from "@/store/useAppStore"
import type { Customer, CustomerStatus } from "@/types/domain"
import type { CustomerInput } from "@/services/unyxApi"

const fieldClass =
  "h-8 w-full rounded-lg border bg-white px-2.5 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50 disabled:cursor-not-allowed disabled:bg-slate-100"

const textareaClass =
  "min-h-20 w-full rounded-lg border bg-white px-2.5 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"

const statusLabel: Record<CustomerStatus, string> = {
  active: "Ativo",
  inactive: "Inativo",
  blocked: "Bloqueado",
}

const statusOptions: CustomerStatus[] = ["active", "inactive", "blocked"]

type CustomerForm = {
  branch_id: string
  name: string
  document: string
  phone: string
  email: string
  birth_date: string
  status: CustomerStatus
  postal_code: string
  address_line: string
  address_number: string
  complement: string
  neighborhood: string
  city: string
  state: string
  reference: string
  notes: string
  marketing_opt_in: boolean
}

function emptyForm(branchId?: string | null): CustomerForm {
  return {
    branch_id: branchId ?? "",
    name: "",
    document: "",
    phone: "",
    email: "",
    birth_date: "",
    status: "active",
    postal_code: "",
    address_line: "",
    address_number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    reference: "",
    notes: "",
    marketing_opt_in: false,
  }
}

function buildForm(customer: Customer): CustomerForm {
  return {
    branch_id: customer.branch_id ?? "",
    name: customer.name,
    document: customer.document ?? "",
    phone: customer.phone ?? "",
    email: customer.email ?? "",
    birth_date: customer.birth_date ?? "",
    status: customer.status,
    postal_code: customer.postal_code ?? "",
    address_line: customer.address_line ?? "",
    address_number: customer.address_number ?? "",
    complement: customer.complement ?? "",
    neighborhood: customer.neighborhood ?? "",
    city: customer.city ?? "",
    state: customer.state ?? "",
    reference: customer.reference ?? "",
    notes: customer.notes ?? "",
    marketing_opt_in: customer.marketing_opt_in,
  }
}

function formToInput(form: CustomerForm): CustomerInput {
  return {
    branch_id: form.branch_id || null,
    name: form.name.trim(),
    document: form.document.trim() || null,
    phone: form.phone.trim() || null,
    email: form.email.trim() || null,
    birth_date: form.birth_date || null,
    status: form.status,
    postal_code: form.postal_code.trim() || null,
    address_line: form.address_line.trim() || null,
    address_number: form.address_number.trim() || null,
    complement: form.complement.trim() || null,
    neighborhood: form.neighborhood.trim() || null,
    city: form.city.trim() || null,
    state: form.state.trim() || null,
    reference: form.reference.trim() || null,
    notes: form.notes.trim() || null,
    marketing_opt_in: form.marketing_opt_in,
  }
}

function branchName(customer: Customer) {
  return customer.branches?.name ?? "Todas as filiais"
}

function hasAddress(customer: Customer) {
  return Boolean(customer.postal_code || customer.address_line || customer.city)
}

function statusBadgeVariant(status: CustomerStatus) {
  if (status === "active") return "outline"
  if (status === "blocked") return "destructive"
  return "secondary"
}

export function CustomersPage() {
  const selectedBranchId = useAppStore((state) => state.selectedBranchId)
  const branches = useBranches()
  const customers = useCustomers()
  const createCustomer = useCreateCustomer()
  const updateCustomer = useUpdateCustomer()
  const deleteCustomer = useDeleteCustomer()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [form, setForm] = useState<CustomerForm>(() => emptyForm(selectedBranchId))
  const [formError, setFormError] = useState<string | null>(null)
  const [cepLoading, setCepLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<CustomerStatus | "all">("all")

  const customerList = useMemo(() => customers.data ?? [], [customers.data])
  const activeCount = customerList.filter((customer) => customer.status === "active").length
  const blockedCount = customerList.filter((customer) => customer.status === "blocked").length
  const withAddress = customerList.filter(hasAddress).length

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase()
    return customerList.filter((customer) => {
      const matchesStatus = statusFilter === "all" || customer.status === statusFilter
      const searchable = [
        customer.customer_code,
        customer.name,
        customer.document,
        customer.phone,
        customer.email,
        customer.postal_code,
        customer.address_line,
        customer.neighborhood,
        customer.city,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return matchesStatus && (!q || searchable.includes(q))
    })
  }, [customerList, search, statusFilter])

  function setField<K extends keyof CustomerForm>(key: K, value: CustomerForm[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function openCreate() {
    setEditing(null)
    setForm(emptyForm(selectedBranchId))
    setFormError(null)
    setDialogOpen(true)
  }

  function openEdit(customer: Customer) {
    setEditing(customer)
    setForm(buildForm(customer))
    setFormError(null)
    setDialogOpen(true)
  }

  async function fillAddressFromCep() {
    setFormError(null)
    setCepLoading(true)
    try {
      const address = await lookupCep(form.postal_code)
      setForm((current) => ({
        ...current,
        postal_code: address.cep,
        address_line: address.logradouro || current.address_line,
        complement: current.complement || address.complemento || "",
        neighborhood: address.bairro || current.neighborhood,
        city: address.localidade || current.city,
        state: address.uf || current.state,
      }))
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Nao foi possivel buscar o CEP.")
    } finally {
      setCepLoading(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    try {
      if (editing) {
        await updateCustomer.mutateAsync({
          customerId: editing.id,
          values: formToInput(form),
        })
      } else {
        await createCustomer.mutateAsync(formToInput(form))
      }
      setDialogOpen(false)
      setEditing(null)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Nao foi possivel salvar o cliente.")
    }
  }

  async function handleDelete(customer: Customer) {
    const confirmed = window.confirm(
      `Excluir o cliente ${customer.customer_code} - ${customer.name}?`
    )
    if (!confirmed) return
    await deleteCustomer.mutateAsync(customer.id)
  }

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Cadastro unico de clientes para PDV, entregas e historico comercial."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              type="button"
              onClick={() => void customers.refetch()}
              aria-label="Atualizar clientes"
            >
              <RefreshCw className="size-4" />
            </Button>
            <Button type="button" onClick={openCreate}>
              <Plus className="size-4" />
              Novo cliente
            </Button>
          </div>
        }
      />

      <div className="space-y-6 p-6">
        {customers.isLoading ? (
          <StateBlock type="loading" title="Carregando clientes" />
        ) : customers.isError ? (
          <StateBlock
            type="error"
            title="Erro ao carregar clientes"
            description={customers.error.message}
          />
        ) : (
          <>
            <BentoGrid>
              <MetricCard
                title="Clientes"
                value={customerList.length}
                detail="Cadastrados na base"
                icon={<Contact className="size-5" />}
              />
              <MetricCard
                title="Ativos"
                value={activeCount}
                detail="Liberados para atendimento"
                icon={<Phone className="size-5" />}
              />
              <MetricCard
                title="Com endereco"
                value={withAddress}
                detail="Prontos para entrega"
                icon={<MapPin className="size-5" />}
              />
              <MetricCard
                title="Bloqueados"
                value={blockedCount}
                detail="Requerem atencao"
                icon={<ShieldAlert className="size-5" />}
              />
            </BentoGrid>

            <Card className="border bg-white shadow-sm">
              <CardHeader>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <CardTitle>Base de clientes</CardTitle>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        className="w-full pl-9 sm:w-72"
                        placeholder="Codigo, nome, telefone, CEP..."
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                      />
                    </div>
                    <select
                      className={fieldClass}
                      value={statusFilter}
                      onChange={(event) =>
                        setStatusFilter(event.target.value as CustomerStatus | "all")
                      }
                    >
                      <option value="all">Todos os status</option>
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {statusLabel[status]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filteredCustomers.length === 0 ? (
                  <StateBlock
                    title="Nenhum cliente encontrado"
                    description={
                      customerList.length === 0
                        ? "Cadastre clientes para agilizar vendas e entregas."
                        : "Ajuste os filtros para ver mais clientes."
                    }
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="px-4 py-3 font-medium">Codigo</th>
                          <th className="px-4 py-3 font-medium">Cliente</th>
                          <th className="px-4 py-3 font-medium">Contato</th>
                          <th className="px-4 py-3 font-medium">Endereco</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                          <th className="px-4 py-3" />
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCustomers.map((customer) => (
                          <tr
                            key={customer.id}
                            className="border-b last:border-0 hover:bg-slate-50"
                          >
                            <td className="px-4 py-3 font-semibold">
                              {customer.customer_code}
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-medium">{customer.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {branchName(customer)}
                                {customer.document ? ` - ${customer.document}` : ""}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="space-y-1 text-xs text-muted-foreground">
                                {customer.phone ? (
                                  <div className="flex items-center gap-1">
                                    <Phone className="size-3" />
                                    {customer.phone}
                                  </div>
                                ) : null}
                                {customer.email ? (
                                  <div className="flex items-center gap-1">
                                    <Mail className="size-3" />
                                    {customer.email}
                                  </div>
                                ) : null}
                                {!customer.phone && !customer.email ? "Sem contato" : null}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">
                              {hasAddress(customer) ? (
                                <div>
                                  <div>
                                    {customer.address_line ?? "Endereco"}
                                    {customer.address_number ? `, ${customer.address_number}` : ""}
                                  </div>
                                  <div>
                                    {customer.neighborhood ? `${customer.neighborhood} - ` : ""}
                                    {customer.city ?? ""}
                                    {customer.state ? `/${customer.state}` : ""}
                                  </div>
                                  {customer.postal_code ? (
                                    <div>{formatCep(customer.postal_code)}</div>
                                  ) : null}
                                </div>
                              ) : (
                                "Sem endereco"
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant={statusBadgeVariant(customer.status)}>
                                {statusLabel[customer.status]}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  type="button"
                                  onClick={() => openEdit(customer)}
                                  aria-label={`Editar ${customer.name}`}
                                >
                                  <Pencil className="size-4" />
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="icon"
                                  type="button"
                                  onClick={() => void handleDelete(customer)}
                                  disabled={deleteCustomer.isPending}
                                  aria-label={`Excluir ${customer.name}`}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar cliente" : "Cadastrar cliente"}</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
            {editing ? (
              <div className="rounded-lg border bg-slate-50 px-3 py-2 text-sm">
                Codigo do cliente: <strong>{editing.customer_code}</strong>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-1 text-sm sm:col-span-2">
                <span className="font-medium">Nome *</span>
                <Input
                  required
                  value={form.name}
                  onChange={(event) => setField("name", event.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Status</span>
                <select
                  className={fieldClass}
                  value={form.status}
                  onChange={(event) =>
                    setField("status", event.target.value as CustomerStatus)
                  }
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {statusLabel[status]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-1 text-sm">
                <span className="font-medium">Filial</span>
                <select
                  className={fieldClass}
                  value={form.branch_id}
                  onChange={(event) => setField("branch_id", event.target.value)}
                >
                  <option value="">Todas as filiais</option>
                  {(branches.data ?? []).map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Documento</span>
                <Input
                  value={form.document}
                  onChange={(event) => setField("document", event.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Nascimento</span>
                <Input
                  type="date"
                  value={form.birth_date}
                  onChange={(event) => setField("birth_date", event.target.value)}
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium">Telefone</span>
                <Input
                  value={form.phone}
                  onChange={(event) => setField("phone", event.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">E-mail</span>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(event) => setField("email", event.target.value)}
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-[180px_1fr_auto]">
              <label className="space-y-1 text-sm">
                <span className="font-medium">CEP</span>
                <Input
                  value={form.postal_code}
                  onChange={(event) => setField("postal_code", event.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Endereco</span>
                <Input
                  value={form.address_line}
                  onChange={(event) => setField("address_line", event.target.value)}
                />
              </label>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void fillAddressFromCep()}
                  disabled={cepLoading}
                >
                  <MapPin className="size-4" />
                  Buscar CEP
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <label className="space-y-1 text-sm">
                <span className="font-medium">Numero</span>
                <Input
                  value={form.address_number}
                  onChange={(event) => setField("address_number", event.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Complemento</span>
                <Input
                  value={form.complement}
                  onChange={(event) => setField("complement", event.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Bairro</span>
                <Input
                  value={form.neighborhood}
                  onChange={(event) => setField("neighborhood", event.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Cidade</span>
                <Input
                  value={form.city}
                  onChange={(event) => setField("city", event.target.value)}
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
              <label className="space-y-1 text-sm">
                <span className="font-medium">UF</span>
                <Input
                  maxLength={2}
                  value={form.state}
                  onChange={(event) => setField("state", event.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Referencia</span>
                <Input
                  value={form.reference}
                  onChange={(event) => setField("reference", event.target.value)}
                />
              </label>
            </div>

            <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={form.marketing_opt_in}
                onChange={(event) => setField("marketing_opt_in", event.target.checked)}
              />
              Aceita comunicados e ofertas
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium">Observacoes</span>
              <textarea
                className={textareaClass}
                value={form.notes}
                onChange={(event) => setField("notes", event.target.value)}
              />
            </label>

            {formError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {formError}
              </div>
            ) : null}

            {(createCustomer.error || updateCustomer.error) ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {createCustomer.error?.message ?? updateCustomer.error?.message}
              </div>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                <Ban className="size-4" />
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createCustomer.isPending || updateCustomer.isPending}
              >
                {editing ? "Salvar cliente" : "Criar cliente"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
