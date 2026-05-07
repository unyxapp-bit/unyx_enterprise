/**
 * OperationalPostsManagerCard - Cadastro rapido de postos na tela operacional
 */

import React, { useMemo, useState } from "react"
import { ChevronDown, Pencil, Plus, Power, Store } from "lucide-react"
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
import { StateBlock } from "@/components/shared/StateBlock"
import {
  useCreateOperationalPost,
  useToggleOperationalPost,
  useUpdateOperationalPost,
} from "@/hooks/useUnyxData"
import { useAppStore } from "@/store/useAppStore"
import type { OperationalPost, OperationalPostType, Sector } from "@/types/domain"
import { postTypeLabel } from "../utils"

interface OperationalPostsManagerCardProps {
  posts: OperationalPost[]
  sectors: Sector[]
  isLoading: boolean
  isError: boolean
  error?: Error | null
}

type PostFormState = {
  name: string
  sector_id: string
  type: OperationalPostType
  active: boolean
}

const fieldClass =
  "h-8 w-full rounded-lg border bg-white px-2.5 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"

const postTypes: OperationalPostType[] = [
  "cashier",
  "self_checkout",
  "counter",
  "service_desk",
  "delivery",
  "stock",
  "kitchen",
  "reception",
  "other",
]

function emptyForm(): PostFormState {
  return {
    name: "",
    sector_id: "",
    type: "cashier",
    active: true,
  }
}

export const OperationalPostsManagerCard = React.memo(
  ({
    posts,
    sectors,
    isLoading,
    isError,
    error,
  }: OperationalPostsManagerCardProps) => {
    const selectedBranchId = useAppStore((state) => state.selectedBranchId)
    const createPost = useCreateOperationalPost()
    const updatePost = useUpdateOperationalPost()
    const togglePost = useToggleOperationalPost()

    const [isOpen, setIsOpen] = useState(false)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingPost, setEditingPost] = useState<OperationalPost | null>(null)
    const [form, setForm] = useState<PostFormState>(() => emptyForm())
    const [formError, setFormError] = useState<string | null>(null)

    const activeCount = useMemo(
      () => posts.filter((post) => post.active).length,
      [posts]
    )

    function openCreatePost() {
      setEditingPost(null)
      setForm(emptyForm())
      setFormError(null)
      setDialogOpen(true)
    }

    function openEditPost(post: OperationalPost) {
      setEditingPost(post)
      setForm({
        name: post.name,
        sector_id: post.sector_id ?? "",
        type: post.type,
        active: post.active,
      })
      setFormError(null)
      setDialogOpen(true)
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
      event.preventDefault()
      setFormError(null)

      const name = form.name.trim()
      if (!name) {
        setFormError("Informe o nome do posto.")
        return
      }

      try {
        if (editingPost) {
          await updatePost.mutateAsync({
            postId: editingPost.id,
            values: {
              name,
              type: form.type,
              sector_id: form.sector_id || null,
              active: form.active,
            },
          })
        } else {
          if (!selectedBranchId) {
            setFormError("Selecione uma filial para criar postos.")
            return
          }
          await createPost.mutateAsync({
            branch_id: selectedBranchId,
            sector_id: form.sector_id || null,
            name,
            type: form.type,
            active: form.active,
          })
        }
        setDialogOpen(false)
      } catch (submitError) {
        setFormError(
          submitError instanceof Error
            ? submitError.message
            : "Nao foi possivel salvar o posto."
        )
      }
    }

    return (
      <>
        <Card className="border bg-white shadow-sm">
          <CardHeader
            className="cursor-pointer select-none"
            onClick={() => setIsOpen((value) => !value)}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                setIsOpen((value) => !value)
              }
            }}
            aria-expanded={isOpen}
          >
            <CardTitle className="flex items-center gap-2">
              <Store className="size-5" />
              <span className="flex-1">Gerenciar postos</span>
              <Badge variant="outline">{activeCount}/{posts.length}</Badge>
              <Button
                size="icon"
                variant="outline"
                className="size-8"
                disabled={!selectedBranchId}
                onClick={(event) => {
                  event.stopPropagation()
                  openCreatePost()
                }}
                aria-label="Criar posto"
              >
                <Plus className="size-4" />
              </Button>
              <ChevronDown
                className={`size-4 text-muted-foreground transition-transform duration-200 ${
                  isOpen ? "rotate-180" : ""
                }`}
              />
            </CardTitle>
          </CardHeader>
          {isOpen ? (
            <CardContent>
              {!selectedBranchId ? (
                <StateBlock
                  title="Selecione uma filial"
                  description="Use o seletor no topo para criar postos nesta tela."
                  className="min-h-32"
                />
              ) : isLoading ? (
                <StateBlock
                  type="loading"
                  title="Carregando postos"
                  className="min-h-32"
                />
              ) : isError ? (
                <StateBlock
                  type="error"
                  title="Erro ao carregar postos"
                  description={error?.message}
                  className="min-h-32"
                />
              ) : posts.length === 0 ? (
                <StateBlock title="Nenhum posto cadastrado" className="min-h-32" />
              ) : (
                <div className="space-y-2">
                  {posts.map((post) => (
                    <div
                      key={post.id}
                      className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-sm font-semibold">
                            {post.name}
                          </span>
                          <Badge variant={post.active ? "outline" : "secondary"}>
                            {post.active ? "Ativo" : "Inativo"}
                          </Badge>
                        </div>
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">
                          {post.sectors?.name ?? "Sem setor"} -{" "}
                          {postTypeLabel[post.type] ?? post.type}
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="outline"
                        className="size-8"
                        onClick={() => openEditPost(post)}
                        aria-label={`Editar ${post.name}`}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="size-8"
                        disabled={togglePost.isPending}
                        onClick={() =>
                          togglePost.mutate({
                            postId: post.id,
                            active: !post.active,
                          })
                        }
                        aria-label={
                          post.active
                            ? `Desativar ${post.name}`
                            : `Ativar ${post.name}`
                        }
                      >
                        <Power className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          ) : null}
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingPost ? "Editar posto" : "Criar posto"}
              </DialogTitle>
            </DialogHeader>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Nome</span>
                <Input
                  required
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Setor</span>
                  <select
                    className={fieldClass}
                    value={form.sector_id}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        sector_id: event.target.value,
                      }))
                    }
                  >
                    <option value="">Sem setor</option>
                    {sectors.map((sector) => (
                      <option key={sector.id} value={sector.id}>
                        {sector.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-medium">Tipo</span>
                  <select
                    className={fieldClass}
                    value={form.type}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        type: event.target.value as OperationalPostType,
                      }))
                    }
                  >
                    {postTypes.map((type) => (
                      <option key={type} value={type}>
                        {postTypeLabel[type] ?? type}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="space-y-1 text-sm">
                <span className="font-medium">Status</span>
                <select
                  className={fieldClass}
                  value={form.active ? "active" : "inactive"}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      active: event.target.value === "active",
                    }))
                  }
                >
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                </select>
              </label>

              {formError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {formError}
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
      </>
    )
  }
)

OperationalPostsManagerCard.displayName = "OperationalPostsManagerCard"
