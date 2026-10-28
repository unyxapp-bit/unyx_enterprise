-- Acesso de fiscais por código e senha (sem e-mail e sem convite).
-- Rode no SQL Editor do Supabase. Seguro rodar mais de uma vez.
--
-- Cada fiscal é um usuário de verdade do Supabase Auth, com e-mail interno
-- (codigo@loja.unyx.app) criado pela Edge Function "staff-admin". Aqui ficam só os campos
-- que o perfil precisa: o código de acesso, a função e o "código da loja" (prefixo do login).

alter table public.organizations add column if not exists staff_login_prefix text;
create unique index if not exists organizations_staff_login_prefix_key
  on public.organizations (lower(staff_login_prefix))
  where staff_login_prefix is not null;

alter table public.user_profiles add column if not exists login_code text;
alter table public.user_profiles add column if not exists job_title text;
create unique index if not exists user_profiles_org_login_code_key
  on public.user_profiles (organization_id, lower(login_code))
  where login_code is not null;

notify pgrst, 'reload schema';
