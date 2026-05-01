import { supabase } from "@/lib/supabase"
import { getActionMeta } from "@/lib/status"
import type {
  AttendanceEvent,
  AttendanceEventType,
  AuditLog,
  Branch,
  BusinessSegment,
  DashboardRow,
  Employee,
  EmployeeWithRelations,
  Module,
  OperationalStatusRecord,
  Organization,
  ScheduleStatus,
  ScheduleWithRelations,
  Sector,
  Subscription,
  UserProfile,
} from "@/types/domain"

function raise(error: { message: string } | null) {
  if (error) throw new Error(error.message)
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

export async function ensureCurrentProfile() {
  const profile = await getCurrentProfile()
  if (profile) return profile

  const { error } = await supabase.rpc("bootstrap_current_user_profile")

  if (error) {
    const missingFunction =
      error.code === "PGRST202" ||
      error.message.includes("bootstrap_current_user_profile")

    if (missingFunction) {
      throw new Error(
        "Bootstrap de perfil ainda nao instalado. Rode supabase/bootstrap_first_access.sql no SQL Editor do Supabase e recarregue o perfil."
      )
    }

    throw new Error(error.message)
  }

  return getCurrentProfile()
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
  organizationId: string,
  input: {
    name: string
    trade_name: string | null
    document: string | null
    segment: BusinessSegment
  }
) {
  const { data, error } = await supabase
    .from("organizations")
    .update(input)
    .eq("id", organizationId)
    .select("*")
    .single()

  raise(error)
  return data as Organization
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
      "active" | "branch_id" | "sector_id" | "name" | "role" | "phone" | "notes"
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

export async function listModules() {
  const { data, error } = await supabase
    .from("modules")
    .select("*")
    .order("name")

  raise(error)
  return (data ?? []) as Module[]
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
