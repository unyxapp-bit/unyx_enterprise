import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  ShieldCheck,
} from "lucide-react"
import type { ReactNode } from "react"
import { Link } from "react-router-dom"

import heroImage from "@/assets/hero.png"
import { Button } from "@/components/ui/button"

const metrics = [
  { label: "Colaboradores", value: "18" },
  { label: "Alertas", value: "3" },
  { label: "Atraso", value: "42 min" },
]

const statusRows = [
  ["Ana Souza", "Frente de caixa", "Trabalhando", "emerald"],
  ["Bruno Lima", "Fiscal", "Aguardando sangria", "orange"],
  ["Carla Nunes", "Reposição", "Alerta crítico", "red"],
  ["Diego Rocha", "Caixa", "Em intervalo", "violet"],
]

export function LandingPage() {
  return (
    <main className="min-h-screen bg-white text-slate-950">
      <section className="relative isolate min-h-[82vh] overflow-hidden bg-slate-950 px-6 py-6 text-white lg:px-10">
        <img
          src={heroImage}
          alt=""
          className="absolute right-[-80px] top-12 -z-10 h-[420px] w-[420px] opacity-25 lg:right-20 lg:top-8 lg:h-[520px] lg:w-[520px]"
        />
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link to="/" className="text-lg font-semibold tracking-tight">
            Unyx Ops
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild className="border-white/20 bg-white/5 text-white hover:bg-white/10">
              <Link to="/login">Entrar</Link>
            </Button>
            <Button asChild className="bg-white text-slate-950 hover:bg-slate-100">
              <Link to="/app">
                Abrir app
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="mx-auto grid max-w-7xl gap-10 pt-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:pt-24">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-sm text-slate-200">
              <ShieldCheck className="size-4" />
              Operational Intelligence Layer
            </div>
            <h1 className="max-w-4xl text-5xl font-semibold tracking-tight lg:text-7xl">
              Controle o caos operacional antes que ele vire fila.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              Dashboard vivo para varejo, supermercados, farmácias e
              restaurantes acompanharem escala, atrasos, intervalos, sangria e
              cobertura em tempo real.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild className="bg-white text-slate-950 hover:bg-slate-100">
                <Link to="/login">
                  Criar conta
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button variant="outline" asChild className="border-white/20 bg-white/5 text-white hover:bg-white/10">
                <a href="mailto:unyx.app@gmail.com">Falar com a Unyx</a>
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/10 p-4 shadow-2xl backdrop-blur">
            <div className="rounded-lg bg-slate-50 p-4 text-slate-950">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <div className="text-sm font-semibold">Dashboard Operacional</div>
                  <div className="text-xs text-slate-500">Loja Centro · hoje</div>
                </div>
                <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                  Ao vivo
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {metrics.map((metric) => (
                  <div key={metric.label} className="rounded-lg border bg-white p-3">
                    <div className="text-xs text-slate-500">{metric.label}</div>
                    <div className="mt-1 text-2xl font-semibold">{metric.value}</div>
                  </div>
                ))}
              </div>

              <div className="mt-4 space-y-2">
                {statusRows.map(([name, sector, status, color]) => (
                  <div
                    key={name}
                    className="flex items-center justify-between rounded-lg border bg-white p-3"
                  >
                    <div>
                      <div className="text-sm font-medium">{name}</div>
                      <div className="text-xs text-slate-500">{sector}</div>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        color === "emerald"
                          ? "bg-emerald-100 text-emerald-700"
                          : color === "orange"
                            ? "bg-orange-100 text-orange-700"
                            : color === "red"
                              ? "bg-red-100 text-red-700"
                              : "bg-violet-100 text-violet-700"
                      }`}
                    >
                      {status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b bg-slate-50 px-6 py-14 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-3">
          <ValueCard
            icon={<AlertTriangle className="size-5" />}
            title="Menos incêndio diário"
            text="Alertas por prioridade mostram onde a liderança precisa agir primeiro."
          />
          <ValueCard
            icon={<Clock3 className="size-5" />}
            title="Escala versus realidade"
            text="Acompanhamento de entrada, pausa, retorno e saída sem depender de planilhas soltas."
          />
          <ValueCard
            icon={<BarChart3 className="size-5" />}
            title="Histórico auditável"
            text="Cada evento vira trilha simples para auditoria operacional e proteção gerencial."
          />
        </div>
      </section>

      <section className="px-6 py-16 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">
              Fluxo pronto para operar com a equipe.
            </h2>
            <p className="mt-4 text-slate-600">
              A plataforma registra atraso, ação operacional, atualização do
              status e histórico em poucos minutos.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              "Mostrar dashboard",
              "Registrar atraso",
              "Iniciar intervalo",
              "Confirmar retorno",
              "Consultar histórico",
              "Filtrar por filial",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-lg border bg-white p-4 shadow-sm">
                <CheckCircle2 className="size-5 text-emerald-600" />
                <span className="font-medium">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}

function ValueCard({
  icon,
  title,
  text,
}: {
  icon: ReactNode
  title: string
  text: string
}) {
  return (
    <div className="rounded-lg border bg-white p-5 shadow-sm">
      <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-slate-950 text-white">
        {icon}
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </div>
  )
}
