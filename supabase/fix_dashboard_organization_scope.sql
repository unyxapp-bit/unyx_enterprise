-- Recria a view do dashboard com isolamento por organizacao.
-- Rode este arquivo no SQL Editor do Supabase se o banco atual ainda
-- mostrar dados de outra empresa ao selecionar "Todas as filiais".

create or replace view public.v_operational_dashboard
with (security_invoker = true) as
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
    case sc.status::text
      when 'working' then 'trabalhando'::public.operational_status_type
      when 'on_break' then 'em_intervalo'::public.operational_status_type
      when 'returned' then 'voltou'::public.operational_status_type
      when 'finished' then 'finalizado'::public.operational_status_type
      when 'absent' then 'alerta_critico'::public.operational_status_type
      when 'day_off' then 'folga'::public.operational_status_type
      when 'banked_hours' then 'folga'::public.operational_status_type
      else 'aguardando_evento'::public.operational_status_type
    end
  ) as current_status,
  coalesce(
    os.priority_level,
    case sc.status::text
      when 'day_off' then 0
      when 'banked_hours' then 0
      when 'cancelled' then 0
      when 'absent' then 110
      when 'on_break' then 50
      else 10
    end
  ) as priority_level,
  coalesce(os.delay_minutes, 0) as delay_minutes,
  coalesce(
    os.status_reason,
    case sc.status::text
      when 'scheduled' then 'Aguardando primeiro evento'
      when 'working' then 'Trabalhando pela escala'
      when 'on_break' then 'Intervalo pela escala'
      when 'returned' then 'Retorno registrado na escala'
      when 'finished' then 'Turno finalizado'
      when 'absent' then 'Falta registrada na escala'
      when 'day_off' then 'Folga na escala'
      when 'banked_hours' then 'Banco de horas na escala'
      when 'cancelled' then 'Escala cancelada'
    end
  ) as status_reason,
  coalesce(os.updated_at, sc.updated_at) as updated_at
from public.schedules sc
join public.employees e
  on e.id = sc.employee_id
  and e.organization_id = sc.organization_id
join public.branches b
  on b.id = sc.branch_id
  and b.organization_id = sc.organization_id
left join public.sectors s
  on s.id = e.sector_id
  and s.organization_id = sc.organization_id
left join public.operational_status os
  on os.schedule_id = sc.id
  and os.employee_id = sc.employee_id
  and os.organization_id = sc.organization_id;

notify pgrst, 'reload schema';
