-- Phase 0 — B1 : doublons de la démo
--
-- 1) La migration 20260924105303 a ajouté companies.demo_seeded (défaut false) sans marquer les
--    sociétés déjà peuplées par l'ancien seed : seed_lock() leur aurait accordé un second seed.
-- 2) Nettoyage des doublons existants : suppression des copies exactes (clés naturelles),
--    en conservant la ligne la plus ancienne et en y rattachant les références.

UPDATE public.companies c
SET demo_seeded = true
WHERE demo_seeded = false
  AND EXISTS (SELECT 1 FROM public.chantiers ch WHERE ch.company_id = c.id);

CREATE OR REPLACE FUNCTION public.dedupe_demo_data(_company_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Appel client : uniquement pour sa propre société. Appel en migration (auth.uid() nul) : autorisé.
  IF auth.uid() IS NOT NULL AND _company_id IS DISTINCT FROM public.get_user_company_id(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- 1. Mouvements de stock en double (avant tout rattachement : le trigger annule leur effet
  --    sur le matériau auquel ils étaient liés).
  DELETE FROM stock_mouvements sm
  USING (
    SELECT sm2.id, row_number() OVER (
      PARTITION BY m.sku, m.name, ch.name, sm2.type, sm2.quantity, sm2.date,
                   sm2.reference, sm2.notes
      ORDER BY sm2.created_at, sm2.id) AS rn
    FROM stock_mouvements sm2
    JOIN materiaux m ON m.id = sm2.materiau_id
    LEFT JOIN chantiers ch ON ch.id = sm2.chantier_id
    WHERE sm2.company_id = _company_id
  ) d
  WHERE sm.id = d.id AND d.rn > 1;

  -- 2. Devis / factures en double (même type + numéro) et leurs lignes.
  CREATE TEMP TABLE _dup_factures ON COMMIT DROP AS
  SELECT id FROM (
    SELECT id, row_number() OVER (PARTITION BY type, number ORDER BY created_at, id) AS rn
    FROM factures WHERE company_id = _company_id
  ) x WHERE rn > 1;
  DELETE FROM facture_lignes WHERE facture_id IN (SELECT id FROM _dup_factures);
  DELETE FROM factures WHERE id IN (SELECT id FROM _dup_factures);

  -- 3. Personnel en double : leurs lignes rattachées sont elles-mêmes des copies.
  CREATE TEMP TABLE _dup_personnel ON COMMIT DROP AS
  SELECT id FROM (
    SELECT id, row_number() OVER (
      PARTITION BY full_name, coalesce(nrn, '') ORDER BY created_at, id) AS rn
    FROM personnel WHERE company_id = _company_id
  ) x WHERE rn > 1;
  DELETE FROM salary_payments WHERE personnel_id IN (SELECT id FROM _dup_personnel);
  DELETE FROM precompte_payments WHERE personnel_id IN (SELECT id FROM _dup_personnel);
  DELETE FROM onss_payments WHERE personnel_id IN (SELECT id FROM _dup_personnel);
  DELETE FROM personnel WHERE id IN (SELECT id FROM _dup_personnel); -- presence, affectations : cascade

  -- 4. Chantiers en double (nom + date de début) : références rattachées au chantier conservé.
  CREATE TEMP TABLE _map_chantiers ON COMMIT DROP AS
  SELECT id AS dup_id, keep_id FROM (
    SELECT id,
           first_value(id) OVER w AS keep_id,
           row_number() OVER w AS rn
    FROM chantiers WHERE company_id = _company_id
    WINDOW w AS (PARTITION BY name, start_date ORDER BY created_at, id)
  ) x WHERE rn > 1;
  UPDATE factures t SET chantier_id = m.keep_id FROM _map_chantiers m WHERE t.chantier_id = m.dup_id;
  UPDATE presence t SET chantier_id = m.keep_id FROM _map_chantiers m WHERE t.chantier_id = m.dup_id;
  UPDATE stock_mouvements t SET chantier_id = m.keep_id FROM _map_chantiers m WHERE t.chantier_id = m.dup_id;
  UPDATE vehicule_affectations t SET chantier_id = m.keep_id FROM _map_chantiers m WHERE t.chantier_id = m.dup_id;
  UPDATE affectations t SET chantier_id = m.keep_id FROM _map_chantiers m WHERE t.chantier_id = m.dup_id;
  DELETE FROM chantiers WHERE id IN (SELECT dup_id FROM _map_chantiers); -- etapes : cascade

  -- 5. Véhicules en double (plaque).
  CREATE TEMP TABLE _map_vehicules ON COMMIT DROP AS
  SELECT id AS dup_id, keep_id FROM (
    SELECT id, first_value(id) OVER w AS keep_id, row_number() OVER w AS rn
    FROM vehicules WHERE company_id = _company_id
    WINDOW w AS (PARTITION BY plate ORDER BY created_at, id)
  ) x WHERE rn > 1;
  UPDATE vehicule_affectations t SET vehicule_id = m.keep_id FROM _map_vehicules m WHERE t.vehicule_id = m.dup_id;
  DELETE FROM vehicules WHERE id IN (SELECT dup_id FROM _map_vehicules);

  -- 6. Matériaux en double (SKU + nom).
  CREATE TEMP TABLE _map_materiaux ON COMMIT DROP AS
  SELECT id AS dup_id, keep_id FROM (
    SELECT id, first_value(id) OVER w AS keep_id, row_number() OVER w AS rn
    FROM materiaux WHERE company_id = _company_id
    WINDOW w AS (PARTITION BY coalesce(sku, ''), name ORDER BY created_at, id)
  ) x WHERE rn > 1;
  UPDATE stock_mouvements t SET materiau_id = m.keep_id FROM _map_materiaux m WHERE t.materiau_id = m.dup_id;
  DELETE FROM materiaux WHERE id IN (SELECT dup_id FROM _map_materiaux);

  -- 7. Clients en double.
  CREATE TEMP TABLE _map_clients ON COMMIT DROP AS
  SELECT id AS dup_id, keep_id FROM (
    SELECT id, first_value(id) OVER w AS keep_id, row_number() OVER w AS rn
    FROM clients WHERE company_id = _company_id
    WINDOW w AS (PARTITION BY type, coalesce(raison_sociale, ''), coalesce(nom, ''),
                              coalesce(prenom, ''), coalesce(email, '')
                 ORDER BY created_at, id)
  ) x WHERE rn > 1;
  UPDATE chantiers t SET client_id = m.keep_id FROM _map_clients m WHERE t.client_id = m.dup_id;
  UPDATE factures t SET client_id = m.keep_id FROM _map_clients m WHERE t.client_id = m.dup_id;
  DELETE FROM clients WHERE id IN (SELECT dup_id FROM _map_clients);

  -- 8. Lignes enfants devenues identiques après rattachement.
  DELETE FROM affectations a USING (
    SELECT af.id, row_number() OVER (
      PARTITION BY af.personnel_id, af.chantier_id, af.start_date ORDER BY af.id) AS rn
    FROM affectations af JOIN personnel p ON p.id = af.personnel_id
    WHERE p.company_id = _company_id
  ) d WHERE a.id = d.id AND d.rn > 1;

  DELETE FROM vehicule_affectations va USING (
    SELECT x.id, row_number() OVER (
      PARTITION BY x.vehicule_id, x.chantier_id, x.start_date ORDER BY x.id) AS rn
    FROM vehicule_affectations x JOIN vehicules v ON v.id = x.vehicule_id
    WHERE v.company_id = _company_id
  ) d WHERE va.id = d.id AND d.rn > 1;

  DELETE FROM tva_checks t USING (
    SELECT id, row_number() OVER (
      PARTITION BY client_vat_number, client_name, is_eligible ORDER BY check_date, id) AS rn
    FROM tva_checks WHERE company_id = _company_id
  ) d WHERE t.id = d.id AND d.rn > 1;

  DROP TABLE IF EXISTS _dup_factures, _dup_personnel, _map_chantiers, _map_vehicules,
                       _map_materiaux, _map_clients;
END $$;

REVOKE EXECUTE ON FUNCTION public.dedupe_demo_data(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.dedupe_demo_data(uuid) TO authenticated;

-- Nettoyage immédiat de toutes les sociétés (à ce stade, toutes les données proviennent du seed).
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT id FROM public.companies LOOP
    PERFORM public.dedupe_demo_data(c.id);
  END LOOP;
END $$;