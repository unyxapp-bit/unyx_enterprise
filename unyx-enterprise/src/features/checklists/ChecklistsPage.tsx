import { useMemo, useState } from "react"
import type { Dispatch, FormEvent, ReactNode, SetStateAction } from "react"
import {
  AlertTriangle,
  BookOpenText,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  FileSpreadsheet,
  History,
  ImagePlus,
  MoreVertical,
  Plus,
  PencilLine,
  RotateCcw,
  ShieldCheck,
  Timer,
  Trash2,
  XCircle,
} from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { useAuth } from "@/app/providers/auth-context"
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
import { Select } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  cellToText,
  cellToTime,
  getCell,
  normalizeColumn,
  parseSpreadsheet,
} from "@/lib/spreadsheet"
import { createChecklistProcedure } from "@/services/unyxApi"
import {
  useApproveChecklistRun,
  useBranches,
  useChecklistProcedures,
  useChecklistRuns,
  useCompleteChecklistRun,
  useCreateChecklistProcedure,
  useDeleteChecklistProcedure,
  useSectors,
  useUpdateChecklistProcedure,
} from "@/hooks/useUnyxData"
import { formatDateTimeBR } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/store/useAppStore"
import type {
  ChecklistApprovalStatus,
  ChecklistProcedure,
  ChecklistProcedureFrequency,
  ChecklistRun,
  UserProfile,
  UserRole,
} from "@/types/domain"
import type { ChecklistProcedureInput } from "@/services/unyxApi"

const fieldClass =
  "h-8 w-full rounded-lg border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] px-2.5 text-sm text-[color:var(--text-primary)] outline-none transition-colors placeholder:text-[color:var(--text-muted)] focus:border-ring focus:ring-3 focus:ring-ring/50 disabled:cursor-not-allowed disabled:bg-[color:var(--bg-muted)] disabled:text-[color:var(--text-muted)] disabled:opacity-70"

const textareaClass =
  "min-h-20 w-full rounded-lg border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] px-2.5 py-2 text-sm text-[color:var(--text-primary)] outline-none transition-colors placeholder:text-[color:var(--text-muted)] focus:border-ring focus:ring-3 focus:ring-ring/50 disabled:cursor-not-allowed disabled:bg-[color:var(--bg-muted)] disabled:text-[color:var(--text-muted)] disabled:opacity-70"

const frequencyLabel: Record<ChecklistProcedureFrequency, string> = {
  daily: "Diário",
  weekly: "Semanal",
  monthly: "Mensal",
  on_demand: "Sob demanda",
}

const frequencyOptions: ChecklistProcedureFrequency[] = [
  "daily",
  "weekly",
  "monthly",
  "on_demand",
]

const managerRoles: UserRole[] = ["owner", "admin", "branch_manager", "supervisor"]
const checklistViews = [
  ["checklists", "Checklists"],
  ["procedures", "Procedimentos"],
  ["pending", "Pendentes"],
  ["history", "Histórico"],
] as const

type ChecklistView = (typeof checklistViews)[number][0]
type ChecklistToolKind = "checklist" | "procedure"
type TextByProcedure = Record<string, Record<string, string>>

const emptyForm = {
  kind: "checklist" as ChecklistToolKind,
  branch_id: "",
  sector_id: "",
  title: "",
  category: "",
  frequency: "daily" as ChecklistProcedureFrequency,
  estimated_minutes: "",
  owner_role: "",
  due_time: "",
  evidence_required: false,
  requires_approval: false,
  approval_role: "",
  instructions: "",
  checklist_items: "",
}

function procedureToForm(procedure: ChecklistProcedure) {
  return {
    kind: isChecklist(procedure) ? ("checklist" as ChecklistToolKind) : ("procedure" as ChecklistToolKind),
    branch_id: procedure.branch_id ?? "",
    sector_id: procedure.sector_id ?? "",
    title: procedure.title,
    category: procedure.category ?? "",
    frequency: procedure.frequency as ChecklistProcedureFrequency,
    estimated_minutes: procedure.estimated_minutes ? String(procedure.estimated_minutes) : "",
    owner_role: procedure.owner_role ?? "",
    due_time: procedure.due_time ?? "",
    evidence_required: procedure.evidence_required,
    requires_approval: procedure.requires_approval,
    approval_role: procedure.approval_role ?? "",
    instructions: procedure.instructions ?? "",
    checklist_items: procedure.checklist_items.join("\n"),
  }
}

function normalizeImportValue(value: string) {
  return normalizeColumn(value)
}

function parseImportBoolean(value: unknown) {
  const normalized = normalizeImportValue(cellToText(value))
  return ["1", "sim", "s", "true", "yes", "y", "x"].includes(normalized)
}

function parseImportFrequency(
  value: unknown,
  fallback: ChecklistProcedureFrequency
): ChecklistProcedureFrequency {
  const normalized = normalizeImportValue(cellToText(value))
  if (!normalized) return fallback
  if (["daily", "diario", "diaria", "dia"].includes(normalized)) return "daily"
  if (["weekly", "semanal", "semana"].includes(normalized)) return "weekly"
  if (["monthly", "mensal", "mes"].includes(normalized)) return "monthly"
  if (
    ["on_demand", "ondemand", "sob_demanda", "sobdemanda", "demanda"].includes(normalized)
  ) {
    return "on_demand"
  }
  return fallback
}

function splitImportItems(value: string) {
  return value
    .replace(/\r/g, "")
    .split(/\n|;|\|/g)
    .map((item) => item.trim())
    .filter(Boolean)
}

function parseImportMinutes(value: unknown) {
  const text = cellToText(value)
  if (!text) return null
  const normalized = text.replace(/[^\d]/g, "")
  if (!normalized) return null
  const minutes = Number(normalized)
  return Number.isFinite(minutes) && minutes > 0 ? minutes : null
}

function buildImportProcedureInput(
  row: Record<string, unknown>,
  defaultBranchId: string | null,
  defaultKind: ChecklistToolKind
): { input?: ChecklistProcedureInput; error?: string } {
  const title = cellToText(getCell(row, ["título", "title", "nome"]))
  if (!title) {
    return { error: "título obrigatório." }
  }

  const rawItems = cellToText(getCell(row, ["itens", "items", "checklist_items"]))
  const instructions = cellToText(
    getCell(row, ["instruções", "instructions", "passo_a_passo", "passos"])
  )
  const checklistItems = splitImportItems(rawItems)
  const kindRaw = normalizeImportValue(
    cellToText(getCell(row, ["tipo", "kind", "modelo", "categoria_tipo"]))
  )
  const inferredKind: ChecklistToolKind =
    checklistItems.length > 0 ? "checklist" : instructions ? "procedure" : defaultKind
  const kind: ChecklistToolKind =
    kindRaw.includes("proc") || kindRaw === "procedimento"
      ? "procedure"
      : kindRaw.includes("check")
        ? "checklist"
        : inferredKind

  if (kind === "checklist" && checklistItems.length === 0) {
    return { error: "itens do checklist obrigatórios." }
  }
  if (kind === "procedure" && !instructions) {
    return { error: "passo a passo do procedimento obrigatório." }
  }

  const estimatedMinutes = parseImportMinutes(
    getCell(row, ["minutos", "tempo", "estimated_minutes"])
  )
  const dueTime = cellToTime(getCell(row, ["prazo", "hora", "due_time"])) || null
  const frequency = parseImportFrequency(
    getCell(row, ["frequência", "frequence", "frequency"]),
    kind === "procedure" ? "on_demand" : "daily"
  )
  const category = cellToText(getCell(row, ["categoria", "grupo", "tag"])) || null
  const ownerRole = cellToText(getCell(row, ["responsável", "responsavel_padrao", "owner_role"]))
  const approvalRole = cellToText(getCell(row, ["aprovador", "approval_role"]))

  return {
    input: {
      branch_id: defaultBranchId,
      sector_id: null,
      title,
      category,
      frequency,
      estimated_minutes: estimatedMinutes,
      owner_role: ownerRole || null,
      due_time: dueTime,
      evidence_required: parseImportBoolean(
        getCell(row, ["evidência", "exige_evidencia", "evidence_required"])
      ),
      requires_approval: parseImportBoolean(
        getCell(row, ["aprovação", "exige_aprovacao", "requires_approval"])
      ),
      approval_role: approvalRole || null,
      instructions: instructions || null,
      checklist_items: kind === "checklist" ? checklistItems : [],
    },
  }
}

function todayStartISO() {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date.toISOString()
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function splitChecklistItems(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)
}

function canManageProcedures(role: UserRole | undefined) {
  return Boolean(role && managerRoles.includes(role))
}

function isChecklist(procedure: ChecklistProcedure) {
  return procedure.checklist_items.length > 0
}

function isProcedureDocument(procedure: ChecklistProcedure) {
  return !isChecklist(procedure) && Boolean(procedure.instructions?.trim())
}

function procedureSteps(instructions: string) {
  return instructions
    .split("\n")
    .map((step) => step.trim())
    .filter(Boolean)
}

function formatTime(value: string | null | undefined) {
  return value ? value.slice(0, 5) : "--:--"
}

function scopeLabel(procedure: ChecklistProcedure) {
  const branch = procedure.branches?.name ?? "Toda empresa"
  return procedure.sectors?.name ? `${branch} - ${procedure.sectors.name}` : branch
}

function dueDateForProcedure(procedure: ChecklistProcedure, dateKey = localDateKey()) {
  if (!procedure.due_time) return null
  const [hours, minutes] = procedure.due_time.slice(0, 5).split(":").map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  const [year, month, day] = dateKey.split("-").map(Number)
  return new Date(year, month - 1, day, hours, minutes, 0, 0)
}

function procedureStatus(procedure: ChecklistProcedure, isCompletedToday: boolean) {
  if (isCompletedToday) {
    return {
      label: "Concluído",
      className: "border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      priority: 4,
    }
  }

  if (procedure.frequency === "on_demand") {
    return {
      label: "Sob demanda",
      className: "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300",
      priority: 3,
    }
  }

  const dueAt = dueDateForProcedure(procedure)
  if (dueAt) {
    const delta = dueAt.getTime() - Date.now()
    if (delta < 0) {
      return {
        label: "Atrasado",
        className: "border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300",
        priority: 0,
      }
    }
    if (delta <= 60 * 60 * 1000) {
      return {
        label: "Próximo",
        className: "border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300",
        priority: 1,
      }
    }
  }

  return {
    label: "Pendente",
    className: "border-sky-200 dark:border-sky-500/30 bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300",
    priority: 2,
  }
}

function approvalClassName(status: ChecklistApprovalStatus) {
  if (status === "approved") return "border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
  if (status === "rejected") return "border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300"
  if (status === "pending") return "border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300"
  return "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300"
}

function approvalLabel(status: ChecklistApprovalStatus) {
  if (status === "approved") return "Aprovado"
  if (status === "rejected") return "Reprovado"
  if (status === "pending") return "Aguardando aprovação"
  return "Sem aprovação"
}

function CompactMetric({
  detail,
  icon,
  title,
  value,
  tone = "slate",
  active = false,
  onClick,
}: {
  detail: string
  icon: ReactNode
  title: string
  value: number
  tone?: "slate" | "emerald" | "amber" | "red" | "sky"
  active?: boolean
  onClick?: () => void
}) {
  const className = cn(
    "flex w-full items-center gap-2 rounded-lg border bg-[color:var(--bg-surface)] px-2.5 py-1.5 text-left shadow-sm transition-colors",
    tone === "emerald" && "border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-500/10",
    tone === "amber" && "border-amber-200 dark:border-amber-500/30 bg-amber-50/40 dark:bg-amber-500/10",
    tone === "red" && "border-red-200 dark:border-red-500/30 bg-red-50/40 dark:bg-red-500/10",
    tone === "sky" && "border-sky-200 dark:border-sky-500/30 bg-sky-50/40 dark:bg-sky-500/10",
    tone === "slate" && "border-[color:var(--border-soft)]",
    onClick && "cursor-pointer hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-primary",
    active && "ring-2 ring-primary"
  )
  const content = (
    <>
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[color:var(--bg-surface-soft)] text-muted-foreground [&_svg]:size-3.5">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[10px] font-medium leading-tight text-muted-foreground">
          {title}
        </span>
        <span className="block text-base font-semibold leading-tight text-[color:var(--text-primary)]">
          {value}
        </span>
      </span>
    </>
  )

  // A descrição ("Execuções registradas" etc.) fica na dica ao passar o mouse.
  return onClick ? (
    <button type="button" className={className} onClick={onClick} aria-pressed={active} title={detail}>
      {content}
    </button>
  ) : (
    <div className={className} title={detail}>
      {content}
    </div>
  )
}

function ChecklistCard({
  checkedItems,
  evidenceNotes,
  isCompletedToday,
  isPending,
  itemEvidence,
  itemOccurrence,
  notes,
  onComplete,
  onEvidenceChange,
  onItemEvidenceChange,
  onItemOccurrenceChange,
  onNotesChange,
  onReset,
  onToggleAll,
  onToggleItem,
  onEdit,
  onDelete,
  canManage,
  procedure,
}: {
  checkedItems: string[]
  evidenceNotes: string
  isCompletedToday: boolean
  isPending: boolean
  itemEvidence: Record<string, string>
  itemOccurrence: Record<string, string>
  notes: string
  onComplete: () => void
  onEvidenceChange: (value: string) => void
  onItemEvidenceChange: (item: string, value: string) => void
  onItemOccurrenceChange: (item: string, value: string) => void
  onNotesChange: (value: string) => void
  onReset: () => void
  onToggleAll: () => void
  onToggleItem: (item: string) => void
  onEdit: () => void
  onDelete: () => void
  canManage: boolean
  procedure: ChecklistProcedure
}) {
  const totalItems = procedure.checklist_items.length
  const checkedCount = checkedItems.length
  const complete = totalItems > 0 && checkedCount === totalItems
  const status = procedureStatus(procedure, isCompletedToday)
  const progress = totalItems > 0 ? Math.round((checkedCount / totalItems) * 100) : 0
  const evidenceMissing =
    procedure.evidence_required &&
    !evidenceNotes.trim() &&
    !procedure.checklist_items.every((item) => itemEvidence[item]?.trim())

  return (
    <Card className="border border-[color:var(--border-soft)] bg-white dark:bg-[color:var(--bg-surface)] shadow-sm" size="sm">
      <CardHeader className="gap-2 px-3 pb-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ClipboardList className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{procedure.title}</span>
            </CardTitle>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
              <span>{scopeLabel(procedure)}</span>
              {procedure.estimated_minutes ? (
                <span>{procedure.estimated_minutes} min</span>
              ) : null}
              {procedure.due_time ? <span>até {formatTime(procedure.due_time)}</span> : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Badge
              variant="outline"
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px]",
                status.className
              )}
            >
              {status.label}
            </Badge>
            {canManage ? (
              <ProcedureActionsMenu onEdit={onEdit} onDelete={onDelete} />
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px]">
            {frequencyLabel[procedure.frequency]}
          </Badge>
          {procedure.category ? (
            <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[10px]">
              {procedure.category}
            </Badge>
          ) : null}
          {procedure.evidence_required ? (
            <Badge variant="outline" className="rounded-full border-sky-200 dark:border-sky-500/30 bg-sky-50 dark:bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-700 dark:text-sky-300">
              Evidência
            </Badge>
          ) : null}
          {procedure.requires_approval ? (
            <Badge variant="outline" className="rounded-full border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-700 dark:text-amber-300">
              Aprovação
            </Badge>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-3 px-3">
        {procedure.instructions ? (
          <p className="line-clamp-3 rounded-lg border bg-slate-50 dark:bg-slate-800/60 px-2.5 py-2 text-xs leading-5 text-slate-700 dark:text-slate-300">
            {procedure.instructions}
          </p>
        ) : null}

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
            <span className="font-medium">
              {checkedCount} de {totalItems} itens
            </span>
            <span className="text-muted-foreground">{progress}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-[color:var(--color-primary,#4f46e5)] transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" className="h-8 rounded-full px-3 text-xs" onClick={onToggleAll}>
            <CheckCircle2 className="size-3.5" />
            Marcar todos
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-8 rounded-full px-3 text-xs" onClick={onReset}>
            <RotateCcw className="size-3.5" />
            Limpar
          </Button>
        </div>

        <div className="space-y-2">
          {procedure.checklist_items.map((item) => {
            const checked = checkedItems.includes(item)
            return (
              <div
                key={item}
                className={cn(
                  "rounded-lg border px-2.5 py-2 text-sm transition-colors",
                  checked ? "border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10" : "bg-white dark:bg-transparent"
                )}
              >
                <label className="flex items-start gap-2">
                  <input
                    className="mt-1"
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleItem(item)}
                  />
                  <span className={cn("min-w-0 flex-1 text-xs leading-5", checked ? "text-emerald-900 dark:text-emerald-200" : "text-slate-700 dark:text-slate-300")}>
                    {item}
                  </span>
                </label>
                {checked ? (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <Input
                      value={itemEvidence[item] ?? ""}
                      onChange={(event) => onItemEvidenceChange(item, event.target.value)}
                      placeholder="Evidência ou link"
                      className="h-8 text-xs"
                    />
                    <Input
                      value={itemOccurrence[item] ?? ""}
                      onChange={(event) => onItemOccurrenceChange(item, event.target.value)}
                      placeholder="Ocorrência do item"
                      className="h-8 text-xs"
                    />
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>

        <div className="grid gap-2">
          <Input
            value={evidenceNotes}
            onChange={(event) => onEvidenceChange(event.target.value)}
            placeholder="Evidência geral, foto ou link"
            className="h-8 text-xs"
          />
          <textarea
            className="min-h-14 w-full rounded-lg border bg-white dark:bg-[color:var(--bg-surface)] px-2.5 py-2 text-xs outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"
            value={notes}
            onChange={(event) => onNotesChange(event.target.value)}
            placeholder="Observação da execução"
          />
        </div>

        {evidenceMissing ? (
          <div className="rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-2.5 py-2 text-xs text-amber-700 dark:text-amber-300">
            Informe uma evidência geral ou uma evidência em todos os itens.
          </div>
        ) : null}

        <Button
          className="h-9 w-full rounded-full text-xs"
          onClick={onComplete}
          disabled={!complete || isPending || isCompletedToday || evidenceMissing}
        >
          <ClipboardCheck className="size-4" />
          {isPending ? "Finalizando..." : isCompletedToday ? "Concluído hoje" : "Finalizar checklist"}
        </Button>
      </CardContent>
    </Card>
  )
}

function ProcedureDocumentCard({
  canManage,
  onDelete,
  onEdit,
  procedure,
}: {
  canManage: boolean
  onDelete: () => void
  onEdit: () => void
  procedure: ChecklistProcedure
}) {
  const steps = procedureSteps(procedure.instructions ?? "")

  return (
    <Card className="border border-[color:var(--border-soft)] bg-white dark:bg-[color:var(--bg-surface)] shadow-sm" size="sm">
      <CardHeader className="gap-2 px-3 pb-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-sm">
              <BookOpenText className="size-4 shrink-0 text-muted-foreground" />
              <span className="break-words">{procedure.title}</span>
            </CardTitle>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
              <span>{scopeLabel(procedure)}</span>
              {procedure.owner_role ? <span>{procedure.owner_role}</span> : null}
              {procedure.estimated_minutes ? (
                <span>{procedure.estimated_minutes} min</span>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Badge
              variant="outline"
              className="rounded-full border-sky-200 dark:border-sky-500/30 bg-sky-50 dark:bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-700 dark:text-sky-300"
            >
              Procedimento
            </Badge>
            {canManage ? (
              <ProcedureActionsMenu onEdit={onEdit} onDelete={onDelete} />
            ) : null}
          </div>
        </div>
        {procedure.category ? (
          <Badge variant="secondary" className="w-fit rounded-full px-2 py-0.5 text-[10px]">
            {procedure.category}
          </Badge>
        ) : null}
      </CardHeader>

      <CardContent className="px-3">
        <div className="space-y-2">
          {steps.map((step, index) => (
            <div key={`${procedure.id}-${index}`} className="flex items-start gap-2 text-xs leading-5 text-slate-700 dark:text-slate-300">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                {index + 1}
              </span>
              <p className="min-w-0 whitespace-pre-wrap break-words">{step}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function HistoryList({
  canApprove,
  isApproving,
  onApprove,
  onReject,
  runs,
}: {
  canApprove: boolean
  isApproving: boolean
  onApprove: (run: ChecklistRun) => void
  onReject: (run: ChecklistRun) => void
  runs: ChecklistRun[]
}) {
  if (runs.length === 0) {
    return (
      <StateBlock
        className="min-h-40"
        title="Sem execuções"
        description="Os checklists finalizados aparecem aqui."
      />
    )
  }

  return (
    <div className="grid gap-3">
      {runs.map((run) => {
        const hasOccurrence = Boolean(run.occurrence_notes)
        const completedLate =
          Boolean(run.due_at && run.completed_at) &&
          new Date(run.completed_at as string).getTime() >
            new Date(run.due_at as string).getTime()

        return (
          <div key={run.id} className="rounded-xl border border-[color:var(--border-soft)] bg-white dark:bg-[color:var(--bg-surface)] p-3 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-[color:var(--text-primary)]">
                  {run.checklist_procedures?.title ?? "Checklist"}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <Building2 className="size-3.5" />
                  <span>{run.branches?.name ?? "Empresa"}</span>
                  <span>{run.user_profiles?.name ?? "Usuário"}</span>
                  <span>{formatDateTimeBR(run.completed_at ?? run.created_at)}</span>
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-1.5">
                <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[10px]">
                  {run.checked_items.length} itens
                </Badge>
                {completedLate ? (
                  <Badge variant="outline" className="rounded-full border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-2 py-0.5 text-[10px] text-red-700 dark:text-red-300">
                    Atrasado
                  </Badge>
                ) : null}
                {hasOccurrence ? (
                  <Badge variant="outline" className="rounded-full border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-700 dark:text-amber-300">
                    Ocorrência
                  </Badge>
                ) : null}
                <Badge
                  variant="outline"
                  className={cn("rounded-full px-2 py-0.5 text-[10px]", approvalClassName(run.approval_status))}
                >
                  {approvalLabel(run.approval_status)}
                </Badge>
              </div>
            </div>

            {run.evidence_notes ? (
              <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-sky-50 dark:bg-sky-500/10 px-2.5 py-2 text-xs leading-5 text-sky-800 dark:text-sky-300">
                <ImagePlus className="mt-0.5 size-3.5 shrink-0" />
                <span>{run.evidence_notes}</span>
              </p>
            ) : null}

            {run.occurrence_notes ? (
              <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 dark:bg-amber-500/10 px-2.5 py-2 text-xs leading-5 text-amber-800 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                <span className="whitespace-pre-wrap">{run.occurrence_notes}</span>
              </p>
            ) : null}

            {run.notes ? (
              <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-600 dark:text-slate-300">
                {run.notes}
              </p>
            ) : null}

            {run.approved_profile?.name || run.rejected_reason ? (
              <div className="mt-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 px-2.5 py-2 text-xs text-muted-foreground">
                {run.approved_profile?.name ? `Responsável: ${run.approved_profile.name}` : null}
                {run.rejected_reason ? (
                  <span className="block text-red-700 dark:text-red-300">{run.rejected_reason}</span>
                ) : null}
              </div>
            ) : null}

            {canApprove && run.approval_status === "pending" ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="h-8 rounded-full px-3 text-xs"
                  disabled={isApproving}
                  onClick={() => onApprove(run)}
                >
                  <ShieldCheck className="size-3.5" />
                  Aprovar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  className="h-8 rounded-full px-3 text-xs"
                  disabled={isApproving}
                  onClick={() => onReject(run)}
                >
                  <XCircle className="size-3.5" />
                  Reprovar
                </Button>
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

function ProcedureActionsMenu({
  onEdit,
  onDelete,
}: {
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground hover:text-[color:var(--text-primary)]"
        >
          <MoreVertical className="size-4" />
          <span className="sr-only">Abrir ações</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onEdit}>
          <PencilLine className="mr-2 size-3.5" />
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-red-700 dark:text-red-300 focus:text-red-700"
          onSelect={onDelete}
        >
          <Trash2 className="mr-2 size-3.5" />
          Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ChecklistDeleteDialog({
  open,
  procedure,
  isDeleting,
  onOpenChange,
  onConfirm,
}: {
  open: boolean
  procedure: ChecklistProcedure | null
  isDeleting: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Excluir procedimento</DialogTitle>
          <DialogDescription>
            Essa ação desativa o item sem apagar o histórico das execuções.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-soft)] px-3 py-2 text-sm text-[color:var(--text-secondary)]">
          <div className="font-medium text-[color:var(--text-primary)]">
            {procedure?.title ?? "Registro selecionado"}
          </div>
          <div className="mt-1">
            {procedure?.checklist_items.length ? "Checklist" : "Procedimento"}
            {" · "}
            {procedure?.category ?? "Sem categoria"}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" variant="destructive" disabled={isDeleting} onClick={onConfirm}>
            {isDeleting ? "Excluindo..." : "Excluir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ChecklistImportDialog({
  defaultKind,
  profile,
  selectedBranchId,
}: {
  defaultKind: ChecklistToolKind
  profile: UserProfile | null | undefined
  selectedBranchId: string | null
}) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [fileName, setFileName] = useState("")
  const [rows, setRows] = useState<ChecklistProcedureInput[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [isImporting, setIsImporting] = useState(false)

  const isOrgAdmin = profile?.role === "owner" || profile?.role === "admin"
  const branchId = selectedBranchId || (!isOrgAdmin ? profile?.branch_id ?? null : null)

  function resetState() {
    setFileName("")
    setRows([])
    setErrors([])
    setIsImporting(false)
  }

  async function handleFile(file: File | null) {
    setRows([])
    setErrors([])
    setFileName(file?.name ?? "")

    if (!file) return

    if (!branchId && !isOrgAdmin) {
      setErrors([
        "Selecione uma filial na tela antes de importar a planilha.",
      ])
      return
    }

    try {
      const parsed = await parseSpreadsheet(file)
      const nextRows: ChecklistProcedureInput[] = []
      const nextErrors: string[] = []

      parsed.forEach((row, index) => {
        const result = buildImportProcedureInput(row, branchId, defaultKind)
        if (result.error || !result.input) {
          nextErrors.push(`Linha ${index + 2}: ${result.error ?? "registro invalido."}`)
          return
        }
        nextRows.push(result.input)
      })

      setRows(nextRows)
      setErrors(nextErrors)
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Não foi possível ler a planilha."])
    }
  }

  async function handleImport() {
    if (!profile) {
      setErrors(["Não foi possível identificar o usuário logado."])
      return
    }

    if (rows.length === 0) return

    setIsImporting(true)
    const nextErrors = [...errors]
    let createdCount = 0

    try {
      for (const row of rows) {
        try {
          await createChecklistProcedure(profile, row)
          createdCount += 1
        } catch (error) {
          nextErrors.push(
            error instanceof Error ? error.message : `Falha ao importar ${row.title}.`
          )
        }
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["checklist-procedures"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["audit-logs"] }),
        queryClient.invalidateQueries({ queryKey: ["audit-logs-all"] }),
      ])

      setErrors(nextErrors)

      if (createdCount > 0) {
        toast.success(
          createdCount === 1
            ? "1 registro importado."
            : `${createdCount} registros importados.`
        )
      }

      if (createdCount > 0 && nextErrors.length === 0) {
        setOpen(false)
        resetState()
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao importar a planilha.")
      setErrors([
        error instanceof Error ? error.message : "Falha ao importar a planilha.",
      ])
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) resetState()
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileSpreadsheet className="size-4" />
          Importar XLSX
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar planilha</DialogTitle>
          <DialogDescription>
            Crie checklists e procedimentos em lote a partir de um arquivo .xlsx.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-soft)] p-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--text-primary)]">
                <ClipboardList className="size-4 text-sky-600 dark:text-sky-300" />
                Checklist
              </div>
              <p className="mt-1 text-sm leading-5 text-[color:var(--text-secondary)]">
                Lista objetiva do que verificar. Use a coluna <span className="font-medium">itens</span>{" "}
                com um item por linha.
              </p>
            </div>
            <div className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-soft)] p-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--text-primary)]">
                <BookOpenText className="size-4 text-violet-600 dark:text-violet-300" />
                Procedimento
              </div>
              <p className="mt-1 text-sm leading-5 text-[color:var(--text-secondary)]">
                Passo a passo detalhado. Use a coluna <span className="font-medium">instruções</span>{" "}
                para descrever a execução.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-soft)] p-3 text-sm text-[color:var(--text-secondary)]">
            A filial segue a seleção atual da tela. Se a coluna <span className="font-medium">tipo</span>{" "}
            estiver vazia, o app usa a aba atual como padrão.
          </div>

          <div className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-soft)] p-3 text-sm text-[color:var(--text-secondary)]">
            Colunas aceitas: <span className="font-medium">tipo, título, categoria, frequência, minutos, responsável, prazo, aprovador, evidência, aprovação, itens, instruções</span>.
          </div>

          <Input
            type="file"
            accept=".xlsx,.csv"
            onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
          />

          {fileName ? (
            <div className="text-sm text-muted-foreground">
              {fileName}: {rows.length} linha(s) prontas para importar.
            </div>
          ) : null}

          {errors.length > 0 ? (
            <div className="max-h-40 overflow-auto rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-3 text-sm text-[color:var(--text-secondary)]">
              {errors.slice(0, 12).map((error) => (
                <div key={error}>{error}</div>
              ))}
              {errors.length > 12 ? <div>...mais {errors.length - 12}</div> : null}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            disabled={rows.length === 0 || isImporting}
            onClick={() => void handleImport()}
          >
            <FileSpreadsheet className="size-4" />
            {isImporting ? "Importando..." : "Importar XLSX"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ChecklistsPage() {
  const { profile } = useAuth()
  const selectedBranchId = useAppStore((state) => state.selectedBranchId)
  const procedures = useChecklistProcedures()
  const runsToday = useChecklistRuns(todayStartISO())
  const history = useChecklistRuns()
  const branches = useBranches()
  const createProcedure = useCreateChecklistProcedure()
  const updateProcedure = useUpdateChecklistProcedure()
  const deleteProcedure = useDeleteChecklistProcedure()
  const completeRun = useCompleteChecklistRun()
  const approveRun = useApproveChecklistRun()
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<ChecklistView>("checklists")
  // Filtro aplicado ao clicar num cartão de métrica (Atrasados / Aprovação).
  const [metricFilter, setMetricFilter] = useState<"overdue" | "approval" | null>(null)
  const selectView = (next: ChecklistView, filter: "overdue" | "approval" | null = null) => {
    setView(next)
    setMetricFilter(filter)
  }
  const [editingProcedure, setEditingProcedure] = useState<ChecklistProcedure | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ChecklistProcedure | null>(null)
  const [checkedByProcedure, setCheckedByProcedure] = useState<Record<string, string[]>>({})
  const [notesByProcedure, setNotesByProcedure] = useState<Record<string, string>>({})
  const [evidenceByProcedure, setEvidenceByProcedure] = useState<Record<string, string>>({})
  const [itemEvidenceByProcedure, setItemEvidenceByProcedure] = useState<TextByProcedure>({})
  const [itemOccurrenceByProcedure, setItemOccurrenceByProcedure] = useState<TextByProcedure>({})
  const [form, setForm] = useState(emptyForm)
  const isOrgAdmin = profile?.role === "owner" || profile?.role === "admin"
  const effectiveFormBranchId =
    form.branch_id || (!isOrgAdmin && !editingProcedure ? profile?.branch_id ?? "" : "")
  const sectors = useSectors(effectiveFormBranchId || null)
  const canCreate = canManageProcedures(profile?.role)
  const isSaving = createProcedure.isPending || updateProcedure.isPending

  const checklistIds = useMemo(
    () =>
      new Set(
        (procedures.data ?? []).filter(isChecklist).map((procedure) => procedure.id)
      ),
    [procedures.data]
  )
  const completedTodayRuns = useMemo(
    () => (runsToday.data ?? []).filter((run) => checklistIds.has(run.procedure_id)),
    [checklistIds, runsToday.data]
  )
  const checklistHistory = useMemo(
    () => (history.data ?? []).filter((run) => checklistIds.has(run.procedure_id)),
    [checklistIds, history.data]
  )
  const completedTodayIds = useMemo(
    () => new Set(completedTodayRuns.map((run) => run.procedure_id)),
    [completedTodayRuns]
  )

  const stats = useMemo(() => {
    const activeChecklists = (procedures.data ?? []).filter(isChecklist)
    const procedureDocuments = (procedures.data ?? []).filter(isProcedureDocument)
    const dailyProcedures = activeChecklists.filter(
      (procedure) => procedure.frequency === "daily"
    )
    const dailyPendingRows = dailyProcedures.filter(
      (procedure) => !completedTodayIds.has(procedure.id)
    )
    const overdueRows = dailyPendingRows.filter(
      (procedure) => procedureStatus(procedure, false).label === "Atrasado"
    )
    const approvalPending = checklistHistory.filter(
      (run) => run.approval_status === "pending"
    ).length

    return {
      activeChecklists: activeChecklists.length,
      procedureDocuments: procedureDocuments.length,
      completedToday: completedTodayRuns.length,
      dailyPending: dailyPendingRows.length,
      overdue: overdueRows.length,
      dailyTotal: dailyProcedures.length,
      approvalPending,
    }
  }, [checklistHistory, completedTodayIds, completedTodayRuns.length, procedures.data])

  const viewCounts: Record<ChecklistView, number> = {
    checklists: stats.activeChecklists,
    procedures: stats.procedureDocuments,
    pending: stats.dailyPending,
    history: checklistHistory.length,
  }

  const displayedChecklists = useMemo(() => {
    const rows = (procedures.data ?? []).filter(isChecklist)
    const base =
      view === "pending"
        ? rows.filter(
            (procedure) =>
              procedure.frequency === "daily" &&
              !completedTodayIds.has(procedure.id) &&
              (metricFilter !== "overdue" ||
                procedureStatus(procedure, false).label === "Atrasado")
          )
        : rows

    return base.slice().sort((left, right) => {
      const leftStatus = procedureStatus(left, completedTodayIds.has(left.id))
      const rightStatus = procedureStatus(right, completedTodayIds.has(right.id))
      if (leftStatus.priority !== rightStatus.priority) {
        return leftStatus.priority - rightStatus.priority
      }
      return left.title.localeCompare(right.title)
    })
  }, [completedTodayIds, metricFilter, procedures.data, view])

  const displayedProcedureDocuments = useMemo(
    () =>
      (procedures.data ?? [])
        .filter(isProcedureDocument)
        .slice()
        .sort((left, right) => left.title.localeCompare(right.title)),
    [procedures.data]
  )

  function resetForm() {
    setForm(emptyForm)
    setEditingProcedure(null)
  }

  function openCreate(kind: ChecklistToolKind = "checklist") {
    setDeleteTarget(null)
    setEditingProcedure(null)
    setForm({ ...emptyForm, kind, branch_id: selectedBranchId ?? "" })
    setOpen(true)
  }

  function openEdit(procedure: ChecklistProcedure) {
    setDeleteTarget(null)
    setEditingProcedure(procedure)
    setForm(procedureToForm(procedure))
    setOpen(true)
  }

  function changeFormKind(kind: ChecklistToolKind) {
    setForm((current) => ({
      ...current,
      kind,
      frequency: kind === "checklist" ? current.frequency : "on_demand",
      due_time: kind === "checklist" ? current.due_time : "",
      evidence_required: kind === "checklist" && current.evidence_required,
      requires_approval: kind === "checklist" && current.requires_approval,
      approval_role: kind === "checklist" ? current.approval_role : "",
      instructions: kind === "procedure" ? current.instructions : "",
      checklist_items: kind === "checklist" ? current.checklist_items : "",
    }))
  }

  function setItemText(
    setter: Dispatch<SetStateAction<TextByProcedure>>,
    procedureId: string,
    item: string,
    value: string
  ) {
    setter((current) => ({
      ...current,
      [procedureId]: {
        ...(current[procedureId] ?? {}),
        [item]: value,
      },
    }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const payload = {
      branch_id: effectiveFormBranchId || null,
      sector_id: form.sector_id || null,
      title: form.title.trim(),
      category: form.category.trim() || null,
      frequency: form.kind === "checklist" ? form.frequency : "on_demand",
      estimated_minutes: form.estimated_minutes
        ? Number(form.estimated_minutes)
        : null,
      owner_role: form.owner_role.trim() || null,
      due_time: form.kind === "checklist" ? form.due_time || null : null,
      evidence_required: form.kind === "checklist" && form.evidence_required,
      requires_approval: form.kind === "checklist" && form.requires_approval,
      approval_role:
        form.kind === "checklist" ? form.approval_role.trim() || null : null,
      instructions: form.kind === "procedure" ? form.instructions.trim() : null,
      checklist_items:
        form.kind === "checklist" ? splitChecklistItems(form.checklist_items) : [],
    }

    if (editingProcedure) {
      await updateProcedure.mutateAsync({
        procedureId: editingProcedure.id,
        checklist: payload,
      })
    } else {
      await createProcedure.mutateAsync(payload)
    }

    resetForm()
    setOpen(false)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    await deleteProcedure.mutateAsync(deleteTarget.id)
    setDeleteTarget(null)
  }

  function toggleItem(procedureId: string, item: string) {
    setCheckedByProcedure((current) => {
      const checked = current[procedureId] ?? []
      return {
        ...current,
        [procedureId]: checked.includes(item)
          ? checked.filter((checkedItem) => checkedItem !== item)
          : [...checked, item],
      }
    })
  }

  function toggleAll(procedure: ChecklistProcedure) {
    setCheckedByProcedure((current) => {
      const checked = current[procedure.id] ?? []
      const allChecked = checked.length === procedure.checklist_items.length
      return {
        ...current,
        [procedure.id]: allChecked ? [] : procedure.checklist_items,
      }
    })
  }

  function resetProcedure(procedureId: string) {
    setCheckedByProcedure((current) => ({ ...current, [procedureId]: [] }))
    setNotesByProcedure((current) => ({ ...current, [procedureId]: "" }))
    setEvidenceByProcedure((current) => ({ ...current, [procedureId]: "" }))
    setItemEvidenceByProcedure((current) => ({ ...current, [procedureId]: {} }))
    setItemOccurrenceByProcedure((current) => ({ ...current, [procedureId]: {} }))
  }

  async function completeProcedure(procedure: ChecklistProcedure) {
    const checkedItems = checkedByProcedure[procedure.id] ?? []
    const evidenceMap = itemEvidenceByProcedure[procedure.id] ?? {}
    const occurrenceMap = itemOccurrenceByProcedure[procedure.id] ?? {}
    const itemResults = procedure.checklist_items.map((item) => ({
      item,
      checked: checkedItems.includes(item),
      evidence: evidenceMap[item]?.trim() || null,
      occurrence: occurrenceMap[item]?.trim() || null,
    }))

    await completeRun.mutateAsync({
      procedure_id: procedure.id,
      branch_id: procedure.branch_id ?? selectedBranchId,
      checked_items: checkedItems,
      item_results: itemResults,
      evidence_notes: evidenceByProcedure[procedure.id]?.trim() || null,
      notes: notesByProcedure[procedure.id]?.trim() || null,
    })
    resetProcedure(procedure.id)
  }

  function renderEmptyState(kind: ChecklistToolKind) {
    const isProcedure = kind === "procedure"
    return (
      <div className="rounded-2xl border border-dashed border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] px-5 py-8 text-center shadow-sm">
        {isProcedure ? (
          <BookOpenText className="mx-auto mb-3 size-7 text-muted-foreground" />
        ) : (
          <ClipboardList className="mx-auto mb-3 size-7 text-muted-foreground" />
        )}
        <h3 className="text-sm font-medium text-[color:var(--text-primary)]">
          {isProcedure ? "Nenhum procedimento cadastrado" : "Nenhum checklist cadastrado"}
        </h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-[color:var(--text-muted)]">
          {isProcedure
            ? "Cadastre o passo a passo detalhado de uma atividade."
            : "Cadastre os itens que precisam ser conferidos durante uma atividade."}
        </p>
        {canCreate ? (
          <Button
            type="button"
            size="sm"
            className="mt-4"
            onClick={() => openCreate(kind)}
          >
            <Plus className="size-4" />
            {isProcedure ? "Novo procedimento" : "Novo checklist"}
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <>
      <PageHeader
        large
        title="Checklists e Procedimentos"
        description="Checklist mostra o que conferir. Procedimento mostra como executar."
        action={
          canCreate ? (
            <div className="flex items-center gap-2">
              <ChecklistImportDialog
                defaultKind={view === "procedures" ? "procedure" : "checklist"}
                profile={profile}
                selectedBranchId={selectedBranchId}
              />
              <Dialog
                open={open}
                onOpenChange={(nextOpen) => {
                  setOpen(nextOpen)
                  if (!nextOpen) resetForm()
                }}
              >
                <DialogTrigger asChild>
                  <Button
                    onClick={() =>
                      openCreate(view === "procedures" ? "procedure" : "checklist")
                    }
                  >
                    <Plus className="size-4" />
                    Novo cadastro
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
                  <DialogHeader>
                    <DialogTitle>
                      {editingProcedure
                        ? form.kind === "checklist"
                          ? "Editar checklist"
                          : "Editar procedimento"
                        : form.kind === "checklist"
                          ? "Cadastrar checklist"
                          : "Cadastrar procedimento"}
                    </DialogTitle>
                    <DialogDescription>
                      {editingProcedure
                        ? "Ajuste os dados e salve a nova versão direto no app."
                        : form.kind === "checklist"
                          ? "Crie uma lista objetiva com os itens que devem ser conferidos."
                          : "Documente o passo a passo detalhado de como a atividade deve ser executada."}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="grid grid-cols-2 rounded-lg border bg-[color:var(--bg-surface-soft)] p-1">
                    <Button
                      type="button"
                      size="sm"
                      variant={form.kind === "checklist" ? "default" : "ghost"}
                      className="rounded-md"
                      onClick={() => changeFormKind("checklist")}
                    >
                      <ClipboardList className="size-4" />
                      Checklist
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={form.kind === "procedure" ? "default" : "ghost"}
                      className="rounded-md"
                      onClick={() => changeFormKind("procedure")}
                    >
                      <BookOpenText className="size-4" />
                      Procedimento
                    </Button>
                  </div>

                  <form className="space-y-4" onSubmit={handleSubmit}>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="space-y-1 text-sm">
                        <span className="font-medium">Filial</span>
                        <Select
                          disabled={!isOrgAdmin}
                          value={effectiveFormBranchId}
                          onValueChange={(value) =>
                            setForm((current) => ({ ...current, branch_id: value, sector_id: "" }))
                          }
                          options={[
                            ...(isOrgAdmin ? [{ value: "", label: "Toda a empresa" }] : []),
                            ...(!isOrgAdmin &&
                            profile?.branch_id &&
                            !(branches.data ?? []).some((branch) => branch.id === profile.branch_id)
                              ? [{ value: profile.branch_id, label: "Minha filial" }]
                              : []),
                            ...(!isOrgAdmin && !profile?.branch_id
                              ? [{ value: "", label: "Sem filial vinculada" }]
                              : []),
                            ...(branches.data ?? []).map((branch) => ({
                              value: branch.id,
                              label: branch.name,
                            })),
                          ]}
                        />
                      </label>
                      <label className="space-y-1 text-sm">
                        <span className="font-medium">Setor</span>
                        <Select
                          disabled={!effectiveFormBranchId}
                          value={form.sector_id}
                          onValueChange={(value) =>
                            setForm((current) => ({ ...current, sector_id: value }))
                          }
                          options={[
                            { value: "", label: "Todos os setores" },
                            ...(sectors.data ?? []).map((sector) => ({
                              value: sector.id,
                              label: sector.name,
                            })),
                          ]}
                        />
                      </label>
                    </div>

                    <label className="space-y-1 text-sm">
                      <span className="font-medium">Título</span>
                      <Input
                        className={fieldClass}
                        required
                        value={form.title}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            title: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <div
                      className={cn(
                        "grid gap-3",
                        form.kind === "checklist" ? "sm:grid-cols-5" : "sm:grid-cols-3"
                      )}
                    >
                      <label className="space-y-1 text-sm sm:col-span-2">
                        <span className="font-medium">Categoria</span>
                        <Input
                          className={fieldClass}
                          value={form.category}
                          placeholder="Abertura, fechamento, higiene..."
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              category: event.target.value,
                            }))
                          }
                        />
                      </label>
                      {form.kind === "checklist" ? (
                        <>
                          <label className="space-y-1 text-sm">
                            <span className="font-medium">Frequência</span>
                            <Select
                              value={form.frequency}
                              onValueChange={(value) =>
                                setForm((current) => ({
                                  ...current,
                                  frequency: value as ChecklistProcedureFrequency,
                                }))
                              }
                              options={frequencyOptions.map((frequency) => ({
                                value: frequency,
                                label: frequencyLabel[frequency],
                              }))}
                            />
                          </label>
                          <label className="space-y-1 text-sm">
                            <span className="font-medium">Prazo</span>
                            <Input
                              className={fieldClass}
                              type="time"
                              value={form.due_time}
                              onChange={(event) =>
                                setForm((current) => ({
                                  ...current,
                                  due_time: event.target.value,
                                }))
                              }
                            />
                          </label>
                        </>
                      ) : null}
                      <label className="space-y-1 text-sm">
                        <span className="font-medium">Minutos</span>
                        <Input
                          className={fieldClass}
                          type="number"
                          min={1}
                          value={form.estimated_minutes}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              estimated_minutes: event.target.value,
                            }))
                          }
                        />
                      </label>
                    </div>

                    <div
                      className={cn(
                        "grid gap-3",
                        form.kind === "checklist" ? "sm:grid-cols-3" : "sm:grid-cols-2"
                      )}
                    >
                      <label className="space-y-1 text-sm">
                        <span className="font-medium">Responsável padrao</span>
                        <Input
                          className={fieldClass}
                          value={form.owner_role}
                          placeholder="Operador, supervisor..."
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              owner_role: event.target.value,
                            }))
                          }
                        />
                      </label>
                      {form.kind === "checklist" ? (
                        <>
                          <label className="space-y-1 text-sm">
                            <span className="font-medium">Aprovador</span>
                            <Input
                              className={fieldClass}
                              value={form.approval_role}
                              placeholder="Supervisor, gerente..."
                              disabled={!form.requires_approval}
                              onChange={(event) =>
                                setForm((current) => ({
                                  ...current,
                                  approval_role: event.target.value,
                                }))
                              }
                            />
                          </label>
                          <div className="grid gap-2 rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-soft)] px-3 py-2 text-sm">
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={form.evidence_required}
                                onChange={(event) =>
                                  setForm((current) => ({
                                    ...current,
                                    evidence_required: event.target.checked,
                                  }))
                                }
                              />
                              Exigir evidência
                            </label>
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={form.requires_approval}
                                onChange={(event) =>
                                  setForm((current) => ({
                                    ...current,
                                    requires_approval: event.target.checked,
                                  }))
                                }
                              />
                              Exigir aprovação
                            </label>
                          </div>
                        </>
                      ) : null}
                    </div>

                    {form.kind === "procedure" ? (
                      <label className="space-y-1 text-sm">
                        <span className="font-medium">Passo a passo detalhado</span>
                        <textarea
                          required
                          className={cn(textareaClass, "min-h-44")}
                          placeholder="Descreva cada etapa em uma nova linha."
                          value={form.instructions}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              instructions: event.target.value,
                            }))
                          }
                        />
                      </label>
                    ) : (
                      <label className="space-y-1 text-sm">
                        <span className="font-medium">Itens a verificar</span>
                        <textarea
                          required
                          className={cn(textareaClass, "min-h-36")}
                          placeholder="Digite um item por linha."
                          value={form.checklist_items}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              checklist_items: event.target.value,
                            }))
                          }
                        />
                      </label>
                    )}

                  {createProcedure.error || updateProcedure.error ? (
                    <div className="rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                      {(createProcedure.error ?? updateProcedure.error)?.message}
                    </div>
                  ) : null}

                  <DialogFooter>
                    <Button type="submit" disabled={isSaving}>
                      {isSaving
                        ? editingProcedure
                          ? "Salvando..."
                          : "Criando..."
                        : editingProcedure
                          ? "Salvar alterações"
                          : form.kind === "checklist"
                            ? "Criar checklist"
                            : "Criar procedimento"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
              </Dialog>
            </div>
          ) : null
        }
      />

      <div className="space-y-5 p-6">
        {procedures.isLoading || runsToday.isLoading ? (
          <StateBlock type="loading" title="Carregando checklists" />
        ) : procedures.isError ? (
          <StateBlock
            type="error"
            title="Erro ao carregar checklists e procedimentos"
            description={procedures.error.message}
          />
        ) : runsToday.isError ? (
          <StateBlock
            type="error"
            title="Erro ao carregar execuções"
            description={runsToday.error.message}
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <CompactMetric
                title="Concluídos hoje"
                value={stats.completedToday}
                detail="Execuções registradas"
                icon={<CheckCircle2 />}
                tone={stats.completedToday > 0 ? "emerald" : "slate"}
                active={view === "history" && !metricFilter}
                onClick={() => selectView("history")}
              />
              <CompactMetric
                title="Pendentes"
                value={stats.dailyPending}
                detail="Rotinas diárias"
                icon={<Clock3 />}
                tone={stats.dailyPending > 0 ? "amber" : "slate"}
                active={view === "pending" && !metricFilter}
                onClick={() => selectView("pending")}
              />
              <CompactMetric
                title="Atrasados"
                value={stats.overdue}
                detail="Passaram do prazo"
                icon={<AlertTriangle />}
                tone={stats.overdue > 0 ? "red" : "slate"}
                active={metricFilter === "overdue"}
                onClick={() => selectView("pending", "overdue")}
              />
              <CompactMetric
                title="Aprovação"
                value={stats.approvalPending}
                detail="Aguardando liderança"
                icon={<ShieldCheck />}
                tone={stats.approvalPending > 0 ? "amber" : "slate"}
                active={metricFilter === "approval"}
                onClick={() => selectView("history", "approval")}
              />
            </div>

            {stats.dailyTotal > 0 ? (
              <div className="flex items-center gap-3 rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] px-3 py-2">
                <p className="shrink-0 text-xs text-[color:var(--text-secondary)]">
                  Rotinas de hoje:{" "}
                  <span className="font-semibold text-[color:var(--text-primary)]">
                    {stats.dailyTotal - stats.dailyPending} de {stats.dailyTotal}
                  </span>{" "}
                  concluídas
                </p>
                <div
                  className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={stats.dailyTotal}
                  aria-valuenow={stats.dailyTotal - stats.dailyPending}
                  aria-label="Rotinas diárias concluídas hoje"
                >
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{
                      width: `${Math.round(((stats.dailyTotal - stats.dailyPending) / stats.dailyTotal) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] px-3 py-2 shadow-sm">
              {checklistViews.map(([key, label]) => (
                <Button
                  key={key}
                  type="button"
                  size="sm"
                  variant={view === key ? "default" : "outline"}
                  className="h-8 rounded-full px-3 text-xs"
                  onClick={() => selectView(key)}
                >
                  {label}
                  <span className="ml-1 rounded-full bg-white/20 px-1.5 text-[10px]">
                    {viewCounts[key]}
                  </span>
                </Button>
              ))}
            </div>

            {metricFilter ? (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-[color:var(--text-secondary)]">
                <span>
                  Mostrando só{" "}
                  <strong className="text-[color:var(--text-primary)]">
                    {metricFilter === "overdue" ? "checklists atrasados" : "execuções aguardando aprovação"}
                  </strong>
                </span>
                <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setMetricFilter(null)}>
                  Limpar filtro
                </Button>
              </div>
            ) : null}

            {view === "history" ? (
              <Card className="border border-[color:var(--border-soft)] bg-white dark:bg-[color:var(--bg-surface)] shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <History className="size-4" />
                    Histórico de execuções
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <HistoryList
                    canApprove={canCreate}
                    isApproving={approveRun.isPending}
                    runs={
                      metricFilter === "approval"
                        ? checklistHistory.filter((run) => run.approval_status === "pending")
                        : checklistHistory
                    }
                    onApprove={(run) =>
                      void approveRun.mutateAsync({
                        run_id: run.id,
                        approval_status: "approved",
                      })
                    }
                    onReject={(run) =>
                      void approveRun.mutateAsync({
                        run_id: run.id,
                        approval_status: "rejected",
                      })
                    }
                  />
                </CardContent>
              </Card>
            ) : (
              <div
                className={cn(
                  "grid gap-4",
                  view === "checklists" && checklistHistory.length > 0
                    ? "xl:grid-cols-[1fr_22rem]"
                    : ""
                )}
              >
                <div>
                  {view === "procedures" ? (
                    displayedProcedureDocuments.length === 0 ? (
                      renderEmptyState("procedure")
                    ) : (
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {displayedProcedureDocuments.map((procedure) => (
                          <ProcedureDocumentCard
                            key={procedure.id}
                            procedure={procedure}
                            canManage={canCreate}
                            onEdit={() => openEdit(procedure)}
                            onDelete={() => setDeleteTarget(procedure)}
                          />
                        ))}
                      </div>
                    )
                  ) : stats.activeChecklists === 0 ? (
                    renderEmptyState("checklist")
                  ) : displayedChecklists.length === 0 ? (
                    <StateBlock
                      title="Nenhum checklist pendente"
                      description="As rotinas diárias do recorte atual já foram concluídas."
                    />
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                      {displayedChecklists.map((procedure) => (
                        <ChecklistCard
                          key={procedure.id}
                          procedure={procedure}
                          canManage={canCreate}
                          onEdit={() => openEdit(procedure)}
                          onDelete={() => setDeleteTarget(procedure)}
                          checkedItems={checkedByProcedure[procedure.id] ?? []}
                          notes={notesByProcedure[procedure.id] ?? ""}
                          evidenceNotes={evidenceByProcedure[procedure.id] ?? ""}
                          itemEvidence={itemEvidenceByProcedure[procedure.id] ?? {}}
                          itemOccurrence={itemOccurrenceByProcedure[procedure.id] ?? {}}
                          isCompletedToday={completedTodayIds.has(procedure.id)}
                          isPending={completeRun.isPending}
                          onToggleItem={(item) => toggleItem(procedure.id, item)}
                          onToggleAll={() => toggleAll(procedure)}
                          onReset={() => resetProcedure(procedure.id)}
                          onNotesChange={(value) =>
                            setNotesByProcedure((current) => ({
                              ...current,
                              [procedure.id]: value,
                            }))
                          }
                          onEvidenceChange={(value) =>
                            setEvidenceByProcedure((current) => ({
                              ...current,
                              [procedure.id]: value,
                            }))
                          }
                          onItemEvidenceChange={(item, value) =>
                            setItemText(setItemEvidenceByProcedure, procedure.id, item, value)
                          }
                          onItemOccurrenceChange={(item, value) =>
                            setItemText(setItemOccurrenceByProcedure, procedure.id, item, value)
                          }
                          onComplete={() => void completeProcedure(procedure)}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {view === "checklists" && checklistHistory.length > 0 ? (
                  <Card className="border border-[color:var(--border-soft)] bg-white dark:bg-[color:var(--bg-surface)] shadow-sm">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <History className="size-4" />
                        Histórico recente
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <HistoryList
                        canApprove={canCreate}
                        isApproving={approveRun.isPending}
                        runs={checklistHistory.slice(0, 6)}
                        onApprove={(run) =>
                          void approveRun.mutateAsync({
                            run_id: run.id,
                            approval_status: "approved",
                          })
                        }
                        onReject={(run) =>
                          void approveRun.mutateAsync({
                            run_id: run.id,
                            approval_status: "rejected",
                          })
                        }
                      />
                    </CardContent>
                  </Card>
                ) : null}
              </div>
            )}

            {completeRun.error ? (
              <div className="rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                {completeRun.error.message}
              </div>
            ) : null}

            {!canCreate ? (
              <div className="flex items-center gap-2 rounded-lg border bg-slate-50 dark:bg-slate-800/60 px-3 py-2 text-sm text-muted-foreground">
                <Timer className="size-4" />
                A execução esta liberada para o time. O cadastro e a aprovação ficam com liderança e administradores.
              </div>
            ) : null}

            <ChecklistDeleteDialog
              open={Boolean(deleteTarget)}
              procedure={deleteTarget}
              isDeleting={deleteProcedure.isPending}
              onOpenChange={(nextOpen) => {
                if (!nextOpen) setDeleteTarget(null)
              }}
              onConfirm={() => void handleDelete()}
            />
          </>
        )}
      </div>
    </>
  )
}
