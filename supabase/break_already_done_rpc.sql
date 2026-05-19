create or replace function public.record_break_already_done(
  p_branch_id uuid,
  p_employee_id uuid,
  p_schedule_id uuid,
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
  v_current_status public.operational_status_type;
  v_previous_status jsonb;
  v_event public.attendance_events%rowtype;
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

  if v_schedule.status::text in ('cancelled', 'day_off', 'banked_hours') then
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

  select os.current_status, to_jsonb(os)
  into v_current_status, v_previous_status
  from public.operational_status os
  where os.employee_id = p_employee_id
    and os.schedule_id = p_schedule_id
  for update;

  if coalesce(v_current_status, 'aguardando_evento') in ('aguardando_evento', 'finalizado', 'folga') then
    raise exception 'Confirme a entrada antes de marcar o intervalo como feito.';
  end if;

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
    'retorno_confirmado',
    v_profile.id,
    coalesce(nullif(btrim(p_notes), ''), 'Intervalo ja feito confirmado pelo gestor.')
  )
  returning * into v_event;

  update public.schedules
  set status = 'returned',
      updated_at = now()
  where id = p_schedule_id;

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
    'voltou',
    30,
    0,
    coalesce(nullif(btrim(p_notes), ''), 'Intervalo ja feito confirmado pelo gestor.'),
    now()
  )
  on conflict (employee_id, schedule_id)
  do update set
    current_status = excluded.current_status,
    priority_level = excluded.priority_level,
    delay_minutes = excluded.delay_minutes,
    status_reason = excluded.status_reason,
    updated_at = excluded.updated_at;

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
    'intervalo_ja_feito',
    'attendance_events',
    v_event.id,
    v_previous_status,
    to_jsonb(v_event)
  );

  return v_event;
end;
$$;

revoke all on function public.record_break_already_done(uuid, uuid, uuid, text) from public;
grant execute on function public.record_break_already_done(uuid, uuid, uuid, text) to authenticated;
