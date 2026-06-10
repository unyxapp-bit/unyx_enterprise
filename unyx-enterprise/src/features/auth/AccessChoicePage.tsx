import { useState } from "react"
import type { FormEvent } from "react"
import { Building2, ShoppingCart } from "lucide-react"
import { Navigate, useNavigate } from "react-router-dom"

import { useAuth } from "@/app/providers/auth-context"
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
import { setAccessMode } from "@/lib/accessMode"
import { canAccessUser } from "@/lib/permissions"
import { supabase } from "@/lib/supabase"

export function AccessChoicePage() {
  const { profile, profileLoading } = useAuth()
  const navigate = useNavigate()
  const [systemDialogOpen, setSystemDialogOpen] = useState(false)
  const [systemPassword, setSystemPassword] = useState("")
  const [systemError, setSystemError] = useState<string | null>(null)
  const [systemConfirming, setSystemConfirming] = useState(false)

  if (profileLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[color:var(--bg-app)] p-6">
        <div className="text-sm text-[color:var(--text-muted)]">Carregando perfil...</div>
      </main>
    )
  }

  if (!profile) return <Navigate to="/app" replace />

  const currentProfile = profile
  const canUsePos = canAccessUser(currentProfile, "pos_sell")

  function openSystemConfirmation() {
    setSystemError(null)
    setSystemPassword("")
    setSystemDialogOpen(true)
  }

  async function confirmSystemAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSystemError(null)

    if (!systemPassword.trim()) {
      setSystemError("Informe sua senha para abrir o sistema.")
      return
    }

    setSystemConfirming(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: currentProfile.email,
        password: systemPassword,
      })
      if (error) throw error

      setSystemDialogOpen(false)
      setSystemPassword("")
      setAccessMode("system")
      navigate("/app", { replace: true })
    } catch {
      setSystemError("Senha invalida. Confira e tente novamente.")
    } finally {
      setSystemConfirming(false)
    }
  }

  function choosePos() {
    setAccessMode("pos")
    navigate("/app/pos/sell", { replace: true })
  }

  return (
    <main className="min-h-screen bg-[color:var(--bg-app)] p-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-4xl items-center">
        <div className="w-full space-y-6">
          <div>
            <div className="text-sm font-medium text-[color:var(--text-muted)]">
              Unyx Enterprise
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[color:var(--text-primary)]">
              O que voce vai fazer agora?
            </h1>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="h-full border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] transition-colors hover:border-[color:var(--border-strong)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="size-5" />
                  Abrir sistema
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-[color:var(--text-muted)]">
                  Acessar painel completo, cadastros, relatorios, operacao e PDV.
                </p>
                <Button type="button" onClick={openSystemConfirmation}>
                  Entrar no sistema
                </Button>
              </CardContent>
            </Card>

            <Card className="h-full border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] transition-colors hover:border-[color:var(--border-strong)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="size-5" />
                  Somente PDV
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-[color:var(--text-muted)]">
                  Ir direto para vendas, caixa, produtos e historico do POS.
                </p>
                <Button type="button" disabled={!canUsePos} onClick={choosePos}>
                  Abrir PDV
                </Button>
                {!canUsePos ? (
                  <div className="text-xs text-red-600">
                    Seu usuario nao tem permissao para venda no PDV.
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog
        open={systemDialogOpen}
        onOpenChange={(open) => {
          setSystemDialogOpen(open)
          if (!open) {
            setSystemPassword("")
            setSystemError(null)
          }
        }}
      >
          <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="size-5" />
              Confirmar acesso ao sistema
            </DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(event) => void confirmSystemAccess(event)}>
            <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-soft)] p-3 text-sm">
              <div className="text-[color:var(--text-muted)]">Usuario</div>
              <div className="font-semibold">{currentProfile.name}</div>
              <div className="text-xs text-[color:var(--text-muted)]">{currentProfile.email}</div>
            </div>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Senha do sistema</span>
              <Input
                autoFocus
                type="password"
                value={systemPassword}
                onChange={(event) => setSystemPassword(event.target.value)}
              />
            </label>
            {systemError ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {systemError}
              </div>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSystemDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={systemConfirming}>
                {systemConfirming ? "Confirmando..." : "Abrir sistema"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  )
}
