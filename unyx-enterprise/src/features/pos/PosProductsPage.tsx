import { useState } from "react"
import type { FormEvent } from "react"
import { Barcode, Package, Pencil, Plus, Power, RefreshCw, Search } from "lucide-react"

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
  useCreateProduct,
  useProducts,
  useUpdateProduct,
} from "@/hooks/useUnyxData"
import { formatCurrency } from "@/lib/format"
import type { Product } from "@/types/domain"
import type { ProductInput } from "@/services/unyxApi"

const fieldClass =
  "h-8 w-full rounded-lg border bg-white px-2.5 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"

type ProductForm = {
  name: string
  barcode: string
  sku: string
  category: string
  unit: string
  price: string
  cost_price: string
  stock_quantity: string
  active: boolean
}

function emptyForm(): ProductForm {
  return {
    name: "",
    barcode: "",
    sku: "",
    category: "",
    unit: "un",
    price: "",
    cost_price: "",
    stock_quantity: "0",
    active: true,
  }
}

function formToInput(form: ProductForm): ProductInput {
  return {
    branch_id: null,
    name: form.name.trim(),
    barcode: form.barcode.trim() || null,
    sku: form.sku.trim() || null,
    category: form.category.trim() || null,
    unit: form.unit.trim() || "un",
    price: Number(form.price) || 0,
    cost_price: form.cost_price ? Number(form.cost_price) : null,
    stock_quantity: Number(form.stock_quantity) || 0,
  }
}

export function PosProductsPage() {
  const products = useProducts()
  const createProduct = useCreateProduct()
  const updateProduct = useUpdateProduct()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState<ProductForm>(emptyForm())
  const [formError, setFormError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("")

  const allProducts = products.data ?? []
  const activeProducts = allProducts.filter((p) => p.active)
  const categories = [...new Set(allProducts.map((p) => p.category).filter(Boolean))] as string[]

  const filtered = allProducts.filter((p) => {
    const matchesSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.barcode ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (p.sku ?? "").toLowerCase().includes(search.toLowerCase())
    const matchesCategory = !categoryFilter || p.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  function openCreate() {
    setEditing(null)
    setFormError(null)
    setForm(emptyForm())
    setDialogOpen(true)
  }

  function openEdit(product: Product) {
    setEditing(product)
    setFormError(null)
    setForm({
      name: product.name,
      barcode: product.barcode ?? "",
      sku: product.sku ?? "",
      category: product.category ?? "",
      unit: product.unit,
      price: String(product.price),
      cost_price: product.cost_price != null ? String(product.cost_price) : "",
      stock_quantity: String(product.stock_quantity),
      active: product.active,
    })
    setDialogOpen(true)
  }

  function setField<K extends keyof ProductForm>(key: K, value: ProductForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    try {
      if (editing) {
        await updateProduct.mutateAsync({
          productId: editing.id,
          values: { ...formToInput(form), active: form.active },
        })
      } else {
        await createProduct.mutateAsync(formToInput(form))
      }
      setDialogOpen(false)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Nao foi possivel salvar.")
    }
  }

  async function toggleActive(product: Product) {
    await updateProduct.mutateAsync({
      productId: product.id,
      values: { active: !product.active },
    })
  }

  return (
    <>
      <PageHeader
        title="Produtos"
        description="Catalogo de produtos para venda no PDV."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => void products.refetch()}
              aria-label="Atualizar produtos"
            >
              <RefreshCw className="size-4" />
            </Button>
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              Novo produto
            </Button>
          </div>
        }
      />

      <div className="space-y-6 p-6">
        {products.isLoading ? (
          <StateBlock type="loading" title="Carregando produtos" />
        ) : products.error ? (
          <StateBlock
            type="error"
            title="Erro ao carregar produtos"
            description="Rode supabase/pos_setup.sql no SQL Editor para ativar o modulo POS."
          />
        ) : (
          <>
            <BentoGrid>
              <MetricCard
                title="Total de produtos"
                value={allProducts.length}
                detail="Cadastrados no catalogo"
                icon={<Package className="size-5" />}
              />
              <MetricCard
                title="Ativos"
                value={activeProducts.length}
                detail="Disponiveis no PDV"
                icon={<Package className="size-5" />}
              />
              <MetricCard
                title="Categorias"
                value={categories.length}
                detail="Grupos distintos"
                icon={<Barcode className="size-5" />}
              />
            </BentoGrid>

            <Card className="border bg-white shadow-sm">
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle>Catalogo de produtos</CardTitle>
                  <div className="flex flex-wrap gap-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        className="w-48 pl-8"
                        placeholder="Buscar produto..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                    {categories.length > 0 && (
                      <select
                        className={`${fieldClass} w-36`}
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                      >
                        <option value="">Todas categorias</option>
                        {categories.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filtered.length === 0 ? (
                  <StateBlock
                    title="Nenhum produto encontrado"
                    description={
                      allProducts.length === 0
                        ? "Cadastre produtos para comecar a vender no PDV."
                        : "Nenhum produto corresponde ao filtro."
                    }
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="px-4 py-3 font-medium">Produto</th>
                          <th className="px-4 py-3 font-medium">Categoria</th>
                          <th className="px-4 py-3 font-medium">Unidade</th>
                          <th className="px-4 py-3 font-medium">Preco</th>
                          <th className="px-4 py-3 font-medium">Estoque</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                          <th className="px-4 py-3" />
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((product) => (
                          <tr key={product.id} className="border-b last:border-0 hover:bg-slate-50">
                            <td className="px-4 py-3">
                              <div className="font-medium">{product.name}</div>
                              {product.barcode ? (
                                <div className="text-xs text-muted-foreground">{product.barcode}</div>
                              ) : null}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {product.category ?? "-"}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{product.unit}</td>
                            <td className="px-4 py-3 font-medium">{formatCurrency(product.price)}</td>
                            <td className="px-4 py-3">{product.stock_quantity}</td>
                            <td className="px-4 py-3">
                              <Badge variant={product.active ? "outline" : "secondary"}>
                                {product.active ? "Ativo" : "Inativo"}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => openEdit(product)}
                                  aria-label={`Editar ${product.name}`}
                                >
                                  <Pencil className="size-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => void toggleActive(product)}
                                  aria-label={product.active ? "Desativar" : "Ativar"}
                                >
                                  <Power className="size-4" />
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
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar produto" : "Cadastrar produto"}</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(e) => void handleSubmit(e)}>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Nome *</span>
              <Input
                required
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium">Codigo de barras</span>
                <Input
                  value={form.barcode}
                  onChange={(e) => setField("barcode", e.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">SKU</span>
                <Input
                  value={form.sku}
                  onChange={(e) => setField("sku", e.target.value)}
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium">Categoria</span>
                <Input
                  value={form.category}
                  onChange={(e) => setField("category", e.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Unidade</span>
                <select
                  className={fieldClass}
                  value={form.unit}
                  onChange={(e) => setField("unit", e.target.value)}
                >
                  <option value="un">Unidade (un)</option>
                  <option value="kg">Quilograma (kg)</option>
                  <option value="g">Grama (g)</option>
                  <option value="L">Litro (L)</option>
                  <option value="ml">Mililitro (ml)</option>
                  <option value="cx">Caixa (cx)</option>
                  <option value="pct">Pacote (pct)</option>
                </select>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-1 text-sm">
                <span className="font-medium">Preco de venda *</span>
                <Input
                  required
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.price}
                  onChange={(e) => setField("price", e.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Custo</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.cost_price}
                  onChange={(e) => setField("cost_price", e.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Estoque</span>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  value={form.stock_quantity}
                  onChange={(e) => setField("stock_quantity", e.target.value)}
                />
              </label>
            </div>

            {editing ? (
              <label className="space-y-1 text-sm">
                <span className="font-medium">Status</span>
                <select
                  className={fieldClass}
                  value={form.active ? "active" : "inactive"}
                  onChange={(e) => setField("active", e.target.value === "active")}
                >
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                </select>
              </label>
            ) : null}

            {formError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {formError}
              </div>
            ) : null}

            <DialogFooter>
              <Button
                type="submit"
                disabled={createProduct.isPending || updateProduct.isPending}
              >
                {editing ? "Salvar produto" : "Criar produto"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
