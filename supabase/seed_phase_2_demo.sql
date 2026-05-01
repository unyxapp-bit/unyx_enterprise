-- =========================================================
-- UNYX ENTERPRISE / UNYX OPS
-- Seed opcional da Fase 2 - MVP Comercial
-- =========================================================
--
-- Como usar:
-- 1. Crie um usuario em Supabase Auth.
-- 2. Copie o ID desse usuario.
-- 3. Substitua o UUID abaixo em v_auth_user_id.
-- 4. Rode este arquivo no SQL Editor do Supabase.

do $$
declare
  v_auth_user_id uuid := '00000000-0000-0000-0000-000000000000';
  v_org_id uuid;
  v_branch_id uuid;
  v_profile_id uuid;
  v_sector_front uuid;
  v_sector_stock uuid;
  v_sector_bakery uuid;
  v_sector_delivery uuid;
  v_employee_id uuid;
  v_schedule_id uuid;
  r record;
begin
  if v_auth_user_id = '00000000-0000-0000-0000-000000000000' then
    raise exception 'Substitua v_auth_user_id pelo ID real de um usuario do Supabase Auth.';
  end if;

  insert into public.organizations (
    name,
    trade_name,
    document,
    segment,
    status,
    plan
  )
  values (
    'Unyx Demo Market LTDA',
    'Unyx Demo Market',
    '00.000.000/0001-00',
    'supermarket',
    'trial',
    'growth'
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
    'Loja Centro',
    'Sao Paulo',
    'SP',
    'Av. Operacional, 100'
  )
  returning id into v_branch_id;

  insert into public.sectors (organization_id, branch_id, name, description)
  values
    (v_org_id, v_branch_id, 'Frente de caixa', 'Caixas, fiscais, sangria e troca de posto')
  returning id into v_sector_front;

  insert into public.sectors (organization_id, branch_id, name, description)
  values
    (v_org_id, v_branch_id, 'Estoque', 'Reposicao e cobertura de ruptura')
  returning id into v_sector_stock;

  insert into public.sectors (organization_id, branch_id, name, description)
  values
    (v_org_id, v_branch_id, 'Padaria', 'Atendimento e producao da padaria')
  returning id into v_sector_bakery;

  insert into public.sectors (organization_id, branch_id, name, description)
  values
    (v_org_id, v_branch_id, 'Delivery', 'Separacao e expedicao de pedidos')
  returning id into v_sector_delivery;

  insert into public.user_profiles (
    auth_user_id,
    organization_id,
    branch_id,
    name,
    email,
    role,
    active
  )
  select
    v_auth_user_id,
    v_org_id,
    v_branch_id,
    coalesce(raw_user_meta_data->>'name', email, 'Administrador Unyx'),
    email,
    'owner',
    true
  from auth.users
  where id = v_auth_user_id
  returning id into v_profile_id;

  if v_profile_id is null then
    raise exception 'Usuario de Auth nao encontrado para o ID informado.';
  end if;

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
    'growth',
    'trial',
    4,
    120,
    now() + interval '14 days',
    now(),
    now() + interval '30 days'
  );

  insert into public.organization_modules (organization_id, module_id, enabled)
  select v_org_id, id, key = 'unyx_ops'
  from public.modules;

  create temp table tmp_unyx_demo_employees (
    name text,
    role text,
    sector_id uuid,
    phone text,
    start_time time,
    break_start time,
    break_end time,
    end_time time,
    current_status public.operational_status_type,
    priority_level integer,
    delay_minutes integer,
    status_reason text
  ) on commit drop;

  insert into tmp_unyx_demo_employees values
    ('Ana Souza', 'Operadora de caixa', v_sector_front, '(11) 90000-0001', '08:00', '12:00', '13:00', '17:00', 'trabalhando', 20, 0, 'Entrada confirmada'),
    ('Bruno Lima', 'Fiscal de caixa', v_sector_front, '(11) 90000-0002', '08:00', '12:30', '13:30', '17:00', 'aguardando_sangria', 80, 0, 'Preparar sangria antes do intervalo'),
    ('Carla Nunes', 'Reposicao', v_sector_stock, '(11) 90000-0003', '07:00', '11:30', '12:30', '16:00', 'alerta_critico', 100, 18, 'Atraso detectado'),
    ('Diego Rocha', 'Operador de caixa', v_sector_front, '(11) 90000-0004', '09:00', '13:00', '14:00', '18:00', 'em_intervalo', 50, 0, 'Intervalo iniciado'),
    ('Elisa Prado', 'Atendente padaria', v_sector_bakery, '(11) 90000-0005', '06:00', '10:30', '11:30', '15:00', 'deve_sair', 60, 0, 'Deve sair para intervalo'),
    ('Fabio Martins', 'Separador delivery', v_sector_delivery, '(11) 90000-0006', '10:00', '14:00', '15:00', '19:00', 'trabalhando', 20, 0, 'Cobertura ativa'),
    ('Giovana Reis', 'Operadora de caixa', v_sector_front, '(11) 90000-0007', '08:30', '12:30', '13:30', '17:30', 'troca_de_caixa', 70, 0, 'Troca de caixa pendente'),
    ('Hugo Almeida', 'Reposicao', v_sector_stock, '(11) 90000-0008', '07:30', '11:30', '12:30', '16:30', 'trabalhando', 20, 0, 'Operacao normal'),
    ('Isabela Costa', 'Atendente padaria', v_sector_bakery, '(11) 90000-0009', '06:30', '10:30', '11:30', '15:30', 'voltou', 30, 0, 'Retorno confirmado'),
    ('Joao Pedro', 'Operador de caixa', v_sector_front, '(11) 90000-0010', '12:00', '16:00', '17:00', '21:00', 'trabalhando', 20, 0, 'Turno da tarde'),
    ('Karina Lopes', 'Fiscal de caixa', v_sector_front, '(11) 90000-0011', '11:00', '15:00', '16:00', '20:00', 'alerta_critico', 95, 0, 'Cobertura insuficiente na frente de caixa'),
    ('Lucas Vieira', 'Separador delivery', v_sector_delivery, '(11) 90000-0012', '09:00', '13:00', '14:00', '18:00', 'trabalhando', 20, 0, 'Pedidos em andamento'),
    ('Marina Dias', 'Operadora de caixa', v_sector_front, '(11) 90000-0013', '13:00', '17:00', '18:00', '22:00', 'folga', 5, 0, 'Folga registrada'),
    ('Nicolas Barros', 'Reposicao', v_sector_stock, '(11) 90000-0014', '12:00', '16:00', '17:00', '21:00', 'trabalhando', 20, 0, 'Cobertura de gondola'),
    ('Olivia Ramos', 'Atendente padaria', v_sector_bakery, '(11) 90000-0015', '14:00', '18:00', '19:00', '22:00', 'deve_sair', 60, 0, 'Janela de intervalo proxima'),
    ('Paulo Mendes', 'Operador de caixa', v_sector_front, '(11) 90000-0016', '15:00', '18:30', '19:30', '23:00', 'trabalhando', 20, 0, 'Abertura do turno noturno');

  for r in select * from tmp_unyx_demo_employees loop
    insert into public.employees (
      organization_id,
      branch_id,
      sector_id,
      name,
      role,
      phone,
      active
    )
    values (
      v_org_id,
      v_branch_id,
      r.sector_id,
      r.name,
      r.role,
      r.phone,
      true
    )
    returning id into v_employee_id;

    insert into public.schedules (
      organization_id,
      branch_id,
      employee_id,
      work_date,
      start_time,
      break_start,
      break_end,
      end_time,
      status
    )
    values (
      v_org_id,
      v_branch_id,
      v_employee_id,
      current_date,
      r.start_time,
      r.break_start,
      r.break_end,
      r.end_time,
      case
        when r.current_status = 'folga' then 'day_off'
        when r.current_status = 'em_intervalo' then 'on_break'
        when r.current_status = 'voltou' then 'returned'
        else 'working'
      end::public.schedule_status
    )
    returning id into v_schedule_id;

    insert into public.operational_status (
      organization_id,
      branch_id,
      employee_id,
      schedule_id,
      current_status,
      priority_level,
      delay_minutes,
      status_reason
    )
    values (
      v_org_id,
      v_branch_id,
      v_employee_id,
      v_schedule_id,
      r.current_status,
      r.priority_level,
      r.delay_minutes,
      r.status_reason
    );

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
      v_org_id,
      v_branch_id,
      v_employee_id,
      v_schedule_id,
      case
        when r.current_status = 'alerta_critico' and r.delay_minutes > 0 then 'atraso_detectado'
        when r.current_status = 'alerta_critico' then 'ocorrencia_registrada'
        when r.current_status = 'em_intervalo' then 'intervalo_iniciado'
        when r.current_status = 'voltou' then 'retorno_confirmado'
        else 'entrada_confirmada'
      end::public.attendance_event_type,
      v_profile_id,
      r.status_reason
    );
  end loop;

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
    v_org_id,
    v_branch_id,
    v_profile_id,
    'seed_phase_2_demo',
    'organizations',
    v_org_id,
    null,
    jsonb_build_object('message', 'Seed comercial da Fase 2 criado')
  );
end $$;
