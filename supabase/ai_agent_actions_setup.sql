-- Unyx AI Agent action queue
-- Stores suggested, pending, blocked and executed decisions from the AI agent.
-- Safe to run more than once.

create table if not exists public.ai_agent_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  created_by uuid references public.user_profiles(id) on delete set null,
  intent text not null default 'analyze'
    check (intent in ('analyze', 'resolve', 'act')),
  question text,
  target jsonb,
  result jsonb not null,
  provider text,
  model text,
  action_tool text,
  action_status text,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_agent_actions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  snapshot_id uuid references public.ai_agent_snapshots(id) on delete set null,
  created_by uuid references public.user_profiles(id) on delete set null,
  approved_by uuid references public.user_profiles(id) on delete set null,
  resolved_by uuid references public.user_profiles(id) on delete set null,
  intent text not null default 'analyze'
    check (intent in ('analyze', 'resolve', 'act')),
  source text not null default 'agent'
    check (source in ('agent', 'manual')),
  status text not null default 'suggested'
    check (status in ('suggested', 'ready', 'pending_approval', 'executed', 'blocked', 'failed', 'dismissed')),
  mode text not null default 'suggest'
    check (mode in ('none', 'suggest', 'execute_with_confirmation', 'execute_auto')),
  tool_name text,
  title text not null,
  description text not null,
  reason text,
  confidence numeric(5,4) not null default 0,
  confirmation_required boolean not null default false,
  arguments jsonb not null default '{}'::jsonb,
  target jsonb,
  context_snapshot jsonb not null default '{}'::jsonb,
  action_result jsonb not null default '{}'::jsonb,
  approved_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ai_agent_actions_org_branch_status
on public.ai_agent_actions(organization_id, branch_id, status, created_at desc);

create index if not exists idx_ai_agent_actions_snapshot
on public.ai_agent_actions(snapshot_id)
where snapshot_id is not null;

drop trigger if exists trg_ai_agent_actions_updated_at on public.ai_agent_actions;
create trigger trg_ai_agent_actions_updated_at
before update on public.ai_agent_actions
for each row execute function public.set_updated_at();

alter table public.ai_agent_actions enable row level security;

drop policy if exists "ai_agent_actions_select" on public.ai_agent_actions;
create policy "ai_agent_actions_select"
on public.ai_agent_actions
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

drop policy if exists "ai_agent_actions_insert" on public.ai_agent_actions;
create policy "ai_agent_actions_insert"
on public.ai_agent_actions
for insert
with check (
  organization_id = public.current_organization_id()
  and (
    created_by is null
    or created_by = public.current_user_profile_id()
  )
  and (
    public.is_org_admin()
    or branch_id is null
    or branch_id = public.current_branch_id()
    or public.can_manage_branch(branch_id)
  )
);

drop policy if exists "ai_agent_actions_update" on public.ai_agent_actions;
create policy "ai_agent_actions_update"
on public.ai_agent_actions
for update
using (
  organization_id = public.current_organization_id()
  and (
    public.is_org_admin()
    or branch_id is null
    or branch_id = public.current_branch_id()
    or public.can_manage_branch(branch_id)
  )
)
with check (
  organization_id = public.current_organization_id()
  and (
    public.is_org_admin()
    or branch_id is null
    or branch_id = public.current_branch_id()
    or public.can_manage_branch(branch_id)
  )
);

grant select, insert, update on public.ai_agent_actions to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.ai_agent_actions;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

notify pgrst, 'reload schema';
