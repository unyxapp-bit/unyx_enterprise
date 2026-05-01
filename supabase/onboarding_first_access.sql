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

insert into public.modules (key, name, description)
values
  ('unyx_ops', 'Unyx Ops', 'Escala operacional, dashboard vivo e auditoria.'),
  ('unyx_comms', 'Unyx Comms', 'Comunicacao interna, feed e avisos.'),
  ('unyx_academy', 'Unyx Academy', 'Treinamentos, videos, audios e onboarding.'),
  ('unyx_game', 'Unyx Game', 'Gamificacao, metas e recompensas.'),
  ('unyx_ai', 'Unyx AI', 'Inteligencia operacional e previsao de gargalos.')
on conflict (key) do nothing;

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
