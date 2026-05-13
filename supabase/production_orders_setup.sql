-- Unyx Production Orders
-- Rode este arquivo no SQL Editor do Supabase.
-- Recomendado: rode supabase/pos_setup.sql e supabase/customers_setup.sql antes.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

insert into public.modules (key, name, description, active)
values (
  'unyx_production_orders',
  'Unyx Production Orders',
  'Pedidos internos para cozinha, pizzaria, padaria e outros setores de producao com cupom de preparo.',
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
join public.modules on modules.key = 'unyx_production_orders'
on conflict (organization_id, module_id) do nothing;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.production_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  order_code text not null,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text not null,
  customer_phone text,
  status text not null default 'pending'
    check (status in ('pending', 'in_production', 'ready', 'delivered', 'cancelled')),
  priority text not null default 'normal'
    check (priority in ('normal', 'high', 'urgent')),
  ordered_at timestamptz not null default now(),
  promised_at timestamptz,
  notes text,
  created_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, order_code)
);

create table if not exists public.production_order_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  production_order_id uuid not null references public.production_orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_name text not null,
  quantity numeric(12,3) not null default 1,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_production_orders_organization_time
on public.production_orders(organization_id, created_at desc);

create index if not exists idx_production_orders_branch_status
on public.production_orders(branch_id, status, created_at desc);

create index if not exists idx_production_orders_customer
on public.production_orders(customer_id)
where customer_id is not null;

create index if not exists idx_production_order_items_order
on public.production_order_items(production_order_id, sort_order);

create index if not exists idx_production_order_items_product
on public.production_order_items(product_id)
where product_id is not null;

drop trigger if exists trg_production_orders_updated_at on public.production_orders;
create trigger trg_production_orders_updated_at
before update on public.production_orders
for each row execute function public.set_updated_at();

alter table public.production_orders enable row level security;
alter table public.production_order_items enable row level security;

drop policy if exists "Users can view production orders from own organization"
on public.production_orders;
create policy "Users can view production orders from own organization"
on public.production_orders
for select
using (organization_id = public.current_organization_id());

drop policy if exists "Users can create production orders"
on public.production_orders;
create policy "Users can create production orders"
on public.production_orders
for insert
with check (
  organization_id = public.current_organization_id()
  and created_by = public.current_user_profile_id()
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
);

drop policy if exists "Users can update production orders"
on public.production_orders;
create policy "Users can update production orders"
on public.production_orders
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

drop policy if exists "Users can delete production orders"
on public.production_orders;
create policy "Users can delete production orders"
on public.production_orders
for delete
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
);

drop policy if exists "Users can view production order items"
on public.production_order_items;
create policy "Users can view production order items"
on public.production_order_items
for select
using (organization_id = public.current_organization_id());

drop policy if exists "Users can create production order items"
on public.production_order_items;
create policy "Users can create production order items"
on public.production_order_items
for insert
with check (
  organization_id = public.current_organization_id()
  and exists (
    select 1
    from public.production_orders orders
    where orders.id = production_order_id
      and orders.organization_id = public.current_organization_id()
      and (
        public.is_org_admin()
        or orders.branch_id = public.current_branch_id()
        or public.can_manage_branch(orders.branch_id)
      )
  )
);

drop policy if exists "Users can update production order items"
on public.production_order_items;
create policy "Users can update production order items"
on public.production_order_items
for update
using (
  organization_id = public.current_organization_id()
  and exists (
    select 1
    from public.production_orders orders
    where orders.id = production_order_id
      and orders.organization_id = public.current_organization_id()
      and (
        public.is_org_admin()
        or orders.branch_id = public.current_branch_id()
        or public.can_manage_branch(orders.branch_id)
      )
  )
)
with check (organization_id = public.current_organization_id());

drop policy if exists "Users can delete production order items"
on public.production_order_items;
create policy "Users can delete production order items"
on public.production_order_items
for delete
using (
  organization_id = public.current_organization_id()
  and exists (
    select 1
    from public.production_orders orders
    where orders.id = production_order_id
      and orders.organization_id = public.current_organization_id()
      and (
        public.is_org_admin()
        or orders.branch_id = public.current_branch_id()
        or public.can_manage_branch(orders.branch_id)
      )
  )
);

grant select, insert, update, delete on public.production_orders to authenticated;
grant select, insert, update, delete on public.production_order_items to authenticated;

notify pgrst, 'reload schema';
