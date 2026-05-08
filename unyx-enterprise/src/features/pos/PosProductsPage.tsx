import { useMemo, useState } from "react"
import type { FormEvent } from "react"
import {
  AlertTriangle,
  Barcode,
  Boxes,
  Layers,
  Package,
  Pencil,
  Pill,
  Plus,
  Power,
  RefreshCw,
  Ruler,
  Search,
  Tags,
  Trash2,
  Utensils,
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
  useCreateProduct,
  useCreateProductCategory,
  useCreateProductVariant,
  useDeleteProduct,
  useDeleteProductCategory,
  useDeleteProductVariant,
  useProductCategories,
  useProducts,
  useProductVariants,
  useUpdateProduct,
  useUpdateProductCategory,
  useUpdateProductVariant,
} from "@/hooks/useUnyxData"
import { formatCurrency } from "@/lib/format"
import { useAppStore } from "@/store/useAppStore"
import type {
  Branch,
  Product,
  ProductCategory,
  ProductCategorySegment,
  ProductKind,
  ProductVariant,
} from "@/types/domain"
import type {
  ProductCategoryInput,
  ProductInput,
  ProductVariantInput,
} from "@/services/unyxApi"

const fieldClass =
  "h-8 w-full rounded-lg border bg-white px-2.5 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"

const textAreaClass =
  "min-h-20 w-full rounded-lg border bg-white px-2.5 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"

const productKindLabel: Record<ProductKind, string> = {
  retail: "Varejo",
  food: "Alimento / preparo",
  medicine: "Medicamento",
  service: "Servico",
}

const productKindOptions: Array<{ value: ProductKind; label: string }> = [
  { value: "retail", label: productKindLabel.retail },
  { value: "food", label: productKindLabel.food },
  { value: "medicine", label: productKindLabel.medicine },
  { value: "service", label: productKindLabel.service },
]

const segmentLabel: Record<ProductCategorySegment, string> = {
  all: "Todos",
  supermarket: "Supermercado",
  retail_store: "Varejo / atacado",
  restaurant: "Restaurante",
  pharmacy: "Farmacia",
  other: "Outro",
}

const segmentOptions: Array<{ value: ProductCategorySegment; label: string }> =
  [
    { value: "all", label: segmentLabel.all },
    { value: "supermarket", label: segmentLabel.supermarket },
    { value: "retail_store", label: segmentLabel.retail_store },
    { value: "restaurant", label: segmentLabel.restaurant },
    { value: "pharmacy", label: segmentLabel.pharmacy },
    { value: "other", label: segmentLabel.other },
  ]

const unitOptions = [
  ["un", "Unidade (un)"],
  ["kg", "Quilograma (kg)"],
  ["g", "Grama (g)"],
  ["L", "Litro (L)"],
  ["ml", "Mililitro (ml)"],
  ["cx", "Caixa (cx)"],
  ["pct", "Pacote (pct)"],
  ["dose", "Dose"],
  ["porcao", "Porcao"],
]

type ProductForm = {
  branch_id: string
  category_id: string
  name: string
  description: string
  barcode: string
  sku: string
  category: string
  brand: string
  product_kind: ProductKind
  size_label: string
  dosage: string
  unit: string
  price: string
  cost_price: string
  stock_quantity: string
  min_stock_quantity: string
  track_inventory: boolean
  allow_fractional_quantity: boolean
  perishable: boolean
  prescription_required: boolean
  controlled_substance: boolean
  preparation_time_minutes: string
  active: boolean
}

type CategoryForm = {
  branch_id: string
  name: string
  description: string
  segment: ProductCategorySegment
  active: boolean
}

type VariantForm = {
  name: string
  barcode: string
  sku: string
  price: string
  cost_price: string
  stock_quantity: string
  sort_order: string
  active: boolean
}

function emptyProductForm(branchId?: string | null): ProductForm {
  return {
    branch_id: branchId ?? "",
    category_id: "",
    name: "",
    description: "",
    barcode: "",
    sku: "",
    category: "",
    brand: "",
    product_kind: "retail",
    size_label: "",
    dosage: "",
    unit: "un",
    price: "",
    cost_price: "",
    stock_quantity: "0",
    min_stock_quantity: "0",
    track_inventory: true,
    allow_fractional_quantity: false,
    perishable: false,
    prescription_required: false,
    controlled_substance: false,
    preparation_time_minutes: "",
    active: true,
  }
}

function emptyCategoryForm(branchId?: string | null): CategoryForm {
  return {
    branch_id: branchId ?? "",
    name: "",
    description: "",
    segment: "all",
    active: true,
  }
}

function emptyVariantForm(product?: Product | null): VariantForm {
  return {
    name: "",
    barcode: "",
    sku: "",
    price: product ? String(product.price ?? 0) : "",
    cost_price:
      product?.cost_price != null ? String(product.cost_price) : "",
    stock_quantity: "0",
    sort_order: "0",
    active: true,
  }
}

function optionalMoney(value: string) {
  return value.trim() ? Math.max(0, Number(value) || 0) : null
}

function optionalMinutes(value: string) {
  return value.trim() ? Math.max(0, Math.round(Number(value) || 0)) : null
}

function productFormToInput(
  form: ProductForm,
  categories: ProductCategory[]
): ProductInput {
  const selectedCategory = categories.find((category) => category.id === form.category_id)
  return {
    branch_id: form.branch_id || null,
    category_id: form.category_id || null,
    name: form.name.trim(),
    description: form.description.trim() || null,
    barcode: form.barcode.trim() || null,
    sku: form.sku.trim() || null,
    category: form.category.trim() || selectedCategory?.name || null,
    brand: form.brand.trim() || null,
    product_kind: form.product_kind,
    size_label: form.size_label.trim() || null,
    dosage: form.dosage.trim() || null,
    unit: form.unit.trim() || "un",
    price: Math.max(0, Number(form.price) || 0),
    cost_price: optionalMoney(form.cost_price),
    stock_quantity: Math.max(0, Number(form.stock_quantity) || 0),
    min_stock_quantity: Math.max(0, Number(form.min_stock_quantity) || 0),
    track_inventory: form.track_inventory,
    allow_fractional_quantity: form.allow_fractional_quantity,
    perishable: form.perishable,
    prescription_required: form.prescription_required,
    controlled_substance: form.controlled_substance,
    preparation_time_minutes: optionalMinutes(form.preparation_time_minutes),
  }
}

function categoryFormToInput(form: CategoryForm): ProductCategoryInput {
  return {
    branch_id: form.branch_id || null,
    name: form.name.trim(),
    description: form.description.trim() || null,
    segment: form.segment,
  }
}

function variantFormToInput(
  productId: string,
  form: VariantForm
): ProductVariantInput {
  return {
    product_id: productId,
    name: form.name.trim(),
    barcode: form.barcode.trim() || null,
    sku: form.sku.trim() || null,
    price: Math.max(0, Number(form.price) || 0),
    cost_price: optionalMoney(form.cost_price),
    stock_quantity: Math.max(0, Number(form.stock_quantity) || 0),
    sort_order: Math.round(Number(form.sort_order) || 0),
  }
}

function productCategoryName(
  product: Product,
  categoriesById: Map<string, ProductCategory>
) {
  const structuredName = product.category_id
    ? categoriesById.get(product.category_id)?.name
    : null
  return (
    structuredName ??
    product.product_categories?.name ??
    product.category ??
    "Sem categoria"
  )
}

function branchName(branches: Branch[], branchId: string | null) {
  if (!branchId) return "Todas as filiais"
  return branches.find((branch) => branch.id === branchId)?.name ?? "Filial"
}

function isLowStock(product: Product) {
  if (!(product.track_inventory ?? true)) return false
  return product.active && product.stock_quantity <= (product.min_stock_quantity ?? 0)
}

function isOutOfStock(product: Product) {
  if (!(product.track_inventory ?? true)) return false
  return product.stock_quantity <= 0
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Rode supabase/pos_setup.sql no SQL Editor para ativar o modulo POS."
}

export function PosProductsPage() {
  const selectedBranchId = useAppStore((state) => state.selectedBranchId)
  const branches = useBranches()
  const products = useProducts()
  const categories = useProductCategories()
  const variants = useProductVariants()
  const createProduct = useCreateProduct()
  const updateProduct = useUpdateProduct()
  const deleteProduct = useDeleteProduct()
  const createCategory = useCreateProductCategory()
  const updateCategory = useUpdateProductCategory()
  const deleteCategory = useDeleteProductCategory()
  const createVariant = useCreateProductVariant()
  const updateVariant = useUpdateProductVariant()
  const deleteVariant = useDeleteProductVariant()

  const [activeView, setActiveView] = useState<"products" | "categories">("products")
  const [productDialogOpen, setProductDialogOpen] = useState(false)
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [variantDialogOpen, setVariantDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [editingCategory, setEditingCategory] = useState<ProductCategory | null>(null)
  const [variantProduct, setVariantProduct] = useState<Product | null>(null)
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null)
  const [productForm, setProductForm] = useState<ProductForm>(
    emptyProductForm(selectedBranchId)
  )
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(
    emptyCategoryForm(selectedBranchId)
  )
  const [variantForm, setVariantForm] = useState<VariantForm>(emptyVariantForm())
  const [formError, setFormError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("")
  const [kindFilter, setKindFilter] = useState("")
  const [stockFilter, setStockFilter] = useState("all")

  const allProducts = useMemo(() => products.data ?? [], [products.data])
  const allCategories = useMemo(() => categories.data ?? [], [categories.data])
  const allVariants = useMemo(() => variants.data ?? [], [variants.data])
  const allBranches = useMemo(() => branches.data ?? [], [branches.data])

  const categoriesById = useMemo(() => {
    return new Map(allCategories.map((category) => [category.id, category]))
  }, [allCategories])

  const variantsByProduct = useMemo(() => {
    const grouped = new Map<string, ProductVariant[]>()
    allVariants.forEach((variant) => {
      const current = grouped.get(variant.product_id) ?? []
      current.push(variant)
      grouped.set(variant.product_id, current)
    })
    return grouped
  }, [allVariants])

  const categoryNames = useMemo(() => {
    const names = new Set<string>()
    allCategories.forEach((category) => names.add(category.name))
    allProducts.forEach((product) =>
      names.add(productCategoryName(product, categoriesById))
    )
    names.delete("Sem categoria")
    return Array.from(names).sort((a, b) => a.localeCompare(b))
  }, [allCategories, allProducts, categoriesById])

  const compatibleCategories = allCategories.filter((category) => {
    const branchMatches =
      !category.branch_id ||
      (Boolean(productForm.branch_id) && category.branch_id === productForm.branch_id)
    return branchMatches && (category.active || category.id === productForm.category_id)
  })

  const activeProducts = allProducts.filter((product) => product.active)
  const lowStockProducts = allProducts.filter(isLowStock)
  const loadError = products.error ?? categories.error ?? variants.error
  const isLoading = products.isLoading || categories.isLoading || variants.isLoading

  const filteredProducts = allProducts.filter((product) => {
    const categoryName = productCategoryName(product, categoriesById)
    const searchText = [
      product.name,
      product.barcode,
      product.sku,
      product.brand,
      product.description,
      categoryName,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
    const q = search.trim().toLowerCase()
    const matchesSearch = !q || searchText.includes(q)
    const matchesCategory = !categoryFilter || categoryName === categoryFilter
    const matchesKind = !kindFilter || product.product_kind === kindFilter
    const matchesStock =
      stockFilter === "all" ||
      (stockFilter === "low" && isLowStock(product)) ||
      (stockFilter === "out" && isOutOfStock(product)) ||
      (stockFilter === "inactive" && !product.active)
    return matchesSearch && matchesCategory && matchesKind && matchesStock
  })

  const selectedProductVariants = variantProduct
    ? variantsByProduct.get(variantProduct.id) ?? []
    : []

  function refetchAll() {
    void Promise.all([
      products.refetch(),
      categories.refetch(),
      variants.refetch(),
    ])
  }

  function setProductField<K extends keyof ProductForm>(
    key: K,
    value: ProductForm[K]
  ) {
    setProductForm((prev) => ({ ...prev, [key]: value }))
  }

  function setCategoryField<K extends keyof CategoryForm>(
    key: K,
    value: CategoryForm[K]
  ) {
    setCategoryForm((prev) => ({ ...prev, [key]: value }))
  }

  function setVariantField<K extends keyof VariantForm>(
    key: K,
    value: VariantForm[K]
  ) {
    setVariantForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleProductBranchChange(branchId: string) {
    setProductForm((prev) => {
      const selectedCategory = prev.category_id
        ? categoriesById.get(prev.category_id)
        : null
      const categoryStillValid =
        !selectedCategory?.branch_id || selectedCategory.branch_id === branchId
      return {
        ...prev,
        branch_id: branchId,
        category_id: categoryStillValid ? prev.category_id : "",
      }
    })
  }

  function openCreateProduct() {
    setEditingProduct(null)
    setFormError(null)
    setProductForm(emptyProductForm(selectedBranchId))
    setProductDialogOpen(true)
  }

  function openEditProduct(product: Product) {
    setEditingProduct(product)
    setFormError(null)
    setProductForm({
      branch_id: product.branch_id ?? "",
      category_id: product.category_id ?? "",
      name: product.name,
      description: product.description ?? "",
      barcode: product.barcode ?? "",
      sku: product.sku ?? "",
      category: product.category ?? "",
      brand: product.brand ?? "",
      product_kind: product.product_kind ?? "retail",
      size_label: product.size_label ?? "",
      dosage: product.dosage ?? "",
      unit: product.unit,
      price: String(product.price),
      cost_price: product.cost_price != null ? String(product.cost_price) : "",
      stock_quantity: String(product.stock_quantity ?? 0),
      min_stock_quantity: String(product.min_stock_quantity ?? 0),
      track_inventory: product.track_inventory ?? true,
      allow_fractional_quantity: product.allow_fractional_quantity ?? false,
      perishable: product.perishable ?? false,
      prescription_required: product.prescription_required ?? false,
      controlled_substance: product.controlled_substance ?? false,
      preparation_time_minutes:
        product.preparation_time_minutes != null
          ? String(product.preparation_time_minutes)
          : "",
      active: product.active,
    })
    setProductDialogOpen(true)
  }

  function openCreateCategory() {
    setEditingCategory(null)
    setFormError(null)
    setCategoryForm(emptyCategoryForm(selectedBranchId))
    setCategoryDialogOpen(true)
  }

  function openEditCategory(category: ProductCategory) {
    setEditingCategory(category)
    setFormError(null)
    setCategoryForm({
      branch_id: category.branch_id ?? "",
      name: category.name,
      description: category.description ?? "",
      segment: category.segment,
      active: category.active,
    })
    setCategoryDialogOpen(true)
  }

  function openVariants(product: Product) {
    setVariantProduct(product)
    setEditingVariant(null)
    setVariantForm(emptyVariantForm(product))
    setFormError(null)
    setVariantDialogOpen(true)
  }

  function openEditVariant(variant: ProductVariant) {
    setEditingVariant(variant)
    setFormError(null)
    setVariantForm({
      name: variant.name,
      barcode: variant.barcode ?? "",
      sku: variant.sku ?? "",
      price: String(variant.price),
      cost_price: variant.cost_price != null ? String(variant.cost_price) : "",
      stock_quantity: String(variant.stock_quantity),
      sort_order: String(variant.sort_order),
      active: variant.active,
    })
  }

  async function handleProductSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    try {
      const input = productFormToInput(productForm, allCategories)
      if (editingProduct) {
        await updateProduct.mutateAsync({
          productId: editingProduct.id,
          values: { ...input, active: productForm.active },
        })
      } else {
        await createProduct.mutateAsync(input)
      }
      setProductDialogOpen(false)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Nao foi possivel salvar.")
    }
  }

  async function handleCategorySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    try {
      const input = categoryFormToInput(categoryForm)
      if (editingCategory) {
        await updateCategory.mutateAsync({
          categoryId: editingCategory.id,
          values: { ...input, active: categoryForm.active },
        })
      } else {
        await createCategory.mutateAsync(input)
      }
      setCategoryDialogOpen(false)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Nao foi possivel salvar.")
    }
  }

  async function handleVariantSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!variantProduct) return
    setFormError(null)
    try {
      const input = variantFormToInput(variantProduct.id, variantForm)
      if (editingVariant) {
        await updateVariant.mutateAsync({
          variantId: editingVariant.id,
          values: { ...input, active: variantForm.active },
        })
      } else {
        await createVariant.mutateAsync(input)
      }
      setEditingVariant(null)
      setVariantForm(emptyVariantForm(variantProduct))
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Nao foi possivel salvar.")
    }
  }

  async function toggleProductActive(product: Product) {
    await updateProduct.mutateAsync({
      productId: product.id,
      values: { active: !product.active },
    })
  }

  async function toggleCategoryActive(category: ProductCategory) {
    await updateCategory.mutateAsync({
      categoryId: category.id,
      values: { active: !category.active },
    })
  }

  async function toggleVariantActive(variant: ProductVariant) {
    await updateVariant.mutateAsync({
      variantId: variant.id,
      values: { active: !variant.active },
    })
  }

  async function handleDeleteProduct(product: Product) {
    if (!window.confirm(`Excluir o produto ${product.name}?`)) return
    await deleteProduct.mutateAsync(product.id)
  }

  async function handleDeleteCategory(category: ProductCategory) {
    if (!window.confirm(`Excluir a categoria ${category.name}?`)) return
    await deleteCategory.mutateAsync(category.id)
  }

  async function handleDeleteVariant(variant: ProductVariant) {
    if (!window.confirm(`Excluir a variacao ${variant.name}?`)) return
    await deleteVariant.mutateAsync(variant.id)
  }

  return (
    <>
      <PageHeader
        title="Catalogo PDV"
        description="Produtos, categorias, tamanhos e regras comerciais por segmento."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              type="button"
              onClick={refetchAll}
              aria-label="Atualizar catalogo"
            >
              <RefreshCw className="size-4" />
            </Button>
            <Button variant="outline" type="button" onClick={openCreateCategory}>
              <Tags className="size-4" />
              Nova categoria
            </Button>
            <Button type="button" onClick={openCreateProduct}>
              <Plus className="size-4" />
              Novo produto
            </Button>
          </div>
        }
      />

      <div className="space-y-6 p-6">
        {isLoading ? (
          <StateBlock type="loading" title="Carregando catalogo" />
        ) : loadError ? (
          <StateBlock
            type="error"
            title="Erro ao carregar catalogo"
            description={errorMessage(loadError)}
          />
        ) : (
          <>
            <BentoGrid>
              <MetricCard
                title="Produtos"
                value={allProducts.length}
                detail={`${activeProducts.length} ativos no PDV`}
                icon={<Package className="size-5" />}
              />
              <MetricCard
                title="Categorias"
                value={allCategories.length}
                detail="Estruturadas por segmento"
                icon={<Tags className="size-5" />}
              />
              <MetricCard
                title="Variacoes"
                value={allVariants.length}
                detail="Tamanhos, sabores, doses e SKUs"
                icon={<Ruler className="size-5" />}
              />
              <MetricCard
                title="Alertas"
                value={lowStockProducts.length}
                detail="Produtos com estoque baixo"
                icon={<AlertTriangle className="size-5" />}
              />
            </BentoGrid>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant={activeView === "products" ? "default" : "outline"}
                onClick={() => setActiveView("products")}
              >
                <Package className="size-4" />
                Produtos
              </Button>
              <Button
                type="button"
                variant={activeView === "categories" ? "default" : "outline"}
                onClick={() => setActiveView("categories")}
              >
                <Layers className="size-4" />
                Categorias
              </Button>
            </div>

            {activeView === "products" ? (
              <Card className="border bg-white shadow-sm">
                <CardHeader>
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <CardTitle>Produtos cadastrados</CardTitle>
                    <div className="flex flex-wrap gap-2">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          className="w-56 pl-8"
                          placeholder="Buscar nome, codigo, marca..."
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                      </div>
                      <select
                        className={`${fieldClass} w-40`}
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                      >
                        <option value="">Todas categorias</option>
                        {categoryNames.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                      <select
                        className={`${fieldClass} w-36`}
                        value={kindFilter}
                        onChange={(e) => setKindFilter(e.target.value)}
                      >
                        <option value="">Todos tipos</option>
                        {productKindOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <select
                        className={`${fieldClass} w-36`}
                        value={stockFilter}
                        onChange={(e) => setStockFilter(e.target.value)}
                      >
                        <option value="all">Todo estoque</option>
                        <option value="low">Estoque baixo</option>
                        <option value="out">Sem estoque</option>
                        <option value="inactive">Inativos</option>
                      </select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {filteredProducts.length === 0 ? (
                    <StateBlock
                      title="Nenhum produto encontrado"
                      description={
                        allProducts.length === 0
                          ? "Cadastre produtos para vender no PDV."
                          : "Ajuste os filtros para visualizar mais itens."
                      }
                    />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-muted-foreground">
                            <th className="px-4 py-3 font-medium">Produto</th>
                            <th className="px-4 py-3 font-medium">Segmento</th>
                            <th className="px-4 py-3 font-medium">Preco</th>
                            <th className="px-4 py-3 font-medium">Estoque</th>
                            <th className="px-4 py-3 font-medium">Regras</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3" />
                          </tr>
                        </thead>
                        <tbody>
                          {filteredProducts.map((product) => {
                            const productVariants =
                              variantsByProduct.get(product.id) ?? []
                            const categoryName = productCategoryName(
                              product,
                              categoriesById
                            )
                            return (
                              <tr
                                key={product.id}
                                className="border-b last:border-0 hover:bg-slate-50"
                              >
                                <td className="px-4 py-3">
                                  <div className="font-medium">{product.name}</div>
                                  <div className="mt-1 flex flex-wrap gap-1 text-xs text-muted-foreground">
                                    {product.barcode ? (
                                      <span className="inline-flex items-center gap-1">
                                        <Barcode className="size-3" />
                                        {product.barcode}
                                      </span>
                                    ) : null}
                                    {product.sku ? <span>SKU {product.sku}</span> : null}
                                    {product.brand ? <span>{product.brand}</span> : null}
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex flex-wrap gap-1">
                                    <Badge variant="outline">{categoryName}</Badge>
                                    <Badge variant="secondary">
                                      {productKindLabel[product.product_kind] ??
                                        product.product_kind}
                                    </Badge>
                                    {product.size_label ? (
                                      <Badge variant="outline">{product.size_label}</Badge>
                                    ) : null}
                                  </div>
                                  <div className="mt-1 text-xs text-muted-foreground">
                                    {branchName(allBranches, product.branch_id)}
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="font-medium">
                                    {formatCurrency(product.price)}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    Custo{" "}
                                    {product.cost_price != null
                                      ? formatCurrency(product.cost_price)
                                      : "-"}
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  {product.track_inventory ?? true ? (
                                    <div>
                                      <div
                                        className={
                                          isLowStock(product)
                                            ? "font-semibold text-amber-700"
                                            : "font-medium"
                                        }
                                      >
                                        {product.stock_quantity} {product.unit}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        Min. {product.min_stock_quantity ?? 0}
                                      </div>
                                    </div>
                                  ) : (
                                    <Badge variant="secondary">Nao controla</Badge>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex flex-wrap gap-1">
                                    {product.allow_fractional_quantity ? (
                                      <Badge variant="outline">Fracionado</Badge>
                                    ) : null}
                                    {product.perishable ? (
                                      <Badge variant="outline">Perecivel</Badge>
                                    ) : null}
                                    {product.prescription_required ? (
                                      <Badge variant="outline">Receita</Badge>
                                    ) : null}
                                    {product.controlled_substance ? (
                                      <Badge variant="outline">Controlado</Badge>
                                    ) : null}
                                    {product.preparation_time_minutes ? (
                                      <Badge variant="outline">
                                        {product.preparation_time_minutes} min
                                      </Badge>
                                    ) : null}
                                    {productVariants.length > 0 ? (
                                      <Badge variant="secondary">
                                        {productVariants.length} var.
                                      </Badge>
                                    ) : null}
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <Badge
                                    variant={product.active ? "outline" : "secondary"}
                                  >
                                    {product.active ? "Ativo" : "Inativo"}
                                  </Badge>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex justify-end gap-1">
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      type="button"
                                      onClick={() => openVariants(product)}
                                      aria-label={`Variacoes de ${product.name}`}
                                    >
                                      <Ruler className="size-4" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      type="button"
                                      onClick={() => openEditProduct(product)}
                                      aria-label={`Editar ${product.name}`}
                                    >
                                      <Pencil className="size-4" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      type="button"
                                      onClick={() => void toggleProductActive(product)}
                                      aria-label={
                                        product.active ? "Desativar" : "Ativar"
                                      }
                                    >
                                      <Power className="size-4" />
                                    </Button>
                                    <Button
                                      variant="destructive"
                                      size="icon"
                                      type="button"
                                      onClick={() => void handleDeleteProduct(product)}
                                      aria-label={`Excluir ${product.name}`}
                                    >
                                      <Trash2 className="size-4" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="border bg-white shadow-sm">
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <CardTitle>Categorias do catalogo</CardTitle>
                    <Button type="button" onClick={openCreateCategory}>
                      <Plus className="size-4" />
                      Nova categoria
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {allCategories.length === 0 ? (
                    <StateBlock
                      title="Nenhuma categoria cadastrada"
                      description="Crie categorias para organizar supermercados, restaurantes, farmacias e varejo."
                    />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-muted-foreground">
                            <th className="px-4 py-3 font-medium">Categoria</th>
                            <th className="px-4 py-3 font-medium">Segmento</th>
                            <th className="px-4 py-3 font-medium">Filial</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3" />
                          </tr>
                        </thead>
                        <tbody>
                          {allCategories.map((category) => (
                            <tr
                              key={category.id}
                              className="border-b last:border-0 hover:bg-slate-50"
                            >
                              <td className="px-4 py-3">
                                <div className="font-medium">{category.name}</div>
                                {category.description ? (
                                  <div className="text-xs text-muted-foreground">
                                    {category.description}
                                  </div>
                                ) : null}
                              </td>
                              <td className="px-4 py-3">
                                {segmentLabel[category.segment] ?? category.segment}
                              </td>
                              <td className="px-4 py-3 text-muted-foreground">
                                {branchName(allBranches, category.branch_id)}
                              </td>
                              <td className="px-4 py-3">
                                <Badge
                                  variant={category.active ? "outline" : "secondary"}
                                >
                                  {category.active ? "Ativa" : "Inativa"}
                                </Badge>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex justify-end gap-1">
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    type="button"
                                    onClick={() => openEditCategory(category)}
                                    aria-label={`Editar ${category.name}`}
                                  >
                                    <Pencil className="size-4" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    type="button"
                                    onClick={() => void toggleCategoryActive(category)}
                                    aria-label={
                                      category.active ? "Desativar" : "Ativar"
                                    }
                                  >
                                    <Power className="size-4" />
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    size="icon"
                                    type="button"
                                    onClick={() => void handleDeleteCategory(category)}
                                    aria-label={`Excluir ${category.name}`}
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
            )}
          </>
        )}
      </div>

      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? "Editar produto" : "Cadastrar produto"}
            </DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(e) => void handleProductSubmit(e)}>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm sm:col-span-2">
                <span className="font-medium">Nome *</span>
                <Input
                  required
                  value={productForm.name}
                  onChange={(e) => setProductField("name", e.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Filial</span>
                <select
                  className={fieldClass}
                  value={productForm.branch_id}
                  onChange={(e) => handleProductBranchChange(e.target.value)}
                >
                  <option value="">Todas as filiais</option>
                  {allBranches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Tipo</span>
                <select
                  className={fieldClass}
                  value={productForm.product_kind}
                  onChange={(e) =>
                    setProductField("product_kind", e.target.value as ProductKind)
                  }
                >
                  {productKindOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Categoria estruturada</span>
                <select
                  className={fieldClass}
                  value={productForm.category_id}
                  onChange={(e) => setProductField("category_id", e.target.value)}
                >
                  <option value="">Sem categoria</option>
                  {compatibleCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Categoria livre</span>
                <Input
                  value={productForm.category}
                  onChange={(e) => setProductField("category", e.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm sm:col-span-2">
                <span className="font-medium">Descricao</span>
                <textarea
                  className={textAreaClass}
                  value={productForm.description}
                  onChange={(e) => setProductField("description", e.target.value)}
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-1 text-sm">
                <span className="font-medium">Codigo de barras</span>
                <Input
                  value={productForm.barcode}
                  onChange={(e) => setProductField("barcode", e.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">SKU</span>
                <Input
                  value={productForm.sku}
                  onChange={(e) => setProductField("sku", e.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Marca / laboratorio</span>
                <Input
                  value={productForm.brand}
                  onChange={(e) => setProductField("brand", e.target.value)}
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <label className="space-y-1 text-sm">
                <span className="font-medium">Unidade</span>
                <select
                  className={fieldClass}
                  value={productForm.unit}
                  onChange={(e) => setProductField("unit", e.target.value)}
                >
                  {unitOptions.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Tamanho / embalagem</span>
                <Input
                  placeholder="500g, P, G, 30cp..."
                  value={productForm.size_label}
                  onChange={(e) => setProductField("size_label", e.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Dosagem</span>
                <Input
                  placeholder="500mg, 20ml..."
                  value={productForm.dosage}
                  onChange={(e) => setProductField("dosage", e.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Preparo (min)</span>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={productForm.preparation_time_minutes}
                  onChange={(e) =>
                    setProductField("preparation_time_minutes", e.target.value)
                  }
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <label className="space-y-1 text-sm">
                <span className="font-medium">Preco de venda *</span>
                <Input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={productForm.price}
                  onChange={(e) => setProductField("price", e.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Custo</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={productForm.cost_price}
                  onChange={(e) => setProductField("cost_price", e.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Estoque</span>
                <Input
                  type="number"
                  min="0"
                  step={productForm.allow_fractional_quantity ? "0.001" : "1"}
                  value={productForm.stock_quantity}
                  onChange={(e) => setProductField("stock_quantity", e.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Estoque minimo</span>
                <Input
                  type="number"
                  min="0"
                  step={productForm.allow_fractional_quantity ? "0.001" : "1"}
                  value={productForm.min_stock_quantity}
                  onChange={(e) =>
                    setProductField("min_stock_quantity", e.target.value)
                  }
                />
              </label>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={productForm.track_inventory}
                  onChange={(e) =>
                    setProductField("track_inventory", e.target.checked)
                  }
                />
                <Boxes className="size-4 text-muted-foreground" />
                Controla estoque
              </label>
              <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={productForm.allow_fractional_quantity}
                  onChange={(e) =>
                    setProductField("allow_fractional_quantity", e.target.checked)
                  }
                />
                <Ruler className="size-4 text-muted-foreground" />
                Quantidade fracionada
              </label>
              <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={productForm.perishable}
                  onChange={(e) => setProductField("perishable", e.target.checked)}
                />
                <Utensils className="size-4 text-muted-foreground" />
                Perecivel
              </label>
              <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={productForm.prescription_required}
                  onChange={(e) =>
                    setProductField("prescription_required", e.target.checked)
                  }
                />
                <Pill className="size-4 text-muted-foreground" />
                Exige receita
              </label>
              <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={productForm.controlled_substance}
                  onChange={(e) =>
                    setProductField("controlled_substance", e.target.checked)
                  }
                />
                <AlertTriangle className="size-4 text-muted-foreground" />
                Controlado
              </label>
              {editingProduct ? (
                <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={productForm.active}
                    onChange={(e) => setProductField("active", e.target.checked)}
                  />
                  <Power className="size-4 text-muted-foreground" />
                  Ativo
                </label>
              ) : null}
            </div>

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
                {editingProduct ? "Salvar produto" : "Criar produto"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? "Editar categoria" : "Criar categoria"}
            </DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(e) => void handleCategorySubmit(e)}>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Nome *</span>
              <Input
                required
                value={categoryForm.name}
                onChange={(e) => setCategoryField("name", e.target.value)}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium">Segmento</span>
                <select
                  className={fieldClass}
                  value={categoryForm.segment}
                  onChange={(e) =>
                    setCategoryField("segment", e.target.value as ProductCategorySegment)
                  }
                >
                  {segmentOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Filial</span>
                <select
                  className={fieldClass}
                  value={categoryForm.branch_id}
                  onChange={(e) => setCategoryField("branch_id", e.target.value)}
                >
                  <option value="">Todas as filiais</option>
                  {allBranches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Descricao</span>
              <textarea
                className={textAreaClass}
                value={categoryForm.description}
                onChange={(e) => setCategoryField("description", e.target.value)}
              />
            </label>
            {editingCategory ? (
              <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={categoryForm.active}
                  onChange={(e) => setCategoryField("active", e.target.checked)}
                />
                Ativa
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
                disabled={createCategory.isPending || updateCategory.isPending}
              >
                {editingCategory ? "Salvar categoria" : "Criar categoria"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={variantDialogOpen}
        onOpenChange={(open) => {
          setVariantDialogOpen(open)
          if (!open) {
            setVariantProduct(null)
            setEditingVariant(null)
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              Variacoes {variantProduct ? `- ${variantProduct.name}` : ""}
            </DialogTitle>
          </DialogHeader>
          {variantProduct ? (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
              <div className="space-y-2">
                {selectedProductVariants.length === 0 ? (
                  <StateBlock title="Nenhuma variacao cadastrada" />
                ) : (
                  selectedProductVariants.map((variant) => (
                    <div
                      key={variant.id}
                      className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{variant.name}</span>
                          <Badge variant={variant.active ? "outline" : "secondary"}>
                            {variant.active ? "Ativa" : "Inativa"}
                          </Badge>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>{formatCurrency(variant.price)}</span>
                          <span>Estoque {variant.stock_quantity}</span>
                          {variant.barcode ? <span>{variant.barcode}</span> : null}
                          {variant.sku ? <span>SKU {variant.sku}</span> : null}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          type="button"
                          onClick={() => openEditVariant(variant)}
                          aria-label={`Editar ${variant.name}`}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          type="button"
                          onClick={() => void toggleVariantActive(variant)}
                          aria-label={variant.active ? "Desativar" : "Ativar"}
                        >
                          <Power className="size-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon"
                          type="button"
                          onClick={() => void handleDeleteVariant(variant)}
                          aria-label={`Excluir ${variant.name}`}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <form className="space-y-3" onSubmit={(e) => void handleVariantSubmit(e)}>
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium">
                    {editingVariant ? "Editar variacao" : "Nova variacao"}
                  </div>
                  {editingVariant ? (
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      onClick={() => {
                        setEditingVariant(null)
                        setVariantForm(emptyVariantForm(variantProduct))
                      }}
                    >
                      Limpar
                    </Button>
                  ) : null}
                </div>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Nome *</span>
                  <Input
                    required
                    placeholder="Pequena, 500g, sabor..."
                    value={variantForm.name}
                    onChange={(e) => setVariantField("name", e.target.value)}
                  />
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Codigo</span>
                    <Input
                      value={variantForm.barcode}
                      onChange={(e) => setVariantField("barcode", e.target.value)}
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">SKU</span>
                    <Input
                      value={variantForm.sku}
                      onChange={(e) => setVariantField("sku", e.target.value)}
                    />
                  </label>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Preco *</span>
                    <Input
                      required
                      type="number"
                      min="0"
                      step="0.01"
                      value={variantForm.price}
                      onChange={(e) => setVariantField("price", e.target.value)}
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Custo</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={variantForm.cost_price}
                      onChange={(e) => setVariantField("cost_price", e.target.value)}
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Estoque</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.001"
                      value={variantForm.stock_quantity}
                      onChange={(e) =>
                        setVariantField("stock_quantity", e.target.value)
                      }
                    />
                  </label>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Ordem</span>
                    <Input
                      type="number"
                      step="1"
                      value={variantForm.sort_order}
                      onChange={(e) => setVariantField("sort_order", e.target.value)}
                    />
                  </label>
                </div>
                {editingVariant ? (
                  <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={variantForm.active}
                      onChange={(e) => setVariantField("active", e.target.checked)}
                    />
                    Ativa
                  </label>
                ) : null}
                {formError ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {formError}
                  </div>
                ) : null}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={createVariant.isPending || updateVariant.isPending}
                >
                  {editingVariant ? "Salvar variacao" : "Criar variacao"}
                </Button>
              </form>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
