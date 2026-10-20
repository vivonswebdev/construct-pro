-- Équipe interne — scans RH : cartes d'identité et contrats papier (PR B du plan
-- docs/plans/equipe-timesheet-dossiers.md). Décisions validées par Youssef le 20/10/2026 :
--
--  * Bucket PRIVÉ `rh`, séparé de `documents` (5 Mo, JPG / PNG / PDF), chemins
--    `<company_id>/<uuid>.<ext>`. AUCUNE lecture directe : la lecture d'un fichier n'est permise
--    que pendant 60 secondes, sur un ticket créé par ouvrir_document_rh(), qui journalise la
--    consultation. Ni remplacement (UPDATE) ni lecture hors ticket.
--  * Accès réservé aux gestionnaires (admin, gérant) de la société ; le rôle ouvrier ne voit
--    rien, pas même la liste. Aucun accès croisé entre sociétés.
--  * Journal d'accès (`journal_acces_rh`) écrit par les fonctions uniquement : dépôt,
--    consultation, remplacement, suppression. Non modifiable par l'API.
--  * Carte d'identité : consentement du travailleur obligatoire à chaque dépôt (date, auteur,
--    note) ; conservation jusqu'à la date de sortie + 1 an (recalculée si la date de sortie
--    change) ; une seule copie active par travailleur ; une copie remplacée est à supprimer
--    tout de suite (minimisation). Aucune lecture automatique (OCR, IA) du contenu.
--  * Contrats papier : contrat de travail, contrat de sous-traitance, autre document
--    contractuel ; rattachés à un travailleur, un sous-traitant, un chantier et / ou un client ;
--    remplacement = nouvelle version (l'ancienne reste consultable) ; suppression avec motif.
--  * Suppression : la ligne est conservée (trace) ; le fichier est effacé du stockage par
--    l'application, sur un ticket de suppression de 60 secondes (Supabase interdit d'effacer
--    un fichier en SQL).
-- Migration idempotente (rejouable) ; retour arrière en commentaire à la fin.
-- Prérequis : 20261014090000 (est_gestionnaire), 20261020090000 (personnel_id_company_uniq).

-- ---------------------------------------------------------------------------
-- 1. Bucket privé `rh`
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('rh', 'rh', false, 5242880, ARRAY['image/jpeg', 'image/png', 'application/pdf'])
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clients_id_company_uniq') THEN
    ALTER TABLE public.clients ADD CONSTRAINT clients_id_company_uniq UNIQUE (id, company_id);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Documents RH (métadonnées ; le fichier est dans le bucket `rh`)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.documents_rh (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN (
    'carte_identite', 'contrat_travail', 'contrat_sous_traitance', 'autre_contractuel')),
  titre text CHECK (titre IS NULL OR length(titre) <= 200),
  personnel_id uuid,
  sous_traitant_id uuid,
  chantier_id uuid,
  client_id uuid,
  fichier text NOT NULL UNIQUE,
  taille integer CHECK (taille IS NULL OR taille BETWEEN 1 AND 5242880),
  statut text NOT NULL DEFAULT 'en_attente'
    CHECK (statut IN ('en_attente', 'actif', 'remplace', 'supprime')),
  remplace_id uuid REFERENCES public.documents_rh(id) ON DELETE SET NULL,
  consentement_le timestamptz,
  consentement_par uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  consentement_note text CHECK (consentement_note IS NULL OR length(consentement_note) <= 500),
  conserver_jusqu_au date,
  depose_par uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  depose_le timestamptz NOT NULL DEFAULT now(),
  supprime_par uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  supprime_le timestamptz,
  motif_suppression text,
  CONSTRAINT documents_rh_personnel_fk FOREIGN KEY (personnel_id, company_id)
    REFERENCES public.personnel (id, company_id),
  CONSTRAINT documents_rh_sous_traitant_fk FOREIGN KEY (sous_traitant_id, company_id)
    REFERENCES public.sous_traitants (id, company_id),
  CONSTRAINT documents_rh_chantier_fk FOREIGN KEY (chantier_id, company_id)
    REFERENCES public.chantiers (id, company_id),
  CONSTRAINT documents_rh_client_fk FOREIGN KEY (client_id, company_id)
    REFERENCES public.clients (id, company_id),
  CONSTRAINT documents_rh_rattachement_chk CHECK (
    num_nonnulls(personnel_id, sous_traitant_id, chantier_id, client_id) >= 1),
  CONSTRAINT documents_rh_type_chk CHECK (
    (type NOT IN ('carte_identite', 'contrat_travail') OR personnel_id IS NOT NULL)
    AND (type <> 'contrat_sous_traitance' OR sous_traitant_id IS NOT NULL)),
  CONSTRAINT documents_rh_consentement_chk CHECK (
    type <> 'carte_identite' OR (consentement_le IS NOT NULL AND consentement_par IS NOT NULL)),
  CONSTRAINT documents_rh_fichier_chk CHECK (
    fichier ~ ('^' || company_id::text || '/[0-9a-f-]{36}\.(jpg|png|pdf)$')),
  CONSTRAINT documents_rh_suppression_chk CHECK (
    statut <> 'supprime'
    OR (supprime_le IS NOT NULL AND btrim(coalesce(motif_suppression, '')) <> ''))
);
CREATE INDEX IF NOT EXISTS idx_documents_rh_company ON public.documents_rh (company_id, statut);
CREATE INDEX IF NOT EXISTS idx_documents_rh_personnel ON public.documents_rh (personnel_id);
CREATE INDEX IF NOT EXISTS idx_documents_rh_sous_traitant ON public.documents_rh (sous_traitant_id);
CREATE INDEX IF NOT EXISTS idx_documents_rh_chantier ON public.documents_rh (chantier_id);
CREATE INDEX IF NOT EXISTS idx_documents_rh_client ON public.documents_rh (client_id);
CREATE INDEX IF NOT EXISTS idx_documents_rh_remplace ON public.documents_rh (remplace_id);
CREATE INDEX IF NOT EXISTS idx_documents_rh_depose_par ON public.documents_rh (depose_par);
CREATE INDEX IF NOT EXISTS idx_documents_rh_supprime_par ON public.documents_rh (supprime_par);
CREATE INDEX IF NOT EXISTS idx_documents_rh_consentement_par ON public.documents_rh (consentement_par);
CREATE INDEX IF NOT EXISTS idx_documents_rh_echeance ON public.documents_rh (conserver_jusqu_au)
  WHERE type = 'carte_identite' AND statut IN ('actif', 'remplace');
-- Une seule copie active de la carte d'identité par travailleur.
CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_rh_carte_active
  ON public.documents_rh (personnel_id) WHERE type = 'carte_identite' AND statut = 'actif';

-- ---------------------------------------------------------------------------
-- 3. Journal d'accès (écrit par les fonctions ; jamais modifié)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.journal_acces_rh (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  document_id uuid NOT NULL,          -- sans FK : la trace survit au document
  action text NOT NULL CHECK (action IN ('depot', 'consultation', 'remplacement', 'suppression')),
  par uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  par_nom text,
  le timestamptz NOT NULL DEFAULT now(),
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_journal_acces_rh_company ON public.journal_acces_rh (company_id, le DESC);
CREATE INDEX IF NOT EXISTS idx_journal_acces_rh_document ON public.journal_acces_rh (document_id, le DESC);
CREATE INDEX IF NOT EXISTS idx_journal_acces_rh_par ON public.journal_acces_rh (par);

-- ---------------------------------------------------------------------------
-- 4. Tickets d'accès aux fichiers (60 secondes ; aucune policy, fonctions seulement)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tickets_fichiers_rh (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,
  fichier text NOT NULL,
  action text NOT NULL CHECK (action IN ('lecture', 'suppression')),
  expire_le timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tickets_fichiers_rh ON public.tickets_fichiers_rh (user_id, fichier);

CREATE OR REPLACE FUNCTION public.ticket_fichier_rh_valide(_fichier text, _action text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tickets_fichiers_rh t
    WHERE t.user_id = auth.uid() AND t.fichier = _fichier AND t.expire_le > now()
      AND (_action = 'lecture' OR t.action = _action)
  )
$$;
REVOKE ALL ON FUNCTION public.ticket_fichier_rh_valide(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ticket_fichier_rh_valide(text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Fonctions internes : contrôle d'accès, journal, échéance
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rh_exiger_gestionnaire(_company_id uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.est_gestionnaire()
     OR _company_id IS DISTINCT FROM public.get_user_company_id(auth.uid()) THEN
    RAISE EXCEPTION 'rh_acces_refuse';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.rh_journaliser(_doc public.documents_rh, _action text, _details jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.journal_acces_rh (company_id, document_id, action, par, par_nom, details)
  VALUES (_doc.company_id, _doc.id, _action, auth.uid(),
          (SELECT p.full_name FROM public.profiles p WHERE p.id = auth.uid()),
          coalesce(_details, '{}'::jsonb) || jsonb_build_object('type', _doc.type));
$$;

-- Date de sortie + 1 an ; NULL tant que la date de sortie est inconnue.
CREATE OR REPLACE FUNCTION public.rh_echeance_carte(_personnel_id uuid)
RETURNS date LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (p.date_sortie + interval '1 year')::date FROM public.personnel p WHERE p.id = _personnel_id
$$;

REVOKE ALL ON FUNCTION public.rh_exiger_gestionnaire(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rh_journaliser(public.documents_rh, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rh_echeance_carte(uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Dépôt en deux temps : préparer (ligne + chemin), téléverser, confirmer
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.preparer_depot_rh(
  _type text, _format text, _titre text,
  _personnel_id uuid, _sous_traitant_id uuid, _chantier_id uuid, _client_id uuid,
  _consentement boolean, _consentement_note text, _remplace_id uuid)
RETURNS TABLE (id uuid, fichier text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _societe uuid := public.get_user_company_id(auth.uid());
  _ancien public.documents_rh;
  _id uuid := gen_random_uuid();
  _chemin text;
BEGIN
  PERFORM public.rh_exiger_gestionnaire(_societe);
  IF _format NOT IN ('jpg', 'png', 'pdf') THEN
    RAISE EXCEPTION 'rh_format_refuse';
  END IF;
  IF _type = 'carte_identite' AND NOT coalesce(_consentement, false) THEN
    RAISE EXCEPTION 'rh_consentement_obligatoire';
  END IF;
  IF _remplace_id IS NOT NULL THEN
    SELECT * INTO _ancien FROM public.documents_rh d WHERE d.id = _remplace_id;
    IF _ancien.id IS NULL OR _ancien.company_id <> _societe OR _ancien.statut <> 'actif'
       OR _ancien.type <> _type THEN
      RAISE EXCEPTION 'rh_remplacement_impossible';
    END IF;
  ELSIF _type = 'carte_identite' AND EXISTS (
    SELECT 1 FROM public.documents_rh d
    WHERE d.personnel_id = _personnel_id AND d.type = 'carte_identite' AND d.statut = 'actif'
  ) THEN
    RAISE EXCEPTION 'rh_carte_deja_active';
  END IF;
  -- Dépôts abandonnés de cet utilisateur (préparés il y a plus d'un jour, jamais confirmés).
  DELETE FROM public.documents_rh d
  WHERE d.depose_par = auth.uid() AND d.statut = 'en_attente' AND d.depose_le < now() - interval '1 day'
    AND NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'rh' AND o.name = d.fichier);

  _chemin := _societe::text || '/' || _id::text || '.' || _format;
  INSERT INTO public.documents_rh (
    id, company_id, type, titre, personnel_id, sous_traitant_id, chantier_id, client_id,
    fichier, statut, remplace_id, consentement_le, consentement_par, consentement_note,
    depose_par)
  VALUES (
    _id, _societe, _type, nullif(btrim(coalesce(_titre, '')), ''),
    _personnel_id, _sous_traitant_id, _chantier_id, _client_id,
    _chemin, 'en_attente', _remplace_id,
    CASE WHEN _type = 'carte_identite' THEN now() END,
    CASE WHEN _type = 'carte_identite' THEN auth.uid() END,
    CASE WHEN _type = 'carte_identite' THEN nullif(btrim(coalesce(_consentement_note, '')), '') END,
    auth.uid());
  RETURN QUERY SELECT _id, _chemin;
END $$;

CREATE OR REPLACE FUNCTION public.confirmer_depot_rh(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _doc public.documents_rh;
  _ancien public.documents_rh;
  _taille integer;
BEGIN
  SELECT * INTO _doc FROM public.documents_rh d WHERE d.id = _id;
  IF _doc.id IS NULL THEN
    RAISE EXCEPTION 'rh_document_introuvable';
  END IF;
  PERFORM public.rh_exiger_gestionnaire(_doc.company_id);
  IF _doc.statut <> 'en_attente' OR _doc.depose_par IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'rh_document_introuvable';
  END IF;
  SELECT coalesce((o.metadata->>'size')::integer, 1) INTO _taille
  FROM storage.objects o WHERE o.bucket_id = 'rh' AND o.name = _doc.fichier;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'rh_fichier_absent';
  END IF;

  IF _doc.remplace_id IS NOT NULL THEN
    UPDATE public.documents_rh d
      SET statut = 'remplace',
          -- Une copie de carte remplacée n'a plus de raison d'être conservée.
          conserver_jusqu_au = CASE WHEN d.type = 'carte_identite' THEN current_date
                                    ELSE d.conserver_jusqu_au END
    WHERE d.id = _doc.remplace_id AND d.statut = 'actif'
    RETURNING * INTO _ancien;
    IF _ancien.id IS NULL THEN
      RAISE EXCEPTION 'rh_remplacement_impossible';
    END IF;
    PERFORM public.rh_journaliser(_ancien, 'remplacement', jsonb_build_object('par_document', _doc.id));
  END IF;

  UPDATE public.documents_rh d
    SET statut = 'actif', taille = _taille,
        conserver_jusqu_au = CASE WHEN d.type = 'carte_identite'
                                  THEN public.rh_echeance_carte(d.personnel_id) END
  WHERE d.id = _id
  RETURNING * INTO _doc;
  PERFORM public.rh_journaliser(_doc, 'depot',
    CASE WHEN _doc.type = 'carte_identite'
         THEN jsonb_build_object('consentement_le', _doc.consentement_le) ELSE '{}'::jsonb END);
END $$;

-- Abandon d'un dépôt préparé (non confirmé) : la ligne disparaît ; si le fichier a déjà été
-- téléversé, un ticket d'effacement de 60 secondes est délivré et son chemin renvoyé.
DROP FUNCTION IF EXISTS public.annuler_depot_rh(uuid);
CREATE FUNCTION public.annuler_depot_rh(_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _doc public.documents_rh;
BEGIN
  DELETE FROM public.documents_rh d
  WHERE d.id = _id AND d.statut = 'en_attente' AND d.depose_par = auth.uid()
  RETURNING * INTO _doc;
  IF _doc.id IS NULL THEN
    RETURN NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'rh' AND o.name = _doc.fichier) THEN
    INSERT INTO public.tickets_fichiers_rh (user_id, fichier, action, expire_le)
    VALUES (auth.uid(), _doc.fichier, 'suppression', now() + interval '60 seconds');
    RETURN _doc.fichier;
  END IF;
  RETURN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 7. Consultation et suppression (journalisées, ticket de 60 secondes)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ouvrir_document_rh(_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _doc public.documents_rh;
BEGIN
  SELECT * INTO _doc FROM public.documents_rh d WHERE d.id = _id;
  IF _doc.id IS NULL THEN
    RAISE EXCEPTION 'rh_document_introuvable';
  END IF;
  PERFORM public.rh_exiger_gestionnaire(_doc.company_id);
  IF _doc.statut NOT IN ('actif', 'remplace') THEN
    RAISE EXCEPTION 'rh_document_introuvable';
  END IF;
  DELETE FROM public.tickets_fichiers_rh t WHERE t.expire_le < now() - interval '1 hour';
  INSERT INTO public.tickets_fichiers_rh (user_id, fichier, action, expire_le)
  VALUES (auth.uid(), _doc.fichier, 'lecture', now() + interval '60 seconds');
  PERFORM public.rh_journaliser(_doc, 'consultation', '{}'::jsonb);
  RETURN _doc.fichier;
END $$;

CREATE OR REPLACE FUNCTION public.supprimer_document_rh(_id uuid, _motif text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _doc public.documents_rh;
BEGIN
  IF btrim(coalesce(_motif, '')) = '' THEN
    RAISE EXCEPTION 'rh_motif_obligatoire';
  END IF;
  SELECT * INTO _doc FROM public.documents_rh d WHERE d.id = _id;
  IF _doc.id IS NULL THEN
    RAISE EXCEPTION 'rh_document_introuvable';
  END IF;
  PERFORM public.rh_exiger_gestionnaire(_doc.company_id);
  IF _doc.statut = 'en_attente' THEN
    RAISE EXCEPTION 'rh_document_introuvable';
  END IF;
  IF _doc.statut <> 'supprime' THEN
    UPDATE public.documents_rh d
      SET statut = 'supprime', supprime_par = auth.uid(), supprime_le = now(),
          motif_suppression = btrim(_motif)
    WHERE d.id = _id
    RETURNING * INTO _doc;
    PERFORM public.rh_journaliser(_doc, 'suppression', jsonb_build_object('motif', btrim(_motif)));
  END IF;
  -- Ticket d'effacement du fichier (aussi pour réessayer si l'effacement a échoué).
  INSERT INTO public.tickets_fichiers_rh (user_id, fichier, action, expire_le)
  VALUES (auth.uid(), _doc.fichier, 'suppression', now() + interval '60 seconds');
  RETURN _doc.fichier;
END $$;

-- Copies de carte d'identité arrivées à échéance (à supprimer), et fichiers de documents
-- supprimés encore présents dans le stockage (effacement à refaire).
CREATE OR REPLACE FUNCTION public.documents_rh_a_traiter()
RETURNS TABLE (id uuid, personnel_id uuid, type text, statut text, conserver_jusqu_au date,
               fichier_present boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _societe uuid := public.get_user_company_id(auth.uid());
BEGIN
  PERFORM public.rh_exiger_gestionnaire(_societe);
  RETURN QUERY
  SELECT d.id, d.personnel_id, d.type, d.statut, d.conserver_jusqu_au,
         EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'rh' AND o.name = d.fichier)
  FROM public.documents_rh d
  WHERE d.company_id = _societe
    AND ((d.type = 'carte_identite' AND d.statut IN ('actif', 'remplace')
          AND d.conserver_jusqu_au <= current_date)
      OR (d.statut = 'supprime'
          AND EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'rh' AND o.name = d.fichier)))
  ORDER BY d.conserver_jusqu_au NULLS LAST;
END $$;

REVOKE ALL ON FUNCTION public.preparer_depot_rh(text, text, text, uuid, uuid, uuid, uuid, boolean, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.confirmer_depot_rh(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.annuler_depot_rh(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ouvrir_document_rh(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.supprimer_document_rh(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.documents_rh_a_traiter() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preparer_depot_rh(text, text, text, uuid, uuid, uuid, uuid, boolean, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirmer_depot_rh(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.annuler_depot_rh(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ouvrir_document_rh(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.supprimer_document_rh(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.documents_rh_a_traiter() TO authenticated;

-- ---------------------------------------------------------------------------
-- 8. Échéance recalculée quand la date de sortie change
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.personnel_echeance_rh()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.documents_rh d
    SET conserver_jusqu_au = (NEW.date_sortie + interval '1 year')::date
  WHERE d.personnel_id = NEW.id AND d.type = 'carte_identite' AND d.statut = 'actif';
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.personnel_echeance_rh() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_personnel_echeance_rh ON public.personnel;
CREATE TRIGGER trg_personnel_echeance_rh AFTER UPDATE OF date_sortie ON public.personnel
  FOR EACH ROW WHEN (NEW.date_sortie IS DISTINCT FROM OLD.date_sortie)
  EXECUTE FUNCTION public.personnel_echeance_rh();

-- ---------------------------------------------------------------------------
-- 9. RLS : lecture des métadonnées par les gestionnaires ; écriture par les fonctions seules
-- ---------------------------------------------------------------------------
ALTER TABLE public.documents_rh ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_acces_rh ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets_fichiers_rh ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.documents_rh FROM anon, authenticated;
REVOKE ALL ON public.journal_acces_rh FROM anon, authenticated;
REVOKE ALL ON public.tickets_fichiers_rh FROM anon, authenticated;
GRANT SELECT ON public.documents_rh TO authenticated;
GRANT SELECT ON public.journal_acces_rh TO authenticated;
GRANT ALL ON public.documents_rh, public.journal_acces_rh, public.tickets_fichiers_rh TO service_role;

DROP POLICY IF EXISTS "documents_rh_select" ON public.documents_rh;
CREATE POLICY "documents_rh_select" ON public.documents_rh FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()) AND (SELECT public.est_gestionnaire()));
DROP POLICY IF EXISTS "journal_acces_rh_select" ON public.journal_acces_rh;
CREATE POLICY "journal_acces_rh_select" ON public.journal_acces_rh FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()) AND (SELECT public.est_gestionnaire()));

-- Administrateur de la plateforme : métadonnées des sociétés « démo » seulement, jamais les
-- fichiers (le stockage exige un ticket, réservé aux gestionnaires de la société).
DROP POLICY IF EXISTS "admin_plateforme_demo_select" ON public.documents_rh;
CREATE POLICY "admin_plateforme_demo_select" ON public.documents_rh FOR SELECT TO authenticated
  USING ((SELECT public.est_admin_plateforme()) AND public.est_societe_demo(company_id));
DROP POLICY IF EXISTS "admin_plateforme_demo_select" ON public.journal_acces_rh;
CREATE POLICY "admin_plateforme_demo_select" ON public.journal_acces_rh FOR SELECT TO authenticated
  USING ((SELECT public.est_admin_plateforme()) AND public.est_societe_demo(company_id));

-- ---------------------------------------------------------------------------
-- 10. Stockage `rh` : dépôt sur ligne préparée ; lecture et effacement sur ticket ; jamais de
--     remplacement
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "rh_insert" ON storage.objects;
CREATE POLICY "rh_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'rh'
    AND (storage.foldername(name))[1] = public.get_user_company_id(auth.uid())::text
    AND EXISTS (
      SELECT 1 FROM public.documents_rh d
      WHERE d.fichier = storage.objects.name AND d.statut = 'en_attente'
        AND d.depose_par = auth.uid()
    )
  );

DROP POLICY IF EXISTS "rh_select" ON storage.objects;
CREATE POLICY "rh_select" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'rh'
    AND (storage.foldername(name))[1] = public.get_user_company_id(auth.uid())::text
    AND public.ticket_fichier_rh_valide(name, 'lecture')
  );

DROP POLICY IF EXISTS "rh_delete" ON storage.objects;
CREATE POLICY "rh_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'rh'
    AND (storage.foldername(name))[1] = public.get_user_company_id(auth.uid())::text
    AND public.ticket_fichier_rh_valide(name, 'suppression')
  );
-- Pas de policy UPDATE : un fichier RH n'est jamais remplacé en place.

-- ---------------------------------------------------------------------------
-- ROLLBACK : (à exécuter manuellement ; vider d'abord le bucket `rh` depuis le tableau de bord
-- Supabase — les copies de cartes d'identité doivent être supprimées, pas abandonnées)
-- ---------------------------------------------------------------------------
-- DROP POLICY IF EXISTS "rh_insert" ON storage.objects;
-- DROP POLICY IF EXISTS "rh_select" ON storage.objects;
-- DROP POLICY IF EXISTS "rh_delete" ON storage.objects;
-- DROP TRIGGER IF EXISTS trg_personnel_echeance_rh ON public.personnel;
-- DROP FUNCTION IF EXISTS public.personnel_echeance_rh();
-- DROP FUNCTION IF EXISTS public.documents_rh_a_traiter();
-- DROP FUNCTION IF EXISTS public.supprimer_document_rh(uuid, text);
-- DROP FUNCTION IF EXISTS public.ouvrir_document_rh(uuid);
-- DROP FUNCTION IF EXISTS public.annuler_depot_rh(uuid);
-- DROP FUNCTION IF EXISTS public.confirmer_depot_rh(uuid);
-- DROP FUNCTION IF EXISTS public.preparer_depot_rh(text, text, text, uuid, uuid, uuid, uuid, boolean, text, uuid);
-- DROP FUNCTION IF EXISTS public.rh_journaliser(public.documents_rh, text, jsonb);
-- DROP FUNCTION IF EXISTS public.rh_echeance_carte(uuid);
-- DROP FUNCTION IF EXISTS public.rh_exiger_gestionnaire(uuid);
-- DROP FUNCTION IF EXISTS public.ticket_fichier_rh_valide(text, text);
-- DROP TABLE IF EXISTS public.tickets_fichiers_rh;
-- DROP TABLE IF EXISTS public.journal_acces_rh;
-- DROP TABLE IF EXISTS public.documents_rh;
-- ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_id_company_uniq;
-- DELETE FROM storage.buckets WHERE id = 'rh';   -- seulement si le bucket est vide
