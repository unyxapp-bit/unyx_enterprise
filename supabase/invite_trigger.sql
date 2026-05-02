-- =====================================================
-- Unyx Enterprise — Trigger de aceitacao automatica de convite
-- Execute no Supabase SQL Editor (uma vez, idempotente)
-- =====================================================
--
-- Quando um novo usuario cria conta (INSERT em auth.users):
--   • Se o email tem convite pendente na org:
--       – cria user_profiles com organization_id, role e branch_id do convite
--       – marca o convite como 'accepted'
--   • Se nao tem convite: nao faz nada
--       – o usuario passa pelo fluxo de onboarding normal (cria propria org)
--
-- Isso garante isolamento total: so entra na organizacao quem foi convidado.
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
  v_name   text;
BEGIN
  v_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
    SPLIT_PART(NEW.email, '@', 1)
  );

  BEGIN
    SELECT organization_id, role, branch_id
      INTO v_invite
      FROM public.invitations
     WHERE lower(email) = lower(NEW.email)
       AND status = 'pending'
       AND expires_at > now()
     ORDER BY created_at DESC
     LIMIT 1;

    IF FOUND THEN
      INSERT INTO public.user_profiles (
        auth_user_id, organization_id, name, email, role, branch_id, active
      ) VALUES (
        NEW.id,
        v_invite.organization_id,
        v_name,
        NEW.email,
        v_invite.role,
        v_invite.branch_id,
        true
      )
      ON CONFLICT (auth_user_id) DO NOTHING;

      UPDATE public.invitations
         SET status = 'accepted'
       WHERE lower(email) = lower(NEW.email)
         AND status = 'pending';
    END IF;

  EXCEPTION WHEN undefined_table THEN
    -- tabela invitations ainda nao existe, ignora silenciosamente
    NULL;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

NOTIFY pgrst, 'reload schema';
