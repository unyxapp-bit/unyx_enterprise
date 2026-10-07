-- Safe permanent deletion for branches with no dependent records.
-- Run this script in the Supabase SQL Editor for the target project.

create or replace function public.delete_empty_branch(p_branch_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target_organization_id uuid;
  child record;
  has_rows boolean;
begin
  if auth.uid() is null
     or not public.is_org_admin()
     or public.current_organization_id() is null then
    raise exception 'Apenas administradores da organização podem excluir filiais.'
      using errcode = '42501';
  end if;

  select organization_id
    into target_organization_id
    from public.branches
   where id = p_branch_id;

  if target_organization_id is null
     or target_organization_id <> public.current_organization_id() then
    raise exception 'Filial não encontrada nesta organização.'
      using errcode = 'P0002';
  end if;

  -- Inspect every foreign key that references branches.id. This includes
  -- feature tables added later, so deleting a branch never cascades history.
  for child in
    select ns.nspname as schema_name,
           cls.relname as table_name,
           att.attname as column_name
      from pg_catalog.pg_constraint con
      join pg_catalog.pg_class cls on cls.oid = con.conrelid
      join pg_catalog.pg_namespace ns on ns.oid = cls.relnamespace
      join pg_catalog.pg_attribute att
        on att.attrelid = con.conrelid and att.attnum = con.conkey[1]
     where con.contype = 'f'
       and con.confrelid = 'public.branches'::regclass
       and con.confkey = array[(select attnum from pg_catalog.pg_attribute
                                where attrelid = 'public.branches'::regclass
                                  and attname = 'id')]::smallint[]
       and cls.relkind in ('r', 'p')
  loop
    execute format('select exists (select 1 from %I.%I where %I = $1)',
                   child.schema_name, child.table_name, child.column_name)
       into has_rows
      using p_branch_id;
    if has_rows then
      raise exception 'A filial possui registros vinculados (%). Desative-a para preservar o histórico.',
                      child.table_name
        using errcode = '23503';
    end if;
  end loop;

  delete from public.branches
   where id = p_branch_id
     and organization_id = public.current_organization_id();
  if not found then
    raise exception 'Não foi possível excluir a filial.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.delete_empty_branch(uuid) from public, anon;
grant execute on function public.delete_empty_branch(uuid) to authenticated;
