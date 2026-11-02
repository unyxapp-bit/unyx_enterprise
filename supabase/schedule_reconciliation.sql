-- Conferência conforme a escala + correção retroativa.
--
-- Problema: o fiscal nem sempre está na loja para registrar chegada, intervalo, retorno e saída na hora.
-- Solução: o app chama reconcile_schedules_by_scale() ao abrir o Mapa/Controle PDV. Tudo o que a escala
-- previa e já passou, e que ninguém registrou, é gravado NO HORÁRIO DA ESCALA e marcado com
-- source = 'escala'. Quem tiver um caso diferente (atraso, falta, saída antecipada, hora extra) corrige
-- na tela "Conferência", que chama correct_schedule_attendance() e grava os horários reais com
-- source = 'retroativo'. Registros feitos na hora continuam com source = 'manual' e nunca são alterados.
--
-- Seguro rodar mais de uma vez. Rode no SQL Editor do Supabase.

-- ─────────────────────────────────────────────
-- 1. Origem dos registros e trava de conferência
-- ─────────────────────────────────────────────
alter table public.attendance_events
  add column if not exists source text not null default 'manual';
alter table public.operational_breaks
  add column if not exists source text not null default 'manual';
alter table public.schedules
  add column if not exists scale_confirmation_locked boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'attendance_events_source_check') then
    alter table public.attendance_events
      add constraint attendance_events_source_check
      check (source in ('manual', 'escala', 'retroativo'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'operational_breaks_source_check') then
    alter table public.operational_breaks
      add constraint operational_breaks_source_check
      check (source in ('manual', 'escala', 'retroativo'));
  end if;
end $$;

create index if not exists idx_attendance_events_schedule
  on public.attendance_events(schedule_id);
create index if not exists idx_operational_breaks_schedule
  on public.operational_breaks(schedule_id);

-- ─────────────────────────────────────────────
-- 2. Auxiliares
-- ─────────────────────────────────────────────
-- Data + hora da escala no fuso informado (a hora da escala é a hora da parede da loja).
create or replace function public.scale_ts(p_date date, p_time time, p_timezone text)
returns timestamptz
language sql
stable
as $$
  select ((p_date + p_time) at time zone p_timezone)
$$;

create or replace function public.set_operational_status_internal(
  p_organization_id uuid,
  p_branch_id       uuid,
  p_employee_id     uuid,
  p_schedule_id     uuid,
  p_status          public.operational_status_type,
  p_priority        integer,
  p_delay           integer,
  p_reason          text
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.operational_status (
    organization_id, branch_id, employee_id, schedule_id,
    current_status, priority_level, delay_minutes, status_reason, updated_at
  )
  values (
    p_organization_id, p_branch_id, p_employee_id, p_schedule_id,
    p_status, p_priority, p_delay, p_reason, now()
  )
  on conflict (employee_id, schedule_id) do update
  set current_status = excluded.current_status,
      priority_level = excluded.priority_level,
      delay_minutes = excluded.delay_minutes,
      status_reason = excluded.status_reason,
      updated_at = now()
$$;

revoke all on function public.set_operational_status_internal(
  uuid, uuid, uuid, uuid, public.operational_status_type, integer, integer, text
) from public;

-- ─────────────────────────────────────────────
-- 3. Conferência automática conforme a escala
-- ─────────────────────────────────────────────
-- p_grace_minutes: só confirma o que a escala previa há mais que isso. O app usa uma folga para o dia de
-- hoje (quem está na loja ainda pode registrar na hora) e 0 para dias anteriores.
create or replace function public.reconcile_schedules_by_scale(
  p_branch_id     uuid,
  p_date          date,
  p_grace_minutes integer default 0,
  p_timezone      text default 'America/Sao_Paulo'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile      public.user_profiles%rowtype;
  v_now          timestamptz := now();
  v_grace        interval := make_interval(mins => greatest(coalesce(p_grace_minutes, 0), 0));
  s              public.schedules%rowtype;
  v_br           public.operational_breaks%rowtype;
  v_alloc        public.post_allocations%rowtype;
  v_post_id      uuid;
  v_start        timestamptz;
  v_end          timestamptz;
  v_bs           timestamptz;
  v_be           timestamptz;
  v_arrived      boolean;
  v_flagged      boolean;
  v_arrivals     integer := 0;
  v_breaks       integer := 0;
  v_returns      integer := 0;
  v_exits        integer := 0;
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

  if not public.can_manage_branch(p_branch_id) then
    raise exception 'Usuario sem permissao para operar esta filial.';
  end if;

  for s in
    select *
    from public.schedules sc
    where sc.organization_id = v_profile.organization_id
      and sc.branch_id = p_branch_id
      and sc.work_date = p_date
      and sc.scale_confirmation_locked = false
      and sc.status::text in ('scheduled', 'working', 'on_break', 'returned')
    order by sc.start_time nulls last, sc.id
    for update
  loop
    v_start := case when s.start_time is null then null else public.scale_ts(s.work_date, s.start_time, p_timezone) end;
    v_end   := case when s.end_time   is null then null else public.scale_ts(s.work_date, s.end_time,   p_timezone) end;
    v_bs    := case when s.break_start is null then null else public.scale_ts(s.work_date, s.break_start, p_timezone) end;
    v_be    := case when s.break_end    is null then null else public.scale_ts(s.work_date, s.break_end,   p_timezone) end;

    -- Turnos que passam da meia-noite.
    if v_start is not null and v_end is not null and v_end <= v_start then
      v_end := v_end + interval '1 day';
    end if;
    if v_start is not null and v_bs is not null and v_bs < v_start then
      v_bs := v_bs + interval '1 day';
    end if;
    if v_bs is not null and v_be is not null and v_be <= v_bs then
      v_be := v_be + interval '1 day';
    end if;

    v_arrived :=
      s.status::text in ('working', 'on_break', 'returned')
      or exists (
        select 1 from public.attendance_events e
        where e.schedule_id = s.id and e.event_type = 'entrada_confirmada'
      )
      or exists (
        select 1 from public.post_allocations pa where pa.schedule_id = s.id
      );

    -- Alguém já sinalizou atraso/falta: não presume nada, o fiscal decide.
    v_flagged := exists (
      select 1 from public.attendance_events e
      where e.schedule_id = s.id and e.event_type in ('falta_detectada', 'atraso_detectado')
    );

    -- 3.1 Entrada
    if not v_arrived and not v_flagged and v_start is not null and v_start + v_grace <= v_now then
      insert into public.attendance_events (
        organization_id, branch_id, employee_id, schedule_id, event_type, event_time, created_by, notes, source
      )
      values (
        v_profile.organization_id, s.branch_id, s.employee_id, s.id, 'entrada_confirmada', v_start,
        v_profile.id, 'Entrada conforme a escala (confirmada automaticamente).', 'escala'
      );

      update public.schedules set status = 'working' where id = s.id and status::text = 'scheduled';

      perform public.set_operational_status_internal(
        v_profile.organization_id, s.branch_id, s.employee_id, s.id,
        'trabalhando', 20, 0, 'Entrada conforme a escala.'
      );

      v_arrived := true;
      v_arrivals := v_arrivals + 1;
    end if;

    -- 3.2 Intervalo
    select * into v_br
    from public.operational_breaks b
    where b.schedule_id = s.id and b.status in ('pendente', 'liberado', 'atrasado')
    order by b.planned_start
    limit 1;

    if found then
      -- Liberado na hora, mas o retorno nunca foi confirmado: considera que voltou no fim previsto.
      if v_br.planned_end + v_grace <= v_now then
        update public.operational_breaks
        set actual_end = v_br.planned_end,
            status = 'retornou',
            notes = concat_ws(E'\n', notes, 'Retorno conforme a escala (confirmado automaticamente).')
        where id = v_br.id;

        insert into public.attendance_events (
          organization_id, branch_id, employee_id, schedule_id, event_type, event_time, created_by, notes, source
        )
        values (
          v_profile.organization_id, s.branch_id, s.employee_id, s.id, 'retorno_confirmado', v_br.planned_end,
          v_profile.id, 'Retorno conforme a escala (confirmado automaticamente).', 'escala'
        );

        update public.schedules
        set status = 'returned',
            notes = nullif(replace(coalesce(notes, ''), ' cafe_active', ''), '')
        where id = s.id and status::text <> 'finished';

        perform public.set_operational_status_internal(
          v_profile.organization_id, s.branch_id, s.employee_id, s.id,
          'voltou', 30, 0, 'Retorno conforme a escala.'
        );

        -- O intervalo encerra a alocação; no retorno a pessoa volta ao mesmo posto, se ele estiver livre.
        if v_br.break_type = 'intervalo' and v_br.post_id is not null
          and (v_end is null or v_br.planned_end < v_end)
          and not exists (
            select 1 from public.post_allocations pa
            where pa.ended_at is null and pa.status in ('alocado', 'aguardando_troca', 'em_troca')
              and (pa.post_id = v_br.post_id or pa.employee_id = s.employee_id)
          )
        then
          insert into public.post_allocations (
            organization_id, branch_id, post_id, employee_id, schedule_id, started_at, status, created_by, notes
          )
          values (
            v_profile.organization_id, s.branch_id, v_br.post_id, s.employee_id, s.id, v_br.planned_end,
            'alocado', v_profile.id, 'Retorno ao posto conforme a escala (confirmado automaticamente).'
          );
        end if;

        v_returns := v_returns + 1;
      end if;
    elsif v_arrived and v_bs is not null and v_be is not null and v_be + v_grace <= v_now
      and not exists (
        select 1 from public.operational_breaks b
        where b.schedule_id = s.id and b.break_type = 'intervalo' and b.status <> 'cancelado'
      )
      and not exists (
        select 1 from public.attendance_events e
        where e.schedule_id = s.id and e.event_type in ('intervalo_iniciado', 'retorno_confirmado')
      )
    then
      -- A alocação segue a escala: termina na saída para o intervalo e recomeça no retorno, no mesmo posto.
      v_post_id := null;
      select * into v_alloc
      from public.post_allocations pa
      where pa.organization_id = v_profile.organization_id
        and pa.employee_id = s.employee_id
        and pa.ended_at is null
        and pa.status in ('alocado', 'aguardando_troca', 'em_troca')
        and pa.started_at <= v_bs
        and (pa.schedule_id = s.id or pa.schedule_id is null)
      limit 1;

      if found then
        v_post_id := v_alloc.post_id;
        update public.post_allocations
        set ended_at = v_bs,
            ended_by = v_profile.id,
            status = 'finalizado',
            notes = concat_ws(chr(10), notes, 'Posto liberado para o intervalo conforme a escala (confirmado automaticamente).')
        where id = v_alloc.id;
      end if;

      insert into public.operational_breaks (
        organization_id, branch_id, employee_id, schedule_id, post_id, allocation_id,
        break_type, planned_start, planned_end, actual_start, actual_end, status,
        released_by, returned_by, notes, source
      )
      values (
        v_profile.organization_id, s.branch_id, s.employee_id, s.id, v_post_id, v_alloc.id,
        'intervalo', v_bs, v_be, v_bs, v_be, 'retornou',
        v_profile.id, v_profile.id, 'Intervalo conforme a escala (confirmado automaticamente).', 'escala'
      );

      if v_post_id is not null
        and (v_end is null or v_be < v_end)
        and not exists (
          select 1 from public.post_allocations pa
          where pa.ended_at is null and pa.status in ('alocado', 'aguardando_troca', 'em_troca')
            and (pa.post_id = v_post_id or pa.employee_id = s.employee_id)
        )
      then
        insert into public.post_allocations (
          organization_id, branch_id, post_id, employee_id, schedule_id, started_at, status, created_by, notes
        )
        values (
          v_profile.organization_id, s.branch_id, v_post_id, s.employee_id, s.id, v_be,
          'alocado', v_profile.id, 'Retorno ao posto conforme a escala (confirmado automaticamente).'
        );
      end if;

      insert into public.attendance_events (
        organization_id, branch_id, employee_id, schedule_id, event_type, event_time, created_by, notes, source
      )
      values
        (v_profile.organization_id, s.branch_id, s.employee_id, s.id, 'intervalo_iniciado', v_bs,
         v_profile.id, 'Saída para intervalo conforme a escala (confirmada automaticamente).', 'escala'),
        (v_profile.organization_id, s.branch_id, s.employee_id, s.id, 'retorno_confirmado', v_be,
         v_profile.id, 'Retorno do intervalo conforme a escala (confirmado automaticamente).', 'escala');

      update public.schedules set status = 'returned' where id = s.id and status::text <> 'finished';

      perform public.set_operational_status_internal(
        v_profile.organization_id, s.branch_id, s.employee_id, s.id,
        'voltou', 30, 0, 'Intervalo conforme a escala.'
      );

      v_breaks := v_breaks + 1;
    end if;

    -- 3.3 Saída
    if v_arrived and v_end is not null and v_end + v_grace <= v_now
      and not exists (
        select 1 from public.attendance_events e
        where e.schedule_id = s.id and e.event_type = 'saida_confirmada'
      )
      and not exists (
        select 1 from public.operational_breaks b
        where b.schedule_id = s.id and b.status in ('pendente', 'liberado', 'atrasado')
      )
    then
      update public.post_allocations
      set ended_at = v_end,
          ended_by = v_profile.id,
          status = 'finalizado',
          notes = concat_ws(E'\n', notes, 'Saída conforme a escala (confirmada automaticamente).')
      where organization_id = v_profile.organization_id
        and employee_id = s.employee_id
        and ended_at is null
        and started_at <= v_end
        and (schedule_id = s.id or schedule_id is null);

      insert into public.attendance_events (
        organization_id, branch_id, employee_id, schedule_id, event_type, event_time, created_by, notes, source
      )
      values (
        v_profile.organization_id, s.branch_id, s.employee_id, s.id, 'saida_confirmada', v_end,
        v_profile.id, 'Saída conforme a escala (confirmada automaticamente).', 'escala'
      );

      update public.schedules set status = 'finished' where id = s.id;

      perform public.set_operational_status_internal(
        v_profile.organization_id, s.branch_id, s.employee_id, s.id,
        'finalizado', 5, 0, 'Saída conforme a escala.'
      );

      v_exits := v_exits + 1;
    end if;
  end loop;

  if v_arrivals + v_breaks + v_returns + v_exits > 0 then
    insert into public.audit_logs (
      organization_id, branch_id, user_id, action, entity_type, entity_id, old_value, new_value
    )
    values (
      v_profile.organization_id, p_branch_id, v_profile.id,
      'schedule_reconciled_by_scale', 'schedules', null, null,
      jsonb_build_object(
        'date', p_date,
        'grace_minutes', p_grace_minutes,
        'arrivals', v_arrivals,
        'breaks', v_breaks,
        'returns', v_returns,
        'exits', v_exits
      )
    );
  end if;

  return jsonb_build_object(
    'arrivals', v_arrivals,
    'breaks', v_breaks,
    'returns', v_returns,
    'exits', v_exits
  );
end;
$$;

revoke all on function public.reconcile_schedules_by_scale(uuid, date, integer, text) from public;
grant execute on function public.reconcile_schedules_by_scale(uuid, date, integer, text) to authenticated;

-- ─────────────────────────────────────────────
-- 4. Correção retroativa com os horários reais
-- ─────────────────────────────────────────────
-- Substitui o que foi confirmado pela escala (ou informado antes) pelos horários reais. Registros feitos na
-- hora (source = 'manual') não são tocados. Depois da correção a escala fica travada: a conferência
-- automática não volta a mexer nela.
create or replace function public.correct_schedule_attendance(
  p_schedule_id uuid,
  p_outcome     text,
  p_arrival     text default null,
  p_break_start text default null,
  p_break_end   text default null,
  p_exit        text default null,
  p_timezone    text default 'America/Sao_Paulo'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile      public.user_profiles%rowtype;
  s              public.schedules%rowtype;
  v_now          timestamptz := now();
  v_start        timestamptz;
  v_arr          timestamptz;
  v_bs           timestamptz;
  v_be           timestamptz;
  v_exit         timestamptz;
  v_planned_bs   timestamptz;
  v_planned_be   timestamptz;
  v_delay        integer := 0;
  v_note         text;
  v_final_status public.schedule_status := 'working';
begin
  if v_auth_user_id is null then
    raise exception 'Usuario autenticado nao encontrado.';
  end if;

  if p_outcome not in ('compareceu', 'faltou') then
    raise exception 'Situacao invalida para a conferencia.';
  end if;

  select * into v_profile
  from public.user_profiles
  where auth_user_id = v_auth_user_id and active = true
  limit 1;

  if not found then
    raise exception 'Perfil do usuario nao encontrado.';
  end if;

  select * into s
  from public.schedules
  where id = p_schedule_id and organization_id = v_profile.organization_id
  for update;

  if not found then
    raise exception 'Escala nao encontrada.';
  end if;

  if not public.can_manage_branch(s.branch_id) then
    raise exception 'Usuario sem permissao para operar esta filial.';
  end if;

  if s.status::text in ('cancelled', 'day_off', 'banked_hours') then
    raise exception 'Esta escala nao pode receber acoes operacionais.';
  end if;

  if (nullif(trim(p_break_start), '') is null) <> (nullif(trim(p_break_end), '') is null) then
    raise exception 'Informe o inicio e o retorno do intervalo, ou deixe os dois em branco.';
  end if;

  v_start := case when s.start_time is null then null else public.scale_ts(s.work_date, s.start_time, p_timezone) end;

  -- Remove o que foi presumido pela escala ou informado antes; registros feitos na hora ficam.
  delete from public.attendance_events
  where schedule_id = s.id and source in ('escala', 'retroativo');

  delete from public.operational_breaks
  where schedule_id = s.id and source in ('escala', 'retroativo');

  if p_outcome = 'faltou' then
    insert into public.attendance_events (
      organization_id, branch_id, employee_id, schedule_id, event_type, event_time, created_by, notes, source
    )
    values (
      v_profile.organization_id, s.branch_id, s.employee_id, s.id, 'falta_detectada',
      coalesce(v_start, public.scale_ts(s.work_date, time '00:00', p_timezone)),
      v_profile.id, 'Falta registrada na conferência.', 'retroativo'
    );

    update public.schedules set status = 'absent', scale_confirmation_locked = true where id = s.id;

    perform public.set_operational_status_internal(
      v_profile.organization_id, s.branch_id, s.employee_id, s.id,
      'alerta_critico', 110, 0, 'Falta registrada na conferência.'
    );
  else
    -- Entrada
    v_arr := public.scale_ts(
      s.work_date,
      coalesce(nullif(trim(p_arrival), '')::time, s.start_time, time '00:00'),
      p_timezone
    );

    if v_arr > v_now then
      raise exception 'O horario de entrada nao pode ser no futuro.';
    end if;

    if v_start is not null then
      v_delay := greatest(0, floor(extract(epoch from (v_arr - v_start)) / 60)::integer);
    end if;

    v_note := case
      when v_delay > 0 then
        'Chegou às ' || to_char(v_arr at time zone p_timezone, 'HH24:MI') || ', '
        || v_delay::text || ' min após o horário (informado na conferência).'
      else
        'Chegou às ' || to_char(v_arr at time zone p_timezone, 'HH24:MI') || ', no horário (informado na conferência).'
    end;

    insert into public.attendance_events (
      organization_id, branch_id, employee_id, schedule_id, event_type, event_time, created_by, notes, source
    )
    values (
      v_profile.organization_id, s.branch_id, s.employee_id, s.id, 'entrada_confirmada', v_arr,
      v_profile.id, v_note, 'retroativo'
    );

    perform public.set_operational_status_internal(
      v_profile.organization_id, s.branch_id, s.employee_id, s.id,
      'trabalhando', 20, v_delay, v_note
    );

    -- Intervalo
    if nullif(trim(p_break_start), '') is not null then
      v_bs := public.scale_ts(s.work_date, trim(p_break_start)::time, p_timezone);
      if v_bs < v_arr then v_bs := v_bs + interval '1 day'; end if;
      v_be := public.scale_ts(s.work_date, trim(p_break_end)::time, p_timezone);
      if v_be <= v_bs then v_be := v_be + interval '1 day'; end if;
      while v_be <= v_bs loop v_be := v_be + interval '1 day'; end loop;

      if v_be > v_now then
        raise exception 'O retorno do intervalo nao pode ser no futuro.';
      end if;

      v_planned_bs := case when s.break_start is null then v_bs else public.scale_ts(s.work_date, s.break_start, p_timezone) end;
      v_planned_be := case when s.break_end is null then v_be else public.scale_ts(s.work_date, s.break_end, p_timezone) end;
      if v_planned_bs < coalesce(v_start, v_arr) then v_planned_bs := v_planned_bs + interval '1 day'; end if;
      if v_planned_be <= v_planned_bs then v_planned_be := v_planned_be + interval '1 day'; end if;

      insert into public.operational_breaks (
        organization_id, branch_id, employee_id, schedule_id, post_id, allocation_id,
        break_type, planned_start, planned_end, actual_start, actual_end, status,
        released_by, returned_by, notes, source
      )
      values (
        v_profile.organization_id, s.branch_id, s.employee_id, s.id, null, null,
        'intervalo', v_planned_bs, v_planned_be, v_bs, v_be, 'retornou',
        v_profile.id, v_profile.id, 'Intervalo informado na conferência.', 'retroativo'
      );

      insert into public.attendance_events (
        organization_id, branch_id, employee_id, schedule_id, event_type, event_time, created_by, notes, source
      )
      values
        (v_profile.organization_id, s.branch_id, s.employee_id, s.id, 'intervalo_iniciado', v_bs,
         v_profile.id, 'Saída para intervalo às ' || to_char(v_bs at time zone p_timezone, 'HH24:MI') || ' (informada na conferência).', 'retroativo'),
        (v_profile.organization_id, s.branch_id, s.employee_id, s.id, 'retorno_confirmado', v_be,
         v_profile.id, 'Retorno do intervalo às ' || to_char(v_be at time zone p_timezone, 'HH24:MI') || ' (informado na conferência).', 'retroativo');

      v_final_status := 'returned';

      perform public.set_operational_status_internal(
        v_profile.organization_id, s.branch_id, s.employee_id, s.id,
        'voltou', 30, v_delay, 'Intervalo informado na conferência.'
      );
    end if;

    -- Saída
    if nullif(trim(p_exit), '') is not null then
      v_exit := public.scale_ts(s.work_date, trim(p_exit)::time, p_timezone);
      while v_exit <= coalesce(v_be, v_arr) loop v_exit := v_exit + interval '1 day'; end loop;

      if v_exit > v_now then
        raise exception 'O horario de saida nao pode ser no futuro.';
      end if;

      -- Alocações encerradas automaticamente pela escala passam a terminar no horário real.
      update public.post_allocations
      set ended_at = v_exit
      where organization_id = v_profile.organization_id
        and employee_id = s.employee_id
        and schedule_id = s.id
        and status = 'finalizado'
        and ended_at is not null
        and notes like '%Saída conforme a escala (confirmada automaticamente).%'
        and started_at <= v_exit;

      update public.post_allocations
      set ended_at = v_exit,
          ended_by = v_profile.id,
          status = 'finalizado',
          notes = concat_ws(E'\n', notes, 'Saída informada na conferência.')
      where organization_id = v_profile.organization_id
        and employee_id = s.employee_id
        and ended_at is null
        and started_at <= v_exit
        and (schedule_id = s.id or schedule_id is null);

      insert into public.attendance_events (
        organization_id, branch_id, employee_id, schedule_id, event_type, event_time, created_by, notes, source
      )
      values (
        v_profile.organization_id, s.branch_id, s.employee_id, s.id, 'saida_confirmada', v_exit,
        v_profile.id, 'Saída às ' || to_char(v_exit at time zone p_timezone, 'HH24:MI') || ' (informada na conferência).', 'retroativo'
      );

      v_final_status := 'finished';

      perform public.set_operational_status_internal(
        v_profile.organization_id, s.branch_id, s.employee_id, s.id,
        'finalizado', 5, v_delay, 'Saída informada na conferência.'
      );
    end if;

    update public.schedules
    set status = v_final_status, scale_confirmation_locked = true
    where id = s.id;
  end if;

  insert into public.audit_logs (
    organization_id, branch_id, user_id, action, entity_type, entity_id, old_value, new_value
  )
  values (
    v_profile.organization_id, s.branch_id, v_profile.id,
    'schedule_attendance_corrected', 'schedules', s.id, null,
    jsonb_build_object(
      'outcome', p_outcome,
      'arrival', p_arrival,
      'break_start', p_break_start,
      'break_end', p_break_end,
      'exit', p_exit
    )
  );

  return jsonb_build_object('schedule_id', s.id, 'outcome', p_outcome, 'delay_minutes', v_delay);
end;
$$;

revoke all on function public.correct_schedule_attendance(uuid, text, text, text, text, text, text) from public;
grant execute on function public.correct_schedule_attendance(uuid, text, text, text, text, text, text) to authenticated;

notify pgrst, 'reload schema';
