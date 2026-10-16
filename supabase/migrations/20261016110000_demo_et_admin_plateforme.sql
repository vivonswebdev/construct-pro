-- Données de démonstration séparées et administrateur de la plateforme.
--
-- 1. Démonstration : companies.est_demo (faux par défaut). seed_lock() ne déclenche plus le
--    peuplement de démonstration que pour une société « démo » : un NOUVEAU COMPTE DÉMARRE VIDE.
--    Rien n'est supprimé : les sociétés déjà peuplées gardent leurs données.
-- 2. Administrateur de la plateforme (à ne pas confondre avec le rôle `admin` d'une société) :
--    uniquement l'utilisateur dont l'e-mail est kaillaniyoussef@gmail.com ET confirmé. Contrôle en
--    base (est_admin_plateforme), l'interface ne fait qu'afficher ou masquer.
--    - lecture seule des sociétés « démo » (policy SELECT ajoutée sur chaque table à company_id) ;
--    - AUCUN accès aux données des sociétés non « démo » ;
--    - liste des comptes (admin_comptes) et bascule démo (admin_definir_demo).
-- Migration idempotente (rejouable) ; retour arrière en commentaire à la fin.

-- ---------------------------------------------------------------------------
-- 1. Société de démonstration
-- ---------------------------------------------------------------------------
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS est_demo boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- 2. Administrateur de la plateforme
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.est_admin_plateforme()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.uid()
      AND lower(u.email) = 'kaillaniyoussef@gmail.com'
      AND u.email_confirmed_at IS NOT NULL
  )
$$;

CREATE OR REPLACE FUNCTION public.est_societe_demo(_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT c.est_demo FROM public.companies c WHERE c.id = _company_id), false)
$$;

-- est_demo n'est modifiable que par admin_definir_demo (security definer) : jamais par l'API.
CREATE OR REPLACE FUNCTION public.proteger_est_demo()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NEW.est_demo IS DISTINCT FROM OLD.est_demo THEN
    RAISE EXCEPTION 'est_demo_reserve_admin' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_companies_est_demo ON public.companies;
CREATE TRIGGER trg_companies_est_demo
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.proteger_est_demo();

-- ---------------------------------------------------------------------------
-- 3. Peuplement de démonstration réservé aux sociétés « démo »
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seed_lock(_company_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r uuid;
BEGIN
  UPDATE public.companies SET demo_seeded = true
  WHERE id = _company_id AND demo_seeded = false AND est_demo = true
    AND id = public.get_user_company_id(auth.uid())
  RETURNING id INTO r;
  RETURN r;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Lecture seule des sociétés « démo » par l'administrateur de la plateforme
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "admin_plateforme_demo_select" ON public.companies;
CREATE POLICY "admin_plateforme_demo_select" ON public.companies FOR SELECT TO authenticated
  USING ((SELECT public.est_admin_plateforme()) AND est_demo);

-- Toutes les tables de public ayant une colonne company_id et la RLS activée (profiles compris).
-- Les policies sont permissives : elles s'ajoutent aux policies existantes sans les modifier.
DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'company_id' AND NOT a.attisdropped
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "admin_plateforme_demo_select" ON public.%I', t.relname);
    EXECUTE format(
      'CREATE POLICY "admin_plateforme_demo_select" ON public.%I FOR SELECT TO authenticated '
      'USING ((SELECT public.est_admin_plateforme()) AND public.est_societe_demo(company_id))',
      t.relname);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Comptes et bascule « démo » (administrateur de la plateforme uniquement)
-- ---------------------------------------------------------------------------
-- Toutes les sociétés : nom, création, démo, peuplée, nombre d'utilisateurs.
-- Sociétés « démo » seulement : e-mails des utilisateurs et nombre de chantiers.
CREATE OR REPLACE FUNCTION public.admin_comptes()
RETURNS TABLE (
  id uuid, nom text, cree_le timestamptz, est_demo boolean, demo_seeded boolean,
  nb_utilisateurs integer, emails text[], nb_chantiers integer
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.est_admin_plateforme() THEN
    RAISE EXCEPTION 'acces_reserve_admin_plateforme' USING ERRCODE = 'P0001';
  END IF;
  RETURN QUERY
  SELECT c.id, c.name, c.created_at, c.est_demo, c.demo_seeded,
    (SELECT count(*)::integer FROM public.profiles p WHERE p.company_id = c.id),
    CASE WHEN c.est_demo THEN
      (SELECT array_agg(u.email ORDER BY u.email) FROM public.profiles p
       JOIN auth.users u ON u.id = p.id WHERE p.company_id = c.id)
    END,
    CASE WHEN c.est_demo THEN
      (SELECT count(*)::integer FROM public.chantiers ch WHERE ch.company_id = c.id)
    END
  FROM public.companies c
  ORDER BY c.created_at DESC;
END $$;

CREATE OR REPLACE FUNCTION public.admin_definir_demo(_company_id uuid, _demo boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.est_admin_plateforme() THEN
    RAISE EXCEPTION 'acces_reserve_admin_plateforme' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.companies SET est_demo = coalesce(_demo, false) WHERE id = _company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'societe_introuvable' USING ERRCODE = 'P0001';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 6. Droits d'exécution (Supabase accorde EXECUTE à anon par défaut)
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.est_admin_plateforme() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.est_societe_demo(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_comptes() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_definir_demo(uuid, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.proteger_est_demo() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_lock(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.est_admin_plateforme() TO authenticated;
GRANT EXECUTE ON FUNCTION public.est_societe_demo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_comptes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_definir_demo(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seed_lock(uuid) TO authenticated;

-- ROLLBACK :
-- DO $$
-- DECLARE t record;
-- BEGIN
--   FOR t IN SELECT tablename FROM pg_policies
--            WHERE schemaname = 'public' AND policyname = 'admin_plateforme_demo_select'
--   LOOP
--     EXECUTE format('DROP POLICY IF EXISTS "admin_plateforme_demo_select" ON public.%I', t.tablename);
--   END LOOP;
-- END $$;
-- DROP FUNCTION IF EXISTS public.admin_definir_demo(uuid, boolean);
-- DROP FUNCTION IF EXISTS public.admin_comptes();
-- DROP TRIGGER IF EXISTS trg_companies_est_demo ON public.companies;
-- DROP FUNCTION IF EXISTS public.proteger_est_demo();
-- CREATE OR REPLACE FUNCTION public.seed_lock(_company_id uuid)
-- RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
-- DECLARE r uuid;
-- BEGIN
--   UPDATE public.companies SET demo_seeded = true
--   WHERE id = _company_id AND demo_seeded = false
--     AND id = public.get_user_company_id(auth.uid())
--   RETURNING id INTO r;
--   RETURN r;
-- END $f$;
-- DROP FUNCTION IF EXISTS public.est_societe_demo(uuid);
-- DROP FUNCTION IF EXISTS public.est_admin_plateforme();
-- ALTER TABLE public.companies DROP COLUMN IF EXISTS est_demo;
