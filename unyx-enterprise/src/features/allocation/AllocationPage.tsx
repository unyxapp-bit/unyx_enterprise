import { useMemo, useState } from "react"
import type { FormEvent } from "react"
import {
  CheckCircle2,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  ShieldAlert,
  Store,
  Wand2,
} from "lucide-react"

import { PageHeader } from "@/components/shared/PageHeader"
import { SectionPanel } from "@/components/shared/SectionPanel"
import { StateBlock } from "@/components/shared/StateBlock"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
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
  useCreateOperationalPost,
  useOperationalPosts,
  useOrganization,
  useSectors,
  useSetupSegmentDefaults,
  useToggleOperationalPost,
  useUpdateOperationalPost,
} from "@/hooks/useUnyxData"
import {
  SEGMENT_DEFAULT_POSTS,
  SEGMENT_DEFAULT_SECTORS,
  SEGMENT_LABELS,
  SEGMENT_POST_TYPES,
} from "@/lib/segmentConfig"
import { useAppStore } from "@/store/useAppStore"
import type {
  OperationalPost,
  OperationalPostType,
  Sector,
} from "@/types/domain"

const fieldClass =
  "h-8 w-full rounded-lg border bg-white px-2.5 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"

const postTypeLabel: Record<OperationalPostType, string> = {
  cashier: "Caixa",
  self_checkout: "Self-checkout",
  counter: "Balcao",
  service_desk: "Atendimento",
  delivery: "Delivery",
  stock: "Estoque",
  kitchen: "Cozinha",
  reception: "Recepcao",
  other: "Outro",
}

type PostFormState = {
  branch_id: string
  sector_id: string
  name: string
  type: OperationalPostType
  active: boolean
}

function emptyPostForm(branchId = ""): PostFormState {
  return {
    branch_id: branchId,
    sector_id: "",
    name: "",
    type: "cashier",
    active: true,
  }
}

function sectorOptionsForBranch(sectors: Sector[], branchId: string) {
  return sectors.filter((sector) => sector.branch_id === branchId && sector.active)
}

export function AllocationPage() {
  const selectedBranchId = useAppStore((state) => state.selectedBranchId)
  const branches = useBranches()
  const sectors = useSectors(null)
  const posts = useOperationalPosts()
  const org = useOrganization()

  const createPost = useCreateOperationalPost()
  const updatePost = useUpdateOperationalPost()
  const togglePost = useToggleOperationalPost()
  const setupDefaults = useSetupSegmentDefaults()

  const segment = org.data?.segment ?? "other"
  const sortedPostTypes = SEGMENT_POST_TYPES[segment]
  const defaultBranchId = selectedBranchId ?? branches.data?.[0]?.id ?? ""

  const [postOpen, setPostOpen] = useState(false)
  const [editingPost, setEditingPost] = useState<OperationalPost | null>(null)
  const [postForm, setPostForm] = useState<PostFormState>(emptyPostForm())
  const [postError, setPostError] = useState<string | null>(null)
  const [setupOpen, setSetupOpen] = useState(false)

  const allPosts = useMemo(
    () =>
      (posts.data ?? []).slice().sort((a, b) => {
        const typeCompare = postTypeLabel[a.type].localeCompare(postTypeLabel[b.type])
        if (typeCompare !== 0) return typeCompare
        const sectorCompare = (a.sectors?.name ?? "").localeCompare(
          b.sectors?.name ?? ""
        )
        if (sectorCompare !== 0) return sectorCompare
        return a.name.localeCompare(b.name)
      }),
    [posts.data]
  )

  const activePosts = allPosts.filter((post) => post.active)
  const inactivePosts = allPosts.filter((post) => !post.active)
  const postsWithoutSector = allPosts.filter((post) => !post.sector_id)
  const attentionPostCount = new Set(
    [...inactivePosts, ...postsWithoutSector].map((post) => post.id)
  ).size

  const postsByType = useMemo(() => {
    const map = new Map<OperationalPostType, OperationalPost[]>()
    for (const post of allPosts) {
      if (!map.has(post.type)) map.set(post.type, [])
      map.get(post.type)!.push(post)
    }
    return map
  }, [allPosts])

  const isLoading = posts.isLoading || branches.isLoading || sectors.isLoading
  const pageError = posts.error ?? branches.error ?? sectors.error

  function openCreatePost() {
    setEditingPost(null)
    setPostError(null)
    setPostForm(emptyPostForm(defaultBranchId))
    setPostOpen(true)
  }

  function openEditPost(post: OperationalPost) {
    setEditingPost(post)
    setPostError(null)
    setPostForm({
      branch_id: post.branch_id,
      sector_id: post.sector_id ?? "",
      name: post.name,
      type: post.type,
      active: post.active,
    })
    setPostOpen(true)
  }

  async function handlePostSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPostError(null)

    try {
      if (editingPost) {
        await updatePost.mutateAsync({
          postId: editingPost.id,
          values: {
            name: postForm.name,
            type: postForm.type,
            sector_id: postForm.sector_id || null,
            active: postForm.active,
          },
        })
      } else {
        await createPost.mutateAsync({
          branch_id: postForm.branch_id,
          sector_id: postForm.sector_id || null,
          name: postForm.name,
          type: postForm.type,
          active: postForm.active,
        })
      }
      setPostOpen(false)
    } catch (error) {
      setPostError(error instanceof Error ? error.message : "Nao foi possivel salvar.")
    }
  }

  return (
    <>
      <PageHeader
        title="Mapa de postos"
        description="Cadastro, edicao e configuracao dos postos operacionais."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => void posts.refetch()}
              aria-label="Atualizar postos"
            >
              <RefreshCw className="size-4" />
            </Button>
            <Button
              variant="outline"
              onClick={() => setSetupOpen(true)}
              disabled={!defaultBranchId}
            >
              <Wand2 className="size-4" />
              Configurar {SEGMENT_LABELS[segment]}
            </Button>
            <Button onClick={openCreatePost} disabled={!defaultBranchId}>
              <Plus className="size-4" />
              Novo posto
            </Button>
          </div>
        }
      />

      <div className="space-y-6 p-6">
        {isLoading ? (
          <StateBlock type="loading" title="Carregando postos" />
        ) : pageError ? (
          <StateBlock
            type="error"
            title="Erro ao carregar postos"
            description={`${pageError.message}. Rode supabase/onboarding_first_access.sql no SQL Editor se o modulo ainda nao existir.`}
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Card className="border bg-white shadow-sm">
                <CardContent className="flex items-center gap-3 p-4">
                  <Store className="size-4 text-muted-foreground" />
                  <div>
                    <div className="text-xl font-bold leading-none">
                      {allPosts.length}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      Postos cadastrados
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border bg-white shadow-sm">
                <CardContent className="flex items-center gap-3 p-4">
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  <div>
                    <div className="text-xl font-bold leading-none">
                      {activePosts.length}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      Ativos
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border bg-white shadow-sm">
                <CardContent className="flex items-center gap-3 p-4">
                  <ShieldAlert className="size-4 text-amber-600" />
                  <div>
                    <div className="text-xl font-bold leading-none">
                      {attentionPostCount}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      Inativos ou sem setor
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <SectionPanel id="postos-cadastrados" title="Postos cadastrados" variant="primary">
              {allPosts.length === 0 ? (
                <StateBlock
                  title="Nenhum posto cadastrado"
                  description="Crie caixas, balcoes e pontos de atendimento para usar nas alocacoes do Painel operacional."
                />
              ) : (
                <div className="space-y-5">
                  {sortedPostTypes
                    .filter((type) => postsByType.has(type))
                    .map((type) => (
                      <div key={type} className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                          <Store className="size-4" />
                          {postTypeLabel[type]}
                          <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                            {postsByType.get(type)?.length ?? 0}
                          </Badge>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                          {(postsByType.get(type) ?? []).map((post) => (
                            <div
                              key={post.id}
                              className="flex min-h-32 flex-col rounded-lg border bg-white p-4 shadow-sm"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="truncate font-semibold">
                                    {post.name}
                                  </div>
                                  <div className="mt-1 text-sm text-muted-foreground">
                                    {post.sectors?.name ?? "Sem setor"}
                                  </div>
                                  <div className="mt-0.5 text-xs text-muted-foreground">
                                    {post.branches?.name ?? "Filial"}
                                  </div>
                                </div>
                                <Badge variant={post.active ? "outline" : "secondary"}>
                                  {post.active ? "Ativo" : "Inativo"}
                                </Badge>
                              </div>
                              <div className="mt-auto flex gap-2 pt-4">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openEditPost(post)}
                                >
                                  <Pencil className="size-4" />
                                  Editar
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    togglePost.mutate({
                                      postId: post.id,
                                      active: !post.active,
                                    })
                                  }
                                >
                                  <Power className="size-4" />
                                  {post.active ? "Desativar" : "Ativar"}
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </SectionPanel>
          </>
        )}
      </div>

      <Dialog open={postOpen} onOpenChange={setPostOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPost ? "Editar posto operacional" : "Cadastrar posto"}
            </DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handlePostSubmit}>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Nome</span>
              <Input
                required
                value={postForm.name}
                onChange={(event) =>
                  setPostForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium">Filial</span>
                <select
                  className={fieldClass}
                  value={postForm.branch_id}
                  disabled={Boolean(editingPost)}
                  onChange={(event) =>
                    setPostForm((current) => ({
                      ...current,
                      branch_id: event.target.value,
                      sector_id: "",
                    }))
                  }
                  required
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
                <span className="font-medium">Setor</span>
                <select
                  className={fieldClass}
                  value={postForm.sector_id}
                  onChange={(event) =>
                    setPostForm((current) => ({
                      ...current,
                      sector_id: event.target.value,
                    }))
                  }
                >
                  <option value="">Sem setor</option>
                  {sectorOptionsForBranch(
                    sectors.data ?? [],
                    postForm.branch_id
                  ).map((sector) => (
                    <option key={sector.id} value={sector.id}>
                      {sector.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium">Tipo</span>
                <select
                  className={fieldClass}
                  value={postForm.type}
                  onChange={(event) =>
                    setPostForm((current) => ({
                      ...current,
                      type: event.target.value as OperationalPostType,
                    }))
                  }
                >
                  {sortedPostTypes.map((type) => (
                    <option key={type} value={type}>
                      {postTypeLabel[type]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-sm">
                <span className="font-medium">Status</span>
                <select
                  className={fieldClass}
                  value={postForm.active ? "active" : "inactive"}
                  onChange={(event) =>
                    setPostForm((current) => ({
                      ...current,
                      active: event.target.value === "active",
                    }))
                  }
                >
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                </select>
              </label>
            </div>

            {postError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {postError}
              </div>
            ) : null}

            <DialogFooter>
              <Button
                type="submit"
                disabled={createPost.isPending || updatePost.isPending}
              >
                {editingPost ? "Salvar posto" : "Criar posto"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Configurar {SEGMENT_LABELS[segment]}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              Cria os setores e postos operacionais padrao para{" "}
              <strong>{SEGMENT_LABELS[segment]}</strong>. Registros ja existentes
              com o mesmo nome sao ignorados; a operacao e segura para repetir.
            </p>
            <div>
              <p className="mb-1.5 font-medium">
                Setores ({SEGMENT_DEFAULT_SECTORS[segment].length})
              </p>
              <ul className="space-y-0.5 text-muted-foreground">
                {SEGMENT_DEFAULT_SECTORS[segment].map((sector) => (
                  <li key={sector}>- {sector}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1.5 font-medium">
                Postos ({SEGMENT_DEFAULT_POSTS[segment].length})
              </p>
              <ul className="space-y-0.5 text-muted-foreground">
                {SEGMENT_DEFAULT_POSTS[segment].map((post) => (
                  <li key={post.name}>
                    - {post.name}{" "}
                    <span className="text-xs">
                      ({postTypeLabel[post.type]} - {post.sector_name})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={setupDefaults.isPending || !defaultBranchId}
              onClick={() => {
                void setupDefaults.mutateAsync({
                  branch_id: defaultBranchId,
                  sector_names: SEGMENT_DEFAULT_SECTORS[segment],
                  post_definitions: SEGMENT_DEFAULT_POSTS[segment],
                })
                setSetupOpen(false)
              }}
            >
              <Wand2 className="size-4" />
              Configurar agora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
