import { useState } from "react"
import type { FormEvent } from "react"
import { Activity, ShieldCheck } from "lucide-react"
import { Navigate } from "react-router-dom"

import { useAuth } from "@/app/providers/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export function LoginPage() {
  const { session, signIn } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (session) return <Navigate to="/" replace />

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      await signIn(email, password)
    } catch (signInError) {
      setError(
        signInError instanceof Error
          ? signInError.message
          : "Não foi possível entrar."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="grid min-h-screen bg-slate-50 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="flex flex-col justify-between bg-slate-950 p-8 text-white lg:p-12">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-white text-slate-950">
            <Activity className="size-5" />
          </div>
          <div>
            <div className="font-semibold">Unyx Enterprise</div>
            <div className="text-sm text-slate-300">Unyx Ops</div>
          </div>
        </div>

        <div className="max-w-2xl py-16">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-sm text-slate-200">
            <ShieldCheck className="size-4" />
            Plataforma operacional segura
          </div>
          <h1 className="text-4xl font-semibold tracking-tight lg:text-5xl">
            Centro de comando para a operação do dia.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-300">
            Escalas, status, intervalos, faltas e eventos em uma visão de
            trabalho única para supervisão em tempo real.
          </p>
        </div>

        <div className="text-sm text-slate-400">
          Operational Intelligence Layer
        </div>
      </section>

      <section className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md border bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Entrar no Unyx Ops</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="email">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="password">
                  Senha
                </label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>

              {error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <Button className="w-full" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Entrando..." : "Entrar"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
