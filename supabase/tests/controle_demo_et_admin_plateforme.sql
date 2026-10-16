-- Contrôle en LECTURE SEULE de la migration 20261016110000_demo_et_admin_plateforme.sql.
-- À coller dans l'éditeur SQL Supabase après l'avoir appliquée.

-- 1. Chaque ligne doit afficher ok = true.
WITH admins AS (
  -- Utilisateurs que est_admin_plateforme() reconnaîtrait (même règle que la fonction).
  SELECT u.id, u.email FROM auth.users u
  WHERE lower(u.email) = 'kaillaniyoussef@gmail.com' AND u.email_confirmed_at IS NOT NULL
)
SELECT 'exactement un administrateur de la plateforme : kaillaniyoussef@gmail.com (confirmé)' AS objet,
  (SELECT count(*) FROM admins) = 1
  AND (SELECT bool_and(lower(email) = 'kaillaniyoussef@gmail.com') FROM admins) AS ok
UNION ALL
SELECT 'la règle ne vise que cette adresse (texte de la fonction)',
  (SELECT prosrc FROM pg_proc WHERE oid = 'public.est_admin_plateforme()'::regprocedure)
    LIKE '%''kaillaniyoussef@gmail.com''%'
  AND (SELECT prosrc FROM pg_proc WHERE oid = 'public.est_admin_plateforme()'::regprocedure)
    LIKE '%email_confirmed_at IS NOT NULL%'
UNION ALL
SELECT 'colonne companies.est_demo (faux par défaut)',
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'companies'
            AND column_name = 'est_demo' AND column_default = 'false')
UNION ALL
SELECT 'est_demo protégé contre la modification par l''API',
  EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_companies_est_demo' AND tgenabled <> 'D')
UNION ALL
SELECT 'seed_lock ne peuple que les sociétés démo',
  (SELECT prosrc FROM pg_proc WHERE oid = 'public.seed_lock(uuid)'::regprocedure) LIKE '%est_demo = true%'
UNION ALL
SELECT 'anon n''exécute aucune des nouvelles fonctions',
  NOT has_function_privilege('anon', 'public.est_admin_plateforme()', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.est_societe_demo(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.admin_comptes()', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.admin_definir_demo(uuid, boolean)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.seed_lock(uuid)', 'EXECUTE')
UNION ALL
SELECT 'policy de lecture démo sur chaque table à company_id (RLS active)',
  NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'company_id' AND NOT a.attisdropped
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
      AND NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public'
                      AND p.tablename = c.relname AND p.policyname = 'admin_plateforme_demo_select'))
UNION ALL
SELECT 'policies démo : lecture seule, authenticated uniquement',
  NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admin_plateforme_demo_select'
              AND (cmd <> 'SELECT' OR roles <> ARRAY['authenticated']::name[]));

-- 2. Identification des comptes de test (à examiner avant de les marquer « démo » depuis /admin) :
--    sociétés déjà peuplées par le jeu de démonstration, et nombre de chantiers portant un nom de
--    ce jeu. Les sociétés créées après cette migration ne sont plus peuplées.
SELECT c.name AS societe, c.created_at, c.demo_seeded, c.est_demo,
  (SELECT string_agg(u.email, ', ') FROM public.profiles p JOIN auth.users u ON u.id = p.id
   WHERE p.company_id = c.id) AS utilisateurs,
  (SELECT count(*) FROM public.chantiers ch WHERE ch.company_id = c.id) AS chantiers,
  (SELECT count(*) FROM public.chantiers ch WHERE ch.company_id = c.id
     AND ch.name IN ('Résidence Les Acacias', 'Extension maison Collignon',
                     'Entrepôt Logistique Hasselt', 'Villa Rénovation Namur',
                     'Salle polyvalente ASBL')) AS chantiers_de_demo
FROM public.companies c
ORDER BY c.created_at;
