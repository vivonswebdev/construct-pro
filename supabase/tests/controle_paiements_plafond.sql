-- Contrôle en LECTURE SEULE de la migration 20261014090000_phase9_paiements_plafond.sql.
-- À coller dans l'éditeur SQL Supabase après l'avoir appliquée. Chaque ligne doit afficher ok = true.
SELECT 'colonnes de dette (vérifications)' AS objet,
  (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public'
     AND table_name = 'verifications_30bis' AND column_name IN ('montant_dette_onss', 'montant_dette_spf')) = 2 AS ok
UNION ALL
SELECT 'colonnes d''annulation (paiements)',
  (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public'
     AND table_name = 'achat_paiements' AND column_name IN ('annule_le', 'annule_par', 'motif_annulation')) = 3
UNION ALL
SELECT 'contrainte montants de dette', EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'verifications_30bis_montants_chk')
UNION ALL
SELECT 'contrainte motif d''annulation', EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'achat_paiements_annulation_chk')
UNION ALL
SELECT 'fonction est_gestionnaire', EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'est_gestionnaire')
UNION ALL
SELECT 'contrôle 30bis avec plafond', EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'check_paiement_30bis'
  AND prosrc LIKE '%montant_dette_onss%')
UNION ALL
SELECT 'trigger garde paiements', EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_achat_paiements_garde')
UNION ALL
SELECT 'trigger insertion paiements', EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_achat_paiements_insertion')
UNION ALL
SELECT 'trigger contrat signé', EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sous_traitant_contrats_garde')
UNION ALL
SELECT 'trigger validation prestations', EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sous_traitant_prestations_validation');
