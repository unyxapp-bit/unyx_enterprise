-- Unyx Front Store Support
-- Modulos: Anotacoes, Formularios e Cartazes
-- Rode este arquivo no SQL Editor do Supabase depois do onboarding_first_access.sql.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

insert into public.modules (key, name, description, active)
values
  ('unyx_front_notes', 'Unyx Anotacoes', 'Anotacoes, pendencias e ocorrencias para fiscais de frente de loja.', true),
  ('unyx_front_forms', 'Unyx Formularios', 'Formularios operacionais para rondas, conferencias e coletas rapidas.', true),
  ('unyx_front_posters', 'Unyx Cartazes', 'Criacao e impressao de cartazes e avisos internos de loja.', true)
on conflict (key) do update
set
  name = excluded.name,
  description = excluded.description,
  active = excluded.active;

insert into public.organization_modules (organization_id, module_id, enabled)
select organizations.id, modules.id, true
from public.organizations
join public.modules on modules.key in (
  'unyx_front_notes',
  'unyx_front_forms',
  'unyx_front_posters'
)
on conflict (organization_id, module_id) do nothing;

create table if not exists public.operational_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  sector_id uuid references public.sectors(id) on delete set null,
  created_by uuid references public.user_profiles(id) on delete set null,
  title text not null,
  content text not null,
  category text,
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'open'
    check (status in ('open', 'in_review', 'resolved', 'archived')),
  due_at timestamptz,
  resolved_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.operational_forms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  sector_id uuid references public.sectors(id) on delete set null,
  created_by uuid references public.user_profiles(id) on delete set null,
  title text not null,
  description text,
  category text,
  questions text[] not null default array[]::text[],
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.operational_form_responses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  form_id uuid not null references public.operational_forms(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  user_id uuid references public.user_profiles(id) on delete set null,
  answers jsonb not null default '{}'::jsonb,
  notes text,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.operational_posters (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  sector_id uuid references public.sectors(id) on delete set null,
  created_by uuid references public.user_profiles(id) on delete set null,
  title text not null,
  subtitle text,
  body text not null,
  footer text,
  template_key text,
  product_name text,
  product_description text,
  price_text text,
  sale_unit text,
  product_name_size integer not null default 32,
  description_size integer not null default 18,
  price_size integer not null default 72,
  sale_unit_size integer not null default 18,
  tone text not null default 'attention'
    check (tone in ('neutral', 'info', 'attention', 'urgent', 'success')),
  format text not null default 'a4'
    check (format in ('a2', 'a3', 'a4', 'a5', 'a6', 'thermal')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.operational_posters
  add column if not exists template_key text,
  add column if not exists product_name text,
  add column if not exists product_description text,
  add column if not exists price_text text,
  add column if not exists sale_unit text,
  add column if not exists product_name_size integer not null default 32,
  add column if not exists description_size integer not null default 18,
  add column if not exists price_size integer not null default 72,
  add column if not exists sale_unit_size integer not null default 18;

alter table public.operational_posters
  drop constraint if exists operational_posters_format_check;

alter table public.operational_posters
  add constraint operational_posters_format_check
  check (format in ('a2', 'a3', 'a4', 'a5', 'a6', 'thermal'));

create index if not exists idx_operational_notes_org_time
on public.operational_notes(organization_id, active, created_at desc);

create index if not exists idx_operational_notes_branch_status
on public.operational_notes(branch_id, status, priority, created_at desc);

create index if not exists idx_operational_forms_org_time
on public.operational_forms(organization_id, active, created_at desc);

create index if not exists idx_operational_forms_branch
on public.operational_forms(branch_id);

create index if not exists idx_operational_form_responses_org_time
on public.operational_form_responses(organization_id, submitted_at desc);

create index if not exists idx_operational_form_responses_form_time
on public.operational_form_responses(form_id, submitted_at desc);

create index if not exists idx_operational_posters_org_time
on public.operational_posters(organization_id, active, created_at desc);

create index if not exists idx_operational_posters_branch
on public.operational_posters(branch_id);

drop trigger if exists trg_operational_notes_updated_at on public.operational_notes;
create trigger trg_operational_notes_updated_at
before update on public.operational_notes
for each row execute function public.set_updated_at();

drop trigger if exists trg_operational_forms_updated_at on public.operational_forms;
create trigger trg_operational_forms_updated_at
before update on public.operational_forms
for each row execute function public.set_updated_at();

drop trigger if exists trg_operational_posters_updated_at on public.operational_posters;
create trigger trg_operational_posters_updated_at
before update on public.operational_posters
for each row execute function public.set_updated_at();

alter table public.operational_notes enable row level security;
alter table public.operational_forms enable row level security;
alter table public.operational_form_responses enable row level security;
alter table public.operational_posters enable row level security;

drop policy if exists "Users can view operational notes" on public.operational_notes;
create policy "Users can view operational notes"
on public.operational_notes
for select
using (organization_id = public.current_organization_id() and active = true);

drop policy if exists "Users can manage operational notes" on public.operational_notes;
create policy "Users can manage operational notes"
on public.operational_notes
for all
using (
  organization_id = public.current_organization_id()
  and public.current_user_role() in ('owner', 'admin', 'branch_manager', 'supervisor', 'operator')
  and (
    public.is_org_admin()
    or created_by = public.current_user_profile_id()
    or (branch_id is not null and public.can_manage_branch(branch_id))
  )
)
with check (
  organization_id = public.current_organization_id()
  and public.current_user_role() in ('owner', 'admin', 'branch_manager', 'supervisor', 'operator')
  and (
    public.is_org_admin()
    or (branch_id is not null and public.can_manage_branch(branch_id))
  )
);

drop policy if exists "Users can view operational forms" on public.operational_forms;
create policy "Users can view operational forms"
on public.operational_forms
for select
using (organization_id = public.current_organization_id() and active = true);

drop policy if exists "Users can manage operational forms" on public.operational_forms;
create policy "Users can manage operational forms"
on public.operational_forms
for all
using (
  organization_id = public.current_organization_id()
  and public.current_user_role() in ('owner', 'admin', 'branch_manager', 'supervisor', 'operator')
  and (
    public.is_org_admin()
    or created_by = public.current_user_profile_id()
    or (branch_id is not null and public.can_manage_branch(branch_id))
  )
)
with check (
  organization_id = public.current_organization_id()
  and public.current_user_role() in ('owner', 'admin', 'branch_manager', 'supervisor', 'operator')
  and (
    public.is_org_admin()
    or (branch_id is not null and public.can_manage_branch(branch_id))
  )
);

drop policy if exists "Users can view operational form responses" on public.operational_form_responses;
create policy "Users can view operational form responses"
on public.operational_form_responses
for select
using (organization_id = public.current_organization_id());

drop policy if exists "Users can submit operational form responses" on public.operational_form_responses;
create policy "Users can submit operational form responses"
on public.operational_form_responses
for insert
with check (
  organization_id = public.current_organization_id()
  and user_id = public.current_user_profile_id()
  and public.current_user_role() in ('owner', 'admin', 'branch_manager', 'supervisor', 'operator')
  and (
    branch_id is null
    or branch_id = public.current_branch_id()
    or public.can_manage_branch(branch_id)
  )
  and exists (
    select 1
    from public.operational_forms forms
    where forms.id = form_id
      and forms.organization_id = public.current_organization_id()
      and forms.active = true
  )
);

drop policy if exists "Users can view operational posters" on public.operational_posters;
create policy "Users can view operational posters"
on public.operational_posters
for select
using (organization_id = public.current_organization_id() and active = true);

drop policy if exists "Managers can manage operational posters" on public.operational_posters;
create policy "Managers can manage operational posters"
on public.operational_posters
for all
using (
  organization_id = public.current_organization_id()
  and public.current_user_role() in ('owner', 'admin', 'branch_manager', 'supervisor')
  and (
    public.is_org_admin()
    or created_by = public.current_user_profile_id()
    or (branch_id is not null and public.can_manage_branch(branch_id))
  )
)
with check (
  organization_id = public.current_organization_id()
  and public.current_user_role() in ('owner', 'admin', 'branch_manager', 'supervisor')
  and (
    public.is_org_admin()
    or (branch_id is not null and public.can_manage_branch(branch_id))
  )
);

grant select, insert, update, delete on public.operational_notes to authenticated;
grant select, insert, update, delete on public.operational_forms to authenticated;
grant select, insert on public.operational_form_responses to authenticated;
grant select, insert, update, delete on public.operational_posters to authenticated;

notify pgrst, 'reload schema';
