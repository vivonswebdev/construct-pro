-- Phase 9, PR B — Paiements des sous-traitants : retenue 30bis plafonnée, annulation, gardes.
-- Règles métier validées par Youssef le 14/10/2026 (docs/plans/phase-09-suite.md).
--
--  * À chaque vérification 30bis, on saisit la dette ONSS et la dette SPF affichées par le
--    service officiel. Retenue ONSS = min(HTVA × taux ONSS, dette ONSS restante) ; idem SPF.
--    « Restante » = dette de la vérification − retenues du même type déjà appliquées sur les
--    paiements non annulés liés à cette vérification. Dette non saisie (anciennes lignes) = pas
--    de plafond. Le total retenu ne peut dépasser le montant du paiement (CHECK existant).
--  * Chaque versement exige une vérification du jour (inchangé).
--  * Un paiement se supprime le jour même uniquement ; ensuite, il s'annule (motif obligatoire,
--    auteur et date conservés) : la ligne reste comme piste d'audit.
--  * Un contrat dont une demande de signature est signée n'est plus modifiable.
--  * Seuls les rôles admin et gerant valident une prestation.
-- Migration idempotente (rejouable) ; retour arrière en commentaire à la fin.

-- ---------------------------------------------------------------------------
-- 1. Montants de dette saisis à la vérification
-- ---------------------------------------------------------------------------
ALTER TABLE public.verifications_30bis
  ADD COLUMN IF NOT EXISTS montant_dette_onss numeric,
  ADD COLUMN IF NOT EXISTS montant_dette_spf numeric;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'verifications_30bis_montants_chk') THEN
    ALTER TABLE public.verifications_30bis ADD CONSTRAINT verifications_30bis_montants_chk CHECK (
      (montant_dette_onss IS NULL OR montant_dette_onss >= 0)
      AND (montant_dette_spf IS NULL OR montant_dette_spf >= 0)
      -- pas de montant de dette sans dette constatée
      AND (dette_sociale OR montant_dette_onss IS NULL OR montant_dette_onss = 0)
      AND (dette_fiscale OR montant_dette_spf IS NULL OR montant_dette_spf = 0)
    );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Annulation des paiements (piste d'audit)
-- ---------------------------------------------------------------------------
ALTER TABLE public.achat_paiements
  ADD COLUMN IF NOT EXISTS annule_le timestamptz,
  ADD COLUMN IF NOT EXISTS annule_par uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS motif_annulation text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'achat_paiements_annulation_chk') THEN
    ALTER TABLE public.achat_paiements ADD CONSTRAINT achat_paiements_annulation_chk CHECK (
      annule_le IS NULL OR btrim(coalesce(motif_annulation, '')) <> ''
    );
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_achat_paiements_annule_par ON public.achat_paiements (annule_par);

-- ---------------------------------------------------------------------------
-- 3. Rôle de l'utilisateur connecté
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.est_gestionnaire()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT role IN ('admin', 'gerant') FROM public.profiles WHERE id = auth.uid()), false)
$$;
REVOKE ALL ON FUNCTION public.est_gestionnaire() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.est_gestionnaire() TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Contrôle 30bis d'un paiement, avec plafond (remplace la version de la phase 9)
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

  IF NEW.retenue_onss <> v_onss OR NEW.retenue_spf <> v_spf THEN
    RAISE EXCEPTION 'retenue_30bis_incorrecte'
      USING ERRCODE = 'P0001',
            DETAIL = format('attendu ONSS %s, SPF %s', v_onss, v_spf);
  END IF;

  RETURN NEW;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Garde des paiements : suppression le jour même, annulation ensuite
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.achat_paiements_garde()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_jour_meme boolean;
BEGIN
  v_jour_meme := (OLD.created_at AT TIME ZONE 'Europe/Brussels')::date
                 = (now() AT TIME ZONE 'Europe/Brussels')::date;

  IF TG_OP = 'DELETE' THEN
    IF NOT v_jour_meme THEN
      RAISE EXCEPTION 'suppression_paiement_jour_meme' USING ERRCODE = 'P0001';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.annule_le IS NOT NULL THEN
    RAISE EXCEPTION 'paiement_annule_fige' USING ERRCODE = 'P0001';
  END IF;

  IF NEW.annule_le IS NOT NULL THEN
    -- Annulation : rien d'autre ne change ; auteur et date imposés.
    IF (NEW.contrat_id, NEW.date_paiement, NEW.montant_ht, NEW.montant_tva, NEW.retenue_onss,
        NEW.retenue_spf, NEW.mode, NEW.reference, NEW.preuve_fichier, NEW.verification_30bis_id)
       IS DISTINCT FROM
       (OLD.contrat_id, OLD.date_paiement, OLD.montant_ht, OLD.montant_tva, OLD.retenue_onss,
        OLD.retenue_spf, OLD.mode, OLD.reference, OLD.preuve_fichier, OLD.verification_30bis_id) THEN
      RAISE EXCEPTION 'annulation_seulement' USING ERRCODE = 'P0001';
    END IF;
    IF btrim(coalesce(NEW.motif_annulation, '')) = '' THEN
      RAISE EXCEPTION 'motif_annulation_requis' USING ERRCODE = 'P0001';
    END IF;
    NEW.annule_le := now();
    NEW.annule_par := auth.uid();
    RETURN NEW;
  END IF;

  IF NOT v_jour_meme THEN
    RAISE EXCEPTION 'modification_paiement_interdite' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_achat_paiements_garde ON public.achat_paiements;
CREATE TRIGGER trg_achat_paiements_garde
BEFORE UPDATE OR DELETE ON public.achat_paiements
FOR EACH ROW EXECUTE FUNCTION public.achat_paiements_garde();

-- À l'insertion, l'annulation ne peut pas être pré-remplie.
CREATE OR REPLACE FUNCTION public.achat_paiements_insertion()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.annule_le := NULL;
  NEW.annule_par := NULL;
  NEW.motif_annulation := NULL;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_achat_paiements_insertion ON public.achat_paiements;
CREATE TRIGGER trg_achat_paiements_insertion
BEFORE INSERT ON public.achat_paiements
FOR EACH ROW EXECUTE FUNCTION public.achat_paiements_insertion();

-- ---------------------------------------------------------------------------
-- 6. Contrat signé non modifiable
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sous_traitant_contrats_garde()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.contrat_signatures
             WHERE contrat_id = OLD.id AND statut = 'signe') THEN
    RAISE EXCEPTION 'contrat_signe_non_modifiable' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sous_traitant_contrats_garde ON public.sous_traitant_contrats;
CREATE TRIGGER trg_sous_traitant_contrats_garde
BEFORE UPDATE ON public.sous_traitant_contrats
FOR EACH ROW EXECUTE FUNCTION public.sous_traitant_contrats_garde();

-- ---------------------------------------------------------------------------
-- 7. Validation d'une prestation : admin ou gérant, auteur et date imposés
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sous_traitant_prestations_validation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.valide_par IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.valide_par IS DISTINCT FROM NEW.valide_par) THEN
    IF NOT public.est_gestionnaire() THEN
      RAISE EXCEPTION 'validation_reservee_gestionnaire' USING ERRCODE = 'P0001';
    END IF;
    NEW.valide_par := auth.uid();
    NEW.valide_le := now();
  ELSIF NEW.valide_par IS NULL THEN
    NEW.valide_le := NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sous_traitant_prestations_validation ON public.sous_traitant_prestations;
CREATE TRIGGER trg_sous_traitant_prestations_validation
BEFORE INSERT OR UPDATE ON public.sous_traitant_prestations
FOR EACH ROW EXECUTE FUNCTION public.sous_traitant_prestations_validation();

-- ---------------------------------------------------------------------------
-- ROLLBACK : à exécuter manuellement si besoin (bloc entièrement commenté).
-- DROP TRIGGER IF EXISTS trg_sous_traitant_prestations_validation ON public.sous_traitant_prestations;
-- DROP FUNCTION IF EXISTS public.sous_traitant_prestations_validation();
-- DROP TRIGGER IF EXISTS trg_sous_traitant_contrats_garde ON public.sous_traitant_contrats;
-- DROP FUNCTION IF EXISTS public.sous_traitant_contrats_garde();
-- DROP TRIGGER IF EXISTS trg_achat_paiements_insertion ON public.achat_paiements;
-- DROP FUNCTION IF EXISTS public.achat_paiements_insertion();
-- DROP TRIGGER IF EXISTS trg_achat_paiements_garde ON public.achat_paiements;
-- DROP FUNCTION IF EXISTS public.achat_paiements_garde();
-- -- Version précédente du contrôle (sans plafond), reprise de 20261006120000 :
-- CREATE OR REPLACE FUNCTION public.check_paiement_30bis()
-- RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
-- DECLARE
--   v_st uuid;
--   v_verif public.verifications_30bis%ROWTYPE;
--   v_taux public.parametres_30bis%ROWTYPE;
--   v_onss numeric;
--   v_spf numeric;
-- BEGIN
--   SELECT sous_traitant_id INTO v_st
--   FROM public.sous_traitant_contrats
--   WHERE id = NEW.contrat_id AND company_id = NEW.company_id;
--
--   IF NEW.verification_30bis_id IS NULL THEN
--     RAISE EXCEPTION 'verification_30bis_requise' USING ERRCODE = 'P0001';
--   END IF;
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
--   -- Base : montant HTVA du paiement (pas le montant de la dette). Plafond éventuel au montant
--   -- de la dette : non appliqué, en attente de confirmation (voir JOURNAL).
--   v_onss := CASE WHEN v_verif.dette_sociale THEN round(NEW.montant_ht * v_taux.taux_retenue_onss, 2) ELSE 0 END;
--   v_spf := CASE WHEN v_verif.dette_fiscale THEN round(NEW.montant_ht * v_taux.taux_retenue_spf, 2) ELSE 0 END;
--   IF NEW.retenue_onss <> v_onss OR NEW.retenue_spf <> v_spf THEN
--     RAISE EXCEPTION 'retenue_30bis_incorrecte'
--       USING ERRCODE = 'P0001',
--             DETAIL = format('attendu ONSS %s, SPF %s', v_onss, v_spf);
--   END IF;
--
--   RETURN NEW;
-- END $$;
-- DROP FUNCTION IF EXISTS public.est_gestionnaire();
-- ALTER TABLE public.achat_paiements DROP CONSTRAINT IF EXISTS achat_paiements_annulation_chk;
-- DROP INDEX IF EXISTS public.idx_achat_paiements_annule_par;
-- ALTER TABLE public.achat_paiements DROP COLUMN IF EXISTS motif_annulation,
--   DROP COLUMN IF EXISTS annule_par, DROP COLUMN IF EXISTS annule_le;
-- ALTER TABLE public.verifications_30bis DROP CONSTRAINT IF EXISTS verifications_30bis_montants_chk;
-- ALTER TABLE public.verifications_30bis DROP COLUMN IF EXISTS montant_dette_spf,
--   DROP COLUMN IF EXISTS montant_dette_onss;
