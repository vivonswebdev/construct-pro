-- Contrôle en LECTURE SEULE de la migration 20261020090000_equipe_pointages.sql.
-- À coller dans l'éditeur SQL Supabase après l'avoir appliquée.
-- Résultat : UNE ligne (l'éditeur Supabase n'affiche que la dernière requête) ; attendu ko = 0.
-- En cas d'échec, « en_echec » nomme les contrôles concernés.
WITH controles (objet, ok) AS (
SELECT 'personnel : colonnes fonction, date_entree, date_sortie, profile_id' AS objet,
  (SELECT count(*) FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'personnel'
     AND column_name IN ('fonction', 'date_entree', 'date_sortie', 'profile_id')) = 4 AS ok
UNION ALL
SELECT 'tables pointages et pointage_corrections avec RLS',
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname IN ('pointages', 'pointage_corrections')
     AND c.relrowsecurity) = 2
UNION ALL
SELECT 'pointages : 4 policies société + policy démo',
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pointages'
     AND policyname IN ('pointages_select', 'pointages_insert', 'pointages_update',
                        'pointages_delete', 'admin_plateforme_demo_select')) = 5
UNION ALL
SELECT 'historique : lecture seule (aucune policy d''écriture)',
  NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
              AND tablename = 'pointage_corrections' AND cmd <> 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.pointage_corrections', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.pointage_corrections', 'UPDATE')
  AND NOT has_table_privilege('authenticated', 'public.pointage_corrections', 'DELETE')
UNION ALL
SELECT 'anon : aucun droit sur pointages ni historique',
  NOT has_table_privilege('anon', 'public.pointages', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.pointage_corrections', 'SELECT')
UNION ALL
SELECT 'triggers de garde présents et actifs',
  (SELECT count(*) FROM pg_trigger
   WHERE tgname IN ('trg_pointages_garde', 'trg_personnel_lien_compte') AND tgenabled <> 'D') = 2
UNION ALL
SELECT 'corriger_pointage / supprimer_pointage / comptes_societe : anon non',
  has_function_privilege('authenticated',
    'public.corriger_pointage(uuid, uuid, date, time, time, integer, text, text)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.supprimer_pointage(uuid, text)', 'EXECUTE')
  AND NOT has_function_privilege('anon',
    'public.corriger_pointage(uuid, uuid, date, time, time, integer, text, text)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.supprimer_pointage(uuid, text)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.comptes_societe()', 'EXECUTE')
UNION ALL
SELECT 'fonctions de trigger non exécutables par anon / authenticated',
  NOT has_function_privilege('anon', 'public.pointages_garde()', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.pointages_garde()', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.personnel_lien_compte()', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.personnel_lien_compte()', 'EXECUTE')
UNION ALL
SELECT 'clés composites (travailleur et chantier de la même société)',
  (SELECT count(*) FROM pg_constraint
   WHERE conname IN ('pointages_personnel_fk', 'pointages_chantier_fk', 'personnel_id_company_uniq')) = 3
UNION ALL
SELECT 'index sur company_id et clés étrangères',
  (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public'
   AND indexname IN ('idx_pointages_company_date', 'idx_pointages_personnel_date',
                     'idx_pointages_chantier_date', 'idx_pointage_corrections_company',
                     'idx_pointage_corrections_pointage', 'idx_personnel_profile_unique')) = 6
UNION ALL
SELECT '(information) pointages existants',
  (SELECT count(*) FROM public.pointages) >= 0
)
SELECT count(*) FILTER (WHERE ok AND objet NOT LIKE '(information)%') AS ok,
  count(*) FILTER (WHERE NOT ok AND objet NOT LIKE '(information)%') AS ko,
  string_agg(objet, ' | ') FILTER (WHERE NOT ok AND objet NOT LIKE '(information)%') AS en_echec,
  (SELECT count(*) FROM public.pointages) || ' pointage(s), '
    || (SELECT count(*) FROM public.pointage_corrections) || ' correction(s)' AS informations
FROM controles;
