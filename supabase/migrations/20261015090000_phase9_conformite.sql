-- Phase 9, PR D — Conformité des sous-traitants, alertes, blocage d'affectation, dérogations.
-- Règles validées par Youssef les 14 et 15/10/2026 (docs/plans/phase-09-suite.md) :
--
--  * Exigences : attestation 30bis (date d'expiration obligatoire), attestation TVA (date
--    facultative : sans date, valide jusqu'à invalidation), IBAN validé, contrat signé ou envoyé
--    en signature (lien actif).
--  * Statut calculé, jamais stocké : valide / expire_bientot (≤ 30 jours) / expire / manquant /
--    invalide. Un document est une preuve : ni modifié ni supprimé, seulement invalidé (admin ou
--    gérant, motif obligatoire, auteur et date imposés).
--  * IBAN : validé par admin ou gérant ; toute modification de l'IBAN annule la validation.
--  * Blocage : rattacher un contrat ou une prestation à un chantier est refusé si l'attestation
--    30bis est absente, expirée ou invalide, sauf dérogation active. Pas de désactivation globale.
--  * Dérogation : par sous-traitant, admin ou gérant, motif obligatoire, échéance obligatoire
--    (30 jours maximum), révocable avant échéance (auteur et date) ; jamais supprimée.
--  * Paiements : total retenu = min(ONSS + SPF, HTVA) ; si dépassement, réduire d'abord le SPF,
--    puis l'ONSS. Montant versé = HTVA + TVA − total retenu (inchangé).
-- Migration idempotente (rejouable) ; retour arrière en commentaire à la fin.
-- Prérequis : 20261014090000 (est_gestionnaire) et 20261014120000 (bucket documents).

-- ---------------------------------------------------------------------------
-- 1. Documents de conformité
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.documents_conformite (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sous_traitant_id uuid NOT NULL,
  type_document text NOT NULL CHECK (type_document IN ('attestation_30bis', 'attestation_tva')),
  fichier text,
  date_emission date,
  date_expiration date,
  depose_par uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  invalide_le timestamptz,
  invalide_par uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  motif_invalidation text,
  CONSTRAINT documents_conformite_st_fk FOREIGN KEY (sous_traitant_id, company_id)
    REFERENCES public.sous_traitants (id, company_id) ON DELETE RESTRICT,
  CONSTRAINT documents_conformite_expiration_chk CHECK (
    type_document <> 'attestation_30bis' OR date_expiration IS NOT NULL
  ),
  CONSTRAINT documents_conformite_dates_chk CHECK (
    date_expiration IS NULL OR date_emission IS NULL OR date_expiration >= date_emission
  ),
  CONSTRAINT documents_conformite_fichier_chk CHECK (
    fichier IS NULL
    OR fichier ~ ('^' || company_id::text || '/conformite/[0-9a-f-]{36}\.(jpg|png|pdf)$')
  ),
  CONSTRAINT documents_conformite_invalidation_chk CHECK (
    invalide_le IS NULL OR btrim(coalesce(motif_invalidation, '')) <> ''
  )
);
CREATE INDEX IF NOT EXISTS idx_documents_conformite_company ON public.documents_conformite (company_id);
CREATE INDEX IF NOT EXISTS idx_documents_conformite_st ON public.documents_conformite (sous_traitant_id, type_document);
CREATE INDEX IF NOT EXISTS idx_documents_conformite_depose_par ON public.documents_conformite (depose_par);
CREATE INDEX IF NOT EXISTS idx_documents_conformite_invalide_par ON public.documents_conformite (invalide_par);

CREATE OR REPLACE FUNCTION public.documents_conformite_garde()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.depose_par := coalesce(auth.uid(), NEW.depose_par);
    NEW.created_at := now();
    NEW.invalide_le := NULL;
    NEW.invalide_par := NULL;
    NEW.motif_invalidation := NULL;
    RETURN NEW;
  END IF;
  IF OLD.invalide_le IS NOT NULL THEN
    RAISE EXCEPTION 'document_fige' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.invalide_le IS NULL THEN
    RAISE EXCEPTION 'document_non_modifiable' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.est_gestionnaire() THEN
    RAISE EXCEPTION 'action_reservee_gestionnaire' USING ERRCODE = 'P0001';
  END IF;
  IF (NEW.sous_traitant_id, NEW.type_document, NEW.fichier, NEW.date_emission, NEW.date_expiration)
     IS DISTINCT FROM
     (OLD.sous_traitant_id, OLD.type_document, OLD.fichier, OLD.date_emission, OLD.date_expiration) THEN
    RAISE EXCEPTION 'document_non_modifiable' USING ERRCODE = 'P0001';
  END IF;
  IF btrim(coalesce(NEW.motif_invalidation, '')) = '' THEN
    RAISE EXCEPTION 'motif_invalidation_requis' USING ERRCODE = 'P0001';
  END IF;
  NEW.invalide_le := now();
  NEW.invalide_par := auth.uid();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_documents_conformite_garde ON public.documents_conformite;
CREATE TRIGGER trg_documents_conformite_garde
BEFORE INSERT OR UPDATE ON public.documents_conformite
FOR EACH ROW EXECUTE FUNCTION public.documents_conformite_garde();

-- ---------------------------------------------------------------------------
-- 2. Dérogations (levée du blocage)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.derogations_conformite (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sous_traitant_id uuid NOT NULL,
  motif text NOT NULL CHECK (btrim(motif) <> ''),
  accordee_par uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  accordee_le timestamptz NOT NULL DEFAULT now(),
  expire_le timestamptz NOT NULL,
  revoquee_le timestamptz,
  revoquee_par uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT derogations_conformite_st_fk FOREIGN KEY (sous_traitant_id, company_id)
    REFERENCES public.sous_traitants (id, company_id) ON DELETE RESTRICT,
  CONSTRAINT derogations_conformite_duree_chk CHECK (
    expire_le > accordee_le AND expire_le <= accordee_le + interval '30 days'
  )
);
CREATE INDEX IF NOT EXISTS idx_derogations_company ON public.derogations_conformite (company_id);
CREATE INDEX IF NOT EXISTS idx_derogations_st ON public.derogations_conformite (sous_traitant_id, expire_le DESC);
CREATE INDEX IF NOT EXISTS idx_derogations_accordee_par ON public.derogations_conformite (accordee_par);
CREATE INDEX IF NOT EXISTS idx_derogations_revoquee_par ON public.derogations_conformite (revoquee_par);

CREATE OR REPLACE FUNCTION public.derogations_conformite_garde()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT public.est_gestionnaire() THEN
    RAISE EXCEPTION 'action_reservee_gestionnaire' USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.accordee_par := auth.uid();
    NEW.accordee_le := now();
    NEW.revoquee_le := NULL;
    NEW.revoquee_par := NULL;
    IF NEW.expire_le IS NULL OR NEW.expire_le <= now() OR NEW.expire_le > now() + interval '30 days' THEN
      RAISE EXCEPTION 'derogation_duree_invalide' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;
  -- Mise à jour : seulement la révocation d'une dérogation en cours.
  IF OLD.revoquee_le IS NOT NULL OR OLD.expire_le <= now() THEN
    RAISE EXCEPTION 'derogation_figee' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.revoquee_le IS NULL
     OR (NEW.sous_traitant_id, NEW.motif, NEW.expire_le, NEW.accordee_le, NEW.accordee_par)
        IS DISTINCT FROM
        (OLD.sous_traitant_id, OLD.motif, OLD.expire_le, OLD.accordee_le, OLD.accordee_par) THEN
    RAISE EXCEPTION 'derogation_revocation_seulement' USING ERRCODE = 'P0001';
  END IF;
  NEW.revoquee_le := now();
  NEW.revoquee_par := auth.uid();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_derogations_conformite_garde ON public.derogations_conformite;
CREATE TRIGGER trg_derogations_conformite_garde
BEFORE INSERT OR UPDATE ON public.derogations_conformite
FOR EACH ROW EXECUTE FUNCTION public.derogations_conformite_garde();

-- ---------------------------------------------------------------------------
-- 3. IBAN validé
-- ---------------------------------------------------------------------------
ALTER TABLE public.sous_traitants
  ADD COLUMN IF NOT EXISTS iban_valide_le timestamptz,
  ADD COLUMN IF NOT EXISTS iban_valide_par uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_sous_traitants_iban_valide_par ON public.sous_traitants (iban_valide_par);

CREATE OR REPLACE FUNCTION public.sous_traitants_iban_garde()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.iban_valide_le := NULL;
    NEW.iban_valide_par := NULL;
    RETURN NEW;
  END IF;
  -- Changement d'IBAN : la validation précédente est annulée (protection contre la fraude).
  IF NEW.iban IS DISTINCT FROM OLD.iban THEN
    NEW.iban_valide_le := NULL;
    NEW.iban_valide_par := NULL;
    RETURN NEW;
  END IF;
  IF NEW.iban_valide_le IS DISTINCT FROM OLD.iban_valide_le
     OR NEW.iban_valide_par IS DISTINCT FROM OLD.iban_valide_par THEN
    IF NOT public.est_gestionnaire() THEN
      RAISE EXCEPTION 'action_reservee_gestionnaire' USING ERRCODE = 'P0001';
    END IF;
    IF NEW.iban_valide_le IS NOT NULL THEN
      IF btrim(coalesce(NEW.iban, '')) = '' THEN
        RAISE EXCEPTION 'iban_absent' USING ERRCODE = 'P0001';
      END IF;
      NEW.iban_valide_le := now();
      NEW.iban_valide_par := auth.uid();
    ELSE
      NEW.iban_valide_par := NULL;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sous_traitants_iban_garde ON public.sous_traitants;
CREATE TRIGGER trg_sous_traitants_iban_garde
BEFORE INSERT OR UPDATE ON public.sous_traitants
FOR EACH ROW EXECUTE FUNCTION public.sous_traitants_iban_garde();

-- ---------------------------------------------------------------------------
-- 4. Statuts calculés (source unique, reproduite dans src/lib/conformite.ts)
-- ---------------------------------------------------------------------------
-- Aujourd'hui à Bruxelles.
CREATE OR REPLACE FUNCTION public.aujourdhui_bruxelles()
RETURNS date LANGUAGE sql STABLE AS $$ SELECT (now() AT TIME ZONE 'Europe/Brussels')::date $$;

CREATE OR REPLACE FUNCTION public.statut_document_conformite(
  _date_expiration date, _invalide_le timestamptz, _jour date
)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN _invalide_le IS NOT NULL THEN 'invalide'
    WHEN _date_expiration IS NULL THEN 'valide'
    WHEN _date_expiration < _jour THEN 'expire'
    WHEN _date_expiration <= _jour + 30 THEN 'expire_bientot'
    ELSE 'valide'
  END
$$;

-- Statut d'une exigence documentaire : document non invalidé dont l'échéance est la plus
-- lointaine (sans date = sans fin) ; « invalide » si tous les documents sont invalidés ;
-- « manquant » s'il n'y en a aucun. Security invoker : RLS de l'utilisateur appliquée.
CREATE OR REPLACE FUNCTION public.statut_attestation(_sous_traitant_id uuid, _type text)
RETURNS text LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT coalesce(
    (SELECT public.statut_document_conformite(d.date_expiration, NULL, public.aujourdhui_bruxelles())
     FROM public.documents_conformite d
     WHERE d.sous_traitant_id = _sous_traitant_id AND d.type_document = _type
       AND d.invalide_le IS NULL
     ORDER BY d.date_expiration DESC NULLS FIRST, d.created_at DESC
     LIMIT 1),
    CASE WHEN EXISTS (SELECT 1 FROM public.documents_conformite d
                      WHERE d.sous_traitant_id = _sous_traitant_id AND d.type_document = _type)
         THEN 'invalide' ELSE 'manquant' END
  )
$$;

CREATE OR REPLACE FUNCTION public.derogation_active(_sous_traitant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.derogations_conformite
    WHERE sous_traitant_id = _sous_traitant_id AND revoquee_le IS NULL AND expire_le > now()
  )
$$;

-- Tableau de conformité de tous les sous-traitants de la société de l'utilisateur.
CREATE OR REPLACE FUNCTION public.conformite_sous_traitants()
RETURNS TABLE (
  sous_traitant_id uuid,
  attestation_30bis text,
  attestation_tva text,
  iban text,
  contrat text,
  derogation_jusqua timestamptz,
  bloque boolean
)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT
    s.id,
    a30.statut,
    public.statut_attestation(s.id, 'attestation_tva'),
    CASE WHEN btrim(coalesce(s.iban, '')) <> '' AND s.iban_valide_le IS NOT NULL
         THEN 'valide' ELSE 'manquant' END,
    CASE WHEN EXISTS (
      SELECT 1 FROM public.contrat_signatures cs
      JOIN public.sous_traitant_contrats c ON c.id = cs.contrat_id
      WHERE c.sous_traitant_id = s.id
        AND (cs.statut = 'signe' OR (cs.statut = 'envoye' AND cs.expire_le > now()))
    ) THEN 'valide' ELSE 'manquant' END,
    (SELECT max(d.expire_le) FROM public.derogations_conformite d
     WHERE d.sous_traitant_id = s.id AND d.revoquee_le IS NULL AND d.expire_le > now()),
    a30.statut NOT IN ('valide', 'expire_bientot') AND NOT public.derogation_active(s.id)
  FROM public.sous_traitants s
  CROSS JOIN LATERAL (SELECT public.statut_attestation(s.id, 'attestation_30bis') AS statut) a30
  WHERE s.company_id = public.get_user_company_id(auth.uid())
$$;

-- ---------------------------------------------------------------------------
-- 5. Blocage d'affectation sur chantier (contrats et prestations)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.controle_affectation_chantier()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_st uuid;
  v_statut text;
BEGIN
  IF NEW.chantier_id IS NULL
     OR (TG_OP = 'UPDATE' AND NEW.chantier_id IS NOT DISTINCT FROM OLD.chantier_id) THEN
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME = 'sous_traitant_contrats' THEN
    v_st := NEW.sous_traitant_id;
  ELSE
    SELECT sous_traitant_id INTO v_st FROM public.sous_traitant_contrats
    WHERE id = NEW.contrat_id AND company_id = NEW.company_id;
  END IF;
  v_statut := public.statut_attestation(v_st, 'attestation_30bis');
  IF v_statut NOT IN ('valide', 'expire_bientot') AND NOT public.derogation_active(v_st) THEN
    RAISE EXCEPTION 'conformite_30bis_bloquante'
      USING ERRCODE = 'P0001', DETAIL = format('attestation 30bis : %s', v_statut);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_contrats_affectation ON public.sous_traitant_contrats;
CREATE TRIGGER trg_contrats_affectation
BEFORE INSERT OR UPDATE ON public.sous_traitant_contrats
FOR EACH ROW EXECUTE FUNCTION public.controle_affectation_chantier();

DROP TRIGGER IF EXISTS trg_prestations_affectation ON public.sous_traitant_prestations;
CREATE TRIGGER trg_prestations_affectation
BEFORE INSERT OR UPDATE ON public.sous_traitant_prestations
FOR EACH ROW EXECUTE FUNCTION public.controle_affectation_chantier();

-- ---------------------------------------------------------------------------
-- 6. Contrôle 30bis : plafond total = HTVA (SPF réduit d'abord, puis ONSS)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_paiement_30bis()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_st uuid;
  v_verif public.verifications_30bis%ROWTYPE;
  v_taux public.parametres_30bis%ROWTYPE;
  v_onss numeric;
  v_spf numeric;
  v_deja_onss numeric;
  v_deja_spf numeric;
BEGIN
  -- Annulation : seule l'annulation change (contrôlée par la garde) ; pas de nouveau calcul.
  IF TG_OP = 'UPDATE' AND NEW.annule_le IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT sous_traitant_id INTO v_st
  FROM public.sous_traitant_contrats
  WHERE id = NEW.contrat_id AND company_id = NEW.company_id;

  IF NEW.verification_30bis_id IS NULL THEN
    RAISE EXCEPTION 'verification_30bis_requise' USING ERRCODE = 'P0001';
  END IF;

  -- Sérialise les paiements d'une même vérification (plafond partagé).
  PERFORM pg_advisory_xact_lock(hashtext(NEW.verification_30bis_id::text));

  SELECT * INTO v_verif
  FROM public.verifications_30bis
  WHERE id = NEW.verification_30bis_id AND company_id = NEW.company_id;

  IF v_verif.sous_traitant_id IS DISTINCT FROM v_st THEN
    RAISE EXCEPTION 'verification_30bis_autre_sous_traitant' USING ERRCODE = 'P0001';
  END IF;
  IF (v_verif.verifie_le AT TIME ZONE 'Europe/Brussels')::date <> NEW.date_paiement THEN
    RAISE EXCEPTION 'verification_30bis_pas_du_jour' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_taux
  FROM public.parametres_30bis
  WHERE date_debut <= NEW.date_paiement
  ORDER BY date_debut DESC
  LIMIT 1;
  IF v_taux.date_debut IS NULL THEN
    RAISE EXCEPTION 'parametres_30bis_absents' USING ERRCODE = 'P0001';
  END IF;

  SELECT coalesce(sum(retenue_onss), 0), coalesce(sum(retenue_spf), 0)
    INTO v_deja_onss, v_deja_spf
  FROM public.achat_paiements
  WHERE verification_30bis_id = NEW.verification_30bis_id
    AND id <> NEW.id
    AND annule_le IS NULL;

  v_onss := CASE WHEN v_verif.dette_sociale THEN round(NEW.montant_ht * v_taux.taux_retenue_onss, 2) ELSE 0 END;
  v_spf := CASE WHEN v_verif.dette_fiscale THEN round(NEW.montant_ht * v_taux.taux_retenue_spf, 2) ELSE 0 END;
  IF v_verif.montant_dette_onss IS NOT NULL THEN
    v_onss := least(v_onss, greatest(v_verif.montant_dette_onss - v_deja_onss, 0));
  END IF;
  IF v_verif.montant_dette_spf IS NOT NULL THEN
    v_spf := least(v_spf, greatest(v_verif.montant_dette_spf - v_deja_spf, 0));
  END IF;
  -- Total retenu ≤ HTVA du paiement : réduire d'abord le SPF, puis l'ONSS.
  IF v_onss + v_spf > NEW.montant_ht THEN
    v_spf := greatest(NEW.montant_ht - v_onss, 0);
    v_onss := least(v_onss, NEW.montant_ht);
  END IF;

  IF NEW.retenue_onss <> v_onss OR NEW.retenue_spf <> v_spf THEN
    RAISE EXCEPTION 'retenue_30bis_incorrecte'
      USING ERRCODE = 'P0001',
            DETAIL = format('attendu ONSS %s, SPF %s', v_onss, v_spf);
  END IF;

  RETURN NEW;
END $$;

-- ---------------------------------------------------------------------------
-- 7. Storage : un fichier cité par un document de conformité n'est ni remplacé ni supprimé
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "documents_update" ON storage.objects;
CREATE POLICY "documents_update" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = public.get_user_company_id(auth.uid())::text
    AND coalesce((storage.foldername(name))[2], '') NOT IN ('30bis', 'conformite')
  )
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = public.get_user_company_id(auth.uid())::text
    AND coalesce((storage.foldername(name))[2], '') NOT IN ('30bis', 'conformite')
  );

DROP POLICY IF EXISTS "documents_delete" ON storage.objects;
CREATE POLICY "documents_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = public.get_user_company_id(auth.uid())::text
    AND NOT EXISTS (
      SELECT 1 FROM public.verifications_30bis v WHERE v.preuve_fichier = storage.objects.name
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.documents_conformite d WHERE d.fichier = storage.objects.name
    )
  );

-- ---------------------------------------------------------------------------
-- 8. Droits et RLS (droits par défaut de Supabase retirés : tables de preuve)
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.documents_conformite FROM anon, authenticated;
GRANT SELECT, INSERT ON public.documents_conformite TO authenticated;
GRANT UPDATE (invalide_le, motif_invalidation) ON public.documents_conformite TO authenticated;
GRANT ALL ON public.documents_conformite TO service_role;

REVOKE ALL ON public.derogations_conformite FROM anon, authenticated;
GRANT SELECT, INSERT ON public.derogations_conformite TO authenticated;
GRANT UPDATE (revoquee_le) ON public.derogations_conformite TO authenticated;
GRANT ALL ON public.derogations_conformite TO service_role;

ALTER TABLE public.documents_conformite ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.derogations_conformite ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "documents_conformite_select" ON public.documents_conformite;
CREATE POLICY "documents_conformite_select" ON public.documents_conformite FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));
DROP POLICY IF EXISTS "documents_conformite_insert" ON public.documents_conformite;
CREATE POLICY "documents_conformite_insert" ON public.documents_conformite FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
DROP POLICY IF EXISTS "documents_conformite_update" ON public.documents_conformite;
CREATE POLICY "documents_conformite_update" ON public.documents_conformite FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()))
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
-- Pas de policy DELETE : un document de conformité est une preuve.

DROP POLICY IF EXISTS "derogations_select" ON public.derogations_conformite;
CREATE POLICY "derogations_select" ON public.derogations_conformite FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));
DROP POLICY IF EXISTS "derogations_insert" ON public.derogations_conformite;
CREATE POLICY "derogations_insert" ON public.derogations_conformite FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
DROP POLICY IF EXISTS "derogations_update" ON public.derogations_conformite;
CREATE POLICY "derogations_update" ON public.derogations_conformite FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()))
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
-- Pas de policy DELETE : une dérogation est une preuve.

REVOKE ALL ON FUNCTION public.conformite_sous_traitants() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.conformite_sous_traitants() TO authenticated;
REVOKE ALL ON FUNCTION public.statut_attestation(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.statut_attestation(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.derogation_active(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.derogation_active(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- ROLLBACK : à exécuter manuellement si besoin (bloc entièrement commenté).
-- -- Contrôle des paiements, version de 20261014090000 (sans plafond total) :
-- CREATE OR REPLACE FUNCTION public.check_paiement_30bis()
-- RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
-- DECLARE
--   v_st uuid;
--   v_verif public.verifications_30bis%ROWTYPE;
--   v_taux public.parametres_30bis%ROWTYPE;
--   v_onss numeric;
--   v_spf numeric;
--   v_deja_onss numeric;
--   v_deja_spf numeric;
-- BEGIN
--   -- Annulation : seule l'annulation change (contrôlée par la garde) ; pas de nouveau calcul.
--   IF TG_OP = 'UPDATE' AND NEW.annule_le IS NOT NULL THEN
--     RETURN NEW;
--   END IF;
--
--   SELECT sous_traitant_id INTO v_st
--   FROM public.sous_traitant_contrats
--   WHERE id = NEW.contrat_id AND company_id = NEW.company_id;
--
--   IF NEW.verification_30bis_id IS NULL THEN
--     RAISE EXCEPTION 'verification_30bis_requise' USING ERRCODE = 'P0001';
--   END IF;
--
--   -- Sérialise les paiements d'une même vérification (plafond partagé).
--   PERFORM pg_advisory_xact_lock(hashtext(NEW.verification_30bis_id::text));
--
--   SELECT * INTO v_verif
--   FROM public.verifications_30bis
--   WHERE id = NEW.verification_30bis_id AND company_id = NEW.company_id;
--
--   IF v_verif.sous_traitant_id IS DISTINCT FROM v_st THEN
--     RAISE EXCEPTION 'verification_30bis_autre_sous_traitant' USING ERRCODE = 'P0001';
--   END IF;
--   IF (v_verif.verifie_le AT TIME ZONE 'Europe/Brussels')::date <> NEW.date_paiement THEN
--     RAISE EXCEPTION 'verification_30bis_pas_du_jour' USING ERRCODE = 'P0001';
--   END IF;
--
--   SELECT * INTO v_taux
--   FROM public.parametres_30bis
--   WHERE date_debut <= NEW.date_paiement
--   ORDER BY date_debut DESC
--   LIMIT 1;
--   IF v_taux.date_debut IS NULL THEN
--     RAISE EXCEPTION 'parametres_30bis_absents' USING ERRCODE = 'P0001';
--   END IF;
--
--   SELECT coalesce(sum(retenue_onss), 0), coalesce(sum(retenue_spf), 0)
--     INTO v_deja_onss, v_deja_spf
--   FROM public.achat_paiements
--   WHERE verification_30bis_id = NEW.verification_30bis_id
--     AND id <> NEW.id
--     AND annule_le IS NULL;
--
--   v_onss := CASE WHEN v_verif.dette_sociale THEN round(NEW.montant_ht * v_taux.taux_retenue_onss, 2) ELSE 0 END;
--   v_spf := CASE WHEN v_verif.dette_fiscale THEN round(NEW.montant_ht * v_taux.taux_retenue_spf, 2) ELSE 0 END;
--   IF v_verif.montant_dette_onss IS NOT NULL THEN
--     v_onss := least(v_onss, greatest(v_verif.montant_dette_onss - v_deja_onss, 0));
--   END IF;
--   IF v_verif.montant_dette_spf IS NOT NULL THEN
--     v_spf := least(v_spf, greatest(v_verif.montant_dette_spf - v_deja_spf, 0));
--   END IF;
--
--   IF NEW.retenue_onss <> v_onss OR NEW.retenue_spf <> v_spf THEN
--     RAISE EXCEPTION 'retenue_30bis_incorrecte'
--       USING ERRCODE = 'P0001',
--             DETAIL = format('attendu ONSS %s, SPF %s', v_onss, v_spf);
--   END IF;
--
--   RETURN NEW;
-- END $$;
-- -- Policies de stockage, version de 20261014120000 :
-- DROP POLICY IF EXISTS "documents_update" ON storage.objects;
-- CREATE POLICY "documents_update" ON storage.objects FOR UPDATE TO authenticated
--   USING (
--     bucket_id = 'documents'
--     AND (storage.foldername(name))[1] = public.get_user_company_id(auth.uid())::text
--     AND coalesce((storage.foldername(name))[2], '') <> '30bis'
--   )
--   WITH CHECK (
--     bucket_id = 'documents'
--     AND (storage.foldername(name))[1] = public.get_user_company_id(auth.uid())::text
--     AND coalesce((storage.foldername(name))[2], '') <> '30bis'
--   );
--
-- -- Suppression : dossier 30bis seulement si le fichier n'est lié à aucune vérification.
-- DROP POLICY IF EXISTS "documents_delete" ON storage.objects;
-- CREATE POLICY "documents_delete" ON storage.objects FOR DELETE TO authenticated
--   USING (
--     bucket_id = 'documents'
--     AND (storage.foldername(name))[1] = public.get_user_company_id(auth.uid())::text
--     AND (
--       coalesce((storage.foldername(name))[2], '') <> '30bis'
--       OR NOT EXISTS (
--         SELECT 1 FROM public.verifications_30bis v WHERE v.preuve_fichier = storage.objects.name
--       )
--     )
--   );
-- DROP TRIGGER IF EXISTS trg_prestations_affectation ON public.sous_traitant_prestations;
-- DROP TRIGGER IF EXISTS trg_contrats_affectation ON public.sous_traitant_contrats;
-- DROP FUNCTION IF EXISTS public.controle_affectation_chantier();
-- DROP FUNCTION IF EXISTS public.conformite_sous_traitants();
-- DROP FUNCTION IF EXISTS public.derogation_active(uuid);
-- DROP FUNCTION IF EXISTS public.statut_attestation(uuid, text);
-- DROP FUNCTION IF EXISTS public.statut_document_conformite(date, timestamptz, date);
-- DROP FUNCTION IF EXISTS public.aujourdhui_bruxelles();
-- DROP TRIGGER IF EXISTS trg_sous_traitants_iban_garde ON public.sous_traitants;
-- DROP FUNCTION IF EXISTS public.sous_traitants_iban_garde();
-- DROP INDEX IF EXISTS public.idx_sous_traitants_iban_valide_par;
-- ALTER TABLE public.sous_traitants DROP COLUMN IF EXISTS iban_valide_par,
--   DROP COLUMN IF EXISTS iban_valide_le;
-- DROP TABLE IF EXISTS public.derogations_conformite;
-- DROP FUNCTION IF EXISTS public.derogations_conformite_garde();
-- DROP TABLE IF EXISTS public.documents_conformite;
-- DROP FUNCTION IF EXISTS public.documents_conformite_garde();
