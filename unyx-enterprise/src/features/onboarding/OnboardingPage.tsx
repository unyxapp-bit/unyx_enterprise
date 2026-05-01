import { useMemo, useState } from "react"
import type { FormEvent } from "react"
import { Building2, LogOut, UserRound } from "lucide-react"

import { useAuth } from "@/app/providers/auth-context"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { completeCurrentUserOnboarding } from "@/services/unyxApi"
import type { BusinessSegment } from "@/types/domain"

const selectClassName =
  "h-8 w-full rounded-lg border bg-white px-2.5 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"

const segmentOptions: Array<{ value: BusinessSegment; label: string }> = [
  { value: "retail_store", label: "Loja de varejo" },
  { value: "supermarket", label: "Supermercado" },
  { value: "restaurant", label: "Restaurante" },
  { value: "pharmacy", label: "Farmácia" },
  { value: "other", label: "Outro" },
]

export function OnboardingPage() {
  const { profileError, refreshProfile, session, signOut } = useAuth()
  const initialName = useMemo(() => {
    const metadataName =
      session?.user.user_metadata?.name ?? session?.user.user_metadata?.full_name
    if (typeof metadataName === "string" && metadataName.trim()) {
      return metadataName.trim()
    }

    return session?.user.email?.split("@")[0] ?? ""
  }, [session])

  const [form, setForm] = useState({
    profileName: initialName,
    organizationName: "",
    tradeName: "",
    document: "",
    segment: "other" as BusinessSegment,
    branchName: "Loja principal",
    city: "",
    state: "",
    address: "",
  })
  const [error, setError] = useState<string | null>(profileError)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!form.profileName.trim() || !form.organizationName.trim()) {
      setError("Preencha seu nome e o nome da empresa.")
      return
    }

    setIsSubmitting(true)

    try {
      await completeCurrentUserOnboarding({
        profileName: form.profileName.trim(),
        organizationName: form.organizationName.trim(),
        tradeName: form.tradeName.trim() || null,
        document: form.document.trim() || null,
        segment: form.segment,
        branchName: form.branchName.trim() || "Loja principal",
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        address: form.address.trim() || null,
      })

      await refreshProfile()
    } catch (onboardingError) {
      setError(
        onboardingError instanceof Error
          ? onboardingError.message
          : "Não foi possível concluir o cadastro."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-950">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[0.75fr_1.25fr]">
        <section className="rounded-lg bg-slate-950 p-6 text-white">
          <div className="flex size-10 items-center justify-center rounded-lg bg-white text-slate-950">
            <Building2 className="size-5" />
          </div>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight">
            Complete seu cadastro para ativar o workspace.
          </h1>
          <p className="mt-4 text-sm leading-6 text-slate-300">
            Antes do dashboard, precisamos criar sua organização, sua primeira
            filial e seu perfil administrativo.
          </p>
          <div className="mt-8 rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <UserRound className="size-4" />
              Sessão autenticada
            </div>
            <div className="mt-2 text-sm text-slate-300">
              {session?.user.email}
            </div>
          </div>
          <Button
            className="mt-6 border-white/20 bg-white/5 text-white hover:bg-white/10"
            variant="outline"
            onClick={() => void signOut()}
          >
            <LogOut className="size-4" />
            Sair
          </Button>
        </section>

        <Card className="border bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Dados iniciais</CardTitle>
            <CardDescription>
              Estes dados serão usados para criar o primeiro acesso da empresa.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Seu nome</span>
                  <Input
                    value={form.profileName}
                    onChange={(event) => update("profileName", event.target.value)}
                    required
                  />
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-medium">Nome da empresa</span>
                  <Input
                    value={form.organizationName}
                    onChange={(event) =>
                      update("organizationName", event.target.value)
                    }
                    required
                  />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Nome fantasia</span>
                  <Input
                    value={form.tradeName}
                    onChange={(event) => update("tradeName", event.target.value)}
                  />
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-medium">Documento</span>
                  <Input
                    value={form.document}
                    onChange={(event) => update("document", event.target.value)}
                    placeholder="CNPJ ou CPF"
                  />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Segmento</span>
                  <select
                    className={selectClassName}
                    value={form.segment}
                    onChange={(event) =>
                      update("segment", event.target.value as BusinessSegment)
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
                  <span className="font-medium">Primeira filial</span>
                  <Input
                    value={form.branchName}
                    onChange={(event) => update("branchName", event.target.value)}
                    required
                  />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-[1fr_96px]">
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Cidade</span>
                  <Input
                    value={form.city}
                    onChange={(event) => update("city", event.target.value)}
                  />
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-medium">UF</span>
                  <Input
                    maxLength={2}
                    value={form.state}
                    onChange={(event) =>
                      update("state", event.target.value.toUpperCase())
                    }
                  />
                </label>
              </div>

              <label className="block space-y-1 text-sm">
                <span className="font-medium">Endereço</span>
                <Input
                  value={form.address}
                  onChange={(event) => update("address", event.target.value)}
                />
              </label>

              {error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <Button className="w-full" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Criando workspace..." : "Concluir cadastro"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
