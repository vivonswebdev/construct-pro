-- Phase 1 — Multilingue
-- 1) Langue des profils, du personnel et des clients (codes i18n en minuscules).
-- 2) Statuts et types : libellés français -> codes neutres (traduits à l'affichage).
-- 3) Cache des traductions de contenu saisi (translateText).

-- ---------------------------------------------------------------------------
-- 1. Langues
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS langue text NOT NULL DEFAULT 'fr'
  CONSTRAINT profiles_langue_chk CHECK (langue IN ('fr', 'nl', 'en', 'ro', 'pl'));

ALTER TABLE public.personnel
  ADD COLUMN IF NOT EXISTS langue text NOT NULL DEFAULT 'fr'
  CONSTRAINT personnel_langue_chk CHECK (langue IN ('fr', 'nl', 'en', 'ro', 'pl'));

-- clients.langue existait en 'FR'/'NL' : passage en minuscules + EN (documents officiels FR/NL/EN)
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_langue_check;
UPDATE public.clients SET langue = lower(langue);
ALTER TABLE public.clients ALTER COLUMN langue SET DEFAULT 'fr';
ALTER TABLE public.clients
  ADD CONSTRAINT clients_langue_chk CHECK (langue IN ('fr', 'nl', 'en'));

-- ---------------------------------------------------------------------------
-- 2. Statuts / types en codes neutres
--    Conversion générique : minuscules, sans accents, espaces -> '_'
--    ('En cours' -> 'en_cours', 'Accepté' -> 'accepte', 'Intérim' -> 'interim').
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.to_code(_v text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT regexp_replace(
    translate(lower(trim(_v)), 'àâäéèêëîïôöùûüç', 'aaaeeeeiioouuuc'),
    '\s+', '_', 'g'
  )
$$;

UPDATE public.chantiers SET status = public.to_code(status);
UPDATE public.etapes SET status = public.to_code(status);
UPDATE public.factures SET status = public.to_code(status);
UPDATE public.presence SET status = public.to_code(status);
UPDATE public.personnel SET status = public.to_code(status),
                            contract_type = public.to_code(contract_type);
UPDATE public.vehicules SET status = public.to_code(status), type = public.to_code(type);
UPDATE public.salary_payments SET payment_method = public.to_code(payment_method);

ALTER TABLE public.chantiers ALTER COLUMN status SET DEFAULT 'en_attente';
ALTER TABLE public.etapes ALTER COLUMN status SET DEFAULT 'en_attente';
ALTER TABLE public.factures ALTER COLUMN status SET DEFAULT 'brouillon';
ALTER TABLE public.personnel ALTER COLUMN status SET DEFAULT 'actif';
ALTER TABLE public.vehicules ALTER COLUMN status SET DEFAULT 'disponible';
ALTER TABLE public.vehicules ALTER COLUMN type SET DEFAULT 'camionnette';
ALTER TABLE public.salary_payments ALTER COLUMN payment_method SET DEFAULT 'virement';

-- Garde-fous : un libellé traduit ne doit plus jamais être écrit en base.
ALTER TABLE public.chantiers ADD CONSTRAINT chantiers_status_chk
  CHECK (status IN ('en_attente', 'en_cours', 'en_retard', 'termine'));
ALTER TABLE public.etapes ADD CONSTRAINT etapes_status_chk
  CHECK (status IN ('en_attente', 'en_cours', 'en_retard', 'termine'));
ALTER TABLE public.factures ADD CONSTRAINT factures_status_chk
  CHECK (status IN ('brouillon', 'envoye', 'accepte', 'refuse', 'expire', 'payee', 'annulee'));
ALTER TABLE public.presence ADD CONSTRAINT presence_status_chk
  CHECK (status IN ('present', 'absent', 'conge'));
ALTER TABLE public.personnel ADD CONSTRAINT personnel_status_chk
  CHECK (status IN ('actif', 'inactif'));
ALTER TABLE public.personnel ADD CONSTRAINT personnel_contract_type_chk
  CHECK (contract_type IS NULL OR contract_type IN ('cdi', 'cdd', 'interim', 'independant'));
ALTER TABLE public.vehicules ADD CONSTRAINT vehicules_status_chk
  CHECK (status IN ('disponible', 'affecte', 'maintenance'));
ALTER TABLE public.vehicules ADD CONSTRAINT vehicules_type_chk
  CHECK (type IN ('camionnette', 'camion', 'engin', 'remorque', 'voiture'));

-- ---------------------------------------------------------------------------
-- 3. Cache des traductions de contenu saisi
-- ---------------------------------------------------------------------------
CREATE TABLE public.traductions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  source_hash text NOT NULL,          -- SHA-256 du texte source
  langue_cible text NOT NULL CHECK (langue_cible IN ('fr', 'nl', 'en', 'ro', 'pl')),
  langue_source text,                 -- détectée par l'IA
  texte_traduit text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, source_hash, langue_cible)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.traductions TO authenticated;
GRANT ALL ON public.traductions TO service_role;
ALTER TABLE public.traductions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "traductions_select" ON public.traductions FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "traductions_insert" ON public.traductions FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "traductions_update" ON public.traductions FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "traductions_delete" ON public.traductions FOR DELETE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

-- ---------------------------------------------------------------------------
-- ROLLBACK : à exécuter manuellement si besoin (bloc entièrement commenté).
-- Les statuts ne sont pas reconvertis en libellés français (conversion non réversible
-- sans perte : utiliser une sauvegarde si nécessaire).
-- ---------------------------------------------------------------------------
-- DROP TABLE IF EXISTS public.traductions;
-- ALTER TABLE public.vehicules DROP CONSTRAINT IF EXISTS vehicules_type_chk;
-- ALTER TABLE public.vehicules DROP CONSTRAINT IF EXISTS vehicules_status_chk;
-- ALTER TABLE public.personnel DROP CONSTRAINT IF EXISTS personnel_contract_type_chk;
-- ALTER TABLE public.personnel DROP CONSTRAINT IF EXISTS personnel_status_chk;
-- ALTER TABLE public.presence DROP CONSTRAINT IF EXISTS presence_status_chk;
-- ALTER TABLE public.factures DROP CONSTRAINT IF EXISTS factures_status_chk;
-- ALTER TABLE public.etapes DROP CONSTRAINT IF EXISTS etapes_status_chk;
-- ALTER TABLE public.chantiers DROP CONSTRAINT IF EXISTS chantiers_status_chk;
-- DROP FUNCTION IF EXISTS public.to_code(text);
-- ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_langue_chk;
-- ALTER TABLE public.personnel DROP COLUMN IF EXISTS langue;
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS langue;
