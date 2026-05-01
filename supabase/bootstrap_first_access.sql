-- =========================================================
-- UNYX ENTERPRISE / UNYX OPS
-- Bootstrap de primeiro acesso
-- =========================================================
--
-- Como usar:
-- 1. Rode este arquivo uma vez no SQL Editor do Supabase.
-- 2. Volte ao app logado e clique em "Recarregar perfil".
-- 3. O app chamara public.bootstrap_current_user_profile() usando a sessao
--    do usuario autenticado e criara organizacao, filial e perfil owner.

insert into public.modules (key, name, description)
values
  ('unyx_ops', 'Unyx Ops', 'Escala operacional, dashboard vivo e auditoria.'),
  ('unyx_comms', 'Unyx Comms', 'Comunicacao interna, feed e avisos.'),
  ('unyx_academy', 'Unyx Academy', 'Treinamentos, videos, audios e onboarding.'),
  ('unyx_game', 'Unyx Game', 'Gamificacao, metas e recompensas.'),
  ('unyx_ai', 'Unyx AI', 'Inteligencia operacional e previsao de gargalos.')
on conflict (key) do nothing;

create or replace function public.bootstrap_current_user_profile()
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
begin
  if v_auth_user_id is null then
    raise exception 'Usuario autenticado nao encontrado.';
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
    update public.user_profiles
    set active = true
    where id = v_profile_id;

    return v_profile_id;
  end if;

  v_email := coalesce(
    nullif(v_auth_user.email, ''),
    nullif(v_auth_user.raw_user_meta_data->>'email', ''),
    v_auth_user_id::text || '@unyx.local'
  );

  v_name := coalesce(
    nullif(v_auth_user.raw_user_meta_data->>'name', ''),
    nullif(v_auth_user.raw_user_meta_data->>'full_name', ''),
    nullif(split_part(v_email, '@', 1), ''),
    'Administrador Unyx'
  );

  v_org_name := coalesce(
    nullif(v_auth_user.raw_user_meta_data->>'organization_name', ''),
    'Operacao ' || v_name
  );

  insert into public.organizations (
    name,
    trade_name,
    segment,
    status,
    plan
  )
  values (
    v_org_name,
    v_org_name,
    'other',
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
    'Loja principal',
    null,
    null,
    null
  )
  returning id into v_branch_id;

  insert into public.sectors (organization_id, branch_id, name, description)
  values
    (v_org_id, v_branch_id, 'Atendimento', 'Equipe de atendimento e frente de loja.'),
    (v_org_id, v_branch_id, 'Estoque', 'Reposicao, recebimento e organizacao.'),
    (v_org_id, v_branch_id, 'Operacao', 'Rotina operacional e supervisao.');

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
    'bootstrap_first_access',
    'organization',
    v_org_id,
    jsonb_build_object('source', 'bootstrap_current_user_profile')
  );

  return v_profile_id;
end;
$$;

revoke all on function public.bootstrap_current_user_profile() from public;
grant execute on function public.bootstrap_current_user_profile() to authenticated;
