-- Rode este arquivo isoladamente no SQL Editor do Supabase.
-- Cria (ou recria) os 3 RPCs necessários para o modulo Allocation.
-- É seguro rodar multiplas vezes (idempotente).

-- ─────────────────────────────────────────────
-- 1. create_operational_post
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
  v_profile  public.user_profiles%rowtype;
  v_post_id  uuid;
begin
  select * into v_profile
  from public.user_profiles
  where auth_user_id = auth.uid() and active = true
  limit 1;

  if not found then
    raise exception 'Perfil do usuario nao encontrado.';
  end if;

  if not public.can_manage_branch(p_branch_id) then
    raise exception 'Usuario sem permissao para operar esta filial.';
  end if;

  if not exists (
    select 1 from public.branches
    where id = p_branch_id
      and organization_id = v_profile.organization_id
      and active = true
  ) then
    raise exception 'Filial invalida ou inativa.';
  end if;

  if p_sector_id is not null and not exists (
    select 1 from public.sectors
    where id = p_sector_id
      and branch_id = p_branch_id
      and organization_id = v_profile.organization_id
      and active = true
  ) then
    raise exception 'Setor invalido para esta filial.';
  end if;

  if nullif(trim(p_name), '') is null then
    raise exception 'Informe o nome do posto.';
  end if;

  insert into public.operational_posts (
    organization_id, branch_id, sector_id, name, type, active
  )
  values (
    v_profile.organization_id,
    p_branch_id,
    p_sector_id,
    trim(p_name),
    p_type,
    p_active
  )
  returning id into v_post_id;

  insert into public.audit_logs (
    organization_id, branch_id, user_id,
    action, entity_type, entity_id, new_value
  ) values (
    v_profile.organization_id, p_branch_id, v_profile.id,
    'operational_post_created', 'operational_posts', v_post_id,
    jsonb_build_object('name', p_name, 'type', p_type)
  );

  return v_post_id;
end;
$$;

-- ─────────────────────────────────────────────
-- 2. update_operational_post_record
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
  v_profile  public.user_profiles%rowtype;
  v_post     public.operational_posts%rowtype;
begin
  select * into v_profile
  from public.user_profiles
  where auth_user_id = auth.uid() and active = true
  limit 1;

  if not found then
    raise exception 'Perfil do usuario nao encontrado.';
  end if;

  select * into v_post
  from public.operational_posts
  where id = p_post_id
    and organization_id = v_profile.organization_id
  for update;

  if not found then
    raise exception 'Posto operacional nao encontrado.';
  end if;

  if not public.can_manage_branch(v_post.branch_id) then
    raise exception 'Usuario sem permissao para operar esta filial.';
  end if;

  if p_sector_id is not null and not exists (
    select 1 from public.sectors
    where id = p_sector_id
      and branch_id = v_post.branch_id
      and organization_id = v_profile.organization_id
      and active = true
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

  insert into public.audit_logs (
    organization_id, branch_id, user_id,
    action, entity_type, entity_id, old_value, new_value
  ) values (
    v_profile.organization_id, v_post.branch_id, v_profile.id,
    'operational_post_updated', 'operational_posts', p_post_id,
    to_jsonb(v_post),
    jsonb_build_object('name', p_name, 'type', p_type, 'active', p_active)
  );

  return true;
end;
$$;

-- ─────────────────────────────────────────────
-- 3. setup_segment_defaults
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
  v_profile         public.user_profiles%rowtype;
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
  select * into v_profile
  from public.user_profiles
  where auth_user_id = auth.uid() and active = true
  limit 1;

  if not found then
    raise exception 'Perfil do usuario nao encontrado.';
  end if;

  if not public.can_manage_branch(p_branch_id) then
    raise exception 'Usuario sem permissao para operar esta filial.';
  end if;

  foreach v_sector_name in array p_sector_names loop
    if not exists (
      select 1 from public.sectors
      where branch_id = p_branch_id
        and organization_id = v_profile.organization_id
        and lower(name) = lower(v_sector_name)
    ) then
      insert into public.sectors (organization_id, branch_id, name, active)
      values (v_profile.organization_id, p_branch_id, v_sector_name, true)
      returning id into v_sector_id;
      v_sectors_created := v_sectors_created + 1;
    else
      select id into v_sector_id
      from public.sectors
      where branch_id = p_branch_id
        and organization_id = v_profile.organization_id
        and lower(name) = lower(v_sector_name)
      limit 1;
    end if;
    v_sector_id_map := jsonb_set(
      v_sector_id_map,
      array[lower(v_sector_name)],
      to_jsonb(v_sector_id::text)
    );
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
      where branch_id = p_branch_id
        and organization_id = v_profile.organization_id
        and lower(name) = lower(v_post_name)
    ) then
      insert into public.operational_posts (
        organization_id, branch_id, sector_id, name, type, active
      ) values (
        v_profile.organization_id, p_branch_id,
        v_post_sector_id, v_post_name, v_post_type, true
      );
      v_posts_created := v_posts_created + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'sectors_created', v_sectors_created,
    'posts_created',   v_posts_created
  );
end;
$$;

-- ─────────────────────────────────────────────
-- Permissões
-- ─────────────────────────────────────────────
revoke all on function public.create_operational_post(uuid, text, public.operational_post_type, uuid, boolean) from public;
revoke all on function public.update_operational_post_record(uuid, text, public.operational_post_type, uuid, boolean, boolean) from public;
revoke all on function public.setup_segment_defaults(uuid, text[], jsonb) from public;

grant execute on function public.create_operational_post(uuid, text, public.operational_post_type, uuid, boolean) to authenticated;
grant execute on function public.update_operational_post_record(uuid, text, public.operational_post_type, uuid, boolean, boolean) to authenticated;
grant execute on function public.setup_segment_defaults(uuid, text[], jsonb) to authenticated;

-- Recarrega o schema cache do PostgREST
notify pgrst, 'reload schema';
