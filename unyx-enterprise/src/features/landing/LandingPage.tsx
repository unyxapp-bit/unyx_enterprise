import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  GraduationCap,
  MessageSquareText,
  ShieldCheck,
  Trophy,
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
    <main className="min-h-screen bg-[color:var(--bg-app)] text-[color:var(--text-primary)]">
      <section className="relative isolate min-h-[82vh] overflow-hidden bg-[color:var(--bg-surface)] px-6 py-6 lg:px-10">
        <img
          src={heroImage}
          alt=""
          className="absolute right-[-80px] top-12 -z-10 h-[420px] w-[420px] opacity-20 lg:right-20 lg:top-8 lg:h-[520px] lg:w-[520px]"
        />
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link to="/" className="text-lg font-semibold tracking-tight">
            Unyx Enterprise
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild className="border-[color:var(--border-soft)] bg-[color:var(--bg-surface-soft)]">
              <Link to="/login">Entrar</Link>
            </Button>
            <Button asChild>
              <Link to="/app">
                Abrir app
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="mx-auto grid max-w-7xl gap-10 pt-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:pt-24">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-soft)] px-3 py-1 text-sm text-[color:var(--text-secondary)] shadow-sm">
              <ShieldCheck className="size-4" />
              Operational Intelligence Layer
            </div>
            <h1 className="max-w-4xl text-5xl font-semibold tracking-tight lg:text-7xl">
              Controle o caos operacional antes que ele vire fila.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[color:var(--text-muted)]">
              Dashboard vivo para varejo, supermercados, farmácias e
              restaurantes acompanharem escala, atrasos, intervalos, sangria e
              cobertura em tempo real.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild>
                <Link to="/login">
                  Criar conta
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button variant="outline" asChild className="border-[color:var(--border-soft)] bg-[color:var(--bg-surface-soft)]">
                <a href="mailto:unyx.app@gmail.com">Falar com a Unyx</a>
              </Button>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] p-4 shadow-[0_20px_48px_rgb(15_23_42/0.08)] backdrop-blur">
            <div className="rounded-[1.25rem] bg-[color:var(--bg-surface-soft)] p-4 text-[color:var(--text-primary)]">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <div className="text-sm font-semibold">Dashboard Operacional</div>
                  <div className="text-xs text-[color:var(--text-muted)]">Loja Centro · hoje</div>
                </div>
                <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                  Ao vivo
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {metrics.map((metric) => (
                  <div key={metric.label} className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] p-3">
                    <div className="text-xs text-[color:var(--text-muted)]">{metric.label}</div>
                    <div className="mt-1 text-2xl font-semibold">{metric.value}</div>
                  </div>
                ))}
              </div>

              <div className="mt-4 space-y-2">
                {statusRows.map(([name, sector, status, color]) => (
                  <div
                    key={name}
                    className="flex items-center justify-between rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] p-3"
                  >
                    <div>
                      <div className="text-sm font-medium">{name}</div>
                      <div className="text-xs text-[color:var(--text-muted)]">{sector}</div>
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

      <section className="border-b border-[color:var(--border-soft)] bg-[color:var(--bg-surface-soft)] px-6 py-14 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-3">
          <ValueCard
            icon={<AlertTriangle className="size-5" />}
            title="Unyx Ops"
            text="Mostra o agora: dashboard vivo, operação do dia, status e alertas."
          />
          <ValueCard
            icon={<ShieldCheck className="size-5" />}
            title="Unyx Control"
            text="Organiza a empresa: filiais, setores, colaboradores, usuários e regras."
          />
          <ValueCard
            icon={<BarChart3 className="size-5" />}
            title="Unyx Insight"
            text="Explica o que aconteceu: relatórios, atrasos, faltas e auditoria."
          />
        </div>
        <div className="mx-auto mt-4 grid max-w-7xl gap-4 md:grid-cols-4">
          <ValueCard
            icon={<MessageSquareText className="size-5" />}
            title="Unyx Comms"
            text="Centraliza comunicados, avisos por setor e leitura confirmada."
          />
          <ValueCard
            icon={<Trophy className="size-5" />}
            title="Unyx Game"
            text="Transforma comportamento operacional em pontos, ranking e metas."
          />
          <ValueCard
            icon={<GraduationCap className="size-5" />}
            title="Unyx Academy"
            text="Organiza treinamentos, onboarding e progresso da equipe."
          />
          <ValueCard
            icon={<BrainCircuit className="size-5" />}
            title="Unyx AI"
            text="Gera insights e sugere acoes para antecipar riscos."
          />
        </div>
      </section>

      <section className="px-6 py-16 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">
              Fluxo pronto para operar com a equipe.
            </h2>
            <p className="mt-4 text-[color:var(--text-muted)]">
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
              <div key={item} className="flex items-center gap-3 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] p-4 shadow-sm">
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
    <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] p-5 shadow-sm">
      <div className="mb-4 flex size-10 items-center justify-center rounded-2xl bg-[color:var(--primary)] text-[color:var(--primary-foreground)] shadow-sm">
        {icon}
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[color:var(--text-muted)]">{text}</p>
    </div>
  )
}
