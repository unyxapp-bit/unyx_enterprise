import { supabase } from "@/lib/supabase"
import { getActionMeta } from "@/lib/status"
import type {
  AttendanceEvent,
  AttendanceEventType,
  AuditLog,
  Branch,
  BusinessSegment,
  CommsPost,
  CommsPostComment,
  DashboardRow,
  Employee,
  EmployeeWithRelations,
  Module,
  OrganizationModule,
  OperationalSettings,
  OperationalStatusRecord,
  Organization,
  Schedule,
  ScheduleStatus,
  ScheduleWithRelations,
  Sector,
  Subscription,
  TrainingItem,
  TrainingProgress,
  TrainingType,
  UserProfile,
} from "@/types/domain"

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

function isMissingProfileRpc(error: { code?: string; message: string } | null) {
  if (!error) return false
  return (
    error.code === "PGRST202" ||
    error.message.includes("update_current_user_profile")
  )
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
  input: {
    branch_id: string
    sector_id: string | null
    name: string
    role: string | null
    phone: string | null
    document: string | null
    notes: string | null
  }
) {
  const { data, error } = await supabase
    .from("employees")
    .insert({
      ...input,
      organization_id: profile.organization_id,
    })
    .select("*, branches(name), sectors(name)")
    .single()

  raise(error)
  return data as EmployeeWithRelations
}

export async function updateEmployee(
  employeeId: string,
  input: Partial<
    Pick<
      Employee,
      "active" | "branch_id" | "sector_id" | "name" | "role" | "phone" | "document" | "notes"
    >
  >
) {
  const { data, error } = await supabase
    .from("employees")
    .update(input)
    .eq("id", employeeId)
    .select("*, branches(name), sectors(name)")
    .single()

  raise(error)
  return data as EmployeeWithRelations
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

export async function createSchedule(
  profile: UserProfile,
  input: {
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
) {
  const { data, error } = await supabase
    .from("schedules")
    .insert({
      ...input,
      organization_id: profile.organization_id,
    })
    .select("*, branches(name), employees(*, sectors(name))")
    .single()

  raise(error)
  return data as ScheduleWithRelations
}

export async function updateSchedule(
  scheduleId: string,
  input: Partial<
    Pick<
      Schedule,
      "start_time" | "break_start" | "break_end" | "end_time" | "status" | "notes"
    >
  >
) {
  const { data, error } = await supabase
    .from("schedules")
    .update(input)
    .eq("id", scheduleId)
    .select("*, branches(name), employees(*, sectors(name))")
    .single()

  raise(error)
  return data as ScheduleWithRelations
}

export async function deleteSchedule(scheduleId: string) {
  const { error } = await supabase
    .from("schedules")
    .delete()
    .eq("id", scheduleId)

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

  if (actionMeta) {
    const { error: statusError } = await supabase
      .from("operational_status")
      .upsert(
        {
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
        },
        { onConflict: "employee_id,schedule_id" }
      )

    raise(statusError)
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

export async function toggleBranchActive(branchId: string, active: boolean) {
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
    .select("*")
    .order("name")

  raise(error)
  return (data ?? []) as UserProfile[]
}

export async function updateUserRole(profileId: string, role: UserProfile["role"]) {
  const { data, error } = await supabase
    .from("user_profiles")
    .update({ role })
    .eq("id", profileId)
    .select("*")
    .single()

  raise(error)
  return data as UserProfile
}

export async function copySchedulesFromDate(
  profile: UserProfile,
  sourceDate: string,
  targetDate: string
) {
  const { data: sourceSchedules, error: sourceError } = await supabase
    .from("schedules")
    .select("*")
    .eq("work_date", sourceDate)
    .eq("organization_id", profile.organization_id)

  raise(sourceError)
  if (!sourceSchedules?.length) return []

  const newSchedules = sourceSchedules.map((schedule) => ({
    organization_id: schedule.organization_id,
    branch_id: schedule.branch_id,
    employee_id: schedule.employee_id,
    work_date: targetDate,
    start_time: schedule.start_time,
    break_start: schedule.break_start,
    break_end: schedule.break_end,
    end_time: schedule.end_time,
    status: "scheduled" as ScheduleStatus,
    notes: schedule.notes,
  }))

  const { data, error } = await supabase
    .from("schedules")
    .insert(newSchedules)
    .select("*, branches(name), employees(*, sectors(name))")

  raise(error)
  return (data ?? []) as ScheduleWithRelations[]
}
