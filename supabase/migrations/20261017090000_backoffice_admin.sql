-- Back-office de l'administrateur de la plateforme (lecture seule).
--
-- Règles : administrateur = est_admin_plateforme() ; AUCUNE donnée métier des clients réels
-- (seulement métadonnées de compte et totaux agrégés) ; sociétés « démo » lisibles en lecture
-- seule ; nouvelles tables sans aucune policy (accès uniquement par les fonctions ci-dessous).
--
--  1. journal_plateforme : changements importants (triggers, identifiants seulement).
--  2. erreurs_application : erreurs signalées par l'application (signaler_erreur), purge à 90 j.
--  3. admin_statistiques, admin_utilisateurs, admin_activite, admin_conformite.
-- Migration idempotente (rejouable) ; retour arrière en commentaire à la fin.

-- ---------------------------------------------------------------------------
-- 1. Tables de plateforme (pas de company_id obligatoire : exception documentée)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.journal_plateforme (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cree_le timestamptz NOT NULL DEFAULT now(),
  type text NOT NULL CHECK (type IN (
    'societe_creee', 'demo_activee', 'demo_retiree', 'profil_modifie',
    'contrat_envoye', 'contrat_signe', 'signature_annulee',
    'document_invalide', 'derogation_accordee', 'derogation_revoquee', 'paiement_annule')),
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  acteur uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS journal_plateforme_cree_le_idx ON public.journal_plateforme (cree_le DESC);
CREATE INDEX IF NOT EXISTS journal_plateforme_company_idx ON public.journal_plateforme (company_id);

CREATE TABLE IF NOT EXISTS public.erreurs_application (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cree_le timestamptz NOT NULL DEFAULT now(),
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  user_id uuid,
  code text NOT NULL,
  message text,
  page text,
  navigateur text
);
CREATE INDEX IF NOT EXISTS erreurs_application_cree_le_idx ON public.erreurs_application (cree_le DESC);
CREATE INDEX IF NOT EXISTS erreurs_application_user_idx ON public.erreurs_application (user_id, cree_le);
CREATE INDEX IF NOT EXISTS erreurs_application_company_idx ON public.erreurs_application (company_id);

ALTER TABLE public.journal_plateforme ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erreurs_application ENABLE ROW LEVEL SECURITY;
-- Aucune policy : ni lecture ni écriture directe par l'API (droits par défaut de Supabase retirés).
REVOKE ALL ON public.journal_plateforme FROM anon, authenticated;
REVOKE ALL ON public.erreurs_application FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Journalisation des changements importants (identifiants seulement, aucun contenu métier)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.journaliser(_type text, _company_id uuid, _details jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.journal_plateforme (type, company_id, acteur, details)
  VALUES (_type, _company_id, auth.uid(), coalesce(_details, '{}'::jsonb))
$$;

CREATE OR REPLACE FUNCTION public.trg_journal_companies()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.journaliser('societe_creee', NEW.id, '{}');
  ELSIF NEW.est_demo IS DISTINCT FROM OLD.est_demo THEN
    PERFORM public.journaliser(CASE WHEN NEW.est_demo THEN 'demo_activee' ELSE 'demo_retiree' END,
                               NEW.id, '{}');
  END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.trg_journal_profils()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role OR NEW.company_id IS DISTINCT FROM OLD.company_id THEN
    PERFORM public.journaliser('profil_modifie', NEW.company_id, jsonb_build_object(
      'profil', NEW.id, 'role_avant', OLD.role, 'role_apres', NEW.role,
      'societe_avant', OLD.company_id));
  END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.trg_journal_signatures()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.journaliser('contrat_envoye', NEW.company_id,
      jsonb_build_object('contrat', NEW.contrat_id, 'modele', NEW.modele));
  ELSIF NEW.statut IS DISTINCT FROM OLD.statut AND NEW.statut IN ('signe', 'annule') THEN
    PERFORM public.journaliser(CASE WHEN NEW.statut = 'signe' THEN 'contrat_signe'
                                    ELSE 'signature_annulee' END,
      NEW.company_id, jsonb_build_object('contrat', NEW.contrat_id, 'modele', NEW.modele));
  END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.trg_journal_conformite()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'documents_conformite' THEN
    IF NEW.invalide_le IS NOT NULL AND OLD.invalide_le IS NULL THEN
      PERFORM public.journaliser('document_invalide', NEW.company_id,
        jsonb_build_object('document', NEW.id, 'sous_traitant', NEW.sous_traitant_id));
    END IF;
  ELSIF TG_TABLE_NAME = 'derogations_conformite' THEN
    IF TG_OP = 'INSERT' THEN
      PERFORM public.journaliser('derogation_accordee', NEW.company_id,
        jsonb_build_object('derogation', NEW.id, 'sous_traitant', NEW.sous_traitant_id));
    ELSIF NEW.revoquee_le IS NOT NULL AND OLD.revoquee_le IS NULL THEN
      PERFORM public.journaliser('derogation_revoquee', NEW.company_id,
        jsonb_build_object('derogation', NEW.id, 'sous_traitant', NEW.sous_traitant_id));
    END IF;
  ELSIF TG_TABLE_NAME = 'achat_paiements' THEN
    IF NEW.annule_le IS NOT NULL AND OLD.annule_le IS NULL THEN
      PERFORM public.journaliser('paiement_annule', NEW.company_id,
        jsonb_build_object('paiement', NEW.id, 'contrat', NEW.contrat_id));
    END IF;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_journal_companies ON public.companies;
CREATE TRIGGER trg_journal_companies AFTER INSERT OR UPDATE OF est_demo ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.trg_journal_companies();
DROP TRIGGER IF EXISTS trg_journal_profils ON public.profiles;
CREATE TRIGGER trg_journal_profils AFTER UPDATE OF role, company_id ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.trg_journal_profils();
DROP TRIGGER IF EXISTS trg_journal_signatures ON public.contrat_signatures;
CREATE TRIGGER trg_journal_signatures AFTER INSERT OR UPDATE OF statut ON public.contrat_signatures
  FOR EACH ROW EXECUTE FUNCTION public.trg_journal_signatures();
DROP TRIGGER IF EXISTS trg_journal_documents ON public.documents_conformite;
CREATE TRIGGER trg_journal_documents AFTER UPDATE OF invalide_le ON public.documents_conformite
  FOR EACH ROW EXECUTE FUNCTION public.trg_journal_conformite();
DROP TRIGGER IF EXISTS trg_journal_derogations ON public.derogations_conformite;
CREATE TRIGGER trg_journal_derogations AFTER INSERT OR UPDATE OF revoquee_le ON public.derogations_conformite
  FOR EACH ROW EXECUTE FUNCTION public.trg_journal_conformite();
DROP TRIGGER IF EXISTS trg_journal_paiements ON public.achat_paiements;
CREATE TRIGGER trg_journal_paiements AFTER UPDATE OF annule_le ON public.achat_paiements
  FOR EACH ROW EXECUTE FUNCTION public.trg_journal_conformite();

-- ---------------------------------------------------------------------------
-- 3. Erreurs signalées par l'application
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.signaler_erreur(
  _code text, _message text, _page text, _navigateur text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RETURN;
  END IF;
  -- Au plus 20 erreurs par utilisateur sur 10 minutes (au-delà : ignorées).
  IF (SELECT count(*) FROM public.erreurs_application
      WHERE user_id = uid AND cree_le > now() - interval '10 minutes') >= 20 THEN
    RETURN;
  END IF;
  INSERT INTO public.erreurs_application (company_id, user_id, code, message, page, navigateur)
  VALUES (public.get_user_company_id(uid), uid, left(coalesce(nullif(btrim(_code), ''), 'inconnu'), 80),
          left(_message, 500), left(_page, 200), left(_navigateur, 300));
  -- Conservation : 90 jours.
  DELETE FROM public.erreurs_application WHERE cree_le < now() - interval '90 days';
END $$;

-- ---------------------------------------------------------------------------
-- 4. Fonctions de lecture de l'administrateur (aucune donnée métier des clients réels)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.exiger_admin_plateforme()
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.est_admin_plateforme() THEN
    RAISE EXCEPTION 'acces_reserve_admin_plateforme' USING ERRCODE = 'P0001';
  END IF;
END $$;

-- Totaux agrégés sur toute la plateforme, séparés clients réels / démo.
CREATE OR REPLACE FUNCTION public.admin_statistiques()
RETURNS TABLE (indicateur text, reel bigint, demo bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.exiger_admin_plateforme();
  RETURN QUERY
  WITH d AS (SELECT id, est_demo FROM public.companies)
  SELECT 'societes', count(*) FILTER (WHERE NOT est_demo), count(*) FILTER (WHERE est_demo) FROM d
  UNION ALL
  SELECT 'utilisateurs', count(*) FILTER (WHERE NOT d.est_demo), count(*) FILTER (WHERE d.est_demo)
    FROM public.profiles x JOIN d ON d.id = x.company_id
  UNION ALL
  SELECT 'chantiers', count(*) FILTER (WHERE NOT d.est_demo), count(*) FILTER (WHERE d.est_demo)
    FROM public.chantiers x JOIN d ON d.id = x.company_id
  UNION ALL
  SELECT 'sous_traitants', count(*) FILTER (WHERE NOT d.est_demo), count(*) FILTER (WHERE d.est_demo)
    FROM public.sous_traitants x JOIN d ON d.id = x.company_id
  UNION ALL
  SELECT 'contrats', count(*) FILTER (WHERE NOT d.est_demo), count(*) FILTER (WHERE d.est_demo)
    FROM public.sous_traitant_contrats x JOIN d ON d.id = x.company_id
  UNION ALL
  SELECT 'prestations', count(*) FILTER (WHERE NOT d.est_demo), count(*) FILTER (WHERE d.est_demo)
    FROM public.sous_traitant_prestations x JOIN d ON d.id = x.company_id
  UNION ALL
  SELECT 'verifications_30bis', count(*) FILTER (WHERE NOT d.est_demo), count(*) FILTER (WHERE d.est_demo)
    FROM public.verifications_30bis x JOIN d ON d.id = x.company_id;
END $$;

-- Utilisateurs : rôle, société, création, dernière connexion ; e-mail et nom pour les démos seulement.
CREATE OR REPLACE FUNCTION public.admin_utilisateurs()
RETURNS TABLE (
  id uuid, societe_id uuid, societe text, est_demo boolean, role text,
  cree_le timestamptz, derniere_connexion timestamptz, email text, nom text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.exiger_admin_plateforme();
  RETURN QUERY
  SELECT p.id, c.id, c.name, coalesce(c.est_demo, false), p.role,
    u.created_at, u.last_sign_in_at,
    CASE WHEN c.est_demo THEN u.email::text END,
    CASE WHEN c.est_demo THEN p.full_name END
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  LEFT JOIN public.companies c ON c.id = p.company_id
  ORDER BY u.created_at DESC;
END $$;

-- Journal d'activité : connexions, créations de comptes, changements, erreurs.
-- Clients réels : date, catégorie, type, société ; détails, e-mails et messages : démos seulement.
CREATE OR REPLACE FUNCTION public.admin_activite(_categorie text DEFAULT NULL, _limite integer DEFAULT 200)
RETURNS TABLE (
  quand timestamptz, categorie text, type text, societe_id uuid, societe text,
  est_demo boolean, email text, details jsonb
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  lim integer := least(greatest(coalesce(_limite, 200), 1), 1000);
  parts text[] := '{}';
BEGIN
  PERFORM public.exiger_admin_plateforme();

  -- Sources : (quand, categorie, type, user_id, company_id, details)
  IF _categorie IS NULL OR _categorie = 'connexion' THEN
    IF to_regclass('auth.audit_log_entries') IS NOT NULL THEN
      parts := array_append(parts, $q$(SELECT a.created_at, 'connexion'::text, 'login'::text,
          (a.payload ->> 'actor_id')::uuid, NULL::uuid, '{}'::jsonb
        FROM auth.audit_log_entries a
        WHERE a.payload ->> 'action' = 'login'
          AND (a.payload ->> 'actor_id') ~ '^[0-9a-f-]{36}$'
        ORDER BY a.created_at DESC LIMIT $1)$q$);
    ELSE
      parts := array_append(parts, $q$(SELECT u.last_sign_in_at, 'connexion'::text, 'derniere_connexion'::text,
          u.id, NULL::uuid, '{}'::jsonb
        FROM auth.users u WHERE u.last_sign_in_at IS NOT NULL
        ORDER BY u.last_sign_in_at DESC LIMIT $1)$q$);
    END IF;
  END IF;
  IF _categorie IS NULL OR _categorie = 'creation_compte' THEN
    parts := array_append(parts, $q$(SELECT u.created_at, 'creation_compte'::text, 'compte_cree'::text,
        u.id, NULL::uuid, '{}'::jsonb
      FROM auth.users u ORDER BY u.created_at DESC LIMIT $1)$q$);
  END IF;
  IF _categorie IS NULL OR _categorie = 'changement' THEN
    parts := array_append(parts, $q$(SELECT j.cree_le, 'changement'::text, j.type, j.acteur, j.company_id, j.details
      FROM public.journal_plateforme j ORDER BY j.cree_le DESC LIMIT $1)$q$);
  END IF;
  IF _categorie IS NULL OR _categorie = 'erreur' THEN
    parts := array_append(parts, $q$(SELECT e.cree_le, 'erreur'::text, e.code, e.user_id, e.company_id,
        jsonb_build_object('message', e.message, 'page', e.page)
      FROM public.erreurs_application e ORDER BY e.cree_le DESC LIMIT $1)$q$);
  END IF;
  IF cardinality(parts) = 0 THEN
    RETURN;
  END IF;

  -- Clients réels : ni e-mail, ni détails (sauf la page d'une erreur) ; démos : tout.
  RETURN QUERY EXECUTE format($q$
    SELECT a.quand, a.categorie, a.type, c.id, c.name, coalesce(c.est_demo, false),
      CASE WHEN c.est_demo THEN u.email::text END,
      CASE
        WHEN c.est_demo THEN a.details
        WHEN a.categorie = 'erreur' THEN jsonb_build_object('page', a.details ->> 'page')
        ELSE NULL
      END
    FROM (%s) AS a (quand, categorie, type, user_id, company_id, details)
    LEFT JOIN auth.users u ON u.id = a.user_id
    LEFT JOIN public.profiles p ON p.id = a.user_id
    LEFT JOIN public.companies c ON c.id = coalesce(a.company_id, p.company_id)
    ORDER BY a.quand DESC NULLS LAST
    LIMIT $1 $q$, array_to_string(parts, ' UNION ALL ')) USING lim;
END $$;

-- Conformité des sous-traitants d'une société DÉMO. Security invoker : la RLS de l'appelant
-- s'applique (lecture démo de l'administrateur), en plus du contrôle explicite.
CREATE OR REPLACE FUNCTION public.admin_conformite(_company_id uuid)
RETURNS TABLE (
  sous_traitant_id uuid, attestation_30bis text, attestation_tva text, iban text,
  contrat text, derogation_jusqua timestamptz, bloque boolean
)
LANGUAGE plpgsql STABLE SET search_path = public AS $$
BEGIN
  IF NOT public.est_admin_plateforme() OR NOT public.est_societe_demo(_company_id) THEN
    RAISE EXCEPTION 'acces_reserve_admin_plateforme' USING ERRCODE = 'P0001';
  END IF;
  RETURN QUERY
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
  WHERE s.company_id = _company_id;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Droits d'exécution (Supabase accorde EXECUTE à anon par défaut)
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.journaliser(text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_journal_companies() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_journal_profils() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_journal_signatures() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_journal_conformite() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.exiger_admin_plateforme() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.signaler_erreur(text, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_statistiques() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_utilisateurs() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_activite(text, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_conformite(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.signaler_erreur(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_statistiques() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_utilisateurs() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_activite(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_conformite(uuid) TO authenticated;

-- ROLLBACK :
-- DROP TRIGGER IF EXISTS trg_journal_companies ON public.companies;
-- DROP TRIGGER IF EXISTS trg_journal_profils ON public.profiles;
-- DROP TRIGGER IF EXISTS trg_journal_signatures ON public.contrat_signatures;
-- DROP TRIGGER IF EXISTS trg_journal_documents ON public.documents_conformite;
-- DROP TRIGGER IF EXISTS trg_journal_derogations ON public.derogations_conformite;
-- DROP TRIGGER IF EXISTS trg_journal_paiements ON public.achat_paiements;
-- DROP FUNCTION IF EXISTS public.admin_conformite(uuid);
-- DROP FUNCTION IF EXISTS public.admin_activite(text, integer);
-- DROP FUNCTION IF EXISTS public.admin_utilisateurs();
-- DROP FUNCTION IF EXISTS public.admin_statistiques();
-- DROP FUNCTION IF EXISTS public.exiger_admin_plateforme();
-- DROP FUNCTION IF EXISTS public.signaler_erreur(text, text, text, text);
-- DROP FUNCTION IF EXISTS public.trg_journal_conformite();
-- DROP FUNCTION IF EXISTS public.trg_journal_signatures();
-- DROP FUNCTION IF EXISTS public.trg_journal_profils();
-- DROP FUNCTION IF EXISTS public.trg_journal_companies();
-- DROP FUNCTION IF EXISTS public.journaliser(text, uuid, jsonb);
-- DROP TABLE IF EXISTS public.erreurs_application;
-- DROP TABLE IF EXISTS public.journal_plateforme;
