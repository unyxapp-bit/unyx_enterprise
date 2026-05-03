-- Adiciona suporte a permissões customizadas por usuário
-- Execute no Supabase SQL Editor (idempotente)

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS custom_permissions text[] DEFAULT NULL;

NOTIFY pgrst, 'reload schema';
