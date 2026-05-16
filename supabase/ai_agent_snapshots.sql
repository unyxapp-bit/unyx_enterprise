-- Rode este arquivo isoladamente no SQL Editor do Supabase.
-- Cria a persistencia compartilhada do ultimo resultado do Unyx AI Agent.
-- Seguro para rodar multiplas vezes.

create table if not exists public.ai_agent_snapshots (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id       uuid references public.branches(id) on delete set null,
  created_by      uuid references public.user_profiles(id) on delete set null,
  intent          text not null default 'analyze'
                  check (intent in ('analyze', 'resolve', 'act')),
  question        text,
  target          jsonb,
  result          jsonb not null,
  provider        text,
  model           text,
  action_tool     text,
  action_status   text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_ai_agent_snapshots_org_branch_created
on public.ai_agent_snapshots(organization_id, branch_id, created_at desc);

create index if not exists idx_ai_agent_snapshots_created
on public.ai_agent_snapshots(created_at desc);

alter table public.ai_agent_snapshots enable row level security;

drop policy if exists "ai_agent_snapshots_select" on public.ai_agent_snapshots;
create policy "ai_agent_snapshots_select"
on public.ai_agent_snapshots
for select
using (
  organization_id = public.current_organization_id()
  and (
    public.is_org_admin()
    or branch_id is null
    or branch_id = public.current_branch_id()
    or public.can_manage_branch(branch_id)
  )
);

drop policy if exists "ai_agent_snapshots_insert" on public.ai_agent_snapshots;
create policy "ai_agent_snapshots_insert"
on public.ai_agent_snapshots
for insert
with check (
  organization_id = public.current_organization_id()
  and created_by = public.current_user_profile_id()
  and (
    public.is_org_admin()
    or branch_id is null
    or branch_id = public.current_branch_id()
    or public.can_manage_branch(branch_id)
  )
);

grant select, insert on public.ai_agent_snapshots to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.ai_agent_snapshots;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
