-- Endurecimento de acesso (2026-10-26).
-- Estas tabelas sao lidas/gravadas apenas por funcoes SECURITY DEFINER (triggers e RPCs),
-- nunca direto pelo app. RLS ligado sem politica bloqueia o acesso pela API publica;
-- os grants para anon/authenticated sao retirados como segunda camada de protecao.

alter table public.delivery_scope_defaults enable row level security;
alter table public.customer_code_counters enable row level security;
alter table public.employee_pos_credentials enable row level security;
alter table public.entregas enable row level security;

revoke all on public.delivery_scope_defaults from anon, authenticated;
revoke all on public.customer_code_counters from anon, authenticated;
revoke all on public.employee_pos_credentials from anon, authenticated;
revoke all on public.entregas from anon;
