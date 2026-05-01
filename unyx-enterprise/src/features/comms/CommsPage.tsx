import { useMemo, useState } from "react"
import type { FormEvent } from "react"
import { CheckCircle2, Megaphone, MessageCircle, Pin, Send } from "lucide-react"

import { PageHeader } from "@/components/shared/PageHeader"
import { StateBlock } from "@/components/shared/StateBlock"
import { Badge } from "@/components/ui/badge"
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  useBranches,
  useCommsPostComments,
  useCommsPosts,
  useCreateCommsPost,
  useCreateCommsPostComment,
  useMarkCommsPostRead,
  useSectors,
} from "@/hooks/useUnyxData"
import { formatDateTimeBR } from "@/lib/format"
import type { CommsPostComment } from "@/types/domain"

const fieldClass =
  "h-8 w-full rounded-lg border bg-white px-2.5 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"

const textareaClass =
  "min-h-28 w-full rounded-lg border bg-white px-2.5 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"

export function CommsPage() {
  const posts = useCommsPosts()
  const branches = useBranches()
  const createPost = useCreateCommsPost()
  const createComment = useCreateCommsPostComment()
  const markRead = useMarkCommsPostRead()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    branch_id: "",
    sector_id: "",
    title: "",
    content: "",
    pinned: false,
  })
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})
  const sectors = useSectors(form.branch_id || null)
  const postIds = useMemo(
    () => (posts.data ?? []).map((post) => post.id),
    [posts.data]
  )
  const comments = useCommsPostComments(postIds)
  const commentsByPost = useMemo(() => {
    const grouped: Record<string, CommsPostComment[]> = {}

    for (const comment of comments.data ?? []) {
      grouped[comment.post_id] = grouped[comment.post_id] ?? []
      grouped[comment.post_id].push(comment)
    }

    return grouped
  }, [comments.data])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    await createPost.mutateAsync({
      branch_id: form.branch_id || null,
      sector_id: form.sector_id || null,
      title: form.title.trim(),
      content: form.content.trim(),
      pinned: form.pinned,
    })

    setForm({
      branch_id: "",
      sector_id: "",
      title: "",
      content: "",
      pinned: false,
    })
    setOpen(false)
  }

  async function handleCommentSubmit(
    event: FormEvent<HTMLFormElement>,
    postId: string
  ) {
    event.preventDefault()
    const content = commentDrafts[postId]?.trim()
    if (!content) return

    await createComment.mutateAsync({ postId, content })
    setCommentDrafts((current) => ({ ...current, [postId]: "" }))
  }

  return (
    <>
      <PageHeader
        title="Unyx Comms"
        description="Comunicados internos, avisos por filial ou setor e confirmacao de leitura."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Send className="size-4" />
                Novo comunicado
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>Publicar comunicado</DialogTitle>
                <DialogDescription>
                  O aviso fica visivel para a empresa e pode ser direcionado por filial ou setor.
                </DialogDescription>
              </DialogHeader>

              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">Filial</span>
                    <select
                      className={fieldClass}
                      value={form.branch_id}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          branch_id: e.target.value,
                          sector_id: "",
                        }))
                      }
                    >
                      <option value="">Toda a empresa</option>
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
                      value={form.sector_id}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          sector_id: e.target.value,
                        }))
                      }
                    >
                      <option value="">Todos os setores</option>
                      {(sectors.data ?? []).map((sector) => (
                        <option key={sector.id} value={sector.id}>
                          {sector.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="space-y-1 text-sm">
                  <span className="font-medium">Titulo</span>
                  <Input
                    required
                    value={form.title}
                    onChange={(e) =>
                      setForm((current) => ({ ...current, title: e.target.value }))
                    }
                  />
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-medium">Mensagem</span>
                  <textarea
                    required
                    className={textareaClass}
                    value={form.content}
                    onChange={(e) =>
                      setForm((current) => ({ ...current, content: e.target.value }))
                    }
                  />
                </label>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.pinned}
                    onChange={(e) =>
                      setForm((current) => ({ ...current, pinned: e.target.checked }))
                    }
                  />
                  Fixar no topo
                </label>

                {createPost.error ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {createPost.error.message}
                  </div>
                ) : null}

                <DialogFooter>
                  <Button type="submit" disabled={createPost.isPending}>
                    {createPost.isPending ? "Publicando..." : "Publicar"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="space-y-4 p-6">
        {posts.isLoading ? (
          <StateBlock type="loading" title="Carregando comunicados" />
        ) : posts.isError ? (
          <StateBlock
            type="error"
            title="Erro ao carregar Unyx Comms"
            description={`${posts.error.message}. Rode o SQL atualizado no Supabase se as tabelas ainda nao existirem.`}
          />
        ) : (posts.data ?? []).length === 0 ? (
          <StateBlock
            title="Nenhum comunicado publicado"
            description="Crie o primeiro aviso interno para iniciar o feed da empresa."
          />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {(posts.data ?? []).map((post) => {
              const postComments = commentsByPost[post.id] ?? []

              return (
                <Card key={post.id} className="border bg-white shadow-sm">
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Megaphone className="size-4" />
                        {post.title}
                      </CardTitle>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {post.user_profiles?.name ?? "Equipe"} ·{" "}
                        {formatDateTimeBR(post.created_at)}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {post.pinned ? (
                        <Badge>
                          <Pin className="size-3" />
                          Fixado
                        </Badge>
                      ) : null}
                      {post.branches?.name ? (
                        <Badge variant="outline">{post.branches.name}</Badge>
                      ) : (
                        <Badge variant="outline">Empresa</Badge>
                      )}
                      {post.sectors?.name ? (
                        <Badge variant="outline">{post.sectors.name}</Badge>
                      ) : null}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {post.content}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => markRead.mutate(post.id)}
                    disabled={markRead.isPending}
                  >
                    <CheckCircle2 className="size-4" />
                    Confirmar leitura
                  </Button>
                  <div className="space-y-3 border-t pt-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <MessageCircle className="size-4" />
                      {postComments.length} comentario(s)
                    </div>
                    {comments.isError ? (
                      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {comments.error.message}
                      </div>
                    ) : comments.isLoading ? (
                      <div className="text-sm text-muted-foreground">
                        Carregando comentarios...
                      </div>
                    ) : postComments.length > 0 ? (
                      <div className="space-y-2">
                        {postComments.slice(-3).map((comment) => (
                          <div
                            key={comment.id}
                            className="rounded-lg border bg-slate-50 px-3 py-2"
                          >
                            <div className="text-xs font-medium">
                              {comment.user_profiles?.name ?? "Usuario"}
                            </div>
                            <p className="mt-1 text-sm text-slate-700">
                              {comment.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <form
                      className="flex flex-col gap-2 sm:flex-row"
                      onSubmit={(event) => handleCommentSubmit(event, post.id)}
                    >
                      <Input
                        value={commentDrafts[post.id] ?? ""}
                        onChange={(e) =>
                          setCommentDrafts((current) => ({
                            ...current,
                            [post.id]: e.target.value,
                          }))
                        }
                        placeholder="Escrever comentario"
                      />
                      <Button type="submit" disabled={createComment.isPending}>
                        Comentar
                      </Button>
                    </form>
                  </div>
                </CardContent>
              </Card>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
