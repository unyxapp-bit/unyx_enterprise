export type OrganizationStatus =
  | "active"
  | "inactive"
  | "trial"
  | "suspended"
  | "cancelled"

export type UserRole =
  | "owner"
  | "admin"
  | "branch_manager"
  | "supervisor"
  | "operator"
  | "employee"

export type BusinessSegment =
  | "retail_store"
  | "supermarket"
  | "restaurant"
  | "pharmacy"
  | "other"

export type ScheduleStatus =
  | "scheduled"
  | "working"
  | "on_break"
  | "returned"
  | "finished"
  | "absent"
  | "day_off"
  | "cancelled"

export type OperationalStatus =
  | "trabalhando"
  | "deve_sair"
  | "aguardando_sangria"
  | "troca_de_caixa"
  | "em_intervalo"
  | "voltou"
  | "folga"
  | "alerta_critico"

export type AttendanceEventType =
  | "entrada_confirmada"
  | "atraso_detectado"
  | "falta_detectada"
  | "intervalo_solicitado"
  | "sangria_confirmada"
  | "troca_caixa_confirmada"
  | "intervalo_iniciado"
  | "retorno_confirmado"
  | "saida_confirmada"
  | "ocorrencia_registrada"

export type SubscriptionPlan = "starter" | "growth" | "enterprise"
export type SubscriptionStatus = "trial" | "active" | "past_due" | "cancelled"

export interface Organization {
  id: string
  name: string
  trade_name: string | null
  document: string | null
  segment: BusinessSegment
  status: OrganizationStatus
  plan: SubscriptionPlan
  created_at: string
  updated_at: string
}

export interface OperationalSettings {
  id: string
  organization_id: string
  branch_id: string | null
  mode: BusinessSegment
  late_tolerance_minutes: number
  break_tolerance_minutes: number
  require_cashier_cash_count: boolean
  require_coverage_before_break: boolean
  block_break_on_peak_hours: boolean
  require_responsible_presence: boolean
  created_at: string
  updated_at: string
}

export interface Branch {
  id: string
  organization_id: string
  name: string
  city: string | null
  state: string | null
  address: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export interface Sector {
  id: string
  organization_id: string
  branch_id: string
  name: string
  description: string | null
  active: boolean
  created_at: string
  updated_at: string
  branches?: Pick<Branch, "name"> | null
}

export interface UserProfile {
  id: string
  auth_user_id: string
  organization_id: string
  branch_id: string | null
  name: string
  email: string
  role: UserRole
  active: boolean
  created_at: string
  updated_at: string
}

export interface Employee {
  id: string
  organization_id: string
  branch_id: string
  sector_id: string | null
  name: string
  role: string | null
  phone: string | null
  document: string | null
  active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface EmployeeWithRelations extends Employee {
  branches?: Pick<Branch, "name"> | null
  sectors?: Pick<Sector, "name"> | null
}

export interface Schedule {
  id: string
  organization_id: string
  branch_id: string
  employee_id: string
  work_date: string
  start_time: string | null
  break_start: string | null
  break_end: string | null
  end_time: string | null
  status: ScheduleStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ScheduleWithRelations extends Schedule {
  branches?: Pick<Branch, "name"> | null
  employees?: EmployeeWithRelations | null
}

export interface OperationalStatusRecord {
  id: string
  organization_id: string
  branch_id: string
  employee_id: string
  schedule_id: string | null
  current_status: OperationalStatus
  priority_level: number
  delay_minutes: number
  status_reason: string | null
  updated_at: string
  branches?: Pick<Branch, "name"> | null
  employees?: EmployeeWithRelations | null
  schedules?: Pick<
    Schedule,
    "work_date" | "start_time" | "break_start" | "break_end" | "end_time"
  > | null
}

export interface DashboardRow {
  id: string
  organization_id: string
  branch_id: string
  branch_name: string
  employee_id: string
  employee_name: string
  employee_role: string | null
  sector_name: string | null
  work_date: string | null
  start_time: string | null
  break_start: string | null
  break_end: string | null
  end_time: string | null
  current_status: OperationalStatus
  priority_level: number
  delay_minutes: number
  status_reason: string | null
  updated_at: string
}

export interface AttendanceEvent {
  id: string
  organization_id: string
  branch_id: string
  employee_id: string
  schedule_id: string | null
  event_type: AttendanceEventType
  event_time: string
  created_by: string | null
  notes: string | null
  created_at: string
  employees?: Pick<Employee, "name"> | null
  branches?: Pick<Branch, "name"> | null
}

export interface CommsPost {
  id: string
  organization_id: string
  branch_id: string | null
  sector_id: string | null
  author_id: string | null
  title: string
  content: string
  pinned: boolean
  created_at: string
  updated_at: string
  user_profiles?: Pick<UserProfile, "name"> | null
  branches?: Pick<Branch, "name"> | null
  sectors?: Pick<Sector, "name"> | null
}

export interface CommsPostRead {
  post_id: string
  user_id: string
  read_at: string
}

export interface CommsPostComment {
  id: string
  post_id: string
  user_id: string | null
  content: string
  created_at: string
  updated_at: string
  user_profiles?: Pick<UserProfile, "name"> | null
}

export type TrainingType = "article" | "video" | "checklist" | "link"

export interface TrainingItem {
  id: string
  organization_id: string
  title: string
  type: TrainingType
  content_url: string | null
  duration_minutes: number | null
  active: boolean
  created_at: string
  updated_at: string
}

export interface TrainingProgress {
  training_id: string
  user_id: string
  completed: boolean
  completed_at: string | null
}

export interface AuditLog {
  id: string
  organization_id: string
  branch_id: string | null
  user_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  old_value: unknown
  new_value: unknown
  created_at: string
  user_profiles?: Pick<UserProfile, "name"> | null
}

export interface Module {
  id: string
  key: string
  name: string
  description: string | null
  active: boolean
  created_at: string
}

export interface Subscription {
  id: string
  organization_id: string
  plan: SubscriptionPlan
  status: SubscriptionStatus
  max_branches: number
  max_employees: number
  trial_ends_at: string | null
  current_period_start: string | null
  current_period_end: string | null
  created_at: string
  updated_at: string
}
