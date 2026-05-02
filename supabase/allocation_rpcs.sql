-- Rode este arquivo isoladamente no SQL Editor do Supabase.
-- Cria enums, tabelas e RPCs do modulo Allocation.
-- É seguro rodar multiplas vezes (idempotente).

-- ─────────────────────────────────────────────
-- 0. Enums
-- ─────────────────────────────────────────────
do $$
begin
  create type public.operational_post_type as enum (
    'cashier', 'self_checkout', 'counter', 'service_desk',
    'delivery', 'stock', 'kitchen', 'reception', 'other'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.post_allocation_status as enum (
    'alocado', 'aguardando_troca', 'em_troca', 'finalizado', 'sem_cobertura'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.cash_movement_type as enum (
    'sangria_confirmada', 'abertura_caixa', 'fechamento_caixa', 'troco_reforco'
  );
exception when duplicate_object then null;
end $$;

-- ─────────────────────────────────────────────
-- 1. Tabela operational_posts
-- ─────────────────────────────────────────────
create table if not exists public.operational_posts (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id       uuid not null references public.branches(id) on delete cascade,
  sector_id       uuid references public.sectors(id) on delete set null,
  name            text not null,
  type            public.operational_post_type not null default 'other',
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_operational_posts_organization on public.operational_posts(organization_id);
create index if not exists idx_operational_posts_branch       on public.operational_posts(branch_id);
create index if not exists idx_operational_posts_sector       on public.operational_posts(sector_id);

drop trigger if exists trg_operational_posts_updated_at on public.operational_posts;
create trigger trg_operational_posts_updated_at
before update on public.operational_posts
for each row execute function public.set_updated_at();

-- RLS
alter table public.operational_posts enable row level security;

drop policy if exists "operational_posts_select" on public.operational_posts;
create policy "operational_posts_select" on public.operational_posts
  for select using (organization_id = public.current_organization_id());

drop policy if exists "operational_posts_insert" on public.operational_posts;
create policy "operational_posts_insert" on public.operational_posts
  for insert with check (
    organization_id = public.current_organization_id()
    and public.can_manage_branch(branch_id)
  );

drop policy if exists "operational_posts_update" on public.operational_posts;
create policy "operational_posts_update" on public.operational_posts
  for update
  using (organization_id = public.current_organization_id() and public.can_manage_branch(branch_id))
  with check (organization_id = public.current_organization_id() and public.can_manage_branch(branch_id));

drop policy if exists "operational_posts_delete" on public.operational_posts;
create policy "operational_posts_delete" on public.operational_posts
  for delete using (organization_id = public.current_organization_id() and public.can_manage_branch(branch_id));

grant select, insert, update, delete on public.operational_posts to authenticated;

-- ─────────────────────────────────────────────
-- 2. Tabela post_allocations
-- ─────────────────────────────────────────────
create table if not exists public.post_allocations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id       uuid not null references public.branches(id) on delete cascade,
  post_id         uuid not null references public.operational_posts(id) on delete cascade,
  employee_id     uuid not null references public.employees(id) on delete cascade,
  schedule_id     uuid references public.schedules(id) on delete set null,
  started_at      timestamptz not null default now(),
  ended_at        timestamptz,
  status          public.post_allocation_status not null default 'alocado',
  created_by      uuid references public.user_profiles(id) on delete set null,
  ended_by        uuid references public.user_profiles(id) on delete set null,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_post_allocations_organization on public.post_allocations(organization_id);
create index if not exists idx_post_allocations_branch       on public.post_allocations(branch_id);
create index if not exists idx_post_allocations_post         on public.post_allocations(post_id);
create index if not exists idx_post_allocations_employee     on public.post_allocations(employee_id);
create index if not exists idx_post_allocations_active       on public.post_allocations(post_id, status) where ended_at is null;

create unique index if not exists uniq_post_allocations_active_post
  on public.post_allocations(post_id)
  where ended_at is null and status in ('alocado', 'aguardando_troca', 'em_troca');

create unique index if not exists uniq_post_allocations_active_employee
  on public.post_allocations(employee_id)
  where ended_at is null and status in ('alocado', 'aguardando_troca', 'em_troca');

drop trigger if exists trg_post_allocations_updated_at on public.post_allocations;
create trigger trg_post_allocations_updated_at
before update on public.post_allocations
for each row execute function public.set_updated_at();

alter table public.post_allocations enable row level security;

drop policy if exists "post_allocations_select" on public.post_allocations;
create policy "post_allocations_select" on public.post_allocations
  for select using (organization_id = public.current_organization_id());

drop policy if exists "post_allocations_insert" on public.post_allocations;
create policy "post_allocations_insert" on public.post_allocations
  for insert with check (
    organization_id = public.current_organization_id()
    and public.can_manage_branch(branch_id)
  );

drop policy if exists "post_allocations_update" on public.post_allocations;
create policy "post_allocations_update" on public.post_allocations
  for update
  using (organization_id = public.current_organization_id() and public.can_manage_branch(branch_id))
  with check (organization_id = public.current_organization_id() and public.can_manage_branch(branch_id));

grant select, insert, update on public.post_allocations to authenticated;

-- ─────────────────────────────────────────────
-- 3. Tabela cash_movements
-- ─────────────────────────────────────────────
create table if not exists public.cash_movements (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id       uuid not null references public.branches(id) on delete cascade,
  post_id         uuid not null references public.operational_posts(id) on delete cascade,
  employee_id     uuid not null references public.employees(id) on delete cascade,
  allocation_id   uuid references public.post_allocations(id) on delete set null,
  movement_type   public.cash_movement_type not null,
  confirmed_at    timestamptz not null default now(),
  confirmed_by    uuid references public.user_profiles(id) on delete set null,
  notes           text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_cash_movements_organization on public.cash_movements(organization_id);
create index if not exists idx_cash_movements_branch       on public.cash_movements(branch_id);
create index if not exists idx_cash_movements_post         on public.cash_movements(post_id);
create index if not exists idx_cash_movements_employee     on public.cash_movements(employee_id);
create index if not exists idx_cash_movements_time         on public.cash_movements(confirmed_at desc);

alter table public.cash_movements enable row level security;

drop policy if exists "cash_movements_select" on public.cash_movements;
create policy "cash_movements_select" on public.cash_movements
  for select using (organization_id = public.current_organization_id());

drop policy if exists "cash_movements_insert" on public.cash_movements;
create policy "cash_movements_insert" on public.cash_movements
  for insert with check (
    organization_id = public.current_organization_id()
    and public.can_manage_branch(branch_id)
  );

grant select, insert on public.cash_movements to authenticated;

-- ─────────────────────────────────────────────
-- 4. RPC: create_operational_post
-- ─────────────────────────────────────────────
create or replace function public.create_operational_post(
  p_branch_id  uuid,
  p_name       text,
  p_type       public.operational_post_type default 'other',
  p_sector_id  uuid    default null,
  p_active     boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id  uuid;
  v_user_id uuid;
  v_post_id uuid;
begin
  select id, organization_id into v_user_id, v_org_id
  from public.user_profiles
  where auth_user_id = auth.uid() and active = true
  limit 1;

  if v_user_id is null then
    raise exception 'Perfil do usuario nao encontrado.';
  end if;

  if not public.can_manage_branch(p_branch_id) then
    raise exception 'Usuario sem permissao para operar esta filial.';
  end if;

  if not exists (
    select 1 from public.branches
    where id = p_branch_id and organization_id = v_org_id and active = true
  ) then
    raise exception 'Filial invalida ou inativa.';
  end if;

  if p_sector_id is not null and not exists (
    select 1 from public.sectors
    where id = p_sector_id and branch_id = p_branch_id
      and organization_id = v_org_id and active = true
  ) then
    raise exception 'Setor invalido para esta filial.';
  end if;

  if nullif(trim(p_name), '') is null then
    raise exception 'Informe o nome do posto.';
  end if;

  insert into public.operational_posts (organization_id, branch_id, sector_id, name, type, active)
  values (v_org_id, p_branch_id, p_sector_id, trim(p_name), p_type, p_active)
  returning id into v_post_id;

  insert into public.audit_logs (organization_id, branch_id, user_id, action, entity_type, entity_id, new_value)
  values (v_org_id, p_branch_id, v_user_id, 'operational_post_created', 'operational_posts', v_post_id,
          jsonb_build_object('name', p_name, 'type', p_type));

  return v_post_id;
end;
$$;

-- ─────────────────────────────────────────────
-- 5. RPC: update_operational_post_record
-- ─────────────────────────────────────────────
create or replace function public.update_operational_post_record(
  p_post_id      uuid,
  p_name         text    default null,
  p_type         public.operational_post_type default null,
  p_sector_id    uuid    default null,
  p_active       boolean default null,
  p_clear_sector boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id     uuid;
  v_user_id    uuid;
  v_branch_id  uuid;
begin
  select id, organization_id into v_user_id, v_org_id
  from public.user_profiles
  where auth_user_id = auth.uid() and active = true
  limit 1;

  if v_user_id is null then
    raise exception 'Perfil do usuario nao encontrado.';
  end if;

  select branch_id into v_branch_id
  from public.operational_posts
  where id = p_post_id and organization_id = v_org_id
  for update;

  if not found then
    raise exception 'Posto operacional nao encontrado.';
  end if;

  if not public.can_manage_branch(v_branch_id) then
    raise exception 'Usuario sem permissao para operar esta filial.';
  end if;

  if p_sector_id is not null and not exists (
    select 1 from public.sectors
    where id = p_sector_id and branch_id = v_branch_id
      and organization_id = v_org_id and active = true
  ) then
    raise exception 'Setor invalido para esta filial.';
  end if;

  update public.operational_posts
  set
    name = coalesce(nullif(trim(p_name), ''), name),
    type = coalesce(p_type, type),
    sector_id = case
      when p_clear_sector = true then null
      when p_sector_id is not null then p_sector_id
      else sector_id
    end,
    active = coalesce(p_active, active)
  where id = p_post_id;

  insert into public.audit_logs (organization_id, branch_id, user_id, action, entity_type, entity_id, new_value)
  values (v_org_id, v_branch_id, v_user_id, 'operational_post_updated', 'operational_posts', p_post_id,
          jsonb_build_object('name', p_name, 'type', p_type, 'active', p_active));

  return true;
end;
$$;

-- ─────────────────────────────────────────────
-- 6. RPC: setup_segment_defaults
-- ─────────────────────────────────────────────
create or replace function public.setup_segment_defaults(
  p_branch_id        uuid,
  p_sector_names     text[],
  p_post_definitions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id          uuid;
  v_user_id         uuid;
  v_sector_name     text;
  v_sector_id       uuid;
  v_sectors_created integer := 0;
  v_posts_created   integer := 0;
  v_post            jsonb;
  v_sector_id_map   jsonb   := '{}';
  v_post_sector_key text;
  v_post_sector_id  uuid;
  v_post_name       text;
  v_post_type       public.operational_post_type;
begin
  select id, organization_id into v_user_id, v_org_id
  from public.user_profiles
  where auth_user_id = auth.uid() and active = true
  limit 1;

  if v_user_id is null then
    raise exception 'Perfil do usuario nao encontrado.';
  end if;

  if not public.can_manage_branch(p_branch_id) then
    raise exception 'Usuario sem permissao para operar esta filial.';
  end if;

  foreach v_sector_name in array p_sector_names loop
    if not exists (
      select 1 from public.sectors
      where branch_id = p_branch_id and organization_id = v_org_id
        and lower(name) = lower(v_sector_name)
    ) then
      insert into public.sectors (organization_id, branch_id, name, active)
      values (v_org_id, p_branch_id, v_sector_name, true)
      returning id into v_sector_id;
      v_sectors_created := v_sectors_created + 1;
    else
      select id into v_sector_id
      from public.sectors
      where branch_id = p_branch_id and organization_id = v_org_id
        and lower(name) = lower(v_sector_name)
      limit 1;
    end if;
    v_sector_id_map := jsonb_set(v_sector_id_map, array[lower(v_sector_name)], to_jsonb(v_sector_id::text));
  end loop;

  for v_post in select * from jsonb_array_elements(p_post_definitions) loop
    v_post_name       := v_post->>'name';
    v_post_type       := (v_post->>'type')::public.operational_post_type;
    v_post_sector_key := lower(v_post->>'sector_name');
    v_post_sector_id  := null;

    if v_post_sector_key is not null and v_sector_id_map ? v_post_sector_key then
      v_post_sector_id := (v_sector_id_map->v_post_sector_key)::uuid;
    end if;

    if not exists (
      select 1 from public.operational_posts
      where branch_id = p_branch_id and organization_id = v_org_id
        and lower(name) = lower(v_post_name)
    ) then
      insert into public.operational_posts (organization_id, branch_id, sector_id, name, type, active)
      values (v_org_id, p_branch_id, v_post_sector_id, v_post_name, v_post_type, true);
      v_posts_created := v_posts_created + 1;
    end if;
  end loop;

  return jsonb_build_object('sectors_created', v_sectors_created, 'posts_created', v_posts_created);
end;
$$;

-- ─────────────────────────────────────────────
-- 7. RPC: allocate_post
-- ─────────────────────────────────────────────
create or replace function public.allocate_post(
  p_post_id     uuid,
  p_employee_id uuid,
  p_schedule_id uuid default null,
  p_notes       text default null
)
returns public.post_allocations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile    public.user_profiles%rowtype;
  v_post       public.operational_posts%rowtype;
  v_employee   public.employees%rowtype;
  v_schedule   public.schedules%rowtype;
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
    organization_id, branch_id, post_id, employee_id,
    schedule_id, status, created_by, notes
  )
  values (
    v_profile.organization_id, v_post.branch_id, p_post_id, p_employee_id,
    p_schedule_id, 'alocado', v_profile.id, nullif(trim(p_notes), '')
  )
  returning * into v_allocation;

  insert into public.audit_logs (
    organization_id, branch_id, user_id, action, entity_type, entity_id, old_value, new_value
  )
  values (
    v_profile.organization_id, v_post.branch_id, v_profile.id,
    'post_allocated', 'post_allocations', v_allocation.id,
    null, to_jsonb(v_allocation)
  );

  return v_allocation;
end;
$$;

-- ─────────────────────────────────────────────
-- 8. RPC: transfer_post_allocation
-- ─────────────────────────────────────────────
create or replace function public.transfer_post_allocation(
  p_allocation_id    uuid,
  p_next_employee_id uuid,
  p_next_schedule_id uuid default null,
  p_notes            text default null
)
returns public.post_allocations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile    public.user_profiles%rowtype;
  v_previous   public.post_allocations%rowtype;
  v_next       public.post_allocations%rowtype;
  v_post       public.operational_posts%rowtype;
  v_employee   public.employees%rowtype;
  v_schedule   public.schedules%rowtype;
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
  set ended_at = now(), ended_by = v_profile.id, status = 'finalizado'
  where id = v_previous.id;

  insert into public.post_allocations (
    organization_id, branch_id, post_id, employee_id,
    schedule_id, status, created_by, notes
  )
  values (
    v_profile.organization_id, v_previous.branch_id, v_previous.post_id, p_next_employee_id,
    p_next_schedule_id, 'alocado', v_profile.id, nullif(trim(p_notes), '')
  )
  returning * into v_next;

  v_event_type := case
    when v_post.type in ('cashier', 'self_checkout') then 'troca_caixa_confirmada'::public.attendance_event_type
    else 'ocorrencia_registrada'::public.attendance_event_type
  end;

  insert into public.attendance_events (
    organization_id, branch_id, employee_id, schedule_id, event_type, created_by, notes
  )
  values (
    v_profile.organization_id, v_previous.branch_id, v_previous.employee_id,
    v_previous.schedule_id, v_event_type, v_profile.id,
    coalesce(nullif(trim(p_notes), ''), 'Troca de posto confirmada em ' || v_post.name)
  );

  insert into public.audit_logs (
    organization_id, branch_id, user_id, action, entity_type, entity_id, old_value, new_value
  )
  values (
    v_profile.organization_id, v_previous.branch_id, v_profile.id,
    'post_allocation_transferred', 'post_allocations', v_next.id,
    to_jsonb(v_previous),
    jsonb_build_object('previous_allocation', to_jsonb(v_previous), 'next_allocation', to_jsonb(v_next))
  );

  return v_next;
end;
$$;

-- ─────────────────────────────────────────────
-- 9. RPC: finalize_post_allocation
-- ─────────────────────────────────────────────
create or replace function public.finalize_post_allocation(
  p_allocation_id uuid,
  p_notes         text default null
)
returns public.post_allocations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile    public.user_profiles%rowtype;
  v_previous   public.post_allocations%rowtype;
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
    organization_id, branch_id, user_id, action, entity_type, entity_id, old_value, new_value
  )
  values (
    v_profile.organization_id, v_previous.branch_id, v_profile.id,
    'post_allocation_finalized', 'post_allocations', v_allocation.id,
    to_jsonb(v_previous), to_jsonb(v_allocation)
  );

  return v_allocation;
end;
$$;

-- ─────────────────────────────────────────────
-- 10. RPC: confirm_cash_movement
-- ─────────────────────────────────────────────
create or replace function public.confirm_cash_movement(
  p_allocation_id uuid,
  p_movement_type public.cash_movement_type,
  p_notes         text default null
)
returns public.cash_movements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile    public.user_profiles%rowtype;
  v_allocation public.post_allocations%rowtype;
  v_post       public.operational_posts%rowtype;
  v_movement   public.cash_movements%rowtype;
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
    organization_id, branch_id, post_id, employee_id,
    allocation_id, movement_type, confirmed_by, notes
  )
  values (
    v_profile.organization_id, v_allocation.branch_id, v_allocation.post_id, v_allocation.employee_id,
    v_allocation.id, p_movement_type, v_profile.id, nullif(trim(p_notes), '')
  )
  returning * into v_movement;

  if p_movement_type = 'sangria_confirmada' then
    insert into public.attendance_events (
      organization_id, branch_id, employee_id, schedule_id, event_type, created_by, notes
    )
    values (
      v_profile.organization_id, v_allocation.branch_id, v_allocation.employee_id,
      v_allocation.schedule_id, 'sangria_confirmada', v_profile.id,
      coalesce(nullif(trim(p_notes), ''), 'Sangria confirmada em ' || v_post.name)
    );
  end if;

  insert into public.audit_logs (
    organization_id, branch_id, user_id, action, entity_type, entity_id, old_value, new_value
  )
  values (
    v_profile.organization_id, v_allocation.branch_id, v_profile.id,
    p_movement_type::text, 'cash_movements', v_movement.id,
    null, to_jsonb(v_movement)
  );

  return v_movement;
end;
$$;

-- ─────────────────────────────────────────────
-- Permissões dos RPCs
-- ─────────────────────────────────────────────
revoke all on function public.create_operational_post(uuid, text, public.operational_post_type, uuid, boolean) from public;
revoke all on function public.update_operational_post_record(uuid, text, public.operational_post_type, uuid, boolean, boolean) from public;
revoke all on function public.setup_segment_defaults(uuid, text[], jsonb) from public;
revoke all on function public.allocate_post(uuid, uuid, uuid, text) from public;
revoke all on function public.transfer_post_allocation(uuid, uuid, uuid, text) from public;
revoke all on function public.finalize_post_allocation(uuid, text) from public;
revoke all on function public.confirm_cash_movement(uuid, public.cash_movement_type, text) from public;

grant execute on function public.create_operational_post(uuid, text, public.operational_post_type, uuid, boolean) to authenticated;
grant execute on function public.update_operational_post_record(uuid, text, public.operational_post_type, uuid, boolean, boolean) to authenticated;
grant execute on function public.setup_segment_defaults(uuid, text[], jsonb) to authenticated;
grant execute on function public.allocate_post(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.transfer_post_allocation(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.finalize_post_allocation(uuid, text) to authenticated;
grant execute on function public.confirm_cash_movement(uuid, public.cash_movement_type, text) to authenticated;

-- Recarrega o schema cache do PostgREST
notify pgrst, 'reload schema';
