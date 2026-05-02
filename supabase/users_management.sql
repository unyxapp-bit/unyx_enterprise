-- Rode este arquivo no SQL Editor do Supabase.
-- Cria a tabela de convites e RPCs de gerenciamento de usuarios.
-- É seguro rodar multiplas vezes (idempotente).

-- ─────────────────────────────────────────────
-- 0. Enum user_role (cria se nao existir)
-- ─────────────────────────────────────────────
do $$
begin
  create type public.user_role as enum (
    'owner', 'admin', 'branch_manager', 'supervisor', 'operator', 'employee'
  );
exception when duplicate_object then null;
end $$;

-- ─────────────────────────────────────────────
-- 1. Tabela invitations
-- ─────────────────────────────────────────────
create table if not exists public.invitations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email           text not null,
  role            public.user_role not null default 'employee',
  branch_id       uuid references public.branches(id) on delete set null,
  invited_by      uuid references public.user_profiles(id) on delete set null,
  status          text not null default 'pending',
  token           text not null unique default encode(gen_random_bytes(32), 'hex'),
  expires_at      timestamptz not null default (now() + interval '7 days'),
  created_at      timestamptz not null default now(),
  constraint invitations_status_check check (status in ('pending', 'accepted', 'cancelled', 'expired'))
);

create index if not exists idx_invitations_organization on public.invitations(organization_id);
create index if not exists idx_invitations_email        on public.invitations(lower(email));
create index if not exists idx_invitations_status       on public.invitations(organization_id, status);

alter table public.invitations enable row level security;

drop policy if exists "invitations_select" on public.invitations;
create policy "invitations_select" on public.invitations
  for select using (organization_id = public.current_organization_id());

drop policy if exists "invitations_insert" on public.invitations;
create policy "invitations_insert" on public.invitations
  for insert with check (
    organization_id = public.current_organization_id()
    and public.current_user_role() in ('owner', 'admin')
  );

drop policy if exists "invitations_update" on public.invitations;
create policy "invitations_update" on public.invitations
  for update
  using (organization_id = public.current_organization_id() and public.current_user_role() in ('owner', 'admin'))
  with check (organization_id = public.current_organization_id());

grant select, insert, update on public.invitations to authenticated;

-- ─────────────────────────────────────────────
-- 2. RPC: invite_user
-- ─────────────────────────────────────────────
create or replace function public.invite_user(
  p_email     text,
  p_role      public.user_role default 'employee',
  p_branch_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id      uuid;
  v_user_id     uuid;
  v_caller_role public.user_role;
  v_invite_id   uuid;
  v_email       text := lower(trim(p_email));
begin
  select id, organization_id into v_user_id, v_org_id
  from public.user_profiles
  where auth_user_id = auth.uid() and active = true
  limit 1;

  if v_user_id is null then
    raise exception 'Perfil do usuario nao encontrado.';
  end if;

  v_caller_role := public.current_user_role();
  if v_caller_role not in ('owner', 'admin') then
    raise exception 'Apenas proprietarios e administradores podem convidar usuarios.';
  end if;

  if v_email is null or length(v_email) < 3 or v_email not like '%@%' then
    raise exception 'Email invalido.';
  end if;

  -- Nao convidar quem ja e usuario ativo da org
  if exists (
    select 1 from public.user_profiles
    where lower(email) = v_email
      and organization_id = v_org_id
      and active = true
  ) then
    raise exception 'Este email ja pertence a um usuario ativo da organizacao.';
  end if;

  -- Nao pode admin convidar owner
  if p_role = 'owner' and v_caller_role = 'admin' then
    raise exception 'Administradores nao podem convidar com papel de Proprietario.';
  end if;

  -- Branch deve pertencer a org
  if p_branch_id is not null and not exists (
    select 1 from public.branches
    where id = p_branch_id and organization_id = v_org_id and active = true
  ) then
    raise exception 'Filial invalida ou inativa.';
  end if;

  -- Cancelar convites pendentes anteriores para o mesmo email
  update public.invitations
  set status = 'cancelled'
  where organization_id = v_org_id
    and lower(email) = v_email
    and status = 'pending';

  insert into public.invitations (organization_id, email, role, branch_id, invited_by, status, expires_at)
  values (v_org_id, v_email, p_role, p_branch_id, v_user_id, 'pending', now() + interval '7 days')
  returning id into v_invite_id;

  return v_invite_id;
end;
$$;

-- ─────────────────────────────────────────────
-- 3. RPC: cancel_invitation
-- ─────────────────────────────────────────────
create or replace function public.cancel_invitation(p_invitation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  select organization_id into v_org_id
  from public.user_profiles
  where auth_user_id = auth.uid() and active = true
  limit 1;

  if v_org_id is null then
    raise exception 'Perfil do usuario nao encontrado.';
  end if;

  if public.current_user_role() not in ('owner', 'admin') then
    raise exception 'Sem permissao para cancelar convites.';
  end if;

  update public.invitations
  set status = 'cancelled'
  where id = p_invitation_id
    and organization_id = v_org_id
    and status = 'pending';

  if not found then
    raise exception 'Convite nao encontrado ou ja processado.';
  end if;

  return true;
end;
$$;

-- ─────────────────────────────────────────────
-- 4. RPC: mark_invitation_accepted (chamado no onboarding)
-- ─────────────────────────────────────────────
create or replace function public.mark_invitation_accepted(p_email text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
begin
  update public.invitations
  set status = 'accepted'
  where lower(email) = v_email
    and status = 'pending'
    and expires_at > now();

  return found;
end;
$$;

-- ─────────────────────────────────────────────
-- 5. RPC: set_user_active
-- ─────────────────────────────────────────────
create or replace function public.set_user_active(
  p_profile_id uuid,
  p_active     boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id      uuid;
  v_user_id     uuid;
  v_caller_role public.user_role;
  v_target_role public.user_role;
begin
  select id, organization_id into v_user_id, v_org_id
  from public.user_profiles
  where auth_user_id = auth.uid() and active = true
  limit 1;

  if v_user_id is null then
    raise exception 'Perfil do usuario nao encontrado.';
  end if;

  v_caller_role := public.current_user_role();
  if v_caller_role not in ('owner', 'admin') then
    raise exception 'Sem permissao para alterar status de usuarios.';
  end if;

  if p_profile_id = v_user_id then
    raise exception 'Nao e possivel alterar o proprio status.';
  end if;

  select role into v_target_role
  from public.user_profiles
  where id = p_profile_id and organization_id = v_org_id;

  if not found then
    raise exception 'Usuario nao encontrado nesta organizacao.';
  end if;

  -- Admin nao pode desativar owner
  if v_target_role = 'owner' and v_caller_role = 'admin' then
    raise exception 'Administradores nao podem desativar Proprietarios.';
  end if;

  -- Nao desativar o ultimo owner ativo
  if not p_active and v_target_role = 'owner' then
    if (select count(*) from public.user_profiles
        where organization_id = v_org_id and role = 'owner' and active = true) <= 1 then
      raise exception 'Nao e possivel desativar o unico Proprietario ativo da organizacao.';
    end if;
  end if;

  update public.user_profiles
  set active = p_active
  where id = p_profile_id and organization_id = v_org_id;

  return true;
end;
$$;

-- ─────────────────────────────────────────────
-- 6. RPC: set_user_branch
-- ─────────────────────────────────────────────
create or replace function public.set_user_branch(
  p_profile_id uuid,
  p_branch_id  uuid  -- null para remover filial
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id  uuid;
  v_user_id uuid;
begin
  select id, organization_id into v_user_id, v_org_id
  from public.user_profiles
  where auth_user_id = auth.uid() and active = true
  limit 1;

  if v_user_id is null then
    raise exception 'Perfil do usuario nao encontrado.';
  end if;

  if public.current_user_role() not in ('owner', 'admin') then
    raise exception 'Sem permissao para atribuir filial a usuarios.';
  end if;

  if not exists (
    select 1 from public.user_profiles
    where id = p_profile_id and organization_id = v_org_id
  ) then
    raise exception 'Usuario nao encontrado nesta organizacao.';
  end if;

  if p_branch_id is not null and not exists (
    select 1 from public.branches
    where id = p_branch_id and organization_id = v_org_id and active = true
  ) then
    raise exception 'Filial invalida ou inativa.';
  end if;

  update public.user_profiles
  set branch_id = p_branch_id
  where id = p_profile_id and organization_id = v_org_id;

  return true;
end;
$$;

-- ─────────────────────────────────────────────
-- 7. RPC: remove_user_from_org
-- ─────────────────────────────────────────────
create or replace function public.remove_user_from_org(p_profile_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id      uuid;
  v_user_id     uuid;
  v_caller_role public.user_role;
  v_target_role public.user_role;
begin
  select id, organization_id into v_user_id, v_org_id
  from public.user_profiles
  where auth_user_id = auth.uid() and active = true
  limit 1;

  if v_user_id is null then
    raise exception 'Perfil do usuario nao encontrado.';
  end if;

  v_caller_role := public.current_user_role();
  if v_caller_role not in ('owner', 'admin') then
    raise exception 'Sem permissao para remover usuarios.';
  end if;

  if p_profile_id = v_user_id then
    raise exception 'Nao e possivel remover a si mesmo da organizacao.';
  end if;

  select role into v_target_role
  from public.user_profiles
  where id = p_profile_id and organization_id = v_org_id;

  if not found then
    raise exception 'Usuario nao encontrado nesta organizacao.';
  end if;

  if v_target_role = 'owner' and v_caller_role = 'admin' then
    raise exception 'Administradores nao podem remover Proprietarios.';
  end if;

  if v_target_role = 'owner' then
    if (select count(*) from public.user_profiles
        where organization_id = v_org_id and role = 'owner' and active = true) <= 1 then
      raise exception 'Nao e possivel remover o unico Proprietario da organizacao.';
    end if;
  end if;

  -- Desativa e rebaixa para employee (preserva historico)
  update public.user_profiles
  set active = false, role = 'employee'
  where id = p_profile_id and organization_id = v_org_id;

  return true;
end;
$$;

-- ─────────────────────────────────────────────
-- Permissões dos RPCs
-- ─────────────────────────────────────────────
revoke all on function public.invite_user(text, public.user_role, uuid) from public;
revoke all on function public.cancel_invitation(uuid) from public;
revoke all on function public.mark_invitation_accepted(text) from public;
revoke all on function public.set_user_active(uuid, boolean) from public;
revoke all on function public.set_user_branch(uuid, uuid) from public;
revoke all on function public.remove_user_from_org(uuid) from public;

grant execute on function public.invite_user(text, public.user_role, uuid) to authenticated;
grant execute on function public.cancel_invitation(uuid) to authenticated;
grant execute on function public.mark_invitation_accepted(text) to authenticated;
grant execute on function public.set_user_active(uuid, boolean) to authenticated;
grant execute on function public.set_user_branch(uuid, uuid) to authenticated;
grant execute on function public.remove_user_from_org(uuid) to authenticated;

notify pgrst, 'reload schema';
