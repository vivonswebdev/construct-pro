-- Phase 9 — Signature électronique des contrats de sous-traitance par lien.
--
-- Principes :
--  * Une demande de signature fige à l'envoi les données du contrat (donnees) et l'empreinte
--    SHA-256 du texte présenté (document_hash). L'entrepreneur signe à l'envoi.
--  * Le sous-traitant n'a pas de compte : il ouvre un lien à jeton (≈ 244 bits aléatoires) et passe
--    par deux fonctions security definer (lecture, signature). Aucune policy anon sur la table.
--  * Preuve figée : pas de suppression ; seule l'annulation d'une demande non signée est permise ;
--    une demande signée ou annulée n'est plus modifiable. Le contrat lié ne peut plus être supprimé.
--  * Signature électronique simple (eIDAS) avec piste d'audit : dates, IP, navigateur, empreintes.

CREATE TABLE public.contrat_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  contrat_id uuid NOT NULL,
  token text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  modele text NOT NULL DEFAULT 'sous_traitance_cadre_v1',
  langue text NOT NULL DEFAULT 'fr' CHECK (langue IN ('fr', 'nl', 'en')),
  donnees jsonb NOT NULL CHECK (jsonb_typeof(donnees) = 'object'),
  document_hash text NOT NULL CHECK (document_hash ~ '^[0-9a-f]{64}$'),
  statut text NOT NULL DEFAULT 'envoye' CHECK (statut IN ('envoye', 'signe', 'annule')),
  expire_le timestamptz NOT NULL DEFAULT now() + interval '30 days',
  -- Signature de l'entrepreneur (à l'envoi)
  entreprise_signataire_nom text NOT NULL CHECK (btrim(entreprise_signataire_nom) <> ''),
  entreprise_signataire_qualite text NOT NULL CHECK (btrim(entreprise_signataire_qualite) <> ''),
  entreprise_signature text NOT NULL CHECK (entreprise_signature LIKE 'data:image/png;base64,%'),
  entreprise_signe_le timestamptz NOT NULL DEFAULT now(),
  entreprise_signe_par uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- Suivi et signature du sous-traitant (écrits uniquement par public.signer_contrat)
  consulte_le timestamptz,
  signataire_nom text,
  signataire_qualite text,
  signataire_champs jsonb,
  signe_lieu text,
  signature text CHECK (signature LIKE 'data:image/png;base64,%'),
  signe_le timestamptz,
  signe_ip text,
  signe_user_agent text,
  signe_hash text CHECK (signe_hash ~ '^[0-9a-f]{64}$'),
  annule_le timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contrat_signatures_contrat_fk FOREIGN KEY (contrat_id, company_id)
    REFERENCES public.sous_traitant_contrats (id, company_id) ON DELETE RESTRICT,
  CONSTRAINT contrat_signatures_signe_chk CHECK (
    statut <> 'signe' OR (signe_le IS NOT NULL AND signature IS NOT NULL
                          AND signataire_nom IS NOT NULL AND signe_hash IS NOT NULL)
  ),
  CONSTRAINT contrat_signatures_tailles_chk CHECK (
    length(entreprise_signature) < 300000 AND coalesce(length(signature), 0) < 300000
  )
);
CREATE INDEX idx_contrat_signatures_company ON public.contrat_signatures (company_id);
CREATE INDEX idx_contrat_signatures_contrat ON public.contrat_signatures (contrat_id, created_at DESC);
CREATE INDEX idx_contrat_signatures_signe_par ON public.contrat_signatures (entreprise_signe_par);

-- Garde : à la création, jeton et état imposés ; ensuite, seule l'annulation d'une demande
-- en cours est possible pour les utilisateurs (la signature passe par signer_contrat).
CREATE OR REPLACE FUNCTION public.contrat_signatures_garde()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
    NEW.statut := 'envoye';
    NEW.entreprise_signe_le := now();
    NEW.entreprise_signe_par := coalesce(auth.uid(), NEW.entreprise_signe_par);
    NEW.consulte_le := NULL;
    NEW.signataire_nom := NULL;
    NEW.signataire_qualite := NULL;
    NEW.signataire_champs := NULL;
    NEW.signe_lieu := NULL;
    NEW.signature := NULL;
    NEW.signe_le := NULL;
    NEW.signe_ip := NULL;
    NEW.signe_user_agent := NULL;
    NEW.signe_hash := NULL;
    NEW.annule_le := NULL;
    RETURN NEW;
  END IF;
  IF OLD.statut <> 'envoye' THEN
    RAISE EXCEPTION 'signature_figee' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.statut = 'annule' THEN
    NEW.annule_le := now();
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_contrat_signatures_garde
BEFORE INSERT OR UPDATE ON public.contrat_signatures
FOR EACH ROW EXECUTE FUNCTION public.contrat_signatures_garde();

-- Lecture publique par jeton (page /signer/$token). Marque la première consultation.
CREATE OR REPLACE FUNCTION public.contrat_a_signer(_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.contrat_signatures%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.contrat_signatures WHERE token = _token;
  IF NOT FOUND OR _token IS NULL OR length(_token) < 32 THEN
    RAISE EXCEPTION 'lien_invalide' USING ERRCODE = 'P0001';
  END IF;
  IF r.statut = 'annule' THEN
    RAISE EXCEPTION 'lien_annule' USING ERRCODE = 'P0001';
  END IF;
  IF r.statut = 'envoye' AND r.expire_le < now() THEN
    RAISE EXCEPTION 'lien_expire' USING ERRCODE = 'P0001';
  END IF;
  IF r.statut = 'envoye' AND r.consulte_le IS NULL THEN
    UPDATE public.contrat_signatures SET consulte_le = now() WHERE id = r.id;
  END IF;
  RETURN jsonb_build_object(
    'modele', r.modele,
    'langue', r.langue,
    'donnees', r.donnees,
    'document_hash', r.document_hash,
    'statut', r.statut,
    'expire_le', r.expire_le,
    'entreprise_signataire_nom', r.entreprise_signataire_nom,
    'entreprise_signataire_qualite', r.entreprise_signataire_qualite,
    'entreprise_signature', r.entreprise_signature,
    'entreprise_signe_le', r.entreprise_signe_le,
    'signataire_nom', r.signataire_nom,
    'signataire_qualite', r.signataire_qualite,
    'signataire_champs', r.signataire_champs,
    'signe_lieu', r.signe_lieu,
    'signature', r.signature,
    'signe_le', r.signe_le,
    'signe_ip', r.signe_ip,
    'signe_user_agent', r.signe_user_agent,
    'signe_hash', r.signe_hash,
    'consulte_le', coalesce(r.consulte_le, now())
  );
END $$;

-- Signature par le sous-traitant. _document_hash doit correspondre au texte présenté à l'envoi :
-- si le modèle a changé entre-temps, la signature est refusée.
CREATE OR REPLACE FUNCTION public.signer_contrat(
  _token text,
  _nom text,
  _qualite text,
  _lieu text,
  _champs jsonb,
  _signature text,
  _document_hash text,
  _signe_hash text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.contrat_signatures%ROWTYPE;
  v_headers json;
BEGIN
  SELECT * INTO r FROM public.contrat_signatures WHERE token = _token FOR UPDATE;
  IF NOT FOUND OR _token IS NULL OR length(_token) < 32 THEN
    RAISE EXCEPTION 'lien_invalide' USING ERRCODE = 'P0001';
  END IF;
  IF r.statut = 'signe' THEN
    RAISE EXCEPTION 'deja_signe' USING ERRCODE = 'P0001';
  END IF;
  IF r.statut = 'annule' THEN
    RAISE EXCEPTION 'lien_annule' USING ERRCODE = 'P0001';
  END IF;
  IF r.expire_le < now() THEN
    RAISE EXCEPTION 'lien_expire' USING ERRCODE = 'P0001';
  END IF;
  IF _document_hash IS DISTINCT FROM r.document_hash THEN
    RAISE EXCEPTION 'document_modifie' USING ERRCODE = 'P0001';
  END IF;
  IF btrim(coalesce(_nom, '')) = '' OR btrim(coalesce(_qualite, '')) = ''
     OR btrim(coalesce(_lieu, '')) = '' THEN
    RAISE EXCEPTION 'champs_requis' USING ERRCODE = 'P0001';
  END IF;
  IF _signature IS NULL OR _signature NOT LIKE 'data:image/png;base64,%'
     OR length(_signature) >= 300000 THEN
    RAISE EXCEPTION 'signature_invalide' USING ERRCODE = 'P0001';
  END IF;
  IF _champs IS NOT NULL AND jsonb_typeof(_champs) <> 'object' THEN
    RAISE EXCEPTION 'champs_requis' USING ERRCODE = 'P0001';
  END IF;

  BEGIN
    v_headers := nullif(current_setting('request.headers', true), '')::json;
  EXCEPTION WHEN others THEN
    v_headers := NULL;
  END;

  UPDATE public.contrat_signatures SET
    statut = 'signe',
    signataire_nom = left(btrim(_nom), 200),
    signataire_qualite = left(btrim(_qualite), 200),
    signe_lieu = left(btrim(_lieu), 200),
    signataire_champs = _champs,
    signature = _signature,
    signe_le = now(),
    signe_hash = _signe_hash,
    signe_ip = left(btrim(split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1)), 100),
    signe_user_agent = left(v_headers ->> 'user-agent', 500),
    consulte_le = coalesce(consulte_le, now())
  WHERE id = r.id;

  RETURN public.contrat_a_signer(_token);
END $$;

-- ---------------------------------------------------------------------------
-- Droits et RLS
-- ---------------------------------------------------------------------------
-- Supabase accorde par défaut tous les droits à anon et authenticated sur les nouvelles tables :
-- on les retire avant d'accorder le strict nécessaire.
REVOKE ALL ON public.contrat_signatures FROM anon, authenticated;
GRANT SELECT, INSERT ON public.contrat_signatures TO authenticated;
GRANT UPDATE (statut) ON public.contrat_signatures TO authenticated;  -- annulation uniquement
GRANT ALL ON public.contrat_signatures TO service_role;

ALTER TABLE public.contrat_signatures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contrat_signatures_select" ON public.contrat_signatures FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "contrat_signatures_insert" ON public.contrat_signatures FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "contrat_signatures_update" ON public.contrat_signatures FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()))
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()) AND statut = 'annule');
-- Pas de policy DELETE : une demande de signature est une preuve.

REVOKE ALL ON FUNCTION public.contrat_a_signer(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.signer_contrat(text, text, text, text, jsonb, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contrat_a_signer(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.signer_contrat(text, text, text, text, jsonb, text, text, text)
  TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- ROLLBACK : à exécuter manuellement si besoin (bloc entièrement commenté).
-- DROP FUNCTION IF EXISTS public.signer_contrat(text, text, text, text, jsonb, text, text, text);
-- DROP FUNCTION IF EXISTS public.contrat_a_signer(text);
-- DROP TABLE IF EXISTS public.contrat_signatures;
-- DROP FUNCTION IF EXISTS public.contrat_signatures_garde();
