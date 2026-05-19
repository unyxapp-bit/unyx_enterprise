-- Unyx Operational Fiscal Flow
-- Adds fiscal-oriented operational statuses and queue/bottleneck signals.
-- Safe to run more than once.

alter type public.operational_status_type add value if not exists 'pico';
alter type public.operational_status_type add value if not exists 'apoio_operacional';
alter type public.operational_status_type add value if not exists 'fechamento';

alter table public.operational_settings
  add column if not exists queue_attention_threshold integer not null default 4,
  add column if not exists queue_critical_threshold integer not null default 8,
  add column if not exists cash_count_alert_amount numeric(12,2) not null default 500;

create table if not exists public.operational_queue (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  post_id uuid references public.operational_posts(id) on delete set null,
  sector_id uuid references public.sectors(id) on delete set null,
  created_by uuid references public.user_profiles(id) on delete set null,
  resolved_by uuid references public.user_profiles(id) on delete set null,
  queue_type text not null default 'checkout'
    check (queue_type in ('checkout', 'service', 'delivery', 'self_checkout', 'support', 'closing', 'other')),
  severity text not null default 'attention'
    check (severity in ('normal', 'attention', 'critical')),
  status text not null default 'open'
    check (status in ('open', 'monitoring', 'resolved', 'cancelled')),
  title text not null,
  customer_count integer not null default 0 check (customer_count >= 0),
  wait_minutes integer not null default 0 check (wait_minutes >= 0),
  required_posts integer check (required_posts is null or required_posts >= 0),
  active_posts integer check (active_posts is null or active_posts >= 0),
  notes text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_operational_queue_organization
on public.operational_queue(organization_id, created_at desc);

create index if not exists idx_operational_queue_branch_status
on public.operational_queue(branch_id, status, severity, created_at desc);

create index if not exists idx_operational_queue_post
on public.operational_queue(post_id)
where post_id is not null;

drop trigger if exists trg_operational_queue_updated_at on public.operational_queue;
create trigger trg_operational_queue_updated_at
before update on public.operational_queue
for each row execute function public.set_updated_at();

alter table public.operational_queue enable row level security;

drop policy if exists "operational_queue_select" on public.operational_queue;
create policy "operational_queue_select" on public.operational_queue
  for select using (organization_id = public.current_organization_id());

drop policy if exists "operational_queue_insert" on public.operational_queue;
create policy "operational_queue_insert" on public.operational_queue
  for insert with check (
    organization_id = public.current_organization_id()
    and public.can_manage_branch(branch_id)
  );

drop policy if exists "operational_queue_update" on public.operational_queue;
create policy "operational_queue_update" on public.operational_queue
  for update
  using (
    organization_id = public.current_organization_id()
    and public.can_manage_branch(branch_id)
  )
  with check (
    organization_id = public.current_organization_id()
    and public.can_manage_branch(branch_id)
  );

grant select, insert, update on public.operational_queue to authenticated;

notify pgrst, 'reload schema';
