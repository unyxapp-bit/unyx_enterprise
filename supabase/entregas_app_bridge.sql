-- Ponte entre o APK de OCR de cupons e a tela web de Entregas.
--
-- O APK grava em public.entregas pela Edge Function `entregas`.
-- Este trigger espelha cada cupom em public.delivery_orders, que e a tabela
-- consumida pela tela React src/features/deliveries/DeliveriesPage.tsx.

alter table public.delivery_orders
  add column if not exists app_entrega_id bigint unique;

create index if not exists idx_delivery_orders_app_entrega_id
on public.delivery_orders(app_entrega_id)
where app_entrega_id is not null;

alter table public.entregas
  add column if not exists organization_id uuid;

alter table public.entregas
  add column if not exists branch_id uuid;

alter table public.entregas
  add column if not exists origem text not null default 'app_android_ocr';

alter table public.entregas
  alter column origem set default 'app_android_ocr';

create or replace function public.map_app_entrega_status(status text)
returns text
language sql
immutable
as $$
  select case status
    when 'AGUARDANDO' then 'pending'
    when 'EM_SEPARACAO' then 'preparing'
    when 'AGUARDANDO_MOTORISTA' then 'ready_for_dispatch'
    when 'EM_ROTA' then 'out_for_delivery'
    when 'ENTREGUE' then 'delivered'
    when 'CANCELADA' then 'cancelled'
    else 'pending'
  end
$$;

create or replace function public.app_entrega_items(caixas text[])
returns jsonb
language sql
immutable
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'name', 'Caixa ' || caixa,
        'quantity', 1,
        'notes', null
      )
      order by ordinality
    ),
    '[]'::jsonb
  )
  from unnest(coalesce(caixas, '{}'::text[])) with ordinality as caixa(caixa, ordinality)
  where nullif(trim(caixa), '') is not null
$$;

create table if not exists public.delivery_scope_defaults (
  scope_key text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  updated_at timestamptz not null default now()
);

insert into public.delivery_scope_defaults (
  scope_key,
  organization_id,
  branch_id
)
values (
  'default',
  'f05e72e7-9dd2-4ba4-b898-a55a6ed03850'::uuid,
  '0832d6f7-7706-4511-aeb3-06c8e055484d'::uuid
)
on conflict (scope_key) do update
set
  organization_id = excluded.organization_id,
  branch_id = excluded.branch_id,
  updated_at = now();

create or replace function public.resolve_entrega_scope(
  p_criado_por text,
  p_organization_id uuid default null,
  p_branch_id uuid default null
)
returns table (
  organization_id uuid,
  branch_id uuid,
  created_by uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile record;
  v_creator_uuid uuid;
begin
  organization_id := p_organization_id;
  branch_id := p_branch_id;
  created_by := null;

  if p_criado_por ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    v_creator_uuid := p_criado_por::uuid;

    select up.id, up.organization_id, up.branch_id
    into v_profile
    from public.user_profiles up
    where up.auth_user_id = v_creator_uuid
       or up.id = v_creator_uuid
    limit 1;

    if found then
      created_by := v_profile.id;
      organization_id := coalesce(organization_id, v_profile.organization_id);
      branch_id := coalesce(branch_id, v_profile.branch_id);
      return next;
      return;
    end if;
  end if;

  if nullif(trim(p_criado_por), '') is not null then
    select up.id, up.organization_id, up.branch_id
    into v_profile
    from public.user_profiles up
    where lower(up.email) = lower(p_criado_por)
       or lower(up.name) = lower(p_criado_por)
    limit 1;

    if found then
      created_by := v_profile.id;
      organization_id := coalesce(organization_id, v_profile.organization_id);
      branch_id := coalesce(branch_id, v_profile.branch_id);
      return next;
      return;
    end if;
  end if;

  select d.organization_id, d.branch_id
  into organization_id, branch_id
  from public.delivery_scope_defaults d
  where d.scope_key = 'default'
  limit 1;

  return next;
end;
$$;

create or replace function public.sync_app_entrega_to_delivery_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scope record;
  v_status text := public.map_app_entrega_status(new.status);
  v_notes text;
begin
  select *
  into v_scope
  from public.resolve_entrega_scope(
    new.criado_por,
    new.organization_id,
    new.branch_id
  );

  v_notes := concat_ws(
    E'\n',
    case
      when new.origem = 'app_android_manual'
        then 'Criado manualmente no app Android.'
      else 'Importado automaticamente pelo app Android OCR.'
    end,
    'Nota: ' || nullif(new.nota, ''),
    'Empacotador: ' || nullif(new.empacotador, ''),
    case
      when coalesce(array_length(new.caixas, 1), 0) > 0
        then 'Caixas: ' || array_to_string(new.caixas, ', ')
      else null
    end
  );

  insert into public.delivery_orders (
    app_entrega_id,
    organization_id,
    branch_id,
    sale_id,
    customer_id,
    created_by,
    assigned_employee_id,
    source,
    status,
    priority,
    customer_name,
    customer_phone,
    postal_code,
    address_line,
    address_number,
    complement,
    neighborhood,
    city,
    state,
    reference,
    courier_name,
    delivery_fee,
    order_amount,
    total_amount,
    payment_status,
    scheduled_for,
    estimated_delivery_at,
    dispatched_at,
    delivered_at,
    cancelled_at,
    notes,
    items,
    created_at,
    updated_at
  )
  values (
    new.id,
    v_scope.organization_id,
    v_scope.branch_id,
    null,
    null,
    v_scope.created_by,
    null,
    'manual',
    v_status,
    'normal',
    trim(new.cliente),
    nullif(trim(new.telefone), ''),
    null,
    trim(new.rua),
    nullif(trim(new.numero), ''),
    null,
    nullif(trim(new.bairro), ''),
    nullif(trim(new.cidade), ''),
    'MG',
    null,
    null,
    0,
    coalesce(new.valor, 0),
    coalesce(new.valor, 0),
    case
      when new.origem = 'app_android_manual' then 'collect_on_delivery'
      when new.origem = 'app_android_ocr' then 'paid'
      else 'pending'
    end,
    null,
    null,
    case when v_status = 'out_for_delivery' then now() else null end,
    case when v_status = 'delivered' then now() else null end,
    case when v_status in ('cancelled', 'failed') then now() else null end,
    v_notes,
    public.app_entrega_items(new.caixas),
    coalesce(new.criado_em, now()),
    now()
  )
  on conflict (app_entrega_id) do update
  set
    organization_id = excluded.organization_id,
    branch_id = excluded.branch_id,
    created_by = excluded.created_by,
    status = excluded.status,
    customer_name = excluded.customer_name,
    customer_phone = excluded.customer_phone,
    address_line = excluded.address_line,
    address_number = excluded.address_number,
    neighborhood = excluded.neighborhood,
    city = excluded.city,
    order_amount = excluded.order_amount,
    total_amount = excluded.total_amount,
    payment_status = excluded.payment_status,
    notes = excluded.notes,
    items = excluded.items,
    dispatched_at = coalesce(public.delivery_orders.dispatched_at, excluded.dispatched_at),
    delivered_at = case
      when excluded.status = 'delivered' then coalesce(public.delivery_orders.delivered_at, now())
      else public.delivery_orders.delivered_at
    end,
    cancelled_at = case
      when excluded.status in ('cancelled', 'failed') then coalesce(public.delivery_orders.cancelled_at, now())
      else public.delivery_orders.cancelled_at
    end,
    updated_at = now();
  return new;
end;
$$;

create or replace function public.delete_app_entrega_delivery_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.delivery_orders
  where app_entrega_id = old.id;
  return old;
end;
$$;

drop trigger if exists trg_sync_app_entrega_to_delivery_order on public.entregas;
create trigger trg_sync_app_entrega_to_delivery_order
after insert or update on public.entregas
for each row execute function public.sync_app_entrega_to_delivery_order();

drop trigger if exists trg_delete_app_entrega_delivery_order on public.entregas;
create trigger trg_delete_app_entrega_delivery_order
after delete on public.entregas
for each row execute function public.delete_app_entrega_delivery_order();

insert into public.delivery_orders (
  app_entrega_id,
  organization_id,
  branch_id,
  created_by,
  source,
  status,
  priority,
  customer_name,
  customer_phone,
  address_line,
  address_number,
  neighborhood,
  city,
  state,
  delivery_fee,
  order_amount,
  total_amount,
  payment_status,
  notes,
  items,
  created_at,
  updated_at
)
select
  entregas.id,
  scope.organization_id,
  scope.branch_id,
  scope.created_by,
  'manual',
  public.map_app_entrega_status(entregas.status),
  'normal',
  trim(entregas.cliente),
  nullif(trim(entregas.telefone), ''),
  trim(entregas.rua),
  nullif(trim(entregas.numero), ''),
  nullif(trim(entregas.bairro), ''),
  nullif(trim(entregas.cidade), ''),
  'MG',
  0,
  coalesce(entregas.valor, 0),
  coalesce(entregas.valor, 0),
  case
    when entregas.origem = 'app_android_manual' then 'collect_on_delivery'
    when entregas.origem = 'app_android_ocr' then 'paid'
    else 'pending'
  end,
  concat_ws(
    E'\n',
    case
      when entregas.origem = 'app_android_manual'
        then 'Criado manualmente no app Android.'
      else 'Importado automaticamente pelo app Android OCR.'
    end,
    'Nota: ' || nullif(entregas.nota, ''),
    'Empacotador: ' || nullif(entregas.empacotador, ''),
    case
      when coalesce(array_length(entregas.caixas, 1), 0) > 0
        then 'Caixas: ' || array_to_string(entregas.caixas, ', ')
      else null
    end
  ),
  public.app_entrega_items(entregas.caixas),
  coalesce(entregas.criado_em, now()),
  now()
from public.entregas
cross join lateral public.resolve_entrega_scope(
  entregas.criado_por,
  entregas.organization_id,
  entregas.branch_id
) as scope
on conflict (app_entrega_id) do update
set
  organization_id = excluded.organization_id,
  branch_id = excluded.branch_id,
  created_by = excluded.created_by,
  source = excluded.source,
  status = excluded.status,
  priority = excluded.priority,
  customer_name = excluded.customer_name,
  customer_phone = excluded.customer_phone,
  address_line = excluded.address_line,
  address_number = excluded.address_number,
  neighborhood = excluded.neighborhood,
  city = excluded.city,
  state = excluded.state,
  delivery_fee = excluded.delivery_fee,
  order_amount = excluded.order_amount,
  total_amount = excluded.total_amount,
  payment_status = excluded.payment_status,
  notes = excluded.notes,
  items = excluded.items,
  created_at = excluded.created_at,
  updated_at = now();

notify pgrst, 'reload schema';
