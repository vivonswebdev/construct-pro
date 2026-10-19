-- Contrôle en LECTURE SEULE de la migration 20261015090000_phase9_conformite.sql.
-- À coller dans l'éditeur SQL Supabase après l'avoir appliquée. Chaque ligne doit afficher ok = true.
SELECT 'table documents_conformite' AS objet, to_regclass('public.documents_conformite') IS NOT NULL AS ok
UNION ALL
SELECT 'table derogations_conformite', to_regclass('public.derogations_conformite') IS NOT NULL
UNION ALL
SELECT 'colonnes IBAN validé',
  (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public'
     AND table_name = 'sous_traitants' AND column_name IN ('iban_valide_le', 'iban_valide_par')) = 2
UNION ALL
SELECT 'fonctions de statut',
  (SELECT count(DISTINCT proname) FROM pg_proc WHERE proname IN
     ('statut_document_conformite', 'statut_attestation', 'derogation_active',
      'conformite_sous_traitants', 'aujourdhui_bruxelles', 'controle_affectation_chantier')) = 6
UNION ALL
SELECT 'triggers de garde (documents, dérogations, IBAN)',
  (SELECT count(*) FROM pg_trigger WHERE tgname IN
     ('trg_documents_conformite_garde', 'trg_derogations_conformite_garde', 'trg_sous_traitants_iban_garde')) = 3
UNION ALL
SELECT 'triggers de blocage (contrats, prestations)',
  (SELECT count(*) FROM pg_trigger WHERE tgname IN ('trg_contrats_affectation', 'trg_prestations_affectation')) = 2
UNION ALL
SELECT 'plafond total dans le contrôle des paiements',
  EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'check_paiement_30bis' AND prosrc LIKE '%v_onss + v_spf > NEW.montant_ht%')
UNION ALL
SELECT 'RLS activée (documents, dérogations)',
  (SELECT bool_and(relrowsecurity) FROM pg_class
   WHERE oid IN (to_regclass('public.documents_conformite'), to_regclass('public.derogations_conformite')))
UNION ALL
SELECT 'preuves non supprimables (droits)',
  NOT has_table_privilege('authenticated', 'public.documents_conformite', 'DELETE')
  AND NOT has_table_privilege('authenticated', 'public.derogations_conformite', 'DELETE')
UNION ALL
SELECT 'aucun accès anon',
  NOT has_table_privilege('anon', 'public.documents_conformite', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.derogations_conformite', 'SELECT')
UNION ALL
SELECT 'policies storage mises à jour',
  EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND policyname = 'documents_delete'
          AND qual LIKE '%documents_conformite%');
