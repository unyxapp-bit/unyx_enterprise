import { Building2, ShoppingCart } from "lucide-react"
import { Navigate, useNavigate } from "react-router-dom"

import { useAuth } from "@/app/providers/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { setAccessMode } from "@/lib/accessMode"
import { canAccessUser } from "@/lib/permissions"

export function AccessChoicePage() {
  const { profile, profileLoading } = useAuth()
  const navigate = useNavigate()

  if (profileLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="text-sm text-muted-foreground">Carregando perfil...</div>
      </main>
    )
  }

  if (!profile) return <Navigate to="/app" replace />

  const canUsePos = canAccessUser(profile, "pos_sell")

  function chooseSystem() {
    setAccessMode("system")
    navigate("/app", { replace: true })
  }

  function choosePos() {
    setAccessMode("pos")
    navigate("/app/pos/sell", { replace: true })
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-4xl items-center">
        <div className="w-full space-y-6">
          <div>
            <div className="text-sm font-medium text-muted-foreground">
              Unyx Enterprise
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              O que voce vai fazer agora?
            </h1>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="h-full border bg-white transition-colors hover:border-slate-400">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="size-5" />
                  Abrir sistema
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Acessar painel completo, cadastros, relatorios, operacao e PDV.
                </p>
                <Button type="button" onClick={chooseSystem}>
                  Entrar no sistema
                </Button>
              </CardContent>
            </Card>

            <Card className="h-full border bg-white transition-colors hover:border-slate-400">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="size-5" />
                  Somente PDV
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
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
    </main>
  )
}
