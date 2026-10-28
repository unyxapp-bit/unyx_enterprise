-- Encomendas de clientes (pedido anotado no balcão, com data e hora de retirada).
-- Rode no SQL Editor do Supabase. Seguro rodar mais de uma vez.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.customer_orders (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id       uuid references public.branches(id) on delete set null,
  created_by      uuid references public.user_profiles(id) on delete set null,
  customer_name   text not null,
  customer_phone  text,
  -- Quando o pedido foi feito e quando o cliente vai retirar.
  ordered_at      timestamptz not null default now(),
  pickup_at       timestamptz not null,
  -- Itens: [{ "quantity": "40", "description": "mini pães de sal" }, ...]
  items           jsonb not null default '[]'::jsonb,
  notes           text,
  -- Valores opcionais, em centavos: total combinado e sinal (entrada) já pago.
  total_cents     integer check (total_cents is null or total_cents >= 0),
  paid_cents      integer not null default 0 check (paid_cents >= 0),
  attendant_name  text,
  status          text not null default 'pendente'
                  check (status in ('pendente', 'pronta', 'retirada', 'cancelada')),
  status_at       timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_customer_orders_org_pickup
  on public.customer_orders (organization_id, pickup_at);
create index if not exists idx_customer_orders_org_status
  on public.customer_orders (organization_id, status);

drop trigger if exists trg_customer_orders_updated_at on public.customer_orders;
create trigger trg_customer_orders_updated_at
  before update on public.customer_orders
  for each row execute function public.set_updated_at();

alter table public.customer_orders enable row level security;

drop policy if exists "customer_orders_select" on public.customer_orders;
create policy "customer_orders_select" on public.customer_orders
  for select using (organization_id = public.current_organization_id());

drop policy if exists "customer_orders_insert" on public.customer_orders;
create policy "customer_orders_insert" on public.customer_orders
  for insert with check (organization_id = public.current_organization_id());

-- A encomenda pode ser corrigida e mudar de situação (pronta, retirada, cancelada); não se apaga.
drop policy if exists "customer_orders_update" on public.customer_orders;
create policy "customer_orders_update" on public.customer_orders
  for update
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

revoke all on public.customer_orders from anon;
grant select, insert, update on public.customer_orders to authenticated;

-- Faz a API do Supabase enxergar a tabela agora.
notify pgrst, 'reload schema';
