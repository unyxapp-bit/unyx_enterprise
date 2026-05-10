-- Rode este arquivo sozinho antes de executar onboarding_first_access.sql
-- em uma base Supabase ja existente.
--
-- PostgreSQL nao permite usar um valor novo de enum na mesma transacao em
-- que ele foi criado. Por isso estes ALTER TYPE precisam ser confirmados
-- primeiro; depois rode o onboarding_first_access.sql completo.

alter type public.operational_status_type add value if not exists 'aguardando_evento';
alter type public.operational_status_type add value if not exists 'finalizado';
alter type public.schedule_status add value if not exists 'banked_hours';

notify pgrst, 'reload schema';
