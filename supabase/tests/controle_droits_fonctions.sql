-- Contrôle en LECTURE SEULE de la migration 20261015140000_droits_fonctions_anon.sql.
-- À coller dans l'éditeur SQL Supabase après l'avoir appliquée. Chaque ligne doit afficher ok = true.
-- La dernière requête (facultative) liste les fonctions encore exécutables par anon : seules
-- contrat_a_signer et signer_contrat doivent apparaître.
WITH fonctions AS (
  SELECT p.oid, p.proname
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prokind = 'f'
    AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_proc'::regclass
                    AND d.objid = p.oid AND d.deptype = 'e')
)
SELECT 'anon refusé sur conformite_sous_traitants()' AS objet,
  NOT has_function_privilege('anon', 'public.conformite_sous_traitants()', 'EXECUTE') AS ok
UNION ALL
SELECT 'anon refusé sur est_gestionnaire()',
  NOT has_function_privilege('anon', 'public.est_gestionnaire()', 'EXECUTE')
UNION ALL
SELECT 'anon refusé sur get_user_company_id()',
  NOT has_function_privilege('anon', 'public.get_user_company_id(uuid)', 'EXECUTE')
UNION ALL
SELECT 'anon : aucune autre fonction que la signature publique',
  NOT EXISTS (SELECT 1 FROM fonctions WHERE has_function_privilege('anon', oid, 'EXECUTE')
              AND proname NOT IN ('contrat_a_signer', 'signer_contrat'))
UNION ALL
SELECT 'anon garde la signature publique',
  has_function_privilege('anon', 'public.contrat_a_signer(text)', 'EXECUTE')
  AND has_function_privilege('anon', 'public.signer_contrat(text, text, text, text, jsonb, text, text, text)', 'EXECUTE')
UNION ALL
SELECT 'authenticated garde get_user_company_id (RLS)',
  has_function_privilege('authenticated', 'public.get_user_company_id(uuid)', 'EXECUTE')
UNION ALL
SELECT 'authenticated garde conformite_sous_traitants()',
  has_function_privilege('authenticated', 'public.conformite_sous_traitants()', 'EXECUTE');

-- Facultatif : détail des fonctions exécutables par anon.
-- SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public' AND has_function_privilege('anon', p.oid, 'EXECUTE') ORDER BY 1;
