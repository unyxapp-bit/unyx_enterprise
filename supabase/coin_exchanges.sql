-- Troca de moedas: histórico das trocas e percentuais de acréscimo por organização.
-- Rode no SQL Editor do Supabase. Seguro rodar mais de uma vez.

create table if not exists public.coin_exchange_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  rates           jsonb not null default '{"c5":10,"c10":10,"c25":5,"c50":5,"r1":5}'::jsonb,
  updated_by      uuid references public.user_profiles(id) on delete set null,
  updated_at      timestamptz not null default now()
);

create table if not exists public.coin_exchanges (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id       uuid references public.branches(id) on delete set null,
  created_by      uuid references public.user_profiles(id) on delete set null,
  customer_name   text,
  -- Fiscal que responde pela troca (editável na tela; created_by é quem registrou).
  fiscal_name     text,
  notes           text,
  -- [{ "id": "c5", "quantity": 100, "rate": 10, "face_cents": 500, "bonus_cents": 50 }, ...]
  items           jsonb not null default '[]'::jsonb,
  coin_count      integer not null default 0 check (coin_count >= 0),
  face_cents      integer not null default 0 check (face_cents >= 0),
  bonus_cents     integer not null default 0 check (bonus_cents >= 0),
  total_cents     integer not null default 0 check (total_cents >= 0),
  created_at      timestamptz not null default now()
);

alter table public.coin_exchanges add column if not exists fiscal_name text;

create index if not exists idx_coin_exchanges_org_date
  on public.coin_exchanges (organization_id, created_at desc);

alter table public.coin_exchange_settings enable row level security;
alter table public.coin_exchanges enable row level security;

drop policy if exists "coin_exchange_settings_select" on public.coin_exchange_settings;
create policy "coin_exchange_settings_select" on public.coin_exchange_settings
  for select using (organization_id = public.current_organization_id());

drop policy if exists "coin_exchange_settings_insert" on public.coin_exchange_settings;
create policy "coin_exchange_settings_insert" on public.coin_exchange_settings
  for insert with check (organization_id = public.current_organization_id());

drop policy if exists "coin_exchange_settings_update" on public.coin_exchange_settings;
create policy "coin_exchange_settings_update" on public.coin_exchange_settings
  for update
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

-- O histórico é só de leitura e inclusão: uma troca registrada não é editada nem apagada.
drop policy if exists "coin_exchanges_select" on public.coin_exchanges;
create policy "coin_exchanges_select" on public.coin_exchanges
  for select using (organization_id = public.current_organization_id());

drop policy if exists "coin_exchanges_insert" on public.coin_exchanges;
create policy "coin_exchanges_insert" on public.coin_exchanges
  for insert with check (organization_id = public.current_organization_id());

revoke all on public.coin_exchange_settings from anon;
revoke all on public.coin_exchanges from anon;
grant select, insert, update on public.coin_exchange_settings to authenticated;
grant select, insert on public.coin_exchanges to authenticated;

-- Moedas deixadas pelo cliente para trocar depois (comprovante com duas vias).
create table if not exists public.coin_deposits (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id       uuid references public.branches(id) on delete set null,
  created_by      uuid references public.user_profiles(id) on delete set null,
  customer_name   text not null,
  customer_phone  text,
  left_at         timestamptz not null default now(),
  estimated_cents integer not null default 0 check (estimated_cents >= 0),
  fiscal_name     text,
  notes           text,
  status          text not null default 'pendente'
                    check (status in ('pendente', 'concluida', 'cancelada')),
  completed_at    timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists idx_coin_deposits_org_status
  on public.coin_deposits (organization_id, status, left_at desc);

alter table public.coin_deposits enable row level security;

drop policy if exists "coin_deposits_select" on public.coin_deposits;
create policy "coin_deposits_select" on public.coin_deposits
  for select using (organization_id = public.current_organization_id());

drop policy if exists "coin_deposits_insert" on public.coin_deposits;
create policy "coin_deposits_insert" on public.coin_deposits
  for insert with check (organization_id = public.current_organization_id());

-- Só o status muda depois de criado (concluir/cancelar); a ficha nunca é apagada.
drop policy if exists "coin_deposits_update" on public.coin_deposits;
create policy "coin_deposits_update" on public.coin_deposits
  for update
  using (organization_id = public.current_organization_id())
  with check (organization_id = public.current_organization_id());

revoke all on public.coin_deposits from anon;
grant select, insert, update on public.coin_deposits to authenticated;

-- A troca pode nascer de um recebimento (moedas deixadas): guarda o telefone do cliente e o vínculo.
alter table public.coin_exchanges add column if not exists customer_phone text;
alter table public.coin_exchanges
  add column if not exists deposit_id uuid references public.coin_deposits(id) on delete set null;
