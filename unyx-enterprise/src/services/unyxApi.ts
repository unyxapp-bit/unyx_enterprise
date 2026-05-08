import { supabase } from "@/lib/supabase"
import { getActionMeta } from "@/lib/status"
import { planConfig } from "@/lib/plans"
import type {
  AttendanceEvent,
  AttendanceEventType,
  AuditLog,
  Branch,
  BusinessSegment,
  CashMovement,
  CashMovementType,
  CashSession,
  CashSessionStatus,
  ChecklistProcedure,
  ChecklistProcedureFrequency,
  ChecklistRun,
  CommsPost,
  CommsPostComment,
  DashboardRow,
  DeliveryItem,
  DeliveryOrder,
  DeliveryPaymentStatus,
  DeliveryPriority,
  DeliverySource,
  DeliveryStatus,
  Employee,
  EmployeeWithRelations,
  Invitation,
  Module,
  OrganizationModule,
  OperationalPost,
  OperationalPostType,
  OperationalSettings,
  OperationalStatusRecord,
  Organization,
  PaymentMethod,
  PosCashMovement,
  PosCashMovementType,
  PostAllocation,
  Product,
  ProductCategory,
  ProductCategorySegment,
  ProductKind,
  ProductVariant,
  Sale,
  SaleItem,
  SalePayment,
  Schedule,
  ScheduleStatus,
  ScheduleWithRelations,
  Sector,
  Subscription,
  SubscriptionPlan,
  TrainingItem,
  TrainingProgress,
  TrainingType,
  UserProfile,
} from "@/types/domain"

export interface BulkImportResult {
  created: number
  skipped: number
  errors: string[]
}

export interface EmployeeImportInput {
  branch_id: string
  sector_id: string | null
  name: string
  role: string | null
  phone: string | null
  document: string | null
  notes: string | null
}

export interface ScheduleImportInput {
  branch_id: string
  employee_id: string
  work_date: string
  start_time: string | null
  break_start: string | null
  break_end: string | null
  end_time: string | null
  status: ScheduleStatus
  notes: string | null
}

export interface OperationalPostInput {
  branch_id: string
  sector_id: string | null
  name: string
  type: OperationalPostType
  active?: boolean
}

function raise(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

function isMissingOperationalSettings(error: { code?: string; message: string } | null) {
  if (!error) return false
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.message.includes("operational_settings")
  )
}

function isMissingAllocationFeature(error: { code?: string; message: string } | null) {
  if (!error) return false
  const message = error.message.toLowerCase()
  const mentionsAllocationObject =
    message.includes("operational_posts") ||
    message.includes("post_allocations") ||
    message.includes("cash_movements") ||
    message.includes("allocate_post") ||
    message.includes("transfer_post_allocation") ||
    message.includes("finalize_post_allocation") ||
    message.includes("confirm_cash_movement") ||
    message.includes("create_operational_post") ||
    message.includes("update_operational_post_record") ||
    message.includes("setup_segment_defaults")

  return (
    mentionsAllocationObject &&
    (
      error.code === "42P01" ||
      error.code === "PGRST202" ||
      error.code === "PGRST204" ||
      error.code === "PGRST205" ||
      message.includes("schema cache") ||
      message.includes("does not exist") ||
      message.includes("could not find")
    )
  )
}

function allocationFeatureMessage() {
  return "Os recursos de postos operacionais ainda nao apareceram na API do Supabase. Rode o supabase/onboarding_first_access.sql atualizado no SQL Editor, aguarde alguns segundos e recarregue o app."
}

function isMissingChecklistFeature(error: { code?: string; message: string } | null) {
  if (!error) return false
  const message = error.message.toLowerCase()
  const mentionsChecklist =
    message.includes("checklist_procedures") ||
    message.includes("checklist_runs")

  return (
    mentionsChecklist &&
    (
      error.code === "42P01" ||
      error.code === "PGRST204" ||
      error.code === "PGRST205" ||
      message.includes("schema cache") ||
      message.includes("does not exist") ||
      message.includes("could not find")
    )
  )
}

function checklistFeatureMessage() {
  return "Modulo de checklists e procedimentos ainda nao instalado. Rode supabase/checklists_procedures.sql no SQL Editor do Supabase e recarregue o app."
}

function isMissingProfileRpc(error: { code?: string; message: string } | null) {
  if (!error) return false
  return (
    error.code === "PGRST202" ||
    error.message.includes("update_current_user_profile")
  )
}

function isMissingPlanRpc(error: { code?: string; message: string } | null) {
  if (!error) return false
  return (
    error.code === "PGRST202" ||
    error.message.includes("update_organization_plan")
  )
}

function isMissingOperationalActionRpc(
  error: { code?: string; message: string } | null
) {
  if (!error) return false
  return (
    error.code === "PGRST202" ||
    error.message.includes("record_operational_action")
  )
}

function isUnsupportedFinalizedStatus(
  error: { code?: string; message: string } | null
) {
  if (!error) return false
  return (
    error.message.includes("finalizado") &&
    error.message.includes("operational_status_type")
  )
}

function scheduleStatusForEvent(
  eventType: AttendanceEventType
): ScheduleStatus | null {
  const map: Partial<Record<AttendanceEventType, ScheduleStatus>> = {
    entrada_confirmada: "working",
    falta_detectada: "absent",
    intervalo_iniciado: "on_break",
    retorno_confirmado: "returned",
    saida_confirmada: "finished",
  }

  return map[eventType] ?? null
}

async function createAuditLog(
  profile: UserProfile,
  input: {
    branch_id?: string | null
    action: string
    entity_type: string
    entity_id?: string | null
    old_value?: unknown
    new_value?: unknown
  }
) {
  const { error } = await supabase.from("audit_logs").insert({
    organization_id: profile.organization_id,
    branch_id: input.branch_id ?? null,
    user_id: profile.id,
    action: input.action,
    entity_type: input.entity_type,
    entity_id: input.entity_id ?? null,
    old_value: input.old_value ?? null,
    new_value: input.new_value ?? null,
  })

  raise(error)
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

function cleanDocument(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "")
}

function normalizeChecklistItems(items: string[]) {
  return Array.from(
    new Set(
      items
        .map((item) => item.trim())
        .filter(Boolean)
    )
  )
}

function timeToMinutes(value: string | null | undefined) {
  if (!value) return null
  const [hours, minutes] = value.slice(0, 5).split(":").map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  return hours * 60 + minutes
}

function friendlyDatabaseError(error: { code?: string; message: string } | null) {
  if (!error) return null
  if (error.code === "23505" && error.message.includes("schedules")) {
    return "Este colaborador ja possui escala nesta data."
  }
  return error.message
}

async function validateBranchAndSector(
  profile: UserProfile,
  branchId: string,
  sectorId?: string | null
) {
  const { data: branch, error: branchError } = await supabase
    .from("branches")
    .select("id, organization_id, active")
    .eq("id", branchId)
    .maybeSingle()

  raise(branchError)

  if (!branch || branch.organization_id !== profile.organization_id) {
    throw new Error("Filial invalida para esta organizacao.")
  }

  if (!branch.active) {
    throw new Error("Nao e possivel usar uma filial inativa.")
  }

  if (!sectorId) return

  const { data: sector, error: sectorError } = await supabase
    .from("sectors")
    .select("id, organization_id, branch_id, active")
    .eq("id", sectorId)
    .maybeSingle()

  raise(sectorError)

  if (
    !sector ||
    sector.organization_id !== profile.organization_id ||
    sector.branch_id !== branchId
  ) {
    throw new Error("O setor selecionado nao pertence a filial informada.")
  }

  if (!sector.active) {
    throw new Error("Nao e possivel usar um setor inativo.")
  }
}

async function ensureEmployeeLimit(profile: UserProfile, extraActiveEmployees = 1) {
  const organization = await getOrganization(profile.organization_id)
  const subscription = await getSubscription(profile.organization_id)
  const effectivePlan = organization?.plan ?? subscription?.plan ?? "starter"
  const configuredLimit = planConfig[effectivePlan].maxEmployees
  const maxEmployees =
    configuredLimit === null
      ? 0
      : subscription?.plan === effectivePlan
        ? subscription.max_employees
        : configuredLimit

  if (!maxEmployees) return

  const { count, error } = await supabase
    .from("employees")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", profile.organization_id)
    .eq("active", true)

  raise(error)

  if ((count ?? 0) + extraActiveEmployees > maxEmployees) {
    throw new Error(
      `Limite do plano atingido: ${maxEmployees} colaboradores ativos.`
    )
  }
}

async function ensureBranchLimit(profile: UserProfile, extraActiveBranches = 1) {
  const organization = await getOrganization(profile.organization_id)
  const subscription = await getSubscription(profile.organization_id)
  const effectivePlan = organization?.plan ?? subscription?.plan ?? "starter"
  const configuredLimit = planConfig[effectivePlan].maxBranches
  const maxBranches =
    configuredLimit === null
      ? 0
      : subscription?.plan === effectivePlan
        ? subscription.max_branches
        : configuredLimit

  if (!maxBranches) return

  const { count, error } = await supabase
    .from("branches")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", profile.organization_id)
    .eq("active", true)

  raise(error)

  if ((count ?? 0) + extraActiveBranches > maxBranches) {
    throw new Error(`Limite do plano atingido: ${maxBranches} filiais ativas.`)
  }
}

async function ensureEmployeeDocumentIsUnique(
  profile: UserProfile,
  document: string | null | undefined,
  ignoreEmployeeId?: string
) {
  const cleaned = cleanDocument(document)
  if (!cleaned) return

  let query = supabase
    .from("employees")
    .select("id, document")
    .eq("organization_id", profile.organization_id)

  if (ignoreEmployeeId) query = query.neq("id", ignoreEmployeeId)

  const { data, error } = await query

  raise(error)

  if ((data ?? []).some((employee) => cleanDocument(employee.document) === cleaned)) {
    throw new Error("Ja existe um colaborador com este documento.")
  }
}

async function validateScheduleEmployee(
  profile: UserProfile,
  branchId: string,
  employeeId: string
) {
  await validateBranchAndSector(profile, branchId)

  const { data: employee, error } = await supabase
    .from("employees")
    .select("id, organization_id, branch_id, active")
    .eq("id", employeeId)
    .maybeSingle()

  raise(error)

  if (!employee || employee.organization_id !== profile.organization_id) {
    throw new Error("Colaborador invalido para esta organizacao.")
  }

  if (employee.branch_id !== branchId) {
    throw new Error("O colaborador selecionado nao pertence a filial da escala.")
  }

  if (!employee.active) {
    throw new Error("Nao e possivel escalar um colaborador inativo.")
  }
}

function normalizeScheduleInput<T extends Partial<ScheduleImportInput>>(input: T) {
  const normalized = { ...input }

  if (normalized.status === "day_off") {
    normalized.start_time = null
    normalized.break_start = null
    normalized.break_end = null
    normalized.end_time = null
    return normalized
  }

  const orderedTimes = [
    ["entrada", normalized.start_time],
    ["saida para intervalo", normalized.break_start],
    ["retorno", normalized.break_end],
    ["saida final", normalized.end_time],
  ] as const

  let previous: number | null = null
  let previousLabel = ""

  for (const [label, value] of orderedTimes) {
    const minutes = timeToMinutes(value)
    if (minutes === null) continue

    if (previous !== null && minutes <= previous) {
      throw new Error(
        `Horario invalido: ${label} deve ser depois de ${previousLabel}.`
      )
    }

    previous = minutes
    previousLabel = label
  }

  return normalized
}

export async function getCurrentProfile() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  raise(userError)
  if (!user) return null

  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle()

  raise(error)
  return data as UserProfile | null
}

export interface OnboardingProfileInput {
  profileName: string
  organizationName: string
  tradeName: string | null
  document: string | null
  segment: BusinessSegment
  branchName: string
  city: string | null
  state: string | null
  address: string | null
}

export async function completeCurrentUserOnboarding(input: OnboardingProfileInput) {
  const { data, error } = await supabase.rpc("complete_current_user_onboarding", {
    p_profile_name: input.profileName,
    p_organization_name: input.organizationName,
    p_trade_name: input.tradeName,
    p_document: input.document,
    p_segment: input.segment,
    p_branch_name: input.branchName,
    p_city: input.city,
    p_state: input.state,
    p_address: input.address,
  })

  if (error) {
    const missingFunction =
      error.code === "PGRST202" ||
      error.message.includes("complete_current_user_onboarding")

    if (missingFunction) {
      throw new Error(
        "Onboarding ainda nao instalado no Supabase. Rode supabase/onboarding_first_access.sql no SQL Editor e tente novamente."
      )
    }

    throw new Error(error.message)
  }

  return data as string
}

export async function getOrganization(organizationId: string) {
  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", organizationId)
    .maybeSingle()

  raise(error)
  return data as Organization | null
}

export async function updateOrganization(
  profile: UserProfile,
  input: {
    name: string
    trade_name: string | null
    document: string | null
    segment: BusinessSegment
  }
) {
  const { data: previous, error: previousError } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", profile.organization_id)
    .maybeSingle()

  raise(previousError)

  const { data, error } = await supabase
    .from("organizations")
    .update(input)
    .eq("id", profile.organization_id)
    .select("*")
    .single()

  raise(error)

  await createAuditLog(profile, {
    action: "organization_updated",
    entity_type: "organizations",
    entity_id: data.id,
    old_value: previous,
    new_value: data,
  })

  return data as Organization
}

export async function updateOrganizationPlan(plan: SubscriptionPlan) {
  const { data, error } = await supabase
    .rpc("update_organization_plan", { p_plan: plan })

  if (isMissingPlanRpc(error)) {
    throw new Error(
      "Sistema de planos ainda nao instalado no Supabase. Rode supabase/onboarding_first_access.sql no SQL Editor e tente novamente."
    )
  }
  raise(error)

  return data as Organization
}

export async function updateCurrentUserProfile(
  profile: UserProfile,
  input: {
    name: string
    email: string
    branch_id: string | null
  }
) {
  const nextEmail = input.email.trim().toLowerCase()

  if (nextEmail !== profile.email.toLowerCase()) {
    const { error: authError } = await supabase.auth.updateUser({
      email: nextEmail,
    })

    raise(authError)
  }

  const { data, error } = await supabase.rpc("update_current_user_profile", {
    p_name: input.name.trim(),
    p_email: nextEmail,
    p_branch_id: input.branch_id,
  })

  if (isMissingProfileRpc(error)) {
    throw new Error(
      "Edicao de perfil ainda nao instalada no Supabase. Rode supabase/onboarding_first_access.sql no SQL Editor e tente novamente."
    )
  }

  raise(error)
  return data as UserProfile
}

export async function updateCurrentUserPassword(
  profile: UserProfile,
  password: string
) {
  const { error } = await supabase.auth.updateUser({ password })

  raise(error)

  await createAuditLog(profile, {
    action: "password_updated",
    entity_type: "user_profiles",
    entity_id: profile.id,
    old_value: null,
    new_value: { updated: true },
  })
}

export interface OperationalSettingsInput {
  branch_id: string | null
  mode: BusinessSegment
  late_tolerance_minutes: number
  break_tolerance_minutes: number
  require_cashier_cash_count: boolean
  require_coverage_before_break: boolean
  block_break_on_peak_hours: boolean
  require_responsible_presence: boolean
  coffee_break_enabled: boolean
  coffee_break_duration_minutes: number
  coffee_window_start: string | null
  coffee_window_end: string | null
  coffee_order: "inverse" | "same" | "none"
}

export async function getOperationalSettings(
  profile: UserProfile,
  branchId?: string | null
) {
  let query = supabase
    .from("operational_settings")
    .select("*")
    .eq("organization_id", profile.organization_id)

  if (branchId) {
    query = query.or(`branch_id.is.null,branch_id.eq.${branchId}`)
  } else {
    query = query.is("branch_id", null)
  }

  const { data, error } = await query

  if (isMissingOperationalSettings(error)) return null
  raise(error)

  const settings = (data ?? []) as OperationalSettings[]
  return (
    settings.find((item) => item.branch_id === branchId) ??
    settings.find((item) => item.branch_id === null) ??
    null
  )
}

export async function saveOperationalSettings(
  profile: UserProfile,
  input: OperationalSettingsInput
) {
  const branchId = input.branch_id ?? null
  let existingQuery = supabase
    .from("operational_settings")
    .select("*")
    .eq("organization_id", profile.organization_id)
    .limit(1)

  if (branchId) {
    existingQuery = existingQuery.eq("branch_id", branchId)
  } else {
    existingQuery = existingQuery.is("branch_id", null)
  }

  const { data: existing, error: existingError } = await existingQuery.maybeSingle()

  if (isMissingOperationalSettings(existingError)) {
    throw new Error(
      "Modos operacionais ainda nao instalados no Supabase. Rode supabase/onboarding_first_access.sql no SQL Editor e tente novamente."
    )
  }

  raise(existingError)

  const payload = {
    ...input,
    branch_id: branchId,
    organization_id: profile.organization_id,
  }

  const request = existing?.id
    ? supabase
        .from("operational_settings")
        .update(payload)
        .eq("id", existing.id)
        .select("*")
        .single()
    : supabase
        .from("operational_settings")
        .insert(payload)
        .select("*")
        .single()

  const { data, error } = await request

  if (isMissingOperationalSettings(error)) {
    throw new Error(
      "Modos operacionais ainda nao instalados no Supabase. Rode supabase/onboarding_first_access.sql no SQL Editor e tente novamente."
    )
  }

  raise(error)

  await createAuditLog(profile, {
    branch_id: branchId,
    action: existing?.id
      ? "operational_settings_updated"
      : "operational_settings_created",
    entity_type: "operational_settings",
    entity_id: data.id,
    old_value: existing ?? null,
    new_value: data,
  })

  return data as OperationalSettings
}

export async function listBranches() {
  const { data, error } = await supabase
    .from("branches")
    .select("*")
    .order("name")

  raise(error)
  return (data ?? []) as Branch[]
}

export async function createBranch(
  profile: UserProfile,
  input: Pick<Branch, "name" | "city" | "state" | "address">
) {
  await ensureBranchLimit(profile)

  const { data, error } = await supabase
    .from("branches")
    .insert({
      ...input,
      organization_id: profile.organization_id,
    })
    .select("*")
    .single()

  raise(error)
  return data as Branch
}

export async function listSectors(branchId?: string | null) {
  let query = supabase
    .from("sectors")
    .select("*, branches(name)")
    .order("name")

  if (branchId) query = query.eq("branch_id", branchId)

  const { data, error } = await query
  raise(error)
  return (data ?? []) as Sector[]
}

export async function createSector(
  profile: UserProfile,
  input: {
    branch_id: string
    name: string
    description: string | null
  }
) {
  const { data, error } = await supabase
    .from("sectors")
    .insert({
      ...input,
      organization_id: profile.organization_id,
    })
    .select("*, branches(name)")
    .single()

  raise(error)
  return data as Sector
}

export async function listEmployees(branchId?: string | null) {
  let query = supabase
    .from("employees")
    .select("*, branches(name), sectors(name)")
    .order("active", { ascending: false })
    .order("name")

  if (branchId) query = query.eq("branch_id", branchId)

  const { data, error } = await query
  raise(error)
  return (data ?? []) as EmployeeWithRelations[]
}

export async function createEmployee(
  profile: UserProfile,
  input: EmployeeImportInput
) {
  const payload = {
    ...input,
    name: input.name.trim(),
    role: input.role?.trim() || null,
    phone: input.phone?.trim() || null,
    document: cleanDocument(input.document) || null,
    notes: input.notes?.trim() || null,
  }

  if (!payload.name) throw new Error("Informe o nome do colaborador.")

  await validateBranchAndSector(profile, payload.branch_id, payload.sector_id)
  await ensureEmployeeLimit(profile)
  await ensureEmployeeDocumentIsUnique(profile, payload.document)

  const { data, error } = await supabase
    .from("employees")
    .insert({
      ...payload,
      organization_id: profile.organization_id,
    })
    .select("*, branches(name), sectors(name)")
    .single()

  raise(error)

  await createAuditLog(profile, {
    branch_id: data.branch_id,
    action: "employee_created",
    entity_type: "employees",
    entity_id: data.id,
    old_value: null,
    new_value: data,
  })

  return data as EmployeeWithRelations
}

export async function updateEmployee(
  profile: UserProfile,
  employeeId: string,
  input: Partial<
    Pick<
      Employee,
      "active" | "branch_id" | "sector_id" | "name" | "role" | "phone" | "document" | "notes"
    >
  >
) {
  const { data: previous, error: previousError } = await supabase
    .from("employees")
    .select("*")
    .eq("id", employeeId)
    .maybeSingle()

  raise(previousError)

  if (!previous || previous.organization_id !== profile.organization_id) {
    throw new Error("Colaborador nao encontrado.")
  }

  const payload = { ...input }

  if (typeof payload.name === "string") {
    payload.name = payload.name.trim()
    if (!payload.name) throw new Error("Informe o nome do colaborador.")
  }

  if (typeof payload.role === "string") payload.role = payload.role.trim() || null
  if (typeof payload.phone === "string") payload.phone = payload.phone.trim() || null
  if (typeof payload.notes === "string") payload.notes = payload.notes.trim() || null
  if (typeof payload.document === "string") {
    payload.document = cleanDocument(payload.document) || null
  }

  const nextBranchId = payload.branch_id ?? previous.branch_id
  const nextSectorId =
    payload.sector_id === undefined ? previous.sector_id : payload.sector_id

  await validateBranchAndSector(profile, nextBranchId, nextSectorId)
  await ensureEmployeeDocumentIsUnique(profile, payload.document, employeeId)

  if (previous.active === false && payload.active === true) {
    await ensureEmployeeLimit(profile)
  }

  const { data, error } = await supabase
    .from("employees")
    .update(payload)
    .eq("id", employeeId)
    .select("*, branches(name), sectors(name)")
    .single()

  raise(error)

  await createAuditLog(profile, {
    branch_id: data.branch_id,
    action:
      payload.active === false
        ? "employee_deactivated"
        : payload.active === true
          ? "employee_activated"
          : "employee_updated",
    entity_type: "employees",
    entity_id: data.id,
    old_value: previous,
    new_value: data,
  })

  return data as EmployeeWithRelations
}

export async function deleteEmployees(
  profile: UserProfile,
  employeeIds: string[]
) {
  const ids = Array.from(new Set(employeeIds.filter(Boolean)))
  if (ids.length === 0) throw new Error("Selecione ao menos um colaborador.")

  const { error } = await supabase
    .from("employees")
    .delete()
    .eq("organization_id", profile.organization_id)
    .in("id", ids)

  raise(error)
}

export async function deactivateEmployees(
  profile: UserProfile,
  employeeIds: string[]
) {
  const ids = Array.from(new Set(employeeIds.filter(Boolean)))
  if (ids.length === 0) throw new Error("Selecione ao menos um colaborador.")

  const { data: previousRows, error: previousError } = await supabase
    .from("employees")
    .select("*")
    .in("id", ids)

  raise(previousError)

  const previousEmployees = (previousRows ?? []) as Employee[]
  const previousById = new Map(previousEmployees.map((employee) => [employee.id, employee]))
  const hasInvalidEmployee =
    previousEmployees.length !== ids.length ||
    previousEmployees.some(
      (employee) => employee.organization_id !== profile.organization_id
    )

  if (hasInvalidEmployee) {
    throw new Error("Um ou mais colaboradores nao foram encontrados.")
  }

  const activeIds = previousEmployees
    .filter((employee) => employee.active)
    .map((employee) => employee.id)

  if (activeIds.length === 0) return [] as EmployeeWithRelations[]

  const { data, error } = await supabase
    .from("employees")
    .update({ active: false })
    .eq("organization_id", profile.organization_id)
    .in("id", activeIds)
    .select("*, branches(name), sectors(name)")

  raise(error)

  for (const employee of data ?? []) {
    await createAuditLog(profile, {
      branch_id: employee.branch_id,
      action: "employee_deactivated",
      entity_type: "employees",
      entity_id: employee.id,
      old_value: previousById.get(employee.id),
      new_value: employee,
    })
  }

  return (data ?? []) as EmployeeWithRelations[]
}

export async function importEmployees(
  profile: UserProfile,
  rows: EmployeeImportInput[]
): Promise<BulkImportResult> {
  const errors: string[] = []

  const normalizedRows = rows
    .map((row, index) => ({
      index,
      value: {
        ...row,
        name: row.name.trim(),
        role: row.role?.trim() || null,
        phone: row.phone?.trim() || null,
        document: cleanDocument(row.document) || null,
        notes: row.notes?.trim() || null,
      },
    }))
    .filter((row) => {
      if (!row.value.name) {
        errors.push(`Linha ${row.index + 2}: nome obrigatorio.`)
        return false
      }
      return true
    })

  if (normalizedRows.length === 0) {
    return { created: 0, skipped: rows.length, errors }
  }

  const { data: existing, error: existingError } = await supabase
    .from("employees")
    .select("id, branch_id, name, document")
    .eq("organization_id", profile.organization_id)

  raise(existingError)

  const existingDocuments = new Set(
    (existing ?? [])
      .map((employee) => cleanDocument(employee.document))
      .filter(Boolean)
  )
  const existingNameBranch = new Set(
    (existing ?? []).map(
      (employee) => `${employee.branch_id}:${normalizeText(employee.name)}`
    )
  )
  const seenDocuments = new Set<string>()
  const seenNameBranch = new Set<string>()
  const payload: Array<EmployeeImportInput & { organization_id: string }> = []

  for (const row of normalizedRows) {
    try {
      await validateBranchAndSector(
        profile,
        row.value.branch_id,
        row.value.sector_id
      )

      const document = cleanDocument(row.value.document)
      const nameBranchKey = `${row.value.branch_id}:${normalizeText(row.value.name)}`

      if (document && (existingDocuments.has(document) || seenDocuments.has(document))) {
        errors.push(`Linha ${row.index + 2}: documento ja cadastrado.`)
        continue
      }

      if (existingNameBranch.has(nameBranchKey) || seenNameBranch.has(nameBranchKey)) {
        errors.push(`Linha ${row.index + 2}: colaborador ja existe nesta filial.`)
        continue
      }

      if (document) seenDocuments.add(document)
      seenNameBranch.add(nameBranchKey)
      payload.push({
        ...row.value,
        document: document || null,
        organization_id: profile.organization_id,
      })
    } catch (error) {
      errors.push(
        `Linha ${row.index + 2}: ${
          error instanceof Error ? error.message : "registro invalido"
        }`
      )
    }
  }

  if (payload.length === 0) {
    return { created: 0, skipped: rows.length, errors }
  }

  await ensureEmployeeLimit(profile, payload.length)

  const { data, error } = await supabase
    .from("employees")
    .insert(payload)
    .select("*, branches(name), sectors(name)")

  raise(error)

  await createAuditLog(profile, {
    action: "employees_imported",
    entity_type: "employees",
    old_value: null,
    new_value: { created: data?.length ?? 0, skipped: rows.length - payload.length },
  })

  return {
    created: data?.length ?? 0,
    skipped: rows.length - payload.length,
    errors,
  }
}

export async function listSchedules(workDate: string, branchId?: string | null) {
  let query = supabase
    .from("schedules")
    .select("*, branches(name), employees(*, sectors(name))")
    .eq("work_date", workDate)
    .order("start_time", { nullsFirst: false })

  if (branchId) query = query.eq("branch_id", branchId)

  const { data, error } = await query
  raise(error)
  return (data ?? []) as ScheduleWithRelations[]
}

export async function listSchedulesRange(
  dateFrom: string,
  dateTo: string,
  branchId?: string | null
) {
  let query = supabase
    .from("schedules")
    .select("*, branches(name), employees(*, sectors(name))")
    .gte("work_date", dateFrom)
    .lte("work_date", dateTo)
    .order("work_date", { ascending: true })
    .order("start_time", { nullsFirst: false })

  if (branchId) query = query.eq("branch_id", branchId)

  const { data, error } = await query
  raise(error)
  return (data ?? []) as ScheduleWithRelations[]
}

export async function createSchedule(
  profile: UserProfile,
  input: ScheduleImportInput
) {
  await validateScheduleEmployee(profile, input.branch_id, input.employee_id)
  const normalizedInput = normalizeScheduleInput({
    ...input,
    notes: input.notes?.trim() || null,
  }) as ScheduleImportInput

  const { data, error } = await supabase
    .from("schedules")
    .insert({
      ...normalizedInput,
      organization_id: profile.organization_id,
    })
    .select("*, branches(name), employees(*, sectors(name))")
    .single()

  if (error) {
    throw new Error(friendlyDatabaseError(error) ?? error.message)
  }

  await createAuditLog(profile, {
    branch_id: data.branch_id,
    action: "schedule_created",
    entity_type: "schedules",
    entity_id: data.id,
    old_value: null,
    new_value: data,
  })

  return data as ScheduleWithRelations
}

export async function updateSchedule(
  profile: UserProfile,
  scheduleId: string,
  input: Partial<
    Pick<
      Schedule,
      "start_time" | "break_start" | "break_end" | "end_time" | "status" | "notes"
    >
  >
) {
  const { data: previous, error: previousError } = await supabase
    .from("schedules")
    .select("*")
    .eq("id", scheduleId)
    .maybeSingle()

  raise(previousError)

  if (!previous || previous.organization_id !== profile.organization_id) {
    throw new Error("Escala nao encontrada.")
  }

  const normalizedInput = normalizeScheduleInput({
    ...previous,
    ...input,
    notes: input.notes === undefined ? previous.notes : input.notes?.trim() || null,
  })

  const { data, error } = await supabase
    .from("schedules")
    .update({
      start_time: normalizedInput.start_time,
      break_start: normalizedInput.break_start,
      break_end: normalizedInput.break_end,
      end_time: normalizedInput.end_time,
      status: normalizedInput.status,
      notes: normalizedInput.notes,
    })
    .eq("id", scheduleId)
    .select("*, branches(name), employees(*, sectors(name))")
    .single()

  raise(error)

  await createAuditLog(profile, {
    branch_id: data.branch_id,
    action: "schedule_updated",
    entity_type: "schedules",
    entity_id: data.id,
    old_value: previous,
    new_value: data,
  })

  return data as ScheduleWithRelations
}

export async function deleteSchedule(profile: UserProfile, scheduleId: string) {
  const { data: previous, error: previousError } = await supabase
    .from("schedules")
    .select("*")
    .eq("id", scheduleId)
    .maybeSingle()

  raise(previousError)

  if (!previous || previous.organization_id !== profile.organization_id) {
    throw new Error("Escala nao encontrada.")
  }

  const { error } = await supabase
    .from("schedules")
    .delete()
    .eq("id", scheduleId)

  raise(error)

  await createAuditLog(profile, {
    branch_id: previous.branch_id,
    action: "schedule_deleted",
    entity_type: "schedules",
    entity_id: previous.id,
    old_value: previous,
    new_value: null,
  })
}

export async function deleteSchedulesBulk(
  profile: UserProfile,
  scheduleIds: string[]
) {
  const ids = Array.from(new Set(scheduleIds.filter(Boolean)))
  if (ids.length === 0) return

  const { error } = await supabase
    .from("schedules")
    .delete()
    .eq("organization_id", profile.organization_id)
    .in("id", ids)

  raise(error)
}

export async function listDashboardRows(
  workDate: string,
  branchId?: string | null
) {
  let query = supabase
    .from("v_operational_dashboard")
    .select("*")
    .eq("work_date", workDate)
    .order("priority_level", { ascending: false })
    .order("delay_minutes", { ascending: false })

  if (branchId) query = query.eq("branch_id", branchId)

  const { data, error } = await query
  raise(error)
  return (data ?? []) as DashboardRow[]
}

export async function listOperationalStatuses(branchId?: string | null) {
  let query = supabase
    .from("operational_status")
    .select("*, branches(name), employees(*, sectors(name)), schedules(work_date, start_time, break_start, break_end, end_time)")
    .order("priority_level", { ascending: false })
    .order("updated_at", { ascending: false })

  if (branchId) query = query.eq("branch_id", branchId)

  const { data, error } = await query
  raise(error)
  return (data ?? []) as OperationalStatusRecord[]
}

export async function listAttendanceEvents(branchId?: string | null) {
  let query = supabase
    .from("attendance_events")
    .select("*, employees(name), branches(name)")
    .order("event_time", { ascending: false })
    .limit(60)

  if (branchId) query = query.eq("branch_id", branchId)

  const { data, error } = await query
  raise(error)
  return (data ?? []) as AttendanceEvent[]
}

export async function listOperationalPosts(branchId?: string | null) {
  let query = supabase
    .from("operational_posts")
    .select("*, branches(name), sectors(name)")
    .order("active", { ascending: false })
    .order("name")

  if (branchId) query = query.eq("branch_id", branchId)

  const { data, error } = await query
  if (isMissingAllocationFeature(error)) return []
  raise(error)
  return (data ?? []) as OperationalPost[]
}

export async function createOperationalPost(
  _profile: UserProfile,
  input: OperationalPostInput
) {
  const name = input.name.trim()
  if (!name) throw new Error("Informe o nome do posto.")

  const { data: postId, error } = await supabase.rpc("create_operational_post", {
    p_branch_id: input.branch_id,
    p_name: name,
    p_type: input.type,
    p_sector_id: input.sector_id ?? null,
    p_active: input.active ?? true,
  })

  if (isMissingAllocationFeature(error)) throw new Error(allocationFeatureMessage())
  raise(error)

  const { data, error: fetchError } = await supabase
    .from("operational_posts")
    .select("*, branches(name), sectors(name)")
    .eq("id", postId as string)
    .single()

  if (fetchError) raise(fetchError)
  return data as OperationalPost
}

export async function updateOperationalPost(
  _profile: UserProfile,
  postId: string,
  input: Partial<Pick<OperationalPost, "name" | "type" | "sector_id" | "active">>
) {
  const { error } = await supabase.rpc("update_operational_post_record", {
    p_post_id:      postId,
    p_name:         input.name ?? null,
    p_type:         input.type ?? null,
    p_active:       input.active ?? null,
    p_sector_id:    input.sector_id !== undefined && input.sector_id !== null
                      ? input.sector_id
                      : null,
    p_clear_sector: input.sector_id === null,
  })

  if (isMissingAllocationFeature(error)) throw new Error(allocationFeatureMessage())
  raise(error)

  const { data, error: fetchError } = await supabase
    .from("operational_posts")
    .select("*, branches(name), sectors(name)")
    .eq("id", postId)
    .single()

  if (fetchError) raise(fetchError)
  return data as OperationalPost
}

export async function toggleOperationalPost(
  profile: UserProfile,
  postId: string,
  active: boolean
) {
  return updateOperationalPost(profile, postId, { active })
}

export async function listPostAllocations(
  branchId?: string | null,
  activeOnly = true
) {
  let query = supabase
    .from("post_allocations")
    .select(
      "*, operational_posts(*, branches(name), sectors(name)), employees(*, sectors(name)), schedules(work_date, start_time, break_start, break_end, end_time)"
    )
    .order("started_at", { ascending: false })
    .limit(activeOnly ? 200 : 500)

  if (branchId) query = query.eq("branch_id", branchId)
  if (activeOnly) {
    query = query
      .is("ended_at", null)
      .in("status", ["alocado", "aguardando_troca", "em_troca"])
  }

  const { data, error } = await query
  if (isMissingAllocationFeature(error)) return []
  raise(error)
  return (data ?? []) as PostAllocation[]
}

export async function listAllocationHistory(branchId?: string | null) {
  return listPostAllocations(branchId, false)
}

export async function listCashMovements(branchId?: string | null) {
  let query = supabase
    .from("cash_movements")
    .select("*, operational_posts(name, type), employees(name)")
    .order("confirmed_at", { ascending: false })
    .limit(300)

  if (branchId) query = query.eq("branch_id", branchId)

  const { data, error } = await query
  if (isMissingAllocationFeature(error)) return []
  raise(error)
  return (data ?? []) as CashMovement[]
}

export async function allocatePost(input: {
  post_id: string
  employee_id: string
  schedule_id?: string | null
  notes?: string | null
}) {
  const { data, error } = await supabase.rpc("allocate_post", {
    p_post_id: input.post_id,
    p_employee_id: input.employee_id,
    p_schedule_id: input.schedule_id ?? null,
    p_notes: input.notes ?? null,
  })

  if (isMissingAllocationFeature(error)) throw new Error(allocationFeatureMessage())
  raise(error)
  return data as PostAllocation
}

export async function transferPostAllocation(input: {
  allocation_id: string
  next_employee_id: string
  next_schedule_id?: string | null
  notes?: string | null
}) {
  const { data, error } = await supabase.rpc("transfer_post_allocation", {
    p_allocation_id: input.allocation_id,
    p_next_employee_id: input.next_employee_id,
    p_next_schedule_id: input.next_schedule_id ?? null,
    p_notes: input.notes ?? null,
  })

  if (isMissingAllocationFeature(error)) throw new Error(allocationFeatureMessage())
  raise(error)
  return data as PostAllocation
}

export async function finalizePostAllocation(input: {
  allocation_id: string
  notes?: string | null
}) {
  const { data, error } = await supabase.rpc("finalize_post_allocation", {
    p_allocation_id: input.allocation_id,
    p_notes: input.notes ?? null,
  })

  if (isMissingAllocationFeature(error)) throw new Error(allocationFeatureMessage())
  raise(error)
  return data as PostAllocation
}

export async function confirmCashMovement(input: {
  allocation_id: string
  movement_type: CashMovementType
  notes?: string | null
}) {
  const { data, error } = await supabase.rpc("confirm_cash_movement", {
    p_allocation_id: input.allocation_id,
    p_movement_type: input.movement_type,
    p_notes: input.notes ?? null,
  })

  if (isMissingAllocationFeature(error)) throw new Error(allocationFeatureMessage())
  raise(error)
  return data as CashMovement
}

export async function setupSegmentDefaults(input: {
  branch_id: string
  sector_names: string[]
  post_definitions: Array<{ name: string; type: string; sector_name: string }>
}) {
  const { data, error } = await supabase.rpc("setup_segment_defaults", {
    p_branch_id:        input.branch_id,
    p_sector_names:     input.sector_names,
    p_post_definitions: input.post_definitions,
  })

  if (isMissingAllocationFeature(error)) throw new Error(allocationFeatureMessage())
  raise(error)
  return data as { sectors_created: number; posts_created: number }
}

export async function listCommsPosts(branchId?: string | null) {
  let query = supabase
    .from("comms_posts")
    .select("*, user_profiles!author_id(name), branches(name), sectors(name)")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(80)

  if (branchId) query = query.or(`branch_id.is.null,branch_id.eq.${branchId}`)

  const { data, error } = await query
  raise(error)
  return (data ?? []) as CommsPost[]
}

export async function createCommsPost(
  profile: UserProfile,
  input: {
    branch_id: string | null
    sector_id: string | null
    title: string
    content: string
    pinned: boolean
  }
) {
  const { data, error } = await supabase
    .from("comms_posts")
    .insert({
      ...input,
      organization_id: profile.organization_id,
      author_id: profile.id,
    })
    .select("*, user_profiles!author_id(name), branches(name), sectors(name)")
    .single()

  raise(error)
  return data as CommsPost
}

export async function markCommsPostRead(profile: UserProfile, postId: string) {
  const { data, error } = await supabase
    .from("comms_post_reads")
    .upsert(
      {
        post_id: postId,
        user_id: profile.id,
        read_at: new Date().toISOString(),
      },
      { onConflict: "post_id,user_id" }
    )
    .select("*")
    .single()

  raise(error)
  return data as { post_id: string; user_id: string; read_at: string }
}

export async function listCommsPostComments(postIds: string[]) {
  if (postIds.length === 0) return []

  const { data, error } = await supabase
    .from("comms_post_comments")
    .select("*, user_profiles!user_id(name)")
    .in("post_id", postIds)
    .order("created_at", { ascending: true })

  raise(error)
  return (data ?? []) as CommsPostComment[]
}

export async function createCommsPostComment(
  profile: UserProfile,
  postId: string,
  content: string
) {
  const { data, error } = await supabase
    .from("comms_post_comments")
    .insert({
      post_id: postId,
      user_id: profile.id,
      content,
    })
    .select("*, user_profiles!user_id(name)")
    .single()

  raise(error)
  return data as CommsPostComment
}

export async function listTrainingItems() {
  const { data, error } = await supabase
    .from("training_items")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: false })

  raise(error)
  return (data ?? []) as TrainingItem[]
}

export async function createTrainingItem(
  profile: UserProfile,
  input: {
    title: string
    type: TrainingType
    content_url: string | null
    duration_minutes: number | null
  }
) {
  const { data, error } = await supabase
    .from("training_items")
    .insert({
      ...input,
      organization_id: profile.organization_id,
    })
    .select("*")
    .single()

  raise(error)
  return data as TrainingItem
}

export async function listTrainingProgress(profile: UserProfile) {
  const { data, error } = await supabase
    .from("training_progress")
    .select("*")
    .eq("user_id", profile.id)

  raise(error)
  return (data ?? []) as TrainingProgress[]
}

export async function setTrainingProgress(
  profile: UserProfile,
  trainingId: string,
  completed: boolean
) {
  const { data, error } = await supabase
    .from("training_progress")
    .upsert(
      {
        training_id: trainingId,
        user_id: profile.id,
        completed,
        completed_at: completed ? new Date().toISOString() : null,
      },
      { onConflict: "training_id,user_id" }
    )
    .select("*")
    .single()

  raise(error)
  return data as TrainingProgress
}

export interface ChecklistProcedureInput {
  branch_id: string | null
  sector_id: string | null
  title: string
  category: string | null
  frequency: ChecklistProcedureFrequency
  estimated_minutes: number | null
  owner_role: string | null
  instructions: string | null
  checklist_items: string[]
}

export async function listChecklistProcedures(branchId?: string | null) {
  let query = supabase
    .from("checklist_procedures")
    .select("*, branches(name), sectors(name), user_profiles!created_by(name)")
    .eq("active", true)
    .order("created_at", { ascending: false })

  if (branchId) query = query.or(`branch_id.is.null,branch_id.eq.${branchId}`)

  const { data, error } = await query
  if (isMissingChecklistFeature(error)) throw new Error(checklistFeatureMessage())
  raise(error)

  return (data ?? []) as ChecklistProcedure[]
}

export async function createChecklistProcedure(
  profile: UserProfile,
  input: ChecklistProcedureInput
) {
  const title = input.title.trim()
  const checklistItems = normalizeChecklistItems(input.checklist_items)

  if (!title) throw new Error("Informe o titulo do procedimento.")
  if (checklistItems.length === 0) {
    throw new Error("Adicione pelo menos um item no checklist.")
  }
  if (input.sector_id && !input.branch_id) {
    throw new Error("Selecione uma filial antes de escolher o setor.")
  }

  if (input.branch_id) {
    await validateBranchAndSector(profile, input.branch_id, input.sector_id)
  }

  const { data, error } = await supabase
    .from("checklist_procedures")
    .insert({
      ...input,
      title,
      category: input.category?.trim() || null,
      owner_role: input.owner_role?.trim() || null,
      instructions: input.instructions?.trim() || null,
      checklist_items: checklistItems,
      organization_id: profile.organization_id,
      created_by: profile.id,
    })
    .select("*, branches(name), sectors(name), user_profiles!created_by(name)")
    .single()

  if (isMissingChecklistFeature(error)) throw new Error(checklistFeatureMessage())
  raise(error)

  await createAuditLog(profile, {
    branch_id: input.branch_id,
    action: "checklist_procedure_created",
    entity_type: "checklist_procedures",
    entity_id: data.id,
    old_value: null,
    new_value: data,
  })

  return data as ChecklistProcedure
}

export async function listChecklistRuns(
  branchId?: string | null,
  since?: string | null
) {
  let query = supabase
    .from("checklist_runs")
    .select("*, checklist_procedures(title, category), branches(name), user_profiles!user_id(name)")
    .order("created_at", { ascending: false })
    .limit(120)

  if (branchId) query = query.or(`branch_id.is.null,branch_id.eq.${branchId}`)
  if (since) query = query.gte("created_at", since)

  const { data, error } = await query
  if (isMissingChecklistFeature(error)) throw new Error(checklistFeatureMessage())
  raise(error)

  return (data ?? []) as ChecklistRun[]
}

export async function completeChecklistRun(
  profile: UserProfile,
  input: {
    procedure_id: string
    branch_id: string | null
    checked_items: string[]
    notes: string | null
  }
) {
  const { data: procedure, error: procedureError } = await supabase
    .from("checklist_procedures")
    .select("id, organization_id, branch_id, active, checklist_items")
    .eq("id", input.procedure_id)
    .maybeSingle()

  if (isMissingChecklistFeature(procedureError)) {
    throw new Error(checklistFeatureMessage())
  }
  raise(procedureError)

  if (
    !procedure ||
    procedure.organization_id !== profile.organization_id ||
    !procedure.active
  ) {
    throw new Error("Procedimento invalido ou inativo.")
  }

  const requiredItems = normalizeChecklistItems(procedure.checklist_items ?? [])
  const checkedItems = normalizeChecklistItems(input.checked_items)
  const missingItems = requiredItems.filter((item) => !checkedItems.includes(item))

  if (missingItems.length > 0) {
    throw new Error("Conclua todos os itens antes de finalizar o checklist.")
  }

  const branchId = procedure.branch_id ?? input.branch_id ?? profile.branch_id ?? null
  const completedAt = new Date().toISOString()

  const { data, error } = await supabase
    .from("checklist_runs")
    .insert({
      organization_id: profile.organization_id,
      procedure_id: input.procedure_id,
      branch_id: branchId,
      user_id: profile.id,
      status: "completed",
      checked_items: checkedItems,
      notes: input.notes?.trim() || null,
      started_at: completedAt,
      completed_at: completedAt,
    })
    .select("*, checklist_procedures(title, category), branches(name), user_profiles!user_id(name)")
    .single()

  if (isMissingChecklistFeature(error)) throw new Error(checklistFeatureMessage())
  raise(error)

  await createAuditLog(profile, {
    branch_id: branchId,
    action: "checklist_run_completed",
    entity_type: "checklist_runs",
    entity_id: data.id,
    old_value: null,
    new_value: data,
  })

  return data as ChecklistRun
}

export async function recordOperationalEvent(
  profile: UserProfile,
  input: {
    branch_id: string
    employee_id: string
    schedule_id: string
    event_type: AttendanceEventType
    delay_minutes?: number
    notes?: string | null
  }
) {
  const actionMeta = getActionMeta(input.event_type)
  const statusReason = input.notes || actionMeta?.label || "Evento operacional"
  const nextScheduleStatus = scheduleStatusForEvent(input.event_type)

  const { data: rpcEvent, error: rpcError } = await supabase.rpc(
    "record_operational_action",
    {
      p_branch_id: input.branch_id,
      p_employee_id: input.employee_id,
      p_schedule_id: input.schedule_id,
      p_event_type: input.event_type,
      p_delay_minutes: input.delay_minutes ?? null,
      p_notes: input.notes ?? null,
    }
  )

  if (!rpcError) return rpcEvent as AttendanceEvent
  if (!isMissingOperationalActionRpc(rpcError)) {
    throw new Error(rpcError.message)
  }

  const { data: event, error: eventError } = await supabase
    .from("attendance_events")
    .insert({
      organization_id: profile.organization_id,
      branch_id: input.branch_id,
      employee_id: input.employee_id,
      schedule_id: input.schedule_id,
      event_type: input.event_type,
      created_by: profile.id,
      notes: input.notes ?? null,
    })
    .select("*")
    .single()

  raise(eventError)

  if (nextScheduleStatus) {
    const { error: scheduleError } = await supabase
      .from("schedules")
      .update({ status: nextScheduleStatus })
      .eq("id", input.schedule_id)
      .eq("organization_id", profile.organization_id)

    raise(scheduleError)
  }

  if (actionMeta) {
    const statusPayload = {
      organization_id: profile.organization_id,
      branch_id: input.branch_id,
      employee_id: input.employee_id,
      schedule_id: input.schedule_id,
      current_status: actionMeta.nextStatus,
      priority_level: actionMeta.priorityLevel,
      delay_minutes:
        input.delay_minutes ?? (input.event_type === "atraso_detectado" ? 10 : 0),
      status_reason: statusReason,
      updated_at: new Date().toISOString(),
    }
    const { error: statusError } = await supabase
      .from("operational_status")
      .upsert(statusPayload, { onConflict: "employee_id,schedule_id" })

    if (isUnsupportedFinalizedStatus(statusError)) {
      const { error: fallbackStatusError } = await supabase
        .from("operational_status")
        .upsert(
          { ...statusPayload, current_status: "folga" },
          { onConflict: "employee_id,schedule_id" }
        )

      raise(fallbackStatusError)
    } else {
      raise(statusError)
    }
  }

  const { error: auditError } = await supabase.from("audit_logs").insert({
    organization_id: profile.organization_id,
    branch_id: input.branch_id,
    user_id: profile.id,
    action: input.event_type,
    entity_type: "attendance_events",
    entity_id: (event as AttendanceEvent).id,
    old_value: null,
    new_value: event,
  })

  raise(auditError)
  return event as AttendanceEvent
}

export async function listAuditLogs(branchId?: string | null) {
  let query = supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(40)

  if (branchId) query = query.eq("branch_id", branchId)

  const { data, error } = await query
  raise(error)
  return (data ?? []) as AuditLog[]
}

export async function listAllAuditLogs(branchId?: string | null) {
  let query = supabase
    .from("audit_logs")
    .select("*, user_profiles!user_id(name)")
    .order("created_at", { ascending: false })
    .limit(500)

  if (branchId) query = query.eq("branch_id", branchId)

  const { data, error } = await query
  raise(error)
  return (data ?? []) as AuditLog[]
}

export async function listReportEvents(branchId?: string | null) {
  let query = supabase
    .from("attendance_events")
    .select("*, employees(name, sectors(name)), branches(name)")
    .order("event_time", { ascending: false })
    .limit(1000)

  if (branchId) query = query.eq("branch_id", branchId)

  const { data, error } = await query
  raise(error)
  return (data ?? []) as AttendanceEvent[]
}

export async function listModules() {
  const { data, error } = await supabase
    .from("modules")
    .select("*")
    .eq("active", true)
    .order("name")

  raise(error)
  return (data ?? []) as Module[]
}

export async function listOrganizationModules(profile: UserProfile) {
  const { data, error } = await supabase
    .from("organization_modules")
    .select("*, modules(*)")
    .eq("organization_id", profile.organization_id)
    .order("created_at")

  raise(error)
  return (data ?? []) as OrganizationModule[]
}

export async function getSubscription(organizationId: string) {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle()

  raise(error)
  return data as Subscription | null
}

export async function updateBranch(
  branchId: string,
  input: Pick<Branch, "name" | "city" | "state" | "address">
) {
  const { data, error } = await supabase
    .from("branches")
    .update(input)
    .eq("id", branchId)
    .select("*")
    .single()

  raise(error)
  return data as Branch
}

export async function toggleBranchActive(
  profile: UserProfile,
  branchId: string,
  active: boolean
) {
  if (active) await ensureBranchLimit(profile)

  const { data, error } = await supabase
    .from("branches")
    .update({ active })
    .eq("id", branchId)
    .select("*")
    .single()

  raise(error)
  return data as Branch
}

export async function updateSector(
  sectorId: string,
  input: { name: string; description: string | null }
) {
  const { data, error } = await supabase
    .from("sectors")
    .update(input)
    .eq("id", sectorId)
    .select("*, branches(name)")
    .single()

  raise(error)
  return data as Sector
}

export async function toggleSectorActive(sectorId: string, active: boolean) {
  const { data, error } = await supabase
    .from("sectors")
    .update({ active })
    .eq("id", sectorId)
    .select("*, branches(name)")
    .single()

  raise(error)
  return data as Sector
}

export async function listUserProfiles() {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*, branches(name)")
    .order("name")

  raise(error)
  return (data ?? []) as UserProfile[]
}

export async function updateUserRole(
  profileId: string,
  role: UserProfile["role"],
  custom_permissions: string[] | null
) {
  const { data, error } = await supabase
    .from("user_profiles")
    .update({ role, custom_permissions })
    .eq("id", profileId)
    .select("*, branches(name)")
    .single()

  raise(error)
  return data as UserProfile
}

export async function setUserActive(profileId: string, active: boolean) {
  const { error } = await supabase.rpc("set_user_active", {
    p_profile_id: profileId,
    p_active: active,
  })
  raise(error)
}

export async function setUserBranch(profileId: string, branchId: string | null) {
  const { error } = await supabase.rpc("set_user_branch", {
    p_profile_id: profileId,
    p_branch_id: branchId,
  })
  raise(error)
}

export async function removeUserFromOrg(profileId: string) {
  const { error } = await supabase.rpc("remove_user_from_org", {
    p_profile_id: profileId,
  })
  raise(error)
}

export async function listInvitations() {
  const { data, error } = await supabase
    .from("invitations")
    .select("*, branches(name), user_profiles!invited_by(name)")
    .order("created_at", { ascending: false })

  raise(error)
  return (data ?? []) as Invitation[]
}

export async function createInvitation(input: {
  email: string
  role: UserProfile["role"]
  branch_id: string | null
}) {
  const { data, error } = await supabase.rpc("invite_user", {
    p_email: input.email,
    p_role: input.role,
    p_branch_id: input.branch_id,
  })
  raise(error)
  return data as string
}

export async function cancelInvitation(invitationId: string) {
  const { error } = await supabase.rpc("cancel_invitation", {
    p_invitation_id: invitationId,
  })
  raise(error)
}

// ── Unyx POS ─────────────────────────────────────────────────────────────────

function isMissingPosFeature(error: { code?: string; message: string } | null) {
  if (!error) return false
  const message = error.message.toLowerCase()
  const mentionsPos =
    message.includes("product_categories") ||
    message.includes("product_variants") ||
    message.includes("cash_sessions") ||
    message.includes("sale_items") ||
    message.includes("sale_payments") ||
    message.includes("pos_cash_movements") ||
    message.includes("pos_open_cash_session") ||
    message.includes("pos_complete_sale") ||
    message.includes("pos_close_cash_session") ||
    message.includes("pos_create_cash_movement")
  return (
    mentionsPos &&
    (error.code === "42P01" ||
      error.code === "PGRST202" ||
      error.code === "PGRST204" ||
      error.code === "PGRST205" ||
      message.includes("does not exist") ||
      message.includes("could not find") ||
      message.includes("schema cache"))
  )
}

function posFeatureMessage() {
  return "Unyx POS ainda não instalado. Rode supabase/pos_setup.sql no SQL Editor e recarregue."
}

function isMissingDeliveryFeature(error: { code?: string; message: string } | null) {
  if (!error) return false
  const message = error.message.toLowerCase()
  const mentionsDelivery =
    message.includes("delivery_orders") ||
    message.includes("delivery")

  return (
    mentionsDelivery &&
    (
      error.code === "42P01" ||
      error.code === "PGRST204" ||
      error.code === "PGRST205" ||
      message.includes("schema cache") ||
      message.includes("does not exist") ||
      message.includes("could not find")
    )
  )
}

function deliveryFeatureMessage() {
  return "Modulo de entregas ainda nao instalado. Rode supabase/deliveries_setup.sql no SQL Editor do Supabase e recarregue o app."
}

export interface ProductInput {
  branch_id: string | null
  category_id: string | null
  name: string
  description: string | null
  barcode: string | null
  sku: string | null
  category: string | null
  brand: string | null
  product_kind: ProductKind
  size_label: string | null
  dosage: string | null
  unit: string
  price: number
  cost_price: number | null
  stock_quantity: number
  min_stock_quantity: number
  track_inventory: boolean
  allow_fractional_quantity: boolean
  perishable: boolean
  prescription_required: boolean
  controlled_substance: boolean
  preparation_time_minutes: number | null
}

export interface ProductCategoryInput {
  branch_id: string | null
  name: string
  description: string | null
  segment: ProductCategorySegment
}

export interface ProductVariantInput {
  product_id: string
  name: string
  barcode: string | null
  sku: string | null
  price: number
  cost_price: number | null
  stock_quantity: number
  sort_order: number
}

export interface DeliveryOrderInput {
  branch_id: string
  sale_id: string | null
  assigned_employee_id: string | null
  source: DeliverySource
  status: DeliveryStatus
  priority: DeliveryPriority
  customer_name: string
  customer_phone: string | null
  address_line: string
  neighborhood: string | null
  city: string | null
  state: string | null
  reference: string | null
  courier_name: string | null
  delivery_fee: number
  order_amount: number
  payment_status: DeliveryPaymentStatus
  scheduled_for: string | null
  estimated_delivery_at: string | null
  notes: string | null
  items: DeliveryItem[]
}

function normalizeDeliveryItems(items: DeliveryItem[]) {
  return items
    .map((item) => ({
      name: item.name.trim(),
      quantity: Math.max(1, Number(item.quantity) || 1),
      notes: item.notes?.trim() || null,
    }))
    .filter((item) => item.name)
}

function normalizeDeliveryPayload(input: DeliveryOrderInput) {
  const customerName = input.customer_name.trim()
  const addressLine = input.address_line.trim()
  const orderAmount = Math.max(0, Number(input.order_amount) || 0)
  const deliveryFee = Math.max(0, Number(input.delivery_fee) || 0)

  if (!input.branch_id) throw new Error("Selecione a filial da entrega.")
  if (!customerName) throw new Error("Informe o cliente da entrega.")
  if (!addressLine) throw new Error("Informe o endereco da entrega.")

  return {
    ...input,
    customer_name: customerName,
    customer_phone: input.customer_phone?.trim() || null,
    address_line: addressLine,
    neighborhood: input.neighborhood?.trim() || null,
    city: input.city?.trim() || null,
    state: input.state?.trim() || null,
    reference: input.reference?.trim() || null,
    courier_name: input.courier_name?.trim() || null,
    delivery_fee: deliveryFee,
    order_amount: orderAmount,
    total_amount: orderAmount + deliveryFee,
    notes: input.notes?.trim() || null,
    items: normalizeDeliveryItems(input.items),
  }
}

function deliveryStatusTimestampPatch(
  status: DeliveryStatus,
  previous?: DeliveryOrder | null
) {
  const now = new Date().toISOString()

  if (status === "out_for_delivery" && !previous?.dispatched_at) {
    return { dispatched_at: now, delivered_at: null, cancelled_at: null }
  }
  if (status === "delivered") {
    return {
      dispatched_at: previous?.dispatched_at ?? now,
      delivered_at: now,
      cancelled_at: null,
    }
  }
  if (status === "cancelled" || status === "failed") {
    return { cancelled_at: now }
  }
  return { delivered_at: null, cancelled_at: null }
}

async function validateProductCategory(
  profile: UserProfile,
  categoryId: string | null | undefined,
  branchId: string | null | undefined
) {
  if (!categoryId) return

  const { data: category, error } = await supabase
    .from("product_categories")
    .select("id, organization_id, branch_id, active")
    .eq("id", categoryId)
    .maybeSingle()

  if (isMissingPosFeature(error)) throw new Error(posFeatureMessage())
  raise(error)

  if (
    !category ||
    category.organization_id !== profile.organization_id ||
    !category.active
  ) {
    throw new Error("Categoria invalida para este produto.")
  }

  if (category.branch_id && category.branch_id !== branchId) {
    throw new Error("A categoria selecionada pertence a outra filial.")
  }
}

async function getProductForMutation(profile: UserProfile, productId: string) {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", productId)
    .maybeSingle()

  if (isMissingPosFeature(error)) throw new Error(posFeatureMessage())
  raise(error)

  if (!data || data.organization_id !== profile.organization_id) {
    throw new Error("Produto nao encontrado.")
  }

  return data as Product
}

function normalizeProductInput(input: ProductInput) {
  const name = input.name.trim()
  if (!name) throw new Error("Informe o nome do produto.")

  return {
    ...input,
    name,
    description: input.description?.trim() || null,
    barcode: input.barcode?.trim() || null,
    sku: input.sku?.trim() || null,
    category: input.category?.trim() || null,
    brand: input.brand?.trim() || null,
    size_label: input.size_label?.trim() || null,
    dosage: input.dosage?.trim() || null,
    unit: input.unit.trim() || "un",
    price: Math.max(0, Number(input.price) || 0),
    cost_price: input.cost_price == null ? null : Math.max(0, Number(input.cost_price) || 0),
    stock_quantity: Math.max(0, Number(input.stock_quantity) || 0),
    min_stock_quantity: Math.max(0, Number(input.min_stock_quantity) || 0),
    preparation_time_minutes:
      input.preparation_time_minutes == null
        ? null
        : Math.max(0, Number(input.preparation_time_minutes) || 0),
  }
}

function normalizeCategoryInput(input: ProductCategoryInput) {
  const name = input.name.trim()
  if (!name) throw new Error("Informe o nome da categoria.")

  return {
    ...input,
    name,
    description: input.description?.trim() || null,
  }
}

function normalizeVariantInput(input: ProductVariantInput) {
  const name = input.name.trim()
  if (!name) throw new Error("Informe o nome da variacao.")

  return {
    ...input,
    name,
    barcode: input.barcode?.trim() || null,
    sku: input.sku?.trim() || null,
    price: Math.max(0, Number(input.price) || 0),
    cost_price: input.cost_price == null ? null : Math.max(0, Number(input.cost_price) || 0),
    stock_quantity: Math.max(0, Number(input.stock_quantity) || 0),
    sort_order: Number(input.sort_order) || 0,
  }
}

export async function listProducts(branchId?: string | null) {
  let query = supabase
    .from("products")
    .select("*")
    .order("active", { ascending: false })
    .order("name")
  if (branchId) query = query.or(`branch_id.is.null,branch_id.eq.${branchId}`)
  const { data, error } = await query
  if (isMissingPosFeature(error)) return []
  raise(error)
  return (data ?? []) as Product[]
}

export async function listProductCategories(branchId?: string | null) {
  let query = supabase
    .from("product_categories")
    .select("*")
    .order("active", { ascending: false })
    .order("name")

  if (branchId) query = query.or(`branch_id.is.null,branch_id.eq.${branchId}`)

  const { data, error } = await query
  if (isMissingPosFeature(error)) throw new Error(posFeatureMessage())
  raise(error)

  return (data ?? []) as ProductCategory[]
}

export async function createProductCategory(
  profile: UserProfile,
  input: ProductCategoryInput
) {
  const payload = normalizeCategoryInput(input)
  if (payload.branch_id) await validateBranchAndSector(profile, payload.branch_id)

  const { data, error } = await supabase
    .from("product_categories")
    .insert({
      ...payload,
      organization_id: profile.organization_id,
    })
    .select("*")
    .single()

  if (isMissingPosFeature(error)) throw new Error(posFeatureMessage())
  raise(error)

  return data as ProductCategory
}

export async function updateProductCategory(
  profile: UserProfile,
  categoryId: string,
  input: Partial<ProductCategoryInput & { active: boolean }>
) {
  if (input.branch_id) await validateBranchAndSector(profile, input.branch_id)

  const payload = {
    ...input,
    name: input.name?.trim(),
    description: input.description === undefined ? undefined : input.description?.trim() || null,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from("product_categories")
    .update(payload)
    .eq("id", categoryId)
    .eq("organization_id", profile.organization_id)
    .select("*")
    .single()

  if (isMissingPosFeature(error)) throw new Error(posFeatureMessage())
  raise(error)

  return data as ProductCategory
}

export async function deleteProductCategory(profile: UserProfile, categoryId: string) {
  const { error } = await supabase
    .from("product_categories")
    .delete()
    .eq("id", categoryId)
    .eq("organization_id", profile.organization_id)

  if (isMissingPosFeature(error)) throw new Error(posFeatureMessage())
  raise(error)
}

export async function listProductVariants() {
  const { data, error } = await supabase
    .from("product_variants")
    .select("*, products(name, branch_id, track_inventory)")
    .order("sort_order")
    .order("name")

  if (isMissingPosFeature(error)) throw new Error(posFeatureMessage())
  raise(error)

  return (data ?? []) as ProductVariant[]
}

export async function createProduct(profile: UserProfile, input: ProductInput) {
  const payload = normalizeProductInput(input)
  if (payload.branch_id) await validateBranchAndSector(profile, payload.branch_id)
  await validateProductCategory(profile, payload.category_id, payload.branch_id)

  const { data, error } = await supabase
    .from("products")
    .insert({ ...payload, organization_id: profile.organization_id })
    .select("*")
    .single()
  if (isMissingPosFeature(error)) throw new Error(posFeatureMessage())
  raise(error)
  return data as Product
}

export async function updateProduct(
  profile: UserProfile,
  productId: string,
  input: Partial<ProductInput & { active: boolean }>
) {
  const previous = await getProductForMutation(profile, productId)
  const payload = {
    ...input,
    name: input.name?.trim(),
    description: input.description === undefined ? undefined : input.description?.trim() || null,
    barcode: input.barcode === undefined ? undefined : input.barcode?.trim() || null,
    sku: input.sku === undefined ? undefined : input.sku?.trim() || null,
    category: input.category === undefined ? undefined : input.category?.trim() || null,
    brand: input.brand === undefined ? undefined : input.brand?.trim() || null,
    size_label: input.size_label === undefined ? undefined : input.size_label?.trim() || null,
    dosage: input.dosage === undefined ? undefined : input.dosage?.trim() || null,
    updated_at: new Date().toISOString(),
  }

  const nextBranchId = input.branch_id === undefined ? previous.branch_id : input.branch_id
  const nextCategoryId =
    input.category_id === undefined ? previous.category_id : input.category_id
  if (nextBranchId) await validateBranchAndSector(profile, nextBranchId)
  await validateProductCategory(profile, nextCategoryId, nextBranchId)

  const { data, error } = await supabase
    .from("products")
    .update(payload)
    .eq("id", productId)
    .select("*")
    .single()
  if (isMissingPosFeature(error)) throw new Error(posFeatureMessage())
  raise(error)
  return data as Product
}

export async function deleteProduct(profile: UserProfile, productId: string) {
  await getProductForMutation(profile, productId)
  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", productId)
    .eq("organization_id", profile.organization_id)

  if (isMissingPosFeature(error)) throw new Error(posFeatureMessage())
  raise(error)
}

export async function createProductVariant(
  profile: UserProfile,
  input: ProductVariantInput
) {
  const product = await getProductForMutation(profile, input.product_id)
  const payload = normalizeVariantInput(input)

  const { data, error } = await supabase
    .from("product_variants")
    .insert({
      ...payload,
      organization_id: product.organization_id,
    })
    .select("*")
    .single()

  if (isMissingPosFeature(error)) throw new Error(posFeatureMessage())
  raise(error)

  return data as ProductVariant
}

export async function updateProductVariant(
  profile: UserProfile,
  variantId: string,
  input: Partial<ProductVariantInput & { active: boolean }>
) {
  const { data: previous, error: previousError } = await supabase
    .from("product_variants")
    .select("*")
    .eq("id", variantId)
    .maybeSingle()

  if (isMissingPosFeature(previousError)) throw new Error(posFeatureMessage())
  raise(previousError)

  if (!previous || previous.organization_id !== profile.organization_id) {
    throw new Error("Variacao nao encontrada.")
  }

  const nextProductId =
    input.product_id === undefined ? previous.product_id : input.product_id
  if (nextProductId !== previous.product_id) {
    await getProductForMutation(profile, nextProductId)
  }

  const payload = {
    ...input,
    name: input.name?.trim(),
    barcode: input.barcode === undefined ? undefined : input.barcode?.trim() || null,
    sku: input.sku === undefined ? undefined : input.sku?.trim() || null,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from("product_variants")
    .update(payload)
    .eq("id", variantId)
    .eq("organization_id", profile.organization_id)
    .select("*")
    .single()

  if (isMissingPosFeature(error)) throw new Error(posFeatureMessage())
  raise(error)

  return data as ProductVariant
}

export async function deleteProductVariant(profile: UserProfile, variantId: string) {
  const { error } = await supabase
    .from("product_variants")
    .delete()
    .eq("id", variantId)
    .eq("organization_id", profile.organization_id)

  if (isMissingPosFeature(error)) throw new Error(posFeatureMessage())
  raise(error)
}

export async function getCurrentCashSession(
  branchId: string,
  status: CashSessionStatus = "open"
) {
  const { data, error } = await supabase
    .from("cash_sessions")
    .select("*, operational_posts(name, type), user_profiles!user_profile_id(name), employees(name)")
    .eq("branch_id", branchId)
    .eq("status", status)
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (isMissingPosFeature(error)) return null
  raise(error)
  return data as CashSession | null
}

export async function listCashSessions(branchId?: string | null) {
  let query = supabase
    .from("cash_sessions")
    .select("*, operational_posts(name, type), user_profiles!user_profile_id(name), employees(name)")
    .order("opened_at", { ascending: false })
    .limit(50)
  if (branchId) query = query.eq("branch_id", branchId)
  const { data, error } = await query
  if (isMissingPosFeature(error)) return []
  raise(error)
  return (data ?? []) as CashSession[]
}

export async function openCashSession(input: {
  branch_id: string
  post_id: string | null
  employee_id: string | null
  initial_amount: number
  notes: string | null
}) {
  const { data, error } = await supabase.rpc("pos_open_cash_session", {
    p_branch_id:      input.branch_id,
    p_post_id:        input.post_id,
    p_employee_id:    input.employee_id,
    p_initial_amount: input.initial_amount,
    p_notes:          input.notes,
  })
  if (isMissingPosFeature(error)) throw new Error(posFeatureMessage())
  raise(error)
  return data as string
}

export async function closeCashSession(input: {
  session_id: string
  final_amount: number
  notes: string | null
}) {
  const { error } = await supabase.rpc("pos_close_cash_session", {
    p_session_id:   input.session_id,
    p_final_amount: input.final_amount,
    p_notes:        input.notes,
  })
  if (isMissingPosFeature(error)) throw new Error(posFeatureMessage())
  raise(error)
}

export interface CompleteSaleInput {
  branch_id: string
  session_id: string
  post_id: string | null
  customer_name: string | null
  discount_amount: number
  notes: string | null
  items: Array<{
    product_id: string | null
    variant_id: string | null
    product_name: string
    quantity: number
    unit_price: number
    discount_amount: number
    total_amount: number
  }>
  payments: Array<{
    method: PaymentMethod
    amount: number
    change_amount: number
  }>
}

export async function completeSale(input: CompleteSaleInput) {
  const { data, error } = await supabase.rpc("pos_complete_sale", {
    p_branch_id:       input.branch_id,
    p_session_id:      input.session_id,
    p_post_id:         input.post_id,
    p_items:           input.items,
    p_payments:        input.payments,
    p_customer_name:   input.customer_name,
    p_discount_amount: input.discount_amount,
    p_notes:           input.notes,
  })
  if (isMissingPosFeature(error)) throw new Error(posFeatureMessage())
  raise(error)
  return data as string
}

export async function createPosCashMovement(input: {
  session_id: string
  movement_type: PosCashMovementType
  amount: number
  notes: string | null
}) {
  const { data, error } = await supabase.rpc("pos_create_cash_movement", {
    p_session_id:    input.session_id,
    p_movement_type: input.movement_type,
    p_amount:        input.amount,
    p_notes:         input.notes,
  })
  if (isMissingPosFeature(error)) throw new Error(posFeatureMessage())
  raise(error)
  return data as string
}

export async function listPosCashMovements(sessionId: string) {
  const { data, error } = await supabase
    .from("pos_cash_movements")
    .select("*, user_profiles!created_by(name)")
    .eq("cash_session_id", sessionId)
    .order("occurred_at", { ascending: false })
  if (isMissingPosFeature(error)) return []
  raise(error)
  return (data ?? []) as PosCashMovement[]
}

export async function listSales(branchId?: string | null, date?: string | null) {
  let query = supabase
    .from("sales")
    .select("*, operational_posts(name, type), user_profiles!user_profile_id(name)")
    .order("sold_at", { ascending: false })
    .limit(200)
  if (branchId) query = query.eq("branch_id", branchId)
  if (date) query = query.gte("sold_at", `${date}T00:00:00`).lte("sold_at", `${date}T23:59:59`)
  const { data, error } = await query
  if (isMissingPosFeature(error)) return []
  raise(error)
  return (data ?? []) as Sale[]
}

export async function listSaleItems(saleId: string) {
  const { data, error } = await supabase
    .from("sale_items")
    .select("*")
    .eq("sale_id", saleId)
    .order("created_at")
  if (isMissingPosFeature(error)) return []
  raise(error)
  return (data ?? []) as SaleItem[]
}

export async function listSalePayments(saleId: string) {
  const { data, error } = await supabase
    .from("sale_payments")
    .select("*")
    .eq("sale_id", saleId)
    .order("created_at")
  if (isMissingPosFeature(error)) return []
  raise(error)
  return (data ?? []) as SalePayment[]
}

export async function listDeliveryOrders(branchId?: string | null) {
  let query = supabase
    .from("delivery_orders")
    .select("*, branches(name), employees!assigned_employee_id(name), user_profiles!created_by(name)")
    .order("created_at", { ascending: false })
    .limit(300)

  if (branchId) query = query.eq("branch_id", branchId)

  const { data, error } = await query
  if (isMissingDeliveryFeature(error)) throw new Error(deliveryFeatureMessage())
  raise(error)

  return (data ?? []) as DeliveryOrder[]
}

async function validateDeliveryReferences(
  profile: UserProfile,
  input: Pick<DeliveryOrderInput, "branch_id" | "sale_id" | "assigned_employee_id">
) {
  await validateBranchAndSector(profile, input.branch_id)

  if (input.sale_id) {
    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .select("id, organization_id, branch_id")
      .eq("id", input.sale_id)
      .maybeSingle()

    if (isMissingPosFeature(saleError)) throw new Error(posFeatureMessage())
    raise(saleError)

    if (
      !sale ||
      sale.organization_id !== profile.organization_id ||
      sale.branch_id !== input.branch_id
    ) {
      throw new Error("A venda selecionada nao pertence a filial da entrega.")
    }
  }

  if (input.assigned_employee_id) {
    const { data: employee, error: employeeError } = await supabase
      .from("employees")
      .select("id, organization_id, branch_id, active")
      .eq("id", input.assigned_employee_id)
      .maybeSingle()

    raise(employeeError)

    if (
      !employee ||
      employee.organization_id !== profile.organization_id ||
      employee.branch_id !== input.branch_id ||
      !employee.active
    ) {
      throw new Error("Entregador invalido para esta filial.")
    }
  }
}

export async function createDeliveryOrder(
  profile: UserProfile,
  input: DeliveryOrderInput
) {
  const payload = normalizeDeliveryPayload(input)
  await validateDeliveryReferences(profile, payload)

  const { data, error } = await supabase
    .from("delivery_orders")
    .insert({
      ...payload,
      organization_id: profile.organization_id,
      created_by: profile.id,
      ...deliveryStatusTimestampPatch(payload.status),
    })
    .select("*, branches(name), employees!assigned_employee_id(name), user_profiles!created_by(name)")
    .single()

  if (isMissingDeliveryFeature(error)) throw new Error(deliveryFeatureMessage())
  raise(error)

  await createAuditLog(profile, {
    branch_id: payload.branch_id,
    action: payload.source === "pos" ? "delivery_created_from_pos" : "delivery_created",
    entity_type: "delivery_orders",
    entity_id: data.id,
    old_value: null,
    new_value: data,
  })

  return data as DeliveryOrder
}

export async function updateDeliveryOrder(
  profile: UserProfile,
  deliveryId: string,
  values: Partial<DeliveryOrderInput>
) {
  const { data: previous, error: previousError } = await supabase
    .from("delivery_orders")
    .select("*")
    .eq("id", deliveryId)
    .eq("organization_id", profile.organization_id)
    .maybeSingle()

  if (isMissingDeliveryFeature(previousError)) throw new Error(deliveryFeatureMessage())
  raise(previousError)

  if (!previous) throw new Error("Entrega nao encontrada.")

  const merged = normalizeDeliveryPayload({
    branch_id: values.branch_id ?? previous.branch_id,
    sale_id: values.sale_id === undefined ? previous.sale_id : values.sale_id,
    assigned_employee_id:
      values.assigned_employee_id === undefined
        ? previous.assigned_employee_id
        : values.assigned_employee_id,
    source: values.source ?? previous.source,
    status: values.status ?? previous.status,
    priority: values.priority ?? previous.priority,
    customer_name: values.customer_name ?? previous.customer_name,
    customer_phone:
      values.customer_phone === undefined ? previous.customer_phone : values.customer_phone,
    address_line: values.address_line ?? previous.address_line,
    neighborhood:
      values.neighborhood === undefined ? previous.neighborhood : values.neighborhood,
    city: values.city === undefined ? previous.city : values.city,
    state: values.state === undefined ? previous.state : values.state,
    reference:
      values.reference === undefined ? previous.reference : values.reference,
    courier_name:
      values.courier_name === undefined ? previous.courier_name : values.courier_name,
    delivery_fee: values.delivery_fee ?? previous.delivery_fee,
    order_amount: values.order_amount ?? previous.order_amount,
    payment_status: values.payment_status ?? previous.payment_status,
    scheduled_for:
      values.scheduled_for === undefined ? previous.scheduled_for : values.scheduled_for,
    estimated_delivery_at:
      values.estimated_delivery_at === undefined
        ? previous.estimated_delivery_at
        : values.estimated_delivery_at,
    notes: values.notes === undefined ? previous.notes : values.notes,
    items: values.items ?? previous.items ?? [],
  })

  await validateDeliveryReferences(profile, merged)

  const { data, error } = await supabase
    .from("delivery_orders")
    .update({
      ...merged,
      ...deliveryStatusTimestampPatch(merged.status, previous as DeliveryOrder),
    })
    .eq("id", deliveryId)
    .eq("organization_id", profile.organization_id)
    .select("*, branches(name), employees!assigned_employee_id(name), user_profiles!created_by(name)")
    .single()

  if (isMissingDeliveryFeature(error)) throw new Error(deliveryFeatureMessage())
  raise(error)

  await createAuditLog(profile, {
    branch_id: data.branch_id,
    action: "delivery_updated",
    entity_type: "delivery_orders",
    entity_id: data.id,
    old_value: previous,
    new_value: data,
  })

  return data as DeliveryOrder
}

export async function deleteDeliveryOrder(profile: UserProfile, deliveryId: string) {
  const { data: previous, error: previousError } = await supabase
    .from("delivery_orders")
    .select("*")
    .eq("id", deliveryId)
    .eq("organization_id", profile.organization_id)
    .maybeSingle()

  if (isMissingDeliveryFeature(previousError)) throw new Error(deliveryFeatureMessage())
  raise(previousError)

  if (!previous) throw new Error("Entrega nao encontrada.")

  const { error } = await supabase
    .from("delivery_orders")
    .delete()
    .eq("id", deliveryId)
    .eq("organization_id", profile.organization_id)

  if (isMissingDeliveryFeature(error)) throw new Error(deliveryFeatureMessage())
  raise(error)

  await createAuditLog(profile, {
    branch_id: previous.branch_id,
    action: "delivery_deleted",
    entity_type: "delivery_orders",
    entity_id: previous.id,
    old_value: previous,
    new_value: null,
  })
}

export async function copySchedulesFromDate(
  profile: UserProfile,
  sourceDate: string,
  targetDate: string,
  branchId?: string | null
) {
  let sourceQuery = supabase
    .from("schedules")
    .select("*")
    .eq("work_date", sourceDate)
    .eq("organization_id", profile.organization_id)

  if (branchId) sourceQuery = sourceQuery.eq("branch_id", branchId)

  const { data: sourceSchedules, error: sourceError } = await sourceQuery

  raise(sourceError)
  if (!sourceSchedules?.length) return []

  const { data: existingSchedules, error: existingError } = await supabase
    .from("schedules")
    .select("employee_id, work_date")
    .eq("work_date", targetDate)
    .eq("organization_id", profile.organization_id)

  raise(existingError)

  const existingKeys = new Set(
    (existingSchedules ?? []).map(
      (schedule) => `${schedule.employee_id}:${schedule.work_date}`
    )
  )

  const newSchedules = sourceSchedules
    .filter((schedule) => !existingKeys.has(`${schedule.employee_id}:${targetDate}`))
    .map((schedule) => ({
      organization_id: schedule.organization_id,
      branch_id: schedule.branch_id,
      employee_id: schedule.employee_id,
      work_date: targetDate,
      start_time: schedule.status === "day_off" ? null : schedule.start_time,
      break_start: schedule.status === "day_off" ? null : schedule.break_start,
      break_end: schedule.status === "day_off" ? null : schedule.break_end,
      end_time: schedule.status === "day_off" ? null : schedule.end_time,
      status: schedule.status as ScheduleStatus,
      notes: schedule.notes,
    }))

  if (newSchedules.length === 0) return []

  const { data, error } = await supabase
    .from("schedules")
    .insert(newSchedules)
    .select("*, branches(name), employees(*, sectors(name))")

  raise(error)

  await createAuditLog(profile, {
    branch_id: branchId ?? null,
    action: "schedules_copied",
    entity_type: "schedules",
    old_value: { sourceDate, targetDate },
    new_value: {
      created: data?.length ?? 0,
      skipped: sourceSchedules.length - newSchedules.length,
    },
  })

  return (data ?? []) as ScheduleWithRelations[]
}

export async function importSchedules(
  profile: UserProfile,
  rows: ScheduleImportInput[]
): Promise<BulkImportResult> {
  const errors: string[] = []
  const normalizedRows: ScheduleImportInput[] = []
  const seen = new Set<string>()

  for (const [index, row] of rows.entries()) {
    try {
      await validateScheduleEmployee(profile, row.branch_id, row.employee_id)
      const normalized = normalizeScheduleInput({
        ...row,
        notes: row.notes?.trim() || null,
      }) as ScheduleImportInput
      const key = `${normalized.employee_id}:${normalized.work_date}`

      if (seen.has(key)) {
        errors.push(`Linha ${index + 2}: escala duplicada no arquivo.`)
        continue
      }

      seen.add(key)
      normalizedRows.push(normalized)
    } catch (error) {
      errors.push(
        `Linha ${index + 2}: ${
          error instanceof Error ? error.message : "registro invalido"
        }`
      )
    }
  }

  if (normalizedRows.length === 0) {
    return { created: 0, skipped: rows.length, errors }
  }

  const dates = Array.from(new Set(normalizedRows.map((row) => row.work_date)))
  const employeeIds = Array.from(new Set(normalizedRows.map((row) => row.employee_id)))

  const { data: existing, error: existingError } = await supabase
    .from("schedules")
    .select("employee_id, work_date")
    .eq("organization_id", profile.organization_id)
    .in("work_date", dates)
    .in("employee_id", employeeIds)

  raise(existingError)

  const existingKeys = new Set(
    (existing ?? []).map((schedule) => `${schedule.employee_id}:${schedule.work_date}`)
  )
  const payload = normalizedRows
    .filter((row, index) => {
      const exists = existingKeys.has(`${row.employee_id}:${row.work_date}`)
      if (exists) errors.push(`Linha ${index + 2}: colaborador ja possui escala nesta data.`)
      return !exists
    })
    .map((row) => ({
      ...row,
      organization_id: profile.organization_id,
    }))

  if (payload.length === 0) {
    return { created: 0, skipped: rows.length, errors }
  }

  const { data, error } = await supabase
    .from("schedules")
    .insert(payload)
    .select("*, branches(name), employees(*, sectors(name))")

  raise(error)

  await createAuditLog(profile, {
    action: "schedules_imported",
    entity_type: "schedules",
    old_value: null,
    new_value: { created: data?.length ?? 0, skipped: rows.length - payload.length },
  })

  return {
    created: data?.length ?? 0,
    skipped: rows.length - payload.length,
    errors,
  }
}
