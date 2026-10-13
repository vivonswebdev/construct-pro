-- Contrôle en LECTURE SEULE des objets des migrations phase 1 et phase 9.
-- À coller dans l'éditeur SQL Supabase. Chaque ligne doit afficher present = true.
WITH attendu(type, nom) AS (
  VALUES
    -- Phase 1
    ('contrainte', 'clients_langue_chk'),
    ('contrainte', 'chantiers_status_chk'),
    ('contrainte', 'etapes_status_chk'),
    ('contrainte', 'factures_status_chk'),
    ('contrainte', 'presence_status_chk'),
    ('contrainte', 'personnel_status_chk'),
    ('contrainte', 'personnel_contract_type_chk'),
    ('contrainte', 'vehicules_status_chk'),
    ('contrainte', 'vehicules_type_chk'),
    ('table', 'traductions'),
    ('fonction', 'to_code'),
    -- Phase 9
    ('contrainte', 'chantiers_id_company_uniq'),
    ('table', 'sous_traitants'),
    ('table', 'parametres_30bis'),
    ('table', 'verifications_30bis'),
    ('table', 'sous_traitant_contrats'),
    ('table', 'sous_traitant_prestations'),
    ('table', 'achat_paiements'),
    ('contrainte', 'verifications_30bis_st_fk'),
    ('contrainte', 'sous_traitant_contrats_chantier_fk'),
    ('contrainte', 'achat_paiements_verif_fk'),
    ('contrainte', 'company_settings_conservation_chk'),
    ('fonction', 'check_paiement_30bis'),
    ('trigger', 'trg_achat_paiements_30bis')
)
SELECT a.type, a.nom,
  CASE a.type
    WHEN 'contrainte' THEN EXISTS (SELECT 1 FROM pg_constraint WHERE conname = a.nom)
    WHEN 'table' THEN to_regclass('public.' || a.nom) IS NOT NULL
    WHEN 'fonction' THEN EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                                 WHERE n.nspname = 'public' AND p.proname = a.nom)
    WHEN 'trigger' THEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = a.nom)
  END AS present
FROM attendu a
UNION ALL
SELECT 'policies', t, (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = t)
                     >= CASE t WHEN 'traductions' THEN 4 WHEN 'verifications_30bis' THEN 2
                               WHEN 'parametres_30bis' THEN 1 ELSE 4 END
FROM unnest(ARRAY['traductions', 'sous_traitants', 'sous_traitant_contrats', 'sous_traitant_prestations',
                  'achat_paiements', 'verifications_30bis', 'parametres_30bis']) AS t
UNION ALL
SELECT 'données', 'paramètres 30bis (1 ligne)', (SELECT count(*) = 1 FROM public.parametres_30bis)
UNION ALL
SELECT 'données', 'aucun ancien libellé de statut', NOT EXISTS (
  SELECT 1 FROM public.chantiers WHERE status <> public.to_code(status)
  UNION ALL SELECT 1 FROM public.personnel WHERE status <> public.to_code(status)
)
ORDER BY 1, 2;
