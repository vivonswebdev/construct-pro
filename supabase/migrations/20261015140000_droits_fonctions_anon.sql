-- Durcissement : aucune fonction du schéma public n'est exécutable par anon, sauf la signature
-- publique des contrats (contrat_a_signer, signer_contrat).
--
-- Pourquoi : Supabase accorde par défaut EXECUTE sur les nouvelles fonctions à anon, et
-- PostgreSQL l'accorde à PUBLIC (dont anon hérite). Constaté le 15/10/2026 : anon pouvait appeler
-- conformite_sous_traitants() et est_gestionnaire() (sans obtenir de données, mais à éviter).
--
-- Pour chaque fonction de public (hors fonctions d'extensions) : REVOKE EXECUTE FROM PUBLIC, anon ;
-- GRANT EXECUTE TO authenticated, service_role (authenticated en dépendait via PUBLIC : RLS,
-- RPC). Les deux fonctions de signature restent accordées à anon.
-- Migration idempotente (rejouable) ; retour arrière en commentaire à la fin.

DO $$
DECLARE
  f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND NOT EXISTS (  -- fonctions appartenant à une extension : on n'y touche pas
        SELECT 1 FROM pg_depend d
        WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f.sig);
    IF f.proname IN ('contrat_a_signer', 'signer_contrat') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon', f.sig);
    END IF;
  END LOOP;
END $$;

-- Fonctions créées à l'avenir par ce rôle : plus d'EXECUTE automatique pour anon ni PUBLIC.
-- (Sans effet bloquant si le rôle courant ne peut pas modifier ces droits par défaut.)
DO $$
BEGIN
  ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'Droits par défaut non modifiés (privilèges insuffisants) : %', SQLERRM;
END $$;

-- ---------------------------------------------------------------------------
-- ROLLBACK : à exécuter manuellement si besoin (bloc entièrement commenté).
-- -- Rend l'exécution à PUBLIC (et donc à anon), comme avant cette migration.
-- DO $$
-- DECLARE f record;
-- BEGIN
--   FOR f IN
--     SELECT p.oid::regprocedure AS sig
--     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--     WHERE n.nspname = 'public' AND p.prokind = 'f'
--       AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_proc'::regclass
--                       AND d.objid = p.oid AND d.deptype = 'e')
--   LOOP
--     EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO PUBLIC, anon', f.sig);
--   END LOOP;
-- END $$;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO PUBLIC, anon;
