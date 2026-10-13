-- Contrôle en LECTURE SEULE de la migration 20261013160000_phase9_contrat_signatures.sql.
-- À coller dans l'éditeur SQL Supabase après l'avoir appliquée. Chaque ligne doit afficher ok = true.
SELECT 'table contrat_signatures' AS objet, to_regclass('public.contrat_signatures') IS NOT NULL AS ok
UNION ALL
SELECT 'fonction contrat_a_signer', EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'contrat_a_signer')
UNION ALL
SELECT 'fonction signer_contrat', EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'signer_contrat')
UNION ALL
SELECT 'trigger de garde', EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_contrat_signatures_garde')
UNION ALL
SELECT 'RLS activée', coalesce((SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.contrat_signatures')), false)
UNION ALL
SELECT '3 policies (select, insert, update)',
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contrat_signatures') = 3
UNION ALL
SELECT 'anon : aucun droit direct sur la table',
  NOT has_table_privilege('anon', 'public.contrat_signatures', 'SELECT')
UNION ALL
SELECT 'authenticated : pas de suppression',
  NOT has_table_privilege('authenticated', 'public.contrat_signatures', 'DELETE')
UNION ALL
SELECT 'anon : peut lire et signer par jeton',
  has_function_privilege('anon', 'public.signer_contrat(text, text, text, text, jsonb, text, text, text)', 'EXECUTE');
