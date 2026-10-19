-- Équipe interne — timesheet (PR A du plan docs/plans/equipe-timesheet-dossiers.md).
-- Décisions validées par Youssef le 20/10/2026 :
--
--  * L'équipe interne reste la table `personnel` (jamais mélangée avec `sous_traitants`) :
--    + fonction, date d'entrée, date de sortie (base du délai de conservation RGPD, PR B),
--    + profile_id : compte utilisateur lié à la fiche (le rôle « ouvrier » lit SES heures).
--    Seul un gestionnaire (admin, gérant) peut définir ce lien.
--  * Pointage = travailleur, chantier, date, arrivée, départ (vide = pointage en cours), pause en
--    minutes ; durée calculée. Pas de chevauchement pour un même travailleur le même jour ; un
--    travailleur inactif ne reçoit plus de nouveau pointage. Pas de travail de nuit à cheval sur
--    deux jours (départ > arrivée).
--  * Saisie, correction, suppression : gestionnaires uniquement. Lecture : gestionnaires de la
--    société, et l'ouvrier lié à la fiche pour ses propres pointages.
--  * Correction tracée : toute modification ou suppression passe par corriger_pointage() ou
--    supprimer_pointage(), motif obligatoire ; l'historique (avant / après, auteur, date) est
--    écrit par trigger dans `pointage_corrections`, jamais modifiable ni supprimable par l'API.
--    Seule exception sans motif : enregistrer le départ d'un pointage en cours.
--  * `presence` (absences du jour) est conservée telle quelle ; aucune donnée migrée.
-- Migration idempotente (rejouable) ; retour arrière en commentaire à la fin.
-- Prérequis : 20261014090000 (est_gestionnaire), 20261016110000 (policies démo).

-- ---------------------------------------------------------------------------
-- 1. Fiche travailleur
-- ---------------------------------------------------------------------------
ALTER TABLE public.personnel ADD COLUMN IF NOT EXISTS fonction text;
ALTER TABLE public.personnel ADD COLUMN IF NOT EXISTS date_entree date;
ALTER TABLE public.personnel ADD COLUMN IF NOT EXISTS date_sortie date;
ALTER TABLE public.personnel ADD COLUMN IF NOT EXISTS profile_id uuid
  REFERENCES public.profiles(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'personnel_id_company_uniq') THEN
    ALTER TABLE public.personnel ADD CONSTRAINT personnel_id_company_uniq UNIQUE (id, company_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'personnel_dates_chk') THEN
    ALTER TABLE public.personnel ADD CONSTRAINT personnel_dates_chk
      CHECK (date_sortie IS NULL OR date_entree IS NULL OR date_sortie >= date_entree);
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS idx_personnel_profile_unique
  ON public.personnel (profile_id) WHERE profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_personnel_company ON public.personnel (company_id);

-- Le compte lié appartient à la même société ; seul un gestionnaire change ce lien.
CREATE OR REPLACE FUNCTION public.personnel_lien_compte()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.profile_id IS NOT DISTINCT FROM (CASE WHEN TG_OP = 'UPDATE' THEN OLD.profile_id END) THEN
    RETURN NEW;
  END IF;
  -- auth.uid() nul : migration, seed ou tableau de bord Supabase (pas l'API).
  IF auth.uid() IS NOT NULL AND NOT public.est_gestionnaire() THEN
    RAISE EXCEPTION 'personnel_lien_compte_reserve';
  END IF;
  IF NEW.profile_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = NEW.profile_id AND p.company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'personnel_lien_compte_autre_societe';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.personnel_lien_compte() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_personnel_lien_compte ON public.personnel;
CREATE TRIGGER trg_personnel_lien_compte BEFORE INSERT OR UPDATE OF profile_id, company_id
  ON public.personnel FOR EACH ROW EXECUTE FUNCTION public.personnel_lien_compte();

-- Comptes de la société (pour lier un compte à une fiche) : gestionnaires uniquement, société
-- de l'appelant uniquement. Les profils ne sont lisibles que par leur propriétaire (RLS).
CREATE OR REPLACE FUNCTION public.comptes_societe()
RETURNS TABLE (id uuid, nom text, email text, role text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.est_gestionnaire() THEN
    RAISE EXCEPTION 'personnel_lien_compte_reserve';
  END IF;
  RETURN QUERY
    SELECT p.id, p.full_name, u.email::text, p.role
    FROM public.profiles p JOIN auth.users u ON u.id = p.id
    WHERE p.company_id = public.get_user_company_id(auth.uid())
    ORDER BY p.full_name NULLS LAST, u.email;
END $$;
REVOKE ALL ON FUNCTION public.comptes_societe() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.comptes_societe() TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Pointages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pointages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  personnel_id uuid NOT NULL,
  chantier_id uuid NOT NULL,
  date date NOT NULL,
  arrivee time NOT NULL,
  depart time,
  pause_minutes integer NOT NULL DEFAULT 0 CHECK (pause_minutes BETWEEN 0 AND 720),
  minutes_travaillees integer GENERATED ALWAYS AS (
    CASE WHEN depart IS NULL THEN NULL
         ELSE (extract(epoch FROM (depart - arrivee)) / 60)::integer - pause_minutes END
  ) STORED,
  note text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  modifie_par uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  modifie_le timestamptz,
  CONSTRAINT pointages_id_company_uniq UNIQUE (id, company_id),
  CONSTRAINT pointages_personnel_fk FOREIGN KEY (personnel_id, company_id)
    REFERENCES public.personnel (id, company_id),  -- NO ACTION : fiche avec pointages non supprimable
  CONSTRAINT pointages_chantier_fk FOREIGN KEY (chantier_id, company_id)
    REFERENCES public.chantiers (id, company_id),
  CONSTRAINT pointages_horaires_chk CHECK (
    depart IS NULL
    OR (depart > arrivee AND pause_minutes < extract(epoch FROM (depart - arrivee)) / 60)
  )
);
CREATE INDEX IF NOT EXISTS idx_pointages_company_date ON public.pointages (company_id, date);
CREATE INDEX IF NOT EXISTS idx_pointages_personnel_date ON public.pointages (personnel_id, date);
CREATE INDEX IF NOT EXISTS idx_pointages_chantier_date ON public.pointages (chantier_id, date);
CREATE INDEX IF NOT EXISTS idx_pointages_created_by ON public.pointages (created_by);
CREATE INDEX IF NOT EXISTS idx_pointages_modifie_par ON public.pointages (modifie_par);

-- ---------------------------------------------------------------------------
-- 3. Historique des corrections (jamais modifié ni supprimé par l'API)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pointage_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  pointage_id uuid NOT NULL,           -- sans FK : la trace survit à la suppression du pointage
  personnel_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('modification', 'suppression')),
  avant jsonb NOT NULL,
  apres jsonb,
  motif text NOT NULL CHECK (btrim(motif) <> ''),
  par uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  par_nom text,                        -- nom de l'auteur au moment de la correction
  le timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pointage_corrections ADD COLUMN IF NOT EXISTS par_nom text;
CREATE INDEX IF NOT EXISTS idx_pointage_corrections_company ON public.pointage_corrections (company_id);
CREATE INDEX IF NOT EXISTS idx_pointage_corrections_pointage ON public.pointage_corrections (pointage_id, le);
CREATE INDEX IF NOT EXISTS idx_pointage_corrections_personnel ON public.pointage_corrections (personnel_id);
CREATE INDEX IF NOT EXISTS idx_pointage_corrections_par ON public.pointage_corrections (par);

-- ---------------------------------------------------------------------------
-- 4. Règles : auteur, travailleur actif, chevauchement, motif, historique
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pointages_garde()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _motif text := nullif(btrim(coalesce(current_setting('zidarpro.motif_correction', true), '')), '');
  _depart_seul boolean;
  _auteur text := (SELECT p.full_name FROM public.profiles p WHERE p.id = auth.uid());
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Suppression de la société entière (cascade, hors API) : pas de trace à conserver.
    IF auth.uid() IS NULL AND NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = OLD.company_id) THEN
      RETURN OLD;
    END IF;
    IF _motif IS NULL THEN
      RAISE EXCEPTION 'pointage_motif_obligatoire';
    END IF;
    INSERT INTO public.pointage_corrections (company_id, pointage_id, personnel_id, action, avant, motif, par, par_nom)
    VALUES (OLD.company_id, OLD.id, OLD.personnel_id, 'suppression', to_jsonb(OLD) - 'minutes_travaillees',
            _motif, auth.uid(), _auteur);
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.created_by := coalesce(auth.uid(), NEW.created_by);
    NEW.created_at := now();
    NEW.modifie_par := NULL;
    NEW.modifie_le := NULL;
    IF EXISTS (SELECT 1 FROM public.personnel p WHERE p.id = NEW.personnel_id AND lower(p.status) = 'inactif') THEN
      RAISE EXCEPTION 'pointage_travailleur_inactif';
    END IF;
  ELSE
    IF NEW.company_id <> OLD.company_id OR NEW.personnel_id <> OLD.personnel_id THEN
      RAISE EXCEPTION 'pointage_champ_protege';
    END IF;
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
    -- Enregistrer le départ d'un pointage en cours : pas une correction.
    _depart_seul := OLD.depart IS NULL AND NEW.depart IS NOT NULL
      AND NEW.chantier_id = OLD.chantier_id AND NEW.date = OLD.date AND NEW.arrivee = OLD.arrivee;
    IF NOT _depart_seul AND _motif IS NULL THEN
      RAISE EXCEPTION 'pointage_motif_obligatoire';
    END IF;
    NEW.modifie_par := auth.uid();
    NEW.modifie_le := now();
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.pointages o
    WHERE o.personnel_id = NEW.personnel_id AND o.date = NEW.date AND o.id <> NEW.id
      AND NEW.arrivee < coalesce(o.depart, time '24:00')
      AND o.arrivee < coalesce(NEW.depart, time '24:00')
  ) THEN
    RAISE EXCEPTION 'pointage_chevauchement';
  END IF;

  IF TG_OP = 'UPDATE' AND NOT _depart_seul THEN
    INSERT INTO public.pointage_corrections (company_id, pointage_id, personnel_id, action, avant, apres, motif, par, par_nom)
    VALUES (OLD.company_id, OLD.id, OLD.personnel_id, 'modification',
            to_jsonb(OLD) - 'minutes_travaillees',
            to_jsonb(NEW) - 'minutes_travaillees', _motif, auth.uid(), _auteur);
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.pointages_garde() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_pointages_garde ON public.pointages;
CREATE TRIGGER trg_pointages_garde BEFORE INSERT OR UPDATE OR DELETE ON public.pointages
  FOR EACH ROW EXECUTE FUNCTION public.pointages_garde();

-- Correction et suppression avec motif (SECURITY INVOKER : la RLS s'applique).
CREATE OR REPLACE FUNCTION public.corriger_pointage(
  _id uuid, _chantier_id uuid, _date date, _arrivee time, _depart time,
  _pause_minutes integer, _note text, _motif text)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF btrim(coalesce(_motif, '')) = '' THEN
    RAISE EXCEPTION 'pointage_motif_obligatoire';
  END IF;
  PERFORM set_config('zidarpro.motif_correction', _motif, true);
  UPDATE public.pointages
    SET chantier_id = _chantier_id, date = _date, arrivee = _arrivee, depart = _depart,
        pause_minutes = coalesce(_pause_minutes, 0), note = _note
  WHERE id = _id;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM set_config('zidarpro.motif_correction', '', true);
  IF n = 0 THEN
    RAISE EXCEPTION 'pointage_introuvable';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.corriger_pointage(uuid, uuid, date, time, time, integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.corriger_pointage(uuid, uuid, date, time, time, integer, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.supprimer_pointage(_id uuid, _motif text)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF btrim(coalesce(_motif, '')) = '' THEN
    RAISE EXCEPTION 'pointage_motif_obligatoire';
  END IF;
  PERFORM set_config('zidarpro.motif_correction', _motif, true);
  DELETE FROM public.pointages WHERE id = _id;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM set_config('zidarpro.motif_correction', '', true);
  IF n = 0 THEN
    RAISE EXCEPTION 'pointage_introuvable';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.supprimer_pointage(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supprimer_pointage(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.pointages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pointage_corrections ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.pointages FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pointages TO authenticated;
GRANT ALL ON public.pointages TO service_role;
REVOKE ALL ON public.pointage_corrections FROM anon, authenticated;
GRANT SELECT ON public.pointage_corrections TO authenticated;
GRANT ALL ON public.pointage_corrections TO service_role;

DROP POLICY IF EXISTS "pointages_select" ON public.pointages;
CREATE POLICY "pointages_select" ON public.pointages FOR SELECT TO authenticated
  USING (
    company_id = public.get_user_company_id(auth.uid())
    AND (
      (SELECT public.est_gestionnaire())
      OR EXISTS (SELECT 1 FROM public.personnel p
                 WHERE p.id = pointages.personnel_id AND p.profile_id = auth.uid())
    )
  );
DROP POLICY IF EXISTS "pointages_insert" ON public.pointages;
CREATE POLICY "pointages_insert" ON public.pointages FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()) AND (SELECT public.est_gestionnaire()));
DROP POLICY IF EXISTS "pointages_update" ON public.pointages;
CREATE POLICY "pointages_update" ON public.pointages FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()) AND (SELECT public.est_gestionnaire()))
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()) AND (SELECT public.est_gestionnaire()));
DROP POLICY IF EXISTS "pointages_delete" ON public.pointages;
CREATE POLICY "pointages_delete" ON public.pointages FOR DELETE TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()) AND (SELECT public.est_gestionnaire()));

-- Historique : lecture par les gestionnaires et par l'ouvrier concerné ; écrit par trigger seulement.
DROP POLICY IF EXISTS "pointage_corrections_select" ON public.pointage_corrections;
CREATE POLICY "pointage_corrections_select" ON public.pointage_corrections FOR SELECT TO authenticated
  USING (
    company_id = public.get_user_company_id(auth.uid())
    AND (
      (SELECT public.est_gestionnaire())
      OR EXISTS (SELECT 1 FROM public.personnel p
                 WHERE p.id = pointage_corrections.personnel_id AND p.profile_id = auth.uid())
    )
  );

-- Lecture seule des sociétés « démo » par l'administrateur de la plateforme.
DROP POLICY IF EXISTS "admin_plateforme_demo_select" ON public.pointages;
CREATE POLICY "admin_plateforme_demo_select" ON public.pointages FOR SELECT TO authenticated
  USING ((SELECT public.est_admin_plateforme()) AND public.est_societe_demo(company_id));
DROP POLICY IF EXISTS "admin_plateforme_demo_select" ON public.pointage_corrections;
CREATE POLICY "admin_plateforme_demo_select" ON public.pointage_corrections FOR SELECT TO authenticated
  USING ((SELECT public.est_admin_plateforme()) AND public.est_societe_demo(company_id));

-- ---------------------------------------------------------------------------
-- ROLLBACK : (à exécuter manuellement ; supprime les pointages et leur historique)
-- ---------------------------------------------------------------------------
-- DROP FUNCTION IF EXISTS public.comptes_societe();
-- DROP FUNCTION IF EXISTS public.supprimer_pointage(uuid, text);
-- DROP FUNCTION IF EXISTS public.corriger_pointage(uuid, uuid, date, time, time, integer, text, text);
-- DROP TABLE IF EXISTS public.pointage_corrections;
-- DROP TABLE IF EXISTS public.pointages;
-- DROP FUNCTION IF EXISTS public.pointages_garde();
-- DROP TRIGGER IF EXISTS trg_personnel_lien_compte ON public.personnel;
-- DROP FUNCTION IF EXISTS public.personnel_lien_compte();
-- DROP INDEX IF EXISTS public.idx_personnel_profile_unique;
-- ALTER TABLE public.personnel DROP CONSTRAINT IF EXISTS personnel_dates_chk;
-- ALTER TABLE public.personnel DROP CONSTRAINT IF EXISTS personnel_id_company_uniq;
-- ALTER TABLE public.personnel DROP COLUMN IF EXISTS profile_id;
-- ALTER TABLE public.personnel DROP COLUMN IF EXISTS date_sortie;
-- ALTER TABLE public.personnel DROP COLUMN IF EXISTS date_entree;
-- ALTER TABLE public.personnel DROP COLUMN IF EXISTS fonction;
