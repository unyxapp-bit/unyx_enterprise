-- =========================================================
-- UNYX ENTERPRISE / UNYX OPS
-- Seed opcional da Fase 1
-- =========================================================
--
-- Como usar:
-- 1. Crie um usuário em Supabase Auth.
-- 2. Copie o ID desse usuário.
-- 3. Substitua o UUID abaixo em v_auth_user_id.
-- 4. Rode este arquivo no SQL Editor do Supabase.
--
-- O seed cria:
-- - organização
-- - filial
-- - setores
-- - user_profile owner/admin
-- - assinatura starter
-- - módulos da organização
-- - colaboradores
-- - escala do dia
-- - status operacional inicial

do $$
declare
  v_auth_user_id uuid := '00000000-0000-0000-0000-000000000000';
  v_org_id uuid;
  v_branch_id uuid;
  v_sector_front uuid;
  v_sector_stock uuid;
  v_profile_id uuid;
  v_employee_1 uuid;
  v_employee_2 uuid;
  v_employee_3 uuid;
  v_schedule_1 uuid;
  v_schedule_2 uuid;
  v_schedule_3 uuid;
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
    'Loja Centro',
    'Sao Paulo',
    'SP',
    'Av. Operacional, 100'
  )
  returning id into v_branch_id;

  insert into public.sectors (organization_id, branch_id, name, description)
  values
    (v_org_id, v_branch_id, 'Frente de caixa', 'Caixas, fiscais e apoio de sangria')
  returning id into v_sector_front;

  insert into public.sectors (organization_id, branch_id, name, description)
  values
    (v_org_id, v_branch_id, 'Estoque', 'Reposicao e cobertura operacional')
  returning id into v_sector_stock;

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

  insert into public.subscriptions (
    organization_id,
    plan,
    status,
    max_branches,
    max_employees,
    trial_ends_at
  )
  values (
    v_org_id,
    'starter',
    'trial',
    1,
    30,
    now() + interval '14 days'
  );

  insert into public.organization_modules (organization_id, module_id, enabled)
  select v_org_id, id, true
  from public.modules
  where key = 'unyx_ops';

  insert into public.employees (
    organization_id,
    branch_id,
    sector_id,
    name,
    role,
    phone,
    active
  )
  values
    (v_org_id, v_branch_id, v_sector_front, 'Ana Souza', 'Operadora de caixa', '(11) 90000-0001', true)
  returning id into v_employee_1;

  insert into public.employees (
    organization_id,
    branch_id,
    sector_id,
    name,
    role,
    phone,
    active
  )
  values
    (v_org_id, v_branch_id, v_sector_front, 'Bruno Lima', 'Fiscal de caixa', '(11) 90000-0002', true)
  returning id into v_employee_2;

  insert into public.employees (
    organization_id,
    branch_id,
    sector_id,
    name,
    role,
    phone,
    active
  )
  values
    (v_org_id, v_branch_id, v_sector_stock, 'Carla Nunes', 'Reposicao', '(11) 90000-0003', true)
  returning id into v_employee_3;

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
  values
    (v_org_id, v_branch_id, v_employee_1, current_date, '08:00', '12:00', '13:00', '17:00', 'working')
  returning id into v_schedule_1;

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
  values
    (v_org_id, v_branch_id, v_employee_2, current_date, '09:00', '13:00', '14:00', '18:00', 'scheduled')
  returning id into v_schedule_2;

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
  values
    (v_org_id, v_branch_id, v_employee_3, current_date, '07:00', '11:30', '12:30', '16:00', 'scheduled')
  returning id into v_schedule_3;

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
  values
    (v_org_id, v_branch_id, v_employee_1, v_schedule_1, 'trabalhando', 20, 0, 'Entrada confirmada'),
    (v_org_id, v_branch_id, v_employee_2, v_schedule_2, 'aguardando_sangria', 80, 0, 'Preparar intervalo'),
    (v_org_id, v_branch_id, v_employee_3, v_schedule_3, 'alerta_critico', 100, 15, 'Atraso detectado');

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
    'seed_phase_1_demo',
    'organizations',
    v_org_id,
    null,
    jsonb_build_object('message', 'Seed da Fase 1 criado')
  );
end $$;
