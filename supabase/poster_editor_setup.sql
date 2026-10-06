-- Poster editor cloud workspace and private template assets.
-- Run this script in the Supabase SQL Editor for the target project.

create table if not exists public.poster_editor_workspaces (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.poster_editor_workspaces enable row level security;
grant select, insert, update, delete on public.poster_editor_workspaces to authenticated;

drop policy if exists "poster workspace read own organization" on public.poster_editor_workspaces;
create policy "poster workspace read own organization"
on public.poster_editor_workspaces for select to authenticated
using (
  auth_user_id = (select auth.uid())
  and organization_id = public.current_organization_id()
);

drop policy if exists "poster workspace insert own organization" on public.poster_editor_workspaces;
create policy "poster workspace insert own organization"
on public.poster_editor_workspaces for insert to authenticated
with check (
  auth_user_id = (select auth.uid())
  and organization_id = public.current_organization_id()
);

drop policy if exists "poster workspace update own organization" on public.poster_editor_workspaces;
create policy "poster workspace update own organization"
on public.poster_editor_workspaces for update to authenticated
using (
  auth_user_id = (select auth.uid())
  and organization_id = public.current_organization_id()
)
with check (
  auth_user_id = (select auth.uid())
  and organization_id = public.current_organization_id()
);

drop policy if exists "poster workspace delete own organization" on public.poster_editor_workspaces;
create policy "poster workspace delete own organization"
on public.poster_editor_workspaces for delete to authenticated
using (
  auth_user_id = (select auth.uid())
  and organization_id = public.current_organization_id()
);

