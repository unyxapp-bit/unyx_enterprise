import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Building2,
  Circle,
  Layers,
  CheckCircle2,
  ListChecks,
  Sparkles,
  Gauge,
  History,
  Radio,
  StickyNote,
  Users,
  type LucideIcon,
} from "lucide-react"
import { Link } from "react-router-dom"

import { useAuth } from "@/app/providers/auth-context"
import { navGroups, navItemDescriptions, roleLabel } from "@/app/layout/navConfig"
import { readRecentModules } from "@/features/home/recentModules"
import { PageHeader } from "@/components/shared/PageHeader"
import { localDateKey } from "@/features/operational/utils/operationalCalculations"
import {
  useBranches,
  useChecklistProcedures,
  useEmployees,
  useOperationalNotes,
  useOperationalStatuses,
  useSchedules,
  useSectors,
} from "@/hooks/useUnyxData"
import { canAccessUser, type PermissionKey } from "@/lib/permissions"
import { cn } from "@/lib/utils"
import type { OperationalStatus } from "@/types/domain"

const WORKING_STATUSES = new Set<OperationalStatus>([
  "trabalhando",
  "voltou",
  "aguardando_sangria",
  "troca_de_caixa",
  "deve_sair",
  "pico",
  "apoio_operacional",
  "fechamento",
])

const QUICK_ACTION_PATHS = [
  "/app/pos/sell",
  "/app/pos/cash",
  "/app/schedules",
  "/app/checklists",
  "/app/alerts",
  "/app/pos/posters",
]

type Tone = "neutral" | "good" | "warn" | "danger"

const TONE_STYLES: Record<Tone, { icon: string; hint: string }> = {
  neutral: {
    icon: "bg-slate-100 text-slate-600 dark:bg-slate-700/60 dark:text-slate-200",
    hint: "text-[color:var(--text-muted)]",
  },
  good: {
    icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    hint: "text-emerald-700 dark:text-emerald-300",
  },
  warn: {
    icon: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    hint: "text-amber-700 dark:text-amber-300",
  },
  danger: {
    icon: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
    hint: "text-rose-700 dark:text-rose-300",
  },
}

function greeting(date = new Date()) {
  const hour = date.getHours()
  if (hour < 12) return "Bom dia"
  if (hour < 18) return "Boa tarde"
  return "Boa noite"
}

function SummaryCard({
  to,
  icon: Icon,
  label,
  value,
  hint,
  tone,
  loading,
}: {
  to: string
  icon: LucideIcon
  label: string
  value: string
  hint: string
  tone: Tone
  loading: boolean
}) {
  const styles = TONE_STYLES[tone]
  return (
    <Link
      to={to}
      className="group flex flex-col gap-3 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] p-4 shadow-sm transition hover:border-[color:var(--primary)]/40 hover:shadow-md"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-[color:var(--text-muted)]">{label}</span>
        <span className={cn("flex size-8 items-center justify-center rounded-xl", styles.icon)}>
          <Icon className="size-4" />
        </span>
      </div>
      <div className="text-3xl font-semibold tracking-tight text-[color:var(--text-primary)]">
        {loading ? (
          <span className="inline-block h-8 w-12 animate-pulse rounded-md bg-[color:var(--border-soft)]" />
        ) : (
          value
        )}
      </div>
      <p className={cn("text-xs leading-4", styles.hint)}>{loading ? "Carregando..." : hint}</p>
    </Link>
  )
}

// Cada cartão busca só os dados do módulo que o usuário pode ver.
function SchedulesSummary() {
  const { data, isLoading } = useSchedules(localDateKey())
  const total = data?.length ?? 0
  return (
    <SummaryCard
      to="/app/schedules"
      icon={CalendarDays}
      label="Escalados hoje"
      value={String(total)}
      hint={total === 0 ? "Sem escala para hoje. Toque para montar." : "Colaboradores na escala de hoje"}
      tone={total === 0 ? "warn" : "neutral"}
      loading={isLoading}
    />
  )
}

function OperationSummary() {
  const { data, isLoading } = useOperationalStatuses()
  const working = (data ?? []).filter((item) => WORKING_STATUSES.has(item.current_status)).length
  return (
    <SummaryCard
      to="/app/dashboard"
      icon={Users}
      label="Em turno agora"
      value={String(working)}
      hint={working === 0 ? "Ninguém com status ativo no momento" : "Com status ativo na operação"}
      tone="neutral"
      loading={isLoading}
    />
  )
}

function AlertsSummary() {
  const { data, isLoading } = useOperationalStatuses()
  const critical = (data ?? []).filter((item) => item.current_status === "alerta_critico").length
  return (
    <SummaryCard
      to="/app/alerts"
      icon={critical > 0 ? AlertTriangle : CheckCircle2}
      label="Alertas críticos"
      value={String(critical)}
      hint={critical > 0 ? "Pedem ação imediata" : "Nenhum alerta crítico agora"}
      tone={critical > 0 ? "danger" : "good"}
      loading={isLoading}
    />
  )
}

function NotesSummary() {
  const { data, isLoading } = useOperationalNotes("open")
  const open = data?.length ?? 0
  return (
    <SummaryCard
      to="/app/notes"
      icon={StickyNote}
      label="Anotações abertas"
      value={String(open)}
      hint={open === 0 ? "Nada pendente nas anotações" : "Aguardando andamento"}
      tone={open > 0 ? "warn" : "good"}
      loading={isLoading}
    />
  )
}

type SetupStep = {
  key: string
  label: string
  description: string
  to: string
  icon: LucideIcon
  done: boolean
  optional?: boolean
}

// Primeiro acesso: em vez de zeros e avisos, guia o que precisa ser configurado, na ordem.
function FirstStepsGuide({ steps }: { steps: SetupStep[] }) {
  const doneCount = steps.filter((step) => step.done).length
  const nextKey = steps.find((step) => !step.done)?.key
  const percent = Math.round((doneCount / steps.length) * 100)
  return (
    <section
      aria-labelledby="home-setup"
      className="rounded-3xl border border-[color:var(--primary)]/30 bg-[color:var(--bg-surface)] p-5 shadow-sm sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2
            id="home-setup"
            className="flex items-center gap-2 text-base font-semibold text-[color:var(--text-primary)]"
          >
            <Sparkles className="size-4 text-[color:var(--primary)]" />
            Vamos deixar tudo pronto
          </h2>
          <p className="mt-1 text-sm text-[color:var(--text-muted)]">
            Siga os passos abaixo. Assim que terminar, aqui aparece o resumo do seu dia.
          </p>
        </div>
        <span className="rounded-full bg-[color:var(--primary)]/10 px-3 py-1 text-xs font-medium text-[color:var(--primary)]">
          {doneCount} de {steps.length} concluídos
        </span>
      </div>
      <div
        className="mt-4 h-2 overflow-hidden rounded-full bg-[color:var(--border-soft)]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label="Progresso da configuração"
      >
        <div
          className="h-full rounded-full bg-[color:var(--primary)] transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
      <ol className="mt-5 space-y-2">
        {steps.map((step, index) => {
          const Icon = step.icon
          const isNext = step.key === nextKey
          return (
            <li
              key={step.key}
              className={cn(
                "flex flex-wrap items-center gap-3 rounded-2xl border p-3 sm:flex-nowrap",
                isNext
                  ? "border-[color:var(--primary)]/40 bg-[color:var(--primary)]/5"
                  : "border-[color:var(--border-soft)]"
              )}
            >
              {step.done ? (
                <CheckCircle2 className="size-5 shrink-0 text-emerald-500" aria-label="Concluído" />
              ) : (
                <Circle className="size-5 shrink-0 text-[color:var(--text-muted)]" aria-label="Pendente" />
              )}
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[color:var(--primary)]/10 text-[color:var(--primary)]">
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block text-sm font-semibold text-[color:var(--text-primary)]",
                    step.done && "line-through decoration-[color:var(--text-muted)]/50"
                  )}
                >
                  {index + 1}. {step.label}
                  {step.optional ? (
                    <span className="ml-2 rounded-full bg-[color:var(--border-soft)] px-2 py-0.5 align-middle text-[10px] font-medium text-[color:var(--text-muted)]">
                      Opcional
                    </span>
                  ) : null}
                </span>
                <span className="block text-xs leading-4 text-[color:var(--text-muted)]">
                  {step.description}
                </span>
              </span>
              <Link
                to={step.to}
                className={cn(
                  "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3.5 text-sm font-medium transition",
                  isNext
                    ? "bg-[color:var(--primary)] text-[color:var(--primary-foreground)] shadow-sm hover:opacity-90"
                    : "border border-[color:var(--border-soft)] text-[color:var(--text-primary)] hover:border-[color:var(--primary)]/40"
                )}
              >
                {step.done ? "Revisar" : isNext ? "Começar" : "Abrir"}
                <ArrowRight className="size-3.5" />
              </Link>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function SummaryPlaceholders() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true">
      {[0, 1, 2, 3].map((item) => (
        <div
          key={item}
          className="h-[150px] animate-pulse rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)]"
        />
      ))}
    </div>
  )
}

function DaySummaries({ can }: { can: (perm: PermissionKey) => boolean }) {
  const cards = [
    can("schedules") ? <SchedulesSummary key="schedules" /> : null,
    can("dashboard") ? <OperationSummary key="operation" /> : null,
    can("alerts") ? <AlertsSummary key="alerts" /> : null,
    can("front_notes") ? <NotesSummary key="notes" /> : null,
  ].filter(Boolean)
  if (cards.length === 0) return null
  return (
    <section aria-labelledby="home-today">
      <h2
        id="home-today"
        className="mb-3 flex items-center gap-2 text-sm font-semibold text-[color:var(--text-primary)]"
      >
        <Gauge className="size-4 text-[color:var(--primary)]" />
        Hoje em resumo
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards}</div>
    </section>
  )
}

// Quem administra a base (filiais/colaboradores) vê o guia enquanto ela estiver vazia;
// depois disso, e para os demais usuários, aparece o resumo do dia.
function AdminToday({ can }: { can: (perm: PermissionKey) => boolean }) {
  const branches = useBranches()
  // `null` = todas as filiais: a base está vazia só se não houver ninguém em nenhuma.
  const employees = useEmployees(null)
  const sectors = useSectors(null)
  const schedules = useSchedules(localDateKey())
  const procedures = useChecklistProcedures()

  if (branches.isLoading || employees.isLoading) return <SummaryPlaceholders />

  const hasBranches = (branches.data?.length ?? 0) > 0
  const hasEmployees = (employees.data?.length ?? 0) > 0

  if (hasBranches && hasEmployees) return <DaySummaries can={can} />

  const steps: SetupStep[] = [
    can("branches")
      ? {
          key: "branches",
          label: "Cadastre sua filial",
          description: "A unidade onde a operação acontece. Tudo o mais fica ligado a ela.",
          to: "/app/branches",
          icon: Building2,
          done: hasBranches,
        }
      : null,
    can("branches")
      ? {
          key: "sectors",
          label: "Crie os setores",
          description:
            "Ex.: Caixa, Padaria, Açougue. Ajuda a organizar a equipe. Também dá para criar ao cadastrar um colaborador.",
          to: "/app/branches",
          icon: Layers,
          done: (sectors.data?.length ?? 0) > 0,
          optional: true,
        }
      : null,
    can("employees")
      ? {
          key: "employees",
          label: "Cadastre os colaboradores",
          description: "Nome, cargo e setor de cada pessoa da equipe.",
          to: "/app/employees",
          icon: Users,
          done: hasEmployees,
        }
      : null,
    can("schedules")
      ? {
          key: "schedules",
          label: "Monte a escala de hoje",
          description: "Quem trabalha hoje e em qual horário. É a base do acompanhamento ao vivo.",
          to: "/app/schedules",
          icon: CalendarDays,
          done: (schedules.data?.length ?? 0) > 0,
        }
      : null,
    can("checklists")
      ? {
          key: "checklists",
          label: "Crie as rotinas de checklist",
          description: "Abertura, fechamento e verificações do dia a dia.",
          to: "/app/checklists",
          icon: ListChecks,
          done: (procedures.data?.length ?? 0) > 0,
        }
      : null,
  ].filter((step): step is SetupStep => step !== null)

  return steps.length > 0 ? <FirstStepsGuide steps={steps} /> : <DaySummaries can={can} />
}

function TodaySection({ can }: { can: (perm: PermissionKey) => boolean }) {
  return can("branches") || can("employees") ? <AdminToday can={can} /> : <DaySummaries can={can} />
}

export function HomePage() {
  const { profile } = useAuth()
  if (!profile) return null

  const can = (perm: PermissionKey) => canAccessUser(profile, perm)
  const firstName = profile.name.trim().split(/\s+/)[0] ?? profile.name
  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  const allItems = navGroups.flatMap((group) => group.items)
  const allowedItem = (to: string) => {
    const item = allItems.find((candidate) => candidate.to === to)
    return item && item.perm && can(item.perm) ? item : null
  }
  // Seleção curta das ações do dia a dia; o menu superior continua tendo todos os módulos.
  const quickActions = QUICK_ACTION_PATHS.map(allowedItem).filter((item) => item !== null).slice(0, 6)
  const recentItems = readRecentModules(profile.id)
    .map(allowedItem)
    .filter((item) => item !== null)
    .slice(0, 4)

  return (
    <>
      <PageHeader title="Início" description="Resumo do dia e atalhos para o que você mais usa." large />
      <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <section className="overflow-hidden rounded-3xl border border-[color:var(--border-soft)] bg-gradient-to-br from-[color:var(--primary)]/10 via-[color:var(--bg-surface)] to-[color:var(--bg-surface)] p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--text-muted)]">
                {today}
              </p>
              <h2 className="mt-1 truncate text-2xl font-semibold tracking-tight text-[color:var(--text-primary)] sm:text-3xl">
                {greeting()}, {firstName}
              </h2>
              <p className="mt-1 text-sm text-[color:var(--text-muted)]">
                {roleLabel[profile.role]} · veja como está o dia e vá direto ao que precisa.
              </p>
            </div>
            {can("dashboard") ? (
              <Link
                to="/app/dashboard"
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-[color:var(--primary)] px-4 text-sm font-medium text-[color:var(--primary-foreground)] shadow-sm transition hover:opacity-90"
              >
                <Radio className="size-4" />
                Operação ao vivo
                <ArrowRight className="size-4" />
              </Link>
            ) : null}
          </div>
        </section>

        <TodaySection can={can} />

        {quickActions.length > 0 ? (
          <section aria-labelledby="home-quick">
            <h2 id="home-quick" className="mb-3 text-sm font-semibold text-[color:var(--text-primary)]">
              Ações rápidas
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {quickActions.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="group flex items-start gap-3 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] p-4 transition hover:border-[color:var(--primary)]/40 hover:shadow-md"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[color:var(--primary)]/10 text-[color:var(--primary)]">
                      <Icon className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2 text-sm font-semibold text-[color:var(--text-primary)]">
                        {item.label}
                        <ArrowRight className="size-3.5 shrink-0 text-[color:var(--text-muted)] opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
                      </span>
                      <span className="mt-0.5 block text-xs leading-4 text-[color:var(--text-muted)]">
                        {navItemDescriptions[item.to]}
                      </span>
                    </span>
                  </Link>
                )
              })}
            </div>
          </section>
        ) : null}

        {recentItems.length > 0 ? (
          <section aria-labelledby="home-recent">
            <h2
              id="home-recent"
              className="mb-3 flex items-center gap-2 text-sm font-semibold text-[color:var(--text-primary)]"
            >
              <History className="size-4 text-[color:var(--primary)]" />
              Continue de onde parou
            </h2>
            <div className="flex flex-wrap gap-2">
              {recentItems.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] px-3.5 py-2 text-sm text-[color:var(--text-primary)] transition hover:border-[color:var(--primary)]/40"
                  >
                    <Icon className="size-4 text-[color:var(--text-muted)]" />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </section>
        ) : null}
      </div>
    </>
  )
}
