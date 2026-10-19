-- Contrôle en LECTURE SEULE de la migration 20261017090000_backoffice_admin.sql.
-- À coller dans l'éditeur SQL Supabase après l'avoir appliquée.
-- Résultat : UNE ligne (l'éditeur Supabase n'affiche que la dernière requête) ; attendu ko = 0.
-- En cas d'échec, « en_echec » nomme les contrôles concernés.
WITH controles (objet, ok) AS (
SELECT 'tables journal_plateforme et erreurs_application (RLS active)' AS objet,
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname IN ('journal_plateforme', 'erreurs_application')
     AND c.relrowsecurity) = 2 AS ok
UNION ALL
SELECT 'aucune policy sur ces tables (accès par fonctions uniquement)',
  NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
              AND tablename IN ('journal_plateforme', 'erreurs_application'))
UNION ALL
SELECT 'aucun droit direct pour anon / authenticated',
  NOT has_table_privilege('anon', 'public.journal_plateforme', 'SELECT,INSERT,UPDATE,DELETE')
  AND NOT has_table_privilege('authenticated', 'public.journal_plateforme', 'SELECT,INSERT,UPDATE,DELETE')
  AND NOT has_table_privilege('anon', 'public.erreurs_application', 'SELECT,INSERT,UPDATE,DELETE')
  AND NOT has_table_privilege('authenticated', 'public.erreurs_application', 'SELECT,INSERT,UPDATE,DELETE')
UNION ALL
SELECT '6 triggers de journalisation',
  (SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal AND tgname IN (
    'trg_journal_companies', 'trg_journal_profils', 'trg_journal_signatures',
    'trg_journal_documents', 'trg_journal_derogations', 'trg_journal_paiements')) = 6
UNION ALL
SELECT 'anon n''exécute aucune fonction du back-office',
  NOT has_function_privilege('anon', 'public.admin_statistiques()', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.admin_utilisateurs()', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.admin_activite(text, integer)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.admin_conformite(uuid)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.signaler_erreur(text, text, text, text)', 'EXECUTE')
UNION ALL
SELECT 'fonctions internes non exécutables par authenticated',
  NOT has_function_privilege('authenticated', 'public.journaliser(text, uuid, jsonb)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.exiger_admin_plateforme()', 'EXECUTE')
UNION ALL
SELECT 'anon : toujours seulement la signature publique',
  NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public' AND p.prokind = 'f'
                AND has_function_privilege('anon', p.oid, 'EXECUTE')
                AND p.proname NOT IN ('contrat_a_signer', 'signer_contrat'))
UNION ALL
SELECT '(information) journal d''audit Supabase pour les connexions ; faux = seule la dernière connexion est affichée',
  to_regclass('auth.audit_log_entries') IS NOT NULL
)
SELECT count(*) FILTER (WHERE ok AND objet NOT LIKE '(information)%') AS ok,
  count(*) FILTER (WHERE NOT ok AND objet NOT LIKE '(information)%') AS ko,
  string_agg(objet, ' | ') FILTER (WHERE NOT ok AND objet NOT LIKE '(information)%') AS en_echec,
  string_agg(objet || ' = ' || ok, ' | ') FILTER (WHERE objet LIKE '(information)%') AS informations
FROM controles;
