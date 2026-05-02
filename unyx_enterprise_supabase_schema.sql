-- =========================================================
-- UNYX ENTERPRISE / UNYX OPS
-- Supabase Schema Multi-Tenant
-- Versão inicial para MVP SaaS B2B
-- =========================================================

-- Extensões recomendadas
create extension if not exists "pgcrypto";

-- =========================================================
-- ENUMS
-- =========================================================

create type public.organization_status as enum (
  'active',
  'inactive',
  'trial',
  'suspended',
  'cancelled'
);

create type public.user_role as enum (
  'owner',
  'admin',
  'branch_manager',
  'supervisor',
  'operator',
  'employee'
);

create type public.business_segment as enum (
  'retail_store',
  'supermarket',
  'restaurant',
  'pharmacy',
  'other'
);

create type public.schedule_status as enum (
  'scheduled',
  'working',
  'on_break',
  'returned',
  'finished',
  'absent',
  'day_off',
  'cancelled'
);

create type public.operational_status_type as enum (
  'aguardando_evento',
  'trabalhando',
  'deve_sair',
  'aguardando_sangria',
  'troca_de_caixa',
  'em_intervalo',
  'voltou',
  'folga',
  'finalizado',
  'alerta_critico'
);

create type public.attendance_event_type as enum (
  'entrada_confirmada',
  'atraso_detectado',
  'falta_detectada',
  'intervalo_solicitado',
  'sangria_confirmada',
  'troca_caixa_confirmada',
  'intervalo_iniciado',
  'retorno_confirmado',
  'saida_confirmada',
  'ocorrencia_registrada'
);

create type public.operational_post_type as enum (
  'cashier',
  'self_checkout',
  'counter',
  'service_desk',
  'delivery',
  'stock',
  'kitchen',
  'reception',
  'other'
);

create type public.post_allocation_status as enum (
  'alocado',
  'aguardando_troca',
  'em_troca',
  'finalizado',
  'sem_cobertura'
);

create type public.cash_movement_type as enum (
  'sangria_confirmada',
  'abertura_caixa',
  'fechamento_caixa',
  'troco_reforco'
);

create type public.subscription_plan as enum (
  'starter',
  'growth',
  'enterprise'
);

create type public.subscription_status as enum (
  'trial',
  'active',
  'past_due',
  'cancelled',
  'suspended'
);

-- =========================================================
-- FUNÇÃO PADRÃO UPDATED_AT
-- =========================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================================================
-- ORGANIZAÇÕES
-- =========================================================

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  trade_name text,
  document text,
  segment public.business_segment not null default 'other',
  status public.organization_status not null default 'trial',
  plan public.subscription_plan not null default 'starter',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_organizations_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

-- =========================================================
-- FILIAIS
-- =========================================================

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  city text,
  state text,
  address text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_branches_organization on public.branches(organization_id);

create trigger trg_branches_updated_at
before update on public.branches
for each row execute function public.set_updated_at();

-- =========================================================
-- SETORES
-- =========================================================

create table public.sectors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  name text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(branch_id, name)
);

create index idx_sectors_organization on public.sectors(organization_id);
create index idx_sectors_branch on public.sectors(branch_id);

create trigger trg_sectors_updated_at
before update on public.sectors
for each row execute function public.set_updated_at();

-- =========================================================
-- PERFIS DE USUÁRIOS COM LOGIN
-- =========================================================

create table public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  name text not null,
  email text not null,
  role public.user_role not null default 'employee',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_user_profiles_auth_user on public.user_profiles(auth_user_id);
create index idx_user_profiles_organization on public.user_profiles(organization_id);
create index idx_user_profiles_branch on public.user_profiles(branch_id);

create trigger trg_user_profiles_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

-- =========================================================
-- COLABORADORES OPERACIONAIS
-- Nem todo colaborador precisa ter login.
-- =========================================================

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  sector_id uuid references public.sectors(id) on delete set null,
  name text not null,
  role text,
  phone text,
  document text,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_employees_organization on public.employees(organization_id);
create index idx_employees_branch on public.employees(branch_id);
create index idx_employees_sector on public.employees(sector_id);
create index idx_employees_name on public.employees(name);

create trigger trg_employees_updated_at
before update on public.employees
for each row execute function public.set_updated_at();

-- =========================================================
-- ESCALAS PLANEJADAS
-- =========================================================

create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  work_date date not null,
  start_time time,
  break_start time,
  break_end time,
  end_time time,
  status public.schedule_status not null default 'scheduled',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(employee_id, work_date)
);

create index idx_schedules_organization_date on public.schedules(organization_id, work_date);
create index idx_schedules_branch_date on public.schedules(branch_id, work_date);
create index idx_schedules_employee_date on public.schedules(employee_id, work_date);

create trigger trg_schedules_updated_at
before update on public.schedules
for each row execute function public.set_updated_at();

-- =========================================================
-- EVENTOS OPERACIONAIS DO DIA
-- =========================================================

create table public.attendance_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  schedule_id uuid references public.schedules(id) on delete set null,
  event_type public.attendance_event_type not null,
  event_time timestamptz not null default now(),
  created_by uuid references public.user_profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create index idx_attendance_events_organization on public.attendance_events(organization_id);
create index idx_attendance_events_branch_time on public.attendance_events(branch_id, event_time desc);
create index idx_attendance_events_employee_time on public.attendance_events(employee_id, event_time desc);
create index idx_attendance_events_type on public.attendance_events(event_type);

-- =========================================================
-- STATUS OPERACIONAL ATUAL
-- Usado pelo dashboard vivo.
-- =========================================================

create table public.operational_status (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  schedule_id uuid references public.schedules(id) on delete set null,
  current_status public.operational_status_type not null default 'trabalhando',
  priority_level integer not null default 0,
  delay_minutes integer not null default 0,
  status_reason text,
  updated_at timestamptz not null default now(),
  unique(employee_id, schedule_id)
);

create index idx_operational_status_organization on public.operational_status(organization_id);
create index idx_operational_status_branch_priority on public.operational_status(branch_id, priority_level desc, delay_minutes desc);
create index idx_operational_status_employee on public.operational_status(employee_id);

-- =========================================================
-- UNYX ALLOCATION: POSTOS, ALOCACOES E SANGRIA
-- =========================================================

create table public.operational_posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  sector_id uuid references public.sectors(id) on delete set null,
  name text not null,
  type public.operational_post_type not null default 'other',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(branch_id, name)
);

create index idx_operational_posts_organization on public.operational_posts(organization_id);
create index idx_operational_posts_branch on public.operational_posts(branch_id);
create index idx_operational_posts_sector on public.operational_posts(sector_id);

create trigger trg_operational_posts_updated_at
before update on public.operational_posts
for each row execute function public.set_updated_at();

create table public.post_allocations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  post_id uuid not null references public.operational_posts(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  schedule_id uuid references public.schedules(id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  status public.post_allocation_status not null default 'alocado',
  created_by uuid references public.user_profiles(id) on delete set null,
  ended_by uuid references public.user_profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_post_allocations_organization on public.post_allocations(organization_id);
create index idx_post_allocations_branch on public.post_allocations(branch_id);
create index idx_post_allocations_post on public.post_allocations(post_id);
create index idx_post_allocations_employee on public.post_allocations(employee_id);
create index idx_post_allocations_active on public.post_allocations(post_id, status) where ended_at is null;

create unique index uniq_post_allocations_active_post
on public.post_allocations(post_id)
where ended_at is null and status in ('alocado', 'aguardando_troca', 'em_troca');

create unique index uniq_post_allocations_active_employee
on public.post_allocations(employee_id)
where ended_at is null and status in ('alocado', 'aguardando_troca', 'em_troca');

create trigger trg_post_allocations_updated_at
before update on public.post_allocations
for each row execute function public.set_updated_at();

create table public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  post_id uuid not null references public.operational_posts(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  allocation_id uuid references public.post_allocations(id) on delete set null,
  movement_type public.cash_movement_type not null,
  confirmed_at timestamptz not null default now(),
  confirmed_by uuid references public.user_profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create index idx_cash_movements_organization on public.cash_movements(organization_id);
create index idx_cash_movements_branch on public.cash_movements(branch_id);
create index idx_cash_movements_post on public.cash_movements(post_id);
create index idx_cash_movements_employee on public.cash_movements(employee_id);
create index idx_cash_movements_time on public.cash_movements(confirmed_at desc);

-- =========================================================
-- AUDITORIA
-- =========================================================

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  user_id uuid references public.user_profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

create index idx_audit_logs_organization_time on public.audit_logs(organization_id, created_at desc);
create index idx_audit_logs_branch_time on public.audit_logs(branch_id, created_at desc);
create index idx_audit_logs_user_time on public.audit_logs(user_id, created_at desc);

-- =========================================================
-- MÓDULOS DA PLATAFORMA
-- =========================================================

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.modules (key, name, description, active)
values
  ('unyx_ops', 'Unyx Ops', 'Operacao em tempo real: dashboard, status, acoes e alertas.', true),
  ('unyx_control', 'Unyx Control', 'Estrutura, cadastros, filiais, setores, usuarios e regras operacionais.', true),
  ('unyx_allocation', 'Unyx Allocation', 'Postos, PDVs, alocacao, cobertura, trocas e sangrias.', true),
  ('unyx_insight', 'Unyx Insight', 'Relatorios, auditoria visual e visao gerencial.', true),
  ('unyx_comms', 'Unyx Comms', 'Comunicacao interna, avisos, feed corporativo e leitura confirmada.', true),
  ('unyx_game', 'Unyx Game', 'Gamificacao operacional, ranking, pontos, metas e engajamento.', true),
  ('unyx_academy', 'Unyx Academy', 'Treinamentos, onboarding, trilhas e progresso de capacitacao.', true),
  ('unyx_ai', 'Unyx AI', 'Insights automaticos, previsao de risco e sugestoes operacionais.', true)
on conflict (key) do update
set
  name = excluded.name,
  description = excluded.description,
  active = excluded.active;

create table public.organization_modules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  module_id uuid not null references public.modules(id) on delete cascade,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique(organization_id, module_id)
);

create index idx_organization_modules_organization on public.organization_modules(organization_id);

-- =========================================================
-- ASSINATURAS
-- =========================================================

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan public.subscription_plan not null default 'starter',
  status public.subscription_status not null default 'trial',
  max_branches integer not null default 1,
  max_employees integer not null default 30,
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id)
);

create trigger trg_subscriptions_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

-- =========================================================
-- CONFIGURACOES DE MODOS OPERACIONAIS
-- =========================================================

create table public.operational_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete cascade,
  mode public.business_segment not null default 'other',
  late_tolerance_minutes integer not null default 15 check (late_tolerance_minutes >= 0),
  break_tolerance_minutes integer not null default 10 check (break_tolerance_minutes >= 0),
  require_cashier_cash_count boolean not null default false,
  require_coverage_before_break boolean not null default true,
  block_break_on_peak_hours boolean not null default false,
  require_responsible_presence boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index uniq_operational_settings_org_default
on public.operational_settings(organization_id)
where branch_id is null;

create unique index uniq_operational_settings_org_branch
on public.operational_settings(organization_id, branch_id)
where branch_id is not null;

create index idx_operational_settings_organization
on public.operational_settings(organization_id);

create trigger trg_operational_settings_updated_at
before update on public.operational_settings
for each row execute function public.set_updated_at();

-- =========================================================
-- UNYX COMMS
-- =========================================================

create table public.comms_posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  sector_id uuid references public.sectors(id) on delete set null,
  author_id uuid references public.user_profiles(id) on delete set null,
  title text not null,
  content text not null,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_comms_posts_organization_time on public.comms_posts(organization_id, pinned desc, created_at desc);
create index idx_comms_posts_branch on public.comms_posts(branch_id);
create index idx_comms_posts_sector on public.comms_posts(sector_id);

create trigger trg_comms_posts_updated_at
before update on public.comms_posts
for each row execute function public.set_updated_at();

create table public.comms_post_reads (
  post_id uuid not null references public.comms_posts(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index idx_comms_post_reads_user on public.comms_post_reads(user_id);

create table public.comms_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.comms_posts(id) on delete cascade,
  user_id uuid references public.user_profiles(id) on delete set null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_comms_post_comments_post_time on public.comms_post_comments(post_id, created_at);
create index idx_comms_post_comments_user on public.comms_post_comments(user_id);

create trigger trg_comms_post_comments_updated_at
before update on public.comms_post_comments
for each row execute function public.set_updated_at();

-- =========================================================
-- UNYX ACADEMY
-- =========================================================

create table public.training_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  type text not null default 'link' check (type in ('article', 'video', 'checklist', 'link')),
  content_url text,
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_training_items_organization on public.training_items(organization_id, active);

create trigger trg_training_items_updated_at
before update on public.training_items
for each row execute function public.set_updated_at();

create table public.training_progress (
  training_id uuid not null references public.training_items(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  completed boolean not null default false,
  completed_at timestamptz,
  primary key (training_id, user_id)
);

create index idx_training_progress_user on public.training_progress(user_id);

-- =========================================================
-- FUNÇÕES DE SEGURANÇA MULTI-TENANT
-- =========================================================

create or replace function public.current_user_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.user_profiles
  where auth_user_id = auth.uid()
    and active = true
  limit 1;
$$;

create or replace function public.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id
  from public.user_profiles
  where auth_user_id = auth.uid()
    and active = true
  limit 1;
$$;

create or replace function public.current_branch_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select branch_id
  from public.user_profiles
  where auth_user_id = auth.uid()
    and active = true
  limit 1;
$$;

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.user_profiles
  where auth_user_id = auth.uid()
    and active = true
  limit 1;
$$;

create or replace function public.is_org_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() in ('owner', 'admin');
$$;

create or replace function public.can_manage_branch(target_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.current_user_role() in ('owner', 'admin')
    or (
      public.current_user_role() in ('branch_manager', 'supervisor')
      and public.current_branch_id() = target_branch_id
    );
$$;

create or replace function public.complete_current_user_onboarding(
  p_profile_name text,
  p_organization_name text,
  p_trade_name text default null,
  p_document text default null,
  p_segment public.business_segment default 'other',
  p_branch_name text default 'Loja principal',
  p_city text default null,
  p_state text default null,
  p_address text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_auth_user auth.users%rowtype;
  v_profile_id uuid;
  v_org_id uuid;
  v_branch_id uuid;
  v_email text;
  v_name text;
  v_org_name text;
  v_branch_name text;
begin
  if v_auth_user_id is null then
    raise exception 'Usuario autenticado nao encontrado.';
  end if;

  v_name := nullif(trim(p_profile_name), '');
  v_org_name := nullif(trim(p_organization_name), '');
  v_branch_name := coalesce(nullif(trim(p_branch_name), ''), 'Loja principal');

  if v_name is null then
    raise exception 'Nome do usuario e obrigatorio.';
  end if;

  if v_org_name is null then
    raise exception 'Nome da empresa e obrigatorio.';
  end if;

  select *
  into v_auth_user
  from auth.users
  where id = v_auth_user_id;

  if not found then
    raise exception 'Usuario de Auth nao encontrado.';
  end if;

  select id
  into v_profile_id
  from public.user_profiles
  where auth_user_id = v_auth_user_id
  limit 1;

  if v_profile_id is not null then
    return v_profile_id;
  end if;

  v_email := coalesce(
    nullif(v_auth_user.email, ''),
    nullif(v_auth_user.raw_user_meta_data->>'email', ''),
    v_auth_user_id::text || '@unyx.local'
  );

  insert into public.organizations (
    name,
    trade_name,
    document,
    segment,
    status,
    plan
  )
  values (
    v_org_name,
    nullif(trim(p_trade_name), ''),
    nullif(trim(p_document), ''),
    coalesce(p_segment, 'other'),
    'trial',
    'starter'
  )
  returning id into v_org_id;

  insert into public.branches (
    organization_id,
    name,
    city,
    state,
    address
  )
  values (
    v_org_id,
    v_branch_name,
    nullif(trim(p_city), ''),
    nullif(upper(trim(p_state)), ''),
    nullif(trim(p_address), '')
  )
  returning id into v_branch_id;

  insert into public.user_profiles (
    auth_user_id,
    organization_id,
    branch_id,
    name,
    email,
    role,
    active
  )
  values (
    v_auth_user_id,
    v_org_id,
    v_branch_id,
    v_name,
    v_email,
    'owner',
    true
  )
  returning id into v_profile_id;

  insert into public.subscriptions (
    organization_id,
    plan,
    status,
    max_branches,
    max_employees,
    trial_ends_at,
    current_period_start,
    current_period_end
  )
  values (
    v_org_id,
    'starter',
    'trial',
    1,
    30,
    now() + interval '14 days',
    now(),
    now() + interval '30 days'
  );

  insert into public.operational_settings (
    organization_id,
    branch_id,
    mode,
    late_tolerance_minutes,
    break_tolerance_minutes,
    require_cashier_cash_count,
    require_coverage_before_break,
    block_break_on_peak_hours,
    require_responsible_presence
  )
  values (
    v_org_id,
    null,
    coalesce(p_segment, 'other'),
    case coalesce(p_segment, 'other')
      when 'retail_store' then 15
      else 10
    end,
    10,
    coalesce(p_segment, 'other') = 'supermarket',
    true,
    coalesce(p_segment, 'other') = 'restaurant',
    coalesce(p_segment, 'other') = 'pharmacy'
  );

  insert into public.organization_modules (organization_id, module_id, enabled)
  select v_org_id, id, true
  from public.modules
  where active = true
  on conflict (organization_id, module_id) do nothing;

  insert into public.audit_logs (
    organization_id,
    branch_id,
    user_id,
    action,
    entity_type,
    entity_id,
    new_value
  )
  values (
    v_org_id,
    v_branch_id,
    v_profile_id,
    'complete_onboarding',
    'organization',
    v_org_id,
    jsonb_build_object('source', 'complete_current_user_onboarding')
  );

  return v_profile_id;
end;
$$;

revoke all on function public.complete_current_user_onboarding(
  text,
  text,
  text,
  text,
  public.business_segment,
  text,
  text,
  text,
  text
) from public;

grant execute on function public.complete_current_user_onboarding(
  text,
  text,
  text,
  text,
  public.business_segment,
  text,
  text,
  text,
  text
) to authenticated;

create or replace function public.update_current_user_profile(
  p_name text,
  p_email text,
  p_branch_id uuid default null
)
returns public.user_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile public.user_profiles%rowtype;
  v_previous jsonb;
  v_branch_org_id uuid;
  v_name text;
  v_email text;
begin
  if v_auth_user_id is null then
    raise exception 'Usuario autenticado nao encontrado.';
  end if;

  v_name := nullif(trim(p_name), '');
  v_email := lower(nullif(trim(p_email), ''));

  if v_name is null then
    raise exception 'Nome do usuario e obrigatorio.';
  end if;

  if v_email is null then
    raise exception 'Email do usuario e obrigatorio.';
  end if;

  select *
  into v_profile
  from public.user_profiles
  where auth_user_id = v_auth_user_id
  limit 1;

  if not found then
    raise exception 'Perfil do usuario nao encontrado.';
  end if;

  if p_branch_id is not null then
    select organization_id
    into v_branch_org_id
    from public.branches
    where id = p_branch_id
      and active = true;

    if v_branch_org_id is null or v_branch_org_id <> v_profile.organization_id then
      raise exception 'Filial invalida para este usuario.';
    end if;
  end if;

  v_previous := to_jsonb(v_profile);

  update public.user_profiles
  set
    name = v_name,
    email = v_email,
    branch_id = p_branch_id
  where id = v_profile.id
  returning * into v_profile;

  insert into public.audit_logs (
    organization_id,
    branch_id,
    user_id,
    action,
    entity_type,
    entity_id,
    old_value,
    new_value
  )
  values (
    v_profile.organization_id,
    v_profile.branch_id,
    v_profile.id,
    'current_user_profile_updated',
    'user_profiles',
    v_profile.id,
    v_previous,
    to_jsonb(v_profile)
  );

  return v_profile;
end;
$$;

revoke all on function public.update_current_user_profile(text, text, uuid) from public;
grant execute on function public.update_current_user_profile(text, text, uuid) to authenticated;

create or replace function public.update_organization_plan(
  p_plan public.subscription_plan
)
returns public.organizations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile public.user_profiles%rowtype;
  v_org public.organizations%rowtype;
  v_subscription public.subscriptions%rowtype;
  v_previous_org jsonb;
  v_previous_subscription jsonb;
  v_max_branches integer;
  v_max_employees integer;
begin
  if v_auth_user_id is null then
    raise exception 'Usuario autenticado nao encontrado.';
  end if;

  select *
  into v_profile
  from public.user_profiles
  where auth_user_id = v_auth_user_id
    and active = true
  limit 1;

  if not found then
    raise exception 'Perfil do usuario nao encontrado.';
  end if;

  if v_profile.role not in ('owner', 'admin') then
    raise exception 'Somente proprietarios e administradores podem alterar o plano.';
  end if;

  case p_plan
    when 'starter' then
      v_max_branches := 1;
      v_max_employees := 30;
    when 'growth' then
      v_max_branches := 5;
      v_max_employees := 150;
    when 'enterprise' then
      v_max_branches := 0;
      v_max_employees := 0;
  end case;

  select *
  into v_org
  from public.organizations
  where id = v_profile.organization_id
  for update;

  if not found then
    raise exception 'Organizacao nao encontrada.';
  end if;

  v_previous_org := to_jsonb(v_org);

  select *
  into v_subscription
  from public.subscriptions
  where organization_id = v_profile.organization_id
  for update;

  v_previous_subscription := case
    when found then to_jsonb(v_subscription)
    else null
  end;

  update public.organizations
  set plan = p_plan
  where id = v_profile.organization_id
  returning * into v_org;

  insert into public.subscriptions (
    organization_id,
    plan,
    status,
    max_branches,
    max_employees,
    trial_ends_at,
    current_period_start,
    current_period_end
  )
  values (
    v_profile.organization_id,
    p_plan,
    coalesce(v_subscription.status, 'trial'),
    v_max_branches,
    v_max_employees,
    coalesce(v_subscription.trial_ends_at, now() + interval '14 days'),
    coalesce(v_subscription.current_period_start, now()),
    coalesce(v_subscription.current_period_end, now() + interval '30 days')
  )
  on conflict (organization_id)
  do update set
    plan = excluded.plan,
    max_branches = excluded.max_branches,
    max_employees = excluded.max_employees,
    updated_at = now()
  returning * into v_subscription;

  insert into public.audit_logs (
    organization_id,
    branch_id,
    user_id,
    action,
    entity_type,
    entity_id,
    old_value,
    new_value
  )
  values (
    v_profile.organization_id,
    v_profile.branch_id,
    v_profile.id,
    'organization_plan_updated',
    'organizations',
    v_org.id,
    jsonb_build_object(
      'organization', v_previous_org,
      'subscription', v_previous_subscription
    ),
    jsonb_build_object(
      'organization', to_jsonb(v_org),
      'subscription', to_jsonb(v_subscription)
    )
  );

  return v_org;
end;
$$;

revoke all on function public.update_organization_plan(public.subscription_plan) from public;
grant execute on function public.update_organization_plan(public.subscription_plan) to authenticated;

create or replace function public.allocate_post(
  p_post_id uuid,
  p_employee_id uuid,
  p_schedule_id uuid default null,
  p_notes text default null
)
returns public.post_allocations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile public.user_profiles%rowtype;
  v_post public.operational_posts%rowtype;
  v_employee public.employees%rowtype;
  v_schedule public.schedules%rowtype;
  v_allocation public.post_allocations%rowtype;
begin
  if v_auth_user_id is null then
    raise exception 'Usuario autenticado nao encontrado.';
  end if;

  select * into v_profile
  from public.user_profiles
  where auth_user_id = v_auth_user_id and active = true
  limit 1;

  if not found then
    raise exception 'Perfil do usuario nao encontrado.';
  end if;

  select * into v_post
  from public.operational_posts
  where id = p_post_id
    and organization_id = v_profile.organization_id
    and active = true
  for update;

  if not found then
    raise exception 'Posto ativo nao encontrado.';
  end if;

  if not public.can_manage_branch(v_post.branch_id) then
    raise exception 'Usuario sem permissao para operar esta filial.';
  end if;

  select * into v_employee
  from public.employees
  where id = p_employee_id
    and organization_id = v_profile.organization_id
    and branch_id = v_post.branch_id
    and active = true;

  if not found then
    raise exception 'Colaborador ativo nao encontrado nesta filial.';
  end if;

  if p_schedule_id is not null then
    select * into v_schedule
    from public.schedules
    where id = p_schedule_id
      and organization_id = v_profile.organization_id;

    if not found or v_schedule.employee_id <> p_employee_id or v_schedule.branch_id <> v_post.branch_id then
      raise exception 'Escala invalida para esta alocacao.';
    end if;
  end if;

  if exists (
    select 1 from public.post_allocations
    where post_id = p_post_id
      and ended_at is null
      and status in ('alocado', 'aguardando_troca', 'em_troca')
  ) then
    raise exception 'Este posto ja possui colaborador alocado.';
  end if;

  if exists (
    select 1 from public.post_allocations
    where employee_id = p_employee_id
      and ended_at is null
      and status in ('alocado', 'aguardando_troca', 'em_troca')
  ) then
    raise exception 'Este colaborador ja esta alocado em outro posto.';
  end if;

  insert into public.post_allocations (
    organization_id,
    branch_id,
    post_id,
    employee_id,
    schedule_id,
    status,
    created_by,
    notes
  )
  values (
    v_profile.organization_id,
    v_post.branch_id,
    p_post_id,
    p_employee_id,
    p_schedule_id,
    'alocado',
    v_profile.id,
    nullif(trim(p_notes), '')
  )
  returning * into v_allocation;

  insert into public.audit_logs (
    organization_id,
    branch_id,
    user_id,
    action,
    entity_type,
    entity_id,
    old_value,
    new_value
  )
  values (
    v_profile.organization_id,
    v_post.branch_id,
    v_profile.id,
    'post_allocated',
    'post_allocations',
    v_allocation.id,
    null,
    to_jsonb(v_allocation)
  );

  return v_allocation;
end;
$$;

create or replace function public.transfer_post_allocation(
  p_allocation_id uuid,
  p_next_employee_id uuid,
  p_next_schedule_id uuid default null,
  p_notes text default null
)
returns public.post_allocations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile public.user_profiles%rowtype;
  v_previous public.post_allocations%rowtype;
  v_next public.post_allocations%rowtype;
  v_post public.operational_posts%rowtype;
  v_employee public.employees%rowtype;
  v_schedule public.schedules%rowtype;
  v_event_type public.attendance_event_type;
begin
  if v_auth_user_id is null then
    raise exception 'Usuario autenticado nao encontrado.';
  end if;

  select * into v_profile
  from public.user_profiles
  where auth_user_id = v_auth_user_id and active = true
  limit 1;

  if not found then
    raise exception 'Perfil do usuario nao encontrado.';
  end if;

  select * into v_previous
  from public.post_allocations
  where id = p_allocation_id
    and organization_id = v_profile.organization_id
    and ended_at is null
    and status in ('alocado', 'aguardando_troca', 'em_troca')
  for update;

  if not found then
    raise exception 'Alocacao ativa nao encontrada.';
  end if;

  select * into v_post
  from public.operational_posts
  where id = v_previous.post_id
  for update;

  if not public.can_manage_branch(v_previous.branch_id) then
    raise exception 'Usuario sem permissao para operar esta filial.';
  end if;

  select * into v_employee
  from public.employees
  where id = p_next_employee_id
    and organization_id = v_profile.organization_id
    and branch_id = v_previous.branch_id
    and active = true;

  if not found then
    raise exception 'Substituto ativo nao encontrado nesta filial.';
  end if;

  if p_next_employee_id = v_previous.employee_id then
    raise exception 'Escolha um substituto diferente do operador atual.';
  end if;

  if p_next_schedule_id is not null then
    select * into v_schedule
    from public.schedules
    where id = p_next_schedule_id
      and organization_id = v_profile.organization_id;

    if not found or v_schedule.employee_id <> p_next_employee_id or v_schedule.branch_id <> v_previous.branch_id then
      raise exception 'Escala invalida para o substituto.';
    end if;
  end if;

  if exists (
    select 1 from public.post_allocations
    where employee_id = p_next_employee_id
      and ended_at is null
      and status in ('alocado', 'aguardando_troca', 'em_troca')
  ) then
    raise exception 'O substituto ja esta alocado em outro posto.';
  end if;

  update public.post_allocations
  set
    ended_at = now(),
    ended_by = v_profile.id,
    status = 'finalizado'
  where id = v_previous.id;

  insert into public.post_allocations (
    organization_id,
    branch_id,
    post_id,
    employee_id,
    schedule_id,
    status,
    created_by,
    notes
  )
  values (
    v_profile.organization_id,
    v_previous.branch_id,
    v_previous.post_id,
    p_next_employee_id,
    p_next_schedule_id,
    'alocado',
    v_profile.id,
    nullif(trim(p_notes), '')
  )
  returning * into v_next;

  v_event_type := case
    when v_post.type in ('cashier', 'self_checkout') then 'troca_caixa_confirmada'::public.attendance_event_type
    else 'ocorrencia_registrada'::public.attendance_event_type
  end;

  insert into public.attendance_events (
    organization_id,
    branch_id,
    employee_id,
    schedule_id,
    event_type,
    created_by,
    notes
  )
  values (
    v_profile.organization_id,
    v_previous.branch_id,
    v_previous.employee_id,
    v_previous.schedule_id,
    v_event_type,
    v_profile.id,
    coalesce(nullif(trim(p_notes), ''), 'Troca de posto confirmada em ' || v_post.name)
  );

  insert into public.audit_logs (
    organization_id,
    branch_id,
    user_id,
    action,
    entity_type,
    entity_id,
    old_value,
    new_value
  )
  values (
    v_profile.organization_id,
    v_previous.branch_id,
    v_profile.id,
    'post_allocation_transferred',
    'post_allocations',
    v_next.id,
    to_jsonb(v_previous),
    jsonb_build_object('previous_allocation', to_jsonb(v_previous), 'next_allocation', to_jsonb(v_next))
  );

  return v_next;
end;
$$;

create or replace function public.finalize_post_allocation(
  p_allocation_id uuid,
  p_notes text default null
)
returns public.post_allocations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile public.user_profiles%rowtype;
  v_previous public.post_allocations%rowtype;
  v_allocation public.post_allocations%rowtype;
begin
  if v_auth_user_id is null then
    raise exception 'Usuario autenticado nao encontrado.';
  end if;

  select * into v_profile
  from public.user_profiles
  where auth_user_id = v_auth_user_id and active = true
  limit 1;

  if not found then
    raise exception 'Perfil do usuario nao encontrado.';
  end if;

  select * into v_previous
  from public.post_allocations
  where id = p_allocation_id
    and organization_id = v_profile.organization_id
    and ended_at is null
  for update;

  if not found then
    raise exception 'Alocacao ativa nao encontrada.';
  end if;

  if not public.can_manage_branch(v_previous.branch_id) then
    raise exception 'Usuario sem permissao para operar esta filial.';
  end if;

  update public.post_allocations
  set
    ended_at = now(),
    ended_by = v_profile.id,
    status = 'finalizado',
    notes = coalesce(nullif(trim(p_notes), ''), notes)
  where id = v_previous.id
  returning * into v_allocation;

  insert into public.audit_logs (
    organization_id,
    branch_id,
    user_id,
    action,
    entity_type,
    entity_id,
    old_value,
    new_value
  )
  values (
    v_profile.organization_id,
    v_previous.branch_id,
    v_profile.id,
    'post_allocation_finalized',
    'post_allocations',
    v_allocation.id,
    to_jsonb(v_previous),
    to_jsonb(v_allocation)
  );

  return v_allocation;
end;
$$;

create or replace function public.confirm_cash_movement(
  p_allocation_id uuid,
  p_movement_type public.cash_movement_type,
  p_notes text default null
)
returns public.cash_movements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile public.user_profiles%rowtype;
  v_allocation public.post_allocations%rowtype;
  v_post public.operational_posts%rowtype;
  v_movement public.cash_movements%rowtype;
begin
  if v_auth_user_id is null then
    raise exception 'Usuario autenticado nao encontrado.';
  end if;

  select * into v_profile
  from public.user_profiles
  where auth_user_id = v_auth_user_id and active = true
  limit 1;

  if not found then
    raise exception 'Perfil do usuario nao encontrado.';
  end if;

  select * into v_allocation
  from public.post_allocations
  where id = p_allocation_id
    and organization_id = v_profile.organization_id
    and ended_at is null
  for update;

  if not found then
    raise exception 'Alocacao ativa nao encontrada para registrar sangria.';
  end if;

  if not public.can_manage_branch(v_allocation.branch_id) then
    raise exception 'Usuario sem permissao para operar esta filial.';
  end if;

  select * into v_post
  from public.operational_posts
  where id = v_allocation.post_id;

  insert into public.cash_movements (
    organization_id,
    branch_id,
    post_id,
    employee_id,
    allocation_id,
    movement_type,
    confirmed_by,
    notes
  )
  values (
    v_profile.organization_id,
    v_allocation.branch_id,
    v_allocation.post_id,
    v_allocation.employee_id,
    v_allocation.id,
    p_movement_type,
    v_profile.id,
    nullif(trim(p_notes), '')
  )
  returning * into v_movement;

  if p_movement_type = 'sangria_confirmada' then
    insert into public.attendance_events (
      organization_id,
      branch_id,
      employee_id,
      schedule_id,
      event_type,
      created_by,
      notes
    )
    values (
      v_profile.organization_id,
      v_allocation.branch_id,
      v_allocation.employee_id,
      v_allocation.schedule_id,
      'sangria_confirmada',
      v_profile.id,
      coalesce(nullif(trim(p_notes), ''), 'Sangria confirmada em ' || v_post.name)
    );
  end if;

  insert into public.audit_logs (
    organization_id,
    branch_id,
    user_id,
    action,
    entity_type,
    entity_id,
    old_value,
    new_value
  )
  values (
    v_profile.organization_id,
    v_allocation.branch_id,
    v_profile.id,
    p_movement_type::text,
    'cash_movements',
    v_movement.id,
    null,
    to_jsonb(v_movement)
  );

  return v_movement;
end;
$$;

revoke all on function public.allocate_post(uuid, uuid, uuid, text) from public;
revoke all on function public.transfer_post_allocation(uuid, uuid, uuid, text) from public;
revoke all on function public.finalize_post_allocation(uuid, text) from public;
revoke all on function public.confirm_cash_movement(uuid, public.cash_movement_type, text) from public;

grant execute on function public.allocate_post(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.transfer_post_allocation(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.finalize_post_allocation(uuid, text) to authenticated;
grant execute on function public.confirm_cash_movement(uuid, public.cash_movement_type, text) to authenticated;

grant select, insert, update, delete on table public.operational_posts to authenticated;
grant select, insert, update, delete on table public.post_allocations to authenticated;
grant select, insert on table public.cash_movements to authenticated;

create or replace function public.record_operational_action(
  p_branch_id uuid,
  p_employee_id uuid,
  p_schedule_id uuid,
  p_event_type public.attendance_event_type,
  p_delay_minutes integer default null,
  p_notes text default null
)
returns public.attendance_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile public.user_profiles%rowtype;
  v_schedule public.schedules%rowtype;
  v_employee public.employees%rowtype;
  v_settings public.operational_settings%rowtype;
  v_current_status public.operational_status_type;
  v_next_status public.operational_status_type;
  v_next_schedule_status public.schedule_status;
  v_priority integer := 0;
  v_delay integer := 0;
  v_reason text;
  v_sector_name text;
  v_is_cashier boolean := false;
  v_allowed boolean := false;
  v_event public.attendance_events%rowtype;
  v_status public.operational_status%rowtype;
  v_previous_status jsonb;
begin
  if v_auth_user_id is null then
    raise exception 'Usuario autenticado nao encontrado.';
  end if;

  select *
  into v_profile
  from public.user_profiles
  where auth_user_id = v_auth_user_id
    and active = true
  limit 1;

  if not found then
    raise exception 'Perfil do usuario nao encontrado.';
  end if;

  if not public.can_manage_branch(p_branch_id) then
    raise exception 'Usuario sem permissao para operar esta filial.';
  end if;

  select *
  into v_schedule
  from public.schedules
  where id = p_schedule_id
    and organization_id = v_profile.organization_id
  for update;

  if not found then
    raise exception 'Escala nao encontrada.';
  end if;

  if v_schedule.branch_id <> p_branch_id or v_schedule.employee_id <> p_employee_id then
    raise exception 'Evento nao corresponde a escala informada.';
  end if;

  if v_schedule.status in ('cancelled', 'day_off') and p_event_type <> 'ocorrencia_registrada' then
    raise exception 'Esta escala nao pode receber acoes operacionais.';
  end if;

  select *
  into v_employee
  from public.employees
  where id = p_employee_id
    and organization_id = v_profile.organization_id
    and branch_id = p_branch_id
    and active = true;

  if not found then
    raise exception 'Colaborador ativo nao encontrado nesta filial.';
  end if;

  select name
  into v_sector_name
  from public.sectors
  where id = v_employee.sector_id;

  select *
  into v_settings
  from public.operational_settings
  where organization_id = v_profile.organization_id
    and (branch_id = p_branch_id or branch_id is null)
  order by case when branch_id = p_branch_id then 0 else 1 end
  limit 1;

  select os.current_status, to_jsonb(os)
  into v_current_status, v_previous_status
  from public.operational_status os
  where os.employee_id = p_employee_id
    and os.schedule_id = p_schedule_id
  for update;

  if v_current_status is null or v_current_status = 'aguardando_evento' then
    v_allowed := p_event_type in (
      'entrada_confirmada',
      'atraso_detectado',
      'falta_detectada'
    );
  elsif v_current_status in ('trabalhando', 'voltou') then
    v_allowed := p_event_type in (
      'intervalo_solicitado',
      'intervalo_iniciado',
      'atraso_detectado',
      'ocorrencia_registrada',
      'saida_confirmada'
    );
  elsif v_current_status = 'aguardando_sangria' then
    v_allowed := p_event_type in ('sangria_confirmada', 'ocorrencia_registrada');
  elsif v_current_status = 'troca_de_caixa' then
    v_allowed := p_event_type in ('troca_caixa_confirmada', 'ocorrencia_registrada');
  elsif v_current_status = 'deve_sair' then
    v_allowed := p_event_type in (
      'intervalo_iniciado',
      'saida_confirmada',
      'ocorrencia_registrada'
    );
  elsif v_current_status = 'em_intervalo' then
    v_allowed := p_event_type in ('retorno_confirmado', 'ocorrencia_registrada');
  elsif v_current_status = 'alerta_critico' then
    v_allowed := p_event_type in (
      'entrada_confirmada',
      'saida_confirmada',
      'ocorrencia_registrada'
    );
  elsif v_current_status in ('finalizado', 'folga') then
    v_allowed := p_event_type = 'ocorrencia_registrada';
  end if;

  if not v_allowed then
    raise exception 'Esta acao nao e permitida no status operacional atual.';
  end if;

  v_is_cashier := lower(coalesce(v_employee.role, '') || ' ' || coalesce(v_sector_name, '')) similar to '%(caixa|checkout|frente)%';

  if coalesce(v_settings.require_cashier_cash_count, false)
    and v_is_cashier
    and p_event_type = 'intervalo_iniciado'
    and coalesce(v_current_status, 'aguardando_evento') in ('aguardando_evento', 'trabalhando', 'voltou')
  then
    raise exception 'Confirme a sangria antes de iniciar o intervalo deste caixa.';
  end if;

  case p_event_type
    when 'entrada_confirmada' then
      v_next_status := 'trabalhando';
      v_next_schedule_status := 'working';
      v_priority := 20;
      v_reason := 'Entrada confirmada';
    when 'atraso_detectado' then
      v_next_status := 'alerta_critico';
      v_priority := 100;
      v_reason := 'Atraso detectado';
    when 'falta_detectada' then
      v_next_status := 'alerta_critico';
      v_next_schedule_status := 'absent';
      v_priority := 110;
      v_reason := 'Falta detectada';
    when 'intervalo_solicitado' then
      v_next_status := 'aguardando_sangria';
      v_priority := 80;
      v_reason := 'Intervalo solicitado';
    when 'sangria_confirmada' then
      v_next_status := 'troca_de_caixa';
      v_priority := 70;
      v_reason := 'Sangria confirmada';
    when 'troca_caixa_confirmada' then
      v_next_status := 'deve_sair';
      v_priority := 60;
      v_reason := 'Troca de caixa confirmada';
    when 'intervalo_iniciado' then
      v_next_status := 'em_intervalo';
      v_next_schedule_status := 'on_break';
      v_priority := 50;
      v_reason := 'Intervalo iniciado';
    when 'retorno_confirmado' then
      v_next_status := 'voltou';
      v_next_schedule_status := 'returned';
      v_priority := 30;
      v_reason := 'Retorno confirmado';
    when 'saida_confirmada' then
      v_next_status := 'finalizado';
      v_next_schedule_status := 'finished';
      v_priority := 5;
      v_reason := 'Saida confirmada';
    when 'ocorrencia_registrada' then
      v_next_status := 'alerta_critico';
      v_priority := 95;
      v_reason := 'Ocorrencia registrada';
  end case;

  v_delay := coalesce(
    p_delay_minutes,
    case when p_event_type = 'atraso_detectado' then 10 else 0 end
  );
  v_reason := coalesce(nullif(trim(p_notes), ''), v_reason, 'Evento operacional');

  insert into public.attendance_events (
    organization_id,
    branch_id,
    employee_id,
    schedule_id,
    event_type,
    created_by,
    notes
  )
  values (
    v_profile.organization_id,
    p_branch_id,
    p_employee_id,
    p_schedule_id,
    p_event_type,
    v_profile.id,
    nullif(trim(p_notes), '')
  )
  returning * into v_event;

  if v_next_schedule_status is not null then
    update public.schedules
    set status = v_next_schedule_status
    where id = p_schedule_id;
  end if;

  insert into public.operational_status (
    organization_id,
    branch_id,
    employee_id,
    schedule_id,
    current_status,
    priority_level,
    delay_minutes,
    status_reason,
    updated_at
  )
  values (
    v_profile.organization_id,
    p_branch_id,
    p_employee_id,
    p_schedule_id,
    v_next_status,
    v_priority,
    v_delay,
    v_reason,
    now()
  )
  on conflict (employee_id, schedule_id)
  do update set
    current_status = excluded.current_status,
    priority_level = excluded.priority_level,
    delay_minutes = excluded.delay_minutes,
    status_reason = excluded.status_reason,
    updated_at = now()
  returning * into v_status;

  insert into public.audit_logs (
    organization_id,
    branch_id,
    user_id,
    action,
    entity_type,
    entity_id,
    old_value,
    new_value
  )
  values (
    v_profile.organization_id,
    p_branch_id,
    v_profile.id,
    p_event_type::text,
    'attendance_events',
    v_event.id,
    v_previous_status,
    jsonb_build_object(
      'event', to_jsonb(v_event),
      'operational_status', to_jsonb(v_status),
      'schedule_status', v_next_schedule_status
    )
  );

  return v_event;
end;
$$;

revoke all on function public.record_operational_action(
  uuid,
  uuid,
  uuid,
  public.attendance_event_type,
  integer,
  text
) from public;

grant execute on function public.record_operational_action(
  uuid,
  uuid,
  uuid,
  public.attendance_event_type,
  integer,
  text
) to authenticated;

-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================

alter table public.organizations enable row level security;
alter table public.branches enable row level security;
alter table public.sectors enable row level security;
alter table public.user_profiles enable row level security;
alter table public.employees enable row level security;
alter table public.schedules enable row level security;
alter table public.attendance_events enable row level security;
alter table public.operational_status enable row level security;
alter table public.audit_logs enable row level security;
alter table public.modules enable row level security;
alter table public.organization_modules enable row level security;
alter table public.subscriptions enable row level security;
alter table public.operational_settings enable row level security;
alter table public.operational_posts enable row level security;
alter table public.post_allocations enable row level security;
alter table public.cash_movements enable row level security;
alter table public.comms_posts enable row level security;
alter table public.comms_post_reads enable row level security;
alter table public.comms_post_comments enable row level security;
alter table public.training_items enable row level security;
alter table public.training_progress enable row level security;

-- ORGANIZATIONS
create policy "Users can view own organization"
on public.organizations
for select
using (id = public.current_organization_id());

create policy "Org admins can update own organization"
on public.organizations
for update
using (id = public.current_organization_id() and public.is_org_admin())
with check (id = public.current_organization_id() and public.is_org_admin());

-- BRANCHES
create policy "Users can view branches from own organization"
on public.branches
for select
using (organization_id = public.current_organization_id());

create policy "Org admins can manage branches"
on public.branches
for all
using (organization_id = public.current_organization_id() and public.is_org_admin())
with check (organization_id = public.current_organization_id() and public.is_org_admin());

-- SECTORS
create policy "Users can view sectors from own organization"
on public.sectors
for select
using (organization_id = public.current_organization_id());

create policy "Managers can manage sectors from allowed branch"
on public.sectors
for all
using (
  organization_id = public.current_organization_id()
  and public.can_manage_branch(branch_id)
)
with check (
  organization_id = public.current_organization_id()
  and public.can_manage_branch(branch_id)
);

-- USER PROFILES
create policy "Users can view profiles from own organization"
on public.user_profiles
for select
using (organization_id = public.current_organization_id());

create policy "Org admins can manage profiles"
on public.user_profiles
for all
using (organization_id = public.current_organization_id() and public.is_org_admin())
with check (organization_id = public.current_organization_id() and public.is_org_admin());

-- EMPLOYEES
create policy "Users can view employees from own organization"
on public.employees
for select
using (organization_id = public.current_organization_id());

create policy "Managers can manage employees from allowed branch"
on public.employees
for all
using (
  organization_id = public.current_organization_id()
  and public.can_manage_branch(branch_id)
)
with check (
  organization_id = public.current_organization_id()
  and public.can_manage_branch(branch_id)
);

-- SCHEDULES
create policy "Users can view schedules from own organization"
on public.schedules
for select
using (organization_id = public.current_organization_id());

create policy "Managers can manage schedules from allowed branch"
on public.schedules
for all
using (
  organization_id = public.current_organization_id()
  and public.can_manage_branch(branch_id)
)
with check (
  organization_id = public.current_organization_id()
  and public.can_manage_branch(branch_id)
);

-- ATTENDANCE EVENTS
create policy "Users can view attendance events from own organization"
on public.attendance_events
for select
using (organization_id = public.current_organization_id());

create policy "Supervisors can create attendance events"
on public.attendance_events
for insert
with check (
  organization_id = public.current_organization_id()
  and public.can_manage_branch(branch_id)
);

-- OPERATIONAL STATUS
create policy "Users can view operational status from own organization"
on public.operational_status
for select
using (organization_id = public.current_organization_id());

create policy "Managers can manage operational status from allowed branch"
on public.operational_status
for all
using (
  organization_id = public.current_organization_id()
  and public.can_manage_branch(branch_id)
)
with check (
  organization_id = public.current_organization_id()
  and public.can_manage_branch(branch_id)
);

-- UNYX ALLOCATION
create policy "Users can view operational posts from own organization"
on public.operational_posts
for select
using (organization_id = public.current_organization_id());

create policy "Managers can manage operational posts from allowed branch"
on public.operational_posts
for all
using (
  organization_id = public.current_organization_id()
  and public.can_manage_branch(branch_id)
)
with check (
  organization_id = public.current_organization_id()
  and public.can_manage_branch(branch_id)
);

create policy "Users can view post allocations from own organization"
on public.post_allocations
for select
using (organization_id = public.current_organization_id());

create policy "Managers can manage post allocations from allowed branch"
on public.post_allocations
for all
using (
  organization_id = public.current_organization_id()
  and public.can_manage_branch(branch_id)
)
with check (
  organization_id = public.current_organization_id()
  and public.can_manage_branch(branch_id)
);

create policy "Users can view cash movements from own organization"
on public.cash_movements
for select
using (organization_id = public.current_organization_id());

create policy "Managers can create cash movements from allowed branch"
on public.cash_movements
for insert
with check (
  organization_id = public.current_organization_id()
  and public.can_manage_branch(branch_id)
);

-- AUDIT LOGS
create policy "Users can view audit logs from own organization"
on public.audit_logs
for select
using (organization_id = public.current_organization_id());

create policy "Authenticated users can create audit logs for own organization"
on public.audit_logs
for insert
with check (organization_id = public.current_organization_id());

-- MODULES
create policy "Authenticated users can view active modules"
on public.modules
for select
using (auth.uid() is not null and active = true);

-- ORGANIZATION MODULES
create policy "Users can view own organization modules"
on public.organization_modules
for select
using (organization_id = public.current_organization_id());

create policy "Org admins can manage own organization modules"
on public.organization_modules
for all
using (organization_id = public.current_organization_id() and public.is_org_admin())
with check (organization_id = public.current_organization_id() and public.is_org_admin());

-- UNYX COMMS
create policy "Users can view comms posts from own organization"
on public.comms_posts
for select
using (organization_id = public.current_organization_id());

create policy "Users can create comms posts for own organization"
on public.comms_posts
for insert
with check (
  organization_id = public.current_organization_id()
  and author_id = public.current_user_profile_id()
  and (branch_id is null or public.can_manage_branch(branch_id))
);

create policy "Authors and org admins can update comms posts"
on public.comms_posts
for update
using (
  organization_id = public.current_organization_id()
  and (author_id = public.current_user_profile_id() or public.is_org_admin())
)
with check (
  organization_id = public.current_organization_id()
  and (author_id = public.current_user_profile_id() or public.is_org_admin())
);

create policy "Users can view own comms reads"
on public.comms_post_reads
for select
using (user_id = public.current_user_profile_id());

create policy "Users can confirm own comms reads"
on public.comms_post_reads
for insert
with check (
  user_id = public.current_user_profile_id()
  and exists (
    select 1
    from public.comms_posts posts
    where posts.id = post_id
      and posts.organization_id = public.current_organization_id()
  )
);

create policy "Users can update own comms reads"
on public.comms_post_reads
for update
using (user_id = public.current_user_profile_id())
with check (user_id = public.current_user_profile_id());

create policy "Users can view comments on own organization posts"
on public.comms_post_comments
for select
using (
  exists (
    select 1
    from public.comms_posts posts
    where posts.id = post_id
      and posts.organization_id = public.current_organization_id()
  )
);

create policy "Users can comment on own organization posts"
on public.comms_post_comments
for insert
with check (
  user_id = public.current_user_profile_id()
  and exists (
    select 1
    from public.comms_posts posts
    where posts.id = post_id
      and posts.organization_id = public.current_organization_id()
  )
);

create policy "Users can update own comms comments"
on public.comms_post_comments
for update
using (user_id = public.current_user_profile_id())
with check (user_id = public.current_user_profile_id());

-- UNYX ACADEMY
create policy "Users can view training items from own organization"
on public.training_items
for select
using (organization_id = public.current_organization_id() and active = true);

create policy "Org admins can manage training items"
on public.training_items
for all
using (organization_id = public.current_organization_id() and public.is_org_admin())
with check (organization_id = public.current_organization_id() and public.is_org_admin());

create policy "Users can view own training progress"
on public.training_progress
for select
using (user_id = public.current_user_profile_id());

create policy "Users can set own training progress"
on public.training_progress
for insert
with check (
  user_id = public.current_user_profile_id()
  and exists (
    select 1
    from public.training_items items
    where items.id = training_id
      and items.organization_id = public.current_organization_id()
  )
);

create policy "Users can update own training progress"
on public.training_progress
for update
using (user_id = public.current_user_profile_id())
with check (user_id = public.current_user_profile_id());

-- SUBSCRIPTIONS
create policy "Org admins can view own subscription"
on public.subscriptions
for select
using (organization_id = public.current_organization_id() and public.is_org_admin());

-- OPERATIONAL SETTINGS
create policy "Users can view operational settings from own organization"
on public.operational_settings
for select
using (organization_id = public.current_organization_id());

create policy "Org admins can manage operational settings"
on public.operational_settings
for all
using (organization_id = public.current_organization_id() and public.is_org_admin())
with check (organization_id = public.current_organization_id() and public.is_org_admin());

-- =========================================================
-- VIEW DO DASHBOARD OPERACIONAL
-- =========================================================

create or replace view public.v_operational_dashboard as
select
  coalesce(os.id, sc.id) as id,
  sc.organization_id,
  sc.branch_id,
  b.name as branch_name,
  sc.employee_id,
  e.name as employee_name,
  e.role as employee_role,
  s.name as sector_name,
  sc.work_date,
  sc.start_time,
  sc.break_start,
  sc.break_end,
  sc.end_time,
  coalesce(
    os.current_status,
    case sc.status
      when 'working' then 'trabalhando'::public.operational_status_type
      when 'on_break' then 'em_intervalo'::public.operational_status_type
      when 'returned' then 'voltou'::public.operational_status_type
      when 'finished' then 'finalizado'::public.operational_status_type
      when 'absent' then 'alerta_critico'::public.operational_status_type
      when 'day_off' then 'folga'::public.operational_status_type
      else 'aguardando_evento'::public.operational_status_type
    end
  ) as current_status,
  coalesce(
    os.priority_level,
    case sc.status
      when 'absent' then 110
      when 'on_break' then 50
      else 10
    end
  ) as priority_level,
  coalesce(os.delay_minutes, 0) as delay_minutes,
  coalesce(
    os.status_reason,
    case sc.status
      when 'scheduled' then 'Aguardando primeiro evento'
      when 'working' then 'Trabalhando pela escala'
      when 'on_break' then 'Intervalo pela escala'
      when 'returned' then 'Retorno registrado na escala'
      when 'finished' then 'Turno finalizado'
      when 'absent' then 'Falta registrada na escala'
      when 'day_off' then 'Folga na escala'
      when 'cancelled' then 'Escala cancelada'
    end
  ) as status_reason,
  coalesce(os.updated_at, sc.updated_at) as updated_at
from public.schedules sc
join public.employees e on e.id = sc.employee_id
join public.branches b on b.id = sc.branch_id
left join public.sectors s on s.id = e.sector_id
left join public.operational_status os
  on os.schedule_id = sc.id
  and os.employee_id = sc.employee_id;

notify pgrst, 'reload schema';

-- =========================================================
-- RLS PARA VIEW
-- A view respeita as policies das tabelas base no Supabase quando security_invoker está disponível.
-- Em projetos novos, prefira consultar as tabelas base ou criar RPCs seguras.
-- =========================================================

-- =========================================================
-- DADOS INICIAIS OPCIONAIS
-- =========================================================

-- Este schema está pronto para:
-- 1. Criar uma organização
-- 2. Criar uma filial
-- 3. Criar setores
-- 4. Criar usuários vinculados ao auth.users
-- 5. Cadastrar colaboradores
-- 6. Cadastrar escalas
-- 7. Alimentar eventos operacionais
-- 8. Atualizar o dashboard vivo
-- 9. Auditar ações

-- FIM DO SCHEMA INICIAL
