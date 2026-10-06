-- Phase 9 — Sous-traitants : fiches, vérifications 30bis, contrats, prestations, paiements.
-- PASSATION §6 (phase 9), §10.6 et annexe A.
--
-- Principes :
--  * company_id NOT NULL, rempli par l'application ; RLS sur get_user_company_id(auth.uid()).
--  * Clés étrangères composites (id, company_id) : une ligne ne peut pas référencer une ligne
--    d'une autre société, même en connaissant son identifiant.
--  * La vérification 30bis est une preuve datée, liée à CHAQUE paiement (jamais un booléen sur
--    la fiche du sous-traitant). Elle n'est ni modifiable ni supprimable.
--  * Un paiement de sous-traitance est refusé sans vérification du jour, et si une dette est
--    constatée, la retenue doit correspondre au taux en vigueur (table parametres_30bis).
--  * Les paiements sont liés au contrat ; le lien vers la facture d'achat (achat_id) sera
--    ajouté en phase 12, quand la table achats existera.
--  * Codes neutres en base, libellés via i18n.

-- ---------------------------------------------------------------------------
-- 0. Clé composite sur chantiers (cible des FK composites)
-- ---------------------------------------------------------------------------
ALTER TABLE public.chantiers
  ADD CONSTRAINT chantiers_id_company_uniq UNIQUE (id, company_id);

-- ---------------------------------------------------------------------------
-- 1. Sous-traitants
-- ---------------------------------------------------------------------------
CREATE TABLE public.sous_traitants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  raison_sociale text NOT NULL CHECK (btrim(raison_sociale) <> ''),
  forme_juridique text
    CHECK (forme_juridique IN ('srl', 'sa', 'sc', 'scomm', 'independant', 'autre')),
  numero_bce text,
  numero_tva text,
  adresse text,
  code_postal text,
  ville text,
  email text,
  telephone text,
  contact_nom text,
  contact_email text,
  contact_telephone text,
  iban text,
  metiers text[] NOT NULL DEFAULT '{}',
  conditions text,
  note_interne text,
  statut text NOT NULL DEFAULT 'actif' CHECK (statut IN ('actif', 'bloque')),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sous_traitants_id_company_uniq UNIQUE (id, company_id)
);
-- Un même numéro d'entreprise ne peut être encodé deux fois dans une société.
CREATE UNIQUE INDEX sous_traitants_bce_uniq
  ON public.sous_traitants (company_id, numero_bce) WHERE numero_bce IS NOT NULL;
CREATE INDEX idx_sous_traitants_company ON public.sous_traitants (company_id);

-- ---------------------------------------------------------------------------
-- 2. Paramètres légaux de la retenue 30bis (globaux, datés)
--    Lecture pour tous les utilisateurs connectés ; écriture réservée (admin plateforme).
-- ---------------------------------------------------------------------------
CREATE TABLE public.parametres_30bis (
  date_debut date PRIMARY KEY,
  taux_retenue_onss numeric NOT NULL CHECK (taux_retenue_onss BETWEEN 0 AND 1),
  taux_retenue_spf numeric NOT NULL CHECK (taux_retenue_spf BETWEEN 0 AND 1),
  date_verification date,
  source text
);
-- Valeurs indicatives (PASSATION §5) : à valider par Youssef, date_verification à compléter.
INSERT INTO public.parametres_30bis (date_debut, taux_retenue_onss, taux_retenue_spf, source)
VALUES ('2000-01-01', 0.35, 0.15, 'PASSATION §5 — à valider');

-- ---------------------------------------------------------------------------
-- 3. Vérifications 30bis (preuve datée, immuable)
-- ---------------------------------------------------------------------------
CREATE TABLE public.verifications_30bis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sous_traitant_id uuid NOT NULL,
  verifie_le timestamptz NOT NULL DEFAULT now(),
  dette_sociale boolean NOT NULL,
  dette_fiscale boolean NOT NULL,
  preuve_fichier text,          -- capture du résultat (Storage, bucket documents)
  source_url text,              -- service officiel consulté
  notes text,
  verifie_par uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT verifications_30bis_id_company_uniq UNIQUE (id, company_id),
  CONSTRAINT verifications_30bis_st_fk FOREIGN KEY (sous_traitant_id, company_id)
    REFERENCES public.sous_traitants (id, company_id) ON DELETE CASCADE
);
CREATE INDEX idx_verif30bis_company ON public.verifications_30bis (company_id);
CREATE INDEX idx_verif30bis_st ON public.verifications_30bis (sous_traitant_id, verifie_le DESC);

-- ---------------------------------------------------------------------------
-- 4. Contrats de sous-traitance
-- ---------------------------------------------------------------------------
CREATE TABLE public.sous_traitant_contrats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sous_traitant_id uuid NOT NULL,
  chantier_id uuid,
  descriptif_prestations text NOT NULL CHECK (btrim(descriptif_prestations) <> ''),
  type_prix text NOT NULL DEFAULT 'forfait' CHECK (type_prix IN ('forfait', 'horaire', 'unitaire')),
  prix_unitaire_ht numeric CHECK (prix_unitaire_ht >= 0),
  unite text CHECK (unite IN ('heure', 'jour', 'm2', 'm3', 'm', 'piece', 'forfait')),
  montant_forfait_ht numeric CHECK (montant_forfait_ht >= 0),
  frequence_paiement text NOT NULL DEFAULT 'a_la_facture'
    CHECK (frequence_paiement IN ('a_la_facture', 'hebdomadaire', 'mensuelle', 'avancement')),
  delai_paiement_jours integer NOT NULL DEFAULT 30 CHECK (delai_paiement_jours BETWEEN 0 AND 365),
  date_debut date,
  date_fin date,
  bon_commande_ref text,
  bon_commande_fichier text,
  devis_ref text,
  devis_fichier text,
  planning_fichier text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sous_traitant_contrats_id_company_uniq UNIQUE (id, company_id),
  CONSTRAINT sous_traitant_contrats_st_fk FOREIGN KEY (sous_traitant_id, company_id)
    REFERENCES public.sous_traitants (id, company_id) ON DELETE CASCADE,
  CONSTRAINT sous_traitant_contrats_chantier_fk FOREIGN KEY (chantier_id, company_id)
    REFERENCES public.chantiers (id, company_id) ON DELETE SET NULL (chantier_id),
  CONSTRAINT sous_traitant_contrats_dates_chk CHECK (date_fin IS NULL OR date_debut IS NULL OR date_fin >= date_debut),
  CONSTRAINT sous_traitant_contrats_prix_chk CHECK (
    (type_prix = 'forfait' AND montant_forfait_ht IS NOT NULL)
    OR (type_prix IN ('horaire', 'unitaire') AND prix_unitaire_ht IS NOT NULL AND unite IS NOT NULL)
  )
);
CREATE INDEX idx_st_contrats_company ON public.sous_traitant_contrats (company_id);
CREATE INDEX idx_st_contrats_st ON public.sous_traitant_contrats (sous_traitant_id);
CREATE INDEX idx_st_contrats_chantier ON public.sous_traitant_contrats (chantier_id);

-- ---------------------------------------------------------------------------
-- 5. Journal des prestations (preuves de la réalité des travaux)
-- ---------------------------------------------------------------------------
CREATE TABLE public.sous_traitant_prestations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  contrat_id uuid NOT NULL,
  chantier_id uuid,
  date_prestation date NOT NULL,
  description text,
  heures numeric CHECK (heures >= 0 AND heures <= 24 * 31),
  -- [{ "nom": "...", "fonction": "...", "heures": 8 }] — preuve de prestation uniquement (RGPD)
  ouvriers jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(ouvriers) = 'array'),
  feuille_chantier_fichier text,
  photos text[] NOT NULL DEFAULT '{}',
  bon_travail_ref text,
  presence_enregistree boolean NOT NULL DEFAULT false,  -- Checkinatwork
  presence_fichier text,
  valide_par uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  valide_le timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sous_traitant_prestations_id_company_uniq UNIQUE (id, company_id),
  CONSTRAINT sous_traitant_prestations_contrat_fk FOREIGN KEY (contrat_id, company_id)
    REFERENCES public.sous_traitant_contrats (id, company_id) ON DELETE CASCADE,
  CONSTRAINT sous_traitant_prestations_chantier_fk FOREIGN KEY (chantier_id, company_id)
    REFERENCES public.chantiers (id, company_id) ON DELETE SET NULL (chantier_id),
  CONSTRAINT sous_traitant_prestations_validation_chk CHECK ((valide_par IS NULL) = (valide_le IS NULL))
);
CREATE INDEX idx_st_prestations_company ON public.sous_traitant_prestations (company_id);
CREATE INDEX idx_st_prestations_contrat ON public.sous_traitant_prestations (contrat_id, date_prestation);
CREATE INDEX idx_st_prestations_chantier ON public.sous_traitant_prestations (chantier_id);

-- ---------------------------------------------------------------------------
-- 6. Paiements (sous-traitance en phase 9 ; achats en général à partir de la phase 12)
-- ---------------------------------------------------------------------------
CREATE TABLE public.achat_paiements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  contrat_id uuid NOT NULL,     -- phase 12 : rendu facultatif quand achat_id sera ajouté
  date_paiement date NOT NULL,
  montant_ht numeric NOT NULL CHECK (montant_ht > 0),  -- base de calcul des retenues
  montant_tva numeric NOT NULL DEFAULT 0 CHECK (montant_tva >= 0),
  retenue_onss numeric NOT NULL DEFAULT 0 CHECK (retenue_onss >= 0),
  retenue_spf numeric NOT NULL DEFAULT 0 CHECK (retenue_spf >= 0),
  montant_verse numeric GENERATED ALWAYS AS (montant_ht + montant_tva - retenue_onss - retenue_spf) STORED,
  mode text NOT NULL DEFAULT 'virement'
    CHECK (mode IN ('virement', 'especes', 'domiciliation', 'carte')),
  reference text,
  preuve_fichier text,
  verification_30bis_id uuid,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT achat_paiements_contrat_fk FOREIGN KEY (contrat_id, company_id)
    REFERENCES public.sous_traitant_contrats (id, company_id) ON DELETE RESTRICT,
  CONSTRAINT achat_paiements_verif_fk FOREIGN KEY (verification_30bis_id, company_id)
    REFERENCES public.verifications_30bis (id, company_id) ON DELETE RESTRICT,
  CONSTRAINT achat_paiements_verse_chk CHECK (montant_ht + montant_tva - retenue_onss - retenue_spf >= 0)
);
CREATE INDEX idx_achat_paiements_company ON public.achat_paiements (company_id);
CREATE INDEX idx_achat_paiements_contrat ON public.achat_paiements (contrat_id, date_paiement);
CREATE INDEX idx_achat_paiements_verif ON public.achat_paiements (verification_30bis_id);

-- Contrôle 30bis à l'enregistrement d'un paiement de sous-traitance.
-- Erreurs levées avec un code (message) traduit côté application.
CREATE OR REPLACE FUNCTION public.check_paiement_30bis()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_st uuid;
  v_verif public.verifications_30bis%ROWTYPE;
  v_taux public.parametres_30bis%ROWTYPE;
  v_onss numeric;
  v_spf numeric;
BEGIN
  SELECT sous_traitant_id INTO v_st
  FROM public.sous_traitant_contrats
  WHERE id = NEW.contrat_id AND company_id = NEW.company_id;

  IF NEW.verification_30bis_id IS NULL THEN
    RAISE EXCEPTION 'verification_30bis_requise' USING ERRCODE = 'P0001';
  END IF;

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

  v_onss := CASE WHEN v_verif.dette_sociale THEN round(NEW.montant_ht * v_taux.taux_retenue_onss, 2) ELSE 0 END;
  v_spf := CASE WHEN v_verif.dette_fiscale THEN round(NEW.montant_ht * v_taux.taux_retenue_spf, 2) ELSE 0 END;
  IF NEW.retenue_onss <> v_onss OR NEW.retenue_spf <> v_spf THEN
    RAISE EXCEPTION 'retenue_30bis_incorrecte'
      USING ERRCODE = 'P0001',
            DETAIL = format('attendu ONSS %s, SPF %s', v_onss, v_spf);
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_achat_paiements_30bis
BEFORE INSERT OR UPDATE ON public.achat_paiements
FOR EACH ROW EXECUTE FUNCTION public.check_paiement_30bis();

-- ---------------------------------------------------------------------------
-- 7. Droits et RLS
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sous_traitants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sous_traitant_contrats TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sous_traitant_prestations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.achat_paiements TO authenticated;
GRANT SELECT, INSERT ON public.verifications_30bis TO authenticated;  -- preuve immuable
GRANT SELECT ON public.parametres_30bis TO authenticated;
GRANT ALL ON public.sous_traitants, public.sous_traitant_contrats, public.sous_traitant_prestations,
  public.achat_paiements, public.verifications_30bis, public.parametres_30bis TO service_role;

ALTER TABLE public.sous_traitants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sous_traitant_contrats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sous_traitant_prestations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achat_paiements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verifications_30bis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parametres_30bis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sous_traitants_select" ON public.sous_traitants FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "sous_traitants_insert" ON public.sous_traitants FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "sous_traitants_update" ON public.sous_traitants FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()))
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "sous_traitants_delete" ON public.sous_traitants FOR DELETE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "st_contrats_select" ON public.sous_traitant_contrats FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "st_contrats_insert" ON public.sous_traitant_contrats FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "st_contrats_update" ON public.sous_traitant_contrats FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()))
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "st_contrats_delete" ON public.sous_traitant_contrats FOR DELETE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "st_prestations_select" ON public.sous_traitant_prestations FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "st_prestations_insert" ON public.sous_traitant_prestations FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "st_prestations_update" ON public.sous_traitant_prestations FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()))
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "st_prestations_delete" ON public.sous_traitant_prestations FOR DELETE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "achat_paiements_select" ON public.achat_paiements FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "achat_paiements_insert" ON public.achat_paiements FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "achat_paiements_update" ON public.achat_paiements FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()))
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "achat_paiements_delete" ON public.achat_paiements FOR DELETE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

-- Vérifications 30bis : lecture et ajout uniquement (pas de modification ni suppression).
CREATE POLICY "verif30bis_select" ON public.verifications_30bis FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "verif30bis_insert" ON public.verifications_30bis FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "parametres_30bis_select" ON public.parametres_30bis FOR SELECT TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- ROLLBACK : à exécuter manuellement si besoin (bloc entièrement commenté).
-- ---------------------------------------------------------------------------
-- DROP TRIGGER IF EXISTS trg_achat_paiements_30bis ON public.achat_paiements;
-- DROP FUNCTION IF EXISTS public.check_paiement_30bis();
-- DROP TABLE IF EXISTS public.achat_paiements;
-- DROP TABLE IF EXISTS public.sous_traitant_prestations;
-- DROP TABLE IF EXISTS public.sous_traitant_contrats;
-- DROP TABLE IF EXISTS public.verifications_30bis;
-- DROP TABLE IF EXISTS public.parametres_30bis;
-- DROP TABLE IF EXISTS public.sous_traitants;
-- ALTER TABLE public.chantiers DROP CONSTRAINT IF EXISTS chantiers_id_company_uniq;
