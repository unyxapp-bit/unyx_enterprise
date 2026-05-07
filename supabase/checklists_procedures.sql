-- Unyx Checklists e Procedimentos
-- Rode este arquivo no SQL Editor do Supabase depois do onboarding_first_access.sql.

insert into public.modules (key, name, description, active)
values (
  'unyx_checklists',
  'Unyx Checklists',
  'Procedimentos operacionais, checklists executaveis, evidencias e historico de conclusao.',
  true
)
on conflict (key) do update
set
  name = excluded.name,
  description = excluded.description,
  active = excluded.active;

insert into public.organization_modules (organization_id, module_id, enabled)
select organizations.id, modules.id, true
from public.organizations
join public.modules on modules.key = 'unyx_checklists'
on conflict (organization_id, module_id) do nothing;

create table if not exists public.checklist_procedures (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  sector_id uuid references public.sectors(id) on delete set null,
  created_by uuid references public.user_profiles(id) on delete set null,
  title text not null,
  category text,
  frequency text not null default 'daily'
    check (frequency in ('daily', 'weekly', 'monthly', 'on_demand')),
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes > 0),
  owner_role text,
  instructions text,
  checklist_items text[] not null default array[]::text[],
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_checklist_procedures_organization
on public.checklist_procedures(organization_id, active, created_at desc);

create index if not exists idx_checklist_procedures_branch
on public.checklist_procedures(branch_id);

create index if not exists idx_checklist_procedures_sector
on public.checklist_procedures(sector_id);

drop trigger if exists trg_checklist_procedures_updated_at on public.checklist_procedures;
create trigger trg_checklist_procedures_updated_at
before update on public.checklist_procedures
for each row execute function public.set_updated_at();

create table if not exists public.checklist_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  procedure_id uuid not null references public.checklist_procedures(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  user_id uuid references public.user_profiles(id) on delete set null,
  status text not null default 'completed'
    check (status in ('in_progress', 'completed')),
  checked_items text[] not null default array[]::text[],
  notes text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_checklist_runs_organization_time
on public.checklist_runs(organization_id, created_at desc);

create index if not exists idx_checklist_runs_procedure_time
on public.checklist_runs(procedure_id, created_at desc);

create index if not exists idx_checklist_runs_branch_time
on public.checklist_runs(branch_id, created_at desc);

create index if not exists idx_checklist_runs_user_time
on public.checklist_runs(user_id, created_at desc);

drop trigger if exists trg_checklist_runs_updated_at on public.checklist_runs;
create trigger trg_checklist_runs_updated_at
before update on public.checklist_runs
for each row execute function public.set_updated_at();

alter table public.checklist_procedures enable row level security;
alter table public.checklist_runs enable row level security;

drop policy if exists "Users can view checklist procedures from own organization"
on public.checklist_procedures;
create policy "Users can view checklist procedures from own organization"
on public.checklist_procedures
for select
using (organization_id = public.current_organization_id() and active = true);

drop policy if exists "Managers can manage checklist procedures"
on public.checklist_procedures;
create policy "Managers can manage checklist procedures"
on public.checklist_procedures
for all
using (
  organization_id = public.current_organization_id()
  and (
    public.is_org_admin()
    or created_by = public.current_user_profile_id()
    or (branch_id is not null and public.can_manage_branch(branch_id))
  )
)
with check (
  organization_id = public.current_organization_id()
  and created_by = public.current_user_profile_id()
  and (
    public.is_org_admin()
    or (branch_id is not null and public.can_manage_branch(branch_id))
  )
);

drop policy if exists "Users can view checklist runs from own organization"
on public.checklist_runs;
create policy "Users can view checklist runs from own organization"
on public.checklist_runs
for select
using (organization_id = public.current_organization_id());

drop policy if exists "Users can create checklist runs"
on public.checklist_runs;
create policy "Users can create checklist runs"
on public.checklist_runs
for insert
with check (
  organization_id = public.current_organization_id()
  and user_id = public.current_user_profile_id()
  and (
    branch_id is null
    or branch_id = public.current_branch_id()
    or public.can_manage_branch(branch_id)
  )
  and exists (
    select 1
    from public.checklist_procedures procedures
    where procedures.id = procedure_id
      and procedures.organization_id = public.current_organization_id()
      and procedures.active = true
  )
);

drop policy if exists "Users can update own checklist runs"
on public.checklist_runs;
create policy "Users can update own checklist runs"
on public.checklist_runs
for update
using (user_id = public.current_user_profile_id())
with check (user_id = public.current_user_profile_id());
