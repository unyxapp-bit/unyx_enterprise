import { useState } from "react"
import type { FormEvent } from "react"
import { Activity, ArrowRight, ShieldCheck } from "lucide-react"
import { Navigate } from "react-router-dom"

import { useAuth } from "@/app/providers/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

type AuthMode = "sign-in" | "sign-up"

export function LoginPage() {
  const { session, signIn, signUp } = useAuth()
  const [mode, setMode] = useState<AuthMode>("sign-in")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (session) return <Navigate to="/access" replace />

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)

    if (mode === "sign-up" && password !== confirmPassword) {
      setError("As senhas não conferem.")
      return
    }

    setIsSubmitting(true)

    try {
      if (mode === "sign-up") {
        const result = await signUp(email, password)

        if (result.needsEmailConfirmation) {
          setMessage(
            "Cadastro criado. Confirme seu email e depois faça login para acessar o sistema."
          )
        }

        return
      }

      await signIn(email, password)
    } catch (authError) {
      setError(
        authError instanceof Error
          ? authError.message
          : "Não foi possível continuar."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode)
    setError(null)
    setMessage(null)
    setConfirmPassword("")
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
            Crie a conta, complete os dados da empresa e entre no painel
            operacional com o workspace já configurado.
          </p>
        </div>

        <div className="text-sm text-slate-400">
          Operational Intelligence Layer
        </div>
      </section>

      <section className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md border bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">
              {mode === "sign-in" ? "Entrar no Unyx Ops" : "Criar conta"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid grid-cols-2 rounded-lg border bg-slate-50 p-1">
              <Button
                type="button"
                variant={mode === "sign-in" ? "default" : "ghost"}
                onClick={() => changeMode("sign-in")}
              >
                Entrar
              </Button>
              <Button
                type="button"
                variant={mode === "sign-up" ? "default" : "ghost"}
                onClick={() => changeMode("sign-up")}
              >
                Cadastrar
              </Button>
            </div>

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
                  minLength={6}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>

              {mode === "sign-up" ? (
                <div className="space-y-2">
                  <label
                    className="text-sm font-medium"
                    htmlFor="confirm-password"
                  >
                    Confirmar senha
                  </label>
                  <Input
                    id="confirm-password"
                    type="password"
                    minLength={6}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                  />
                </div>
              ) : null}

              {error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              {message ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  {message}
                </div>
              ) : null}

              <Button className="w-full" type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? "Aguarde..."
                  : mode === "sign-in"
                    ? "Entrar"
                    : "Criar conta"}
                <ArrowRight className="size-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
