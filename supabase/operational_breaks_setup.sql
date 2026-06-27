-- Rode este arquivo isoladamente no SQL Editor do Supabase.
-- Cria tabelas e RPCs do modulo de Liberacao Operacional.
-- É seguro rodar multiplas vezes (idempotente).

-- ─────────────────────────────────────────────
-- 1. Configuracoes de liberacao
-- ─────────────────────────────────────────────
create table if not exists public.operational_break_settings (
  id                         uuid primary key default gen_random_uuid(),
  organization_id            uuid not null references public.organizations(id) on delete cascade,
  branch_id                  uuid not null references public.branches(id) on delete cascade,
  coffee_duration_minutes    integer not null default 10 check (coffee_duration_minutes > 0),
  coffee_interval_minutes    integer not null default 10 check (coffee_interval_minutes >= 0),
  lunch_stagger_minutes      integer not null default 10 check (lunch_stagger_minutes >= 0),
  minimum_active_operators   integer not null default 4 check (minimum_active_operators >= 0),
  delay_tolerance_minutes    integer not null default 5 check (delay_tolerance_minutes >= 0),
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  unique (organization_id, branch_id)
);

create index if not exists idx_operational_break_settings_org
on public.operational_break_settings(organization_id);

create index if not exists idx_operational_break_settings_branch
on public.operational_break_settings(branch_id);

drop trigger if exists trg_operational_break_settings_updated_at on public.operational_break_settings;
create trigger trg_operational_break_settings_updated_at
before update on public.operational_break_settings
for each row execute function public.set_updated_at();

alter table public.operational_break_settings enable row level security;

drop policy if exists "operational_break_settings_select" on public.operational_break_settings;
create policy "operational_break_settings_select" on public.operational_break_settings
  for select using (organization_id = public.current_organization_id());

drop policy if exists "operational_break_settings_insert" on public.operational_break_settings;
create policy "operational_break_settings_insert" on public.operational_break_settings
  for insert with check (
    organization_id = public.current_organization_id()
    and public.can_manage_branch(branch_id)
  );

drop policy if exists "operational_break_settings_update" on public.operational_break_settings;
create policy "operational_break_settings_update" on public.operational_break_settings
  for update
  using (organization_id = public.current_organization_id() and public.can_manage_branch(branch_id))
  with check (organization_id = public.current_organization_id() and public.can_manage_branch(branch_id));

grant select, insert, update on public.operational_break_settings to authenticated;

-- ─────────────────────────────────────────────
-- 2. Historico de cafes, intervalos e retornos
-- ─────────────────────────────────────────────
create table if not exists public.operational_breaks (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id       uuid not null references public.branches(id) on delete cascade,
  employee_id     uuid not null references public.employees(id) on delete cascade,
  schedule_id     uuid references public.schedules(id) on delete set null,
  post_id         uuid references public.operational_posts(id) on delete set null,
  allocation_id   uuid references public.post_allocations(id) on delete set null,
  break_type      text not null check (break_type in ('cafe_manha', 'cafe_tarde', 'intervalo')),
  planned_start   timestamptz not null,
  planned_end     timestamptz not null,
  actual_start    timestamptz,
  actual_end      timestamptz,
  status          text not null default 'pendente' check (status in ('pendente', 'liberado', 'retornou', 'atrasado', 'cancelado')),
  released_by     uuid references public.user_profiles(id) on delete set null,
  returned_by     uuid references public.user_profiles(id) on delete set null,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_operational_breaks_org
on public.operational_breaks(organization_id);

create index if not exists idx_operational_breaks_branch_status
on public.operational_breaks(branch_id, status);

create index if not exists idx_operational_breaks_employee_time
on public.operational_breaks(employee_id, planned_start desc);

create index if not exists idx_operational_breaks_allocation
on public.operational_breaks(allocation_id);

create index if not exists idx_operational_breaks_active
on public.operational_breaks(branch_id, status)
where status in ('pendente', 'liberado', 'atrasado');

drop trigger if exists trg_operational_breaks_updated_at on public.operational_breaks;
create trigger trg_operational_breaks_updated_at
before update on public.operational_breaks
for each row execute function public.set_updated_at();

alter table public.operational_breaks enable row level security;

drop policy if exists "operational_breaks_select" on public.operational_breaks;
create policy "operational_breaks_select" on public.operational_breaks
  for select using (organization_id = public.current_organization_id());

drop policy if exists "operational_breaks_insert" on public.operational_breaks;
create policy "operational_breaks_insert" on public.operational_breaks
  for insert with check (
    organization_id = public.current_organization_id()
    and public.can_manage_branch(branch_id)
  );

drop policy if exists "operational_breaks_update" on public.operational_breaks;
create policy "operational_breaks_update" on public.operational_breaks
  for update
  using (organization_id = public.current_organization_id() and public.can_manage_branch(branch_id))
  with check (organization_id = public.current_organization_id() and public.can_manage_branch(branch_id));

grant select, insert, update on public.operational_breaks to authenticated;

-- ─────────────────────────────────────────────
-- 3. RPC: release_employee_break
-- ─────────────────────────────────────────────
create or replace function public.release_employee_break(
  p_employee_id   uuid,
  p_allocation_id uuid,
  p_post_id       uuid,
  p_schedule_id   uuid default null,
  p_break_type    text default 'intervalo',
  p_notes         text default null
)
returns public.operational_breaks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id       uuid := auth.uid();
  v_profile            public.user_profiles%rowtype;
  v_allocation         public.post_allocations%rowtype;
  v_post               public.operational_posts%rowtype;
  v_employee           public.employees%rowtype;
  v_schedule           public.schedules%rowtype;
  v_settings           public.operational_break_settings%rowtype;
  v_break              public.operational_breaks%rowtype;
  v_effective_schedule uuid;
  v_work_date          date;
  v_now                timestamptz := now();
  v_planned_start      timestamptz;
  v_planned_end        timestamptz;
  v_break_start_at     timestamptz;
  v_end_at             timestamptz;
  v_minutes_to_break   integer;
  v_minutes_to_exit    integer;
  v_available_count    integer;
  v_reason             text;
begin
  if v_auth_user_id is null then
    raise exception 'Usuario autenticado nao encontrado.';
  end if;

  if p_break_type not in ('cafe_manha', 'cafe_tarde', 'intervalo') then
    raise exception 'Tipo de liberacao invalido.';
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
    and status in ('alocado', 'aguardando_troca', 'em_troca')
  for update;

  if not found then
    raise exception 'Alocacao ativa nao encontrada.';
  end if;

  if not public.can_manage_branch(v_allocation.branch_id) then
    raise exception 'Usuario sem permissao para operar esta filial.';
  end if;

  if v_allocation.employee_id <> p_employee_id or v_allocation.post_id <> p_post_id then
    raise exception 'Colaborador, posto e alocacao nao conferem.';
  end if;

  select * into v_post
  from public.operational_posts
  where id = v_allocation.post_id
    and organization_id = v_profile.organization_id
    and branch_id = v_allocation.branch_id;

  if not found then
    raise exception 'Posto operacional nao encontrado.';
  end if;

  select * into v_employee
  from public.employees
  where id = p_employee_id
    and organization_id = v_profile.organization_id
    and branch_id = v_allocation.branch_id
    and active = true;

  if not found then
    raise exception 'Colaborador ativo nao encontrado nesta filial.';
  end if;

  v_effective_schedule := coalesce(p_schedule_id, v_allocation.schedule_id);

  if v_effective_schedule is not null then
    select * into v_schedule
    from public.schedules
    where id = v_effective_schedule
      and organization_id = v_profile.organization_id;

    if not found or v_schedule.employee_id <> p_employee_id or v_schedule.branch_id <> v_allocation.branch_id then
      raise exception 'Escala invalida para esta liberacao.';
    end if;
  end if;

  insert into public.operational_break_settings (organization_id, branch_id)
  values (v_profile.organization_id, v_allocation.branch_id)
  on conflict (organization_id, branch_id) do nothing;

  select * into v_settings
  from public.operational_break_settings
  where organization_id = v_profile.organization_id
    and branch_id = v_allocation.branch_id
  limit 1;

  if exists (
    select 1
    from public.operational_breaks ob
    where ob.organization_id = v_profile.organization_id
      and ob.employee_id = p_employee_id
      and ob.status in ('pendente', 'liberado', 'atrasado')
  ) then
    raise exception 'Este colaborador ja possui uma liberacao em andamento.';
  end if;

  if v_post.sector_id is not null and exists (
    select 1
    from public.operational_breaks ob
    join public.operational_posts op on op.id = ob.post_id
    where ob.organization_id = v_profile.organization_id
      and ob.branch_id = v_allocation.branch_id
      and ob.status in ('pendente', 'liberado', 'atrasado')
      and op.sector_id = v_post.sector_id
  ) then
    raise exception 'Ja existe uma liberacao em andamento neste setor.';
  end if;

  select count(*)::integer into v_available_count
  from public.post_allocations pa
  where pa.organization_id = v_profile.organization_id
    and pa.branch_id = v_allocation.branch_id
    and pa.ended_at is null
    and pa.status in ('alocado', 'aguardando_troca', 'em_troca')
    and not exists (
      select 1
      from public.operational_breaks ob
      where ob.allocation_id = pa.id
        and ob.status in ('pendente', 'liberado', 'atrasado')
    );

  if greatest(v_available_count - 1, 0) < v_settings.minimum_active_operators then
    raise exception 'Cobertura minima insuficiente para liberar este colaborador.';
  end if;

  if v_effective_schedule is not null then
    v_work_date := coalesce(v_schedule.work_date, current_date);

    if v_schedule.break_start is not null then
      v_break_start_at := (v_work_date + v_schedule.break_start)::timestamptz;
      if p_break_type in ('cafe_manha', 'cafe_tarde') and v_break_start_at > v_now then
        v_minutes_to_break := floor(extract(epoch from (v_break_start_at - v_now)) / 60)::integer;
        if v_minutes_to_break < 30 then
          raise exception 'Nao e permitido liberar cafe a menos de 30 minutos do intervalo.';
        end if;
      end if;
    end if;

    if v_schedule.end_time is not null then
      v_end_at := (v_work_date + v_schedule.end_time)::timestamptz;
      if v_end_at > v_now then
        v_minutes_to_exit := floor(extract(epoch from (v_end_at - v_now)) / 60)::integer;
        if v_minutes_to_exit < 30 then
          raise exception 'Nao e permitido liberar a menos de 30 minutos da saida.';
        end if;
      end if;
    end if;
  end if;

  if p_break_type = 'intervalo' and v_effective_schedule is not null and v_schedule.break_start is not null then
    v_work_date := coalesce(v_schedule.work_date, current_date);
    v_planned_start := (v_work_date + v_schedule.break_start)::timestamptz;
    v_planned_end := case
      when v_schedule.break_end is not null
        then (v_work_date + v_schedule.break_end)::timestamptz
      else v_now + make_interval(mins => greatest(v_settings.lunch_stagger_minutes, 10))
    end;
  elsif p_break_type = 'intervalo' then
    v_planned_start := v_now;
    v_planned_end := v_now + make_interval(mins => greatest(v_settings.lunch_stagger_minutes, 10));
  else
    v_planned_start := v_now;
    v_planned_end := v_now + make_interval(mins => v_settings.coffee_duration_minutes);
  end if;

  if v_planned_end <= v_planned_start then
    v_planned_end := v_planned_start + make_interval(mins => greatest(v_settings.coffee_duration_minutes, 10));
  end if;

  insert into public.operational_breaks (
    organization_id, branch_id, employee_id, schedule_id, post_id, allocation_id,
    break_type, planned_start, planned_end, actual_start, status, released_by, notes
  )
  values (
    v_profile.organization_id, v_allocation.branch_id, p_employee_id, v_effective_schedule,
    p_post_id, p_allocation_id, p_break_type, v_planned_start, v_planned_end,
    v_now, 'liberado', v_profile.id, nullif(trim(p_notes), '')
  )
  returning * into v_break;

  if p_break_type = 'intervalo' then
    update public.post_allocations
    set
      ended_at = v_now,
      ended_by = v_profile.id,
      status = 'finalizado',
      notes = nullif(
        concat_ws(
          E'\n',
          notes,
          coalesce(nullif(trim(p_notes), ''), 'Posto liberado para intervalo pelo controle PDV.')
        ),
        ''
      )
    where id = v_allocation.id;

    insert into public.audit_logs (
      organization_id, branch_id, user_id, action, entity_type, entity_id, old_value, new_value
    )
    values (
      v_profile.organization_id, v_allocation.branch_id, v_profile.id,
      'post_allocation_released_for_interval', 'post_allocations', v_allocation.id,
      to_jsonb(v_allocation),
      jsonb_build_object(
        'allocation_id', v_allocation.id,
        'break_id', v_break.id,
        'released_post_id', v_allocation.post_id,
        'released_at', v_now
      )
    );
  end if;

  v_reason := case
    when p_break_type = 'intervalo' then 'Intervalo liberado.'
    when p_break_type = 'cafe_manha' then 'Cafe da manha liberado.'
    else 'Cafe da tarde liberado.'
  end;

  if v_effective_schedule is not null then
    update public.schedules
    set
      status = 'on_break',
      notes = case
        when p_break_type in ('cafe_manha', 'cafe_tarde') then coalesce(notes, '') || ' cafe_active'
        else notes
      end
    where id = v_effective_schedule;

    insert into public.operational_status (
      organization_id, branch_id, employee_id, schedule_id,
      current_status, priority_level, delay_minutes, status_reason
    )
    values (
      v_profile.organization_id, v_allocation.branch_id, p_employee_id, v_effective_schedule,
      'em_intervalo', 2, 0, v_reason
    )
    on conflict (employee_id, schedule_id) do update
    set current_status = excluded.current_status,
        priority_level = excluded.priority_level,
        delay_minutes = excluded.delay_minutes,
        status_reason = excluded.status_reason,
        updated_at = now();
  end if;

  insert into public.attendance_events (
    organization_id, branch_id, employee_id, schedule_id, event_type, created_by, notes
  )
  values (
    v_profile.organization_id, v_allocation.branch_id, p_employee_id, v_effective_schedule,
    case when p_break_type = 'intervalo' then 'intervalo_iniciado'::public.attendance_event_type else 'ocorrencia_registrada'::public.attendance_event_type end,
    v_profile.id,
    coalesce(nullif(trim(p_notes), ''), v_reason || ' Posto: ' || v_post.name)
  );

  insert into public.audit_logs (
    organization_id, branch_id, user_id, action, entity_type, entity_id, old_value, new_value
  )
  values (
    v_profile.organization_id, v_allocation.branch_id, v_profile.id,
    'operational_break_released', 'operational_breaks', v_break.id,
    null, to_jsonb(v_break)
  );

  return v_break;
end;
$$;

-- ─────────────────────────────────────────────
-- 4. RPC: return_employee_break
-- ─────────────────────────────────────────────
create or replace function public.return_employee_break(
  p_break_id uuid,
  p_notes    text default null
)
returns public.operational_breaks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile      public.user_profiles%rowtype;
  v_previous     public.operational_breaks%rowtype;
  v_break        public.operational_breaks%rowtype;
  v_note         text;
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
  from public.operational_breaks
  where id = p_break_id
    and organization_id = v_profile.organization_id
    and status in ('pendente', 'liberado', 'atrasado')
  for update;

  if not found then
    raise exception 'Liberacao ativa nao encontrada.';
  end if;

  if not public.can_manage_branch(v_previous.branch_id) then
    raise exception 'Usuario sem permissao para operar esta filial.';
  end if;

  v_note := coalesce(nullif(trim(p_notes), ''), v_previous.notes);

  update public.operational_breaks
  set
    actual_end = now(),
    status = 'retornou',
    returned_by = v_profile.id,
    notes = v_note
  where id = v_previous.id
  returning * into v_break;

  if v_break.schedule_id is not null then
    update public.schedules
    set
      status = 'returned',
      notes = nullif(replace(coalesce(notes, ''), ' cafe_active', ''), '')
    where id = v_break.schedule_id;

    insert into public.operational_status (
      organization_id, branch_id, employee_id, schedule_id,
      current_status, priority_level, delay_minutes, status_reason
    )
    values (
      v_profile.organization_id, v_break.branch_id, v_break.employee_id, v_break.schedule_id,
      'voltou', 1, 0, 'Retorno confirmado.'
    )
    on conflict (employee_id, schedule_id) do update
    set current_status = excluded.current_status,
        priority_level = excluded.priority_level,
        delay_minutes = excluded.delay_minutes,
        status_reason = excluded.status_reason,
        updated_at = now();
  end if;

  insert into public.attendance_events (
    organization_id, branch_id, employee_id, schedule_id, event_type, created_by, notes
  )
  values (
    v_profile.organization_id, v_break.branch_id, v_break.employee_id, v_break.schedule_id,
    'retorno_confirmado', v_profile.id, coalesce(nullif(trim(p_notes), ''), 'Retorno de liberacao confirmado.')
  );

  insert into public.audit_logs (
    organization_id, branch_id, user_id, action, entity_type, entity_id, old_value, new_value
  )
  values (
    v_profile.organization_id, v_break.branch_id, v_profile.id,
    'operational_break_returned', 'operational_breaks', v_break.id,
    to_jsonb(v_previous), to_jsonb(v_break)
  );

  return v_break;
end;
$$;

-- ─────────────────────────────────────────────
-- 5. RPC: cancel_employee_break
-- ─────────────────────────────────────────────
create or replace function public.cancel_employee_break(
  p_break_id uuid,
  p_notes    text default null
)
returns public.operational_breaks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile      public.user_profiles%rowtype;
  v_previous     public.operational_breaks%rowtype;
  v_break        public.operational_breaks%rowtype;
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
  from public.operational_breaks
  where id = p_break_id
    and organization_id = v_profile.organization_id
    and status in ('pendente', 'liberado', 'atrasado')
  for update;

  if not found then
    raise exception 'Liberacao ativa nao encontrada.';
  end if;

  if not public.can_manage_branch(v_previous.branch_id) then
    raise exception 'Usuario sem permissao para operar esta filial.';
  end if;

  update public.operational_breaks
  set
    status = 'cancelado',
    actual_end = coalesce(actual_end, now()),
    returned_by = v_profile.id,
    notes = coalesce(nullif(trim(p_notes), ''), notes)
  where id = v_previous.id
  returning * into v_break;

  if v_break.schedule_id is not null then
    update public.schedules
    set
      status = 'returned',
      notes = nullif(replace(coalesce(notes, ''), ' cafe_active', ''), '')
    where id = v_break.schedule_id;

    insert into public.operational_status (
      organization_id, branch_id, employee_id, schedule_id,
      current_status, priority_level, delay_minutes, status_reason
    )
    values (
      v_profile.organization_id, v_break.branch_id, v_break.employee_id, v_break.schedule_id,
      'voltou', 1, 0, 'Liberacao cancelada.'
    )
    on conflict (employee_id, schedule_id) do update
    set current_status = excluded.current_status,
        priority_level = excluded.priority_level,
        delay_minutes = excluded.delay_minutes,
        status_reason = excluded.status_reason,
        updated_at = now();
  end if;

  insert into public.attendance_events (
    organization_id, branch_id, employee_id, schedule_id, event_type, created_by, notes
  )
  values (
    v_profile.organization_id, v_break.branch_id, v_break.employee_id, v_break.schedule_id,
    'ocorrencia_registrada', v_profile.id, coalesce(nullif(trim(p_notes), ''), 'Liberacao cancelada.')
  );

  insert into public.audit_logs (
    organization_id, branch_id, user_id, action, entity_type, entity_id, old_value, new_value
  )
  values (
    v_profile.organization_id, v_break.branch_id, v_profile.id,
    'operational_break_cancelled', 'operational_breaks', v_break.id,
    to_jsonb(v_previous), to_jsonb(v_break)
  );

  return v_break;
end;
$$;

-- ─────────────────────────────────────────────
-- 6. RPC: reschedule_employee_break
-- ─────────────────────────────────────────────
create or replace function public.reschedule_employee_break(
  p_break_id uuid,
  p_minutes  integer default 10,
  p_notes    text default null
)
returns public.operational_breaks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile      public.user_profiles%rowtype;
  v_previous     public.operational_breaks%rowtype;
  v_break        public.operational_breaks%rowtype;
  v_minutes      integer := greatest(coalesce(p_minutes, 10), 1);
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
  from public.operational_breaks
  where id = p_break_id
    and organization_id = v_profile.organization_id
    and status in ('pendente', 'liberado', 'atrasado')
  for update;

  if not found then
    raise exception 'Liberacao ativa nao encontrada.';
  end if;

  if not public.can_manage_branch(v_previous.branch_id) then
    raise exception 'Usuario sem permissao para operar esta filial.';
  end if;

  update public.operational_breaks
  set
    planned_start = planned_start + make_interval(mins => v_minutes),
    planned_end = planned_end + make_interval(mins => v_minutes),
    status = case when status = 'atrasado' then 'liberado' else status end,
    notes = coalesce(nullif(trim(p_notes), ''), notes)
  where id = v_previous.id
  returning * into v_break;

  insert into public.attendance_events (
    organization_id, branch_id, employee_id, schedule_id, event_type, created_by, notes
  )
  values (
    v_profile.organization_id, v_break.branch_id, v_break.employee_id, v_break.schedule_id,
    'ocorrencia_registrada', v_profile.id,
    coalesce(nullif(trim(p_notes), ''), 'Liberacao reagendada em ' || v_minutes::text || ' min.')
  );

  insert into public.audit_logs (
    organization_id, branch_id, user_id, action, entity_type, entity_id, old_value, new_value
  )
  values (
    v_profile.organization_id, v_break.branch_id, v_profile.id,
    'operational_break_rescheduled', 'operational_breaks', v_break.id,
    to_jsonb(v_previous), to_jsonb(v_break)
  );

  return v_break;
end;
$$;

-- ─────────────────────────────────────────────
-- 7. RPC: register_employee_break_delay
-- ─────────────────────────────────────────────
create or replace function public.register_employee_break_delay(
  p_break_id uuid,
  p_notes    text default null
)
returns public.operational_breaks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile      public.user_profiles%rowtype;
  v_previous     public.operational_breaks%rowtype;
  v_break        public.operational_breaks%rowtype;
  v_delay        integer;
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
  from public.operational_breaks
  where id = p_break_id
    and organization_id = v_profile.organization_id
    and status in ('pendente', 'liberado', 'atrasado')
  for update;

  if not found then
    raise exception 'Liberacao ativa nao encontrada.';
  end if;

  if not public.can_manage_branch(v_previous.branch_id) then
    raise exception 'Usuario sem permissao para operar esta filial.';
  end if;

  v_delay := greatest(floor(extract(epoch from (now() - v_previous.planned_end)) / 60)::integer, 0);

  update public.operational_breaks
  set
    status = 'atrasado',
    notes = coalesce(nullif(trim(p_notes), ''), notes)
  where id = v_previous.id
  returning * into v_break;

  if v_break.schedule_id is not null then
    insert into public.operational_status (
      organization_id, branch_id, employee_id, schedule_id,
      current_status, priority_level, delay_minutes, status_reason
    )
    values (
      v_profile.organization_id, v_break.branch_id, v_break.employee_id, v_break.schedule_id,
      'alerta_critico', 5, v_delay, 'Liberacao operacional em atraso.'
    )
    on conflict (employee_id, schedule_id) do update
    set current_status = excluded.current_status,
        priority_level = excluded.priority_level,
        delay_minutes = excluded.delay_minutes,
        status_reason = excluded.status_reason,
        updated_at = now();
  end if;

  insert into public.attendance_events (
    organization_id, branch_id, employee_id, schedule_id, event_type, created_by, notes
  )
  values (
    v_profile.organization_id, v_break.branch_id, v_break.employee_id, v_break.schedule_id,
    'atraso_detectado', v_profile.id, coalesce(nullif(trim(p_notes), ''), 'Atraso registrado em liberacao operacional.')
  );

  insert into public.audit_logs (
    organization_id, branch_id, user_id, action, entity_type, entity_id, old_value, new_value
  )
  values (
    v_profile.organization_id, v_break.branch_id, v_profile.id,
    'operational_break_delayed', 'operational_breaks', v_break.id,
    to_jsonb(v_previous), to_jsonb(v_break)
  );

  return v_break;
end;
$$;

-- ─────────────────────────────────────────────
-- Permissoes dos RPCs
-- ─────────────────────────────────────────────
revoke all on function public.release_employee_break(uuid, uuid, uuid, uuid, text, text) from public;
revoke all on function public.return_employee_break(uuid, text) from public;
revoke all on function public.cancel_employee_break(uuid, text) from public;
revoke all on function public.reschedule_employee_break(uuid, integer, text) from public;
revoke all on function public.register_employee_break_delay(uuid, text) from public;

grant execute on function public.release_employee_break(uuid, uuid, uuid, uuid, text, text) to authenticated;
grant execute on function public.return_employee_break(uuid, text) to authenticated;
grant execute on function public.cancel_employee_break(uuid, text) to authenticated;
grant execute on function public.reschedule_employee_break(uuid, integer, text) to authenticated;
grant execute on function public.register_employee_break_delay(uuid, text) to authenticated;

-- Recarrega o schema cache do PostgREST
notify pgrst, 'reload schema';
