-- Unyx Deliveries
-- Rode este arquivo no SQL Editor do Supabase.
-- Se tambem usa PDV, rode supabase/pos_setup.sql antes para que as vendas possam originar entregas.

insert into public.modules (key, name, description, active)
values (
  'unyx_deliveries',
  'Unyx Deliveries',
  'Entregas integradas ao PDV, pedidos manuais, rotas, status, taxas e historico operacional.',
  true
)
on conflict (key) do update
set
  name = excluded.name,
  description = excluded.description,
  active = excluded.active;

insert into public.organization_modules (organization_id, module_id, enabled)
select organizations.id, modules.id, true
from public.organizations
join public.modules on modules.key = 'unyx_deliveries'
on conflict (organization_id, module_id) do nothing;

create table if not exists public.delivery_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  sale_id uuid,
  customer_id uuid,
  created_by uuid references public.user_profiles(id) on delete set null,
  assigned_employee_id uuid references public.employees(id) on delete set null,
  source text not null default 'manual' check (source in ('manual', 'pos')),
  status text not null default 'pending'
    check (status in (
      'pending',
      'preparing',
      'ready_for_dispatch',
      'out_for_delivery',
      'delivered',
      'failed',
      'cancelled'
    )),
  priority text not null default 'normal' check (priority in ('normal', 'urgent')),
  customer_name text not null,
  customer_phone text,
  postal_code text,
  address_line text not null,
  address_number text,
  complement text,
  neighborhood text,
  city text,
  state text,
  reference text,
  courier_name text,
  delivery_fee numeric(12,2) not null default 0,
  order_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'collect_on_delivery')),
  scheduled_for timestamptz,
  estimated_delivery_at timestamptz,
  dispatched_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  notes text,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_delivery_orders_organization_time
on public.delivery_orders(organization_id, created_at desc);

create index if not exists idx_delivery_orders_branch_status
on public.delivery_orders(branch_id, status, created_at desc);

create index if not exists idx_delivery_orders_sale
on public.delivery_orders(sale_id)
where sale_id is not null;

create index if not exists idx_delivery_orders_assigned_employee
on public.delivery_orders(assigned_employee_id)
where assigned_employee_id is not null;

alter table public.delivery_orders add column if not exists customer_id uuid;
alter table public.delivery_orders add column if not exists postal_code text;
alter table public.delivery_orders add column if not exists address_number text;
alter table public.delivery_orders add column if not exists complement text;

do $$ begin
  if to_regclass('public.customers') is not null
    and not exists (
      select 1
      from pg_constraint
      where conname = 'delivery_orders_customer_id_fkey'
        and conrelid = 'public.delivery_orders'::regclass
    )
  then
    alter table public.delivery_orders
      add constraint delivery_orders_customer_id_fkey
      foreign key (customer_id) references public.customers(id) on delete set null;
  end if;
end $$;

create index if not exists idx_delivery_orders_customer
on public.delivery_orders(customer_id)
where customer_id is not null;

drop trigger if exists trg_delivery_orders_updated_at on public.delivery_orders;
create trigger trg_delivery_orders_updated_at
before update on public.delivery_orders
for each row execute function public.set_updated_at();

alter table public.delivery_orders enable row level security;

drop policy if exists "Users can view delivery orders from own organization"
on public.delivery_orders;
create policy "Users can view delivery orders from own organization"
on public.delivery_orders
for select
using (organization_id = public.current_organization_id());

drop policy if exists "Users can create delivery orders"
on public.delivery_orders;
create policy "Users can create delivery orders"
on public.delivery_orders
for insert
with check (
  organization_id = public.current_organization_id()
  and created_by = public.current_user_profile_id()
  and public.current_user_role() in (
    'owner',
    'admin',
    'branch_manager',
    'supervisor',
    'operator'
  )
  and (
    public.is_org_admin()
    or branch_id = public.current_branch_id()
    or public.can_manage_branch(branch_id)
  )
);

drop policy if exists "Users can update delivery orders"
on public.delivery_orders;
create policy "Users can update delivery orders"
on public.delivery_orders
for update
using (
  organization_id = public.current_organization_id()
  and public.current_user_role() in (
    'owner',
    'admin',
    'branch_manager',
    'supervisor',
    'operator',
    'employee'
  )
  and (
    public.is_org_admin()
    or branch_id = public.current_branch_id()
    or public.can_manage_branch(branch_id)
  )
)
with check (
  organization_id = public.current_organization_id()
  and (
    public.is_org_admin()
    or branch_id = public.current_branch_id()
    or public.can_manage_branch(branch_id)
  )
);

drop policy if exists "Managers can delete delivery orders"
on public.delivery_orders;
create policy "Managers can delete delivery orders"
on public.delivery_orders
for delete
using (
  organization_id = public.current_organization_id()
  and public.current_user_role() in ('owner', 'admin', 'branch_manager', 'supervisor')
  and (
    public.is_org_admin()
    or branch_id = public.current_branch_id()
    or public.can_manage_branch(branch_id)
  )
);

grant select, insert, update, delete on public.delivery_orders to authenticated;

notify pgrst, 'reload schema';
