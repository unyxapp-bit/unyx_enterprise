-- =========================================================
-- UNYX ENTERPRISE / UNYX OPS
-- Onboarding de primeiro acesso
-- =========================================================
--
-- Como usar:
-- 1. Rode este arquivo uma vez no SQL Editor do Supabase.
-- 2. Crie uma conta pelo app.
-- 3. Complete os dados iniciais no formulario de onboarding.
-- 4. O dashboard so sera liberado depois que o perfil for criado.

drop function if exists public.bootstrap_current_user_profile();

insert into public.modules (key, name, description, active)
values
  ('unyx_ops', 'Unyx Ops', 'Operacao em tempo real: dashboard, status, acoes e alertas.', true),
  ('unyx_control', 'Unyx Control', 'Estrutura, cadastros, filiais, setores, usuarios e regras operacionais.', true),
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

insert into public.organization_modules (organization_id, module_id, enabled)
select organizations.id, modules.id, true
from public.organizations
cross join public.modules
where modules.active = true
on conflict (organization_id, module_id) do nothing;

create table if not exists public.operational_settings (
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

create unique index if not exists uniq_operational_settings_org_default
on public.operational_settings(organization_id)
where branch_id is null;

create unique index if not exists uniq_operational_settings_org_branch
on public.operational_settings(organization_id, branch_id)
where branch_id is not null;

create index if not exists idx_operational_settings_organization
on public.operational_settings(organization_id);

drop trigger if exists trg_operational_settings_updated_at on public.operational_settings;
create trigger trg_operational_settings_updated_at
before update on public.operational_settings
for each row execute function public.set_updated_at();

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
select
  organizations.id,
  null,
  organizations.segment,
  case organizations.segment
    when 'retail_store' then 15
    else 10
  end,
  10,
  organizations.segment = 'supermarket',
  true,
  organizations.segment = 'restaurant',
  organizations.segment = 'pharmacy'
from public.organizations
where not exists (
  select 1
  from public.operational_settings settings
  where settings.organization_id = organizations.id
    and settings.branch_id is null
);

create table if not exists public.comms_posts (
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

create index if not exists idx_comms_posts_organization_time
on public.comms_posts(organization_id, pinned desc, created_at desc);

create index if not exists idx_comms_posts_branch
on public.comms_posts(branch_id);

create index if not exists idx_comms_posts_sector
on public.comms_posts(sector_id);

drop trigger if exists trg_comms_posts_updated_at on public.comms_posts;
create trigger trg_comms_posts_updated_at
before update on public.comms_posts
for each row execute function public.set_updated_at();

create table if not exists public.comms_post_reads (
  post_id uuid not null references public.comms_posts(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists idx_comms_post_reads_user
on public.comms_post_reads(user_id);

create table if not exists public.comms_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.comms_posts(id) on delete cascade,
  user_id uuid references public.user_profiles(id) on delete set null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_comms_post_comments_post_time
on public.comms_post_comments(post_id, created_at);

create index if not exists idx_comms_post_comments_user
on public.comms_post_comments(user_id);

drop trigger if exists trg_comms_post_comments_updated_at on public.comms_post_comments;
create trigger trg_comms_post_comments_updated_at
before update on public.comms_post_comments
for each row execute function public.set_updated_at();

create table if not exists public.training_items (
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

create index if not exists idx_training_items_organization
on public.training_items(organization_id, active);

drop trigger if exists trg_training_items_updated_at on public.training_items;
create trigger trg_training_items_updated_at
before update on public.training_items
for each row execute function public.set_updated_at();

create table if not exists public.training_progress (
  training_id uuid not null references public.training_items(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  completed boolean not null default false,
  completed_at timestamptz,
  primary key (training_id, user_id)
);

create index if not exists idx_training_progress_user
on public.training_progress(user_id);

alter table public.operational_settings enable row level security;
alter table public.comms_posts enable row level security;
alter table public.comms_post_reads enable row level security;
alter table public.comms_post_comments enable row level security;
alter table public.training_items enable row level security;
alter table public.training_progress enable row level security;

drop policy if exists "Users can view operational settings from own organization" on public.operational_settings;
create policy "Users can view operational settings from own organization"
on public.operational_settings
for select
using (organization_id = public.current_organization_id());

drop policy if exists "Org admins can manage operational settings" on public.operational_settings;
create policy "Org admins can manage operational settings"
on public.operational_settings
for all
using (organization_id = public.current_organization_id() and public.is_org_admin())
with check (organization_id = public.current_organization_id() and public.is_org_admin());

drop policy if exists "Users can view comms posts from own organization" on public.comms_posts;
create policy "Users can view comms posts from own organization"
on public.comms_posts
for select
using (organization_id = public.current_organization_id());

drop policy if exists "Users can create comms posts for own organization" on public.comms_posts;
create policy "Users can create comms posts for own organization"
on public.comms_posts
for insert
with check (
  organization_id = public.current_organization_id()
  and author_id = public.current_user_profile_id()
  and (branch_id is null or public.can_manage_branch(branch_id))
);

drop policy if exists "Authors and org admins can update comms posts" on public.comms_posts;
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

drop policy if exists "Users can view own comms reads" on public.comms_post_reads;
create policy "Users can view own comms reads"
on public.comms_post_reads
for select
using (user_id = public.current_user_profile_id());

drop policy if exists "Users can confirm own comms reads" on public.comms_post_reads;
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

drop policy if exists "Users can update own comms reads" on public.comms_post_reads;
create policy "Users can update own comms reads"
on public.comms_post_reads
for update
using (user_id = public.current_user_profile_id())
with check (user_id = public.current_user_profile_id());

drop policy if exists "Users can view comments on own organization posts" on public.comms_post_comments;
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

drop policy if exists "Users can comment on own organization posts" on public.comms_post_comments;
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

drop policy if exists "Users can update own comms comments" on public.comms_post_comments;
create policy "Users can update own comms comments"
on public.comms_post_comments
for update
using (user_id = public.current_user_profile_id())
with check (user_id = public.current_user_profile_id());

drop policy if exists "Users can view training items from own organization" on public.training_items;
create policy "Users can view training items from own organization"
on public.training_items
for select
using (organization_id = public.current_organization_id() and active = true);

drop policy if exists "Org admins can manage training items" on public.training_items;
create policy "Org admins can manage training items"
on public.training_items
for all
using (organization_id = public.current_organization_id() and public.is_org_admin())
with check (organization_id = public.current_organization_id() and public.is_org_admin());

drop policy if exists "Users can view own training progress" on public.training_progress;
create policy "Users can view own training progress"
on public.training_progress
for select
using (user_id = public.current_user_profile_id());

drop policy if exists "Users can set own training progress" on public.training_progress;
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

drop policy if exists "Users can update own training progress" on public.training_progress;
create policy "Users can update own training progress"
on public.training_progress
for update
using (user_id = public.current_user_profile_id())
with check (user_id = public.current_user_profile_id());

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
