-- Unyx Customers
-- Rode este arquivo no SQL Editor do Supabase.
-- Integra clientes, enderecos para entregas e codigo numerico automatico.

insert into public.modules (key, name, description, active)
values (
  'unyx_customers',
  'Unyx Customers',
  'Cadastro unico de clientes com codigo numerico, contato, endereco e integracao com entregas.',
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
join public.modules on modules.key = 'unyx_customers'
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

create table if not exists public.customer_code_counters (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  next_number integer not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  customer_code text not null,
  name text not null,
  document text,
  phone text,
  email text,
  birth_date date,
  status text not null default 'active'
    check (status in ('active', 'inactive', 'blocked')),
  postal_code text,
  address_line text,
  address_number text,
  complement text,
  neighborhood text,
  city text,
  state text,
  reference text,
  notes text,
  marketing_opt_in boolean not null default false,
  created_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_customer_code_digits check (customer_code ~ '^[0-9]+$'),
  constraint customers_customer_code_unique unique (organization_id, customer_code)
);

create index if not exists idx_customers_organization_code
on public.customers(organization_id, customer_code);

create index if not exists idx_customers_organization_name
on public.customers(organization_id, lower(name));

create index if not exists idx_customers_branch_status
on public.customers(branch_id, status);

create index if not exists idx_customers_phone
on public.customers(phone)
where phone is not null;

create index if not exists idx_customers_document
on public.customers(document)
where document is not null;

create or replace function public.assign_customer_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next integer;
begin
  if new.customer_code is null or btrim(new.customer_code) = '' then
    insert into public.customer_code_counters (organization_id, next_number)
    values (new.organization_id, 1)
    on conflict (organization_id) do nothing;

    select next_number
      into v_next
      from public.customer_code_counters
     where organization_id = new.organization_id
     for update;

    update public.customer_code_counters
       set next_number = v_next + 1,
           updated_at = now()
     where organization_id = new.organization_id;

    new.customer_code := lpad(v_next::text, 3, '0');
  end if;

  if new.customer_code !~ '^[0-9]+$' then
    raise exception 'Codigo do cliente deve conter somente numeros.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_customers_assign_code on public.customers;
create trigger trg_customers_assign_code
before insert on public.customers
for each row execute function public.assign_customer_code();

drop trigger if exists trg_customers_updated_at on public.customers;
create trigger trg_customers_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

do $$ begin
  if to_regclass('public.delivery_orders') is not null then
    alter table public.delivery_orders add column if not exists customer_id uuid;
    alter table public.delivery_orders add column if not exists postal_code text;
    alter table public.delivery_orders add column if not exists address_number text;
    alter table public.delivery_orders add column if not exists complement text;

    if not exists (
      select 1
      from pg_constraint
      where conname = 'delivery_orders_customer_id_fkey'
        and conrelid = 'public.delivery_orders'::regclass
    ) then
      alter table public.delivery_orders
        add constraint delivery_orders_customer_id_fkey
        foreign key (customer_id) references public.customers(id) on delete set null;
    end if;

    create index if not exists idx_delivery_orders_customer
    on public.delivery_orders(customer_id)
    where customer_id is not null;
  end if;
exception when duplicate_object then null; end $$;

alter table public.customers enable row level security;

drop policy if exists "Users can view customers from own organization"
on public.customers;
create policy "Users can view customers from own organization"
on public.customers
for select
using (organization_id = public.current_organization_id());

drop policy if exists "Users can create customers"
on public.customers;
create policy "Users can create customers"
on public.customers
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
    or branch_id is null
    or branch_id = public.current_branch_id()
    or public.can_manage_branch(branch_id)
  )
);

drop policy if exists "Users can update customers"
on public.customers;
create policy "Users can update customers"
on public.customers
for update
using (
  organization_id = public.current_organization_id()
  and public.current_user_role() in (
    'owner',
    'admin',
    'branch_manager',
    'supervisor',
    'operator'
  )
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

drop policy if exists "Managers can delete customers"
on public.customers;
create policy "Managers can delete customers"
on public.customers
for delete
using (
  organization_id = public.current_organization_id()
  and public.current_user_role() in ('owner', 'admin', 'branch_manager', 'supervisor')
  and (
    public.is_org_admin()
    or branch_id is null
    or branch_id = public.current_branch_id()
    or public.can_manage_branch(branch_id)
  )
);

grant select, insert, update, delete on public.customers to authenticated;

notify pgrst, 'reload schema';
