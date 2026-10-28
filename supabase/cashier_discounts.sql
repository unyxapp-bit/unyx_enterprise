-- Descontos autorizados no caixa (ficha de desconto). Rode no SQL Editor do Supabase.
-- Seguro rodar mais de uma vez.

create table if not exists public.cashier_discounts (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations(id) on delete cascade,
  branch_id          uuid references public.branches(id) on delete set null,
  created_by         uuid references public.user_profiles(id) on delete set null,
  product_id         uuid references public.products(id) on delete set null,
  product_name       text not null,
  product_code       text,
  quantity           integer not null default 1 check (quantity > 0),
  -- Valores em centavos: preço no sistema, preço de venda e o desconto total (diferença × quantidade).
  system_price_cents integer not null check (system_price_cents >= 0),
  sale_price_cents   integer not null check (sale_price_cents >= 0),
  discount_cents     integer not null check (discount_cents >= 0),
  reason             text not null check (reason in ('preco_errado', 'outro')),
  reason_description text,
  fiscal_name        text,
  -- Onde e por quem a venda foi feita: caixa (PDV) e operador (OP).
  pdv                text,
  operator_name      text,
  created_at         timestamptz not null default now()
);

alter table public.cashier_discounts add column if not exists pdv text;
alter table public.cashier_discounts add column if not exists operator_name text;

create index if not exists idx_cashier_discounts_org_date
  on public.cashier_discounts (organization_id, created_at desc);

alter table public.cashier_discounts enable row level security;

drop policy if exists "cashier_discounts_select" on public.cashier_discounts;
create policy "cashier_discounts_select" on public.cashier_discounts
  for select using (organization_id = public.current_organization_id());

-- O histórico é só de leitura e inclusão: um desconto registrado não é editado nem apagado.
drop policy if exists "cashier_discounts_insert" on public.cashier_discounts;
create policy "cashier_discounts_insert" on public.cashier_discounts
  for insert with check (organization_id = public.current_organization_id());

revoke all on public.cashier_discounts from anon;
grant select, insert on public.cashier_discounts to authenticated;
