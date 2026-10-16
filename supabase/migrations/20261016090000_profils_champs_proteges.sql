-- Sécurité — champs protégés du profil (correction d'une faille existante).
--
-- La policy « Users update own profile » (migration d'origine) laisse chaque utilisateur modifier
-- TOUTES les colonnes de son profil. En remplaçant son company_id par celui d'une autre société,
-- un utilisateur obtenait l'accès à toutes ses données (toutes les policies reposent sur
-- get_user_company_id) ; il pouvait aussi se donner le rôle admin.
--
--  * Par l'API (rôles authenticated / anon) : id, company_id et role ne peuvent plus changer.
--    L'application ne modifie que full_name, avatar_url et langue.
--  * Un profil n'est créé que par handle_new_user() (création de compte, security definer) :
--    insertion directe refusée par l'API.
--  * Les fonctions security definer et le tableau de bord Supabase ne sont pas concernés.
-- Migration idempotente (rejouable) ; retour arrière en commentaire à la fin.

CREATE OR REPLACE FUNCTION public.proteger_profil()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- current_user : rôle de l'appel (authenticated / anon par l'API ; propriétaire de la fonction
  -- dans une fonction security definer comme handle_new_user).
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'profil_champ_protege' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.company_id IS DISTINCT FROM OLD.company_id
     OR NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'profil_champ_protege' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.proteger_profil() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_profils_champs_proteges ON public.profiles;
CREATE TRIGGER trg_profils_champs_proteges
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.proteger_profil();

-- ROLLBACK :
-- DROP TRIGGER IF EXISTS trg_profils_champs_proteges ON public.profiles;
-- DROP FUNCTION IF EXISTS public.proteger_profil();
