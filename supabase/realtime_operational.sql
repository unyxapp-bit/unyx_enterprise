-- Atualização em tempo real do Mapa de caixas e do Controle PDV.
-- O app já escuta estas tabelas (RealtimeProvider); para o Supabase enviar as mudanças, elas
-- precisam estar na publicação "supabase_realtime". Seguro rodar mais de uma vez.

do $$
declare
  t text;
begin
  foreach t in array array[
    'post_allocations',
    'operational_breaks',
    'operational_status',
    'schedules',
    'attendance_events'
  ] loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
